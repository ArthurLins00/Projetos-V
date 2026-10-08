/**
 * Dados em memória que simulam o banco do Fiscalize.
 * Espelham o seed do backend (backend/prisma/seed.ts): categorias, órgãos,
 * regras de competência (roteamento) e alguns chamados já registrados.
 */

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

/** Regra de competência: subcategoria → órgão + prioridade (RF-04 / RN-03). */
export interface RegraRoteamento {
  categoriaId: number;
  subcategoria: string;
  orgao: string;
  prioridade: Prioridade;
  slaHoras: number;
  /** Termos (sem acento, minúsculos) que identificam a subcategoria no texto do cidadão. */
  palavrasChave: string[];
  /** Gatilho de emergência urbana: força prioridade Crítica (RN-03). */
  emergencia?: boolean;
}

export interface ChamadoRegistrado {
  protocolo: string;
  categoriaId: number;
  status: StatusChamado;
  latitude: number;
  longitude: number;
  // Dados pessoais do solicitante: existem na base, mas NUNCA saem pelas ferramentas (RN-04).
  solicitante: { nome: string; cpf: string; telefone: string };
  descricao: string;
}

export const CATEGORIAS: Categoria[] = [
  { id: 1, nome: 'Infraestrutura', ativa: true },
  { id: 2, nome: 'Água e Esgoto', ativa: true },
  { id: 3, nome: 'Iluminação Pública', ativa: true },
  { id: 4, nome: 'Saneamento Básico', ativa: true },
  { id: 5, nome: 'Sinalização', ativa: true },
  { id: 6, nome: 'Outros Problemas', ativa: true },
  { id: 7, nome: 'Poda de Árvores (descontinuada)', ativa: false },
];

export const ORGAOS: Record<string, Orgao> = {
  EMLURB: { sigla: 'EMLURB', nome: 'Empresa de Manutenção e Limpeza Urbana do Recife', slaHoras: 72 },
  COMPESA: { sigla: 'COMPESA', nome: 'Companhia Pernambucana de Saneamento', slaHoras: 48 },
  CELPE: { sigla: 'CELPE', nome: 'Companhia Energética de Pernambuco', slaHoras: 24 },
  CTTU: { sigla: 'CTTU', nome: 'Autarquia de Trânsito e Transporte Urbano do Recife', slaHoras: 48 },
  SEMC: { sigla: 'SEMC', nome: 'Secretaria Executiva de Manutenção da Cidade do Recife', slaHoras: 72 },
};

/**
 * Regras avaliadas em ordem: as de emergência primeiro, depois as mais específicas.
 * A primeira regra cujo termo aparece no texto vence.
 */
export const REGRAS: RegraRoteamento[] = [
  // ── Gatilhos de emergência urbana (RN-03 → Crítica) ──
  {
    categoriaId: 3, subcategoria: 'Fiação exposta com risco elétrico', orgao: 'CELPE', prioridade: 'Crítica', slaHoras: 4, emergencia: true,
    palavrasChave: ['fiacao exposta', 'fio exposto', 'fios expostos', 'fio desencapado', 'fios desencapados', 'fio caido', 'fios caidos', 'fio solto', 'fios soltos', 'cabo partido', 'risco de choque'],
  },
  {
    categoriaId: 2, subcategoria: 'Esgoto a céu aberto', orgao: 'COMPESA', prioridade: 'Crítica', slaHoras: 12, emergencia: true,
    palavrasChave: ['esgoto em via', 'esgoto na via', 'esgoto na rua', 'esgoto a ceu aberto', 'esgoto transbordando', 'esgoto estourado', 'adutora rompida'],
  },
  {
    categoriaId: 1, subcategoria: 'Árvore caída bloqueando via', orgao: 'EMLURB', prioridade: 'Crítica', slaHoras: 6, emergencia: true,
    palavrasChave: ['arvore caida', 'arvore caiu', 'arvore tombou'],
  },
  {
    categoriaId: 1, subcategoria: 'Afundamento / cratera na via', orgao: 'EMLURB', prioridade: 'Crítica', slaHoras: 12, emergencia: true,
    palavrasChave: ['cratera', 'afundamento', 'desabamento', 'deslizamento'],
  },
  {
    categoriaId: 5, subcategoria: 'Semáforo apagado em cruzamento', orgao: 'CTTU', prioridade: 'Crítica', slaHoras: 6, emergencia: true,
    palavrasChave: ['semaforo apagado', 'semaforo desligado', 'sinal apagado'],
  },

  // ── Regras comuns ──
  { categoriaId: 3, subcategoria: 'Poste inclinado ou tombado', orgao: 'CELPE', prioridade: 'Alta', slaHoras: 24, palavrasChave: ['poste inclinado', 'poste tombado', 'poste torto'] },
  { categoriaId: 3, subcategoria: 'Poste piscando', orgao: 'CELPE', prioridade: 'Baixa', slaHoras: 72, palavrasChave: ['piscando', 'pisca'] },
  { categoriaId: 3, subcategoria: 'Poste apagado', orgao: 'CELPE', prioridade: 'Média', slaHoras: 48, palavrasChave: ['poste apagado', 'postes apagados', 'lampada queimada', 'rua escura', 'sem iluminacao', 'iluminacao', 'poste'] },
  { categoriaId: 2, subcategoria: 'Falta de água no bairro', orgao: 'COMPESA', prioridade: 'Alta', slaHoras: 24, palavrasChave: ['falta de agua', 'sem agua', 'torneira seca'] },
  { categoriaId: 2, subcategoria: 'Vazamento de água na rua', orgao: 'COMPESA', prioridade: 'Alta', slaHoras: 24, palavrasChave: ['vazamento', 'vazando', 'cano estourado', 'agua jorrando'] },
  { categoriaId: 2, subcategoria: 'Bueiro entupido', orgao: 'COMPESA', prioridade: 'Média', slaHoras: 48, palavrasChave: ['bueiro', 'esgoto', 'mau cheiro'] },
  { categoriaId: 1, subcategoria: 'Calçada danificada', orgao: 'EMLURB', prioridade: 'Média', slaHoras: 72, palavrasChave: ['calcada'] },
  { categoriaId: 1, subcategoria: 'Buraco na pista', orgao: 'EMLURB', prioridade: 'Alta', slaHoras: 48, palavrasChave: ['buraco', 'asfalto', 'pavimentacao', 'pista esburacada'] },
  { categoriaId: 4, subcategoria: 'Acúmulo de lixo / entulho', orgao: 'EMLURB', prioridade: 'Média', slaHoras: 72, palavrasChave: ['lixo', 'entulho', 'coleta', 'descarte irregular'] },
  { categoriaId: 5, subcategoria: 'Sinalização danificada', orgao: 'CTTU', prioridade: 'Média', slaHoras: 48, palavrasChave: ['placa', 'faixa de pedestre', 'faixa apagada', 'semaforo', 'sinalizacao'] },
];

