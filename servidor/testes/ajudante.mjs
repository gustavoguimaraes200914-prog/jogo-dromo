/* testes do servidor: cria crachás de teste (assinados com uma chave só nossa, que o servidor só aceita em localhost)
   e conversa com o servidor rodando no computador (npx wrangler dev). */
import { generateKeyPairSync, createSign, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ARQ = process.env.KODA_CHAVE_TESTE || '/tmp/koda-chave-teste.json';
export function chaveDeTeste() {
  if (existsSync(ARQ)) return JSON.parse(readFileSync(ARQ, 'utf8'));
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' });
  const c = { kid: 'teste1', priv: privateKey.export({ type: 'pkcs8', format: 'pem' }), jwks: { keys: [{ ...jwk, kid: 'teste1', alg: 'RS256', use: 'sig' }] } };
  writeFileSync(ARQ, JSON.stringify(c));
  return c;
}
const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
export function token({ email, uid, nome, criada, projeto = 'jogodromo', exp, kid, iss, aud }) {
  const c = chaveDeTeste(), agora = Math.floor(Date.now() / 1000);
  const cab = { alg: 'RS256', kid: kid || c.kid, typ: 'JWT' };
  const dados = { iss: iss || 'https://securetoken.google.com/' + projeto, aud: aud || projeto, auth_time: agora - 10, user_id: uid, sub: uid,
    iat: agora - 5, exp: exp || agora + 3600, email, email_verified: true, name: nome || email.split('@')[0],
    firebase: { sign_in_provider: 'google.com' }, criada_teste: criada || Date.now() - 3600e3 };
  const corpo = b64(cab) + '.' + b64(dados);
  const s = createSign('RSA-SHA256'); s.update(corpo);
  return corpo + '.' + s.sign(c.priv).toString('base64url');
}
export const BASE = process.env.KODA_URL || 'http://127.0.0.1:8787';
export async function api(caminho, { tk, corpo, metodo, cab } = {}) {
  const r = await fetch(BASE + caminho, {
    method: metodo || (corpo ? 'POST' : 'GET'),
    headers: Object.assign({ 'content-type': 'application/json' }, tk ? { authorization: 'Bearer ' + tk } : {}, cab || {}),
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, j };
}
export const novoId = () => randomBytes(9).toString('base64url').replace(/[^A-Za-z0-9]/g, 'x');
let falhas = 0, total = 0;
export function confere(nome, cond, extra) {
  total++;
  if (cond) console.log('  ok   ' + nome);
  else { falhas++; console.log('  FALHOU ' + nome + (extra !== undefined ? '  -> ' + JSON.stringify(extra).slice(0, 400) : '')); }
}
export function fim() { console.log(`\n${total - falhas}/${total} ok`); if (falhas) process.exitCode = 1; }
/* uma pessoa de teste: e-mail único a cada rodada */
export function pessoa(nome, extra = {}) {
  const sufixo = randomBytes(4).toString('hex');
  const email = `${nome}.${sufixo}@teste.koda`, uid = (nome + sufixo + 'u12345678').replace(/[^A-Za-z0-9]/g, '').slice(0, 28);
  return { email, uid, tk: token({ email, uid, nome, ...extra }) };
}
export const tx = (m, q, mv) => ({ id: novoId(), m, q: q || {}, mv: mv || [] });
/* node servidor/testes/ajudante.mjs chaves  -> imprime as chaves públicas de teste (pro --var CHAVES_TESTE) */
if (process.argv[1] && process.argv[1].endsWith('ajudante.mjs') && process.argv[2] === 'chaves') process.stdout.write(JSON.stringify(chaveDeTeste().jwks));
