import React from 'react';
import { View, Text, ActivityIndicator, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDemandDetailViewModel } from '../viewmodels/useDemandDetailViewModel';
import { getPhotoUri } from '../services/api';
import { Button, EmptyState, StatusBadge } from '../components/ui';
import { makeStyles, radius, shadow, useTheme } from '../theme';

interface Props {
  demandId: string;
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export function DemandDetailView({ demandId }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const vm = useDemandDetailViewModel(demandId);

  if (vm.loading) {
    return (
      <View style={[styles.flex, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!vm.demand) {
    return (
      <View style={[styles.flex, styles.centered]}>
        <EmptyState icon="alert-circle-outline" title={vm.error ?? 'Demanda não encontrada.'} />
      </View>
    );
  }

  const { demand } = vm;
  const photoUri = getPhotoUri(demand.photoUrl);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      {photoUri && <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />}

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <StatusBadge status={demand.status} />
          <Text style={styles.protocol}>{demand.protocolo}</Text>
        </View>
        <Text testID="detail-title" style={styles.title}>{demand.title}</Text>
        <Text style={styles.description}>{demand.description}</Text>
      </View>

      <View style={styles.card}>
        <InfoRow icon="pricetag-outline" label="Categoria" value={demand.category?.nome ?? '—'} />
        <InfoRow icon="location-outline" label="Endereço" value={demand.location} />
        <InfoRow icon="navigate-outline" label="Coordenadas (GPS)" value={`${demand.latitude.toFixed(6)}, ${demand.longitude.toFixed(6)}`} />
        <InfoRow icon="time-outline" label="Registrada em" value={new Date(demand.createdAt).toLocaleString('pt-BR')} />
      </View>

      {!!demand.logs?.length && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Histórico</Text>
          {demand.logs.map((log, index) => {
            const isLast = index === demand.logs!.length - 1;
            return (
              <View key={index} style={styles.timelineItem}>
                <View style={styles.timelineRail}>
                  <View style={[styles.timelineDot, index === 0 && styles.timelineDotActive]} />
                  {!isLast && <View style={styles.timelineLine} />}
                </View>
                <View style={[styles.timelineBody, !isLast && styles.timelineBodySpaced]}>
                  <Text style={styles.logTitle}>{log.titulo ?? log.tipo}</Text>
                  <Text style={styles.logText}>{log.descricao}</Text>
                  <Text style={styles.logDate}>{new Date(log.timestamp).toLocaleString('pt-BR')}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {vm.canEdit ? (
        <View style={styles.actions}>
          <Button testID="detail-edit" icon="create-outline" title="Editar" onPress={vm.edit} style={styles.action} />
          <Button testID="detail-delete" variant="danger" icon="trash-outline" title="Excluir" onPress={vm.confirmRemove} loading={vm.deleting} style={styles.action} />
        </View>
      ) : (
        <View style={styles.locked}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
          <Text style={styles.lockedText}>Esta demanda não pode mais ser editada ou removida ({demand.status}).</Text>
        </View>
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  container: { padding: 16, paddingBottom: 40 },
  photo: { width: '100%', height: 220, borderRadius: radius.lg, marginBottom: 14, backgroundColor: colors.surfaceMuted },
  card: { backgroundColor: colors.surface, padding: 18, borderRadius: radius.lg, marginBottom: 14, ...shadow(1) },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  protocol: { fontSize: 12, fontWeight: '600', color: colors.textSubtle, fontVariant: ['tabular-nums'] },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.4, marginBottom: 8 },
  description: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  infoIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 12, fontWeight: '600', color: colors.textSubtle },
  infoValue: { fontSize: 15, color: colors.text, marginTop: 1 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 14 },
  timelineItem: { flexDirection: 'row' },
  timelineRail: { width: 22, alignItems: 'center' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.surface, marginTop: 3 },
  timelineDotActive: { backgroundColor: colors.primary },
  timelineLine: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
  timelineBody: { flex: 1, paddingLeft: 8 },
  timelineBodySpaced: { paddingBottom: 18 },
  logTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  logText: { fontSize: 14, color: colors.textMuted, marginTop: 2, lineHeight: 20 },
  logDate: { fontSize: 12, color: colors.textSubtle, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  lockedText: { flex: 1, fontSize: 14, color: colors.textMuted, lineHeight: 20 },
}));
