import { CATEGORIAS, ORGAOS, REGRAS, REGRA_PADRAO, type Prioridade } from '../data/mockData';
import { normalizar, validarCoordenadas } from './utils';

export interface ClassificarArgs {
  descricao: string;
  latitude: number;
  longitude: number;
}

export interface ClassificacaoResultado {
  categoria_id: number;
  categoria: string;
  subcategoria: string;
  orgao_sigla: string;
  orgao_nome: string;
  prioridade: Prioridade;
  sla_horas: number;
  emergencia: boolean;
  termos_identificados: string[];
  localizacao: { latitude: number; longitude: number };
  observacao?: string;
}

/**
 * Tool 1 — RF-01, RF-02, RF-03, RF-04, RF-07, RN-01, RN-03.
 * Classifica a descrição em uma categoria ATIVA, aplica a regra de competência
 * (órgão + SLA) e define a prioridade (Crítica quando há gatilho de emergência).
 */
export function classificarERotearOcorrencia(args: ClassificarArgs): ClassificacaoResultado {
  const descricao = String(args.descricao ?? '').trim();
  if (descricao.length < 5) {
    throw new Error('A descrição da ocorrência é obrigatória (mínimo de 5 caracteres).');
  }
  const { latitude, longitude } = validarCoordenadas(args.latitude, args.longitude);

  const texto = normalizar(descricao);
  const ativas = new Set(CATEGORIAS.filter((c) => c.ativa).map((c) => c.id));

  let regra = REGRA_PADRAO;
  let termos: string[] = [];
  for (const candidata of REGRAS) {
    if (!ativas.has(candidata.categoriaId)) continue; // RN-01: só categorias ativas
    const encontrados = candidata.palavrasChave.filter((p) => texto.includes(p));
    if (encontrados.length > 0) {
      regra = candidata;
      termos = encontrados;
      break;
    }
  }

  const categoria = CATEGORIAS.find((c) => c.id === regra.categoriaId)!;
  const orgao = ORGAOS[regra.orgao];

  return {
    categoria_id: categoria.id,
    categoria: categoria.nome,
    subcategoria: regra.subcategoria,
    orgao_sigla: orgao.sigla,
    orgao_nome: orgao.nome,
    prioridade: regra.prioridade,
    sla_horas: regra.slaHoras,
    emergencia: Boolean(regra.emergencia),
    termos_identificados: termos,
    localizacao: { latitude, longitude },
    ...(regra === REGRA_PADRAO && {
      observacao: 'Nenhuma palavra-chave reconhecida; encaminhado para triagem manual (Outros Problemas).',
    }),
  };
}
