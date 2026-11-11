/* KODA GB — SERVIDOR (o "lado de cá" do site, que roda na Cloudflare junto com ele)
   O site continua sendo o index.html. Só os endereços /api/... chegam aqui:
     GET  /api/saude              o servidor está de pé?
     POST/GET /api/passagem       leva o login e os dados do endereço antigo pro novo (pacote criptografado, 10 min, uma vez)
     POST /api/sync               a conferência da carteira (movimentos, tempo jogado, pontuações, convite)
     GET  /api/placar?jogo=ID     ranking de um jogo
     GET  /api/temporada          ranking da temporada (o mês)
     POST /api/agente/erros       o que o Agente Koda GB errou (sem e-mail, sem dado pessoal; ver aprendiz.js)
     GET  /api/agente/regras      o que o agente aprendeu com todo mundo (aprovado)
     /api/admin/...               só o dono do site (ver conta, ajustar saldo, banir, avisos)
   Tudo (menos /api/saude) precisa do login do Firebase. Ver servidor/LEIA-ME.md. */
import { json, lerJson, ErroKoda, limpaEmail, emailOk, jogoOk, inteiro } from './util.js';
import { quemE, ehAdmin } from './auth.js';
import { lerRanking } from './firestore.js';
import { codigoDaConta } from './aprendiz.js';
export { Conta } from './conta.js';
export { Placar, Temporada } from './placar.js';
export { Indice, Vigia } from './indice.js';

const VERSAO = '2026-11-11.1';
const agente = env => env.VIGIA.get(env.VIGIA.idFromName('agente'));

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
    /* o login do Google (Firebase) passa pelo kodagb.com: repassa /__/auth/* e /__/firebase/* pro endereço do Firebase do projeto */
    if ((url.pathname.startsWith('/__/auth/') || url.pathname.startsWith('/__/firebase/')) && (req.method === 'GET' || req.method === 'POST' || req.method === 'HEAD')) {
      const base = String(env.AUTH_UPSTREAM || 'https://jogodromo.firebaseapp.com').replace(/\/$/, '');
      const r = await fetch(new Request(base + url.pathname + url.search, { method: req.method, headers: req.headers, body: req.method === 'POST' ? req.body : undefined, redirect: 'manual' }));
      return new Response(r.body, { status: r.status, headers: r.headers });
    }
    if (!url.pathname.startsWith('/api/')) {
      if (!env.ASSETS) return new Response('Não achei.', { status: 404 });
      /* o endereço antigo continua com a versão de antes (pasta legado/); as novidades ficam só no kodagb.com */
      const antigo = String(env.ENDERECO_ANTIGO || 'koda.gamersite.workers.dev');
      if (url.hostname === antigo && (url.pathname === '/' || url.pathname === '/index.html')) {
        const r = await env.ASSETS.fetch(new Request(new URL('/legado/' + url.search, url), req));
        const h = new Headers(r.headers); h.set('cache-control', 'no-cache');
        return new Response(r.body, { status: r.status, headers: h });
      }
      return env.ASSETS.fetch(req);
    }
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

/* a passagem da mudança de endereço (sem login: o pacote já vem criptografado e só vale 10 minutos, uma vez) */
const porIpPassagem = new Map();
function limitePassagem(ip) {
  const m = Math.floor(Date.now() / 60000);
  let r = porIpPassagem.get(ip);
  if (!r || r.m !== m) { r = { m, n: 0 }; porIpPassagem.set(ip, r); if (porIpPassagem.size > 5000) porIpPassagem.clear(); }
  return ++r.n <= 20;
}
async function rotaPassagem(req, env, url) {
  if (!limitePassagem(req.headers.get('cf-connecting-ip') || 'local')) throw new ErroKoda(429, 'devagar');
  if (req.method === 'POST') {
    const texto = await req.text();
    if (!texto || texto.length > 4200000) throw new ErroKoda(413, 'grande');
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const id = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    const r = await env.INDICE.get(env.INDICE.idFromName('passagem:' + id)).guardarPassagem(texto);
    if (!r.ok) throw new ErroKoda(413, 'grande');
    return json({ ok: true, id });
  }
  if (req.method === 'GET') {
    const id = String(url.searchParams.get('id') || '');
    if (!/^[0-9a-f]{32}$/.test(id)) throw new ErroKoda(400, 'id');
    const r = await env.INDICE.get(env.INDICE.idFromName('passagem:' + id)).pegarPassagem();
    if (!r.ok) throw new ErroKoda(404, 'sumiu');
    return json({ ok: true, d: r.texto });
  }
  throw new ErroKoda(405, 'metodo');
}

async function rota(req, env, url) {
  const p = url.pathname;
  if (p === '/api/saude') return json({ ok: true, koda: 'servidor', versao: VERSAO, hora: Date.now() });
  if (p === '/api/passagem') return rotaPassagem(req, env, url);
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
  if (p === '/api/agente/erros' && metodo === 'POST') {
    const d = await lerJson(req, 24000);
    const conta = await codigoDaConta(quem.email, env.SAL_AGENTE);
    return json(Object.assign({ ok: true }, await agente(env).agErros(conta, Array.isArray(d.eventos) ? d.eventos.slice(0, 20) : [])));
  }
  if (p === '/api/agente/regras' && metodo === 'GET') return json({ ok: true, regras: await agente(env).agRegras() });
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
  if (p === 'agente' && req.method === 'GET') return json(Object.assign({ ok: true }, await agente(env).agLista(inteiro(url.searchParams.get('n'), 1, 300) || 100)));
  if (req.method !== 'POST') throw new ErroKoda(405, 'metodo');
  const d = await lerJson(req, 8000);
  if (p === 'agente') return json(await agente(env).agAdmin(String(d.acao || ''), d));
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
