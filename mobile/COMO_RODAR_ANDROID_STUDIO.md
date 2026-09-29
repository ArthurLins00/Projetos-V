# Como rodar o app (Fiscalize) no Android Studio

O app é Expo (SDK 57) com build nativo **somente para Android e iOS** — não há build web.
Como ele usa módulos nativos (câmera, GPS, SecureStore), rodamos um *development build*
gerado pelo `expo prebuild` e compilado pelo Android Studio.

---

## 0) Atenção ao caminho da pasta (Windows)

No Windows o build nativo **falha** em dois casos:

- **Caminho com acentos** (ex.: `Área de Trabalho`) → o `expo prebuild` dá
  `Project file "MainApplication" does not exist in android project`.
- **Caminho longo** → a compilação C++ (CMake) estoura o limite de 260 caracteres do Windows e dá
  `CreateProcess error=2 ... prefab_command.bat`.

Clone o repositório num caminho **curto, sem acentos, sem espaços e fora do OneDrive**:

```bash
git clone <url-do-repositorio> C:\dev\pv
```

---

## 1) Pré-requisitos

| Ferramenta | Observação |
|---|---|
| Node.js 20+ | inclui o npm |
| Android Studio | instala o SDK, o emulador e o JDK (JBR 21) |
| PostgreSQL | para o backend (veja `backend/COMO_RODAR_O_BACK.md`) |

### 1.1) Configurar o Android Studio

1. Abra o Android Studio → **More Actions → SDK Manager**.
2. Aba **SDK Platforms**: marque a versão mais recente do Android (API 35/36).
3. Aba **SDK Tools**: marque **Android SDK Build-Tools**, **Android SDK Platform-Tools**,
   **Android Emulator** e **Android SDK Command-line Tools**. Clique em **Apply**.
4. **More Actions → Virtual Device Manager → Create Device**: escolha um Pixel,
   uma imagem de sistema com **Google Play/Google APIs** (necessária para o GPS) e finalize.

### 1.2) Variáveis de ambiente (Windows)

Em *Painel de Controle → Sistema → Variáveis de ambiente* crie (usuário):

```
ANDROID_HOME = C:\Users\<seu-usuario>\AppData\Local\Android\Sdk
JAVA_HOME    = C:\Program Files\Android\Android Studio\jbr
```

E adicione ao `Path`:

```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\emulator
```

Feche e reabra o terminal. Confira com `adb --version` e `java -version` (deve ser 17 ou 21).

---

## 2) Subir o backend

Siga `backend/COMO_RODAR_O_BACK.md`. Resumo:

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run dev
```

O `backend/.env` precisa ter pelo menos `DATABASE_URL` e `JWT_SECRET`.
O servidor sobe em `http://localhost:3000` (teste em `http://localhost:3000/health`).

O seed cria o usuário de teste **cidadao@fiscalize.gov.br / Cidadao@123456**
(é o usado pelo botão "Entrar como Cidadão (Teste)" da tela de login em modo dev).

---

## 3) Configurar o app

```bash
cd mobile
npm install
```

**URL do backend:** não precisa configurar. O app usa automaticamente o IP do computador que roda
o Metro (porta 3000) — funciona no emulador, em celulares Android e no **Expo Go do iPhone**.
No emulador conectado via `127.0.0.1`/`adb reverse`, ele usa `10.0.2.2` (o "localhost" do PC visto do emulador).

Só defina `EXPO_PUBLIC_API_URL` no `mobile/.env` se o backend estiver em outra máquina:

```env
EXPO_PUBLIC_API_URL=http://192.168.0.5:3000
```

> Ao mudar o `.env`, reinicie o Metro com `npx expo start -c`.
> Em modo dev, a URL usada aparece no log do Metro: `[api] Backend: http://...`.

---

## 4) Gerar o projeto Android nativo

```bash
npx expo prebuild --platform android
```

Isso cria a pasta `mobile/android/` (ela está no `.gitignore` e pode ser regerada a qualquer momento).
Rode de novo sempre que alterar o `app.json` ou instalar uma biblioteca nativa.

---

## 5) Rodar pelo Android Studio

