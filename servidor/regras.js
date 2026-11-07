/* KODA GB — SERVIDOR: AS REGRAS DAS MOEDAS
   Tudo que dá ou tira moedas (c), Koda GB Diamonds (d) e moedas do evento (a, abóboras) chega aqui como um
   "movimento" com um MOTIVO (partida, missão, passe, baú, presente...). O servidor confere com as MESMAS tabelas
   do site (copiadas abaixo) se aquilo podia mesmo acontecer, quantas vezes e quanto. O que não podia é recusado.
   IMPORTANTE: quando mudar um prêmio ou um preço no site (index.html), mude aqui também.
   (o teste testes/tabelas.mjs compara as duas cópias e avisa se ficarem diferentes) */
import { inteiro, obj, jogoOk, chavePlausivel, emailOk, limpaEmail, uidOk, diaBRT } from './util.js';

/* ================= AS TABELAS DO SITE (cópia) ================= */
const COIN_RULES = {
  snake:          {min:6,   passo:4,   teto:12, dia:75},
  wam:            {min:10,  passo:5,   teto:12, dia:75},
  race:           {min:12,  passo:7,   teto:12, dia:75},
  breakout:       {min:10,  passo:6,   teto:12, dia:75},
  'guerra-avioes':{min:12,  passo:7,   teto:12, dia:75},
  futebol:        {min:1,   passo:1,   teto:10, dia:60},
  /* o 2048 tem um id por tamanho de tabuleiro (2048-4, 2048-5...),
     então a regra dele é achada por prefixo lá embaixo */
  '2048':         {min:600, passo:260, teto:12, dia:75},
  /* jogo de outra pessoa: mesma ideia, só que mais apertado, porque
     a gente não sabe como a pontuação daquele jogo cresce */
  __publicado:    {min:5,   passo:6,   teto:8,  dia:40}
};
const COIN_DIA_GERAL = 300;
const ACOES_TETO_DIA = 13;
function coinRuleFor(gameId, ehPublicado){
  if(ehPublicado) return COIN_RULES.__publicado;
  if(COIN_RULES[gameId]) return COIN_RULES[gameId];
  if(String(gameId).indexOf('2048')===0) return COIN_RULES['2048'];
  return COIN_RULES.__publicado;
}
const MS_RECOMPENSA = {
  dia:    [{c:3}, {c:3}, {c:7}, {c:7}, {c:12}, {c:17}, {c:17}, {c:35, b:'comum'}],
  semana: [{c:17}, {c:17}, {c:35}, {c:40, b:'comum'}, {c:65, b:'raro'}, {c:100}, {c:135, b:'epico'}, {c:235, b:'lendario'}],
  mes:    [{c:50}, {c:50}, {c:100}, {c:135, b:'raro'}, {c:235}, {c:300, b:'epico'}, {c:435, b:'lendario'}, {c:700, b:'espectral'}]
};
const MS_RECOMPENSA_ANT = {
  dia:    [{c:5}, {c:10}, {c:17}, {c:27}, {c:40, b:'comum'}],
  semana: [{c:27}, {c:55, b:'comum'}, {c:100, b:'raro'}, {c:165, b:'epico'}, {c:265, b:'lendario'}],
  mes:    [{c:100}, {c:200, b:'raro'}, {c:335, b:'epico'}, {c:550, b:'lendario'}, {c:850, b:'espectral'}]
};
const PASSE_PRECO = 75, PASSE_PRECO_PREMIUM = 100, PASSE_NIVEL_MOEDAS = 165, PASSE_NIVEIS = 100, PASSE_BONUS_XP = 500, PASSE_BONUS_MAX = 20;
const PASSE_DUP_MOEDAS = 650, PASSE_AB_MOEDAS = 85;
const PASSE_TEMPORADAS = [
  {id:'t1', chave:'pass_temp_t1', ini: Date.parse('2026-10-01T00:00:00-03:00'), fim: Date.parse('2026-12-01T00:00:00-03:00')}
];
function passeXpDoNivel(n){ return Math.round((90 + 1.8 * n) / 5) * 5; }
const PASSE_ITENS_G = {
  3:['nome:hl_laranja'], 12:['pers:chapeu_abobora'], 22:['fundo:pz_brasas'], 30:['nome:pz2_dragao'], 40:['pers:chapeu_louros'], 50:['fundo:pz2_coral'], 58:['nome:pz_ferrugem'],
  66:['fundo:hl_plantacao'], 76:['entrada:pz_faisca'], 82:['entrada:hl_aboboras'], 92:['pers:costas_dragao']
};
const PASSE_ITENS_P = {
  10:['fundo:pz_vitral'], 15:['nome:pz2_relampago'], 20:['pers:aces_visor'], 25:['entrada:pz2_dragao'], 28:['fundo:hl_castelo'], 33:['fundo:pz2_dragao'], 35:['fundo:pz_cidade'], 40:['fundo:oceanoprof'],
  45:['nome:pz_holo'], 50:['pers:olhos_eclipse'], 55:['pers:olhos_runa'], 60:['pers:cor_ouro'], 65:['fundo:pz_cristal'],
  68:['nome:hl_assombrado'], 70:['nome:solarflare'], 75:['entrada:pz_trovao'], 80:['nome:pz_eclipse'], 84:['entrada:hl_desfile'],
  86:['pers:chapeu_aureolasol'], 90:['pers:chapeu_coroareal'], 94:['fundo:hl_assombrada'], 96:['entrada:pz_portal'], 97:['nome:dia_cosmico'],
  100:['fundo:pz_supernova']
};
const PASSE_ITENS_X = {
  5:['nome:dia_cristal'], 9:['pers:cab_raio'], 12:['pers:cor_safira'], 18:['fundo:dia_aurora'], 21:['fundo:pz2_relampago'], 24:['nome:dia_solar'], 30:['entrada:dia_chuva'],
  39:['entrada:pz2_tempestade'], 57:['nome:pz2_campeao'], 75:['entrada:pz2_coroacao'], 92:['pers:camisa_campeao'],
  36:['pers:costas_imperial'], 42:['fundo:dia_ouro'], 48:['nome:dia_imperial'], 54:['entrada:dia_prisma'], 60:['pers:pele_cosmica'],
  66:['fundo:dia_reino'], 72:['nome:dia_infinito'], 80:['entrada:dia_fenix'], 88:['fundo:dia_lavadourada'], 95:['entrada:dia_oceano'],
  100:['fundo:dia_universo', 'entrada:dia_infinito']
};
let _passeTab = null;
function passeTabela(){
  if(_passeTab) return _passeTab;
  const g = [null], p = [null], b = [null];
  const bauG = {5:'comum', 15:'comum', 25:'comum', 35:'raro', 45:'raro', 55:'raro', 65:'epico', 75:'epico', 85:'epico', 95:'lendario'};
  const diaG = {10:2, 20:2, 30:3, 40:3, 50:4, 60:4, 70:5, 80:5, 90:3, 100:5};      // 36 no total: a trilha grátis paga o passe lá pelo nível 80
  const bauP = {5:'raro', 10:'raro', 15:'raro', 20:'raro', 25:'raro', 30:'epico', 35:'epico', 40:'epico', 45:'epico', 50:'epico',
                55:'epico', 60:'lendario', 65:'epico', 70:'lendario', 75:'epico', 80:'lendario', 85:'epico', 90:'lendario', 95:'epico', 100:'espectral'};
  const diaP = {15:2, 30:3, 45:3, 60:4, 75:4, 90:5, 100:5};                          // 26 no total: o passe praticamente se paga
  for(let n = 1; n <= PASSE_NIVEIS; n++){
    const rg = {c: Math.round((40 + 4 * n) / 15) * 5};
    if(bauG[n]) rg.b = bauG[n];
    if(diaG[n]) rg.d = diaG[n];
    if(n % 10 === 7) rg.a = 2 + Math.floor(n / 10);
    if(PASSE_ITENS_G[n]) rg.i = PASSE_ITENS_G[n].slice();
    if(n === 100){ rg.b = 'lendario'; rg.c = 650; }
    g.push(rg);
    const rp = {c: Math.round((80 + 8 * n) / 15) * 5};
    if(bauP[n]) rp.b = bauP[n];
    if(diaP[n]) rp.d = diaP[n];
    if(n % 10 === 3) rp.a = 3 + Math.floor(n / 10);
    if(PASSE_ITENS_P[n]) rp.i = PASSE_ITENS_P[n].slice();
    if(n === 100) rp.c = 1650;
    p.push(rp);
  }
  const x = [null];
  const diaX = {20:3, 40:4, 60:4, 80:5, 100:8};
  for(let n = 1; n <= PASSE_NIVEIS; n++){
    const rx = {c: Math.round((150 + 15 * n) / 15) * 5};
    if(n % 5 === 0) rx.b = n % 50 === 0 ? 'espectral' : n % 10 === 0 ? 'lendario' : 'epico';
    if(diaX[n]) rx.d = diaX[n];
    if(n % 10 === 5) rx.a = 4 + Math.floor(n / 10);
    if(PASSE_ITENS_X[n]) rx.i = PASSE_ITENS_X[n].slice();
    if(n === 100) rx.c = 2700;
    x.push(rx);
  }
  for(let i = 1; i <= PASSE_BONUS_MAX; i++){
    const r = {}, k = i % 5;
    if(k === 1) r.c = 500; else if(k === 2) r.b = 'raro'; else if(k === 3) r.c = 850; else if(k === 4) r.b = 'epico'; else r.d = 2;
    if(i === PASSE_BONUS_MAX){ r.b = 'espectral'; r.d = 3; }
    b.push(r);
  }
  _passeTab = {g, p, x, b};
  return _passeTab;
}
const NIVEL_CUSTO_TETO = 5000;
function nivelCusto(n){ return n <= 100 ? 100 + 25 * (n - 2) : Math.min(NIVEL_CUSTO_TETO, 2550 + 5 * (n - 100)); }
/* o prêmio de cada nível (sem a classe e os títulos, que não são moeda) */
function nivelPremio(n){
  const p = {c: n <= 100 ? Math.round((100 + 25 * n) / 15) * 5 : Math.min(1665, Math.round((2600 + 20 * Math.floor((n - 100) / 10)) / 15) * 5)};
  if(n % 5 === 0) p.b = n % 100 === 0 ? 'espectral' : n % 50 === 0 ? 'lendario' : n % 25 === 0 ? 'epico' : n % 10 === 0 ? 'raro' : 'comum';
  if(n % 10 === 0) p.d = n % 100 === 0 ? 10 : Math.min(5, n / 10);
  return p;
}
var SEQ_PROT_PRECO = 3;
var SEQ_MOEDAS = [0, 50, 85, 135, 0, 235, 335, 0];
var SEQ_MULT = [1, 1.5, 2, 2.5, 3];
var SEQ_BAU4 = ['comum', 'raro', 'raro', 'epico', 'epico'];
var SEQ_BAU7 = [['raro', 1], ['epico', 1], ['epico', 2], ['lendario', 2], ['lendario', 3]];
function seqSemana(n){ return Math.min(4, Math.floor((Math.max(1, n) - 1) / 7)); }
function seqPremio(n){
  n = Math.max(1, Math.floor(n));
  const dia = ((n - 1) % 7) + 1, sem = seqSemana(n);
  const p = {xp: 20 + 5 * dia};
  if(dia === 4) p.b = SEQ_BAU4[sem];
  else if(dia === 7){ p.b = SEQ_BAU7[sem][0]; p.d = SEQ_BAU7[sem][1]; }
  else p.c = Math.round(SEQ_MOEDAS[dia] * SEQ_MULT[sem] / 5) * 5;
  return p;
}
var ROLETA_FATIAS = [
  {p:{c:65},        w:22},
  {p:{b:'comum'},   w:12},
  {p:{c:135},       w:17},
  {p:{d:1},         w:5},
  {p:{c:250},       w:12},
  {p:{xp:150},      w:9},
  {p:{c:500},       w:8},
  {p:{b:'raro'},    w:7},
  {p:{c:1000},      w:5},
  {p:{d:5},         w:1}
];
const BAUS = {
  comum:     {extras:[[0,85],[1,15]],        moedas:[[70,130,10,1]],
              tabela:[{k:'m2', p:1, min:10}]},
  raro:      {extras:[[0,65],[1,35]],        moedas:[[200,400,25,1]],
              tabela:[{k:'m2', p:78, min:15}, {k:'m3', p:22, min:5}]},
  epico:     {extras:[[0,35],[1,55],[2,10]], moedas:[[500,1000,50,1]],
              tabela:[{k:'m2', p:63, min:30}, {k:'m3', p:37, min:10}]},
  lendario:  {extras:[[0,25],[1,60],[2,15]], moedas:[[1300,3000,100,1]],              // o Lendário NÃO dá diamante
              tabela:[{k:'m2', p:20, min:60}, {k:'m3', p:14, min:20}]},
  /* o Espectral quase nunca dá diamante: o normal é não vir nenhum.
     dia = [quantos diamantes, chance em % ] : 1 → 10% · 2 → 3% · 3 → 1% · 4 → 0,3% · 5 → 0,05% (o resto, 85,65%, é nenhum) */
  espectral: {extras:[[1,60],[2,40]],        moedas:[[3300,5000,100,72],[5300,8300,100,22],[13300,13300,100,6]],
              dia:[[0,85.65],[1,10],[2,3],[3,1],[4,0.3],[5,0.05]],
              tabela:[{k:'m3', p:16, min:60}, {k:'m2', p:10, min:120}]}
};
const BAU_PRECOS = {
  comum:     {c:400,   d:1},
  raro:      {c:1150,  d:1},
  epico:     {c:3000,  d:1},
  lendario:  {c:8700,  d:2},
  espectral: {c:28000, d:5}
};
var BAU_GRATIS_MS = 4 * 3600000;
const KSHOP_PRECO = 6600, KSHOP_MAX = 1000;
const KSHOP_OFERTAS = [
  {dia:5,  moedas:30000},
  {dia:15, moedas:83000},
  {dia:30, moedas:153000},
  {dia:60, moedas:280000}
];
const KSHOP_VENDA = [{de:30, taxa:4600}, {de:10, taxa:4300}, {de:1, taxa:4000}];
function kshopTaxaVenda(n){
  for(const f of KSHOP_VENDA) if(n >= f.de) return f.taxa;
  return KSHOP_VENDA[KSHOP_VENDA.length - 1].taxa;
}
var REL_DIA_QTD = 10, REL_DIA_PRECO = 46500, REL_AB_QTD = 40, REL_AB_PRECO = 9200;
var HL_AB_PRECO_MOEDAS = 330, HL_AB_POR_DIAMANTE = 20, HL_AB_MAX = 5000;
var HL_MS_PREMIO = [{a:1}, {a:2}, {a:4}];
var HL_REP_FATOR_MAX = 4;   /* o repetido mais valioso (mítico) vale preço do baú x 4 */
var EV_BAUS = {
  hl_abobora:    {preco:3,  itens:[['nome','hl_laranja'],    ['pers','chapeu_abobora'],  ['fundo','hl_plantacao'], ['nome','hl_lanterna'],  ['entrada','hl_aboboras']]},
  hl_morcego:    {preco:6,  itens:[['pers','boca_presas'],   ['nome','hl_morcego'],     ['pers','costas_morcego'],     ['fundo','hl_lua'],       ['entrada','hl_revoada']]},
  hl_bruxa:      {preco:12, itens:[['nome','hl_pocao'],      ['fundo','hl_caldeirao'],  ['pers','chapeu_bruxa'],  ['entrada','hl_voo'],     ['fundo','hl_noitebruxas']]},
  hl_vampiro:    {preco:25, itens:[['fundo','hl_carmesim'],  ['pers','costas_vampiro'],     ['nome','hl_vampiro'],     ['pers','olhos_eclipse'], ['fundo','hl_castelo']]},
  hl_assombrado: {preco:50, itens:[['nome','hl_assombrado'], ['pers','pele_zumbi'],['fundo','hl_cemiterio'], ['entrada','hl_desfile'], ['fundo','hl_assombrada']]}
};
Object.assign(EV_BAUS, {
  xm_biscoito: {preco:3,  itens:[['nome','xm_gengibre'],  ['pers','chapeu_noel'],    ['fundo','xm_biscoitos'], ['nome','xm_canela'],    ['entrada','xm_migalhas']]},
  xm_rena:     {preco:6,  itens:[['pers','chapeu_rena'],   ['nome','xm_rudolf'],     ['fundo','xm_floresta'],  ['entrada','xm_sinos'],  ['fundo','xm_aurora']]},
  xm_boneco:   {preco:12, itens:[['nome','xm_gelo'],      ['fundo','xm_nevasca'],   ['pers','aces_cachecol'], ['entrada','xm_flocos'], ['nome','xm_inverno']]},
  xm_treno:    {preco:25, itens:[['fundo','xm_luzes'],    ['pers','chapeu_azevinho'],['nome','xm_estrela'],  ['pers','camisa_sueter'],  ['fundo','xm_noite']]},
  xm_noel:     {preco:50, itens:[['nome','xm_noel'],      ['pers','estampa_floco'],['entrada','xm_presentes'], ['fundo','xm_lareira'], ['pers','costas_cristal']]},
  fv_picole:   {preco:3,  itens:[['nome','fv_morango'],   ['pers','chapeu_flores'], ['fundo','fv_sorveteria'],['nome','fv_tutti'],    ['entrada','fv_confeitos']]},
  fv_coqueiro: {preco:6,  itens:[['pers','chapeu_palha'], ['nome','fv_coco'],       ['fundo','fv_praia'],     ['entrada','fv_hibisco'],['fundo','fv_por']]},
  fv_surfe:    {preco:12, itens:[['nome','fv_onda'],      ['fundo','fv_mar'],       ['pers','camisa_havaiana'],  ['entrada','fv_splash'], ['nome','fv_neon']]},
  fv_tubarao:  {preco:25, itens:[['pers','aces_mergulho'],  ['nome','fv_abissal'],    ['entrada','fv_cardume'], ['pers','chapeu_tubarao'],['fundo','fv_fundo']]},
  fv_tesouro:  {preco:50, itens:[['nome','fv_ouro'],      ['fundo','fv_ilha'],      ['pers','costas_prancha'], ['entrada','fv_moedas'], ['fundo','fv_fogos']]}
});
const PREMIO_ENVIO = 100, PREMIO_ENVIO_MAX = 10, PREMIO_TEMPO = 100, PREMIO_TEMPO_SEG = 1800;
const COMPARTILHAR_PREMIO = 1000, COMPARTILHAR_MAX = 10, CONVITE_SEG_ALVO = 1800;
const FONTE_POR_DIA = 3, CRIADOR_MOEDAS = 3;
var UGC_PRECO_MAX = 3300, UGC_PARTE_CRIADOR = 0.7, UGC_PRECO_MAX_DIA = 100;
const LOJA_MAX_C = 100000, LOJA_MAX_D = 50;
const GIFT_MAX_MOEDAS = 1000000, GIFT_MAX_AB = 1000;

