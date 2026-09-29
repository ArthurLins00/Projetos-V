import React, { useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { CameraView, CameraType } from 'expo-camera';

interface Props {
  visible: boolean;
  onCapture: (photo: { uri: string; base64: string }) => void;
  onClose: () => void;
}

// Câmera do dispositivo via Expo Camera (a permissão é pedida pelo ViewModel antes de abrir)
export function CameraCapture({ visible, onCapture, onClose }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const takePicture = async () => {
    if (!cameraRef.current || !ready || capturing) return;
    try {
      setCapturing(true);
      // base64 é o que vai para o backend; quality 0.5 mantém o upload leve
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5, base64: true });
      if (photo?.uri && photo.base64) onCapture({ uri: photo.uri, base64: photo.base64 });
    } catch {
      Alert.alert('Erro', 'Não foi possível tirar a foto.');
    } finally {
      setCapturing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onDismiss={() => setReady(false)}>
      <View style={styles.container}>
        {visible && (
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
            onCameraReady={() => setReady(true)}
          />
        )}
        <View style={styles.controls}>
          <TouchableOpacity style={styles.sideButton} onPress={onClose}>
            <Text style={styles.sideText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shutter} onPress={takePicture} disabled={!ready || capturing}>
            {capturing ? <ActivityIndicator color="#007BFF" /> : <View style={styles.shutterInner} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sideButton}
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          >
            <Text style={styles.sideText}>Virar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 30, backgroundColor: '#000' },
  sideButton: { width: 80, alignItems: 'center' },
  sideText: { color: '#fff', fontWeight: 'bold' },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
});
