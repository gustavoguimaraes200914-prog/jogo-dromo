# Servidor da análise de jogos (worker `jogodromo-agente`)

Esta pasta **não vai para o ar com o site** (está no `.assetsignore`): a lista de palavras e as regras da análise não podem ficar públicas.

- `jogodromo-agent-worker.js` — o código do worker. É o que fica publicado no Cloudflare como **jogodromo-agente**.
- `teste-moderacao.mjs` — testes (sem internet e sem gastar IA). Rodar: `node agente/teste-moderacao.mjs`.

## Como o resultado funciona
Só existem dois fins: **✔ aprovado** (o jogo é publicado na hora) ou **✖ recusado** (não é publicado).
Não existe revisão por pessoa nem "pedir revisão": na dúvida, recusa; o criador conserta e envia de novo.
Se a análise não conseguir rodar (IA fora do ar etc.), nada é publicado e o site tenta de novo sozinho.

## Como publicar uma versão nova (pelo iPad)
1. No GitHub, abra `agente/jogodromo-agent-worker.js` e toque em **Copy raw file** (o ícone de copiar, no alto do arquivo).
2. Cloudflare → Workers & Pages → **jogodromo-agente** → **Edit code** → toque no código, **Selecionar tudo** → **Colar**.
3. Toque em **Deploy**.
4. Abra `https://jogodromo-agente.gamersite.workers.dev/?testar` e confira: `"tudo_certo": true` e o `versao_do_codigo` novo.

Ordem importante: publique o **worker primeiro** e o **site depois**.
