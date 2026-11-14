const cache = new Map<string, string[]>();

// Sem limite, uma rede lenta deixava o seletor girando para sempre e o campo de texto livre (plano B do
// formulário quando o IBGE falha) nunca aparecia
const IBGE_TIMEOUT_MS = 8000;

export const cityService = {
  async listByState(uf: string): Promise<string[]> {
    const cached = cache.get(uf);
    if (cached) return cached;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IBGE_TIMEOUT_MS);
    try {
      const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`IBGE respondeu ${response.status}`);

      const data: { nome: string }[] = await response.json();
      const cities = data.map((city) => city.nome);
      cache.set(uf, cities);
      return cities;
    } finally {
      clearTimeout(timer);
    }
  },
};
