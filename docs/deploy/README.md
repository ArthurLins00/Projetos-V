# Deploy do Fiscalize para a demonstração

Este guia diz **exatamente** o que é preciso para deixar o Fiscalize no ar, acessível pela internet, para
uma demonstração na faculdade com **até 5 pessoas testando** ao mesmo tempo. O foco é custo zero (ou quase)
e o mínimo de mudança no projeto: o mesmo `compose.yaml` usado no desenvolvimento roda no servidor, com
três ajustes de produção.

Não é um ambiente para escala nem para dados reais: um único servidor, sem redundância. Para a arquitetura
de produção "de verdade" (banco gerenciado, armazenamento de objetos, cofre de segredos), veja
[`../seguranca-da-informacao/05_Backup_e_Continuidade_de_Operacao.md`](../seguranca-da-informacao/05_Backup_e_Continuidade_de_Operacao.md).

| Arquivo desta pasta | Para quê |
|---|---|
| [`compose.prod.yaml`](compose.prod.yaml) | Ajustes sobre o `compose.yaml`: fecha as portas do banco, do Redis e do backend e acrescenta o Caddy (HTTPS) |
| [`Caddyfile`](Caddyfile) | Proxy reverso: recebe HTTPS no domínio e repassa para o backend |
| [`producao.env.example`](producao.env.example) | Modelo do `.env` de produção, com todas as variáveis que precisam de valor |

---

## 1. Visão geral

```
 Celulares (APK Android / TestFlight iOS)
                │  HTTPS
                ▼
   fiscalize.seudominio.com.br  ──  registro A no DNS (cPanel) → IP do servidor
                │
 ┌──────────────┴───────────────── servidor (VM) ─────────────────────────────┐
 │  Caddy :80/:443  ──►  backend :3000  ──►  PostgreSQL   (volume pgdata)      │
 │  (certificado          │   │    └──────►  Redis        (cache)              │
 │   automático)          │   └──────────►  ai-agent :3333 ──► API do Gemini   │
 │                        └─ fotos em uploads/ (volume uploads) e cron horário │
 └────────────────────────────────────────────────────────────────────────────┘
```

### Por que uma VM com Docker Compose (e não um PaaS gratuito)

O backend guarda as **fotos em disco** (`backend/uploads/`) e roda o **cron** das métricas dentro do
processo. Os planos gratuitos de PaaS (Render, Koyeb e afins) desligam o serviço quando fica parado, apagam
o disco a cada reinício e, no caso do Render, expiram o PostgreSQL gratuito em 30 dias. Usar um deles
exigiria levar as fotos para um armazenamento de objetos e tirar o cron do processo. Uma VM mantém tudo
como está no `compose.yaml`, com disco persistente e processo sempre ligado.

### Custo

| Item | Serviço | Custo |
|---|---|---|
| Servidor | Oracle Cloud *Always Free* (ou VPS barata, seção 2) | R$ 0 (ou ~R$ 25/mês) |
| Domínio | Subdomínio do domínio que já temos no cPanel | R$ 0 |
| HTTPS | Caddy + Let's Encrypt | R$ 0 |
| IA | Gemini, plano gratuito (15 requisições/minuto) | R$ 0 |
| App Android | EAS Build, fila gratuita | R$ 0 |
| App iOS | Conta Apple Developer já existente + TestFlight | R$ 0 a mais |
| Push | Expo Push + Firebase Cloud Messaging | R$ 0 |
| E-mail | Gmail com senha de app | R$ 0 |
| **Total** | | **R$ 0 a ~R$ 25/mês** |

---

## 2. O que providenciar antes

