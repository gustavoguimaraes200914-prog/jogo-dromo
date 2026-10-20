/* KODA ONLINE: salas de jogo em tempo real (WebSocket + Durable Objects, plano grátis).
   - Cada jogo tem um "Diretorio" que sabe quantas pessoas tem em cada sala.
   - Cada sala é uma "Sala" (máx. 20). Quando uma enche, o Diretorio abre a próxima (Sala 2, 3...).
   - A Sala só repassa as mensagens do jogo a todos (ou a um jogador). Não guarda nada nem lê o conteúdo.
   - PRAÇA: a sala especial "koda-praca" é a praça do Koda. Cada praça tem um número (é o número da sala);
     quem digita o número entra nela. Lá a Sala guarda os 4 bancos: quem senta escolhe o jogo e quantas pessoas;
     em 30 s (ou quando lota) todo mundo do banco vai junto pra mesma sala do jogo (um "grupo"). */

const MAX_SALA = 20;          // limite duro de pessoas numa sala
const PADRAO_SALA = 16;       // tamanho padrão quando o jogo não pede outro
const MIN_SALA = 2;
const MAX_SALAS_POR_JOGO = 200;
const MAX_MSG = 2000;         // bytes por mensagem
const MSG_POR_SEG = 20;       // por jogador (o site já limita a 10; aqui é a rede de segurança)
const RESERVA_MS = 20000;     // vaga reservada que ninguém ocupou volta sozinha

const PRACA = 'koda-praca';   // o "jogo" da praça
const BANCOS = 4;
const BANCO_MIN = 2, BANCO_MAX = 10;
const BANCO_MS = 30000;       // o banco sai pro jogo 30 s depois de criado (ou antes, se lotar)
const EMOJIS = 8;             // quantas figurinhas prontas a praça tem (sem texto livre: é pra crianças)
const FRASES = 12;            // e quantas frases prontas (o site mostra cada uma na língua de quem vê)

const limpa = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
/* o personagem de quem entra: só um texto curto "kp1:..." (o site confere e desenha; aqui só repassa) */
const personagem = s => { s = String(s || ''); return /^kp1:[a-z0-9.]{1,400}$/.test(s) ? s : ''; };
const idJogo = s => { s = String(s || ''); return /^[A-Za-z0-9_-]{1,100}$/.test(s) ? s : null; };
const idGrupo = s => { s = String(s || ''); return /^[a-z0-9]{8,20}$/.test(s) ? s : null; };
const coord = v => Math.max(0, Math.min(1000, Math.round(Number(v) || 0)));
const novoGrupo = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');

/* responde "cheia" pelo próprio WebSocket (o navegador não vê o código de erro de um WebSocket recusado) */
function respostaCheia() {
  const [cliente, servidor] = Object.values(new WebSocketPair());
  servidor.accept();
  servidor.send(JSON.stringify({ t: 'cheia' }));
  servidor.close(1013, 'cheia');
  return new Response(null, { status: 101, webSocket: cliente });
}