/** Regra padrão quando nenhuma palavra-chave é reconhecida. */
export const REGRA_PADRAO: RegraRoteamento = {
  categoriaId: 6, subcategoria: 'Não classificado', orgao: 'SEMC', prioridade: 'Baixa', slaHoras: 72, palavrasChave: [],
};

// ── Pontos de referência usados nos casos de teste ──
export const PONTOS = {
  boaViagem: { latitude: -8.1197, longitude: -34.8986 }, // Av. Boa Viagem
  ruaDaAurora: { latitude: -8.0597, longitude: -34.8811 }, // Rua da Aurora
  madalena: { latitude: -8.0545, longitude: -34.9105 }, // Madalena (sem chamados próximos)
};

/** Desloca um ponto N metros para norte/leste (aproximação plana, suficiente para < 1 km). */
function deslocar(base: { latitude: number; longitude: number }, norteM: number, lesteM: number) {
  const mPorGrauLat = 111_320;
  const mPorGrauLon = 111_320 * Math.cos((base.latitude * Math.PI) / 180);
  return { latitude: base.latitude + norteM / mPorGrauLat, longitude: base.longitude + lesteM / mPorGrauLon };
}

export const CHAMADOS: ChamadoRegistrado[] = [
  // Iluminação Pública perto da Av. Boa Viagem
  { protocolo: 'DEM-20260921-A7K2', categoriaId: 3, status: 'Em Andamento', ...deslocar(PONTOS.boaViagem, 80, 0), solicitante: { nome: 'Maria Souza', cpf: '12345678901', telefone: '81999990001' }, descricao: 'Poste soltando faísca' },
  { protocolo: 'DEM-20260930-Q3MZ', categoriaId: 3, status: 'Aberto', ...deslocar(PONTOS.boaViagem, 0, -150), solicitante: { nome: 'João Lima', cpf: '98765432100', telefone: '81999990002' }, descricao: 'Fios pendurados no poste' },
  { protocolo: 'DEM-20260815-B1TT', categoriaId: 3, status: 'Resolvido', ...deslocar(PONTOS.boaViagem, 30, 30), solicitante: { nome: 'Ana Costa', cpf: '11122233344', telefone: '81999990003' }, descricao: 'Lâmpada queimada (já resolvido)' },
  { protocolo: 'DEM-20261002-ZZ90', categoriaId: 3, status: 'Aberto', ...deslocar(PONTOS.boaViagem, 600, 0), solicitante: { nome: 'Pedro Alves', cpf: '55566677788', telefone: '81999990004' }, descricao: 'Poste apagado (fora do raio)' },
  // Outra categoria no mesmo local (não deve aparecer em buscas de Iluminação)
  { protocolo: 'DEM-20261001-C4RR', categoriaId: 1, status: 'Aberto', ...deslocar(PONTOS.boaViagem, 50, 50), solicitante: { nome: 'Luiza Melo', cpf: '99988877766', telefone: '81999990005' }, descricao: 'Buraco na calçada' },

  // Água e Esgoto perto da Rua da Aurora
  { protocolo: 'DEM-20261003-E8SG', categoriaId: 2, status: 'Em Análise', ...deslocar(PONTOS.ruaDaAurora, -120, 0), solicitante: { nome: 'Carlos Rocha', cpf: '44455566677', telefone: '81999990006' }, descricao: 'Esgoto correndo na rua' },
  { protocolo: 'DEM-20260710-F0CH', categoriaId: 2, status: 'Fechado', ...deslocar(PONTOS.ruaDaAurora, 40, 0), solicitante: { nome: 'Beatriz Nunes', cpf: '33344455566', telefone: '81999990007' }, descricao: 'Vazamento (encerrado)' },
];
