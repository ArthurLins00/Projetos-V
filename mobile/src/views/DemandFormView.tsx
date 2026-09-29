import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useDemandFormViewModel } from '../viewmodels/useDemandFormViewModel';
import { CameraCapture } from '../components/CameraCapture';

interface Props {
  demandId?: string;
}

// Formulário compartilhado entre criação e edição de ocorrências
export function DemandFormView({ demandId }: Props) {
  const vm = useDemandFormViewModel(demandId);

  if (vm.loadingData) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Título do Problema</Text>
      <TextInput style={styles.input} placeholder="Ex: Poste apagado" value={vm.title} onChangeText={vm.setTitle} />

      <Text style={styles.label}>Categoria</Text>
      <View style={styles.chips}>
        {vm.categories.map((category) => {
          const selected = vm.categoryId === category.id;
          return (
            <TouchableOpacity
              key={category.id}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => vm.setCategoryId(category.id)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{category.nome}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Endereço (Rua, Número)</Text>
      <TextInput style={styles.input} placeholder="Ex: Rua das Flores, 123" value={vm.locationText} onChangeText={vm.setLocationText} />

      <Text style={styles.label}>Descrição</Text>
      <TextInput style={[styles.input, styles.textArea]} placeholder="Detalhe o problema..." value={vm.description} onChangeText={vm.setDescription} multiline />

      <View style={styles.row}>
        <TouchableOpacity style={[styles.actionButton, vm.photoUri && styles.buttonSuccess]} onPress={vm.openCamera}>
          <Text style={styles.actionButtonText}>{vm.photoUri ? '📷 Refazer Foto' : '📷 Foto'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, vm.coords && styles.buttonSuccess]} onPress={vm.captureLocation} disabled={vm.locating}>
          {vm.locating ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>{vm.coords ? '📍 GPS OK' : '📍 Pegar GPS'}</Text>}
        </TouchableOpacity>
      </View>

      {vm.coords && (
        <Text style={styles.coords}>
          Lat {vm.coords.latitude.toFixed(6)} · Lng {vm.coords.longitude.toFixed(6)}
        </Text>
      )}

      {vm.photoUri && (
        <View>
          <Image source={{ uri: vm.photoUri }} style={styles.preview} />
          {vm.hasNewPhoto && (
            <TouchableOpacity onPress={vm.removePhoto}>
              <Text style={styles.removePhoto}>Descartar foto nova</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.submitButton} onPress={vm.submit} disabled={vm.submitting}>
        {vm.submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitText}>{vm.isEditing ? 'Salvar Alterações' : 'Registrar Demanda'}</Text>
        )}
      </TouchableOpacity>

      <CameraCapture visible={vm.cameraVisible} onCapture={vm.onPhotoTaken} onClose={vm.closeCamera} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, flexGrow: 1, backgroundColor: '#f5f5f5' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 14, fontWeight: 'bold', marginBottom: 5, color: '#333' },
  input: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#ddd' },
  textArea: { height: 80, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' },
  chipSelected: { backgroundColor: '#007BFF', borderColor: '#007BFF' },
  chipText: { color: '#333' },
  chipTextSelected: { color: '#fff', fontWeight: 'bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  actionButton: { flex: 1, backgroundColor: '#6c757d', padding: 15, borderRadius: 8, alignItems: 'center', marginHorizontal: 5 },
  buttonSuccess: { backgroundColor: '#28A745' },
  actionButtonText: { color: '#fff', fontWeight: 'bold' },
  coords: { textAlign: 'center', color: '#666', fontSize: 12, marginBottom: 10 },
  preview: { width: '100%', height: 180, borderRadius: 8, marginBottom: 5 },
  removePhoto: { color: '#DC3545', textAlign: 'right', marginBottom: 15 },
  submitButton: { backgroundColor: '#007BFF', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 'auto' },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
