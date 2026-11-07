/* KODA GB — SERVIDOR: O RANKING
   Placar: um por jogo. Guarda o melhor de cada pessoa (de sempre e do mês). Só a CONTA da pessoa manda pontuação
   pra cá (depois de conferir que ela estava jogando aquele jogo de verdade, pelo relógio do servidor).
   Temporada: um só. Soma o melhor do mês de cada pessoa em todos os jogos (e lembra o campeão do mês passado).
   Na primeira vez, cada um copia o ranking que já existia no Firebase, pra ninguém perder a posição. */
import { DurableObject } from 'cloudflare:workers';
import { mesBRT, texto, limpaEmail, emailOk, obj } from './util.js';

const limpaFoto = f => (typeof f === 'string' && /^https:\/\//.test(f) && f.length < 400) ? f : '';
const mesAntes = mk => { const [a, m] = mk.split('-').map(Number); return m === 1 ? (a - 1) + '-12' : a + '-' + String(m - 1).padStart(2, '0'); };
const PONTOS_MAX = 1000000000;

export class Placar extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS pts (email TEXT PRIMARY KEY, nome TEXT, foto TEXT, best INTEGER, bestAt INTEGER,
      mk TEXT, mb INTEGER, pmk TEXT, pmb INTEGER)`);
    this.sql.exec('CREATE TABLE IF NOT EXISTS cfg (k TEXT PRIMARY KEY, v TEXT)');
  }
  um(q, ...a) { return this.sql.exec(q, ...a).toArray()[0] || null; }
  importado() { return !!this.um("SELECT v FROM cfg WHERE k = 'importado'"); }

  async enviar(o) {
    o = obj(o) || {};
    const email = limpaEmail(o.email), v = Math.floor(Number(o.v));
    if (!emailOk(email) || !(v >= 0 && v <= PONTOS_MAX)) return { ok: false, por: 'formato' };
    const agora = Number(o.agora) || Date.now(), mk = mesBRT(agora);
    const topo = (this.um('SELECT MAX(best) AS b FROM pts') || {}).b || 0;
    const atual = this.um('SELECT * FROM pts WHERE email = ?', email);
    /* pontuação absurda (muito acima do 1º lugar ou do próprio recorde) não entra: vai pro dono olhar */
    if (v > 1000 && topo >= 50 && v > topo * 20) return { ok: false, por: 'suspeito', suspeito: true, topo };
    if (topo < 50 && v > 5000000) return { ok: false, por: 'suspeito', suspeito: true, topo };
    if (atual && atual.best >= 100 && v > atual.best * 100) return { ok: false, por: 'suspeito', suspeito: true, topo };
    const mesmoMes = atual && atual.mk === mk;
    const melhorou = !atual || v > (atual.best || 0) || !mesmoMes || v > (atual.mb || 0);
    const nome = texto(o.nome, 60) || (atual && atual.nome) || email.split('@')[0];
    const foto = limpaFoto(o.foto) || (atual && atual.foto) || '';
    if (!melhorou) {
      if (atual && (atual.nome !== nome || atual.foto !== foto)) this.sql.exec('UPDATE pts SET nome = ?, foto = ? WHERE email = ?', nome, foto, email);
      return { ok: true, melhorou: false, best: atual.best };
    }
    const best = Math.max(v, (atual && atual.best) || 0);
    const bestAt = (atual && (atual.best || 0) >= v) ? (atual.bestAt || agora) : agora;
    const mb = mesmoMes ? Math.max(v, atual.mb || 0) : v;
    const pmk = mesmoMes ? (atual.pmk || '') : ((atual && atual.mk) || '');
    const pmb = mesmoMes ? (atual.pmb || 0) : ((atual && atual.mb) || 0);
    this.sql.exec(`INSERT INTO pts (email, nome, foto, best, bestAt, mk, mb, pmk, pmb) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET nome = excluded.nome, foto = excluded.foto, best = excluded.best, bestAt = excluded.bestAt,
      mk = excluded.mk, mb = excluded.mb, pmk = excluded.pmk, pmb = excluded.pmb`, email, nome, foto, best, bestAt, mk, mb, pmk, pmb);
    if (!mesmoMes || mb > ((atual && atual.mb) || 0)) {
      try { await this.env.TEMPORADA.get(this.env.TEMPORADA.idFromName('geral')).atualizar({ email, jogo: String(o.jogo || ''), mk, mb, nome, foto }); } catch (e) {}
    }
    return { ok: true, melhorou: true, best, mb };
  }

  top(n) {
    n = Math.min(200, Math.max(1, Number(n) || 100));
    const rows = this.sql.exec('SELECT * FROM pts WHERE best > 0 ORDER BY best DESC, bestAt ASC LIMIT ?', n).toArray();
    return {
      importado: this.importado(),
      lista: rows.map(r => ({ userEmail: r.email, name: r.nome, avatar: r.foto || null, best: r.best, bestAt: r.bestAt,
        monthKey: r.mk, monthBest: r.mb, prevMonthKey: r.pmk || null, prevMonthBest: r.pmb || 0 }))
    };
  }
  /* copia o ranking antigo do Firebase (uma vez) */
  importar(lista) {
    if (this.importado()) return { ok: true, ja: true };
    let n = 0;
    for (const x of (Array.isArray(lista) ? lista : []).slice(0, 3000)) {
      const email = limpaEmail(x.userEmail), best = Math.floor(Number(x.best));
      if (!emailOk(email) || !(best > 0 && best <= PONTOS_MAX)) continue;
      if (this.um('SELECT email FROM pts WHERE email = ?', email)) continue;
      const mb = Math.floor(Number(x.monthBest)) || 0, pmb = Math.floor(Number(x.prevMonthBest)) || 0;
      this.sql.exec('INSERT INTO pts (email, nome, foto, best, bestAt, mk, mb, pmk, pmb) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        email, texto(x.name, 60) || email.split('@')[0], limpaFoto(x.avatar), best, Math.floor(Number(x.bestAt)) || 0,
        /^\d{4}-\d{2}$/.test(String(x.monthKey || '')) ? x.monthKey : '', Math.min(mb, PONTOS_MAX),
        /^\d{4}-\d{2}$/.test(String(x.prevMonthKey || '')) ? x.prevMonthKey : '', Math.min(pmb, PONTOS_MAX));
      n++;
    }
    this.sql.exec("INSERT OR REPLACE INTO cfg (k, v) VALUES ('importado', ?)", String(Date.now()));
    return { ok: true, n };
  }
  remover(email) {
    email = limpaEmail(email);
    this.sql.exec('DELETE FROM pts WHERE email = ?', email);
    return { ok: true };
  }
}

export class Temporada extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS tp (email TEXT, jogo TEXT, mk TEXT, mb INTEGER, nome TEXT, foto TEXT, PRIMARY KEY (email, jogo, mk))`);
    this.sql.exec('CREATE TABLE IF NOT EXISTS cfg (k TEXT PRIMARY KEY, v TEXT)');
  }
  importado() { return !!this.sql.exec("SELECT v FROM cfg WHERE k = 'importado'").toArray()[0]; }
  atualizar(o) {
    o = obj(o) || {};
    const email = limpaEmail(o.email), mb = Math.floor(Number(o.mb));
    if (!emailOk(email) || !/^\d{4}-\d{2}$/.test(String(o.mk || '')) || !(mb >= 0 && mb <= PONTOS_MAX)) return { ok: false };
    this.sql.exec(`INSERT INTO tp (email, jogo, mk, mb, nome, foto) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(email, jogo, mk) DO UPDATE SET mb = MAX(mb, excluded.mb), nome = excluded.nome, foto = excluded.foto`,
      email, String(o.jogo || '').slice(0, 150), o.mk, mb, texto(o.nome, 60), limpaFoto(o.foto));
    if (Math.random() < 0.02) this.sql.exec('DELETE FROM tp WHERE mk < ?', mesAntes(mesAntes(mesAntes(mesBRT()))));
    return { ok: true };
  }
  lista() {
    const mes = mesBRT(), ant = mesAntes(mes);
    const soma = mk => this.sql.exec(`SELECT email, SUM(mb) AS pontos, COUNT(*) AS jogos, MAX(nome) AS nome, MAX(foto) AS foto
      FROM tp WHERE mk = ? AND mb > 0 GROUP BY email ORDER BY pontos DESC LIMIT 200`, mk).toArray()
      .map(r => ({ email: r.email, name: r.nome || r.email.split('@')[0], avatar: r.foto || null, pontos: r.pontos, jogos: r.jogos }));
    const lista = soma(mes), anterior = soma(ant);
    return { importado: this.importado(), mes, lista, campeaoAnterior: anterior[0] ? Object.assign({ mes: ant }, anterior[0]) : null, mesAnterior: anterior.length ? ant : null };
  }
  importar(lista) {
    if (this.importado()) return { ok: true, ja: true };
    for (const x of (Array.isArray(lista) ? lista : []).slice(0, 5000)) {
      const email = limpaEmail(x.userEmail);
      if (!emailOk(email)) continue;
      const jogo = String(x.gameId || '').slice(0, 150);
      for (const [mk, mb] of [[x.monthKey, x.monthBest], [x.prevMonthKey, x.prevMonthBest]]) {
        const n = Math.floor(Number(mb));
        if (/^\d{4}-\d{2}$/.test(String(mk || '')) && n > 0 && n <= PONTOS_MAX)
          this.sql.exec('INSERT OR IGNORE INTO tp (email, jogo, mk, mb, nome, foto) VALUES (?, ?, ?, ?, ?, ?)', email, jogo, mk, n, texto(x.name, 60), limpaFoto(x.avatar));
      }
    }
    this.sql.exec("INSERT OR REPLACE INTO cfg (k, v) VALUES ('importado', ?)", String(Date.now()));
    return { ok: true };
  }
  remover(email) { this.sql.exec('DELETE FROM tp WHERE email = ?', limpaEmail(email)); return { ok: true }; }
}
