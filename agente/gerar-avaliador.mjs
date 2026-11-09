/* Gera agente/avaliador-koda.html: uma página que roda a MESMA análise do servidor (modo "koda") no navegador.
   Serve pra testar jogos sem publicar e sem gastar o banco. Rodar:  node agente/gerar-avaliador.mjs */
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
const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Avaliador do Koda GB</title>
<style>${css}</style></head>
<body>
<header><h1>Avaliador do Koda GB</h1><p>A IA do Koda (feita só de código) confere o jogo, igual à análise de antes de publicar. Nada sai do seu computador.</p></header>
<main>
  <section id="entrada">
    <label class="soltar" id="soltar" tabindex="0">
      <b>Arraste os jogos (.html) aqui</b><span>ou toque para escolher vários de uma vez</span>
      <input id="arquivos" type="file" accept=".html,.htm,text/html" multiple hidden>
    </label>
    <details><summary>ou cole o código de um jogo</summary>
      <input id="nomeColado" placeholder="Nome do jogo (opcional)"><textarea id="colado" rows="6" placeholder="Cole aqui o código HTML do jogo"></textarea><button id="avaliarColado" type="button">Avaliar</button>
    </details>
    <div class="linha"><label>Idioma do aviso para a criança <select id="idioma"><option value="pt">Português</option><option value="en">English</option><option value="es">Español</option><option value="fr">Français</option><option value="it">Italiano</option><option value="de">Deutsch</option><option value="nl">Nederlands</option><option value="ja">日本語</option><option value="zh">中文</option><option value="ko">한국어</option></select></label>
    <button id="baixar" type="button" hidden>Baixar relatório</button></div>
  </section>
  <section id="resumo" hidden></section>
  <section id="resultados"></section>
</main>
<script>
${fonte}
</script>
<script>
${ui}
</script>
</body></html>
`;
fs.writeFileSync(path.join(aqui, 'avaliador-koda.html'), html);
console.log('avaliador-koda.html gerado (' + Math.round(html.length / 1024) + ' KB)');
