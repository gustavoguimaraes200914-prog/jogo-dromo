/* Gera a página do avaliador a partir do código do servidor (a MESMA análise, no navegador) e dos jogos de avaliacao.
   - agente/avaliador-koda.html .......... arquivo completo (abre no computador)
   - agente/avaliador-koda.artefato.html . trecho sem <html>/<head>, pra publicar como página dentro do Claude
   Rodar:  node agente/gerar-avaliador.mjs */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const aqui = path.dirname(fileURLToPath(import.meta.url));
let fonte = fs.readFileSync(path.join(aqui, 'jogodromo-agent-worker.js'), 'utf8');
const i = fonte.lastIndexOf('\nexport default {');
if(i < 0) throw new Error('não achei o "export default" do servidor');
fonte = fonte.slice(0, i) + '\nvar __servidorKoda = {' + fonte.slice(i + '\nexport default {'.length);
fonte = fonte.replace(/<\/script/gi, '<\\/script');
const ui = fs.readFileSync(path.join(aqui, 'avaliador-koda.ui.js'), 'utf8');
const css = fs.readFileSync(path.join(aqui, 'avaliador-koda.css'), 'utf8');
const dir = path.join(aqui, 'jogos-de-avaliacao'), exemplos = {};
fs.readdirSync(dir).filter(f => /\.html$/.test(f)).sort().forEach(f => { exemplos[f] = fs.readFileSync(path.join(dir, f), 'utf8'); });
const json = JSON.stringify(exemplos).replace(/</g, '\\u003c');
const corpo = `<title>Avaliador do Koda GB</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${css}</style>
<header class="pagina"><div class="topo-pagina"><h1>Avaliador do Koda GB</h1><p>A IA do Koda, feita só de código, confere o jogo do mesmo jeito que a análise de antes de publicar. Tudo roda aqui, sem usar o banco do Google.</p></div></header>
<div class="miolo">
  <section class="painel exemplo"><p><b>Testar com os <span id="exemplos-qtd">34</span> jogos de exemplo</b>Os jogos "bom" têm que ser aprovados e os "ruim" recusados. Um toque e a página confere sozinha.</p><button id="exemplos-botao" type="button">Testar os jogos de exemplo</button></section>
  <section class="painel">
    <div class="soltar" id="soltar" tabindex="0" role="button" aria-label="Escolher jogos"><b>Avaliar os seus jogos</b><span>Arraste arquivos .html aqui ou toque para escolher vários de uma vez</span><input id="arquivos" type="file" accept=".html,.htm,text/html" multiple hidden></div>
    <details><summary>ou cole o código de um jogo</summary><input id="nomeColado" placeholder="Nome do jogo (opcional)"><textarea id="colado" rows="6" placeholder="Cole aqui o código HTML do jogo"></textarea><button id="avaliarColado" type="button">Avaliar</button></details>
  </section>
  <div class="linha"><label>Idioma do aviso para a criança <select id="idioma"><option value="pt">Português</option><option value="en">English</option><option value="es">Español</option><option value="fr">Français</option><option value="it">Italiano</option><option value="de">Deutsch</option><option value="nl">Nederlands</option><option value="ja">日本語</option><option value="zh">中文</option><option value="ko">한국어</option></select></label><button class="calma" id="copiar" type="button" hidden>Copiar relatório</button></div>
  <textarea id="relatorio-texto" rows="8" hidden readonly aria-label="Relatório"></textarea>
  <section id="resumo" class="painel" hidden></section>
  <section id="lista" aria-live="polite"></section>
</div>
<script type="application/json" id="exemplos">${json}</script>
<script>
${fonte}
</script>
<script>
${ui}
</script>
`;
fs.writeFileSync(path.join(aqui, 'avaliador-koda.artefato.html'), corpo);
fs.writeFileSync(path.join(aqui, 'avaliador-koda.html'), `<!DOCTYPE html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>\n${corpo}</body></html>\n`);
console.log('gerado: avaliador-koda.html e avaliador-koda.artefato.html (' + Math.round(corpo.length / 1024) + ' KB)');
