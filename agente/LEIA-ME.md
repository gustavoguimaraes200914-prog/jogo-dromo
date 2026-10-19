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

## Contas com nome de usuário (entrada "tipo Roblox")
A pessoa cria a conta no site só com **nome de usuário, senha, data de nascimento e menino/menina**.
O **e-mail de segurança** é opcional e fica guardado só aqui no servidor (coleção `contaSegura`), nunca no site.
Se esquecer a senha, o servidor manda um **código de 6 números** pra esse e-mail e, com ele, troca a senha.
Não precisa mudar nada nas regras do Firestore: só o servidor mexe em `contaSegura` e `recuperacao`.

Para os códigos saírem por e-mail (grátis, até 300 por dia), uma vez só:
1. Crie um Gmail **só do Koda** (nunca use o e-mail pessoal: ele aparece como remetente).
2. Entre em **brevo.com** com esse Gmail → **Senders** (Remetentes) → adicione esse Gmail e confirme pelo link que chega nele.
3. Brevo → **SMTP & API** → **API Keys** → **Generate a new API key** → copie a chave.
4. Cloudflare → Workers & Pages → **jogodromo-agente** → **Settings** → **Variables and Secrets**:
   - `BREVO_API_KEY` (tipo **Secret**) = a chave do Brevo;
   - `EMAIL_REMETENTE` (tipo **Text**) = o Gmail do Koda.
5. Publique o código novo do worker (passos acima) e abra `https://jogodromo-agente.gamersite.workers.dev/?testar`:
   tem que aparecer `"email_de_recuperacao": "configurado"` e `"contas": "ok..."`.

No Firebase: Authentication → **Sign-in method** → **E-mail/senha** ligado, e em Authentication → **Settings** → **User actions**,
"Enable create (sign-up)" ligado (senão o site avisa que criar conta com nome de usuário ainda não está ligado).

