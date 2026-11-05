import { Prisma, zona } from '@prisma/client';
import { AppError } from '../middlewares/errorMiddleware';

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];
export const ZONAS = ['Urbana', 'Rural'] as const;

export interface DemandListFilters {
  categoria?: number;
  uf?: string;
  cidade?: string;
  zona?: zona;
  /** Texto livre de região (legado): procura no endereço, na cidade e na UF. */
  regiao?: string;
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** Lê e valida os filtros de categoria e região da query string das listagens de chamados. */
export function parseDemandListFilters(query: Record<string, unknown>): DemandListFilters {
  const filters: DemandListFilters = {};

  if (query.categoria !== undefined && text(query.categoria) !== '') {
    const categoria = Number(query.categoria);
    if (!Number.isInteger(categoria) || categoria <= 0) throw new AppError(400, 'Categoria inválida.');
    filters.categoria = categoria;
  }

  const uf = text(query.uf).toUpperCase();
  if (uf) {
    if (!UFS.includes(uf)) throw new AppError(400, 'Estado inválido: informe a sigla da UF (ex: PE).');
    filters.uf = uf;
  }

  const cidade = text(query.cidade);
  if (cidade) {
    if (cidade.length > 100) throw new AppError(400, 'Cidade deve ter no máximo 100 caracteres.');
    filters.cidade = cidade;
  }

  const zonaValue = text(query.zona);
  if (zonaValue) {
    if (!(ZONAS as readonly string[]).includes(zonaValue)) throw new AppError(400, "Zona inválida: use 'Urbana' ou 'Rural'.");
    filters.zona = zonaValue as zona;
  }

  const regiao = text(query.regiao);
  if (regiao) filters.regiao = regiao;

  return filters;
}

/** Converte os filtros em condições do Prisma (combinadas com AND pelo chamador). */
export function demandFilterWhere(filters: DemandListFilters): Prisma.chamadoWhereInput[] {
  const and: Prisma.chamadoWhereInput[] = [];
  if (filters.categoria) and.push({ categoriaid: filters.categoria });
  if (filters.uf) and.push({ uf: filters.uf });
  if (filters.cidade) and.push({ cidade: { equals: filters.cidade, mode: 'insensitive' } });
  if (filters.zona) and.push({ zona: filters.zona });
  if (filters.regiao) {
    and.push({
      OR: [
        { endereco: { contains: filters.regiao, mode: 'insensitive' } },
        { cidade: { contains: filters.regiao, mode: 'insensitive' } },
        { uf: { equals: filters.regiao, mode: 'insensitive' } },
      ],
    });
  }
  return and;
}
