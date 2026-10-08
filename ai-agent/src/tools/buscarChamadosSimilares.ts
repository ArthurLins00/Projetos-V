import { CATEGORIAS, CHAMADOS, type StatusChamado } from '../data/mockData';
import { distanciaMetros, validarCoordenadas } from './utils';

export const RAIO_MAXIMO_METROS = 200;
const STATUS_FINALIZADOS: StatusChamado[] = ['Resolvido', 'Fechado'];

export interface BuscarArgs {
  categoria_id: number;
  latitude: number;
  longitude: number;
}

/** Projeção pública de um chamado: sem nenhum dado pessoal do solicitante (RN-04). */
export interface ChamadoSimilar {
  protocolo: string;
  distancia_aproximada_metros: number;
  status: StatusChamado;
}

export interface BuscaResultado {
  categoria_id: number;
  categoria: string;
  raio_metros: number;
  total_encontrado: number;
  chamados: ChamadoSimilar[];
}

/**
 * Tool 2 — RF-05, RF-18, RN-04.
 * Lista chamados NÃO finalizados da mesma categoria em até 200 m, retornando
 * apenas protocolo, distância aproximada (arredondada a 10 m) e status.
 */
export function buscarChamadosSimilares(args: BuscarArgs): BuscaResultado {
  const categoriaId = Number(args.categoria_id);
  const categoria = CATEGORIAS.find((c) => c.id === categoriaId && c.ativa);
  if (!Number.isInteger(categoriaId) || !categoria) {
    throw new Error(`Categoria inválida ou inativa: ${args.categoria_id}.`);
  }
  const { latitude, longitude } = validarCoordenadas(args.latitude, args.longitude);

  const chamados = CHAMADOS
    .filter((c) => c.categoriaId === categoriaId && !STATUS_FINALIZADOS.includes(c.status))
    .map((c) => ({ chamado: c, distancia: distanciaMetros(latitude, longitude, c.latitude, c.longitude) }))
    .filter(({ distancia }) => distancia <= RAIO_MAXIMO_METROS)
    .sort((a, b) => a.distancia - b.distancia)
    // Projeção explícita: solicitante/descrição nunca são copiados para a saída.
    .map(({ chamado, distancia }) => ({
      protocolo: chamado.protocolo,
      distancia_aproximada_metros: Math.round(distancia / 10) * 10,
      status: chamado.status,
    }));

  return {
    categoria_id: categoria.id,
    categoria: categoria.nome,
    raio_metros: RAIO_MAXIMO_METROS,
    total_encontrado: chamados.length,
    chamados,
  };
}
