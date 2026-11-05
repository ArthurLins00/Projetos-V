import { useEffect, useMemo, useState } from 'react';
import { categoryService } from '../services/categoryService';
import { cityService } from '../services/cityService';
import { Category } from '../models/Category';
import { BRAZIL_STATES, ZONES, Zone } from '../models/Region';
import { SelectOption } from '../components/ui';

export interface DemandFilterParams {
  categoria?: number;
  uf?: string;
  cidade?: string;
  zona?: Zone;
}

/** Filtros de categoria e região compartilhados pelas listas do cidadão e do gestor. */
export function useDemandFilters(onChange?: () => void) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [categoria, setCategoria] = useState<number | undefined>();
  const [uf, setUf] = useState<string | undefined>();
  const [cidade, setCidade] = useState<string | undefined>();
  const [zona, setZona] = useState<Zone | undefined>();

  useEffect(() => {
    categoryService.list().then(setCategories).catch(() => undefined);
  }, []);

  useEffect(() => {
    setCities([]);
    if (!uf) return;
    let active = true;
    setLoadingCities(true);
    cityService
      .listByState(uf)
      .then((list) => active && setCities(list))
      .catch(() => undefined)
      .finally(() => active && setLoadingCities(false));
    return () => {
      active = false;
    };
  }, [uf]);

  const update = <T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    onChange?.();
  };

  const params = useMemo<DemandFilterParams>(
    () => ({
      ...(categoria !== undefined && { categoria }),
      ...(uf && { uf }),
      ...(cidade && { cidade }),
      ...(zona && { zona }),
    }),
    [categoria, uf, cidade, zona]
  );

  const categoryOptions: SelectOption[] = useMemo(
    () => [{ value: '', label: 'Todas as categorias' }, ...categories.map((c) => ({ value: String(c.id), label: c.nome }))],
    [categories]
  );
  const stateOptions: SelectOption[] = useMemo(
    () => [{ value: '', label: 'Todos os estados' }, ...BRAZIL_STATES.map((s) => ({ value: s.uf, label: `${s.nome} (${s.uf})` }))],
    []
  );
  const cityOptions: SelectOption[] = useMemo(
    () => [{ value: '', label: 'Todas as cidades' }, ...cities.map((c) => ({ value: c, label: c }))],
    [cities]
  );
  const zoneOptions: SelectOption[] = useMemo(
    () => [{ value: '', label: 'Todas as zonas' }, ...ZONES.map((z) => ({ value: z.value, label: z.label }))],
    []
  );

  return {
    params,
    active: Object.keys(params).length > 0,
    categoria: categoria === undefined ? null : String(categoria),
    categoriaLabel: categories.find((c) => c.id === categoria)?.nome ?? null,
    uf: uf ?? null,
    cidade: cidade ?? null,
    zona: zona ?? null,
    zonaLabel: ZONES.find((z) => z.value === zona)?.label ?? null,
    categoryOptions,
    stateOptions,
    cityOptions,
    zoneOptions,
    loadingCities,
    selectCategoria: (value: string) => update(setCategoria, value ? Number(value) : undefined),
    selectUf: (value: string) => {
      setCidade(undefined);
      update(setUf, value || undefined);
    },
    selectCidade: (value: string) => update(setCidade, value || undefined),
    selectZona: (value: string) => update(setZona, (value || undefined) as Zone | undefined),
    clear: () => {
      setCategoria(undefined);
      setUf(undefined);
      setCidade(undefined);
      update(setZona, undefined);
    },
  };
}

export type DemandFilters = ReturnType<typeof useDemandFilters>;
