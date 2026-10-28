# Atividade 2 — Gerenciamento de dados em repouso / anonimização de informações

| | |
|---|---|
| **Projeto** | Fiscalize — Gestão de Demandas Urbanas |
| **Disciplina** | Segurança de Dados — Unidade 1 |
| **Entrega** | 11/09 |

**Integrantes do grupo:** Felipe Cisneiros Agostinho, Ramom de Oliveira Aguiar, Arthur Borba Lins,
Victor Simas Azevedo de Almeida, Paulo Henrique Alves de Barros Pereira, Michelangelo Morais do Rego,
Bruno Dornelas Costa Ciro da Penha, João Guilherme Aires Chagas de Oliveira, Thyalles Araujo Campos,
Bruno Felipe de Castilho Gomes Rego

---

## 1. Princípios de minimização de dados e ciclo de vida

A arquitetura do Fiscalize foi projetada para garantir a privacidade dos cidadãos por meio de
princípios de **minimização** e **segregação** de dados sensíveis e pessoais (PII).

- **Isolamento entre Cadastro e Recomendação:** o Módulo de Recomendação de Triagem utiliza
  exclusivamente a descrição do problema, as coordenadas geográficas e os metadados contextuais das
  demandas. Os dados pessoais do cidadão (e-mail, CPF, nome completo ou telefone) são estritamente
  excluídos do fluxo e do processamento de recomendação/triagem.
- **Persistência temporária de textos sensíveis:** o texto em claro da descrição enviado para
  triagem é mantido em tabelas temporárias/logs operacionais por **no máximo 24 horas**. Após esse
  prazo, o conteúdo textual da requisição é purgado ou submetido a um processo irreversível de
  hashing/anonimização.

## 2. Técnicas de criptografia e hashing em repouso (*data at rest*)

### 2.1 Anonimização e integridade de texto via hashing criptográfico

Para permitir auditorias de duplicidade, cálculo de métricas de qualidade e detecção de padrões sem
armazenar a descrição do cidadão em texto puro, utiliza-se **hashing unidirecional**.

- O campo `descricaoHash` é gerado e armazenado nas tabelas de auditoria de recomendações
  (`RecommendationEvent`).
- Esse hash permite correlacionar e checar reincidências de demandas idênticas sem expor a descrição
  em texto limpo nem permitir a reversão dos dados.

### 2.2 Proteção do banco de dados relacional (PostgreSQL)

- **Criptografia em nível de disco/volume (TDE):** os volumes do PostgreSQL e os *storages* de
  backup mantidos em nuvem são obrigatoriamente criptografados com **AES-256**, gerenciado pelo
  ecossistema de nuvem.
- **Criptografia nas conexões internas:** além do repouso, as conexões entre a aplicação Node.js e o
  PostgreSQL utilizam canal seguro **TLS/SSL**, impedindo a interceptação de pacotes em trânsito.

## 3. Generalização e anonimização de dados de localização (Geohash)

As coordenadas geográficas exatas (latitude e longitude de precisão submétrica) informadas na
abertura de um chamado têm potencial de identificar a residência ou a rotina de um cidadão.

- **Conversão em Geohash:** para a persistência de históricos de auditoria, relatórios de viés por
  bairro/região e localização de chamados semelhantes, as coordenadas são convertidas num Geohash de
  precisão reduzida (6 a 7 caracteres, cobrindo uma área aproximada de 150 m a 1,2 km).
- **Monitoramento de viés seguro:** o cálculo da proporção da categoria "Outros Problemas" agrega
  exclusivamente dados de Geohash e identificadores anônimos de recomendação, garantindo que nenhum
  cidadão seja reidentificado durante a geração de relatórios administrativos por região.

## 4. Práticas de segregação, sanitização e logs seguros

A política de registros operacionais e auditoria impede a gravação não intencional de dados pessoais
ou confidenciais.

- **Sanitização de logs:** é proibido gravar senhas, tokens de sessão JWT, fotos, nomes, documentos
  (CPF) ou descrições completas não sanitizadas em arquivos de log de produção.
- **Rastreabilidade por ID criptográfico:** a correlação entre requisição e resposta é feita
  estritamente por um identificador único de recomendação no formato **UUIDv4**.
- **Proteção em respostas de chamados semelhantes:** quando o sistema sugere chamados similares ao
  gestor ou ao cidadão, a API omite qualquer elemento de identificação pessoal de terceiros,
  limitando o retorno a categoria, prioridade, status e localização aproximada.
