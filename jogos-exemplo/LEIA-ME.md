# Jogos de exemplo do Koda

Quatro jogos prontos, cada um mostra uma coisa que o Koda faz. Cada arquivo é **um jogo inteiro** (um só arquivo `.html`, sem internet, sem imagens de fora): é só copiar tudo e colar no Koda Studio.

## Como usar

1. Abra o **Koda Studio** e toque em **Já tenho o código**.
2. Escreva o nome do jogo, cole o conteúdo do arquivo `.html` na caixa "Cole o código do seu jogo" e toque em **Testar jogo**.
3. Gostou? Toque em **Dar nome e publicar**. Na hora de publicar (ou quando você falar com o seu agente), ele pergunta se você quer adicionar mais alguma coisa ao jogo.

## Os 4 jogos

| # | Jogo | O que mostra | Como jogar |
|---|------|--------------|-----------|
| 1 | **Aventura do Herói** | A **skin**: o herói é o personagem do Koda de quem está jogando (a roupa, o cabelo, tudo que a pessoa escolheu), andando para os 4 lados. | Joystick na tela (ou setas / WASD). Pegue as gemas, fuja das gosmas, não bata nas pedras. |
| 2 | **Padaria do Koda** | A **loja**: biscoito da sorte (100 moedas), bolo gigante (2 diamantes), forno turbo (300 moedas, compra única) e avental dourado (5 diamantes, compra única). | Toque no que o cliente pediu antes da paciência acabar. Toque em **Loja** para comprar e nos itens para usar. |
| 3 | **Arena das Estrelas** | O **online**: todo mundo da sala aparece na mesma arena, cada um com o seu personagem, e disputa as mesmas estrelas. Sem ninguém por perto, dá para **treinar sozinho**. | Mova o personagem (joystick / setas) e encoste nas estrelas. A dourada vale 3. Use **Estou pronto!** para começar. |
| 4 | **Pulo nas Nuvens** | Um jogo **livre**, só com **skin, pontos, recorde e estrelas guardadas na conta**: o herói pula sozinho de nuvem em nuvem, você só escolhe para onde ele vai. | Arraste o dedo para o lado (ou setas / A e D). Nuvem azul anda, marrom quebra, mola dá um pulo gigante. Passarinho: um "!" avisa de que lado ele vem. |

## O que cada jogo usa do Koda

- `KODA.jogador` - o personagem de quem joga (`desenhar`, `andar`, `nome`, `pronto`). Se o personagem ainda não chegou, o jogo desenha um boneco de reserva.
- `KODA.pontuar(n)` - manda os pontos para o ranking quando a partida acaba.
- `KODA.salvar` - guarda o recorde de cada jogo (e as estrelas do jogo 4) na conta de quem joga. Os itens comprados na loja do jogo 2 ficam guardados pela própria loja do Koda.
- `KODA.loja` (jogo 2) - `definir`, `abrir`, `tem`, `quantidade`, `usar`, `aoComprar`.
- `KODA.online` (jogo 3) - `entrar`, `enviar`, `aoReceber`, `aoEntrar`, `aoSair`, `jogadores`, `personagem`, `desenhar`.

## Coisas boas de saber

- **No botão Testar jogo não tem sala online.** O jogo 3 abre no modo "Treinar sozinho" (com 2 robôs). Para ver o online de verdade, publique e entre com mais de uma pessoa (ou dois aparelhos).
- **No Testar jogo a loja é de mentirinha:** nada é cobrado. Depois de publicado, as compras usam as moedas e os diamantes de verdade.
- O Koda reconhece loja e online **pelo texto do código** (`KODA.loja`, `KODA.online.entrar(`). Por isso eles aparecem escritos por extenso nos jogos. Se você trocar por apelidos (por exemplo `var L = KODA.loja` e depois só `L`), mantenha pelo menos uma vez o nome por extenso.
- Nenhum jogo usa `localStorage`: tudo que precisa ficar guardado vai em `KODA.salvar` (limite de 6000 letras).
- Todos rodam na mesma velocidade em telas de 60 e de 120 Hz (iPad Pro).

## Quer mexer neles?

Fale com o seu agente do jeito que você fala, pode usar gíria e abreviação ("vc", "pfv", "blz", "on-line"). Alguns exemplos:

- **Loja** (jogo 2): "deixa tudo em diamantes", "o forno custa 50 moedas", "coloca uma espada por 5 diamantes".
- **Visual**: "deixa em preto e branco", "deixa tudo roxo", "modo noite", "muda o fundo pra verde".
- **Botões e telas**: "coloca um botão de pausa", "botão de som", "tela inicial", "um cronômetro", "põe os botões no canto de baixo".
- **Música**: "coloca música calma" (ou alegre, de aventura, de suspense, espacial, retrô).
- **Números do jogo**: "mais vidas", "começa com 5 vidas", "deixa mais rápido", "pulo mais alto", "deixa mais difícil".
- **Textos**: "traduz pra inglês", "troque \"Game Over\" por \"Acabou!\"", "mostra os pontos na tela".
- **Tudo junto**: "deixa em preto e branco, coloca música e um botão de pausa".
- **Online**: "deixa online" (mostra quem está jogando junto e os pontos de cada um).
- E ainda: "dá uma nota pro meu jogo", "verifica meu código", "joga com minha skin", "faz o jogo salvar".
