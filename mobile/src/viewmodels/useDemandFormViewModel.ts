import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useCameraPermissions } from 'expo-camera';
import { demandService } from '../services/demandService';
import { categoryService } from '../services/categoryService';
import { getApiErrorMessage, getPhotoUri } from '../services/api';
import { Category } from '../models/Category';
import { DemandPayload } from '../models/Demand';

type Coords = { latitude: number; longitude: number };

// Criação (C) e edição (U) de ocorrências. Sem `demandId` = criação.
export function useDemandFormViewModel(demandId?: string) {
  const router = useRouter();
  const isEditing = !!demandId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [locationText, setLocationText] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  // photoUri = o que aparece no preview; photoBase64 só existe quando há foto nova para enviar
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [savedPhotoUri, setSavedPhotoUri] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Carrega categorias e, na edição, os dados atuais da ocorrência
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [categoryList, demand] = await Promise.all([
          categoryService.list(),
          demandId ? demandService.getById(demandId) : Promise.resolve(null),
        ]);
        if (!active) return;
        setCategories(categoryList);
        if (demand) {
          setTitle(demand.title);
          setDescription(demand.description);
          setCategoryId(demand.category.id);
          setLocationText(demand.location);
          setCoords({ latitude: demand.latitude, longitude: demand.longitude });
          const remotePhoto = getPhotoUri(demand.photoUrl);
          setSavedPhotoUri(remotePhoto);
          setPhotoUri(remotePhoto);
        }
      } catch (error) {
        if (active) Alert.alert('Erro', getApiErrorMessage(error, 'Não foi possível carregar os dados.'));
      } finally {
        if (active) setLoadingData(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [demandId]);

  const openCamera = async () => {
    let granted = cameraPermission?.granted;
    if (!granted) {
      granted = (await requestCameraPermission()).granted;
    }
    if (!granted) return Alert.alert('Atenção', 'Precisamos da permissão da câmera.');
    setCameraVisible(true);
  };

  const onPhotoTaken = (photo: { uri: string; base64: string }) => {
    setPhotoUri(photo.uri);
    setPhotoBase64(photo.base64);
    setCameraVisible(false);
  };

  const closeCamera = () => setCameraVisible(false);

  // Descarta a foto nova (na edição, volta a mostrar a foto já salva)
  const removePhoto = () => {
    setPhotoBase64(null);
    setPhotoUri(savedPhotoUri);
  };

  const captureLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return Alert.alert('Atenção', 'Precisamos do GPS para registrar o local.');
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ latitude: current.coords.latitude, longitude: current.coords.longitude });

      // Preenche o endereço automaticamente se o usuário ainda não digitou
      if (!locationText) {
        const [address] = await Location.reverseGeocodeAsync(current.coords).catch(() => []);
        if (address) {
          const parts = [address.street, address.streetNumber, address.district, address.city].filter(Boolean);
          if (parts.length) setLocationText(parts.join(', '));
        }
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível obter a localização.');
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    if (!title.trim() || !description.trim() || !categoryId || !locationText.trim() || !coords) {
      return Alert.alert('Erro', 'Preencha todos os campos e capture o GPS.');
    }

    const payload: DemandPayload = {
      title: title.trim(),
      description: description.trim(),
      category_id: categoryId,
      location: locationText.trim(),
      latitude: coords.latitude,
      longitude: coords.longitude,
    };

    try {
      setSubmitting(true);
      const saved = isEditing
        ? await demandService.update(demandId, payload)
        : await demandService.create(payload);

      let photoFailed = false;
      if (photoBase64) {
        try {
          await demandService.uploadPhoto(saved.id, photoBase64);
        } catch (error) {
          console.error('Erro ao enviar foto:', (error as any)?.response?.data || error);
          photoFailed = true;
        }
      }

      const message = isEditing ? 'Demanda atualizada com sucesso!' : 'Demanda registrada com sucesso!';
      if (photoFailed) {
        Alert.alert('Atenção', `${message}\nMas não foi possível enviar a foto. Tente novamente pela edição.`);
      } else {
        Alert.alert('Sucesso', message);
      }
      router.back();
    } catch (error) {
      console.error('Erro ao salvar demanda:', (error as any)?.response?.data || error);
      Alert.alert('Erro', getApiErrorMessage(error, 'Não foi possível salvar a demanda.'));
    } finally {
      setSubmitting(false);
    }
  };

  return {
    isEditing,
    title,
    setTitle,
    description,
    setDescription,
    categoryId,
    setCategoryId,
    locationText,
    setLocationText,
    coords,
    photoUri,
    hasNewPhoto: !!photoBase64,
    categories,
    loadingData,
    locating,
    submitting,
    cameraVisible,
    openCamera,
    closeCamera,
    onPhotoTaken,
    removePhoto,
    captureLocation,
    submit,
  };
}