1. Em um terminal, dentro de `mobile/`, inicie o Metro (servidor do JavaScript):
   ```bash
   npx expo start --dev-client
   ```
   Deixe esse terminal aberto.
2. Abra o Android Studio → **Open** → selecione a pasta **`mobile/android`** (não a raiz do repositório).
3. Aguarde o **Gradle Sync** terminar (a primeira vez demora alguns minutos).
   Se ele reclamar do JDK: *File → Settings → Build, Execution, Deployment → Build Tools → Gradle →
   Gradle JDK* → selecione **jbr-21**.
4. No topo, selecione o emulador criado no passo 1.1 (ou um celular conectado por USB
   com **Depuração USB** ativada).
5. Clique em **Run ▶ (app)**. O Android Studio compila, instala e abre o app, que se conecta ao Metro.

> Se o app abrir com tela vermelha "Unable to load script", confirme que o Metro está rodando
> e execute `adb reverse tcp:8081 tcp:8081`.

### Alternativa pela linha de comando

Com o emulador aberto, um único comando faz prebuild + build + instalação + Metro:

```bash
npx expo run:android
```

---

## 6) Testando as funcionalidades

| Requisito | Onde ver no app |
|---|---|
| Login / persistência de sessão | Faça login, feche e reabra o app: continua logado (SecureStore + `useState`/`useEffect`) |
| Listagem (FlatList) | Tela **Minhas Demandas** |
| Pesquisa | Campo de busca e filtros de status na mesma tela |
| Criar | Botão **+** → preencha → **📍 Pegar GPS** → **📷 Foto** → **Registrar Demanda** |
| GPS (Expo Location) | Botão **📍 Pegar GPS** — preenche coordenadas e sugere o endereço |
| Câmera (Expo Camera) | Botão **📷 Foto** abre a câmera do dispositivo |
| Detalhe / Atualizar | Toque numa demanda → **✏️ Editar** |
| Remover | Toque numa demanda → **🗑️ Excluir** (some da lista; aparece em "Removidas") |

**GPS no emulador:** clique em **⋯ (Extended controls) → Location**, escolha um ponto no mapa
e clique **Set Location** antes de tocar em "Pegar GPS".

**Câmera no emulador:** a pré-visualização mostra uma cena virtual, mas **a foto capturada sai preta**
(com só um carimbo de data/hora). É uma limitação da câmera emulada do Android com o CameraX
(usado pelo Expo Camera) — o mesmo código funciona em aparelho real. Para demonstrar a câmera,
use um celular (Android com o APK de debug ou iPhone com Expo Go) ou tente trocar a câmera do emulador
pela webcam do PC: *Virtual Device Manager → ✏️ editar o dispositivo → More/Advanced Settings →
Camera → Back: Webcam0* (reinicie o emulador depois).

Edição e exclusão só são permitidas enquanto a demanda estiver *Aberto*, *Em Análise* ou *Aguardando*
(regra do backend).

---

## 7) Problemas comuns

| Sintoma | Solução |
|---|---|
| `Project file "MainApplication" does not exist` | Caminho com acento — veja o passo 0 |
| "Não foi possível conectar ao servidor" no login | Backend parado; celular em outra rede Wi-Fi; `EXPO_PUBLIC_API_URL` apontando para o lugar errado; ou firewall do Windows bloqueando a porta 3000 (libere o Node.js para redes Privadas **e** Públicas) |
| Expo Go no iPhone não abre o projeto | O Expo Go precisa ser do SDK 57; celular e PC na mesma rede; se a rede isolar dispositivos, use `npx expo start --tunnel` (nesse caso o backend também precisa de URL pública em `EXPO_PUBLIC_API_URL`) |
| `SDK location not found` | Configure `ANDROID_HOME` ou crie `mobile/android/local.properties` com `sdk.dir=C:\\Users\\<usuario>\\AppData\\Local\\Android\\Sdk` |
| `Unsupported class file major version` | JDK errado — use o JBR 21 do Android Studio (passo 1.2 / Gradle JDK) |
| Mudei o `app.json` e nada mudou | `npx expo prebuild --platform android --clean` e rode de novo |
| "Usuário não possui perfil de cidadão" ao criar | Use uma conta de cidadão (registro pelo app ou o usuário do seed) |
