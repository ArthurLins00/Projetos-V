import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { demandService } from '../services/demandService';

export function CreateDemand({ navigation }: any) {
  const [title, setTitle] = useState(''); 
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('1'); 
  const [locationText, setLocationText] = useState(''); 
  
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [locationCoords, setLocationCoords] = useState<Location.LocationObjectCoords | null>(null);
  const [loading, setLoading] = useState(false);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Atenção', 'Precisamos da permissão da câmera.');
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const getLocation = async () => {
    setLoading(true);
    try {
      let { status } = await Location.getForegroundPermissionsAsync();

      if (status !== 'granted') {
        const permission = await Promise.race([
          Location.requestForegroundPermissionsAsync(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);
        if (permission) {
          status = permission.status;
        }
      }

      if (status !== 'granted') {
        if (__DEV__) {
          setLocationCoords({
            latitude: -8.0476,
            longitude: -34.8770,
          } as Location.LocationObjectCoords);
          return;
        }
        throw new Error('Permissão de localização negada');
      }

      const lastKnownLoc = await Promise.race([
        Location.getLastKnownPositionAsync(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);

      if (lastKnownLoc) {
        setLocationCoords(lastKnownLoc.coords);
        return;
      }

      const currentLoc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]);

      if (currentLoc) {
        setLocationCoords(currentLoc.coords);
        return;
      }

      if (__DEV__) {
        setLocationCoords({
          latitude: -8.0476,
          longitude: -34.8770,
        } as Location.LocationObjectCoords);
        return;
      }

      throw new Error('Localização indisponível');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível obter a localização. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
   
    if (!title || !description || !categoryId || !locationText || !locationCoords) {
      return Alert.alert('Erro', 'Preencha todos os campos e capture o GPS.');
    }

    try {
      setLoading(true);
      
      const payload = {
        title: title,
        description: description,
        category_id: parseInt(categoryId, 10),
        location: locationText,
        latitude: locationCoords.latitude,
        longitude: locationCoords.longitude
      };

      await demandService.criarDemanda(payload);

      Alert.alert('Sucesso', 'Demanda registrada com sucesso!');
      navigation.goBack();
      
    } catch (error: any) {
      console.error('Erro ao salvar demanda:', error.response?.data || error.message);
      Alert.alert('Erro', 'Não foi possível registrar a demanda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      
      <Text style={styles.label}>Título do Problema</Text>
      <TextInput testID="demand-title" style={styles.input} placeholder="Ex: Poste apagado" value={title} onChangeText={setTitle} />

      <Text style={styles.label}>ID da Categoria</Text>
      <TextInput testID="demand-category" style={styles.input} placeholder="Ex: 1" value={categoryId} onChangeText={setCategoryId} keyboardType="numeric" />

      <Text style={styles.label}>Endereço (Rua, Número)</Text>
      <TextInput testID="demand-location" style={styles.input} placeholder="Ex: Rua das Flores, 123" value={locationText} onChangeText={setLocationText} />

      <Text style={styles.label}>Descrição</Text>
      <TextInput testID="demand-description" style={[styles.input, { height: 80 }]} placeholder="Detalhe o problema..." value={description} onChangeText={setDescription} multiline />

      <View style={styles.row}>
        <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
          <Text style={styles.actionButtonText}>📷 Foto</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          testID={locationCoords ? 'demand-location-gps-ready' : 'demand-location-gps'}
          accessibilityLabel={locationCoords ? 'GPS OK' : 'Pegar GPS'}
          style={[styles.actionButton, locationCoords && styles.buttonSuccess]}
          onPress={getLocation}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>{locationCoords ? '📍 GPS OK' : '📍 Pegar GPS'}</Text>}
        </TouchableOpacity>
      </View>

      {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} />}

      <TouchableOpacity testID="demand-submit" style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Registrar Demanda</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, flexGrow: 1, backgroundColor: '#f5f5f5' },
  label: { fontSize: 14, fontWeight: 'bold', marginBottom: 5, color: '#333' },
  input: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#ddd' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  actionButton: { flex: 1, backgroundColor: '#6c757d', padding: 15, borderRadius: 8, alignItems: 'center', marginHorizontal: 5 },
  buttonSuccess: { backgroundColor: '#28A745' },
  actionButtonText: { color: '#fff', fontWeight: 'bold' },
  preview: { width: '100%', height: 150, borderRadius: 8, marginBottom: 15 },
  submitButton: { backgroundColor: '#007BFF', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 'auto' },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});