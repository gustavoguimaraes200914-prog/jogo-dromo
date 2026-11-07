/* KODA GB — SERVIDOR: A CONTA DE CADA PESSOA (um Durable Object por e-mail)
   Aqui fica o saldo OFICIAL de moedas, Koda GB Diamonds e abóboras. O aparelho continua mostrando tudo na hora
   (pra ser rápido), mas cada ganho e cada gasto vira um "movimento" que vem pra cá. O servidor confere com as
   regras (regras.js), anota no livro e devolve o saldo certo — que o aparelho passa a usar.
   Quem mexer no aparelho pra se dar moedas vê o número voltar ao certo na próxima conferência.
   Também fica aqui: o tempo jogado (medido pelo relógio do servidor), o convite (quem te chamou e quando o seu
   amigo jogou 30 minutos) e o banimento. */
import { DurableObject } from 'cloudflare:workers';
import { normalizarTx, conferir, MOEDAS, temporada, passeNivelDe, PASSE_ACUM, CONVITE_SEG_ALVO, COMPARTILHAR_PREMIO,
  COMPARTILHAR_MAX, PREMIO_ENVIO_MAX, BAU_GRATIS_MS } from './regras.js';
import { inteiro, obj, texto, jogoOk, uidOk, limpaEmail, emailOk, diaBRT, chavePlausivel } from './util.js';

/* o saldo que vem do aparelho na primeira vez é aceito até aqui (o resto fica anotado pro dono conferir) */
export const TETO_IMPORTAR = { c: 250000, d: 600, a: 6000 };
const MAX_TX = 40;                    // movimentos por pedido
const MAX_TX_MIN = 240;               // movimentos por minuto
const MAX_PONTOS = 8;                 // pontuações por pedido
const IDADE_CONVIDADO = 14 * 86400000;   // só conta como amigo novo quem criou a conta há pouco
const DIAS = 86400000;

function contaNova(email, uid, agora) {
  return {
    v: 1, email, uid, criado: agora, importado: false,
    saldo: { c: 0, d: 0, a: 0 },
    nivel: { pago: 1 }, seq: { n: 0, t: 0 }, rol: { t: 0 }, bauG: { n: 0, t: 0 }, passe: {},
    envio: 0, envioT: 0,
    tempo: { ult: 0, total: 0, marco: 0, dk: '', ds: 0, jogos: {} },
    convite: { por: '', em: 0, pago: false, fim: false, tentativas: 0 },
    ban: null, fsBan: { t: 0, ban: false }, nov: [], novS: 0, indiceEm: 0, placarT: {},
    alertasDia: { k: '', n: 0 }
  };
}

