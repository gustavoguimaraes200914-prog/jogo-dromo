/* KODA GB — SERVIDOR: o APRENDIZ (o Agente Koda GB aprendendo com os erros de todo mundo)
   Fica numa instância própria do Vigia ("agente"), com tabelas só dele.
   - O site manda o que deu errado: frase que o agente não entendeu, frase que alguém ensinou (com o pedido certo),
     "não era isso", mudança que ia quebrar o jogo, troca de moeda que não deu certo.
   - Nada de e-mail aqui: cada conta vira um código (só pra contar quantas pessoas diferentes passaram pela mesma frase).
     E-mail, endereço e número comprido são tirados da frase (no aparelho e aqui de novo).
   - Regra que vale pra todo mundo:
       * o dono aprova no painel; ou
       * 3 pessoas diferentes ensinaram a MESMA coisa pra mesma frase, sem texto livre no pedido
         (nada de nome ou mensagem escrita por alguém), e o dono não recusou.
     Regra automática só vale onde o agente não entendeu. Se 3 pessoas reclamarem ("não era isso"), ela sai sozinha.
     Só o dono pode fazer uma regra valer "sempre" (até onde o agente achava que tinha entendido). */
import { texto } from './util.js';

const NAO_ENSINA = /^(vazio|nada|oi|obrigado|quem|ajuda|sim|nao|negou|improprio|dados_pessoais|dinheiro_real|faq|faq_duvida|qual_item|escolheu_item|loja_nome_qual|deu_nome|confirmou|briefing_resp|ensinar|ensinar_qual|elogio|confuso|tudo_bem|xingou|historico|moedas_quer|faq_texto|desfazer|aprendeu_ver|aprendeu_limpar|aprendeu_errei)$/;
const SO_DONO = /^(loja_remover|consertar|criar_jogo|adaptar|outra_ia|mudar_tema|nome_jogo|mod_texto|mod_traduzir|loja_nome|loja_desc|moeda_renomear)$/;
const TIPOS = /^(nao_entendi|ensinou|errou|quebrou|moeda_[a-z_]{2,20})$/;
export const AUTO_VOTOS = 3, AUTO_QUEIXAS = 3, POR_DIA = 60, MAX_FRASES = 3000;

export function limparFrase(f) {
  return texto(f, 300).replace(/\S+@\S+/g, ' ').replace(/https?:\/\/\S+|www\.\S+/gi, ' ').replace(/\d[\d\s().-]{3,}\d/g, '#')
    .replace(/\s+/g, ' ').trim().slice(0, 120);
}
export function chaveDaFrase(f) {
  return String(f || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}
export function pedidoOk(it) {
  if (!it || typeof it !== 'object' || Array.isArray(it)) return null;
  if (typeof it.int !== 'string' || !/^[a-z][a-z0-9_]{1,39}$/.test(it.int) || NAO_ENSINA.test(it.int)) return null;
  let s; try { s = JSON.stringify(it); } catch (e) { return null; }
  if (!s || s.length > 600) return null;
  const limpo = JSON.parse(s);
  delete limpo.aprendido; delete limpo.global; delete limpo.P;
  return limpo;
}
/* sem texto livre (só valores de "código": 'c', 'd', 'vidas', 'cima-direita', números...) */
export function pedidoSimples(it) {
  let ok = true;
  (function andar(v, k, fundo) {
    if (fundo > 4) { ok = false; return; }
    if (typeof v === 'string') { if (k !== 'int' && !/^[a-z0-9_.-]{1,24}$/.test(v)) ok = false; }
    else if (v && typeof v === 'object') for (const kk of Object.keys(v)) andar(v[kk], kk, fundo + 1);
  })(it, '', 0);
  return ok && !SO_DONO.test(it.int);
}
const dia = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);

function tabelas(sql) {
  sql.exec('CREATE TABLE IF NOT EXISTS ag_frase (k TEXT PRIMARY KEY, ex TEXT, n INTEGER, ult INTEGER, tipos TEXT, l TEXT)');
  sql.exec('CREATE TABLE IF NOT EXISTS ag_conta (k TEXT, c TEXT, PRIMARY KEY (k, c))');
  sql.exec('CREATE TABLE IF NOT EXISTS ag_voto (k TEXT, it TEXT, c TEXT, sobre INTEGER, PRIMARY KEY (k, it, c))');
  sql.exec('CREATE TABLE IF NOT EXISTS ag_regra (k TEXT PRIMARY KEY, it TEXT, por TEXT, sobre INTEGER, t INTEGER, ex TEXT)');
  sql.exec('CREATE TABLE IF NOT EXISTS ag_recusa (k TEXT, it TEXT, PRIMARY KEY (k, it))');
  sql.exec('CREATE TABLE IF NOT EXISTS ag_queixa (k TEXT, c TEXT, PRIMARY KEY (k, c))');
  sql.exec('CREATE TABLE IF NOT EXISTS ag_cota (c TEXT, dia TEXT, n INTEGER, PRIMARY KEY (c, dia))');
}
const um = (sql, q, ...a) => { const r = sql.exec(q, ...a).toArray(); return r[0] || null; };