| # | Item | Onde | Observação |
|---|---|---|---|
| 1 | **Servidor Linux** (Ubuntu 24.04, mínimo 2 GB de RAM, 20 GB de disco) | Oracle Cloud ou VPS | Seção 3 |
| 2 | **Subdomínio** (ex.: `fiscalize.seudominio.com.br`) | cPanel → *Zone Editor* | Seção 4 |
| 3 | **Chave do Gemini** | <https://aistudio.google.com/apikey> | Plano gratuito basta |
| 4 | **Senha de app do Gmail** | Conta Google → *Segurança* → *Verificação em duas etapas* → *Senhas de app* | Para os e-mails de código |
| 5 | **Projeto no Firebase** | <https://console.firebase.google.com> | Push no Android (seção 7.3) |
| 6 | **Conta no Expo** (dona do projeto, `owner` no `mobile/app.json`) | <https://expo.dev> | Builds Android e iOS |
| 7 | **Conta Apple Developer** | Já existe (usada em outro app) | iOS pelo TestFlight (seção 8) |

**Opções de servidor:**

- **Oracle Cloud Always Free (recomendado):** VM *Ampere A1* (ARM) com até 4 vCPU e 24 GB de RAM, gratuita
  por tempo indeterminado. O cadastro pede cartão de crédito só para verificação. Às vezes falta capacidade
  na região: tente *Brazil East (São Paulo)* ou *Brazil Southeast (Vinhedo)* e, se der "Out of capacity",
  tente de novo mais tarde ou com 2 vCPU e 12 GB. Todas as imagens usadas (`node:22-bookworm-slim`,
  `postgres:16`, `redis:7`, `caddy:2`) têm versão ARM.
- **Plano B pago:** qualquer VPS com 2 GB de RAM, como a Hetzner CX22 (~€4/mês). Dá para cancelar depois
  da apresentação.

---

## 3. Preparar o servidor

### 3.1 Criar a VM (Oracle Cloud)

1. *Compute* → *Instances* → *Create instance*.
2. *Image*: **Canonical Ubuntu 24.04**. *Shape*: **VM.Standard.A1.Flex** (ex.: 2 OCPU, 12 GB).
3. *Networking*: deixe criar a VCN com sub-rede pública e **atribua IP público**.
4. *Add SSH keys*: envie sua chave pública (ou baixe a gerada). Guarde a chave privada.
5. Depois de criada, anote o **IP público** da instância.

### 3.2 Abrir as portas 80 e 443

Na Oracle é preciso liberar em **dois lugares**:

1. **Na nuvem:** *Networking* → *Virtual cloud networks* → sua VCN → *Security Lists* → *Default Security
   List* → *Add Ingress Rules*: origem `0.0.0.0/0`, protocolo TCP, portas de destino `80,443`. Repita com
   protocolo UDP e porta `443` (HTTP/3, opcional).
2. **Na própria VM** (a imagem Ubuntu da Oracle vem com regras de `iptables` que bloqueiam tudo além do SSH):

   ```bash
   ssh ubuntu@IP_DO_SERVIDOR
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p udp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```

Em uma VPS comum (Hetzner etc.), basta liberar 22, 80 e 443 no firewall do painel ou com `ufw`.
**Não abra** 3000, 5432, 6379 nem 3333: com o `compose.prod.yaml` esses serviços nem escutam fora do Docker.

### 3.3 Instalar Docker e Git

```bash
sudo apt-get update && sudo apt-get install -y git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit   # saia e entre de novo no SSH para o grupo docker valer
```

Confira (o Compose precisa ser **2.24 ou mais novo**):

```bash
docker compose version
```

---

## 4. Apontar o domínio (cPanel)

O domínio fica onde está; só é criado um **registro DNS** novo. O site atual do domínio não é afetado.

1. cPanel → **Zone Editor** → no domínio, **+ A Record**.
2. *Name*: `fiscalize` (vira `fiscalize.seudominio.com.br`). *Address*: o IP público do servidor.
   *TTL*: 300 (ou o padrão).
3. Salve e confira de qualquer computador (pode levar alguns minutos):

   ```bash
   nslookup fiscalize.seudominio.com.br
   ```

> Se os *nameservers* do domínio não forem os da hospedagem do cPanel (por exemplo, estiverem na
> Cloudflare ou no Registro.br), o registro deve ser criado nesse outro painel; o do cPanel não terá efeito.
> No Zone Editor, se os registros `NS` apontam para outro provedor, é esse o caso.

