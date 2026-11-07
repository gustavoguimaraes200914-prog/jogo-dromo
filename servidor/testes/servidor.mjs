/* TESTES DO SERVIDOR (rodam contra o servidor no computador):
   cd jogo-dromo && npx wrangler dev --port 8787 --var CHAVES_TESTE:"$(node servidor/testes/ajudante.mjs chaves)" --var SEM_FIRESTORE:1 --var TESTE_TEMPO_LIVRE:1
   node servidor/testes/servidor.mjs */
import { api, token, pessoa, tx, confere, fim, novoId } from './ajudante.mjs';

const sync = (p, corpo) => api('/api/sync', { tk: p.tk, corpo });
const base = (extra = {}) => Object.assign({ c: 1000, d: 10, a: 0, pg: 1 }, extra);
async function nova(nome, b, extra) { const p = pessoa(nome, extra); const r = await sync(p, { base: b || base(), txs: [] }); p.r = r; return p; }
async function mandar(p, ...txs) { const r = await sync(p, { txs }); return r; }
const aceitou = (r, t) => r.j && r.j.ok && r.j.ok.includes(t.id);
const recusou = (r, t, por) => r.j && r.j.nao && r.j.nao.some(x => x.id === t.id && (!por || x.por === por));
const porDe = (r, t) => { const x = r.j && r.j.nao && r.j.nao.find(x => x.id === t.id); return x ? x.por : 'aceito'; };
const hoje = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

console.log('== login ==');
{
  let r = await api('/api/sync', { corpo: {} });
  confere('sem login: 401', r.status === 401, r);
  const p = pessoa('ana');
  r = await api('/api/sync', { tk: p.tk.slice(0, -4) + 'AAAA', corpo: {} });
  confere('assinatura errada: 401', r.status === 401, r);
  r = await api('/api/sync', { tk: token({ email: 'x@y.com', uid: 'abcdefgh123', aud: 'outro-projeto' }), corpo: {} });
  confere('outro projeto: 401', r.status === 401, r);
  r = await api('/api/sync', { tk: token({ email: 'x@y.com', uid: 'abcdefgh123', exp: Math.floor(Date.now() / 1000) - 600 }), corpo: {} });
  confere('vencido: 401', r.status === 401, r);
  r = await api('/api/sync', { tk: token({ email: 'x@y.com', uid: 'abcdefgh123', kid: 'nao-existe' }), corpo: {} });
  confere('chave desconhecida: 401', r.status === 401, r);
  r = await api('/api/sync', { tk: p.tk, corpo: {}, cab: { origin: 'https://site-malvado.com' } });
  confere('outro site: 403', r.status === 403, r);
  r = await api('/api/saude');
  confere('saúde sem login: 200', r.status === 200 && r.j.ok, r);
}

console.log('== primeira vez (o saldo do aparelho entra) ==');
{
  const p = pessoa('bia');
  let r = await sync(p, { txs: [tx('partida', { jogo: 'snake' }, [{ k: 'c', n: 10 }])] });
  confere('sem base: pede a base', r.j.precisaBase === true, r.j);
  r = await sync(p, { base: base({ c: 1234, d: 7, a: 3 }), txs: [] });
  confere('base entra', r.j.saldo.c === 1234 && r.j.saldo.d === 7 && r.j.saldo.a === 3, r.j);
  r = await sync(p, { base: base({ c: 999999 }), txs: [] });
  confere('segunda base é ignorada', r.j.saldo.c === 1234, r.j.saldo);
  const q = pessoa('trapaceiro');
  r = await sync(q, { base: { c: 999999999, d: 99999, a: 99999 }, txs: [] });
  confere('base enorme é cortada no teto', r.j.saldo.c === 250000 && r.j.saldo.d === 600 && r.j.saldo.a === 6000, r.j.saldo);
}