/* ================= O QUE O SERVIDOR CALCULA DAS TABELAS ================= */
export const MOEDAS = ['c', 'd', 'a'];
/* o máximo que cada baú pode dar (o sorteio é do site; o servidor só garante que não passou disso) */
export const BAU_MAX = (()=>{
  const o = {};
  for (const t of Object.keys(BAUS)) {
    const b = BAUS[t];
    o[t] = { c: Math.max(...b.moedas.map(f => f[1])), d: b.dia ? 5 : 0 };
  }
  return o;
})();
/* quanto vale cada coisa em moedas, pra conferir trocas (comprar diamante, dar presente pagando com outra moeda...).
   O diamante vale 4.650: o melhor pacote sai a 4.666 cada e a venda paga no máximo 4.600, então comprar e vender
   nunca dá lucro. A abóbora vale o preço dela (330). */
const VALOR = { c: 1, d: 4650, a: HL_AB_PRECO_MOEDAS };
const valorDe = o => (o.c || 0) * VALOR.c + (o.d || 0) * VALOR.d + (o.a || 0) * VALOR.a;

/* folga dos tetos do dia: o dia do servidor (Brasília) e o do aparelho nem sempre são o mesmo, e o turbo de baú
   (até 3x) multiplica o que as partidas pagam */
