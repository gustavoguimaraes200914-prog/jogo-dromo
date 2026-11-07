/* As tabelas de prêmios e preços existem em DOIS lugares: no site (index.html) e no servidor (regras.js).
   Este teste lê as do site e compara com as do servidor. Rodar depois de mudar qualquer prêmio:
   node servidor/testes/tabelas.mjs */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as S from '../regras.js';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const linhas = html.split('\n');
function bloco(re) {
  const i = linhas.findIndex(l => re.test(l));
  if (i < 0) throw new Error('não achei no site: ' + re);
  let prof = 0, out = [];
  for (let j = i; j < linhas.length; j++) {
    out.push(linhas[j]);
    prof += (linhas[j].match(/[{[(]/g) || []).length - (linhas[j].match(/[}\])]/g) || []).length;
    if (prof <= 0 && /[;}]\s*(\/\/.*|\/\*.*)?$/.test(linhas[j].trim())) break;
  }
  return out.join('\n');
}
const nomes = ['COIN_RULES', 'COIN_DIA_GERAL', 'ACOES_TETO_DIA', 'MS_RECOMPENSA', 'MS_RECOMPENSA_ANT', 'PASSE_PRECO', 'PASSE_PRECO_PREMIUM',
  'PASSE_NIVEL_MOEDAS', 'PASSE_NIVEIS', 'PASSE_BONUS_XP', 'PASSE_BONUS_MAX', 'PASSE_DUP_MOEDAS', 'PASSE_AB_MOEDAS', 'PASSE_TEMPORADAS',
  'PASSE_ITENS_G', 'PASSE_ITENS_P', 'PASSE_ITENS_X', 'NIVEL_CUSTO_TETO', 'SEQ_PROT_PRECO', 'SEQ_MOEDAS', 'SEQ_MULT', 'SEQ_BAU4', 'SEQ_BAU7',
  'ROLETA_FATIAS', 'BAUS', 'BAU_PRECOS', 'BAU_GRATIS_MS', 'KSHOP_PRECO', 'KSHOP_MAX', 'KSHOP_OFERTAS', 'KSHOP_VENDA', 'REL_DIA_QTD', 'REL_DIA_PRECO',
  'REL_AB_QTD', 'REL_AB_PRECO', 'HL_AB_PRECO_MOEDAS', 'HL_AB_POR_DIAMANTE', 'HL_AB_MAX', 'HL_MS_PREMIO', 'EV_BAUS', 'PREMIO_ENVIO',
  'PREMIO_ENVIO_MAX', 'PREMIO_TEMPO', 'PREMIO_TEMPO_SEG', 'COMPARTILHAR_PREMIO', 'COMPARTILHAR_MAX', 'CONVITE_SEG_ALVO', 'FONTE_POR_DIA',
  'CRIADOR_MOEDAS', 'UGC_PRECO_MAX', 'UGC_PARTE_CRIADOR', 'UGC_PRECO_MAX_DIA', 'LOJA_MAX_C', 'LOJA_MAX_D', 'GIFT_MAX_MOEDAS', 'GIFT_MAX_AB'];
let codigo = '';
const vistos = new Set();
for (const n of nomes) {
  const re = new RegExp('^\\s*(?:const|var|let)\\s+(?:[A-Z_0-9]+\\s*=\\s*[^,;]+,\\s*)*' + n + '\\s*=');
  const i = linhas.findIndex(l => re.test(l));
  if (i < 0) throw new Error('não achei no site: ' + n);
  if (vistos.has(i)) continue;
  vistos.add(i);
  codigo += bloco(new RegExp('^' + linhas[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$')).replace(/^\s*(const|let)\s/, 'var ') + '\n';
}
codigo += 'var EV_BAUS = EV_BAUS;\n' + bloco(/^Object\.assign\(EV_BAUS, \{/) + '\n';
codigo += bloco(/^function passeXpDoNivel\(n\)/) + '\n' + 'var _passeTab = null;\n' + bloco(/^function passeTabela\(\)\{/) + '\n';
codigo += bloco(/^function nivelCusto\(n\)/) + '\n' + bloco(/^function seqSemana\(n\)/) + '\n' + bloco(/^function seqPremio\(n\)\{/) + '\n';
codigo += bloco(/^function nivelPremio\(n\)\{/).replace(/const cl = [^\n]*\n\s*if\(cl\)[^\n]*\n\s*const tts = [^\n]*\n\s*if\(tts\.length\)[^\n]*\n/, '') + '\n';
const site = {};
vm.createContext(site);
vm.runInContext(codigo, site);

let falhas = 0, total = 0;
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function confere(nome, a, b) {
  total++;
  if (igual(a, b)) return;
  falhas++;
  console.log('DIFERENTE: ' + nome + '\n   site:     ' + JSON.stringify(a).slice(0, 300) + '\n   servidor: ' + JSON.stringify(b).slice(0, 300));
}
for (const k of Object.keys(S.TABELAS)) confere(k, site[k], S.TABELAS[k]);
confere('COIN_RULES', site.COIN_RULES, S.COIN_RULES);
confere('MS_RECOMPENSA', site.MS_RECOMPENSA, S.MS_RECOMPENSA);
confere('MS_RECOMPENSA_ANT', site.MS_RECOMPENSA_ANT, S.MS_RECOMPENSA_ANT);
confere('BAUS', site.BAUS, S.BAUS);
confere('BAU_PRECOS', site.BAU_PRECOS, S.BAU_PRECOS);
confere('KSHOP_OFERTAS', site.KSHOP_OFERTAS, S.KSHOP_OFERTAS);
confere('PASSE_TEMPORADAS', site.PASSE_TEMPORADAS, S.PASSE_TEMPORADAS);
confere('EV_BAUS (preços)', Object.fromEntries(Object.entries(site.EV_BAUS).map(([k, v]) => [k, v.preco])), Object.fromEntries(Object.entries(S.EV_BAUS).map(([k, v]) => [k, v.preco])));
confere('ROLETA (prêmios)', site.ROLETA_FATIAS.map(f => f.p), S.ROLETA_FATIAS.map(f => f.p));
confere('passeTabela', site.passeTabela(), S.passeTabela());
for (let n = 1; n <= 3000; n += (n < 400 ? 1 : 37)) {
  confere('nivelPremio(' + n + ')', site.nivelPremio(n), S.nivelPremio(n));
  confere('nivelCusto(' + n + ')', site.nivelCusto(n), S.nivelCusto(n));
}
for (let n = 1; n <= 80; n++) confere('seqPremio(' + n + ')', site.seqPremio(n), S.seqPremio(n));
console.log(falhas ? `\n${falhas} de ${total} DIFERENTES: mude o servidor/regras.js igual ao site.` : `tabelas do site e do servidor iguais (${total} conferências)`);
if (falhas) process.exitCode = 1;
