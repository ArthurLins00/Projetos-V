import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Demand, STATUS_COLORS } from '../models/Demand';

interface Props {
  demand: Demand;
  onPress: () => void;
}

export function DemandCard({ demand, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.category}>{demand.category?.nome}</Text>
        <Text style={[styles.status, { color: STATUS_COLORS[demand.status] ?? '#666' }]}>{demand.status}</Text>
      </View>
      <Text style={styles.title}>{demand.title}</Text>
      <Text style={styles.description} numberOfLines={2}>{demand.description}</Text>
      <Text style={styles.meta} numberOfLines={1}>📍 {demand.location}</Text>
      <Text style={styles.meta}>{demand.protocolo} · {new Date(demand.createdAt).toLocaleDateString('pt-BR')}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 15, elevation: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  category: { fontWeight: 'bold', fontSize: 13, color: '#007BFF' },
  status: { fontWeight: 'bold', fontSize: 12 },
  title: { fontWeight: 'bold', fontSize: 16, color: '#333', marginBottom: 4 },
  description: { color: '#666', marginBottom: 6 },
  meta: { color: '#999', fontSize: 12 },
});
