# Teste E2E com Maestro

## Cenário

`criar-demanda.yaml` automatiza o fluxo principal de um cidadão:

1. Faz login com uma conta criada pelo seed.
2. Abre a tela de nova demanda.
3. Preenche título, categoria, endereço e descrição.
4. Captura a localização pelo GPS.
5. Registra a demanda.
6. Verifica a mensagem de sucesso e a demanda na lista inicial.

Esse fluxo cobre autenticação, navegação, preenchimento de formulário, permissão do dispositivo, integração com a API e atualização da lista de demandas.

## Pré-requisitos

1. Docker Desktop em execução com o PostgreSQL:

   ```powershell
   docker start fiscalize-postgres
   ```

2. Backend iniciado na porta `3000` e com o health check retornando `database: connected`.
3. Banco preparado com `npx.cmd prisma migrate deploy` e `npm.cmd run seed`.
4. Android Studio com um emulador aberto.
    Para o Maestro, prefira uma imagem Android API 34; a imagem API 37 do `Medium_Phone` pode nao ser suportada pela versao atual.
5. Expo Go instalado no emulador ou um development build do aplicativo.
6. Localização do emulador habilitada. Nas configurações do emulador, defina uma localização simulada se o GPS não retornar.
7. No desenvolvimento para Android Emulator, configure `EXPO_PUBLIC_API_URL` em `mobile/.env`:

   ```ts
   EXPO_PUBLIC_API_URL=http://10.0.2.2:3000
   ```

## Executar pelo Maestro Studio

1. Inicie o backend:

   ```powershell
   npm.cmd run dev
   ```

2. Inicie o Expo em outro terminal:

   ```powershell
   npm.cmd start
   ```

3. Abra o projeto no Expo Go do emulador e deixe a tela de login visível.
4. Abra `mobile/E2E/criar-demanda.yaml` no Maestro Studio.
5. Clique em **Run Locally**.

## Executar pela CLI

Com o emulador conectado e o projeto aberto no Expo Go:

```powershell
maestro test .\E2E\criar-demanda.yaml
```

O fluxo usa `host.exp.exponent`, que é o identificador do Expo Go no Android. Se o projeto for convertido para um development build com outro `applicationId`, atualize o campo `appId` do YAML.

## Dados utilizados

```text
E-mail: cidadao@fiscalize.gov.br
Senha:  Cidadao@123456
```

## Evidencias de execucao

Os dois prints anexados junto desta entrega registram a execucao bem-sucedida do fluxo no Maestro Studio:

1. O fluxo percorre login, abertura da nova demanda, preenchimento dos campos e captura da localizacao GPS.
2. O fluxo conclui com todos os passos verdes, registra a demanda e confirma sua exibicao em `Minhas Demandas`.

As evidencias foram obtidas no Android Emulator com o backend conectado ao PostgreSQL e o aplicativo aberto pelo Expo Go.
