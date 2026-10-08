import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Demand } from '../models/Demand';
import { getPhotoUri } from '../services/api';
import { StatusBadge } from './ui';
import { makeStyles, radius, shadow, useTheme } from '../theme';

interface Props {
  demand: Demand;
  onPress: () => void;
}

export function DemandCard({ demand, onPress }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const photoUri = getPhotoUri(demand.photoUrl);

  return (
    <Pressable
      testID="demand-card"
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      {photoUri && <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />}
      <View style={styles.body}>
        <View style={styles.header}>
          <View style={styles.category}>
            <Ionicons name="pricetag" size={12} color={colors.primary} />
            <Text style={styles.categoryText} numberOfLines={1}>{demand.category?.nome}</Text>
          </View>
          <StatusBadge status={demand.status} />
        </View>

        <Text style={styles.title} numberOfLines={2}>{demand.title}</Text>
        <Text style={styles.description} numberOfLines={2}>{demand.description}</Text>

        <View style={styles.meta}>
          <Ionicons name="location-outline" size={14} color={colors.textSubtle} />
          <Text style={styles.metaText} numberOfLines={1}>{demand.location}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.protocol}>{demand.protocolo}</Text>
          <View style={styles.meta}>
            <Ionicons name="calendar-outline" size={13} color={colors.textSubtle} />
            <Text style={styles.metaText}>{new Date(demand.createdAt).toLocaleDateString('pt-BR')}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, marginBottom: 14, overflow: 'hidden', ...shadow(1) },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  photo: { width: '100%', height: 150, backgroundColor: colors.surfaceMuted },
  body: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 },
  category: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  categoryText: { fontSize: 12, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.4, flexShrink: 1 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 4, letterSpacing: -0.2 },
  description: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  metaText: { fontSize: 13, color: colors.textMuted, flexShrink: 1 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.surfaceMuted },
  protocol: { fontSize: 12, fontWeight: '600', color: colors.textSubtle, fontVariant: ['tabular-nums'] },
}));