export class Conta extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.fila = Promise.resolve();
    ctx.blockConcurrencyWhile(async () => {
      this.sql.exec(`CREATE TABLE IF NOT EXISTS livro (id TEXT PRIMARY KEY, t INTEGER, m TEXT, c INTEGER, d INTEGER, a INTEGER, ok INTEGER, por TEXT, q TEXT)`);
      this.sql.exec(`CREATE INDEX IF NOT EXISTS livro_t ON livro(t)`);
      this.sql.exec(`CREATE TABLE IF NOT EXISTS feito (k TEXT PRIMARY KEY, t INTEGER)`);
      this.sql.exec(`CREATE TABLE IF NOT EXISTS uso (k TEXT PRIMARY KEY, n INTEGER, t INTEGER)`);
      this.sql.exec(`CREATE TABLE IF NOT EXISTS pote (k TEXT PRIMARY KEY, n INTEGER)`);
      this.sql.exec(`CREATE TABLE IF NOT EXISTS entrada (s INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER, m TEXT, c INTEGER, d INTEGER, a INTEGER, q TEXT)`);
      this.sql.exec(`CREATE TABLE IF NOT EXISTS amigos (email TEXT PRIMARY KEY, t INTEGER)`);
      this.sql.exec(`CREATE TABLE IF NOT EXISTS cfg (k TEXT PRIMARY KEY, v TEXT)`);
      this.e = (await ctx.storage.get('e')) || null;
    });
  }

  /* uma coisa de cada vez (dois aparelhos da mesma pessoa ao mesmo tempo não se atropelam) */
  emFila(fn) {
    const p = this.fila.then(fn, fn);
    this.fila = p.catch(() => {});
    return p;
  }

  /* ---------- ajudantes do banco ---------- */
  um(sql, ...a) { const r = this.sql.exec(sql, ...a).toArray(); return r[0] || null; }
  feito(k) { return !!this.um('SELECT k FROM feito WHERE k = ?', k); }
  uso(k) { const r = this.um('SELECT n FROM uso WHERE k = ?', k); return r ? r.n : 0; }
  pote(k) { const r = this.um('SELECT n FROM pote WHERE k = ?', k); return r ? r.n : 0; }
  somarPote(k, n) {
    this.sql.exec('INSERT INTO pote (k, n) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET n = n + excluded.n', k, n);
    this.sql.exec('DELETE FROM pote WHERE n <= 0');
  }
  cfg(k) { const r = this.um('SELECT v FROM cfg WHERE k = ?', k); return r ? r.v : null; }
  setCfg(k, v) { this.sql.exec('INSERT INTO cfg (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, String(v)); }
  anotar(id, t, m, mov, ok, por, q) {
    this.sql.exec('INSERT OR IGNORE INTO livro (id, t, m, c, d, a, ok, por, q) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, t, m, mov.c || 0, mov.d || 0, mov.a || 0, ok ? 1 : 0, por || '', q ? JSON.stringify(q).slice(0, 1500) : '');
  }
  async gravar() { await this.ctx.storage.put('e', this.e); }

  /* ======================= A CONFERÊNCIA (o site chama sempre) ======================= */
  sync(quem, corpo) { return this.emFila(() => this._sync(quem, obj(corpo) || {})); }

  async _sync(quem, corpo) {
    const agora = Date.now();
    if (!this.e) this.e = contaNova(quem.email, quem.uid, agora);
    const e = this.e;
    e.email = quem.email;
    if (quem.uid && e.uid !== quem.uid) e.uid = quem.uid;
    if (quem.nome) e.nome = texto(quem.nome, 60);
    const admin = !!quem.admin;

    /* o que outras contas e o servidor mandaram (prêmio de convite, ajuste do dono...) */
    this.aplicarEntradas(agora);

    /* banido? (pelo dono aqui no servidor ou na lista do Firebase) */
    await this.conferirBanFirestore(quem, agora);
    const banido = this.banidoAgora(agora);

    /* primeira vez: o saldo que estava no aparelho entra (até o teto) */
    if (!e.importado) {
      if (!obj(corpo.base)) { await this.gravar(); return this.resposta({ precisaBase: true }); }
      await this.importar(corpo.base, admin, agora);
    }

    /* o índice uid -> e-mail (pras vendas de roupa e pros convites) */
    if (e.uid && (!e.indiceEm || agora - e.indiceEm > 3 * DIAS)) await this.registrarIndice(agora);

    this.contarTempo(obj(corpo.tempo), agora);
    if (!banido) {
      await this.ligarConvite(corpo.ref, quem, agora);
      await this.talvezPagarConvite(agora);
    }
    const visto = inteiro(corpo.visto, 0, 1e12);
    if (visto !== null) e.nov = e.nov.filter(x => x.s > visto);

    /* os movimentos */
    const ok = [], nao = [];
    const lista = Array.isArray(corpo.txs) ? corpo.txs.slice(0, MAX_TX) : [];
    const minuto = 'min:' + Math.floor(agora / 60000);
    for (const bruto of lista) {
      const tx = normalizarTx(bruto);
      if (!tx) { if (bruto && typeof bruto.id === 'string') nao.push({ id: String(bruto.id).slice(0, 64), por: 'formato' }); continue; }
      const ja = this.um('SELECT ok, por FROM livro WHERE id = ?', tx.id);
      if (ja) { (ja.ok ? ok : nao).push(ja.ok ? tx.id : { id: tx.id, por: ja.por }); continue; }
      if (this.uso(minuto) >= MAX_TX_MIN) { nao.push({ id: tx.id, por: 'rapido_demais', depois: true }); continue; }
      this.sql.exec('INSERT INTO uso (k, n, t) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = n + 1', minuto, agora);
      const r = banido ? { ok: false, por: 'banido' } : await this.aplicarTx(tx, quem, admin, agora);
      if (r.ok) ok.push(tx.id); else nao.push(r.depois ? { id: tx.id, por: r.por, depois: true } : { id: tx.id, por: r.por });
    }

    /* as pontuações (ranking) */
    const pontos = [];
    if (!banido && Array.isArray(corpo.pontos)) {
      for (const p of corpo.pontos.slice(0, MAX_PONTOS)) pontos.push(await this.pontuar(obj(p) || {}, quem, agora));
    }

    if (Math.random() < 0.05) this.limpar(agora);
    await this.gravar();
    return this.resposta({ ok, nao, pontos, banido });
  }

  resposta(extra) {
    const e = this.e;
    const amigos = this.um('SELECT COUNT(*) AS n FROM amigos').n;
    return Object.assign({
      saldo: Object.assign({}, e.saldo),
      importado: e.importado,
      nov: e.nov.slice(-20),
      info: {
        envio: e.envio || 0, envioMax: PREMIO_ENVIO_MAX,
        convites: Math.min(COMPARTILHAR_MAX, (Number(this.cfg('convite_base')) || 0) + amigos), convitesMax: COMPARTILHAR_MAX,
        tempoHoje: Math.round(e.tempo.ds || 0), nivelPago: e.nivel.pago,
        convidadoPor: e.convite.por ? true : false, conviteFim: !!e.convite.fim
      },
      hora: Date.now()
    }, extra);
  }

  /* ---------- um movimento ---------- */
  async aplicarTx(tx, quem, admin, agora) {
    const e = this.e;
    const C = {
      e, agora, admin, email: e.email, uid: e.uid, saldo: e.saldo,
      feito: k => this.feito(k), uso: k => this.uso(k), pote: k => this.pote(k)
    };
    const { ok, por, R } = conferir(tx, C);
    const mov = { c: 0, d: 0, a: 0 };
    for (const x of tx.mv) mov[x.k] += x.n;
    if (!ok) {
      this.anotar(tx.id, agora, tx.m, mov, false, por, tx.q);
      this.talvezAlertar(tx, mov, por, agora);
      return { ok: false, por };
    }
    /* avisa as outras contas (presente, venda de roupa...): se não der, o movimento não vale */
    for (const env of R.envios) {
      try {
        const r = env.para && env.para.uid
          ? await this.env.INDICE.get(this.env.INDICE.idFromName('u:' + env.para.uid)).entregar(env.msg)
          : await this.env.CONTA.get(this.env.CONTA.idFromName('e:' + env.para)).receber(env.msg);
        if (!r || !r.ok) { this.anotar(tx.id, agora, tx.m, mov, false, 'envio', tx.q); return { ok: false, por: 'envio' }; }
      } catch (err) {
        return { ok: false, por: 'envio_falhou', depois: true };       // não anota: o aparelho tenta de novo
      }
    }
    /* grava tudo de uma vez */
    for (const op of R.ops) {
      if (op.tipo === 'unico') this.sql.exec('INSERT OR IGNORE INTO feito (k, t) VALUES (?, ?)', op.k, agora);
      else if (op.tipo === 'uso') this.sql.exec('INSERT INTO uso (k, n, t) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET n = n + excluded.n', op.k, op.n, agora);
      else if (op.tipo === 'pote') this.somarPote(op.k, op.n);
    }
    for (const fn of R.efeitos) fn(e);
    for (const k of MOEDAS) e.saldo[k] = Math.max(0, (e.saldo[k] || 0) + mov[k]);
    this.anotar(tx.id, agora, tx.m, mov, true, '', tx.q);
    return { ok: true };
  }

  /* ---------- primeira vez ---------- */
  async importar(base, admin, agora) {
    const e = this.e;
    const num = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
    const pedido = { c: num(base.c, 1e12), d: num(base.d, 1e12), a: num(base.a, 1e12) };
    const saldo = {};
    for (const k of MOEDAS) saldo[k] = admin ? Math.min(pedido[k], 1e12) : Math.min(pedido[k], TETO_IMPORTAR[k]);
    const antes = e.saldo || {};                   // o que já chegou antes da primeira conferência (prêmio de convite...)
    e.saldo = { c: saldo.c + (antes.c || 0), d: saldo.d + (antes.d || 0), a: saldo.a + (antes.a || 0) };
    e.nivel = { pago: Math.max(1, num(base.pg, 2000000000)) };
    /* o "hoje" do aparelho: se a sequência ou a roleta já foram pegas hoje lá, não dá pra pegar de novo aqui */
    const hojeLa = typeof base.hoje === 'string' && chavePlausivel('dia', base.hoje, agora) ? base.hoje : null;
    const sq = obj(base.seq) || {};
    e.seq = { n: num(sq.n, 100000), t: hojeLa && sq.u === hojeLa ? agora : 0 };
    const rl = obj(base.rol) || {};
    e.rol = { t: hojeLa && rl.u === hojeLa ? agora : 0 };
    /* o tempo que a pessoa já tinha jogado hoje antes do servidor existir (só pro prêmio dos 30 minutos) */
    e.tempo.extra = Math.min(1800, num(base.tempoHoje, 1800));
    const bg = obj(base.bau) || {};
    e.bauG = { n: num(bg.n, 1e7), t: Math.min(agora, Math.max(0, num(bg.prox, 9e15) - BAU_GRATIS_MS)) };
    e.envio = Math.min(PREMIO_ENVIO_MAX, num(base.envio, 100));
    this.setCfg('convite_base', Math.min(COMPARTILHAR_MAX, num(base.compartilhou, 100)));
    /* Koda GB Pass: o que já foi pego e o plano. O XP só vale até poucos níveis depois do último prêmio pego. */
    const ps = obj(base.passe);
    if (ps && temporada(String(ps.t || ''))) {
      const lista = (x, max) => Array.isArray(x) ? [...new Set(x.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= max))] : [];
      const P = { nv: [0, 1, 2].includes(Number(ps.nv)) ? Number(ps.nv) : 0, g: lista(ps.g, 100), p: lista(ps.p, 100), x: lista(ps.x, 100), b: lista(ps.b, 20), cred: 0 };
      const maiorPego = Math.max(0, ...P.g, ...P.p, ...P.x);
      const xp = Math.min(num(ps.xp, 1e9), PASSE_ACUM[Math.min(100, maiorPego + 5)]);
      P.nmax = Math.max(maiorPego, passeNivelDe(xp));
      P.bmax = Math.max(0, ...P.b);
      e.passe[String(ps.t)] = P;
    }
    /* repetidos do evento que já estavam guardados (valem abóboras) */
    const rep = num(base.rep, 2000);
    if (rep > 0) this.somarPote('hlrep', rep);
    e.importado = true;
    e.importadoEm = agora;
    const cortou = MOEDAS.filter(k => pedido[k] > saldo[k]);
    this.anotar('imp_' + agora, agora, 'importar', saldo, true, cortou.length ? 'teto' : '', { pedido });
    if (cortou.length) {
      e.importCortado = pedido;
      await this.alertar('importar_teto', { pedido, ficou: saldo }, agora, true);
    }
  }

  /* ---------- tempo jogado (o relógio é o do servidor: ninguém joga mais rápido que o tempo) ---------- */
  contarTempo(t, agora) {
    if (!t) return;
    const s = inteiro(t.s, 0, 900);
    if (!s) return;
    const T = this.e.tempo;
    const passou = T.ult ? (agora - T.ult) / 1000 : s;
    const livre = !!(this.env.CHAVES_TESTE && this.env.TESTE_TEMPO_LIVRE);    // só nos testes do computador
    const vale = livre ? s : Math.max(0, Math.min(s, passou + 15, 900));
    T.ult = agora;
    const dk = diaBRT(agora);
    if (T.dk !== dk) { T.dk = dk; T.ds = 0; T.jogos = {}; }
    T.total = (T.total || 0) + vale;
    T.ds = (T.ds || 0) + vale;
    if (jogoOk(t.j)) {
      if (T.jogos[t.j] === undefined && Object.keys(T.jogos).length >= 40) return;
      T.jogos[t.j] = (T.jogos[t.j] || 0) + vale;
    }
  }

  /* ---------- convite ---------- */
  async ligarConvite(ref, quem, agora) {
    const c = this.e.convite;
    if (!ref || c.por || c.fim) return;
    if (!uidOk(String(ref)) || ref === quem.uid) { c.fim = true; return; }
    if (agora - (this.e.criado || agora) > IDADE_CONVIDADO) { c.fim = true; return; }      // conta já é antiga aqui
    const livre = !!(this.env.CHAVES_TESTE && this.env.TESTE_TEMPO_LIVRE);
    if (!livre && agora - (c.ultTentativa || 0) < 60000) return;      // no máximo uma tentativa por minuto
    c.ultTentativa = agora;
    let quemChamou = null;
    try { quemChamou = await this.env.INDICE.get(this.env.INDICE.idFromName('u:' + ref)).email(); } catch (err) { return; }
    if (!quemChamou) return;                                 // quem chamou ainda não entrou no site novo: tenta depois
    if (quemChamou === this.e.email) { c.fim = true; return; }
    c.tentativas = (c.tentativas || 0) + 1;
    const criada = await this.contaCriadaEm(quem, agora);
    if (criada === null) { if (c.tentativas >= 20) c.fim = true; return; }   // não deu pra saber agora: tenta depois
    if (agora - criada > IDADE_CONVIDADO) { c.fim = true; return; }
    c.por = quemChamou; c.em = agora; c.fim = true;
  }
  async talvezPagarConvite(agora) {
    const c = this.e.convite;
    if (!c.por || c.pago || (this.e.tempo.total || 0) < CONVITE_SEG_ALVO) return;
    try {
      const r = await this.env.CONTA.get(this.env.CONTA.idFromName('e:' + c.por)).receber({ tipo: 'convite', de: this.e.email });
      if (r && r.ok) { c.pago = true; c.pagoEm = agora; }
    } catch (err) { /* tenta na próxima */ }
  }
  /* quando a conta do Firebase foi criada (pra saber se é amigo novo de verdade) */
  async contaCriadaEm(quem, agora) {
    if (this.env.CHAVES_TESTE && quem.criadaTeste) return quem.criadaTeste;
    try {
      const chave = this.env.FIREBASE_API_KEY || 'AIzaSyC3lZRU__V22t3_dq12p3ObxFyYtQasGBc';
      const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(chave), {
        method: 'POST', body: JSON.stringify({ idToken: quem.token }),
        /* a chave do Firebase pode estar presa ao endereço do site: o pedido diz de onde vem */
        headers: { 'content-type': 'application/json', referer: (quem.origem || 'https://koda.gamersite.workers.dev') + '/' }
      });
      if (!r.ok) return null;
      const d = await r.json();
      const u = d && d.users && d.users[0];
      const n = u ? Number(u.createdAt) : NaN;
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch (err) { return null; }
  }

  /* ======================= O QUE OUTRAS CONTAS MANDAM =======================
     (não passa pela fila, pra duas pessoas que se mandam presente ao mesmo tempo não travarem uma à outra;
      só mexe no banco, nunca no estado "e") */
  async receber(msg) {
    msg = obj(msg) || {};
    if (msg.tipo === 'pote') {
      const k = String(msg.k || '');
      const n = inteiro(msg.n, 1, 100000000);
      if (!/^(pr:(c|d|a|dup|bau:[a-z]+|passe:(super|premium))|ugc:(c|d)|vj:(c|d))$/.test(k) || !n) return { ok: false };
      this.somarPote(k, n);
      return { ok: true };
    }
    if (msg.tipo === 'convite') {
      const de = limpaEmail(msg.de);
      if (!emailOk(de)) return { ok: false };
      if (this.um('SELECT email FROM amigos WHERE email = ?', de)) return { ok: true, ja: true };
      const base = Number(this.cfg('convite_base')) || 0;
      const n = this.um('SELECT COUNT(*) AS n FROM amigos').n;
      if (base + n >= COMPARTILHAR_MAX) return { ok: true, cheio: true };
      const agora = Date.now();
      this.sql.exec('INSERT INTO amigos (email, t) VALUES (?, ?)', de, agora);
      this.sql.exec('INSERT INTO entrada (t, m, c, d, a, q) VALUES (?, ?, ?, 0, 0, ?)', agora, 'convite', COMPARTILHAR_PREMIO,
        JSON.stringify({ amigo: de.replace(/^(.).*?(@.*)$/, '$1***$2') }));
      return { ok: true };
    }
    if (msg.tipo === 'pendentes') {          // o que ficou guardado no índice antes desta conta existir
      for (const p of (Array.isArray(msg.lista) ? msg.lista : []).slice(0, 300)) await this.receber(p);
      return { ok: true };
    }
    return { ok: false };
  }

  /* entradas do servidor viram saldo (e uma "novidade" pro aparelho mostrar) */
  aplicarEntradas(agora) {
    const lista = this.sql.exec('SELECT * FROM entrada ORDER BY s LIMIT 100').toArray();
    if (!lista.length) return;
    const e = this.e;
    for (const x of lista) {
      for (const k of MOEDAS) e.saldo[k] = Math.max(0, (e.saldo[k] || 0) + (x[k] || 0));
      e.novS = (e.novS || 0) + 1;
      let q = {}; try { q = JSON.parse(x.q || '{}'); } catch (err) {}
      e.nov.push({ s: e.novS, m: x.m, c: x.c || 0, d: x.d || 0, a: x.a || 0, q });
      this.anotar('ent_' + x.s + '_' + x.t, agora, x.m, { c: x.c, d: x.d, a: x.a }, true, '', q);
      this.sql.exec('DELETE FROM entrada WHERE s = ?', x.s);
    }
    if (e.nov.length > 30) e.nov = e.nov.slice(-30);
  }

  async registrarIndice(agora) {
    try {
      const r = await this.env.INDICE.get(this.env.INDICE.idFromName('u:' + this.e.uid)).registrar(this.e.email);
      if (r && Array.isArray(r.pendentes) && r.pendentes.length) await this.receber({ tipo: 'pendentes', lista: r.pendentes });
      this.e.indiceEm = agora;
    } catch (err) { /* tenta depois */ }
  }

  /* ---------- banimento ---------- */
  banidoAgora(agora) {
    const b = this.e.ban;
    if (b && (!b.ate || b.ate > agora)) return true;
    return !!(this.e.fsBan && this.e.fsBan.ban);
  }
  async conferirBanFirestore(quem, agora) {
    const f = this.e.fsBan || (this.e.fsBan = { t: 0, ban: false });
    if (agora - f.t < 20 * 60000 || !quem.token || this.env.SEM_FIRESTORE) return;
    f.t = agora;
    try {
      const proj = this.env.FIREBASE_PROJETO || 'jogodromo';
      const r = await fetch(`https://firestore.googleapis.com/v1/projects/${proj}/databases/(default)/documents/bannedUsers/${encodeURIComponent(quem.email)}`,
        { headers: { authorization: 'Bearer ' + quem.token } });
      if (r.status === 404) { f.ban = false; return; }
      if (!r.ok) return;
      const d = await r.json();
      f.ban = !!(d && d.fields && d.fields.banned && d.fields.banned.booleanValue === true);
    } catch (err) { /* fica como estava */ }
  }

  /* ---------- ranking ---------- */
  async pontuar(p, quem, agora) {
    const j = jogoOk(p.j) ? p.j : null, v = inteiro(p.v, 0, 1000000000);
    if (!j || v === null) return { j: p.j, ok: false, por: 'formato' };
    const e = this.e;
    if (agora - (e.placarT[j] || 0) < 3000) return { j, ok: false, por: 'rapido' };
    const T = e.tempo;
    if ((T.jogos[j] || 0) < 8 && (T.ds || 0) < 45) return { j, ok: false, por: 'sem_tempo' };
    e.placarT[j] = agora;
    const chaves = Object.keys(e.placarT);
    if (chaves.length > 60) for (const k of chaves.sort((a, b) => e.placarT[a] - e.placarT[b]).slice(0, chaves.length - 60)) delete e.placarT[k];
    try {
      const r = await this.env.PLACAR.get(this.env.PLACAR.idFromName('j:' + j)).enviar({
        jogo: j, email: e.email, nome: texto(p.n || quem.nome || '', 60), foto: (typeof p.f === 'string' && /^https:\/\//.test(p.f) && p.f.length < 400) ? p.f : '',
        v, agora
      });
      if (r && r.suspeito) await this.alertar('placar', { jogo: j, v, topo: r.topo }, agora);
      return Object.assign({ j }, r);
    } catch (err) { return { j, ok: false, por: 'placar_falhou' }; }
  }

  /* ---------- avisos pro dono ---------- */
  talvezAlertar(tx, mov, por, agora) {
    if (['saldo', 'repetido', 'cedo', 'rapido', 'rapido_demais', 'envio_falhou'].includes(por) && !(mov.c > 5000 || mov.d > 20)) return;
    if (!(mov.c >= 300 || mov.d >= 3 || mov.a >= 30 || ['bau_demais', 'bau_sem_origem', 'pagou_pouco', 'xp_demais', 'pulou', 'troca'].includes(por))) return;
    this.alertar('recusado', { m: tx.m, por, c: mov.c, d: mov.d, a: mov.a }, agora).catch(() => {});
  }
  async alertar(tipo, info, agora, sempre) {
    const e = this.e, dk = diaBRT(agora);
    if (e.alertasDia.k !== dk) e.alertasDia = { k: dk, n: 0 };
    if (!sempre && e.alertasDia.n >= 15) return;
    e.alertasDia.n++;
    try { await this.env.VIGIA.get(this.env.VIGIA.idFromName('geral')).alerta({ t: agora, email: e.email, tipo, info }); } catch (err) {}
  }

  limpar(agora) {
    this.sql.exec('DELETE FROM uso WHERE t < ?', agora - 3 * DIAS);
    this.sql.exec('DELETE FROM livro WHERE t < ?', agora - 180 * DIAS);
    this.sql.exec('DELETE FROM feito WHERE t < ? AND (k LIKE ? OR k LIKE ? OR k LIKE ? OR k LIKE ? OR k LIKE ? OR k LIKE ?)', agora - 400 * DIAS, 'ms:%', 'tp:%', 'sq:%', 'rl:%', 'rel:%', 'hlms:%');
  }

  /* ======================= O DONO DO SITE ======================= */
  admin(op, dados) { return this.emFila(() => this._admin(op, obj(dados) || {})); }
  async _admin(op, d) {
    const agora = Date.now();
    if (!this.e) return { ok: true, conta: null };
    const e = this.e;
    if (op === 'ver') {
      this.aplicarEntradas(agora);
      await this.gravar();
      const livro = this.sql.exec('SELECT id, t, m, c, d, a, ok, por FROM livro ORDER BY t DESC LIMIT 80').toArray();
      const recusas = this.sql.exec('SELECT id, t, m, c, d, a, por FROM livro WHERE ok = 0 ORDER BY t DESC LIMIT 40').toArray();
      const potes = this.sql.exec('SELECT k, n FROM pote').toArray();
      return { ok: true, conta: { email: e.email, uid: e.uid, criado: e.criado, saldo: e.saldo, nivel: e.nivel, seq: e.seq,
        envio: e.envio, tempo: { total: Math.round(e.tempo.total), hoje: Math.round(e.tempo.ds) }, convite: e.convite,
        ban: e.ban, fsBan: e.fsBan, importCortado: e.importCortado || null, passe: e.passe }, livro, recusas, potes };
    }
    if (op === 'ajuste') {
      const mov = { c: inteiro(d.c, -1e9, 1e9) || 0, d: inteiro(d.d, -1e7, 1e7) || 0, a: inteiro(d.a, -1e7, 1e7) || 0 };
      if (!mov.c && !mov.d && !mov.a) return { ok: false, por: 'nada' };
      this.sql.exec('INSERT INTO entrada (t, m, c, d, a, q) VALUES (?, ?, ?, ?, ?, ?)', agora, 'ajuste', mov.c, mov.d, mov.a, JSON.stringify({ motivo: texto(d.motivo, 120) }));
      this.aplicarEntradas(agora);
      await this.gravar();
      return { ok: true, saldo: e.saldo };
    }
    if (op === 'ban') {
      const dias = inteiro(d.dias, 0, 36500);
      e.ban = { ate: dias ? agora + dias * DIAS : 0, por: texto(d.motivo, 120), em: agora };
      await this.gravar();
      return { ok: true, ban: e.ban };
    }
    if (op === 'desban') { e.ban = null; if (e.fsBan) e.fsBan.ban = false; await this.gravar(); return { ok: true }; }
    return { ok: false, por: 'op' };
  }
}
