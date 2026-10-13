const cache = new Map<string, string[]>();

export const cityService = {
  async listByState(uf: string): Promise<string[]> {
    const cached = cache.get(uf);
    if (cached) return cached;

    const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
    if (!response.ok) throw new Error(`IBGE respondeu ${response.status}`);

    const data: { nome: string }[] = await response.json();
    const cities = data.map((city) => city.nome);
    cache.set(uf, cities);
    return cities;
  },
};
