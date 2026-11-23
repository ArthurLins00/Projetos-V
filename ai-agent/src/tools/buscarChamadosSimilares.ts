import { buscarCategoriaAtiva, listarChamadosAbertosPorCategoria } from '../data/acesso';
import type { StatusChamado } from '../data/mockData';
import { distanciaMetros, validarCoordenadas } from './utils';

export const RAIO_MAXIMO_METROS = 200;
const FERRAMENTA = 'buscar_chamados_similares';

export interface BuscarArgs {
  categoria_id: number;
  latitude: number;
  longitude: number;
}

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

export function buscarChamadosSimilares(args: BuscarArgs, canal?: string): BuscaResultado {
  const origem = { ferramenta: FERRAMENTA, canal };
  const { latitude, longitude } = validarCoordenadas(args.latitude, args.longitude);
  const categoria = buscarCategoriaAtiva(Number(args.categoria_id), origem);

  const chamados = listarChamadosAbertosPorCategoria(categoria.id, origem)
    .map((c) => ({ chamado: c, distancia: distanciaMetros(latitude, longitude, c.latitude, c.longitude) }))
    .filter(({ distancia }) => distancia <= RAIO_MAXIMO_METROS)
    .sort((a, b) => a.distancia - b.distancia)
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
