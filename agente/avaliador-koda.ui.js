(function(){
  var NOMES_CAT = {odio:'Ódio ou preconceito', assedio:'Bullying ou assédio', sexual:'Conteúdo sexual', violencia:'Violência pesada', autolesao:'Automutilação ou suicídio', drogas:'Drogas, álcool ou cigarro', apostas:'Apostas', politica:'Política', religiao:'Religião', golpe:'Golpe ou pedido de senha', dados_pessoais:'Pede dados pessoais', contato:'Contato fora do Koda', palavrao:'Palavrões', propriedade_intelectual:'Personagem ou marca famosa', codigo_malicioso:'Código perigoso', externo:'Coisas de outros sites', manipulacao:'Tentativa de enganar a análise', desinformacao:'Informação falsa', crime:'Incentiva crime', improprio:'Impróprio para crianças', nao_analisavel:'Não deu para analisar'};
  var GRAV = {gravissima:'gravíssima', grave:'grave', media:'média', leve:'leve'};
  var AVISOS = {imagens_nao_conferidas:'imagem(ns) dentro do jogo: o Koda confere o código e os textos, mas não enxerga o que está desenhado nelas (só a IA completa enxerga)', videos_nao_conferidos:'vídeo(s) dentro do jogo: o conteúdo não foi conferido', audios_nao_conferidos:'áudio(s) dentro do jogo: o conteúdo não foi conferido'};
  var $ = function(id){ return document.getElementById(id); };
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var relatorio = [];
  var EXEMPLOS = {};
  try{ EXEMPLOS = JSON.parse($('exemplos').textContent); }catch(e){}
  function b64(txt){ var bytes = new TextEncoder().encode(txt), bin = '', i; for(i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)); return btoa(bin); }
  function esperadoDe(nome){ return /^bom-/.test(nome) ? 'aprovado' : /^ruim-/.test(nome) ? 'recusado' : null; }
  function avaliar(nome, codigo){
    var tm = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(codigo);
    var jogo = {id: 'avaliador', name: (tm && tm[1].trim()) || nome.replace(/\.html?$/i, ''), codeB64: b64(codigo), creatorEmail: 'avaliador@local'};
    var t0 = performance.now(), r, erro = null;
    try{ r = revisarComKoda(jogo, {lang: $('idioma').value}); }catch(e){ erro = String(e && e.message || e); }
    var item = {arquivo: nome, nome: jogo.name, kb: Math.round(codigo.length / 1024), ms: Math.round(performance.now() - t0), esperado: esperadoDe(nome)};
    if(erro){ item.erro = erro; return item; }
    var d = r.decisao, a = r.analise;
    item.status = d.status; item.motivo = d.motivo; item.categorias = d.categorias || []; item.violacoes = d.violacoes || []; item.avisos = d.avisos || []; item.alerta = !!d.alerta;
    item.sinais = a ? a.sinais.map(function(s){ return {id: s.id, cat: s.cat, nivel: s.nivel, detalhe: s.detalhe, exemplos: (s.exemplos || []).slice(0, 3)}; }) : [];
    item.lexico = a ? a.lexico.slice(0, 30).map(function(l){ return {cat: l.cat, nivel: l.nivel, termo: l.termo, vezes: l.vezes}; }) : [];
    return item;
  }
  function cartao(it){
    var ok = it.status === 'aprovado';
    var h = '<div class="jogo ' + (ok ? 'ok' : 'nao') + '"><div class="topo"><span class="selo">' + (ok ? 'Aprovado' : 'Recusado') + '</span><span class="nome">' + esc(it.arquivo) + '</span>';
    if(it.esperado && !it.erro) h += '<span class="esperado ' + (it.esperado === it.status ? 'bate' : 'diverge') + '">' + (it.esperado === it.status ? 'era o esperado' : 'esperado: ' + it.esperado) + '</span>';
    h += '<span class="pequeno">' + it.kb + ' KB · ' + it.ms + ' ms</span></div><div class="corpo">';
    if(it.erro) return h + '<div class="motivo">Não deu para analisar: ' + esc(it.erro) + '</div></div></div>';
    if(ok) h += '<div class="motivo">Nenhum problema encontrado pela IA do Koda.' + (it.avisos.length ? '' : ' Pode publicar.') + '</div>';
    else h += '<div class="motivo"><b>O que a criança vê:</b> ' + esc(it.motivo || '(o aviso padrão do idioma)') + (it.alerta ? '<br><b>Gravíssimo: o dono do Koda é avisado.</b>' : '') + '</div>';
    if(it.avisos.length) h += '<div class="aviso">' + it.avisos.map(function(a){ var k = a.split(':'); return esc((AVISOS[k[0]] || k[0]).replace('(s)', k[1] ? ' (' + k[1] + ')' : '')); }).join('<br>') + '<br><span class="pequeno">O jogo é publicado e fica marcado para a IA completa conferir depois.</span></div>';
    if(it.categorias.length) h += '<div class="chips">' + it.categorias.map(function(c){ return '<span class="chip">' + esc(NOMES_CAT[c] || c) + '</span>'; }).join('') + '</div>';
    if(it.violacoes.length) h += '<div class="tabela"><table><tr><th>Categoria</th><th>Gravidade</th><th>O que achou</th><th>Por quê</th></tr>' + it.violacoes.map(function(v){ return '<tr><td>' + esc(NOMES_CAT[v.categoria] || v.categoria) + '</td><td>' + esc(GRAV[v.gravidade] || v.gravidade) + '</td><td>' + esc(v.trecho) + '</td><td>' + esc(v.explicacao) + '</td></tr>'; }).join('') + '</table></div>';
    var det = '';
    if(it.sinais.length) det += '<p class="pequeno"><b>Sinais do código:</b></p><div class="tabela"><table>' + it.sinais.map(function(s){ return '<tr><td>' + esc(s.nivel) + '</td><td>' + esc(s.id) + '</td><td>' + esc(s.detalhe) + (s.exemplos.length ? ' — ' + esc(s.exemplos.join(' | ').slice(0, 200)) : '') + '</td></tr>'; }).join('') + '</table></div>';
    if(it.lexico.length) det += '<p class="pequeno"><b>Palavras do dicionário que apareceram:</b> ' + it.lexico.map(function(l){ return esc(l.termo) + ' <i>(' + esc(NOMES_CAT[l.cat] || l.cat) + ', ' + esc(l.nivel) + ', ' + l.vezes + 'x)</i>'; }).join(' · ') + '</p>';
    if(det) h += '<details><summary>Ver detalhes</summary>' + det + '</details>';
    return h + '</div></div>';
  }
  function mostrar(itens, substituir){
    relatorio = substituir ? itens : relatorio.concat(itens);
    $('lista').innerHTML = (substituir ? relatorio.slice() : relatorio.slice().reverse()).map(cartao).join('');
    var ap = relatorio.filter(function(x){ return x.status === 'aprovado'; }).length, rec = relatorio.filter(function(x){ return x.status === 'recusado'; }).length, erros = relatorio.length - ap - rec;
    var comEsp = relatorio.filter(function(x){ return x.esperado && !x.erro; }), certos = comEsp.filter(function(x){ return x.esperado === x.status; }).length;
    var r = $('resumo'); r.hidden = false; r.className = 'painel' + (comEsp.length ? (certos === comEsp.length ? ' tudo-certo' : ' confere-erro') : '');
    r.textContent = relatorio.length + ' jogo(s) avaliado(s): ' + ap + ' aprovado(s) e ' + rec + ' recusado(s)' + (erros ? ', ' + erros + ' com erro' : '') + '.' + (comEsp.length ? ' ' + certos + ' de ' + comEsp.length + ' deram o resultado esperado.' : '');
    $('copiar').hidden = false;
  }
  function lerArquivos(lista){
    var arr = Array.prototype.slice.call(lista).filter(function(f){ return /\.html?$/i.test(f.name) || f.type === 'text/html'; });
    if(!arr.length){ $('resumo').hidden = false; $('resumo').className = 'painel confere-erro'; $('resumo').textContent = 'Escolha arquivos .html.'; return; }
    Promise.all(arr.map(function(f){ return f.text().then(function(t){ return avaliar(f.name, t); }); })).then(function(it){ mostrar(it); });
  }
  $('exemplos-botao').addEventListener('click', function(){
    var nomes = Object.keys(EXEMPLOS).sort();
    mostrar(nomes.map(function(n){ return avaliar(n, EXEMPLOS[n]); }), true);
    $('resumo').scrollIntoView({block: 'start'});
  });
  $('exemplos-qtd').textContent = Object.keys(EXEMPLOS).length;
  $('arquivos').addEventListener('change', function(e){ lerArquivos(e.target.files); e.target.value = ''; });
  var soltar = $('soltar');
  soltar.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); $('arquivos').click(); } });
  soltar.addEventListener('click', function(e){ if(e.target.id !== 'arquivos'){ $('arquivos').click(); } });
  ['dragenter', 'dragover'].forEach(function(ev){ soltar.addEventListener(ev, function(e){ e.preventDefault(); soltar.classList.add('sobre'); }); });
  ['dragleave', 'drop'].forEach(function(ev){ soltar.addEventListener(ev, function(e){ e.preventDefault(); soltar.classList.remove('sobre'); }); });
  soltar.addEventListener('drop', function(e){ lerArquivos(e.dataTransfer.files); });
  $('avaliarColado').addEventListener('click', function(){ var c = $('colado').value; if(!c.trim()) return; mostrar([avaliar(($('nomeColado').value || 'Jogo colado') + '.html', c)]); });
  $('copiar').addEventListener('click', function(){
    var txt = JSON.stringify(relatorio, null, 1), area = $('relatorio-texto');
    function mostrarTexto(){ area.hidden = false; area.value = txt; area.focus(); area.select(); $('copiar').textContent = 'Copie o texto abaixo'; }
    try{ navigator.clipboard.writeText(txt).then(function(){ $('copiar').textContent = 'Relatório copiado'; setTimeout(function(){ $('copiar').textContent = 'Copiar relatório'; }, 1800); }, mostrarTexto); }catch(e){ mostrarTexto(); }
  });
  window.__avaliarTexto = avaliar;          /* (pra testes) */
})();
