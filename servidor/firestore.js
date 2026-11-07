/* KODA GB — SERVIDOR: ler o ranking antigo do Firebase (uma vez por jogo), com o crachá de quem está pedindo */
function valor(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return !!v.booleanValue;
  if ('nullValue' in v) return null;
  return null;
}
/* jogo = id do jogo, ou null pra todos (temporada). Devolve a lista, ou null se não deu pra ler agora */
export async function lerRanking(env, token, jogo) {
  if (env.SEM_FIRESTORE) return [];
  const proj = env.FIREBASE_PROJETO || 'jogodromo';
  const consulta = { from: [{ collectionId: 'gameScores' }], limit: jogo ? 2000 : 5000 };
  if (jogo) consulta.where = { fieldFilter: { field: { fieldPath: 'gameId' }, op: 'EQUAL', value: { stringValue: jogo } } };
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${proj}/databases/(default)/documents:runQuery`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
      body: JSON.stringify({ structuredQuery: consulta })
    });
    if (!r.ok) return null;
    const linhas = await r.json();
    const out = [];
    for (const l of Array.isArray(linhas) ? linhas : []) {
      const f = l && l.document && l.document.fields;
      if (!f) continue;
      const o = {};
      for (const k of ['gameId', 'userEmail', 'name', 'avatar', 'best', 'bestAt', 'monthKey', 'monthBest', 'prevMonthKey', 'prevMonthBest']) o[k] = valor(f[k]);
      out.push(o);
    }
    return out;
  } catch (e) { return null; }
}
