# Servidor do Koda GB

O servidor é a parte do Koda GB que roda na Cloudflare, junto com o site. Antes, o celular de cada
pessoa guardava as moedas e decidia sozinho quanto ganhava. Quem soubesse mexer no navegador conseguia
se dar 1 milhão de moedas. Agora quem decide é o servidor.

## O que ele faz

- **Carteira oficial.** Moedas, Koda GB Diamonds e abóboras de cada pessoa ficam guardadas no servidor.
  O celular continua mostrando tudo na hora, mas cada ganho e cada gasto vira um "movimento" com o
  motivo: partida, missão, baú, Koda GB Pass, presente, loja e assim por diante. O servidor confere cada
  movimento com as mesmas tabelas do site (`regras.js`) e devolve o saldo certo.
- **Contra trapaça.** O servidor recusa:
  - ganho maior do que o prêmio da tabela;
  - prêmio pego duas vezes (missão, sequência do dia, roleta, nível, Pass);
  - partida que paga acima do teto do dia;
  - baú que não veio de lugar nenhum ou que deu mais do que pode;
  - troca com preço errado na Koda GB shop;
  - presente recebido sem ninguém ter pago;
  - nível ou Pass pegos de uma vez com XP inventado.

  Quem mexer no celular vê o número voltar ao certo.
- **Convite de verdade.** O prêmio de 1.000 moedas por amigo só vem se:
  - o amigo entrou pelo link;
  - a conta do amigo é nova;
  - o amigo jogou 30 minutos, contados pelo relógio do servidor (não dá para acelerar).

  Quem paga esse prêmio é o próprio servidor.
- **Ranking conferido.** A pontuação só entra se a pessoa estava jogando aquele jogo. Pontuação
  absurda fica de fora e vira aviso para o dono. Na primeira vez, o ranking antigo do Firebase é copiado.
- **Banimento.** Quem está banido no painel ou na lista do Firebase não ganha nada.
- **Painel do dono.** Fica no painel de moderação do site (só a conta do dono vê). Ali dá para:
  - ver os avisos;
  - procurar uma conta pelo e-mail;
  - devolver moedas para quem perdeu ou tirar de quem trapaceou;
  - banir e desbanir;
  - ver o que o Agente Koda GB errou e ensinar o pedido certo (abaixo).
- **O Agente Koda GB aprendendo com todo mundo** (`aprendiz.js`). Quando o agente do Studio não entende
  uma frase, entende errado ("não era isso"), quase quebra o jogo ou não consegue trocar as moedas, o site
  manda só a frase (sem nome, sem e-mail, sem o código do jogo; e-mail, site e número comprido saem antes,
  no aparelho e aqui de novo). A conta vira um código, só para contar pessoas diferentes. Cada conta manda
  no máximo 60 por dia.
  - **Regra de todos:** vale quando o dono aprova no painel (botão "Aprovar" ou "Ensinar o pedido certo"),
    ou sozinha quando 3 pessoas diferentes ensinam a mesma coisa simples para a mesma frase (sem texto
    escrito por alguém, e nada que apague coisas).
  - A regra automática só vale onde o agente não entendia. Se 3 pessoas reclamarem, ela sai e não volta
    sozinha. "Aprovar sempre" (só o dono) faz valer até onde o agente achava que tinha entendido.
  - Guarda as 3.000 frases mais recentes.
- **Cabeçalhos de segurança** nas páginas, no arquivo `_headers` na raiz.
- **Arquivos escondidos.** A pasta `.git` e o código do servidor não são publicados. Antes, o
  histórico do repositório inteiro (`/.git/`) dava para baixar pelo site.

## O que você precisa fazer

**Nada é obrigatório.** O servidor vai para o ar sozinho junto com o site, porque a Cloudflare lê
o `wrangler.toml` da raiz. Os Durable Objects usados existem no plano grátis.

**Opcional:** publicar as regras novas do Firebase (`firebase/firestore.rules`). A única mudança é
que ninguém mais grava recorde direto no ranking antigo. Veja `firebase/LEIA-ME.md`.

## Primeira vez de cada pessoa

Na primeira conferência, o saldo que estava no celular entra no servidor até um teto:
250.000 moedas, 600 diamantes e 6.000 abóboras (o dono não tem teto). O que passar disso fica
anotado nos avisos ("importar_teto"). Se for alguém de verdade, devolva pelo painel com
**Ajustar**.

## Endereços

| Endereço | Para quê |
|---|---|
| `GET /api/saude` | o servidor está de pé? (não precisa de login) |
| `POST /api/sync` | a conferência: movimentos, tempo jogado, pontuações, convite |
| `GET /api/placar?jogo=ID` | ranking de um jogo |
| `GET /api/temporada` | ranking do mês |
| `POST /api/agente/erros` | o que o Agente Koda GB errou (até 20 por vez, 60 por dia) |
| `GET /api/agente/regras` | as regras que valem pra todos (o agente busca a cada 3 horas) |
| `/api/admin/...` | só o dono: `alertas`, `conta`, `ajuste`, `ban`, `desban`, `placar/remover`, `agente` (ver, aprovar, recusar, tirar, apagar) |

Tudo, menos `/api/saude`, precisa do login do Firebase (o "crachá" do Google, conferido de verdade).

## Arquivos

- `index.js`: recebe os pedidos, confere o login e manda para o lugar certo.
- `auth.js`: confere o crachá do Firebase (assinatura do Google).
- `regras.js`: **as tabelas e as regras**. Quando mudar um prêmio ou um preço no `index.html`,
  mude aqui também e rode o teste das tabelas.
- `conta.js`: a conta de cada pessoa (saldo, livro de movimentos, tempo, convite, banimento).
- `placar.js`: ranking de cada jogo e da temporada.
- `indice.js`: liga o uid ao e-mail e guarda os avisos para o dono (o "Vigia"). Uma instância própria
  do Vigia, chamada "agente", guarda o aprendizado do agente.
- `aprendiz.js`: o aprendizado do Agente Koda GB (frases, votos, regras, painel).
- `firestore.js`: lê o ranking antigo do Firebase.
- `testes/`: os testes.

## Testes (no computador)

```
npm install wrangler
npx wrangler dev --port 8787 --var CHAVES_TESTE:"$(node servidor/testes/ajudante.mjs chaves)" --var SEM_FIRESTORE:1 --var TESTE_TEMPO_LIVRE:1
node servidor/testes/servidor.mjs     # 100+ casos: login, trapaças, prêmios, presentes, convite, ranking, painel
node servidor/testes/tabelas.mjs      # as tabelas do site e do servidor estão iguais?
node servidor/testes/agente.mjs       # o aprendizado do agente: privacidade, votos, regras, reclamações, painel, limites
```

As `CHAVES_TESTE` são chaves inventadas só para teste. O servidor só aceita essas chaves no
computador (localhost), nunca no site de verdade. `testes/ajudante.mjs` cria as chaves.

## Se der problema

O site continua funcionando mesmo com o servidor fora do ar: as moedas mudam na hora e os
movimentos esperam numa fila no celular até o servidor voltar. Para desligar o servidor de vez,
apague a linha `main = "servidor/index.js"` do `wrangler.toml`. O site volta a funcionar como antes.
