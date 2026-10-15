/* Gera a versão PUBLICADA do Koda em dist/.
   O código legível (index.html) fica só no GitHub. O site no ar é uma cópia com o JavaScript embaralhado:
   nomes sem sentido, textos escondidos numa tabela, sem comentários, sem espaços. Tudo continua funcionando igual.
   Rodar: npm run build   (a Cloudflare roda isso sozinha antes de publicar, pelo [build] do wrangler.toml)

   Se alguma coisa falhar aqui, o build PARA (exit 1) e o site no ar continua como estava: nunca vai um site quebrado
   nem um site com o código legível por engano. */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const JavaScriptObfuscator = require('javascript-obfuscator');
const acorn = require('acorn');

const RAIZ = path.dirname(new URL(import.meta.url).pathname);
const SAIDA = path.join(RAIZ, 'dist');

/* Funções que o Koda copia COMO TEXTO para dentro dos jogos (fn.toString()). Elas precisam ficar inteiras e sem
   depender de nada de fora, então têm a marca "javascript-obfuscator:disable" no index.html. Se alguém tirar a marca
   de uma delas, o build avisa em vez de publicar um site que quebra os jogos. */
const FUNCOES_COPIADAS = ['kodaMemoriaDoJogo', 'kodaLeveDentroDoJogo', 'kodaRedeDentroDoJogo', 'kodaTradutorDoJogo',
  'kodaEntradaReal', 'kodaOnlineNoJogo', 'kodaAutoPontos'];

const CANARIOS = ['openKodaShop', 'compraFluxo', 'publishGame', 'spendCoins', 'presenteValorLimpo', 'abrirPresenteGenerico'];

/* nomes de topo que outro bloco <script> procura pelo nome (o texto "carregando" da abertura chama applyFilters) */
const NOMES_QUE_FICAM = ['^applyFilters$'];

/* outros arquivos da pasta que vão pro ar como estão (só estes tipos: nada de .js, .sql, .rules, .md, .toml) */
const ESTATICOS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.mp3', '.ogg', '.wav', '.mp4', '.webm',
  '.woff', '.woff2', '.ttf', '.css', '.json', '.txt', '.webmanifest']);
const IGNORAR = new Set(['node_modules', 'dist', 'multiplayer', '.git', '.github', '.wrangler', 'package.json', 'package-lock.json']);

function falhar(msg){
  console.error('\nERRO NO BUILD: ' + msg + '\nO site no ar não foi alterado.\n');
  process.exit(1);
}

function opcoes(ehGrande, semente){
  return {
    target: 'browser',
    compact: true,
    simplify: true,
    seed: semente,
    log: false,
    sourceMap: false,
    renameGlobals: ehGrande,                 // o código principal tem nomes de topo (funções e constantes): todos viram nomes sem sentido
    reservedNames: NOMES_QUE_FICAM,
    identifierNamesGenerator: 'hexadecimal',
    stringArray: true,                       // textos saem do código e vão pra uma tabela embaralhada
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayThreshold: 0.75,
    stringArrayEncoding: [],
    stringArrayWrappersCount: 1,
    stringArrayWrappersType: 'variable',
    splitStrings: false,
    transformObjectKeys: false,              // as chaves dos objetos (ex.: textos por idioma) são lidas pelo nome
    unicodeEscapeSequence: false,
    controlFlowFlattening: false,            // deixa o site lento no celular
    deadCodeInjection: false,
    selfDefending: false,
    debugProtection: false,
    disableConsoleOutput: false,
    numbersToExpressions: false,
    renameProperties: false                  // propriedades (document.x, localStorage...) não podem mudar de nome
  };
}

/* um <script> dentro de HTML não pode ter "</script" nem "<!--" soltos */
function sanitizarParaHtml(js){
  return js.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
}

function ehScriptJs(atributos){
  const t = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(atributos);
  return !t || /^(text|application)\/(x-)?(java|ecma)script$/i.test(t[1]);
}