const MARGEM = 1.5, TURBO_MAX = 3;
/* XP por dia que um jogador de verdade consegue no máximo (tempo jogado, partidas, missões, roleta, sequência...).
   Serve pra frear quem inventa XP pra pegar níveis e o Koda GB Pass de uma vez. */
export const XP_NIVEL_DIA = 15000, XP_PASSE_DIA = 15000;
/* o que entra pelo motivo "outro" (algum ganho pequeno do site que não tem motivo próprio) */
const OUTRO_DIA = { c: 300, d: 2, a: 20 };

export function temporada(id) { return PASSE_TEMPORADAS.find(s => s.id === id) || null; }
export function passeRecompensa(tr, n) {
  const l = passeTabela()[tr];
  return (l && n >= 1 && n < l.length) ? l[n] : null;
}
const PASSE_ACUM = (()=>{ const a = [0]; for (let n = 1; n <= PASSE_NIVEIS; n++) a.push(a[n - 1] + passeXpDoNivel(n)); return a; })();
export function passeNivelDe(xp) {
  let n = 0;
  while (n < PASSE_NIVEIS && xp >= PASSE_ACUM[n + 1]) n++;
  return n;
}
export { PASSE_ACUM, CONVITE_SEG_ALVO, COMPARTILHAR_PREMIO, COMPARTILHAR_MAX, PREMIO_ENVIO_MAX, BAU_GRATIS_MS,
  passeTabela, nivelPremio, nivelCusto, seqPremio, ROLETA_FATIAS, BAUS, BAU_PRECOS, MS_RECOMPENSA, MS_RECOMPENSA_ANT,
  COIN_RULES, KSHOP_OFERTAS, EV_BAUS, PASSE_TEMPORADAS };

