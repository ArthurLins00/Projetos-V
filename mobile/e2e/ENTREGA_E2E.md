# Entrega individual - Teste E2E

## Identificacao

- Sistema sob teste: Fiscalize Mobile
- Ferramenta: Maestro Studio
- Arquivo do fluxo: `criar-demanda.yaml`
- Perfil utilizado: Cidadao

## Cenario automatizado

O teste representa o fluxo completo de um cidadao que:

1. Faz login no aplicativo.
2. Acessa a tela de nova demanda.
3. Informa titulo, categoria, endereco e descricao.
4. Solicita a localizacao GPS do dispositivo.
5. Concede a permissao de localizacao quando solicitada.
6. Registra a demanda na API.
7. Confirma a mensagem de sucesso.
8. Verifica que a demanda aparece na lista de demandas.

Esse fluxo e relevante porque integra autenticacao, navegacao, formulario, permissao do dispositivo, geolocalizacao, comunicacao com a API e atualizacao da lista apresentada ao usuario.

## Arquivos da entrega

- `criar-demanda.yaml`: fluxo automatizado do Maestro.
- `README.md`: pre-requisitos e instrucoes de execucao.
- `../src/screens/Login.tsx`: identificadores dos elementos de login.
- `../src/screens/Home.tsx`: identificadores da lista e da abertura de demanda.
- `../src/screens/CreatDemand.tsx`: identificadores e estado da captura GPS.
- `../src/services/demandService.ts`: leitura do formato paginado retornado pela API.

## Pre-requisitos

- Docker Desktop em execucao.
- PostgreSQL do projeto ativo no container `fiscalize-postgres`.
- Backend funcionando em `http://localhost:3000`.
- Android Studio com um emulador aberto.
- Expo Go instalado no emulador.
- Maestro Studio instalado.
- Localizacao do Android habilitada.

## Execucao

Inicie o banco:

```powershell
docker start fiscalize-postgres
```

Inicie o backend em um terminal:

```powershell
cd "C:\Users\<seu-usuario>\OneDrive\Documentos\PRO\Projetos-V\backend"
npm.cmd run dev
```

Confirme o backend:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

O resultado deve indicar `status: ok` e `database: connected`.

Inicie o mobile em outro terminal:

```powershell
cd "C:\Users\<seu-usuario>\OneDrive\Documentos\PRO\Projetos-V\mobile"
npm.cmd start
```

Abra o aplicativo no Expo Go do emulador. No Maestro Studio, abra `criar-demanda.yaml` e clique em **Run Test** ou **Run Locally**, conforme a versao instalada.

## Credenciais de teste

```text
E-mail: cidadao@fiscalize.gov.br
Senha: Cidadao@123456
```

## Evidencia de execucao

A execucao deve terminar com todos os passos verdes, incluindo:

- `demand-location-gps-ready` visivel;
- `Demanda registrada com sucesso!` visivel;
- descricao da demanda visivel em `Minhas Demandas`.

Para gravar a demonstracao no Android Emulator:

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb shell screenrecord --time-limit 180 /sdcard/e2e-criar-demanda.mp4
```

Execute o teste enquanto a gravacao estiver ativa. Ao terminar, pressione `Ctrl+C` no terminal da gravacao e copie o video:

```powershell
& $adb pull /sdcard/e2e-criar-demanda.mp4 "$env:USERPROFILE\Desktop\e2e-criar-demanda.mp4"
```

Anexe `e2e-criar-demanda.mp4` junto com este documento e o arquivo YAML.
