import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OperationalMetrics, formatHours } from '../models/Management';
import { makeStyles, radius, shadow, useTheme } from '../theme';

const TOP_CATEGORIES = 5;

interface Props {
  metrics: OperationalMetrics | null;
  error: boolean;
  onRetry: () => void;
}

export function MetricsPanel({ metrics, error, onRetry }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [expanded, setExpanded] = useState(true);

  const categorias = metrics?.porCategoria.filter((c) => c.total > 0) ?? [];
  const visiveis = categorias.slice(0, TOP_CATEGORIES);
  const outras = categorias.slice(TOP_CATEGORIES).reduce((sum, c) => sum + c.total, 0);
  const maior = Math.max(1, ...visiveis.map((c) => c.total));

  return (
    <View testID="metrics-panel" style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Recolher indicadores' : 'Expandir indicadores'}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((v) => !v)}
        style={styles.header}
      >
        <Ionicons name="stats-chart" size={16} color={colors.primary} />
        <Text style={styles.title}>Indicadores operacionais</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSubtle} />
      </Pressable>

      {expanded &&
        (error && !metrics ? (
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.feedback}>
            <Text style={styles.feedbackText}>Não foi possível carregar os indicadores. Toque para tentar novamente.</Text>
          </Pressable>
        ) : !metrics ? (
          <ActivityIndicator style={styles.feedback} color={colors.primary} />
        ) : (
          <>
            <View style={styles.kpis}>
              <View style={styles.kpi} testID="metric-total">
                <Text style={styles.kpiValue}>{metrics.total}</Text>
                <Text style={styles.kpiLabel}>Total de demandas</Text>
              </View>
              <View style={styles.kpi} testID="metric-resolvidas">
                <Text style={styles.kpiValue}>{metrics.resolvidas + metrics.encerradas}</Text>
                <Text style={styles.kpiLabel}>Concluídas</Text>
              </View>
              <View style={styles.kpi} testID="metric-tempo-medio">
                <Text style={styles.kpiValue}>{formatHours(metrics.mediaHoras)}</Text>
                <Text style={styles.kpiLabel}>Tempo médio de atendimento</Text>
              </View>
            </View>

            <Text style={styles.section}>Distribuição por categoria</Text>
            {visiveis.length === 0 ? (
              <Text style={styles.feedbackText}>Nenhuma demanda registrada ainda.</Text>
            ) : (
              visiveis.map((c) => (
                <View
                  key={c.category}
                  style={styles.barRow}
                  accessible
                  accessibilityLabel={`${c.category}: ${c.total} demandas, ${c.percentage}%`}
                >
                  <View style={styles.barLabelRow}>
                    <Text style={styles.barLabel} numberOfLines={1}>{c.category}</Text>
                    <Text style={styles.barValue}>
                      {c.total} · {c.percentage.toLocaleString('pt-BR')}%
                    </Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${(c.total / maior) * 100}%` }]} />
                  </View>
                </View>
              ))
            )}
            {outras > 0 && <Text style={styles.more}>+ {outras} em outras categorias</Text>}
          </>
        ))}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 16,
    ...shadow(1),
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  feedback: { marginTop: 14 },
  feedbackText: { fontSize: 13, color: colors.textMuted },
  kpis: { flexDirection: 'row', gap: 8, marginTop: 14 },
  kpi: { flex: 1, padding: 10, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, gap: 2 },
  kpiValue: { fontSize: 18, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  kpiLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  section: { fontSize: 12, fontWeight: '700', color: colors.textSubtle, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 16, marginBottom: 8 },
  barRow: { marginBottom: 10 },
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  barLabel: { flex: 1, fontSize: 13, color: colors.text },
  barValue: { fontSize: 12, fontWeight: '600', color: colors.textMuted, fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.primary },
  more: { fontSize: 12, color: colors.textSubtle },
}));
