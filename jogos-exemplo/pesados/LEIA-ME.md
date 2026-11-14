# 10 jogos pesados para testar o Agente do Koda GB

Jogos grandes (15 a 26 KB cada, 400 a 650 linhas): mundo gerado, inimigos, fases, chefes, lojas próprias, menus e partículas. Nenhum usa nada do Koda GB: é o agente que coloca. Cada jogo foi feito para testar **uma função** do agente num código pesado.

Como testar: abra a sua conta, toque em **Criar jogo** e depois em **Já tenho o código**, cole o jogo, toque no agente e mande as frases da tabela, uma de cada vez. Toque em **Testar jogo** depois de cada uma.

| # | Jogo | Função do agente | O que mandar | O que tem que acontecer |
|---|------|------------------|--------------|-------------------------|
| 01 | **Mina Profunda** (cavar, minérios, oficina com 5 melhorias por nível) | Trocar a moeda do jogo pela do Koda GB e mudar o valor | `troca as moedas do jogo pelas do Koda GB` → `Usar moedas do Koda GB` → `cada moeda vale 5` | A loja do Koda GB ganha **5 itens** (Broca, Tanque, Mochila, Casco, Motor), cada um com o preço de começo. Comprar sobe o nível e para no nível máximo. O baú passa a dar 5 vezes mais moedas. |
| 02 | **Arena dos Slimes** (ondas, chefe, melhorias por nível de XP) | Loja com vários itens que funcionam | `faz uma loja com vários itens` | Botão **Loja** no canto. Vida extra e Tênis turbo continuam valendo quando a partida começa (o jogo zera o herói no começo e mesmo assim o bônus fica). |
| 03 | **Corrida Neon** (3 pistas em perspectiva, poderes) | Jogar com a skin | `joga com minha skin` | O corredor vira o seu personagem do Koda GB, no lugar dele (a sombra continua embaixo). |
| 04 | **Masmorra Sem Fim** (roguelike por turnos, mochila, andares sorteados) | Salvar a jornada | `faz o jogo salvar` | Feche e abra o jogo: ao entrar na masmorra você continua no mesmo andar, nível, XP e ouro. Se perder, a próxima partida começa do zero (o recorde fica). |
| 05 | **Esquadrilha Estelar** (nave, 3 tipos de inimigo, chefe por fase) — **sem nenhum som** | Sons e música | `coloca sons no jogo` → `coloca música de aventura` | Sons de tiro, explosão, poder, fase nova, dano, ponto e fim de jogo. Música de aventura com botão de som no canto. |
| 06 | **Kart Turbo** (6 karts, 3 voltas, derrapagem, itens) | Jogo online / ranking | `deixa online` | Placar online no canto. Os pontos vão pro ranking **só quando você cruza a chegada** (quando um kart do computador termina, não manda nada). |
| 07 | **Fazenda Feliz** (plantar, bichos, dia e noite, moedas no chão) | Aparência da moeda | `moeda em forma de estrela` e depois `deixa a moeda azul` | As moedas do chão viram estrelas / ficam azuis, e o "●" do placar e dos preços muda junto. O 💰 do botão Vender **não** muda (não é a moeda). |
| 08 | **Blocos Mágicos** (peças que caem, peça guardada, conquistas) — cheio de texto | Traduzir | `traduz pra inglês` | Uns 20 textos traduzidos (títulos, combos, conquistas, menus). O agente avisa quais frases longas ficaram em português e como trocar: `troque "frase" por "outra"`. |
| 09 | **Cavaleiro das Torres** (4 torres, espinhos, plataformas que andam e que caem) | Mudar números do jogo | `pulo mais alto`, `mais vidas`, `deixa mais difícil` | Pulo de 430 para 559. Vidas de 3 para 5 (também quando recomeça). "Mais difícil" deixa os **inimigos** mais rápidos e tira uma vida (o cavaleiro não fica mais rápido). |
| 10 | **Cidade Ociosa** (idle: 8 prédios, 8 melhorias, prestígio) | A trava do Koda GB + verificar + nota | `a cada clique eu ganho 1 Koda Coin`, `verifica meu código`, `dá uma nota pro meu jogo` | O agente **recusa** dar moeda do Koda GB por clique. A verificação diz que está tudo certo e a nota vem com o que está bom e dicas. Extra: `troca as moedas do jogo pelas do Koda GB` vira 16 itens na loja (8 prédios + 8 melhorias). |

## Capas

Na pasta `capas/` tem uma capa para cada jogo (imagem de 640 x 640, mesmo nome do jogo). Para usar: no Studio, toque na caixa da **capa** e escolha a imagem (ou mande a imagem pro agente no chat). O Studio corta para quadrado, 4:3 ou em pé, e o título e o desenho principal ficam inteiros nos três formatos.

## Teste mais pesado: tudo junto

Em qualquer um deles (melhor no 02, 05 ou 09), mande em sequência:

`faz uma loja com vários itens` → `joga com minha skin` → `faz o jogo salvar` → `coloca sons no jogo` → `coloca música de aventura` → `deixa online` → `deixa mais difícil` → `traduz pra inglês`

São 8 mudanças em cima do mesmo código grande. O jogo tem que continuar rodando sem erro no **Testar jogo**.

## O que foi melhorado no agente com estes jogos

Esses jogos acharam pontos fracos do agente, que foram corrigidos:

- Loja de melhorias por nível (`comprar(k)`, `PREDIOS.find(...)`): agora vira um item por melhoria ou prédio, com o nome certo, e a trava de "nível máximo" continua valendo.
- Botões de compra que ficavam apagados por falta de moeda do jogo agora acendem quando quem paga é o Koda GB.
- Jogos que zeram tudo ao começar a partida (`Object.assign(heroi, {...})`): a loja e o salvar continuam valendo.
- Skin: acha o herói pelo nome da função (`desenharCorredor`, `desenharRobo`...), pula a sombra e entra no lugar certo.
- Sons: tiro, explosão, poder e fase nova (antes eram só ponto, pulo, dano e fim).
- A resposta da "música de aventura" estava com a frase errada (a de quando a pessoa manda um áudio).
- Ranking: em jogo de corrida, só manda os pontos quando quem joga termina.
- Aparência da moeda: moeda que gira (ellipse) muda de forma; o "●" do placar muda; o 💰 de outro botão não muda.
- Tradução: muito mais palavras de jogo, texto com HTML dentro e aviso do que ficou sem traduzir.
- "Mais difícil": acha a velocidade dos inimigos (`velocidadeInimigo`) e entende que `k = cavaleiro` é o herói.
- Contador de "total ganho" (`dinheiroTotal`) não é mais confundido com uma segunda moeda.
