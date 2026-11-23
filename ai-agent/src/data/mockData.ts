// Tipos do domínio do agente. Os dados em si ficam em arquivos JSON versionados (ai-agent/dados/)
// e só são lidos pelas funções de acesso de src/data/acesso.ts.

export type Prioridade = 'Baixa' | 'Média' | 'Alta' | 'Crítica';
export type StatusChamado = 'Aberto' | 'Em Análise' | 'Em Andamento' | 'Resolvido' | 'Fechado';

export interface Categoria {
  id: number;
  nome: string;
  ativa: boolean;
}

export interface Orgao {
  sigla: string;
  nome: string;
  slaHoras: number;
}

export interface RegraRoteamento {
  id: string;
  categoriaId: number;
  subcategoria: string;
  orgao: string;
  prioridade: Prioridade;
  slaHoras: number;
  palavrasChave: string[];
  emergencia?: boolean;
  padrao?: boolean;
}

export interface ChamadoRegistrado {
  protocolo: string;
  categoriaId: number;
  status: StatusChamado;
  latitude: number;
  longitude: number;
  bairro: string;
  descricao: string;
  solicitanteId: string;
  abertoEm: string;
}

/** Pontos usados nos casos de teste (CT-01, CT-02 e CT-03). */
export const PONTOS = {
  boaViagem: { latitude: -8.1197, longitude: -34.8986 },
  ruaDaAurora: { latitude: -8.0597, longitude: -34.8811 },
  madalena: { latitude: -8.0545, longitude: -34.9105 },
};
