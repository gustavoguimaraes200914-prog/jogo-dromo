# Jogos de teste de moedas

10 jogos pequenos (1,6 a 2,4 KB cada) para testar o Agente do Koda GB com moedas:

| # | Jogo | O que tem | O que testar |
|---|------|-----------|--------------|
| 01 | Mineração de Ouro | `gold`, placar "Ouro:", loja própria (Picareta/Ajudante) | achar a moeda, trocar pela do Koda GB, valor, aparência |
| 02 | Caça-Gemas | gemas desenhadas no canvas (losango), sem loja | forma/cor da gema, valor, loja com vários itens |
| 03 | Estrelas do Espaço | `stars` (★), sem loja | achar moeda sem compras, forma/cor, valor |
| 04 | Fábrica de Biscoitos | `cookies` (emoji), melhorias compráveis | converter compras, trocar o emoji |
| 05 | Pulo das Moedas | moedas redondas no canvas | cor, forma, valor, loja |
| 06 | Cofre do Dragão | `money` ($), loja com 4 itens | converter, valor, símbolo |
| 07 | Fazendinha | dinheiro (R$) e sementes | duas moedas, converter, valor (colheita) |
| 08 | Cristais Mágicos | `crystals` (placar só), sem loja | símbolo no placar, valor, loja |
| 09 | Corrida de Fichas | `tokens` desenhados no canvas | forma/cor, valor, loja |
| 10 | Loja Dupla | moedas + diamantes, loja feita com uma lista | converter a loja em lista para o Koda GB |

Pedidos para os testes (português):

- `troca as moedas do jogo pelas do Koda GB`
- `deixa a moeda azul` / `moeda em forma de estrela` / `moeda quadrada roxa`
- `cada moeda vale 10`
- `faz uma loja com vários itens`
- `a cada clique eu ganho 1 Koda Coin`  → o agente **tem que recusar** (nenhum jogo dá moeda do Koda GB de graça)

Cada pedido que muda o jogo leva alguns segundos, com as etapas na tela; dá para fechar a conversa que o agente continua e avisa quando termina.