/* ================= O MOVIMENTO =================
   tx = { id, m: motivo, q: {detalhes}, mv: [ {k:'c'|'d'|'a', n: +ganho/-gasto, s?: 'bau', q?: {t: tipo do baú, i: qual baú}} ] } */
export function normalizarTx(tx) {
  tx = obj(tx);
  if (!tx || typeof tx.id !== 'string' || !/^[A-Za-z0-9_-]{6,64}$/.test(tx.id)) return null;
  const m = typeof tx.m === 'string' && /^[a-z_]{2,24}$/.test(tx.m) ? tx.m : 'outro';
  const q = obj(tx.q) || {};
  if (JSON.stringify(q).length > 4000) return null;
  const mv = [];
  for (const x of (Array.isArray(tx.mv) ? tx.mv : []).slice(0, 60)) {
    const o = obj(x);
    if (!o || !MOEDAS.includes(o.k)) return null;
    const n = inteiro(o.n, -100000000, 100000000);
    if (n === null || n === 0) continue;
    const s = o.s === 'bau' ? 'bau' : '';
    const sq = obj(o.q) || {};
    mv.push({ k: o.k, n, s, q: s ? { t: String(sq.t || ''), i: inteiro(sq.i, 0, 999) || 0 } : null });
  }
  return { id: tx.id, m, q, mv };
}

/* ================= O CONFERIDOR =================
   C (a conta) dá: e (o estado), saldo, feito(k), uso(k), pote(k), agora, admin.
   Cada regra devolve um texto com o motivo da recusa, ou nada (aceito). Nada é gravado aqui: as mudanças
   ficam anotadas em "ops" e a conta só grava se a regra inteira passar. */
export class Conferencia {
  constructor(tx, C) {
    this.tx = tx; this.q = tx.q; this.C = C; this.e = C.e; this.agora = C.agora;
    this.dk = 'd:' + diaBRT(C.agora);
    this.ops = [];
    this.gastos = { c: 0, d: 0, a: 0 }; this.ganhos = { c: 0, d: 0, a: 0 };
    const baus = new Map();
    for (const x of tx.mv) {
      if (x.n < 0) { this.gastos[x.k] += -x.n; continue; }
      if (x.s === 'bau') {
        const b = baus.get(x.q.i) || { t: x.q.t, c: 0, d: 0, a: 0 };
        if (b.t !== x.q.t) b.t = '?';
        b[x.k] += x.n;
        baus.set(x.q.i, b);
      } else this.ganhos[x.k] += x.n;
    }
    this.baus = [...baus.values()];
    this.efeitos = [];        // mudanças no estado (funções), feitas só no fim
    this.envios = [];         // avisos pra outras contas (presente, venda...)
    this.vistos = new Set();
  }
  get temGanho() { return this.ganhos.c > 0 || this.ganhos.d > 0 || this.ganhos.a > 0 || this.baus.length > 0; }
  /* uma vez só (pra sempre) */
  unico(k) {
    if (this.vistos.has(k) || this.C.feito(k)) return false;
    this.vistos.add(k); this.ops.push({ tipo: 'unico', k });
    return true;
  }
  /* soma num contador e confere o teto */
  uso(k, n, max) {
    if (!(n > 0)) return true;
    const ja = this.C.uso(k) + this.ops.filter(o => o.tipo === 'uso' && o.k === k).reduce((s, o) => s + o.n, 0);
    if (ja + n > max) return false;
    this.ops.push({ tipo: 'uso', k, n });
    return true;
  }
  /* tira de um "pote" (o que outra pessoa pagou pra você, os repetidos do evento...) */
  temNoPote(k) { return this.C.pote(k) + this.ops.filter(o => o.tipo === 'pote' && o.k === k).reduce((s, o) => s + o.n, 0); }
  doPote(k, n) {
    if (!(n > 0)) return true;
    if (this.temNoPote(k) < n) return false;
    this.ops.push({ tipo: 'pote', k, n: -n });
    return true;
  }
  noPote(k, n) { if (n > 0) this.ops.push({ tipo: 'pote', k, n }); }
  mudar(fn) { this.efeitos.push(fn); }
  enviar(para, msg) { this.envios.push({ para, msg }); }
  /* confere os ganhos contra o que a regra deixa: lim = {c, d, a, aOuC, baus:[tipos]} */
  permitir(lim) {
    lim = lim || {};
    const A = lim.a || 0;
    if (this.ganhos.d > (lim.d || 0)) return 'demais_d';
    if (this.ganhos.a > A) return 'demais_a';
    let C = lim.c || 0;
    if (lim.aOuC) C += (A - this.ganhos.a) * PASSE_AB_MOEDAS;      // fora do evento, a abóbora vira moeda
    if (this.ganhos.c > C) return 'demais_c';
    return this.conferirBaus(lim.baus || []);
  }
  conferirBaus(dados) {
    const resto = dados.slice();
    for (const b of this.baus) {
      const i = resto.indexOf(b.t);
      if (i < 0) return 'bau_sem_origem';
      resto.splice(i, 1);
      const max = BAU_MAX[b.t];
      if (!max || b.c > max.c || b.d > max.d || b.a > 0) return 'bau_demais';
    }
    return null;
  }
  so(lista) {          // só pode ter estes tipos de movimento
    if (!lista.includes('gasto') && (this.gastos.c || this.gastos.d || this.gastos.a)) return 'gasto_estranho';
    if (!lista.includes('ganho') && this.temGanho) return 'ganho_estranho';
    return null;
  }
}