function origemOk(req, env) {
  const o = req.headers.get('Origin') || '';
  const lista = String(env.ORIGENS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (lista.includes('*')) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return true;
  return lista.includes(o);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/' || url.pathname === '/saude') {
      return new Response(JSON.stringify({ koda_online: true, tudo_certo: true }), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
    }
    if (url.pathname !== '/jogar') return new Response('Não achei.', { status: 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Precisa ser WebSocket.', { status: 426 });
    if (!origemOk(req, env)) return new Response('Origem não permitida.', { status: 403 });

    const jogo = idJogo(url.searchParams.get('jogo'));
    if (!jogo) return new Response('Jogo inválido.', { status: 400 });
    let cap = Math.max(MIN_SALA, Math.min(MAX_SALA, parseInt(url.searchParams.get('cap'), 10) || PADRAO_SALA));
    if (jogo === PRACA) cap = MAX_SALA;
    const nome = limpa(url.searchParams.get('nome'), 24) || 'Jogador';
    const quer = parseInt(url.searchParams.get('sala'), 10) || 0;   // voltar pra mesma sala depois de cair (ou o número da praça digitado)
    const exata = url.searchParams.get('exata') === '1';             // "quero ESSA sala": se estiver cheia, não manda pra outra
    const av = personagem(url.searchParams.get('av'));
    const extra = '&cap=' + cap + '&nome=' + encodeURIComponent(nome) + (av ? '&av=' + encodeURIComponent(av) : '');

    /* o grupo que veio junto de um banco da praça: todo mundo cai na mesma sala, só deles */
    const grupo = jogo !== PRACA ? idGrupo(url.searchParams.get('grupo')) : null;
    if (grupo) {
      const stub = env.SALA.get(env.SALA.idFromName(jogo + ':g:' + grupo));
      return stub.fetch(new Request('https://sala/entrar?jogo=' + encodeURIComponent(jogo) + '&sala=0' + extra.replace(/&cap=\d+/, '&cap=' + MAX_SALA), req));
    }

    const dir = env.DIRETORIO.get(env.DIRETORIO.idFromName(jogo));
    const r = await dir.fetch('https://dir/reservar?cap=' + cap + '&quer=' + quer + (exata ? '&exata=1' : ''));
    if (!r.ok) return exata ? respostaCheia() : new Response('Sem vaga agora.', { status: 503 });
    const { sala } = await r.json();

    const stub = env.SALA.get(env.SALA.idFromName(jogo + ':' + sala));
    return stub.fetch(new Request('https://sala/entrar?jogo=' + encodeURIComponent(jogo) + '&sala=' + sala + extra, req));
  }
};

/* ---------- Diretorio: uma por jogo ---------- */
export class Diretorio {
  constructor(state) {
    this.state = state;
    this.salas = null;   // { "1": {n: 3, pend: [timestamps]} }
  }
  async carregar() {
    if (!this.salas) this.salas = (await this.state.storage.get('salas')) || {};
  }
  efetivo(s) {
    const agora = Date.now();
    s.pend = (s.pend || []).filter(t => agora - t < RESERVA_MS);
    return (s.n || 0) + s.pend.length;
  }
  async fetch(req) {
    await this.carregar();
    const url = new URL(req.url);
    const cap = Math.max(MIN_SALA, Math.min(MAX_SALA, parseInt(url.searchParams.get('cap'), 10) || PADRAO_SALA));

    if (url.pathname === '/reservar') {
      const quer = parseInt(url.searchParams.get('quer'), 10) || 0;
      let escolhida = 0;
      if (quer > 0 && this.salas[quer] && this.efetivo(this.salas[quer]) < cap) escolhida = quer;
      if (url.searchParams.get('exata') === '1') {
        /* o número exato (a praça digitada): se ainda não existe, abre ela; se está cheia, não manda pra outra */
        if (!(quer >= 1 && quer <= MAX_SALAS_POR_JOGO)) return new Response('numero', { status: 404 });
        if (this.salas[quer] && this.efetivo(this.salas[quer]) >= cap) return new Response('cheio', { status: 503 });
        escolhida = quer;
      }
      if (!escolhida) {
        const nums = Object.keys(this.salas).map(Number).sort((a, b) => a - b);
        for (const k of nums) { if (this.efetivo(this.salas[k]) < cap) { escolhida = k; break; } }
      }
      if (!escolhida) {
        for (let k = 1; k <= MAX_SALAS_POR_JOGO; k++) { if (!this.salas[k]) { escolhida = k; break; } }
      }
      if (!escolhida) return new Response('cheio', { status: 503 });
      const s = this.salas[escolhida] || (this.salas[escolhida] = { n: 0, pend: [] });
      this.efetivo(s);
      s.pend.push(Date.now());
      await this.state.storage.put('salas', this.salas);
      return Response.json({ sala: escolhida });
    }

    if (url.pathname === '/contagem') {   // a Sala avisa quantas pessoas tem de verdade
      const k = parseInt(url.searchParams.get('sala'), 10);
      const n = Math.max(0, parseInt(url.searchParams.get('n'), 10) || 0);
      const entrou = url.searchParams.get('entrou') === '1';
      if (!k) return new Response('ok');
      const s = this.salas[k] || (this.salas[k] = { n: 0, pend: [] });
      s.n = n;
      if (entrou) s.pend.shift();
      this.efetivo(s);
      if (s.n === 0 && !s.pend.length) delete this.salas[k];   // sala vazia some da lista (e o número volta a ficar livre)
      await this.state.storage.put('salas', this.salas);
      return new Response('ok');
    }
    return new Response('?', { status: 404 });
  }
}

/* ---------- Sala: uma por (jogo, número) ---------- */
export class Sala {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.bancos = null;   // só na praça
  }
  jogadores() {
    return this.state.getWebSockets().map(ws => ws.deserializeAttachment()).filter(Boolean).map(a => {
      const j = { id: a.id, nome: a.nome, av: a.av || '' };
      if (a.jogo === PRACA) { j.x = a.x; j.y = a.y; }
      return j;
    });
  }
  avisarDiretorio(jogo, sala, entrou) {
    if (!sala) return Promise.resolve();   // sala de grupo (veio de um banco): não fica na lista do jogo
    const n = this.state.getWebSockets().length;
    const dir = this.env.DIRETORIO.get(this.env.DIRETORIO.idFromName(jogo));
    return dir.fetch('https://dir/contagem?sala=' + sala + '&n=' + n + '&entrou=' + (entrou ? 1 : 0)).catch(() => {});
  }
  transmitir(obj, menos) {
    const txt = JSON.stringify(obj);
    for (const ws of this.state.getWebSockets()) {
      if (menos && ws === menos) continue;
      try { ws.send(txt); } catch (e) {}
    }
  }
  async fetch(req) {
    const url = new URL(req.url);
    const jogo = url.searchParams.get('jogo');
    const sala = parseInt(url.searchParams.get('sala'), 10);
    const cap = Math.max(MIN_SALA, Math.min(MAX_SALA, parseInt(url.searchParams.get('cap'), 10) || PADRAO_SALA));
    const nome = limpa(url.searchParams.get('nome'), 24) || 'Jogador';
    const av = personagem(url.searchParams.get('av'));

    const par = new WebSocketPair();
    const [cliente, servidor] = Object.values(par);
    if (this.state.getWebSockets().length >= Math.min(cap, MAX_SALA)) {
      this.state.acceptWebSocket(servidor);
      servidor.send(JSON.stringify({ t: 'cheia' }));
      servidor.close(1013, 'sala cheia');
      return new Response(null, { status: 101, webSocket: cliente });
    }
    const id = crypto.randomUUID().slice(0, 8);
    this.state.acceptWebSocket(servidor);
    const praca = jogo === PRACA;
    const a = { id, nome, av, jogo, sala, t: Date.now(), c: 0 };
    if (praca) { a.x = 440 + Math.floor(Math.random() * 120); a.y = 900 + Math.floor(Math.random() * 50); }   // chega pelo caminho de baixo
    servidor.serializeAttachment(a);
    const oi = { t: 'oi', eu: id, sala, cap, jogadores: this.jogadores() };
    if (praca) { await this.carregarBancos(); oi.bancos = this.bancos; oi.agora = Date.now(); }
    servidor.send(JSON.stringify(oi));
    this.transmitir(praca ? { t: 'entrou', id, nome, av, x: a.x, y: a.y } : { t: 'entrou', id, nome, av }, servidor);
    await this.avisarDiretorio(jogo, sala, true);
    return new Response(null, { status: 101, webSocket: cliente });
  }
  async webSocketMessage(ws, msg) {
    const a = ws.deserializeAttachment();
    if (!a || typeof msg !== 'string' || msg.length > MAX_MSG) return;
    /* limite por segundo (balde simples guardado junto da conexão) */
    const seg = Math.floor(Date.now() / 1000);
    if (a.s !== seg) { a.s = seg; a.c = 0; }
    if (++a.c > MSG_POR_SEG) { ws.serializeAttachment(a); return; }
    ws.serializeAttachment(a);
    let m; try { m = JSON.parse(msg); } catch (e) { return; }
    if (!m) return;
    if (a.jogo === PRACA) return this.naPraca(ws, a, m);
    if (m.t !== 'msg') return;
    const saida = JSON.stringify({ t: 'msg', de: a.id, d: m.d });
    if (saida.length > MAX_MSG + 40) return;
    if (m.para) {
      for (const outro of this.state.getWebSockets()) {
        const b = outro.deserializeAttachment();
        if (b && b.id === m.para) { try { outro.send(saida); } catch (e) {} }
      }
      return;
    }
    for (const outro of this.state.getWebSockets()) { if (outro !== ws) { try { outro.send(saida); } catch (e) {} } }
  }
  async sair(ws) {
    const a = ws.deserializeAttachment();
    if (!a) return;
    ws.serializeAttachment(null);   // já saiu: não conta de novo
    const restantes = this.state.getWebSockets().filter(w => w !== ws && w.deserializeAttachment());
    const txt = JSON.stringify({ t: 'saiu', id: a.id });
    for (const w of restantes) { try { w.send(txt); } catch (e) {} }
    if (a.jogo === PRACA) {
      await this.carregarBancos();
      if (this.tirarDosBancos(a.id) || !restantes.length) {
        if (!restantes.length) this.bancos = Array(BANCOS).fill(null);
        await this.salvarBancos();
      }
    }
    if (!a.sala) return;
    const dir = this.env.DIRETORIO.get(this.env.DIRETORIO.idFromName(a.jogo));
    await dir.fetch('https://dir/contagem?sala=' + a.sala + '&n=' + restantes.length).catch(() => {});
  }

  /* ---------- a praça: posições, figurinhas e os bancos ---------- */
  async carregarBancos() {
    if (!this.bancos) {
      const b = await this.state.storage.get('bancos');
      this.bancos = Array.isArray(b) && b.length === BANCOS ? b : Array(BANCOS).fill(null);
    }
    /* quem não está mais conectado sai dos bancos (a praça pode ter dormido e acordado) */
    const vivos = new Set(this.jogadores().map(j => j.id));
    this.bancos = this.bancos.map(b => {
      if (!b) return null;
      b.membros = (b.membros || []).filter(id => vivos.has(id));
      if (!b.membros.length) return null;
      if (!b.membros.includes(b.dono)) b.dono = b.membros[0];
      return b;
    });
  }
  async salvarBancos() {
    await this.state.storage.put('bancos', this.bancos);
    const prox = this.bancos.filter(Boolean).map(b => b.ate);
    if (prox.length) await this.state.storage.setAlarm(Math.min(...prox));
    else await this.state.storage.deleteAlarm();
    this.transmitir({ t: 'bancos', bancos: this.bancos, agora: Date.now() });
  }
  tirarDosBancos(id) {
    let mudou = false;
    this.bancos = this.bancos.map(b => {
      if (!b || !b.membros.includes(id)) return b;
      mudou = true;
      b.membros = b.membros.filter(x => x !== id);
      if (!b.membros.length) return null;
      if (b.dono === id) b.dono = b.membros[0];   // o dono levantou: o próximo da fila vira o dono
      return b;
    });
    return mudou;
  }
  partir(i) {
    const b = this.bancos[i];
    if (!b) return;
    this.bancos[i] = null;
    this.transmitir({ t: 'partiu', b: i, jogo: b.jogo, grupo: novoGrupo(), membros: b.membros });
  }
  async naPraca(ws, a, m) {
    if (m.t === 'pos') {
      a.x = coord(m.x); a.y = coord(m.y);
      ws.serializeAttachment(a);
      this.transmitir({ t: 'pos', id: a.id, x: a.x, y: a.y }, ws);
      return;
    }
    if (m.t === 'emo') {
      const e = Math.floor(Number(m.e));
      if (!(e >= 0 && e < EMOJIS)) return;
      this.transmitir({ t: 'emo', id: a.id, e });
      return;
    }
    if (m.t === 'frase') {
      const f = Math.floor(Number(m.f));
      if (!(f >= 0 && f < FRASES)) return;
      this.transmitir({ t: 'frase', id: a.id, f });
      return;
    }
    if (m.t === 'sentar') {
      const i = Math.floor(Number(m.b));
      if (!(i >= 0 && i < BANCOS)) return;
      await this.carregarBancos();
      const b = this.bancos[i];
      if (b && b.membros.includes(a.id)) return;
      if (b && b.membros.length >= b.cap) { try { ws.send(JSON.stringify({ t: 'lotado', b: i })); } catch (e) {} return; }
      let novo = null;
      if (!b) {
        const j = m.jogo || {};
        const id = idJogo(j.id);
        if (!id || id === PRACA) return;
        const cap = Math.max(BANCO_MIN, Math.min(BANCO_MAX, Math.floor(Number(m.cap)) || 4));
        novo = { dono: a.id, jogo: { id, nome: limpa(j.nome, 40) || id }, cap, ate: Date.now() + BANCO_MS, membros: [] };
      }
      this.tirarDosBancos(a.id);   // só dá pra estar num banco por vez
      if (novo) this.bancos[i] = novo;
      if (!this.bancos[i]) return;
      this.bancos[i].membros.push(a.id);
      if (this.bancos[i].membros.length >= this.bancos[i].cap) this.partir(i);   // lotou: vai todo mundo agora
      await this.salvarBancos();
      return;
    }
    if (m.t === 'levantar') {
      await this.carregarBancos();
      if (this.tirarDosBancos(a.id)) await this.salvarBancos();
    }
  }
  async alarm() {
    if (!this.state.getWebSockets().length) { this.bancos = Array(BANCOS).fill(null); await this.state.storage.put('bancos', this.bancos); return; }
    await this.carregarBancos();
    const agora = Date.now();
    this.bancos.forEach((b, i) => { if (b && b.ate <= agora + 250) this.partir(i); });
    await this.salvarBancos();
  }
  async webSocketClose(ws) { await this.sair(ws); }
  async webSocketError(ws) { await this.sair(ws); }
}