**Por que não hospedar a aplicação no próprio cPanel:** hospedagem compartilhada normalmente não tem Docker
nem Redis, oferece MySQL em vez de PostgreSQL e não mantém processos rodando o tempo todo (o cron e o agente
de IA precisam disso).

---

## 5. Subir a aplicação

### 5.1 Clonar e configurar

```bash
git clone https://github.com/ArthurLins00/Projetos-V.git
cd Projetos-V
cp docs/deploy/producao.env.example .env
nano .env
```

Preencha o `.env` (todas as variáveis estão no [`producao.env.example`](producao.env.example)):

| Variável | Valor |
|---|---|
| `DOMINIO` | O subdomínio da seção 4, sem `https://` |
| `POSTGRES_PASSWORD` | Aleatória: `openssl rand -base64 32`. Só é lida na **primeira** subida |
| `JWT_SECRET` | Aleatória e longa: `openssl rand -base64 48` |
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | `https://` + o subdomínio. Obrigatória em produção (a API não sobe sem ela). O app não envia `Origin`, então não depende disso |
| `DEMO_MODE` | `false`. A API **recusa** `true` com `NODE_ENV=production` |
| `SEED_ON_START` | `true` na primeira subida; o seed não duplica dados |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Login do administrador. **Troque a senha padrão** |
| `SMTP_USER` / `SMTP_PASS` | E-mail do Gmail e a senha de app (16 letras). Sem SMTP, os códigos só aparecem em `docker compose logs backend` |
| `GEMINI_API_KEY` | A chave do AI Studio |
| `AI_AGENT_SECRET` | Aleatório: `openssl rand -hex 32`. O compose passa o mesmo valor ao backend e ao agente |

### 5.2 Subir

```bash
docker compose -f compose.yaml -f docs/deploy/compose.prod.yaml --profile ai up -d --build
```

A primeira vez leva alguns minutos (build das imagens). Na subida, o backend aplica as migrações, roda o
seed e inicia a API; o Caddy pede o certificado HTTPS assim que o backend fica saudável.

Para não repetir os `-f` em todo comando, acrescente ao `.env`:

```bash
COMPOSE_FILE=compose.yaml:docs/deploy/compose.prod.yaml
COMPOSE_PROFILES=ai
```

A partir daí, `docker compose up -d --build`, `docker compose ps` e `docker compose logs` já usam os dois
arquivos e o perfil do agente. Os comandos abaixo assumem essa configuração.

### 5.3 Conferir

```bash
docker compose ps                       # todos "running" / "healthy"
docker compose logs -f backend caddy    # Ctrl+C para sair
curl https://fiscalize.seudominio.com.br/health
```

No navegador, `https://fiscalize.seudominio.com.br/docs` abre o Swagger da API com cadeado de HTTPS.

Problemas comuns:

| Sintoma | Causa provável |
|---|---|
| Caddy não obtém o certificado (`challenge failed` nos logs) | DNS ainda não aponta para o IP, ou portas 80/443 fechadas (revise a seção 3.2, nos dois lugares) |
| Backend reinicia com `Missing required environment variable: ALLOWED_ORIGINS` | `ALLOWED_ORIGINS` vazio no `.env` |
| Backend reinicia com `DEMO_MODE não pode ser usado em produção` | `DEMO_MODE=true` com `NODE_ENV=production` |
| `password authentication failed` no backend | `POSTGRES_PASSWORD` mudou depois que o volume foi criado; volte ao valor antigo ou recrie o volume (apaga os dados) |
| `!reset` não reconhecido | Docker Compose antigo; atualize (seção 3.3) |

---

## 6. Depois de no ar

### 6.1 Ajustes de segurança mínimos

- Depois que o seed rodou uma vez, troque `SEED_ON_START=false` no `.env` e rode `docker compose up -d`.
- Faça login com o admin e confirme que a senha padrão não está em uso.
- Mantenha o SSH só com chave (padrão na Oracle) e não publique o `.env` em lugar nenhum.

### 6.2 Backup diário do banco

Crie a pasta e agende um `pg_dump` diário às 3h, guardando os últimos 7 dias:

