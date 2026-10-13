export type Zone = 'Urbana' | 'Rural';

export const ZONES: { value: Zone; label: string }[] = [
  { value: 'Urbana', label: 'Zona urbana' },
  { value: 'Rural', label: 'Zona rural' },
];

export const BRAZIL_STATES: { uf: string; nome: string }[] = [
  { uf: 'AC', nome: 'Acre' },
  { uf: 'AL', nome: 'Alagoas' },
  { uf: 'AP', nome: 'Amapá' },
  { uf: 'AM', nome: 'Amazonas' },
  { uf: 'BA', nome: 'Bahia' },
  { uf: 'CE', nome: 'Ceará' },
  { uf: 'DF', nome: 'Distrito Federal' },
  { uf: 'ES', nome: 'Espírito Santo' },
  { uf: 'GO', nome: 'Goiás' },
  { uf: 'MA', nome: 'Maranhão' },
  { uf: 'MT', nome: 'Mato Grosso' },
  { uf: 'MS', nome: 'Mato Grosso do Sul' },
  { uf: 'MG', nome: 'Minas Gerais' },
  { uf: 'PA', nome: 'Pará' },
  { uf: 'PB', nome: 'Paraíba' },
  { uf: 'PR', nome: 'Paraná' },
  { uf: 'PE', nome: 'Pernambuco' },
  { uf: 'PI', nome: 'Piauí' },
  { uf: 'RJ', nome: 'Rio de Janeiro' },
  { uf: 'RN', nome: 'Rio Grande do Norte' },
  { uf: 'RS', nome: 'Rio Grande do Sul' },
  { uf: 'RO', nome: 'Rondônia' },
  { uf: 'RR', nome: 'Roraima' },
  { uf: 'SC', nome: 'Santa Catarina' },
  { uf: 'SP', nome: 'São Paulo' },
  { uf: 'SE', nome: 'Sergipe' },
  { uf: 'TO', nome: 'Tocantins' },
];

export function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

export function findStateUf(region?: string | null): string | null {
  if (!region) return null;
  const normalized = normalizeText(region);
  const byUf = BRAZIL_STATES.find((state) => state.uf.toLowerCase() === normalized);
  if (byUf) return byUf.uf;
  const byName = BRAZIL_STATES.find((state) => {
    const name = normalizeText(state.nome);
    return normalized === name || normalized.endsWith(` ${name}`);
  });
  return byName?.uf ?? null;
}

export function formatRegion(city?: string | null, state?: string | null, zone?: Zone | null) {
  const place = [city, state].filter(Boolean).join('/');
  const zoneLabel = ZONES.find((z) => z.value === zone)?.label;
  return [place, zoneLabel].filter(Boolean).join(' · ') || null;
}
