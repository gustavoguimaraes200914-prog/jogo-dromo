/* testes do Aprendiz (o Agente Koda GB aprendendo com os erros de todo mundo). Rode com o servidor local (ver LEIA-ME). */
import { api, pessoa, confere, fim } from './ajudante.mjs';
const DONO = 'gustavoguimaraes200914@gmail.com';
const erros = (p, eventos) => api('/api/agente/erros', { tk: p.tk, corpo: { eventos } });
const regras = async p => (await api('/api/agente/regras', { tk: p.tk })).j.regras || [];
const sufixo = Math.random().toString(36).slice(2, 7);
{
  let r = await api('/api/agente/regras');
  confere('sem login: 401', r.status === 401, r.status);
  const a = pessoa('ag-a-' + sufixo), dono = pessoa('dono', { email: DONO });
  r = await erros(a, [{ t: 'nao_entendi', f: 'zorbax ' + sufixo + ' meu email ana@gmail.com e zap 11 98765-4321', l: 'pt' }, { t: 'inventado', f: 'x y z' }, { t: 'ensinou', f: 'abc ' + sufixo, c: { int: 'nada' } }]);
  confere('aceita os eventos certos (o inventado não)', r.j && r.j.ok && r.j.aceitos === 2, r.j);
  r = await api('/api/admin/agente?n=300', { tk: a.tk });
  confere('painel do agente: só o dono', r.status === 403, r.status);
  r = await api('/api/admin/agente?n=300', { tk: dono.tk });
  const fz = r.j && r.j.frases.find(f => f.k.indexOf('zorbax ' + sufixo) === 0);
  confere('o dono vê a frase', !!fz, r.j && r.j.frases.slice(0, 3));
  confere('a frase chega sem e-mail nem telefone', fz && !/@|98765|4321|gmail/.test(fz.frase + ' ' + fz.k), fz && fz.frase);

  /* três pessoas ensinam a mesma coisa simples: vira regra (só onde o agente não entendia) */
  const F = 'faz a magica ' + sufixo;
  for (const n of ['b', 'c']) await erros(pessoa('ag-' + n + '-' + sufixo), [{ t: 'ensinou', f: F, c: { int: 'verificar' } }]);
  confere('com 2 pessoas ainda não é regra', !(await regras(a)).some(x => x.k === F));
  await erros(a, [{ t: 'ensinou', f: F + '!!', c: { int: 'verificar', aprendido: true } }]);
  let rg = (await regras(a)).find(x => x.k === F);
  confere('com 3 pessoas vira regra de todos', rg && rg.it.int === 'verificar' && rg.sobre === false, rg);
  confere('a regra não leva marca de "aprendido"', rg && rg.it.aprendido === undefined, rg);
  await erros(a, [{ t: 'ensinou', f: F, c: { int: 'verificar' } }, { t: 'ensinou', f: F, c: { int: 'verificar' } }]);
  r = await api('/api/admin/agente?n=300', { tk: dono.tk });
  const fF = r.j.frases.find(f => f.k === F);
  confere('a mesma pessoa não vota duas vezes', fF && fF.sugestoes[0].votos === 3 && fF.contas === 3, fF);

  /* com texto livre (o nome que alguém escreveu) não vira regra sozinho */
  const G = 'chama de outro jeito ' + sufixo;
  for (const n of ['d', 'e', 'f']) await erros(pessoa('ag-' + n + '-' + sufixo), [{ t: 'ensinou', f: G, c: { int: 'moeda_renomear', nome: 'Estrelinhas Mágicas' } }]);
  confere('texto livre: não vira regra sozinho (só com o dono)', !(await regras(a)).some(x => x.k === G));
  const H = 'tira tudo ' + sufixo;
  for (const n of ['g', 'h', 'i']) await erros(pessoa('ag-' + n + '-' + sufixo), [{ t: 'ensinou', f: H, c: { int: 'loja_remover' } }]);
  confere('pedido que apaga coisa: não vira regra sozinho', !(await regras(a)).some(x => x.k === H));

  /* três reclamações tiram a regra automática, e ela não volta sozinha */
  for (const n of ['j', 'k', 'l']) await erros(pessoa('ag-' + n + '-' + sufixo), [{ t: 'errou', f: F, i: 'verificar', g: 1 }]);
  confere('3 reclamações: a regra automática sai', !(await regras(a)).some(x => x.k === F));
  for (const n of ['m', 'n', 'o']) await erros(pessoa('ag-' + n + '-' + sufixo), [{ t: 'ensinou', f: F, c: { int: 'verificar' } }]);
  confere('e não volta sozinha', !(await regras(a)).some(x => x.k === F));

  /* o dono aprova (e pode mandar valer sempre) */
  r = await api('/api/admin/agente', { tk: a.tk, corpo: { acao: 'aprovar', k: G, it: { int: 'verificar' } } });
  confere('aprovar: só o dono', r.status === 403, r.status);
  r = await api('/api/admin/agente', { tk: dono.tk, corpo: { acao: 'aprovar', k: G, it: { int: 'moeda_renomear', nome: 'estrelas' }, sobre: true } });
  rg = (await regras(a)).find(x => x.k === G);
  confere('o dono aprova e manda valer sempre', r.j && r.j.ok && rg && rg.it.nome === 'estrelas' && rg.sobre === true, { r: r.j, rg });
  r = await api('/api/admin/agente', { tk: dono.tk, corpo: { acao: 'aprovar', k: G, it: { int: 'sim' } } });
  confere('o dono não aprova pedido de conversa ("sim")', r.j && r.j.ok === false, r.j);
  r = await api('/api/admin/agente', { tk: dono.tk, corpo: { acao: 'tirar', k: G } });
  confere('o dono tira a regra', r.j.ok && !(await regras(a)).some(x => x.k === G));
  r = await api('/api/admin/agente', { tk: dono.tk, corpo: { acao: 'apagar', k: H } });
  r = await api('/api/admin/agente?n=300', { tk: dono.tk });
  confere('o dono apaga a frase', !r.j.frases.some(f => f.k === H));

  /* cada conta manda no máximo 60 por dia, 20 por vez */
  const z = pessoa('ag-z-' + sufixo);
  let total = 0;
  for (let i = 0; i < 4; i++) { r = await erros(z, Array.from({ length: 25 }, (_, j) => ({ t: 'nao_entendi', f: 'frase ' + i + ' ' + j + ' ' + sufixo }))); total += r.j.aceitos; }
  confere('no máximo 60 por dia (20 por vez)', total === 60, total);
  r = await api('/api/agente/erros', { tk: z.tk, corpo: { eventos: [], lixo: 'x'.repeat(30000) } });
  confere('pedido gigante: recusado', r.status === 413, r.status);
}
fim();
