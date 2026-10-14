import React from 'react';
import { View, Text, ActivityIndicator, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useManagedTicketViewModel } from '../viewmodels/useManagedTicketViewModel';
import { getPhotoUri } from '../services/api';
import { PhotoCarousel } from '../components/PhotoCarousel';
import { PriorityBadge } from '../components/PriorityBadge';
import { LocationMapModal } from '../components/LocationMapModal';
import { Button, EmptyState, SelectField, StatusBadge, TextField } from '../components/ui';
import { MANAGEABLE_STATUSES, formatSla, isTicketOverdue } from '../models/Management';
import { PERFIL_LABELS } from '../models/User';
import { formatRegion } from '../models/Region';
import { makeStyles, radius, shadow, useTheme } from '../theme';

interface Props {
  ticketId: string;
}

function InfoRow({ icon, label, value, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; danger?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, danger && styles.infoIconDanger]}>
        <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.primary} />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, danger && styles.dangerText]}>{value}</Text>
      </View>
    </View>
  );
}

function Section({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={18} color={colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export function ManagedTicketView({ ticketId }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const vm = useManagedTicketViewModel(ticketId);

  if (vm.loading) {
    return (
      <View style={[styles.flex, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!vm.ticket) {
    return (
      <View style={[styles.flex, styles.centered]}>
        <EmptyState icon="alert-circle-outline" title={vm.error ?? 'Chamado não encontrado.'} />
      </View>
    );
  }

  const { ticket } = vm;
  const photoUris = ticket.fotos.map((photo) => getPhotoUri(photo.url)!);
  const region = formatRegion(ticket.cidade, ticket.uf, ticket.zona);
  const overdue = isTicketOverdue(ticket);
  const statusOptions = MANAGEABLE_STATUSES.filter((s) => s !== ticket.status).map((s) => ({ value: s, label: s }));
  const teamOptions = vm.team
    .filter((m) => m.id !== ticket.responsavel?.id)
    .map((m) => ({ value: m.id, label: `${m.nome} (${PERFIL_LABELS[m.perfil]})` }));
  const organOptions = vm.organs
    .filter((o) => o.id !== ticket.orgao?.id)
    .map((o) => ({ value: o.id, label: `${o.sigla} — ${o.nome}` }));

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {photoUris.length > 0 && <PhotoCarousel uris={photoUris} />}

        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.badges}>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.prioridade} />
            </View>
            <Text style={styles.protocol}>{ticket.protocolo}</Text>
          </View>
          <Text testID="ticket-title" style={styles.title}>{ticket.titulo}</Text>
          <Text style={styles.description}>{ticket.descricao}</Text>
        </View>

        <View style={styles.card}>
          <InfoRow icon="person-circle-outline" label="Responsável" value={ticket.responsavel?.nome ?? 'Ninguém assumiu ainda'} />
          <InfoRow icon="time-outline" label={`Prazo (SLA de ${ticket.slaHoras} h)`} value={`${new Date(ticket.slaDeadline).toLocaleString('pt-BR')} · ${formatSla(ticket.slaDeadline, ticket.status)}`} danger={overdue} />
          <InfoRow icon="business-outline" label="Órgão" value={ticket.orgao ? `${ticket.orgao.sigla} — ${ticket.orgao.nome}` : 'Não definido'} />
          <InfoRow icon="pricetag-outline" label="Categoria" value={ticket.categoria.nome} />
          <InfoRow icon="person-outline" label="Cidadão" value={`${ticket.cidadao.nome} · ${ticket.cidadao.email}`} />
          <InfoRow icon="location-outline" label="Endereço" value={ticket.endereco} />
          {region && <InfoRow icon="earth-outline" label="Município e zona" value={region} />}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver localização no mapa"
            onPress={vm.openMap}
            style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]}
          >
            <View style={styles.infoIcon}>
              <Ionicons name="navigate-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Localização (GPS)</Text>
              <Text style={styles.infoValue}>{ticket.latitude.toFixed(6)}, {ticket.longitude.toFixed(6)}</Text>
            </View>
            <Ionicons name="map-outline" size={20} color={colors.primary} />
          </Pressable>
          <InfoRow icon="calendar-outline" label="Registrado em" value={new Date(ticket.criadoEm).toLocaleString('pt-BR')} />
        </View>

        <Section title="Responsável" icon="people-outline">
          {!vm.isMine && (
            <Button
              testID="ticket-accept"
              icon="hand-left-outline"
              title={ticket.responsavel ? 'Assumir este chamado' : 'Aceitar chamado'}
              onPress={vm.accept}
              loading={vm.busy === 'accept'}
              style={styles.fieldSpacing}
            />
          )}
          <SelectField
            testID="ticket-assign"
            label="Atribuir a outro gestor"
            icon="person-add-outline"
            placeholder="Escolha um gestor ou admin"
            value={null}
            options={teamOptions}
            onSelect={vm.assign}
            loading={vm.busy === 'assign'}
            searchPlaceholder="Buscar pelo nome"
          />
        </Section>

        <Section title="Atualizar status" icon="swap-horizontal-outline">
          <SelectField
            testID="ticket-status"
            label="Novo status"
            icon="flag-outline"
            placeholder="Escolha o novo status"
            value={vm.newStatus}
            options={statusOptions}
            onSelect={vm.setNewStatus}
          />
          <TextField
            testID="ticket-status-note"
            label={vm.newStatus === 'Resolvido' ? 'O que foi feito? (obrigatório)' : 'Justificativa (opcional)'}
            icon="document-text-outline"
            placeholder={vm.newStatus === 'Resolvido' ? 'Ex.: Tubulação substituída pela equipe' : 'Ex.: Aguardando material'}
            value={vm.statusNote}
            onChangeText={vm.setStatusNote}
            multiline
          />
          <Button testID="ticket-status-submit" icon="checkmark-circle-outline" title="Salvar status" onPress={vm.submitStatus} loading={vm.busy === 'status'} disabled={!vm.newStatus} />
        </Section>

        <Section title="Mensagem ao cidadão" icon="chatbubble-ellipses-outline">
          <TextField
            testID="ticket-message"
            icon="create-outline"
            placeholder="Ex.: Equipe agendada para amanhã pela manhã"
            value={vm.message}
            onChangeText={vm.setMessage}
            multiline
            maxLength={1000}
          />
          <Button testID="ticket-message-submit" variant="secondary" icon="send-outline" title="Enviar atualização" onPress={vm.sendMessage} loading={vm.busy === 'comment'} disabled={!vm.message.trim()} />
        </Section>

        <Section title="Encaminhar para outro órgão" icon="git-branch-outline">
          <SelectField
            testID="ticket-transfer-organ"
            label="Órgão de destino"
            icon="business-outline"
            placeholder="Escolha o órgão"
            value={vm.targetOrgan}
            options={organOptions}
            onSelect={vm.setTargetOrgan}
            searchPlaceholder="Buscar órgão"
          />
          <TextField
            testID="ticket-transfer-reason"
            label="Motivo"
            icon="document-text-outline"
            placeholder="Ex.: Ocorrência é de competência estadual"
            value={vm.transferReason}
            onChangeText={vm.setTransferReason}
            multiline
          />
          <Button testID="ticket-transfer-submit" variant="secondary" icon="arrow-redo-outline" title="Encaminhar" onPress={vm.submitTransfer} loading={vm.busy === 'transfer'} disabled={!vm.targetOrgan} />
        </Section>

        {!!ticket.timeline.length && (
          <Section title="Histórico" icon="list-outline">
            {[...ticket.timeline].reverse().map((event, index, events) => {
              const isLast = index === events.length - 1;
              return (
                <View key={event.id} style={styles.timelineItem}>
                  <View style={styles.timelineRail}>
                    <View style={[styles.timelineDot, index === 0 && styles.timelineDotActive]} />
                    {!isLast && <View style={styles.timelineLine} />}
                  </View>
                  <View style={[styles.timelineBody, !isLast && styles.timelineBodySpaced]}>
                    <Text style={styles.logTitle}>{event.titulo ?? event.tipo}</Text>
                    <Text style={styles.logText}>{event.descricao}</Text>
                    <Text style={styles.logDate}>{event.autor} · {new Date(event.timestamp).toLocaleString('pt-BR')}</Text>
                  </View>
                </View>
              );
            })}
          </Section>
        )}

        <LocationMapModal
          visible={vm.mapVisible}
          latitude={ticket.latitude}
          longitude={ticket.longitude}
          address={null}
          onClose={vm.closeMap}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  container: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: colors.surface, padding: 18, borderRadius: radius.lg, marginBottom: 14, ...shadow(1) },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, flexWrap: 'wrap' },
  protocol: { fontSize: 12, fontWeight: '600', color: colors.textSubtle, fontVariant: ['tabular-nums'] },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.4, marginBottom: 8 },
  description: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  infoIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  infoIconDanger: { backgroundColor: colors.dangerSoft },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 12, fontWeight: '600', color: colors.textSubtle },
  infoValue: { fontSize: 15, color: colors.text, marginTop: 1 },
  dangerText: { color: colors.danger, fontWeight: '700' },
  pressed: { opacity: 0.6 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  fieldSpacing: { marginBottom: 16 },
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
}));