/* o que o aparelho mandou */
export function receberErros(sql, conta, eventos) {
  tabelas(sql);
  if (!/^[a-f0-9]{8,64}$/.test(String(conta || ''))) return { aceitos: 0 };
  const hoje = dia(), cota = um(sql, 'SELECT n FROM ag_cota WHERE c = ? AND dia = ?', conta, hoje);
  const livre = Math.max(0, POR_DIA - (cota ? cota.n : 0));
  const lista = (Array.isArray(eventos) ? eventos : []).slice(0, Math.min(20, livre));
  let aceitos = 0;
  for (const e of lista) {
    if (!e || typeof e !== 'object' || !TIPOS.test(String(e.t || ''))) continue;
    const f = limparFrase(e.f), k = chaveDaFrase(f);
    if (k.length < 2) continue;
    const velho = um(sql, 'SELECT tipos FROM ag_frase WHERE k = ?', k);
    let tipos = {}; try { tipos = velho ? JSON.parse(velho.tipos) || {} : {}; } catch (x) {}
    tipos[e.t] = (tipos[e.t] || 0) + 1;
    if (e.t === 'errou' && typeof e.i === 'string' && /^[a-z][a-z0-9_]{1,39}$/.test(e.i)) tipos['errou:' + e.i] = (tipos['errou:' + e.i] || 0) + 1;
    const l = typeof e.l === 'string' ? e.l.slice(0, 5) : '';
    if (velho) sql.exec('UPDATE ag_frase SET n = n + 1, ult = ?, tipos = ?, ex = ?, l = ? WHERE k = ?', Date.now(), JSON.stringify(tipos).slice(0, 2000), f, l, k);
    else sql.exec('INSERT INTO ag_frase (k, ex, n, ult, tipos, l) VALUES (?, ?, 1, ?, ?, ?)', k, f, Date.now(), JSON.stringify(tipos), l);
    sql.exec('INSERT OR IGNORE INTO ag_conta (k, c) VALUES (?, ?)', k, conta);
    if (e.t === 'ensinou') {
      const it = pedidoOk(e.c);
      if (it) {
        const itTxt = JSON.stringify(it);
        sql.exec('INSERT OR IGNORE INTO ag_voto (k, it, c, sobre) VALUES (?, ?, ?, ?)', k, itTxt, conta, e.s ? 1 : 0);
        const votos = um(sql, 'SELECT COUNT(*) AS v FROM ag_voto WHERE k = ? AND it = ?', k, itTxt).v;
        const recusado = um(sql, 'SELECT 1 AS x FROM ag_recusa WHERE k = ? AND it = ?', k, itTxt);
        const regra = um(sql, 'SELECT por FROM ag_regra WHERE k = ?', k);
        if (votos >= AUTO_VOTOS && !recusado && !regra && pedidoSimples(it))
          sql.exec('INSERT INTO ag_regra (k, it, por, sobre, t, ex) VALUES (?, ?, ?, 0, ?, ?)', k, itTxt, 'auto', Date.now(), f);
      }
    }
    /* a regra de todos errou: com 3 pessoas reclamando, a automática sai (e não volta sozinha) */
    if (e.t === 'errou' && e.g) {
      sql.exec('INSERT OR IGNORE INTO ag_queixa (k, c) VALUES (?, ?)', k, conta);
      const regra = um(sql, 'SELECT it, por FROM ag_regra WHERE k = ?', k);
      const q = um(sql, 'SELECT COUNT(*) AS v FROM ag_queixa WHERE k = ?', k).v;
      if (regra && regra.por === 'auto' && q >= AUTO_QUEIXAS) {
        sql.exec('DELETE FROM ag_regra WHERE k = ?', k);
        sql.exec('INSERT OR IGNORE INTO ag_recusa (k, it) VALUES (?, ?)', k, regra.it);
      }
    }
    aceitos++;
  }
  if (aceitos) {
    if (cota) sql.exec('UPDATE ag_cota SET n = n + ? WHERE c = ? AND dia = ?', aceitos, conta, hoje);
    else sql.exec('INSERT INTO ag_cota (c, dia, n) VALUES (?, ?, ?)', conta, hoje, aceitos);
  }
  if (Math.random() < 0.03) arrumar(sql);
  return { aceitos };
}
/* não deixa crescer sem fim: fica com as frases mais recentes (as que viraram regra ficam) */
export function arrumar(sql) {
  tabelas(sql);
  sql.exec('DELETE FROM ag_frase WHERE k NOT IN (SELECT k FROM ag_regra) AND k IN (SELECT k FROM ag_frase ORDER BY ult DESC LIMIT -1 OFFSET ?)', MAX_FRASES);
  for (const t of ['ag_conta', 'ag_voto', 'ag_queixa']) sql.exec(`DELETE FROM ${t} WHERE k NOT IN (SELECT k FROM ag_frase)`);
  sql.exec('DELETE FROM ag_cota WHERE dia < ?', new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10));
}
/* as regras que o agente de todo mundo usa */
export function regras(sql) {
  tabelas(sql);
  return sql.exec('SELECT k, it, sobre FROM ag_regra ORDER BY t DESC LIMIT 2000').toArray().map(r => {
    let it = null; try { it = JSON.parse(r.it); } catch (e) {}
    return it ? { k: r.k, it, sobre: !!r.sobre } : null;
  }).filter(Boolean);
}
/* o painel do dono */
export function lista(sql, n) {
  tabelas(sql);
  const frases = sql.exec('SELECT k, ex, n, ult, tipos, l FROM ag_frase ORDER BY n DESC, ult DESC LIMIT ?', Math.min(300, Math.max(1, Number(n) || 100))).toArray().map(f => {
    let tipos = {}; try { tipos = JSON.parse(f.tipos) || {}; } catch (e) {}
    const contas = um(sql, 'SELECT COUNT(*) AS v FROM ag_conta WHERE k = ?', f.k).v;
    const sugestoes = sql.exec('SELECT it, COUNT(*) AS v, MAX(sobre) AS s FROM ag_voto WHERE k = ? GROUP BY it ORDER BY v DESC LIMIT 3', f.k).toArray().map(v => {
      let it = null; try { it = JSON.parse(v.it); } catch (e) {}
      return { it, votos: v.v, sobre: !!v.s };
    }).filter(x => x.it);
    const rg = um(sql, 'SELECT it, por, sobre FROM ag_regra WHERE k = ?', f.k);
    let regra = null; if (rg) { try { regra = { it: JSON.parse(rg.it), por: rg.por, sobre: !!rg.sobre }; } catch (e) {} }
    const queixas = um(sql, 'SELECT COUNT(*) AS v FROM ag_queixa WHERE k = ?', f.k).v;
    return { k: f.k, frase: f.ex, vezes: f.n, contas, ult: f.ult, tipos, lingua: f.l, sugestoes, regra, queixas };
  });
  const total = um(sql, 'SELECT COUNT(*) AS v FROM ag_frase').v, nRegras = um(sql, 'SELECT COUNT(*) AS v FROM ag_regra').v;
  return { frases, total, regras: nRegras };
}
export function admin(sql, acao, d) {
  tabelas(sql);
  const k = chaveDaFrase(limparFrase(d && d.k));
  if (k.length < 2) return { ok: false, erro: 'frase' };
  if (acao === 'aprovar') {
    const it = pedidoOk(d.it);
    if (!it) return { ok: false, erro: 'pedido' };
    const itTxt = JSON.stringify(it);
    sql.exec('INSERT OR REPLACE INTO ag_regra (k, it, por, sobre, t, ex) VALUES (?, ?, ?, ?, ?, ?)', k, itTxt, 'dono', d.sobre ? 1 : 0, Date.now(), limparFrase(d.frase || d.k));
    sql.exec('DELETE FROM ag_recusa WHERE k = ? AND it = ?', k, itTxt);
    sql.exec('DELETE FROM ag_queixa WHERE k = ?', k);
    return { ok: true };
  }
  if (acao === 'recusar') {
    const it = pedidoOk(d.it);
    if (!it) return { ok: false, erro: 'pedido' };
    const itTxt = JSON.stringify(it);
    sql.exec('INSERT OR IGNORE INTO ag_recusa (k, it) VALUES (?, ?)', k, itTxt);
    sql.exec('DELETE FROM ag_regra WHERE k = ? AND it = ?', k, itTxt);
    return { ok: true };
  }
  if (acao === 'tirar') { sql.exec('DELETE FROM ag_regra WHERE k = ?', k); return { ok: true }; }
  if (acao === 'apagar') {
    for (const t of ['ag_frase', 'ag_conta', 'ag_voto', 'ag_queixa', 'ag_regra']) sql.exec(`DELETE FROM ${t} WHERE k = ?`, k);
    return { ok: true };
  }
  return { ok: false, erro: 'acao' };
}
/* cada conta vira um código (pra contar pessoas diferentes sem guardar o e-mail) */
export async function codigoDaConta(email, sal) {
  const dados = new TextEncoder().encode('koda-agente|' + String(sal || '') + '|' + String(email || '').toLowerCase());
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', dados));
  return Array.from(h.slice(0, 12), b => b.toString(16).padStart(2, '0')).join('');
}
