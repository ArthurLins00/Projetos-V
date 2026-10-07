import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Image } from 'react-native';
import { useDemandDetailViewModel } from '../viewmodels/useDemandDetailViewModel';
import { STATUS_COLORS } from '../models/Demand';
import { getPhotoUri } from '../services/api';

interface Props {
  demandId: string;
}

export function DemandDetailView({ demandId }: Props) {
  const vm = useDemandDetailViewModel(demandId);

  if (vm.loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  if (!vm.demand) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.value}>{vm.error ?? 'Demanda não encontrada.'}</Text>
      </View>
    );
  }

  const { demand } = vm;
  const photoUri = getPhotoUri(demand.photoUrl);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {photoUri && <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />}

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.protocol}>{demand.protocolo}</Text>
          <Text style={[styles.status, { color: STATUS_COLORS[demand.status] ?? '#666' }]}>{demand.status}</Text>
        </View>
        <Text testID="detail-title" style={styles.title}>{demand.title}</Text>

        <Text style={styles.label}>Categoria</Text>
        <Text style={styles.value}>{demand.category?.nome}</Text>

        <Text style={styles.label}>Descrição</Text>
        <Text style={styles.value}>{demand.description}</Text>

        <Text style={styles.label}>Endereço</Text>
        <Text style={styles.value}>{demand.location}</Text>

        <Text style={styles.label}>Coordenadas (GPS)</Text>
        <Text style={styles.value}>{demand.latitude.toFixed(6)}, {demand.longitude.toFixed(6)}</Text>

        <Text style={styles.label}>Registrada em</Text>
        <Text style={styles.value}>{new Date(demand.createdAt).toLocaleString('pt-BR')}</Text>
      </View>

      {!!demand.logs?.length && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Histórico</Text>
          {demand.logs.map((log, index) => (
            <View key={index} style={styles.log}>
              <Text style={styles.logTitle}>{log.titulo ?? log.tipo}</Text>
              <Text style={styles.value}>{log.descricao}</Text>
              <Text style={styles.logDate}>{new Date(log.timestamp).toLocaleString('pt-BR')}</Text>
            </View>
          ))}
        </View>
      )}

      {vm.canEdit ? (
        <View style={styles.row}>
          <TouchableOpacity testID="detail-edit" accessibilityRole="button" style={[styles.button, styles.editButton]} onPress={vm.edit}>
            <Text style={styles.buttonText}>✏️ Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="detail-delete" accessibilityRole="button" style={[styles.button, styles.deleteButton]} onPress={vm.confirmRemove} disabled={vm.deleting}>
            {vm.deleting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>🗑️ Excluir</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.locked}>Esta demanda não pode mais ser editada ou removida ({demand.status}).</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, flexGrow: 1, backgroundColor: '#f5f5f5' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 15, elevation: 2 },
  photo: { width: '100%', height: 240, borderRadius: 8, marginBottom: 15, backgroundColor: '#ddd' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  protocol: { color: '#999', fontSize: 12 },
  status: { fontWeight: 'bold', fontSize: 12 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  label: { fontSize: 12, fontWeight: 'bold', color: '#999', marginTop: 10 },
  value: { fontSize: 15, color: '#333' },
  log: { borderLeftWidth: 2, borderLeftColor: '#007BFF', paddingLeft: 10, marginTop: 10 },
  logTitle: { fontWeight: 'bold', color: '#333' },
  logDate: { fontSize: 12, color: '#999' },
  row: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, padding: 15, borderRadius: 8, alignItems: 'center' },
  editButton: { backgroundColor: '#007BFF' },
  deleteButton: { backgroundColor: '#DC3545' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  locked: { textAlign: 'center', color: '#666' },
});
