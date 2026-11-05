// Metas das métricas de qualidade (docs/testes/Metricas_de_Qualidade.md). Lidas pelo cálculo
// (collect-metrics.mjs) e pelos relatórios (render-reports.mjs); mudar uma meta é só aqui.

export const TARGETS = {
  passRate: 100, // MQ-01, %
  coverage: { lines: 85, branches: 80 }, // MQ-02, %
  flaky: 0, // MQ-03
  durationMinutes: { 'CI/CD': 10, 'Regressão completa (diária)': 60 }, // MQ-04, mediana de 30 dias
  pipelineSuccessRate: 95, // MQ-05, %
  mttrHours: 2, // MQ-06
  openHighPriority: 0, // MQ-07
  vulnerabilities: { critical: 0, high: 0 }, // MQ-08
};

// Janela das métricas que olham para trás (MQ-04 a MQ-06) e tamanho do histórico de tendência
export const WINDOW_DAYS = 30;
export const HISTORY_LIMIT = 60;

// Workflows cujas execuções em main entram na taxa de sucesso e na duração
export const TRACKED_WORKFLOWS = [
  { file: 'ci.yml', name: 'CI/CD' },
  { file: 'regressao.yml', name: 'Regressão completa (diária)' },
];
