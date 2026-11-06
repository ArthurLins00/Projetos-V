# Atividade 5 — Backup e continuidade de operação

| | |
|---|---|
| **Projeto** | Fiscalize — Gestão de Demandas Urbanas |
| **Disciplina** | Segurança de Dados — Unidade 2 |
| **Entrega** | 20/11 |

**Integrantes do grupo:** Felipe Cisneiros Agostinho, Ramom de Oliveira Aguiar, Arthur Borba Lins,
Victor Simas Azevedo de Almeida, Paulo Henrique Alves de Barros Pereira, Michelangelo Morais do Rego,
Bruno Dornelas Costa Ciro da Penha, João Guilherme Aires Chagas de Oliveira, Thyalles Araujo Campos,
Bruno Felipe de Castilho Gomes Rego

---

Este documento define o que o Fiscalize copia, com que frequência, onde guarda as cópias, como as
restaura e como o serviço continua funcionando durante uma falha grave. O objetivo é que nenhuma
demanda registrada por um cidadão se perca e que o atendimento dos órgãos volte rapidamente.

## 1. Inventário de ativos e criticidade

| Ativo | Onde fica | Criticidade | Precisa de backup? |
|---|---|---|---|
| **Banco PostgreSQL** — usuários, chamados, histórico, regras de roteamento, logs de auditoria e de consentimento | Banco gerenciado em nuvem | **Alta** | Sim — principal ativo |
| **Fotos dos chamados e de perfil** | Armazenamento de objetos (pasta `uploads/` em desenvolvimento) | **Alta** | Sim |
| **Código-fonte, migrações (Prisma) e pipeline** | Repositório GitHub | Média | Já versionado; clones locais da equipe servem de cópia extra |
| **Segredos e configuração** (`JWT_SECRET`, SMTP, chave do Gemini, `ALLOWED_ORIGINS`) | Cofre de segredos da nuvem / *secrets* do GitHub | **Alta** | Sim — cópia cifrada e acesso restrito |
| **Cache Redis** | Redis gerenciado | Baixa | Não — é reconstruído automaticamente a partir do banco |
| **Snapshots de métricas** | Tabela no PostgreSQL | Baixa | Coberto pelo backup do banco; pode ser regerado pelo ETL (`runMetricsEtl`) |

## 2. Objetivos de recuperação

| Indicador | Definição | Meta |
|---|---|---|
| **RPO** (*Recovery Point Objective*) | Quanto de dado podemos perder no pior caso | **≤ 15 minutos** para o banco; **≤ 24 horas** para fotos |
| **RTO** (*Recovery Time Objective*) | Quanto tempo até o serviço voltar | **≤ 4 horas** em desastre total; **≤ 30 minutos** para falha de uma instância ou do banco primário |

## 3. Política de backup

### 3.1 Regra 3-2-1

- **3 cópias** dos dados: a produção e duas cópias de backup;
- em **2 mídias/serviços diferentes**: snapshots do banco gerenciado e arquivos de *dump* em
  armazenamento de objetos;
- **1 cópia fora da região** principal (outra região da nuvem), protegida contra desastre regional.

### 3.2 Rotina por ativo

| Ativo | Tipo | Frequência | Retenção |
|---|---|---|---|
| PostgreSQL | *Point-in-time recovery* (WAL contínuo) | Contínuo | 7 dias |
| PostgreSQL | Snapshot completo automático | Diário (03h, baixa demanda) | 30 dias |
| PostgreSQL | *Dump* lógico (`pg_dump`) cifrado, cópia em outra região | Semanal | 12 semanas |
| PostgreSQL | *Dump* mensal de arquivo | Mensal | 12 meses |
| Fotos | Versionamento do *bucket* + replicação entre regiões | Contínuo | 30 dias para versões apagadas |
| Segredos | Exportação cifrada do cofre | A cada alteração | Última versão + 2 anteriores |

### 3.3 Segurança das cópias

- Todas as cópias são **criptografadas com AES-256** (mesma política de dados em repouso da
  Atividade 2) e trafegam por TLS.
- O acesso aos backups é restrito a **dois administradores de infraestrutura**, com 2FA obrigatório;
  a conta que escreve os backups não consegue apagá-los (**imutabilidade/WORM** por 30 dias),
  protegendo contra *ransomware* e exclusão acidental ou maliciosa.