/* ---------- ajudantes ---------- */
const passeDe = (e, t) => {
  e.passe = e.passe || {};
  return e.passe[t] || { nv: 0, g: [], p: [], x: [], b: [], nmax: 0, bmax: 0, cred: 0 };
};
const guardarPasse = (e, t, P) => { e.passe = e.passe || {}; e.passe[t] = P; };
const HORAS_12 = 12 * 3600000;

/* ================= AS REGRAS, MOTIVO POR MOTIVO ================= */
export const REGRAS = {
  /* ---- gastos puros (loja, temas, personagem, emotes, carros...) ---- */
  compra(R) { return R.so(['gasto']); },

  /* ---- jogar ---- */
  partida(R) {
    if (R.ganhos.d || R.ganhos.a || R.baus.length) return 'moeda';
    const jogo = jogoOk(R.q.jogo) ? R.q.jogo : '?';
    const regra = coinRuleFor(jogo, !!R.q.pub);
    if (!R.uso(R.dk + ':jogo:' + jogo, R.ganhos.c, Math.ceil(regra.dia * TURBO_MAX * MARGEM))) return 'teto_jogo';
    if (!R.uso(R.dk + ':jogos', R.ganhos.c, Math.ceil(COIN_DIA_GERAL * TURBO_MAX * MARGEM))) return 'teto_dia';
    return R.so(['ganho']);
  },
  acoes(R) {
    if (R.ganhos.d || R.ganhos.a || R.baus.length) return 'moeda';
    const jogo = jogoOk(R.q.jogo) ? R.q.jogo : '?';
    if (!R.uso(R.dk + ':acoes:' + jogo, R.ganhos.c, Math.ceil(ACOES_TETO_DIA * TURBO_MAX * MARGEM))) return 'teto_jogo';
    if (!R.uso(R.dk + ':jogos', R.ganhos.c, Math.ceil(COIN_DIA_GERAL * TURBO_MAX * MARGEM))) return 'teto_dia';
    return R.so(['ganho']);
  },
  fonte(R) {
    if (R.ganhos.c > 1) return 'demais_c';
    if (!R.uso(R.dk + ':fonte', R.ganhos.c, FONTE_POR_DIA * 2)) return 'teto_dia';
    return R.permitir({ c: 1 }) || R.so(['ganho']);
  },

  /* ---- prêmios do convite e do tempo ---- */
  envio(R) {
    const e = R.e;
    if ((e.envio || 0) >= PREMIO_ENVIO_MAX) return 'acabou';
    if (R.agora - (e.envioT || 0) < 3000) return 'rapido';
    R.mudar(e2 => { e2.envio = (e2.envio || 0) + 1; e2.envioT = R.agora; });
    return R.permitir({ c: PREMIO_ENVIO }) || R.so(['ganho']);
  },
  tempo_dia(R) {
    const e = R.e, k = R.q.k;
    if (!chavePlausivel('dia', k, R.agora)) return 'dia';
    if (!R.unico('tp:' + k)) return 'repetido';
    const t = e.tempo || {};
    if ((t.total || 0) + (t.extra || 0) - (t.marco || 0) < PREMIO_TEMPO_SEG - 300) return 'pouco_tempo';
    R.mudar(e2 => { e2.tempo = e2.tempo || {}; e2.tempo.marco = e2.tempo.total || 0; e2.tempo.extra = 0; });
    return R.permitir({ c: PREMIO_TEMPO }) || R.so(['ganho']);
  },
  /* o prêmio do convite é o servidor que paga (ver Conta.receber): o site não pede */

  /* ---- missões ---- */
  missao(R) {
    const p = R.q.p, k = R.q.k;
    if (!['dia', 'semana', 'mes'].includes(p)) return 'periodo';
    if (!chavePlausivel(p, k, R.agora)) return 'periodo_chave';
    const tab = (R.q.ant ? MS_RECOMPENSA_ANT : MS_RECOMPENSA)[p];
    const s = inteiro(R.q.s, 0, tab.length - 1);
    if (s === null) return 'missao';
    if (!R.unico('ms:' + p + ':' + k + ':' + s)) return 'repetido';
    const r = tab[s];
    return R.permitir({ c: r.c || 0, d: r.d || 0, baus: r.b ? [r.b] : [] }) || R.so(['ganho']);
  },
  hl_missao(R) {
    const k = R.q.k, i = inteiro(R.q.i, 0, HL_MS_PREMIO.length - 1);
    if (!chavePlausivel('dia', k, R.agora) || i === null) return 'missao';
    if (!R.unico('hlms:' + k + ':' + i)) return 'repetido';
    return R.permitir({ a: HL_MS_PREMIO[i].a, aOuC: true }) || R.so(['ganho']);
  },

  /* ---- Koda GB Pass ---- */
  passe(R) {
    const t = String(R.q.t || ''), temp = temporada(t);
    if (!temp) return 'temporada';
    if (R.agora > temp.fim + 7 * 86400000) return 'temporada_acabou';
    const lista = Array.isArray(R.q.l) ? R.q.l.slice(0, 160) : [];
    if (!lista.length) return 'vazio';
    const P = JSON.parse(JSON.stringify(passeDe(R.e, t)));
    let c = 0, d = 0, a = 0, nivelPreciso = 0, bonusPreciso = 0;
    const baus = [];
    for (const it of lista) {
      const tr = Array.isArray(it) ? it[0] : null, n = Array.isArray(it) ? inteiro(it[1], 1, 100) : null;
      if (!['g', 'p', 'x', 'b'].includes(tr) || n === null) return 'nivel';
      const r = passeRecompensa(tr, n);
      if (!r) return 'nivel';
      if (P[tr].includes(n)) return 'repetido';
      if (tr === 'p' && P.nv < 1) return 'sem_passe';
      if (tr === 'x' && P.nv < 2) return 'sem_premium';
      P[tr].push(n);
      if (tr === 'b') bonusPreciso = Math.max(bonusPreciso, n); else nivelPreciso = Math.max(nivelPreciso, n);
      c += (r.c || 0) + (r.i || []).length * PASSE_DUP_MOEDAS;
      d += r.d || 0; a += r.a || 0;
      if (r.b) baus.push(r.b);
    }
    if (bonusPreciso > 0) nivelPreciso = PASSE_NIVEIS;
    /* o XP pra chegar nesses níveis: primeiro sai do que a pessoa comprou com moedas, depois do teto do dia */
    let custo = 0;
    for (let n = P.nmax + 1; n <= nivelPreciso; n++) custo += passeXpDoNivel(n);
    if (bonusPreciso > P.bmax) custo += (bonusPreciso - P.bmax) * PASSE_BONUS_XP;
    const doCredito = Math.min(P.cred || 0, custo);
    if (!R.uso(R.dk + ':psxp:' + t, custo - doCredito, XP_PASSE_DIA)) return 'xp_demais';
    P.cred = (P.cred || 0) - doCredito;
    P.nmax = Math.max(P.nmax, nivelPreciso); P.bmax = Math.max(P.bmax, bonusPreciso);
    R.mudar(e2 => guardarPasse(e2, t, P));
    return R.permitir({ c, d, a, aOuC: true, baus }) || R.so(['ganho']);
  },
  passe_compra(R) {
    const t = String(R.q.t || ''), temp = temporada(t);
    if (!temp || R.agora < temp.ini - 86400000 || R.agora > temp.fim) return 'temporada';
    const alvo = R.q.plano === 'premium' ? 2 : 1;
    const P = passeDe(R.e, t);
    const custo = alvo === 2 ? (P.nv >= 1 ? PASSE_PRECO_PREMIUM - PASSE_PRECO : PASSE_PRECO_PREMIUM) : PASSE_PRECO;
    if (P.nv < alvo && R.gastos.d < custo && !R.C.admin) return 'pagou_pouco';
    R.mudar(e2 => { const P2 = passeDe(e2, t); P2.nv = Math.max(P2.nv, alvo); guardarPasse(e2, t, P2); });
    return R.so(['gasto']);
  },
  passe_nivel(R) {
    const t = String(R.q.t || '');
    if (!temporada(t)) return 'temporada';
    if (R.gastos.c < PASSE_NIVEL_MOEDAS && !R.C.admin) return 'pagou_pouco';
    R.mudar(e2 => { const P2 = passeDe(e2, t); P2.cred = (P2.cred || 0) + (P2.nmax >= PASSE_NIVEIS ? PASSE_BONUS_XP : 280); guardarPasse(e2, t, P2); });
    return R.so(['gasto']);
  },

  /* ---- nível do jogador (os prêmios caem sozinhos ao subir) ---- */
  nivel(R) {
    const ns = Array.isArray(R.q.n) ? R.q.n.slice(0, 400).map(x => inteiro(x, 2, 2000000000)) : [];
    if (!ns.length || ns.some(x => x === null)) return 'nivel';
    const pago = R.e.nivel && R.e.nivel.pago || 1;
    if (ns[0] <= pago) return 'repetido';
    if (ns[0] !== pago + 1) return 'pulou';
    for (let i = 1; i < ns.length; i++) if (ns[i] !== ns[i - 1] + 1) return 'pulou';
    let custo = 0, c = 0, d = 0;
    const baus = [];
    for (const n of ns) {
      custo += nivelCusto(n);
      const p = nivelPremio(n);
      c += p.c || 0; d += p.d || 0;
      if (p.b) baus.push(p.b);
    }
    if (!R.uso(R.dk + ':nvxp', custo, XP_NIVEL_DIA)) return 'xp_demais';
    const fim = ns[ns.length - 1];
    R.mudar(e2 => { e2.nivel = e2.nivel || {}; e2.nivel.pago = fim; });
    return R.permitir({ c, d, baus }) || R.so(['ganho']);
  },

  /* ---- rotina: sequência de dias, roleta, baú grátis, oferta relâmpago ---- */
  seq(R) {
    const n = inteiro(R.q.n, 1, 100000), k = R.q.k;
    if (n === null || !chavePlausivel('dia', k, R.agora)) return 'seq';
    const s = R.e.seq || { n: 0, t: 0 };
    if (R.agora - (s.t || 0) < HORAS_12) return 'cedo';
    if (n !== 1 && n > (s.n || 0) + 1) return 'pulou';
    if (!R.unico('sq:' + k)) return 'repetido';
    R.mudar(e2 => { e2.seq = { n, t: R.agora }; });
    const p = seqPremio(n);
    return R.permitir({ c: p.c || 0, d: p.d || 0, baus: p.b ? [p.b] : [] }) || R.so(['ganho']);
  },
  seq_protetor(R) { return R.so(['gasto']); },
  roleta(R) {
    const k = R.q.k, i = inteiro(R.q.i, 0, ROLETA_FATIAS.length - 1);
    if (i === null || !chavePlausivel('dia', k, R.agora)) return 'roleta';
    const r = R.e.rol || { t: 0 };
    if (R.agora - (r.t || 0) < HORAS_12) return 'cedo';
    if (!R.unico('rl:' + k)) return 'repetido';
    R.mudar(e2 => { e2.rol = { t: R.agora }; });
    const p = ROLETA_FATIAS[i].p;
    const a = i === 5 ? 5 : 0;           // durante um evento, a fatia do XP vira 5 da moeda do evento
    return R.permitir({ c: p.c || 0, d: p.d || 0, a, aOuC: true, baus: p.b ? [p.b] : [] }) || R.so(['ganho']);
  },
  bau_gratis(R) {
    const t = R.q.t === 'raro' ? 'raro' : 'comum';
    const b = R.e.bauG || { n: 0, t: 0 };
    if (R.agora - (b.t || 0) < BAU_GRATIS_MS - 15 * 60000) return 'cedo';
    if (t === 'raro' && ((b.n || 0) + 1) % 5 !== 0) return 'nao_e_raro';
    R.mudar(e2 => { e2.bauG = { n: (b.n || 0) + 1, t: R.agora }; });
    return R.permitir({ baus: [t] }) || R.so(['ganho']);
  },
  bau_compra(R) {
    const t = R.q.t, moeda = R.q.moeda === 'd' ? 'd' : 'c';
    if (!BAU_PRECOS[t]) return 'bau';
    if (R.gastos[moeda] < BAU_PRECOS[t][moeda] && !R.C.admin) return 'pagou_pouco';
    return R.permitir({ baus: [t] });
  },
  rel(R) {
    const k = R.q.k, tipo = R.q.tipo;
    if (!chavePlausivel('dia', k, R.agora)) return 'dia';
    if (!R.unico('rel:' + k)) return 'repetido';
    const adm = R.C.admin;
    if (tipo === 'dia') {
      if (R.gastos.c < REL_DIA_PRECO && !adm) return 'pagou_pouco';
      return R.permitir({ d: REL_DIA_QTD });
    }
    if (tipo === 'bau') {
      const b = R.q.b === 'lendario' ? 'lendario' : 'epico';
      if (R.gastos.c < Math.round(BAU_PRECOS[b].c * 0.5 / 10) * 10 && !adm) return 'pagou_pouco';
      return R.permitir({ baus: [b] });
    }
    if (tipo === 'ab') {
      if (R.gastos.c < REL_AB_PRECO && !adm) return 'pagou_pouco';
      return R.permitir({ a: REL_AB_QTD, aOuC: true });
    }
    return R.so(['gasto']);           // item da loja pela metade: só paga
  },

  /* ---- Koda GB shop: trocas ---- */
  kshop(R) {
    const adm = R.C.admin;
    if (R.q.op === 'venda') {
      const n = R.gastos.d;
      if (!(n >= 1 && n <= KSHOP_MAX)) return 'qtd';
      if (R.ganhos.c > n * kshopTaxaVenda(n)) return 'demais_c';
      if (R.ganhos.d || R.ganhos.a || R.baus.length || R.gastos.c || R.gastos.a) return 'troca';
      return null;
    }
    const n = R.ganhos.d;
    if (!(n >= 1 && n <= KSHOP_MAX)) return 'qtd';
    const oferta = R.q.oferta ? KSHOP_OFERTAS.find(o => o.dia === n) : null;
    const preco = oferta ? oferta.moedas : n * KSHOP_PRECO;
    if (R.gastos.c < preco && !adm) return 'pagou_pouco';
    if (R.ganhos.c || R.ganhos.a || R.baus.length || R.gastos.d || R.gastos.a) return 'troca';
    return null;
  },

  /* ---- evento (abóboras) ---- */
  hl_compra(R) {
    const n = R.ganhos.a, adm = R.C.admin;
    if (!(n >= 1 && n <= HL_AB_MAX)) return 'qtd';
    if (R.q.moeda === 'd') { if (R.gastos.d * HL_AB_POR_DIAMANTE < n && !adm) return 'pagou_pouco'; }
    else if (R.gastos.c < n * HL_AB_PRECO_MOEDAS && !adm) return 'pagou_pouco';
    if (R.ganhos.c || R.ganhos.d || R.baus.length) return 'troca';
    return null;
  },
  hl_bau(R) {
    const b = EV_BAUS[R.q.bau];
    if (!b) return 'bau';
    if (R.gastos.a < b.preco && !R.C.admin) return 'pagou_pouco';
    R.noPote('hlrep', b.preco * HL_REP_FATOR_MAX);          // o repetido que sair daqui pode virar abóbora depois
    return R.so(['gasto']);
  },
  hl_rep(R) {
    if (R.gastos.c || R.gastos.d || R.gastos.a || R.ganhos.d || R.baus.length) return 'troca';
    const usaA = R.ganhos.a, usaC = Math.ceil(R.ganhos.c / PASSE_AB_MOEDAS);   // fora do evento o repetido vira moeda
    if (!R.doPote('hlrep', usaA + usaC)) return 'sem_repetido';
    return null;
  },
  hl_fim(R) {          // o evento acabou: abóboras e repetidos que sobraram viram moedas
    if (R.ganhos.d || R.ganhos.a || R.baus.length || R.gastos.c || R.gastos.d) return 'troca';
    const rep = R.temNoPote('hlrep');
    const max = (R.gastos.a + rep) * PASSE_AB_MOEDAS;
    if (R.ganhos.c > max) return 'demais_c';
    const precisaRep = Math.max(0, Math.ceil(R.ganhos.c / PASSE_AB_MOEDAS) - R.gastos.a);
    if (!R.doPote('hlrep', precisaRep)) return 'sem_repetido';
    return null;
  },

  /* ---- presentes (quem dá paga; o servidor guarda pra quem recebe) ---- */
  presente(R) {
    const para = limpaEmail(R.q.para);
    if (!emailOk(para) || para === R.C.email) return 'pessoa';
    if (R.ganhos.c || R.ganhos.d || R.ganhos.a || R.baus.length) return 'ganho_estranho';
    const v = obj(R.q.v), adm = R.C.admin;
    const pagou = valorDe(R.gastos);
    let k = null, n = 0, vale = 0;
    if (v) {
      if (v.tipo === 'moedas') { n = inteiro(v.n, 1, GIFT_MAX_MOEDAS); k = 'pr:c'; vale = n; }
      else if (v.tipo === 'diamantes') { n = inteiro(v.n, 1, KSHOP_MAX); k = 'pr:d'; vale = n * VALOR.d; }
      else if (v.tipo === 'aboboras') { n = inteiro(v.n, 1, GIFT_MAX_AB); k = 'pr:a'; vale = n * VALOR.a; }
      else if (v.tipo === 'bau' && BAU_PRECOS[v.bau]) { n = 1; k = 'pr:bau:' + v.bau; vale = v.moeda === 'd' ? BAU_PRECOS[v.bau].d * VALOR.d : BAU_PRECOS[v.bau].c; }
      else if (v.tipo === 'passe') { n = 1; const pl = v.plano === 'premium' ? 'premium' : 'super'; k = 'pr:passe:' + pl; vale = (pl === 'premium' ? PASSE_PRECO_PREMIUM : PASSE_PRECO) * VALOR.d; }
      if (!k || !n) return 'valor';
      if (pagou < vale * 0.98 && !adm) return 'pagou_pouco';
    } else if (R.q.exclusivo) {
      /* item exclusivo (evento / Pass): quem dá entrega o dele, sem pagar. Quem já tinha recebe um valor pequeno. */
      if (!R.uso(R.dk + ':pr_excl', 1, 5)) return 'teto_dia';
      k = 'pr:dup'; n = 1;
    } else {
      const moeda = R.q.moeda === 'd' ? 'd' : 'c';
      n = inteiro(R.q.preco, 1, moeda === 'd' ? 5000 : 10000000);
      if (!n) return 'valor';
      if (R.gastos[moeda] < n && !adm) return 'pagou_pouco';
      k = 'pr:' + moeda;
    }
    R.enviar(para, { tipo: 'pote', k, n, de: R.C.email });
    return null;
  },
  presente_receber(R) {
    if (R.gastos.c || R.gastos.d || R.gastos.a) return 'gasto_estranho';
    const lim = { c: 0, d: 0, a: 0, baus: [] };
    /* baú de presente */
    if (R.q.bau) {
      if (!BAU_PRECOS[R.q.bau]) return 'bau';
      if (!R.doPote('pr:bau:' + R.q.bau, 1)) return 'sem_presente';
      lim.baus.push(R.q.bau);
    }
    /* passe de presente */
    if (R.q.plano) {
      const pl = R.q.plano === 'premium' ? 'premium' : 'super', alvo = pl === 'premium' ? 2 : 1;
      if (!R.doPote('pr:passe:' + pl, 1)) return 'sem_presente';
      const t = String(R.q.t || '');
      const P = temporada(t) ? passeDe(R.e, t) : null;
      if (!P || P.nv >= alvo) lim.d += pl === 'premium' ? PASSE_PRECO_PREMIUM : PASSE_PRECO;   // já tinha: os diamantes voltam
      else {
        if (P.nv >= 1 && alvo === 2) lim.d += PASSE_PRECO;
        R.mudar(e2 => { const P2 = passeDe(e2, t); P2.nv = Math.max(P2.nv, alvo); guardarPasse(e2, t, P2); });
      }
    }
    /* moedas, diamantes e abóboras: do que pagaram pra você */
    const usar = (k, quanto) => { const n = Math.min(quanto, R.temNoPote(k)); if (n > 0) R.doPote(k, n); return n; };
    let falta = { c: R.ganhos.c, d: Math.max(0, R.ganhos.d - lim.d), a: R.ganhos.a };
    falta.c -= usar('pr:c', falta.c); falta.d -= usar('pr:d', falta.d); falta.a -= usar('pr:a', falta.a);
    /* abóbora de presente fora do evento chega como moeda */
    if (falta.c > 0) { const abs = usar('pr:a', Math.ceil(falta.c / PASSE_AB_MOEDAS)); falta.c = Math.max(0, falta.c - abs * PASSE_AB_MOEDAS); }
    /* item exclusivo que a pessoa já tinha: até 650 moedas (ou abóboras) por presente */
    if (falta.c > 0) { const u = usar('pr:dup', Math.ceil(falta.c / PASSE_DUP_MOEDAS)); falta.c = Math.max(0, falta.c - u * PASSE_DUP_MOEDAS); }
    if (falta.a > 0) { const u = usar('pr:dup', Math.ceil(falta.a / 200)); falta.a = Math.max(0, falta.a - u * 200); }
    if (falta.c > 0 || falta.d > 0 || falta.a > 0) return 'sem_presente';
    return R.conferirBaus(lim.baus);
  },

  /* ---- roupas criadas pela comunidade (o criador recebe 70%) ---- */
  ugc_compra(R) {
    if (R.ganhos.c || R.ganhos.d || R.ganhos.a || R.baus.length) return 'ganho_estranho';
    const para = String(R.q.para || '');
    if (!uidOk(para) || para === R.C.uid) return null;          // sem criador (ou a própria peça): só paga
    const moeda = R.gastos.d > 0 ? 'd' : 'c', preco = R.gastos[moeda];
    if (!(preco > 0)) return null;
    if (preco > (moeda === 'd' ? UGC_PRECO_MAX_DIA : 10000)) return 'preco';
    const parte = moeda === 'd' ? Math.max(1, Math.floor(preco * UGC_PARTE_CRIADOR)) : Math.floor(preco * UGC_PARTE_CRIADOR);
    R.enviar({ uid: para }, { tipo: 'pote', k: 'ugc:' + moeda, n: parte, de: R.C.email });
    return null;
  },
  ugc_venda(R) {
    if (R.gastos.c || R.gastos.d || R.gastos.a || R.ganhos.a || R.baus.length) return 'troca';
    if (!R.doPote('ugc:c', R.ganhos.c)) return 'sem_venda';
    if (!R.doPote('ugc:d', R.ganhos.d)) return 'sem_venda';
    return null;
  },
  /* ---- loja dentro dos jogos (o criador recebe o que os jogadores gastam) ---- */
  loja_jogo(R) {
    if (R.ganhos.c || R.ganhos.d || R.ganhos.a || R.baus.length) return 'ganho_estranho';
    const para = limpaEmail(R.q.para);
    const moeda = R.gastos.d > 0 ? 'd' : 'c', preco = R.gastos[moeda];
    if (emailOk(para) && para !== R.C.email && preco > 0 && preco <= (moeda === 'd' ? LOJA_MAX_D : LOJA_MAX_C) && R.q.vende)
      R.enviar(para, { tipo: 'pote', k: 'vj:' + moeda, n: preco, de: R.C.email });
    return null;
  },
  venda_jogo(R) {
    if (R.gastos.c || R.gastos.d || R.gastos.a || R.ganhos.a || R.baus.length) return 'troca';
    if (!R.doPote('vj:c', R.ganhos.c)) return 'sem_venda';
    if (!R.doPote('vj:d', R.ganhos.d)) return 'sem_venda';
    return null;
  },
  /* ---- moedas do criador: 3 por curtida, salvo, comentário e visita ---- */
  criador(R) {
    if (R.ganhos.c % CRIADOR_MOEDAS !== 0) return 'valor';
    if (!R.uso(R.dk + ':criador', R.ganhos.c, 3000)) return 'teto_dia';
    return R.permitir({ c: R.ganhos.c }) || R.so(['ganho']);
  },
  /* ---- devoluções de uma vez só (molduras antigas, personagem antigo) ---- */
  reembolso(R) {
    const k = R.q.k === 'personagem' ? 'personagem' : R.q.k === 'molduras' ? 'molduras' : null;
    if (!k) return 'tipo';
    if (!R.unico('rb:' + k)) return 'repetido';
    return R.permitir({ c: 60000, d: 300 }) || R.so(['ganho']);
  },
  /* ---- o resto: um pouquinho por dia ---- */
  outro(R) {
    if (R.baus.length) return 'bau_sem_origem';
    for (const k of MOEDAS) if (!R.uso(R.dk + ':outro:' + k, R.ganhos[k], OUTRO_DIA[k])) return 'teto_outro';
    return null;
  }
};

