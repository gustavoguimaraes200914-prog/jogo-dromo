/* KODA GB — SERVIDOR (o "lado de cá" do site, que roda na Cloudflare junto com ele)
   O site continua sendo o index.html. Só os endereços /api/... chegam aqui:
     GET  /api/saude              o servidor está de pé?
     POST /api/sync               a conferência da carteira (movimentos, tempo jogado, pontuações, convite)
     GET  /api/placar?jogo=ID     ranking de um jogo
     GET  /api/temporada          ranking da temporada (o mês)
     /api/admin/...               só o dono do site (ver conta, ajustar saldo, banir, avisos)
   Tudo (menos /api/saude) precisa do login do Firebase. Ver servidor/LEIA-ME.md. */
import { json, lerJson, ErroKoda, limpaEmail, emailOk, jogoOk, inteiro } from './util.js';
import { quemE, ehAdmin } from './auth.js';
import { lerRanking } from './firestore.js';
export { Conta } from './conta.js';
export { Placar, Temporada } from './placar.js';
export { Indice, Vigia } from './indice.js';

const VERSAO = '2026-11-07.1';

/* limite simples por IP (por máquina da Cloudflare): pedidos por minuto */
const porIp = new Map();
function dentroDoLimite(ip, max) {
  const m = Math.floor(Date.now() / 60000);
  let r = porIp.get(ip);
  if (!r || r.m !== m) { r = { m, n: 0 }; porIp.set(ip, r); if (porIp.size > 20000) porIp.clear(); }
  r.n++;
  return r.n <= max;
}
const local = h => /^(localhost|127\.0\.0\.1)$/.test(h);
function origemOk(req, url, env) {
  const o = req.headers.get('origin');
  if (!o || o === url.origin) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o) && local(url.hostname)) return true;
  return String(env.ORIGENS || '').split(',').map(s => s.trim()).filter(Boolean).includes(o);
}
function cabecalhosCors(req, url, env) {
  const o = req.headers.get('origin');
  if (!o || o === url.origin || !origemOk(req, url, env)) return {};
  return { 'access-control-allow-origin': o, 'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS', vary: 'origin' };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(req) : new Response('Não achei.', { status: 404 });
    const cors = cabecalhosCors(req, url, env);
    try {
      if (!origemOk(req, url, env)) throw new ErroKoda(403, 'origem');
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'access-control-max-age': '600' } });
      if (!dentroDoLimite(req.headers.get('cf-connecting-ip') || 'local', 400)) throw new ErroKoda(429, 'devagar');
      const r = await rota(req, env, url);
      for (const [k, v] of Object.entries(cors)) r.headers.set(k, v);
      return r;
    } catch (e) {
      const conhecido = e instanceof ErroKoda;
      if (!conhecido) console.log('erro do servidor', e && e.stack || String(e));
      return json({ ok: false, erro: conhecido ? e.codigo : 'servidor' }, conhecido ? e.status : 500, cors);
    }
  }
};

async function rota(req, env, url) {
  const p = url.pathname;
  if (p === '/api/saude') return json({ ok: true, koda: 'servidor', versao: VERSAO, hora: Date.now() });
  const quem = await quemE(req, env, url);
  quem.admin = ehAdmin(quem, env);
  const metodo = req.method;

  if (p === '/api/sync' && metodo === 'POST') {
    const corpo = await lerJson(req, 250000);
    const conta = env.CONTA.get(env.CONTA.idFromName('e:' + quem.email));
    const dados = { email: quem.email, uid: quem.uid, nome: quem.nome, admin: quem.admin, token: quem.token, origem: url.origin };
    if (quem.criadaTeste) dados.criadaTeste = quem.criadaTeste;
    return json(Object.assign({ ok: true }, await conta.sync(dados, corpo)));
  }
  if (p === '/api/placar' && metodo === 'GET') {
    const jogo = url.searchParams.get('jogo');
    if (!jogoOk(jogo)) throw new ErroKoda(400, 'jogo');
    const st = env.PLACAR.get(env.PLACAR.idFromName('j:' + jogo));
    let r = await st.top(100);
    if (!r.importado) {
      const velhos = await lerRanking(env, quem.token, jogo);
      if (velhos) { await st.importar(velhos); r = await st.top(100); }
    }
    return json({ ok: true, lista: r.lista });
  }
  if (p === '/api/temporada' && metodo === 'GET') {
    const st = env.TEMPORADA.get(env.TEMPORADA.idFromName('geral'));
    let r = await st.lista();
    if (!r.importado) {
      const velhos = await lerRanking(env, quem.token, null);
      if (velhos) { await st.importar(velhos); r = await st.lista(); }
    }
    return json(Object.assign({ ok: true }, r));
  }
  if (p.startsWith('/api/admin/')) return rotaAdmin(req, env, url, quem);
  throw new ErroKoda(404, 'rota');
}

/* ---------- o painel do dono ---------- */
async function rotaAdmin(req, env, url, quem) {
  if (!quem.admin) throw new ErroKoda(403, 'so_dono');
  const p = url.pathname.slice('/api/admin/'.length);
  const conta = email => env.CONTA.get(env.CONTA.idFromName('e:' + email));
  const pegarEmail = v => { const e = limpaEmail(v); if (!emailOk(e)) throw new ErroKoda(400, 'email'); return e; };
  if (p === 'alertas' && req.method === 'GET')
    return json({ ok: true, alertas: await env.VIGIA.get(env.VIGIA.idFromName('geral')).lista(inteiro(url.searchParams.get('n'), 1, 500) || 150) });
  if (p === 'conta' && req.method === 'GET') return json(await conta(pegarEmail(url.searchParams.get('email'))).admin('ver', {}));
  if (req.method !== 'POST') throw new ErroKoda(405, 'metodo');
  const d = await lerJson(req, 8000);
  if (p === 'ajuste') return json(await conta(pegarEmail(d.email)).admin('ajuste', d));
  if (p === 'ban') return json(await conta(pegarEmail(d.email)).admin('ban', d));
  if (p === 'desban') return json(await conta(pegarEmail(d.email)).admin('desban', d));
  if (p === 'placar/remover') {
    if (!jogoOk(d.jogo)) throw new ErroKoda(400, 'jogo');
    const email = pegarEmail(d.email);
    await env.PLACAR.get(env.PLACAR.idFromName('j:' + d.jogo)).remover(email);
    if (d.temporada) await env.TEMPORADA.get(env.TEMPORADA.idFromName('geral')).remover(email);
    return json({ ok: true });
  }
  throw new ErroKoda(404, 'rota');
}
