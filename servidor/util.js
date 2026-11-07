/* KODA GB — SERVIDOR: ajudantes pequenos usados por todas as partes */

export const ADMIN_EMAIL_PADRAO = 'gustavoguimaraes200914@gmail.com';

/* resposta JSON que nunca fica guardada em cache */
export function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'cross-origin-resource-policy': 'same-origin',
      ...extra
    }
  });
}

export const limpaEmail = s => String(s == null ? '' : s).trim().toLowerCase().slice(0, 200);
export const emailOk = s => /^[^\s@<>"']{1,100}@[^\s@<>"']{1,100}\.[^\s@<>"']{1,40}$/.test(String(s || ''));
/* texto curto e sem controle (nome de pessoa, de jogo...) */
export const texto = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);
export const idOk = s => typeof s === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(s);
export const jogoOk = s => typeof s === 'string' && /^[A-Za-z0-9_.:-]{1,150}$/.test(s);
export const uidOk = s => typeof s === 'string' && /^[A-Za-z0-9]{6,128}$/.test(s);
export function inteiro(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < min || n > max) return null;
  return n;
}
export const obj = v => (v && typeof v === 'object' && !Array.isArray(v)) ? v : null;

/* ---------- datas ----------
   As janelas do servidor (tetos do dia) usam o horário de Brasília (UTC-3, sem horário de verão).
   As chaves que o SITE manda (missão do dia, da semana, do mês) usam o horário do APARELHO, então o servidor
   aceita qualquer uma que exista em algum fuso do mundo agora (de UTC-12 a UTC+14). */
const BRT = -3 * 3600000;
const p2 = n => String(n).padStart(2, '0');
function chaveUTC(periodo, ts) {
  const d = new Date(ts);
  if (periodo === 'dia') return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate());
  if (periodo === 'semana') {
    const wd = (d.getUTCDay() + 6) % 7;                       // a semana começa na segunda
    const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - wd));
    return 'w' + s.getUTCFullYear() + '-' + p2(s.getUTCMonth() + 1) + '-' + p2(s.getUTCDate());
  }
  return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1);
}
export const diaBRT = (ts = Date.now()) => chaveUTC('dia', ts + BRT);
export const semanaBRT = (ts = Date.now()) => chaveUTC('semana', ts + BRT);
export const mesBRT = (ts = Date.now()) => chaveUTC('mes', ts + BRT);
/* as chaves que algum aparelho do mundo pode estar mostrando agora */
export function chavesAgora(periodo, ts = Date.now()) {
  const out = new Set();
  for (let h = -12; h <= 14; h++) out.add(chaveUTC(periodo, ts + h * 3600000));
  return out;
}
export const chavePlausivel = (periodo, k, ts) => typeof k === 'string' && k.length <= 12 && chavesAgora(periodo, ts).has(k);

/* número aleatório de verdade em texto (ids) */
export function idNovo(n = 16) {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), b => abc[b % 36]).join('');
}

/* lê o corpo JSON com limite de tamanho (o resto é recusado) */
export async function lerJson(req, max = 65536) {
  const tam = Number(req.headers.get('content-length') || 0);
  if (tam > max) throw new ErroKoda(413, 'grande');
  const txt = await req.text();
  if (txt.length > max) throw new ErroKoda(413, 'grande');
  if (!txt) return {};
  try { return JSON.parse(txt); } catch (e) { throw new ErroKoda(400, 'json'); }
}

export class ErroKoda extends Error {
  constructor(status, codigo) { super(codigo); this.status = status; this.codigo = codigo; }
}
