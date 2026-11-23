import { buscarCategoriaAtiva, buscarOrgao, encontrarRegraPorTexto } from '../data/acesso';
import type { Prioridade } from '../data/mockData';
import { normalizar, validarCoordenadas } from './utils';

const FERRAMENTA = 'classificar_e_rotear_ocorrencia';

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

export function classificarERotearOcorrencia(args: ClassificarArgs, canal?: string): ClassificacaoResultado {
  const descricao = String(args.descricao ?? '').trim();
  if (descricao.length < 5) {
    throw new Error('A descrição da ocorrência é obrigatória (mínimo de 5 caracteres).');
  }
  const { latitude, longitude } = validarCoordenadas(args.latitude, args.longitude);

  const origem = { ferramenta: FERRAMENTA, canal };
  const { regra, termos } = encontrarRegraPorTexto(normalizar(descricao), origem);
  const categoria = buscarCategoriaAtiva(regra.categoriaId, origem);
  const orgao = buscarOrgao(regra.orgao, origem);

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
    ...(regra.padrao && {
      observacao: 'Nenhuma palavra-chave reconhecida; encaminhado para triagem manual (Outros Problemas).',
    }),
  };
}