console.log('== jogar ==');
{
  const p = await nova('caio');
  const t1 = tx('partida', { jogo: 'snake' }, [{ k: 'c', n: 40 }]);
  let r = await mandar(p, t1);
  confere('partida normal aceita', aceitou(r, t1) && r.j.saldo.c === 1040, r.j);
  r = await mandar(p, t1);
  confere('mesmo movimento 2x conta 1x', aceitou(r, t1) && r.j.saldo.c === 1040, r.j.saldo);
  const t2 = tx('partida', { jogo: 'snake' }, [{ k: 'c', n: 100000 }]);
  r = await mandar(p, t2);
  confere('partida de 100 mil recusada', recusou(r, t2, 'teto_jogo') && r.j.saldo.c === 1040, porDe(r, t2));
  const t3 = tx('partida', { jogo: 'snake' }, [{ k: 'd', n: 5 }]);
  r = await mandar(p, t3);
  confere('partida não dá diamante', recusou(r, t3), porDe(r, t3));
  let soma = 0, recusas = 0;
  for (const j of ['race', 'wam', 'breakout', 'guerra-avioes', 'futebol', '2048-4', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x9', 'x10', 'x11', 'x12', 'x13', 'x14', 'x15', 'x16', 'x17', 'x18']) {
    const t = tx('partida', { jogo: j }, [{ k: 'c', n: 90 }]);
    const rr = await mandar(p, t);
    if (aceitou(rr, t)) soma += 90; else recusas++;
  }
  confere('teto do dia somando vários jogos', soma <= 1350 && recusas > 0, { soma, recusas });
  const t4 = tx('fonte', {}, [{ k: 'c', n: 1 }]);
  r = await mandar(p, t4);
  confere('fonte da praça: 1 moeda', aceitou(r, t4), porDe(r, t4));
  const t5 = tx('fonte', {}, [{ k: 'c', n: 50 }]);
  r = await mandar(p, t5);
  confere('fonte de 50 recusada', recusou(r, t5), porDe(r, t5));
}

console.log('== gastos ==');
{
  const p = await nova('duda');
  const t1 = tx('compra', { item: 'tema:noite' }, [{ k: 'c', n: -300 }]);
  let r = await mandar(p, t1);
  confere('compra normal', aceitou(r, t1) && r.j.saldo.c === 700, r.j.saldo);
  const t2 = tx('compra', { item: 'caro' }, [{ k: 'c', n: -5000 }]);
  r = await mandar(p, t2);
  confere('compra sem saldo recusada', recusou(r, t2, 'saldo') && r.j.saldo.c === 700, porDe(r, t2));
  const t3 = tx('compra', {}, [{ k: 'c', n: -10 }, { k: 'd', n: 50 }]);
  r = await mandar(p, t3);
  confere('compra que "ganha" diamante recusada', recusou(r, t3), porDe(r, t3));
}

console.log('== prêmio por mandar o link ==');
{
  const p = await nova('edu', base({ envio: 8 }));
  const ts = [];
  for (let i = 0; i < 3; i++) { const t = tx('envio', {}, [{ k: 'c', n: 100 }]); ts.push([t, await mandar(p, t)]); await new Promise(r => setTimeout(r, 3100)); }
  confere('envio 9 e 10 aceitos', aceitou(ts[0][1], ts[0][0]) && aceitou(ts[1][1], ts[1][0]), [porDe(ts[0][1], ts[0][0]), porDe(ts[1][1], ts[1][0])]);
  confere('envio 11 recusado', recusou(ts[2][1], ts[2][0], 'acabou'), porDe(ts[2][1], ts[2][0]));
}

console.log('== missões ==');
{
  const p = await nova('fabi');
  const k = hoje();
  const t1 = tx('missao', { p: 'dia', k, s: 7 }, [{ k: 'c', n: 35 }, { k: 'c', n: 120, s: 'bau', q: { t: 'comum', i: 0 } }]);
  let r = await mandar(p, t1);
  confere('missão do dia com baú', aceitou(r, t1), porDe(r, t1));
  const t2 = tx('missao', { p: 'dia', k, s: 7 }, [{ k: 'c', n: 35 }]);
  r = await mandar(p, t2);
  confere('mesma missão 2x recusada', recusou(r, t2, 'repetido'), porDe(r, t2));
  const t3 = tx('missao', { p: 'dia', k, s: 6 }, [{ k: 'c', n: 5000 }]);
  r = await mandar(p, t3);
  confere('missão pagando demais recusada', recusou(r, t3, 'demais_c'), porDe(r, t3));
  const t4 = tx('missao', { p: 'dia', k: '2030-01-01', s: 1 }, [{ k: 'c', n: 3 }]);
  r = await mandar(p, t4);
  confere('missão do futuro recusada', recusou(r, t4, 'periodo_chave'), porDe(r, t4));
  const t5 = tx('missao', { p: 'dia', k, s: 5 }, [{ k: 'c', n: 17 }, { k: 'c', n: 900, s: 'bau', q: { t: 'epico', i: 0 } }]);
  r = await mandar(p, t5);
  confere('baú que a missão não dá recusado', recusou(r, t5, 'bau_sem_origem'), porDe(r, t5));
  const t6 = tx('missao', { p: 'dia', k, s: 0 }, [{ k: 'c', n: 3 }, { k: 'c', n: 9999, s: 'bau', q: { t: 'comum', i: 0 } }]);
  r = await mandar(p, t6);
  confere('baú comum de 9999 recusado', recusou(r, t6), porDe(r, t6));
}

console.log('== baús, Koda GB shop, oferta ==');
{
  const p = await nova('gabi', base({ c: 100000, d: 50 }));
  const t1 = tx('bau_compra', { t: 'epico', moeda: 'c' }, [{ k: 'c', n: -3000 }, { k: 'c', n: 850, s: 'bau', q: { t: 'epico', i: 0 } }]);
  let r = await mandar(p, t1);
  confere('comprou baú épico e abriu', aceitou(r, t1) && r.j.saldo.c === 100000 - 3000 + 850, porDe(r, t1));
  const t2 = tx('bau_compra', { t: 'espectral', moeda: 'c' }, [{ k: 'c', n: -10 }, { k: 'c', n: 13000, s: 'bau', q: { t: 'espectral', i: 0 } }]);
  r = await mandar(p, t2);
  confere('baú espectral por 10 moedas recusado', recusou(r, t2, 'pagou_pouco'), porDe(r, t2));
  const t3 = tx('outro', {}, [{ k: 'c', n: 1000, s: 'bau', q: { t: 'lendario', i: 0 } }]);
  r = await mandar(p, t3);
  confere('baú do nada recusado', recusou(r, t3), porDe(r, t3));
  const t4 = tx('kshop', { op: 'compra' }, [{ k: 'c', n: -13200 }, { k: 'd', n: 2 }]);
  r = await mandar(p, t4);
  confere('comprou 2 diamantes', aceitou(r, t4), porDe(r, t4));
  const t5 = tx('kshop', { op: 'compra' }, [{ k: 'c', n: -100 }, { k: 'd', n: 20 }]);
  r = await mandar(p, t5);
  confere('20 diamantes por 100 moedas recusado', recusou(r, t5, 'pagou_pouco'), porDe(r, t5));
  const t6 = tx('kshop', { op: 'compra', oferta: true }, [{ k: 'c', n: -30000 }, { k: 'd', n: 5 }]);
  r = await mandar(p, t6);
  confere('oferta de 5 diamantes', aceitou(r, t6), porDe(r, t6));
  const t7 = tx('kshop', { op: 'venda' }, [{ k: 'd', n: -10 }, { k: 'c', n: 43000 }]);
  r = await mandar(p, t7);
  confere('vendeu 10 diamantes', aceitou(r, t7), porDe(r, t7));
  const t8 = tx('kshop', { op: 'venda' }, [{ k: 'd', n: -1 }, { k: 'c', n: 9000 }]);
  r = await mandar(p, t8);
  confere('venda cara demais recusada', recusou(r, t8, 'demais_c'), porDe(r, t8));
  const t9 = tx('rel', { tipo: 'dia', k: hoje() }, [{ k: 'c', n: -46500 }, { k: 'd', n: 10 }]);
  r = await mandar(p, t9);
  confere('oferta relâmpago de diamantes', aceitou(r, t9), porDe(r, t9));
  const t10 = tx('rel', { tipo: 'dia', k: hoje() }, [{ k: 'c', n: -46500 }, { k: 'd', n: 10 }]);
  r = await mandar(p, t10);
  confere('oferta relâmpago 2x no dia recusada', recusou(r, t10, 'repetido'), porDe(r, t10));
}

console.log('== rotina: sequência, roleta, baú grátis ==');
{
  const p = await nova('heitor');
  const t1 = tx('seq', { n: 1, k: hoje() }, [{ k: 'c', n: 50 }]);
  let r = await mandar(p, t1);
  confere('sequência dia 1', aceitou(r, t1), porDe(r, t1));
  const t2 = tx('seq', { n: 2, k: hoje() }, [{ k: 'c', n: 85 }]);
  r = await mandar(p, t2);
  confere('sequência 2x no dia recusada', recusou(r, t2), porDe(r, t2));
  const q = await nova('iris', base({ seq: { n: 3, u: '2026-01-01' } }));
  const t3 = tx('seq', { n: 50, k: hoje() }, [{ k: 'c', n: 999 }]);
  r = await mandar(q, t3);
  confere('sequência que pula recusada', recusou(r, t3, 'pulou'), porDe(r, t3));
  const t4 = tx('roleta', { i: 8, k: hoje() }, [{ k: 'c', n: 1000 }]);
  r = await mandar(p, t4);
  confere('roleta 1000', aceitou(r, t4), porDe(r, t4));
  const t5 = tx('roleta', { i: 8, k: hoje() }, [{ k: 'c', n: 1000 }]);
  r = await mandar(p, t5);
  confere('roleta 2x recusada', recusou(r, t5), porDe(r, t5));
  const t6 = tx('bau_gratis', { t: 'comum' }, [{ k: 'c', n: 100, s: 'bau', q: { t: 'comum', i: 0 } }]);
  r = await mandar(p, t6);
  confere('baú grátis', aceitou(r, t6), porDe(r, t6));
  const t7 = tx('bau_gratis', { t: 'comum' }, [{ k: 'c', n: 100, s: 'bau', q: { t: 'comum', i: 0 } }]);
  r = await mandar(p, t7);
  confere('baú grátis antes das 4h recusado', recusou(r, t7, 'cedo'), porDe(r, t7));
}

console.log('== nível e Koda GB Pass ==');
{
  const p = await nova('joao', base({ pg: 4 }));
  const t1 = tx('nivel', { n: [5, 6] }, [{ k: 'c', n: 45 + 55 }, { k: 'c', n: 100, s: 'bau', q: { t: 'comum', i: 0 } }]);
  let r = await mandar(p, t1);
  confere('subiu pros níveis 5 e 6', aceitou(r, t1), porDe(r, t1));
  const t2 = tx('nivel', { n: [6] }, [{ k: 'c', n: 55 }]);
  r = await mandar(p, t2);
  confere('nível repetido recusado', recusou(r, t2, 'repetido'), porDe(r, t2));
  const muitos = Array.from({ length: 300 }, (_, i) => 7 + i);
  const t3 = tx('nivel', { n: muitos }, [{ k: 'c', n: 1000 }]);
  r = await mandar(p, t3);
  confere('300 níveis de uma vez recusado (XP demais)', recusou(r, t3, 'xp_demais'), porDe(r, t3));
  const t4 = tx('passe', { t: 't1', l: [['g', 1], ['g', 2]] }, [{ k: 'c', n: 15 + 15 }]);
  r = await mandar(p, t4);
  confere('Pass: 2 prêmios grátis', aceitou(r, t4), porDe(r, t4));
  const t5 = tx('passe', { t: 't1', l: [['p', 1]] }, [{ k: 'c', n: 30 }]);
  r = await mandar(p, t5);
  confere('Pass Super sem ter comprado: recusado', recusou(r, t5, 'sem_passe'), porDe(r, t5));
  const t6 = tx('passe_compra', { t: 't1', plano: 'super' }, [{ k: 'd', n: -75 }]);
  const q = await nova('kaka', base({ d: 100 }));
  r = await mandar(q, t6);
  confere('comprou o Pass Super', aceitou(r, t6), porDe(r, t6));
  const t7 = tx('passe', { t: 't1', l: [['p', 1], ['g', 1]] }, [{ k: 'c', n: 30 + 15 }]);
  r = await mandar(q, t7);
  confere('Pass Super depois de comprar', aceitou(r, t7), porDe(r, t7));
  const tudo = []; for (let n = 1; n <= 100; n++) tudo.push(['g', n]);
  const t8 = tx('passe', { t: 't1', l: tudo.slice(2) }, [{ k: 'c', n: 5000 }]);
  r = await mandar(p, t8);
  confere('Pass inteiro de uma vez recusado', recusou(r, t8, 'xp_demais'), porDe(r, t8));
}

console.log('== evento (abóboras) ==');
{
  const p = await nova('lia', base({ c: 50000 }));
  const t1 = tx('hl_compra', { moeda: 'c' }, [{ k: 'c', n: -3300 }, { k: 'a', n: 10 }]);
  let r = await mandar(p, t1);
  confere('comprou 10 abóboras', aceitou(r, t1) && r.j.saldo.a === 10, porDe(r, t1));
  const t2 = tx('hl_compra', { moeda: 'c' }, [{ k: 'c', n: -10 }, { k: 'a', n: 1000 }]);
  r = await mandar(p, t2);
  confere('1000 abóboras por 10 moedas recusado', recusou(r, t2, 'pagou_pouco'), porDe(r, t2));
  const t3 = tx('hl_bau', { bau: 'hl_abobora' }, [{ k: 'a', n: -3 }]);
  r = await mandar(p, t3);
  confere('abriu baú do evento', aceitou(r, t3), porDe(r, t3));
  const t4 = tx('hl_rep', {}, [{ k: 'a', n: 2 }]);
  r = await mandar(p, t4);
  confere('trocou repetido por abóboras', aceitou(r, t4), porDe(r, t4));
  const t5 = tx('hl_rep', {}, [{ k: 'a', n: 500 }]);
  r = await mandar(p, t5);
  confere('repetido inventado recusado', recusou(r, t5, 'sem_repetido'), porDe(r, t5));
}

console.log('== presentes ==');
{
  const a = await nova('mari', base({ c: 5000, d: 20 }));
  const b = await nova('nico');
  const t1 = tx('presente', { para: b.email, v: { tipo: 'moedas', n: 500 } }, [{ k: 'c', n: -500 }]);
  let r = await mandar(a, t1);
  confere('mandou 500 moedas', aceitou(r, t1) && r.j.saldo.c === 4500, porDe(r, t1));
  const t2 = tx('presente_receber', { tipo: 'moedas' }, [{ k: 'c', n: 600 }]);
  r = await mandar(b, t2);
  confere('receber mais do que mandaram: recusado', recusou(r, t2, 'sem_presente'), porDe(r, t2));
  const t3 = tx('presente_receber', { tipo: 'moedas' }, [{ k: 'c', n: 500 }]);
  r = await mandar(b, t3);
  confere('recebeu as 500', aceitou(r, t3) && r.j.saldo.c === 1500, porDe(r, t3));
  const t4 = tx('presente_receber', { tipo: 'moedas' }, [{ k: 'c', n: 500 }]);
  r = await mandar(b, t4);
  confere('receber o mesmo presente 2x: recusado', recusou(r, t4), porDe(r, t4));
  const t5 = tx('presente', { para: b.email, v: { tipo: 'moedas', n: 100000 } }, [{ k: 'c', n: -10 }]);
  r = await mandar(a, t5);
  confere('presente de 100 mil pagando 10: recusado', recusou(r, t5, 'pagou_pouco'), porDe(r, t5));
  const t6 = tx('presente', { para: b.email, v: { tipo: 'bau', bau: 'raro', moeda: 'c' } }, [{ k: 'c', n: -1150 }]);
  r = await mandar(a, t6);
  confere('mandou um baú raro', aceitou(r, t6), porDe(r, t6));
  const t7 = tx('presente_receber', { bau: 'raro' }, [{ k: 'c', n: 350, s: 'bau', q: { t: 'raro', i: 0 } }]);
  r = await mandar(b, t7);
  confere('abriu o baú de presente', aceitou(r, t7), porDe(r, t7));
  const t8 = tx('presente', { para: a.email, v: { tipo: 'moedas', n: 1 } }, [{ k: 'c', n: -1 }]);
  r = await mandar(a, t8);
  confere('presente pra si mesmo recusado', recusou(r, t8, 'pessoa'), porDe(r, t8));
}

console.log('== roupa criada (o criador recebe 70%) ==');
{
  const criador = await nova('olga');
  const comprador = await nova('pedro', base({ c: 3000 }));
  const t1 = tx('ugc_compra', { para: criador.uid, peca: 'u123' }, [{ k: 'c', n: -1000 }]);
  let r = await mandar(comprador, t1);
  confere('comprou a peça', aceitou(r, t1), porDe(r, t1));
  const t2 = tx('ugc_venda', {}, [{ k: 'c', n: 701 }]);
  r = await mandar(criador, t2);
  confere('criador pedindo 701: recusado', recusou(r, t2, 'sem_venda'), porDe(r, t2));
  const t3 = tx('ugc_venda', {}, [{ k: 'c', n: 700 }]);
  r = await mandar(criador, t3);
  confere('criador recebeu 700', aceitou(r, t3), porDe(r, t3));
}

console.log('== tempo jogado, prêmio do tempo e convite ==');
{
  const amigo1 = await nova('quem_chama');
  const amigo2 = pessoa('convidado', { criada: Date.now() - 3600e3 });
  let r = await sync(amigo2, { base: base(), ref: amigo1.uid, txs: [] });
  confere('convidado entrou pelo link', r.j.info.convidadoPor === true, r.j.info);
  for (let i = 0; i < 4; i++) r = await sync(amigo2, { tempo: { s: 500, j: 'snake' }, txs: [] });
  confere('tempo contado', r.j.info.tempoHoje >= 1800, r.j.info);
  const t1 = tx('tempo_dia', { k: hoje() }, [{ k: 'c', n: 100 }]);
  r = await mandar(amigo2, t1);
  confere('prêmio de 30 minutos', aceitou(r, t1), porDe(r, t1));
  r = await sync(amigo1, { txs: [] });
  confere('quem chamou ganhou 1.000', r.j.saldo.c === 2000 && r.j.nov.some(n => n.m === 'convite' && n.c === 1000), { saldo: r.j.saldo, nov: r.j.nov });
  confere('contador de convites', r.j.info.convites === 1, r.j.info);
  r = await sync(amigo1, { visto: r.j.nov[r.j.nov.length - 1].s, txs: [] });
  confere('novidade some depois de vista', r.j.nov.length === 0, r.j.nov);
  /* o amigo entra pelo link ANTES de quem chamou abrir o site novo: o convite fica esperando */
  const chamaDepois = pessoa('chama_depois');
  const amigo3 = pessoa('convidado_cedo', { criada: Date.now() - 3600e3 });
  r = await sync(amigo3, { base: base(), ref: chamaDepois.uid, txs: [] });
  confere('convite espera quem chamou entrar', r.j.info.convidadoPor === false && r.j.info.conviteFim === false, r.j.info);
  await sync(chamaDepois, { base: base(), txs: [] });
  r = await sync(amigo3, { ref: chamaDepois.uid, txs: [] });
  confere('quando quem chamou entra, o convite liga', r.j.info.convidadoPor === true, r.j.info);
  /* a sequência pega hoje no aparelho antes do servidor não pode ser pega de novo */
  const hj = pessoa('seq_hoje');
  await sync(hj, { base: base({ seq: { n: 5, u: hoje() }, hoje: hoje() }), txs: [] });
  const tq = tx('seq', { n: 6, k: hoje() }, [{ k: 'c', n: 235 }]);
  r = await mandar(hj, tq);
  confere('sequência já pega hoje no aparelho: recusada', recusou(r, tq, 'cedo'), porDe(r, tq));
  const ontem = pessoa('seq_ontem');
  await sync(ontem, { base: base({ seq: { n: 5, u: '2026-01-01' }, hoje: hoje() }), txs: [] });
  const tq2 = tx('seq', { n: 6, k: hoje() }, [{ k: 'c', n: 235 }]);
  r = await mandar(ontem, tq2);
  confere('sequência de ontem: pega hoje normalmente', aceitou(r, tq2), porDe(r, tq2));
  const pre = pessoa('jogou_antes');
  await sync(pre, { base: base({ tempoHoje: 1700 }), txs: [] });
  r = await sync(pre, { tempo: { s: 120, j: 'snake' }, txs: [] });
  const tq3 = tx('tempo_dia', { k: hoje() }, [{ k: 'c', n: 100 }]);
  r = await mandar(pre, tq3);
  confere('30 minutos somando o tempo de antes do servidor', aceitou(r, tq3), porDe(r, tq3));
  const velho = pessoa('conta_velha', { criada: Date.now() - 400 * 86400e3 });
  r = await sync(velho, { base: base(), ref: amigo1.uid, txs: [] });
  confere('conta antiga não vira convidado', r.j.info.convidadoPor === false && r.j.info.conviteFim === true, r.j.info);
  const t2 = tx('tempo_dia', { k: hoje() }, [{ k: 'c', n: 100 }]);
  r = await mandar(velho, t2);
  confere('prêmio do tempo sem jogar: recusado', recusou(r, t2, 'pouco_tempo'), porDe(r, t2));
  const t3 = tx('convite', {}, [{ k: 'c', n: 1000 }]);
  r = await mandar(velho, t3);
  confere('pedir o prêmio do convite pelo site: recusado', recusou(r, t3), porDe(r, t3));
}

console.log('== ranking ==');
{
  const p = await nova('rafa');
  let r = await sync(p, { pontos: [{ j: 'snake', v: 50 }], txs: [] });
  confere('pontuação sem ter jogado: recusada', r.j.pontos[0] && r.j.pontos[0].ok === false, r.j.pontos);
  r = await sync(p, { tempo: { s: 60, j: 'snake' }, pontos: [{ j: 'snake', v: 50, n: 'Rafa' }], txs: [] });
  confere('pontuação depois de jogar', r.j.pontos[0] && r.j.pontos[0].ok === true, r.j.pontos);
  const q = await nova('sara');
  await sync(q, { tempo: { s: 60, j: 'snake' }, txs: [] });
  await new Promise(res => setTimeout(res, 3100));
  r = await sync(q, { pontos: [{ j: 'snake', v: 999999999 }], txs: [] });
  confere('pontuação absurda: recusada', r.j.pontos[0] && r.j.pontos[0].ok === false && r.j.pontos[0].por === 'suspeito', r.j.pontos);
  r = await api('/api/placar?jogo=snake', { tk: p.tk });
  confere('ranking do jogo', r.j.ok && r.j.lista.some(x => x.userEmail === p.email && x.best === 50), r.j);
  r = await api('/api/temporada', { tk: p.tk });
  confere('temporada', r.j.ok && r.j.lista.some(x => x.email === p.email), r.j);
}

console.log('== dono do site ==');
{
  const dono = { email: 'gustavoguimaraes200914@gmail.com', uid: 'donouid12345678' };
  dono.tk = token(dono);
  const alvo = await nova('tito');
  let r = await api('/api/admin/alertas', { tk: alvo.tk });
  confere('painel pra quem não é dono: 403', r.status === 403, r);
  r = await api('/api/admin/alertas', { tk: dono.tk });
  confere('dono vê os avisos', r.j.ok && Array.isArray(r.j.alertas) && r.j.alertas.some(a => a.tipo === 'importar_teto'), r.j && r.j.alertas && r.j.alertas.length);
  r = await api('/api/admin/conta?email=' + encodeURIComponent(alvo.email), { tk: dono.tk });
  confere('dono vê uma conta', r.j.ok && r.j.conta.saldo.c === 1000, r.j);
  r = await api('/api/admin/ajuste', { tk: dono.tk, corpo: { email: alvo.email, c: 250, motivo: 'teste' } });
  confere('dono ajusta saldo', r.j.ok && r.j.saldo.c === 1250, r.j);
  r = await sync(alvo, { txs: [] });
  confere('ajuste chega como novidade', r.j.saldo.c === 1250 && r.j.nov.some(n => n.m === 'ajuste'), r.j);
  r = await api('/api/admin/ban', { tk: dono.tk, corpo: { email: alvo.email, dias: 1, motivo: 'teste' } });
  const t1 = tx('partida', { jogo: 'snake' }, [{ k: 'c', n: 10 }]);
  r = await mandar(alvo, t1);
  confere('banido não ganha', recusou(r, t1, 'banido') && r.j.banido === true, r.j);
  await api('/api/admin/desban', { tk: dono.tk, corpo: { email: alvo.email } });
  const t2 = tx('partida', { jogo: 'snake' }, [{ k: 'c', n: 10 }]);
  r = await mandar(alvo, t2);
  confere('desbanido volta a ganhar', aceitou(r, t2), porDe(r, t2));
  r = await sync(dono, { base: base({ c: 5 }), txs: [tx('outro', {}, [{ k: 'c', n: 100000 }])] });
  confere('dono testa sem teto', r.j.saldo.c === 100005, r.j.saldo);
}

console.log('== o resto ==');
{
  const p = await nova('ugo');
  const t1 = tx('outro', {}, [{ k: 'c', n: 50 }]);
  let r = await mandar(p, t1);
  confere('ganho pequeno sem motivo: aceito', aceitou(r, t1), porDe(r, t1));
  const t2 = tx('outro', {}, [{ k: 'c', n: 5000 }]);
  r = await mandar(p, t2);
  confere('ganho grande sem motivo: recusado', recusou(r, t2, 'teto_outro'), porDe(r, t2));
  const t3 = tx('motivo_inventado', {}, [{ k: 'd', n: 100 }]);
  r = await mandar(p, t3);
  confere('motivo inventado com 100 diamantes: recusado', recusou(r, t3), porDe(r, t3));
  const t4 = { id: 'x', m: 'partida', mv: [] };
  r = await mandar(p, t4);
  confere('movimento torto: recusado', recusou(r, t4, 'formato'), r.j.nao);
  r = await api('/api/sync', { tk: p.tk, corpo: { txs: [], lixo: 'x'.repeat(300000) } });
  confere('pedido gigante: recusado', r.status === 413, r.status);
}
fim();
