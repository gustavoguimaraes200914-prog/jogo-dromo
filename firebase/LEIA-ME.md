# Regras do Firestore (banco do Koplay)

Esta pasta **não vai para o ar com o site** (está no `.assetsignore`).

- `firestore.rules` — as regras novas (precisam ser publicadas no Firebase).
- `firestore.rules.original` — cópia das regras que estavam no ar antes destas mudanças (pra comparar ou voltar).

## O que mudou
- **Peças vendidas por diamantes**: `pecasCriadas` e `pecasVendas` aceitam o campo `moeda` (`'d'` = diamantes).
- **Vídeo no chat em partes**: coleção nova `midias` (cada parte do vídeo; só quem está na conversa manda e vê).
- **Jogo em dupla**: coleção nova `projetosDupla` (os dois membros leem e editam) e `gameSubmissions`
  aceita o envio de qualquer um dos dois para o jogo `dupla_<projeto>`, com o campo `coautores`.

## Como publicar (pelo navegador)
1. Firebase Console → projeto **jogodromo** → **Firestore Database** → aba **Regras** (Rules).
2. Apague tudo, cole o conteúdo de `firestore.rules` e toque em **Publicar** (Publish).

Ordem: publique as **regras** e os **workers** (`agente/` e `multiplayer/`) antes do **site**.
