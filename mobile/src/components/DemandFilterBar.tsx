import React from 'react';
import { Pressable, Text } from 'react-native';
import { ScrollableRow, SelectField } from './ui';
import { DemandFilters } from '../viewmodels/useDemandFilters';
import { makeStyles } from '../theme';

interface Props {
  filters: DemandFilters;
  testID?: string;
}

/** Linha de filtros por categoria e região (UF, cidade e zona). */
export function DemandFilterBar({ filters, testID = 'demand-filters' }: Props) {
  const styles = useStyles();

  return (
    <ScrollableRow testID={testID} contentContainerStyle={styles.row}>
      <SelectField
        variant="chip"
        testID={`${testID}-categoria`}
        label="Categoria"
        icon="pricetag-outline"
        placeholder="Categoria"
        value={filters.categoria}
        displayValue={filters.categoriaLabel}
        options={filters.categoryOptions}
        onSelect={filters.selectCategoria}
        searchPlaceholder="Buscar categoria..."
      />
      <SelectField
        variant="chip"
        testID={`${testID}-uf`}
        label="Estado"
        icon="map-outline"
        placeholder="Estado"
        value={filters.uf}
        displayValue={filters.uf}
        options={filters.stateOptions}
        onSelect={filters.selectUf}
        searchPlaceholder="Buscar estado..."
      />
      {!!filters.uf && (
        <SelectField
          variant="chip"
          testID={`${testID}-cidade`}
          label="Cidade"
          icon="business-outline"
          placeholder="Cidade"
          value={filters.cidade}
          options={filters.cityOptions}
          onSelect={filters.selectCidade}
          loading={filters.loadingCities}
          searchPlaceholder="Buscar cidade..."
        />
      )}
      <SelectField
        variant="chip"
        testID={`${testID}-zona`}
        label="Zona"
        icon="location-outline"
        placeholder="Zona"
        value={filters.zona}
        displayValue={filters.zonaLabel}
        options={filters.zoneOptions}
        onSelect={filters.selectZona}
      />
      {filters.active && (
        <Pressable
          testID={`${testID}-limpar`}
          accessibilityRole="button"
          accessibilityLabel="Limpar filtros de categoria e região"
          hitSlop={8}
          onPress={filters.clear}
          style={styles.clear}
        >
          <Text style={styles.clearText}>Limpar</Text>
        </Pressable>
      )}
    </ScrollableRow>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { paddingBottom: 14, gap: 8, alignItems: 'center' },
  clear: { paddingHorizontal: 8, paddingVertical: 8 },
  clearText: { fontSize: 13, fontWeight: '700', color: colors.primary },
}));