```bash
mkdir -p ~/backups
crontab -e
```

Acrescente a linha (ajuste o caminho se clonou em outro lugar):

```cron
0 3 * * * cd ~/Projetos-V && docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > ~/backups/fiscalize-$(date +\%F).sql.gz && find ~/backups -name 'fiscalize-*.sql.gz' -mtime +7 -delete
```

As fotos ficam no volume `uploads`. Para copiá-las junto (opcional):

```bash
docker run --rm -v fiscalize_uploads:/dados -v ~/backups:/destino alpine tar czf /destino/uploads-$(date +%F).tar.gz -C /dados .
```

Restaurar o banco a partir de um backup:

```bash
gunzip -c ~/backups/fiscalize-AAAA-MM-DD.sql.gz | docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
```

### 6.3 Atualizar para uma versão nova

```bash
cd ~/Projetos-V
git pull
docker compose up -d --build
```

As migrações novas são aplicadas sozinhas na subida do backend.

---

## 7. App Android (APK)

### 7.1 URL da API

No APK não existe Metro: a URL vem de `EXPO_PUBLIC_API_URL`, embutida no build. Cadastre-a no ambiente
`preview` do EAS (uma vez), na pasta `mobile/`:

```bash
npx eas-cli login
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://fiscalize.seudominio.com.br --visibility plaintext
```

Se a variável já existir com outro valor (o IP do computador de alguém), atualize-a com
`npx eas-cli env:update` em vez de criar.

### 7.2 Desligar o HTTP sem TLS

Com a API em HTTPS, o `usesCleartextTraffic: true` do plugin `expo-build-properties` em
[`mobile/app.json`](../../mobile/app.json) deixa de ser necessário. Ele foi ligado para o APK falar com o
backend local por HTTP. Para a demonstração, mude para `false` (ou remova o bloco `android` do plugin)
antes de gerar o build.

### 7.3 Push no Android (Firebase)

O Expo Push entrega as notificações no Android pelo Firebase Cloud Messaging. Sem isso, o app funciona,
mas não recebe push.

1. No Firebase, crie um projeto e adicione um **app Android** com o pacote `com.projetosv.fiscalize`.
2. Baixe o `google-services.json`, coloque em `mobile/google-services.json` e acrescente ao `app.json`,
   dentro de `expo.android`: `"googleServicesFile": "./google-services.json"`.
3. No Firebase: *Configurações do projeto* → *Contas de serviço* → *Gerar nova chave privada* (JSON).
4. Envie essa chave ao EAS: `npx eas-cli credentials` → *Android* → *production* ou *preview* →
   *Google Service Account* → *Upload a Google Service Account Key* para **FCM V1**. Não faça commit
   dessa chave.

### 7.4 Gerar e distribuir

Duas formas, com o mesmo resultado:

- **Pela máquina:** `npm run build:apk` em `mobile/` (perfil `preview`). Ao final, o EAS mostra o link e o
  QR code do APK.
