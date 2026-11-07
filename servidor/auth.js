/* KODA GB — SERVIDOR: quem está pedindo?
   O site manda o "crachá" do Firebase (ID token) em  Authorization: Bearer <token>.
   Aqui ele é conferido de verdade: assinatura do Google (RS256), projeto, emissor, validade e e-mail.
   Ninguém consegue inventar um crachá sem a chave secreta do Google. */
import { ErroKoda, limpaEmail, emailOk } from './util.js';

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let cacheChaves = { ate: 0, mapa: null };

function b64url(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const lerJsonB64 = s => JSON.parse(new TextDecoder().decode(b64url(s)));

/* chaves de teste: SÓ no computador (localhost), nunca no site de verdade */
function chavesDeTeste(env, url) {
  if (!env.CHAVES_TESTE) return null;
  if (!/^(localhost|127\.0\.0\.1)$/.test(url.hostname)) return null;
  try { return JSON.parse(env.CHAVES_TESTE).keys || null; } catch (e) { return null; }
}

async function chavesDoGoogle() {
  if (cacheChaves.mapa && Date.now() < cacheChaves.ate) return cacheChaves.mapa;
  const r = await fetch(JWKS_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!r.ok) throw new ErroKoda(503, 'chaves');
  const dados = await r.json();
  const m = /max-age=(\d+)/.exec(r.headers.get('cache-control') || '');
  cacheChaves = { mapa: dados.keys || [], ate: Date.now() + Math.min(6 * 3600, m ? Number(m[1]) : 3600) * 1000 };
  return cacheChaves.mapa;
}

const chavesImportadas = new Map();
async function chaveCrypto(jwk) {
  const k = jwk.kid + ':' + jwk.n.slice(0, 24);
  if (chavesImportadas.has(k)) return chavesImportadas.get(k);
  const c = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  chavesImportadas.set(k, c);
  return c;
}

/* devolve {uid, email, emailVerificado, nome, foto, provedor} ou lança ErroKoda(401) */
export async function quemE(req, env, url) {
  const h = req.headers.get('authorization') || '';
  const m = /^Bearer\s+([A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)$/.exec(h);
  if (!m) throw new ErroKoda(401, 'sem_login');
  const [h64, p64, s64] = m[1].split('.');
  let cab, dados;
  try { cab = lerJsonB64(h64); dados = lerJsonB64(p64); } catch (e) { throw new ErroKoda(401, 'token'); }
  if (cab.alg !== 'RS256' || typeof cab.kid !== 'string') throw new ErroKoda(401, 'token');
  const projeto = env.FIREBASE_PROJETO || 'jogodromo';
  const agora = Math.floor(Date.now() / 1000);
  if (dados.aud !== projeto || dados.iss !== 'https://securetoken.google.com/' + projeto) throw new ErroKoda(401, 'token');
  if (!(dados.exp > agora - 30) || !(dados.iat <= agora + 300) || !(dados.auth_time <= agora + 300)) throw new ErroKoda(401, 'vencido');
  if (typeof dados.sub !== 'string' || !dados.sub || dados.sub.length > 128) throw new ErroKoda(401, 'token');
  const deTeste = chavesDeTeste(env, url);
  const lista = deTeste || await chavesDoGoogle();
  const jwk = lista.find(k => k.kid === cab.kid);
  if (!jwk) throw new ErroKoda(401, 'token');
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', await chaveCrypto(jwk), b64url(s64),
    new TextEncoder().encode(h64 + '.' + p64));
  if (!ok) throw new ErroKoda(401, 'token');
  const email = limpaEmail(dados.email);
  if (!emailOk(email)) throw new ErroKoda(403, 'sem_email');
  const fb = dados.firebase || {};
  return {
    uid: dados.sub, email, emailVerificado: dados.email_verified === true,
    nome: typeof dados.name === 'string' ? dados.name.slice(0, 60) : '',
    foto: typeof dados.picture === 'string' && /^https:\/\//.test(dados.picture) && dados.picture.length < 400 ? dados.picture : '',
    provedor: typeof fb.sign_in_provider === 'string' ? fb.sign_in_provider : '',
    token: m[1],
    criadaTeste: deTeste && Number(dados.criada_teste) > 0 ? Number(dados.criada_teste) : 0
  };
}

export function ehAdmin(quem, env) {
  const adm = limpaEmail(env.ADMIN_EMAIL || 'gustavoguimaraes200914@gmail.com');
  return !!quem && quem.email === adm && (quem.emailVerificado || quem.provedor === 'google.com');
}
