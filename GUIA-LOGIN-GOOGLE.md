# Login com Google: trocar "jogodromo.firebaseapp.com" por "Koda"

Quando a pessoa entra com o Google, aparece o endereço do projeto (`jogodromo.firebaseapp.com`). Isso vem das configurações da conta do Google do projeto, e não do código do site. Só quem é dono do projeto consegue mudar.

## O que dá para mudar agora (uns 5 minutos)

Isso faz a tela do Google dizer **"Continuar para Koda"** em vez do endereço.

1. Entre em https://console.cloud.google.com com a conta dona do projeto.
2. No alto da página, escolha o projeto **jogodromo**.
3. Menu (as três linhas) > **APIs e serviços** > **Tela de consentimento OAuth** (em algumas contas aparece como **Google Auth Platform** > **Branding**).
4. Preencha:
   - **Nome do app:** `Koda`
   - **E-mail de suporte do usuário:** o seu e-mail
   - **Logotipo do app:** deixe em branco por enquanto (se enviar logo, o Google exige verificação do app, que demora dias)
   - **Domínio da página inicial do app:** o endereço do site (por exemplo `https://koda.gamersite.workers.dev`)
   - **Domínios autorizados:** adicione `gamersite.workers.dev` (e o seu domínio próprio, quando tiver)
   - **E-mail de contato do desenvolvedor:** o seu e-mail
5. Salve. Na parte **Público** (ou "Audience"), se estiver **"Em teste"**, toque em **Publicar app** / **Em produção**. Sem isso, só quem você cadastrou como testador consegue entrar.
6. Para login simples (só nome, e-mail e foto), o Google não exige verificação. Se pedir, é porque foi enviado logo ou pediram outras permissões.

## Como saber se funcionou

Abra o site em uma **janela anônima**, toque em entrar com o Google e olhe a frase da primeira tela do Google.
- Antes: "Escolha uma conta para continuar em **jogodromo.firebaseapp.com**"
- Depois: "Escolha uma conta para continuar em **Koda**"

Às vezes o Google demora alguns minutos (até uma hora) para mostrar a mudança. Se você já estiver com o Google aberto no navegador, teste em janela anônima, porque o navegador guarda o texto antigo.

## Se ainda aparecer o endereço antigo

- Confira se o app está **Em produção** (e não "Em teste").
- Confira se o projeto escolhido no alto do Google Cloud é o **jogodromo** (o mesmo do Firebase).
- Tire uma captura da tela do Google e mande para mim: com ela eu vejo exatamente qual parte falta.

## O que ainda vai aparecer

- O endereço `jogodromo.firebaseapp.com` continua aparecendo na **barra da janelinha** de login. Para trocar isso também, é preciso ter um **domínio próprio** (por exemplo `koplay.com`) e configurar o Firebase para usar esse domínio no login. Isso fica para quando você decidir o domínio.
- A tela do Google só diz "accounts.google.com" no endereço da janelinha dela. Isso é do Google e não muda.

## Quando for usar um domínio próprio (para depois)

1. Firebase Console > **Authentication** > **Settings** > **Authorized domains**: adicionar o domínio.
2. No `index.html`, trocar `authDomain: "jogodromo.firebaseapp.com"` pelo domínio novo.
3. No Google Cloud > **APIs e serviços** > **Credenciais** > o cliente OAuth da web: adicionar `https://SEU-DOMINIO/__/auth/handler` em **URIs de redirecionamento autorizados**.
4. O site precisa repassar `/__/auth/*` para `jogodromo.firebaseapp.com` (um redirecionamento simples no Cloudflare).

Se quiser, quando você escolher o domínio eu faço a parte do código e do Cloudflare.