- Toda restauração ou download de backup gera registro de auditoria.

### 3.4 Backup e LGPD

- Os backups contêm dados pessoais e seguem as mesmas regras do banco de produção.
- Quando um cidadão exclui a conta (Atividade 3, Fluxo 5), os dados são anonimizados na produção
  imediatamente; nas cópias, eles **expiram com a retenção** (no máximo 12 meses). Se um backup
  antigo for restaurado, o procedimento obriga a **reaplicar as exclusões/anonimizações** registradas
  depois da data da cópia antes de liberar o sistema.
- Os logs de consentimento são preservados no backup, pois servem de prova legal.

## 4. Testes de restauração

Backup que nunca foi restaurado não é backup. Por isso:

- **Mensalmente:** restaurar o snapshot mais recente num ambiente isolado de homologação, rodar as
  migrações do Prisma e a suíte de testes de API/E2E contra ele, e conferir contagens de usuários,
  chamados e fotos.
- **Semestralmente:** simulação completa de desastre (perda da região principal), cronometrando o RTO
  real e comparando com a meta.
- Cada teste gera um relatório com data, responsável, tempo gasto e problemas encontrados.

## 5. Plano de continuidade de operação

### 5.1 Cenários e respostas

| Cenário | Impacto | Resposta | Tempo esperado |
|---|---|---|---|
| Queda de uma instância da API | Nenhum perceptível | O balanceador detecta pelo `/health` e direciona o tráfego às outras instâncias | Automático (< 1 min) |
| Falha do banco primário | API responde `503` | *Failover* automático para a réplica | < 5 min |
| Queda do Redis | Respostas mais lentas | Cache desativado automaticamente; consultas vão ao banco | Sem ação |
| Agente de IA ou Gemini fora do ar | Assistente indisponível | Mensagem amigável no app; demais funções seguem | Sem ação |
| SMTP ou Expo Push fora do ar | E-mails e notificações atrasam | Chamados continuam sendo registrados; reenvio após normalização | Sem ação |
| Corrupção ou exclusão de dados (erro humano, *bug*, ataque) | Dados incorretos | Restauração *point-in-time* para o momento anterior ao evento | < 2 h |
| *Ransomware* / comprometimento da conta de nuvem | Ambiente inteiro suspeito | Isolar o ambiente, girar todos os segredos, recriar a infraestrutura e restaurar do backup imutável em outra região | < 4 h |
| Perda da região de nuvem | Serviço fora do ar | Subir a infraestrutura na região secundária a partir do código (GitHub) e do último backup replicado | < 4 h |

### 5.2 Continuidade do lado do cidadão

- **Idempotência com `client_uuid`:** se o cidadão registrar uma demanda durante uma instabilidade,
  o app reenvia a requisição quando a conexão volta, e o backend não duplica o chamado.
- **Sessão persistente:** os tokens ficam no armazenamento seguro do aparelho, então o cidadão não
  precisa refazer login depois de uma queda curta do servidor.
- **Canal alternativo:** durante indisponibilidade prolongada, o app e as redes da prefeitura informam
  o telefone/central de atendimento dos órgãos para casos urgentes (ex.: vazamento grave, fiação
  exposta).

### 5.3 Papéis e comunicação

| Papel | Responsabilidade |
|---|---|
| **Coordenador do incidente** | Decide acionar o plano, prioriza ações e autoriza a restauração |
| **Responsável técnico** | Executa o *failover*, a restauração e a validação pós-restauração |
| **Comunicação** | Atualiza a página de status, avisa os gestores dos órgãos e, havendo dados pessoais envolvidos, prepara a comunicação à ANPD e aos titulares |

### 5.4 Retorno à normalidade

1. Validar a integridade dos dados restaurados (contagens, últimos chamados, fotos acessíveis).
2. Reaplicar as anonimizações pendentes (seção 3.4).
3. Rodar os testes de *smoke* da pipeline contra o ambiente restaurado.
4. Reabrir o tráfego gradualmente e monitorar o `/health` e os tempos de resposta.
5. Registrar o relatório pós-incidente com causa raiz, tempos reais (RPO/RTO) e melhorias.

## 6. Revisão do plano

Este plano é revisado **a cada semestre**, após cada teste de desastre e sempre que um novo componente
(serviço externo, banco, armazenamento) for adicionado à arquitetura.
