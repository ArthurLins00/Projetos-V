# Relatório de Avaliação - Unidade 1 - Desenvolvimento Mobile

## Resumo do Projeto
O grupo G6 desenvolveu o aplicativo **Fiscalize**, utilizando React Native e Expo SDK 57 para o front-end mobile, consumindo uma API em Node.js com Express e Prisma. O repositório está excelentemente documentado e organizado, com uso rigoroso do padrão arquitetural MVVM. Funcionalidades baseadas em `expo-location` e `expo-camera` estão presentes, e a navegação está estruturada com Expo Router e persistência de dados.

## Membros
- ARTHUR BORBA LINS
- BRUNO FELIPE DE CASTILHO GOMES REGO
- FELIPE CISNEIROS AGOSTINHO
- MICHELANGELO MORAIS DO REGO
- PAULO HENRIQUE ALVES DE BARROS PEREIRA
- THYALLES ARAUJO CAMPOS
- VICTOR SIMAS AZEVEDO DE ALMEIDA
- BRUNO DORNELAS COSTA CIRO DA PENHA
- RAMOM DE OLIVEIRA AGUIAR
- ARTHUR RODRIGUES DE ANDRADE LIMA

## Tabela de Avaliação (Total: 4,0 pontos)

| Critério | Valor Máximo | Nota Atribuída | Observações |
| :--- | :---: | :---: | :--- |
| **Entrega 1 (08/09)** | | | |
| Inclusão do colaborador `mr-costaalencar` | 0,2 | 0,2 | |
| **Entrega 2 (15/09)** | | | |
| Aplicação em React Native/Expo (Android/iOS) | 0,4 | 0,4 | Criado com React Native/Expo em `mobile/`. No `app.json` há restrição expressa para web. |
| Arquitetura clara (MVVM ou MVC) | 0,3 | 0,3 | Organização do MVVM documentada e aplicada no código-fonte. |
| Integração com o backend definido | 0,3 | 0,3 | O app integra e consome o backend local (PostgreSQL e Prisma). |
| **Entrega 3 (22/09)** | | | |
| Implementação de CRUD das ocorrências | 0,4 | 0,4 | Estão presentes criar, pesquisar, editar e excluir (em demandas não ativas). |
| Listagem com componentes nativos | 0,3 | 0,3 | Listado como presente com uso de `FlatList` em `DemandListView.tsx`. |
| Uso de GPS (Expo Location) | 0,3 | 0,3 | Utilizado dentro do viewModel da listagem/criação (`expo-location`). |
| Uso de Câmera (Expo Camera/Image Picker) | 0,3 | 0,3 | Utilizado com componente encapsulado (`CameraCapture.tsx`). |
| **Entrega 4 (29/09)** | | | |
| Navegação com Expo Router | 0,5 | 0,5 | Desenhado sob o diretório `mobile/app`. |
| Persistência/Estado (`useState`, `useEffect`)| 0,5 | 0,5 | Utilizado largamente nos Contextos (`AuthContext`) e nos viewModels. |
| Relatório de Uso de IA | 0,5 | 0,2 | Seção "Declaração de uso de I.A." inclusa no README.md detalhando ferramentas e revisão humana crítica. Entretanto, falta relatório descrevendo os resultados da IA e como foi feito a avaliação humana sobre tais resultados. |
| **TOTAL** |  | **3,7** |  |

## Pontos Positivos
- Arquitetura MVVM com a separação visual descrita em diagramas de texto no README.md.

## Pontos de Melhoria
- Incluir relatório detalhado sobre o uso de IA, descrevendo os resultados obtidos e a avaliação humana sobre tais resultados.