- **Pelo GitHub Actions:** publicar uma *release* no GitHub (ex.: tag `v1.0.0`) dispara o
  [`mobile-release.yml`](../../.github/workflows/mobile-release.yml), que gera o APK e o anexa à release.
  Requer o secret `EXPO_TOKEN` no repositório (passo a passo no
  [`mobile/README.md`](../../mobile/README.md#build-empacotado-eas)).

Os testadores baixam o APK e instalam, autorizando "instalar apps de fontes desconhecidas". A fila gratuita
do EAS leva de 10 a 40 minutos por build.

---

## 8. App iOS (TestFlight, com a conta Apple já existente)

Uma conta Apple Developer pode ter vários apps; a anuidade já paga cobre o Fiscalize. O app usa um
*bundle ID* próprio (`com.projetosv.fiscalize` no `app.json`), sem conflito com o outro app da conta.

### 8.1 URL da API e perfil de build

O perfil `preview` do [`eas.json`](../../mobile/eas.json) gera, no iOS, build **só para simulador**. Para
iPhone real pelo TestFlight, use o perfil `production`. Cadastre a URL também nesse ambiente:

```bash
npx eas-cli env:create --environment production --name EXPO_PUBLIC_API_URL --value https://fiscalize.seudominio.com.br --visibility plaintext
```

### 8.2 Registrar o app

No [App Store Connect](https://appstoreconnect.apple.com): *Apps* → **+** → *New App*: plataforma iOS, nome
(ex.: "Fiscalize"), idioma, *bundle ID* `com.projetosv.fiscalize` (se não aparecer na lista, o EAS o
registra no primeiro build; volte aqui depois) e um SKU qualquer (ex.: `fiscalize`).

### 8.3 Build e envio

Em `mobile/`:

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --latest
```

No primeiro build, o EAS pede login na conta Apple e pergunta sobre as credenciais:

- **Certificado de distribuição:** escolha **reutilizar o existente** do outro app. A Apple limita quantos
  certificados de distribuição uma conta pode ter, e um certificado serve para todos os apps da conta.
- **Chave de push (APNs):** também **reutilize a existente**. Uma chave APNs vale para todos os apps da conta
  e o limite de chaves é pequeno.
- **Provisioning profile:** deixe o EAS criar um novo (é por app).

O `eas submit` pergunta o *App Store Connect App ID* (o número em *App Information* → *Apple ID* do app
criado na seção 8.2) e envia o build ao TestFlight. O processamento na Apple leva de 10 a 30 minutos.

### 8.4 Convidar os testadores

No App Store Connect → o app → **TestFlight**:

| Modo | Como | Prós e contras |
|---|---|---|
| **Teste externo** (recomendado) | *External Testing* → criar grupo → adicionar e-mails ou gerar **link público** | O primeiro build passa pela *Beta App Review* (costuma levar até 1 dia; envie com antecedência). Os testadores não ganham acesso à conta |
| Teste interno | *Internal Testing* → adicionar usuários | Sem revisão, mas cada testador precisa ser adicionado como **usuário da conta** no App Store Connect |

Os testadores instalam o app **TestFlight** no iPhone e aceitam o convite. Para a revisão externa, a Apple
pede um login de teste: informe uma conta de cidadão criada no app (com o 2FA por e-mail funcionando, ou
seja, com SMTP configurado).

> O app aparece no TestFlight com o **nome de vendedor da conta Apple**, o mesmo do outro app.

---

## 9. Checklist final

**Servidor e API**

- [ ] VM criada, com IP público e portas 80/443 liberadas (na nuvem **e** no `iptables`)
- [ ] Docker e Compose 2.24+ instalados
- [ ] Registro A `fiscalize.seudominio.com.br` → IP do servidor, propagado (`nslookup`)
- [ ] `.env` de produção preenchido a partir de `producao.env.example`, com senhas aleatórias
- [ ] `docker compose ps` com tudo saudável e `https://.../health` respondendo
- [ ] Login do admin testado e senha padrão trocada
- [ ] `SEED_ON_START=false` depois da primeira subida
- [ ] E-mail de código chegando (SMTP)
- [ ] Chat do assistente respondendo (agente de IA)
- [ ] Backup diário agendado no `crontab`

**Android**

- [ ] `EXPO_PUBLIC_API_URL` com a URL HTTPS no ambiente `preview` do EAS
- [ ] `usesCleartextTraffic` desligado
- [ ] `google-services.json` no app e chave FCM V1 enviada ao EAS
- [ ] APK gerado e testado em um celular real (login, chamado com foto e GPS, push)

**iOS**

- [ ] `EXPO_PUBLIC_API_URL` com a URL HTTPS no ambiente `production` do EAS
- [ ] App criado no App Store Connect com o bundle ID `com.projetosv.fiscalize`
- [ ] Build enviado ao TestFlight reaproveitando certificado e chave APNs da conta
- [ ] Grupo de teste externo aprovado na *Beta App Review* e testadores convidados

**No dia da apresentação**

- [ ] Abrir `https://.../health` antes de começar
- [ ] Ter um backup recente (`ls ~/backups`)
- [ ] Ter as credenciais de admin, gestor e cidadão de demonstração à mão
