# Entrega Unidade 1 - Desenvolvimento Mobile

## Membros do Projeto
- ARTHUR BORBA LINS
- ARTHUR RODRIGUES DE ANDRADE LIMA
- BRUNO DORNELAS COSTA CIRO DA PENHA
- BRUNO FELIPE DE CASTILHO GOMES REGO
- FELIPE CISNEIROS AGOSTINHO
- MICHELANGELO MORAIS DO REGO
- PAULO HENRIQUE ALVES DE BARROS PEREIRA
- RAMOM DE OLIVEIRA AGUIAR
- THYALLES ARAUJO CAMPOS
- VICTOR SIMAS AZEVEDO DE ALMEIDA

---

## Checklist de Especificações de Entrega

- [x] **Aplicação em React Native utilizando Expo com build para Android e iOS, somente:**
O projeto foi inicializado e estruturado usando React Native com Expo (v57). O arquivo `app.json` possui as configurações baseadas em plataformas móveis com a declaração expressa `"platforms": ["android", "ios"]`.

- [x] **Nada de habilitar o framework para fazer deploy de aplicação PWA ou web:**
Não há configurações ativadas para suporte a web/PWA no arquivo `app.json`. As bibliotecas vitais para rodar web (como `react-native-web` ou `react-dom`) não estão instaladas e estão desativadas neste projeto.

- [x] **Arquitetura MVVM ou MVC:**
O código e o projeto como um todo adotam claramente a arquitetura MVVM, havendo um desacoplamento ideal. O diretório está estruturado com `src/models` para os tipos e entidades de domínio, `src/views` e `src/components` focados na UI e regras de exibição e `src/viewmodels` coordenando as ações, validações e estado. 

- [x] **Integração com o backend:**
Existem integrações HTTP implementadas via `axios` centralizadas na camada de serviços. O arquivo `src/services/api.ts` contém a configuração base com interceptadores e uso de token. Já `demandService.ts` e `authService.ts` gerenciam diretamente os endpoints expostos pelo servidor.

- [x] **Utilização de GPS através do Expo Location:**
A biblioteca `expo-location` está instalada e conta com a permissão correta configurada (`locationWhenInUsePermission`) no `app.json`. O acesso à geolocalização tem seu funcionamento na prática visível através do hook customizado `src/viewmodels/useDemandFormViewModel.ts`.

- [x] **Utilização da camera do dispositivo através do Expo Camera:**
A dependência `expo-camera` foi adicionada ao projeto junto das permissões apropriadas. No próprio aplicativo, a utilização nativa é englobada pelo componente `CameraView`, centralizado em `src/components/CameraCapture.tsx` e invocado no viewmodel da demanda.

- [x] **CRUD com criação, pesquisa, atualização e remoção das ocorrências:**
As rotas de backend referentes ao CRUD de ocorrências estão implementadas na arquitetura. As operações de `create` (Criação), `list`/`getById` (Pesquisa), `update` (Atualização) e `remove` (Remoção) são realizadas dentro de `src/services/demandService.ts`.

- [x] **Listagem das ocorrências utilizando FlatList ou SectionList do React Native:**
O componente de listagem principal consome a API do React Native por meio da importação e uso consistente do componente `<FlatList>`, responsável por iterar os itens, visível diretamente no arquivo `src/views/DemandListView.tsx`.

- [x] **Navegação entre telas utilizando Expo Router:**
Todo o roteamento é baseado em sistema de arquivos gerido pelo `expo-router`. O modelo cria rotas e pilhas a partir dos layouts no diretório base `app/`, isolando as camadas logadas em `(app)` e deslogadas em `(auth)`.

- [x] **Persistência de estado utilizando os hooks nativos do React Native: useState e useEffect:**
Extensivo e consistente uso de `useState` e `useEffect` por toda a base do projeto para controle reativo de tela e componentes — facilmente observáveis nas views, `useDemandFormViewModel.ts` ou ainda garantindo a inicialização da sessão de usuário no `src/contexts/AuthContext.tsx`.

---

## Uso de Inteligência(s) Artificial(is) no Projeto
- [x] Utilização de IA como Google Gemini / Claude para desenvolvimento do projeto
- [ ] Uso do set de skills **superpowers** para o desenvolvimento Spec-Driven Development
- [ ] Declaração de uso de IA no projeto de acordo com as condições estabelecidas no plano de ensino

---

### Uso de Inteligência Artificial na Disciplina

Nesta disciplina, o professor utiliza ferramentas de Inteligência Artificial (IA) como apoio às atividades de ensino — por exemplo, na geração de resumos, imagens ilustrativas de conceitos e mapas mentais —, sempre com revisão
crítica prévia do conteúdo antes de sua utilização em sala de aula. O uso de IA pelos estudantes nas atividades desta disciplina é permitido mediante a declaração, prevista na Política de Governança de IA do CESAR, em atividades de geração de rascunho pela IA seguida de análise crítica (curadoria) do estudante, que deverá emitir parecer próprio sobre os acertos e eventuais erros, imprecisões ou vieses nas informações fornecidas pela ferramenta.

Aplicam-se as seguintes condições, sem as quais o uso não é autorizado:
- **Ferramentas autorizadas**: somente poderão ser utilizadas ferramentas de IA constantes no Catálogo de IA do CESAR, com status de aprovação vigente. O uso de ferramentas não catalogadas é proibido.
- **Proteção de dados**: é expressamente proibida a inserção de dados pessoais, dados pessoais sensíveis ou qualquer informação que permita identificar pessoas (próprias, de colegas, de terceiros ou de participantes de pesquisa) nas ferramentas de IA.
- **Autoria e responsabilidade humana**: o conteúdo gerado pela IA não pode ser apresentado como produção própria do estudante. Cabe ao estudante revisar criticamente o resultado, validar informações e assumir integral responsabilidade pela versão final entregue.
- **Declaração obrigatória**: todo uso de IA nesta atividade deve ser declarado no formato narrativo abaixo, informando a ferramenta utilizada, a finalidade, a etapa da atividade, o tipo de contribuição, a confirmação de que não houve tratamento de dados pessoais, e a confirmação de revisão crítica e responsabilidade humana sobre o resultado final.

Qualquer uso de IA fora do escopo acima descrito (por exemplo, em atividades avaliativas não expressamente autorizadas) é considerado **uso condicionado ou proibido**, conforme o caso, e deverá ser previamente consultado com o professor.

Modelo de declaração a ser incluído na atividade quando houver uso de IA:
_Declaro que utilizei a(s) ferramenta(s) de Inteligência Artificial [informar nome e versão da ferramenta, conforme constante no Catálogo de IA do CESAR] nesta atividade, com a finalidade de gerar um rascunho sobre [tema], sobre o qual realizei análise crítica (curadoria) das informações apresentadas. Não tratei dados pessoais no uso desta ferramenta. Revisei criticamente o conteúdo gerado, identificando seus acertos e eventuais imprecisões, e assumo a responsabilidade integral pela versão final apresentada._