/* confere um movimento inteiro: devolve {ok, por, R} */
export function conferir(tx, C) {
  const R = new Conferencia(tx, C);
  for (const k of MOEDAS) if (R.gastos[k] > (C.saldo[k] || 0)) return { ok: false, por: 'saldo', R };
  const regra = REGRAS[tx.m] || REGRAS.outro;
  const por = regra(R);
  if (C.admin) return { ok: true, R };                     // o dono do site testa à vontade (mas o presente dele chega)
  return por ? { ok: false, por, R } : { ok: true, R };
}

/* pro teste que compara as tabelas daqui com as do site (testes/tabelas.mjs) */
export const TABELAS = {
  COIN_DIA_GERAL, ACOES_TETO_DIA, PASSE_PRECO, PASSE_PRECO_PREMIUM, PASSE_NIVEL_MOEDAS, PASSE_NIVEIS, PASSE_BONUS_XP, PASSE_BONUS_MAX,
  PASSE_DUP_MOEDAS, PASSE_AB_MOEDAS, NIVEL_CUSTO_TETO, SEQ_PROT_PRECO, SEQ_MOEDAS, SEQ_MULT, SEQ_BAU4, SEQ_BAU7, BAU_GRATIS_MS,
  KSHOP_PRECO, KSHOP_MAX, KSHOP_VENDA, REL_DIA_QTD, REL_DIA_PRECO, REL_AB_QTD, REL_AB_PRECO, HL_AB_PRECO_MOEDAS, HL_AB_POR_DIAMANTE,
  HL_AB_MAX, HL_MS_PREMIO, PREMIO_ENVIO, PREMIO_ENVIO_MAX, PREMIO_TEMPO, PREMIO_TEMPO_SEG, COMPARTILHAR_PREMIO, COMPARTILHAR_MAX,
  CONVITE_SEG_ALVO, FONTE_POR_DIA, CRIADOR_MOEDAS, UGC_PRECO_MAX, UGC_PARTE_CRIADOR, UGC_PRECO_MAX_DIA, LOJA_MAX_C, LOJA_MAX_D,
  GIFT_MAX_MOEDAS, GIFT_MAX_AB
};