function processarHtml(nome, html, estrito){
  let totalScripts = 0, grandes = 0;
  const partes = [];
  let ultimo = 0, m;
  const re = /<(script|style)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi;
  const semComentarioHtml = trecho => trecho.replace(/<!--[\s\S]*?-->/g, '');
  while((m = re.exec(html))){
    partes.push(semComentarioHtml(html.slice(ultimo, m.index)));
    ultimo = m.index + m[0].length;
    const tag = m[1].toLowerCase(), attrs = m[2], conteudo = m[3];
    if(tag === 'style'){
      const css = conteudo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*\n+/g, '\n');
      partes.push('<style' + attrs + '>' + css + '</style>');
      continue;
    }
    if(/\bsrc\s*=/i.test(attrs) || !ehScriptJs(attrs) || !conteudo.trim()){ partes.push(m[0]); continue; }
    totalScripts++;
    const grande = conteudo.length > 100000;
    if(grande) grandes++;
    const semente = parseInt(crypto.createHash('sha256').update(conteudo).digest('hex').slice(0, 8), 16);
    let saida;
    try{
      saida = JavaScriptObfuscator.obfuscate(conteudo, opcoes(grande, semente)).getObfuscatedCode();
    }catch(e){
      if(estrito) falhar(nome + ': não consegui embaralhar um <script> (' + e.message + ')');
      partes.push(m[0]);
      console.warn('aviso: ' + nome + ' ficou SEM embaralhar (' + e.message + ')');
      continue;
    }
    saida = sanitizarParaHtml(saida);
    try{ new vm.Script(saida); }catch(e){ falhar(nome + ': o <script> embaralhado não passou na checagem de sintaxe (' + e.message + ')'); }
    if(/<\/script/i.test(saida) || saida.indexOf('<!--') >= 0) falhar(nome + ': sobrou "</script" ou "<!--" dentro do <script> embaralhado.');
    if(grande){
      /* as marcas que desligam o embaralhamento têm que ser EXATAMENTE as 2 de cada função copiada (uma marca solta, até dentro
         de um comentário, deixaria parte do site legível) */
      const marcas = (conteudo.match(/javascript-obfuscator:/g) || []).length;
      if(marcas !== FUNCOES_COPIADAS.length * 2)
        falhar(nome + ': achei ' + marcas + ' marcas javascript-obfuscator no código, o certo é ' + FUNCOES_COPIADAS.length * 2 + ' (duas por função copiada).');
      /* "canários": nomes de funções comuns do site. Se aparecerem no resultado, o embaralhamento não pegou. */
      for(const c of CANARIOS){
        if(new RegExp('\\b' + c + '\\b').test(conteudo) && new RegExp('\\b' + c + '\\b').test(saida))
          falhar(nome + ': o nome "' + c + '" continua legível no site embaralhado.');
      }
      /* As funções copiadas como texto para dentro dos jogos têm que sair INTEIRAS e sem depender do resto do site:
         se tiver "_0x..." dentro delas, o embaralhador mexeu nelas (faltou a marca javascript-obfuscator:disable) e os jogos quebrariam. */
      let ast;
      try{ ast = acorn.parse(saida, {ecmaVersion: 'latest', sourceType: 'script'}); }
      catch(e){ falhar(nome + ': não consegui reler o <script> embaralhado (' + e.message + ')'); }
      const achadas = new Set();
      for(const no of ast.body){
        if(no.type === 'FunctionDeclaration' && FUNCOES_COPIADAS.includes(no.id.name)){
          achadas.add(no.id.name);
          if(/_0x[0-9a-f]{3,}/i.test(saida.slice(no.start, no.end)))
            falhar(nome + ': a função ' + no.id.name + ' foi alterada pelo embaralhador (faltou a marca javascript-obfuscator:disable).');
        }
      }
      for(const f of FUNCOES_COPIADAS){
        if(conteudo.indexOf('function ' + f + '(') >= 0 && !achadas.has(f))
          falhar(nome + ': a função ' + f + ' sumiu ou mudou de nome no site embaralhado.');
      }
    }
    partes.push('<script' + attrs + '>' + saida + '</script>');
  }
  partes.push(semComentarioHtml(html.slice(ultimo)));
  return {html: partes.join(''), totalScripts, grandes};
}

const t0 = Date.now();
fs.rmSync(SAIDA, {recursive: true, force: true});
fs.mkdirSync(SAIDA, {recursive: true});

const arquivos = fs.readdirSync(RAIZ, {withFileTypes: true}).filter(d => !IGNORAR.has(d.name));
let temIndex = false;
for(const d of arquivos){
  const origem = path.join(RAIZ, d.name);
  if(d.isDirectory()){
    /* pastas de imagens etc.: copia só os tipos estáticos permitidos */
    const copiar = (de, para) => {
      for(const e of fs.readdirSync(de, {withFileTypes: true})){
        if(e.isDirectory()){ copiar(path.join(de, e.name), path.join(para, e.name)); continue; }
        if(!ESTATICOS.has(path.extname(e.name).toLowerCase())) continue;
        fs.mkdirSync(para, {recursive: true});
        fs.copyFileSync(path.join(de, e.name), path.join(para, e.name));
      }
    };
    copiar(origem, path.join(SAIDA, d.name));
    continue;
  }
  const ext = path.extname(d.name).toLowerCase();
  if(ext === '.html'){
    const estrito = d.name === 'index.html';
    const fonte = fs.readFileSync(origem, 'utf8');
    const r = processarHtml(d.name, fonte, estrito);
    if(estrito && r.grandes < 1) falhar('index.html: não achei o <script> principal para embaralhar.');
    fs.writeFileSync(path.join(SAIDA, d.name), r.html);
    if(estrito) temIndex = true;
    console.log(d.name + ': ' + (fonte.length / 1048576).toFixed(2) + ' MB -> ' + (r.html.length / 1048576).toFixed(2) + ' MB (' + r.totalScripts + ' scripts embaralhados)');
  } else if(ESTATICOS.has(ext)){
    fs.copyFileSync(origem, path.join(SAIDA, d.name));
  }
}
if(!temIndex) falhar('não achei index.html.');
const tam = fs.statSync(path.join(SAIDA, 'index.html')).size;
if(tam < 500000) falhar('index.html embaralhado ficou pequeno demais (' + tam + ' bytes).');
if(tam > 24 * 1048576) falhar('index.html passou do limite de 25 MB da Cloudflare.');
console.log('Pronto em ' + ((Date.now() - t0) / 1000).toFixed(1) + 's -> dist/');
