import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ManagedTicket, formatSla, isTicketOverdue } from '../models/Management';
import { PriorityBadge } from './PriorityBadge';
import { StatusBadge } from './ui';
import { makeStyles, radius, shadow, useTheme } from '../theme';

interface Props {
  ticket: ManagedTicket;
  onPress: () => void;
}

export function ManagedTicketCard({ ticket, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const overdue = isTicketOverdue(ticket);

  return (
    <Pressable
      testID="managed-ticket-card"
      accessibilityRole="button"
      accessibilityLabel={`Chamado ${ticket.protocolo}: ${ticket.titulo}`}
      style={({ pressed }) => [styles.card, overdue && styles.cardOverdue, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.header}>
        <StatusBadge status={ticket.status} />
        <PriorityBadge priority={ticket.prioridade} />
      </View>

      <Text style={styles.title} numberOfLines={2}>{ticket.titulo}</Text>
      <Text style={styles.category} numberOfLines={1}>
        {ticket.categoria.nome}
        {ticket.orgao ? ` · ${ticket.orgao.sigla}` : ''}
      </Text>

      <View style={styles.meta}>
        <Ionicons name="location-outline" size={14} color={colors.textSubtle} />
        <Text style={styles.metaText} numberOfLines={1}>{ticket.endereco}</Text>
      </View>
      <View style={styles.meta}>
        <Ionicons name="person-outline" size={14} color={colors.textSubtle} />
        <Text style={styles.metaText} numberOfLines={1}>
          {ticket.responsavel ? `Responsável: ${ticket.responsavel.nome}` : 'Sem responsável'}
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.protocol}>{ticket.protocolo}</Text>
        <View style={styles.meta}>
          <Ionicons name="time-outline" size={13} color={overdue ? colors.danger : colors.textSubtle} />
          <Text style={[styles.metaText, overdue && styles.overdueText]}>{formatSla(ticket.slaDeadline, ticket.status)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'transparent', ...shadow(1) },
  cardOverdue: { borderColor: colors.dangerSoft },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  category: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 2, marginBottom: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1, marginTop: 2 },
  metaText: { fontSize: 13, color: colors.textMuted, flexShrink: 1 },
  overdueText: { color: colors.danger, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.surfaceMuted },
  protocol: { fontSize: 12, fontWeight: '600', color: colors.textSubtle, fontVariant: ['tabular-nums'] },
}));
