import { useState, useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useCameraPermissions } from 'expo-camera';
import { demandService } from '../services/demandService';
import { categoryService } from '../services/categoryService';
import { cityService } from '../services/cityService';
import { getApiErrorMessage, getPhotoUri } from '../services/api';
import { Category } from '../models/Category';
import { DemandPayload, MAX_DEMAND_PHOTOS } from '../models/Demand';
import { BRAZIL_STATES, findStateUf, normalizeText, Zone } from '../models/Region';

type Coords = { latitude: number; longitude: number };

export interface FormPhoto {
  key: string;
  uri: string;
  savedId?: string;
  base64?: string;
}

let photoKeySeq = 0;
const newPhoto = (uri: string, base64: string): FormPhoto => ({ key: `nova-${++photoKeySeq}`, uri, base64 });

export function useDemandFormViewModel(demandId?: string) {
  const router = useRouter();
  const isEditing = !!demandId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [locationText, setLocationText] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [photos, setPhotos] = useState<FormPhoto[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [stateUf, setStateUf] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [zone, setZone] = useState<Zone | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [citiesFailed, setCitiesFailed] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cameraVisible, setCameraVisible] = useState(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

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
          setStateUf(demand.state ?? null);
          setCity(demand.city ?? null);
          setZone(demand.zone ?? null);
          setPhotos((demand.photos ?? []).map((photo) => ({ key: photo.id, uri: getPhotoUri(photo.url)!, savedId: photo.id })));
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

  useEffect(() => {
    if (!stateUf) {
      setCities([]);
      return;
    }
    let active = true;
    setLoadingCities(true);
    setCitiesFailed(false);
    cityService
      .listByState(stateUf)
      .then((list) => {
        if (!active) return;
        setCities(list);
        setCity((current) => (current ? list.find((name) => normalizeText(name) === normalizeText(current)) ?? current : current));
      })
      .catch(() => {
        if (active) setCitiesFailed(true);
      })
      .finally(() => {
        if (active) setLoadingCities(false);
      });
    return () => {
      active = false;
    };
  }, [stateUf]);

  const stateOptions = useMemo(() => BRAZIL_STATES.map((state) => ({ value: state.uf, label: `${state.nome} (${state.uf})` })), []);
  const cityOptions = useMemo(() => cities.map((name) => ({ value: name, label: name })), [cities]);

  const selectState = (uf: string) => {
    if (uf === stateUf) return;
    setStateUf(uf);
    setCity(null);
  };

  const remainingPhotos = MAX_DEMAND_PHOTOS - photos.length;

  const warnPhotoLimit = () => Alert.alert('Limite de fotos', `Você pode anexar até ${MAX_DEMAND_PHOTOS} fotos por demanda.`);

  const openCamera = async () => {
    if (remainingPhotos <= 0) return warnPhotoLimit();
    let granted = cameraPermission?.granted;
    if (!granted) {
      granted = (await requestCameraPermission()).granted;
    }
    if (!granted) return Alert.alert('Atenção', 'Precisamos da permissão da câmera.');
    setCameraVisible(true);
  };

  const onPhotoTaken = (photo: { uri: string; base64: string }) => {
    setPhotos((current) => [...current, newPhoto(photo.uri, photo.base64)].slice(0, MAX_DEMAND_PHOTOS));
    setCameraVisible(false);
  };

  const closeCamera = () => setCameraVisible(false);

  const pickFromGallery = async () => {
    if (remainingPhotos <= 0) return warnPhotoLimit();
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) return Alert.alert('Atenção', 'Precisamos da permissão para acessar suas fotos.');

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remainingPhotos,
      quality: 0.5,
      base64: true,
    });
    if (result.canceled) return;

    const picked = result.assets.filter((asset) => !!asset.base64).map((asset) => newPhoto(asset.uri, asset.base64!));
    if (picked.length > remainingPhotos) warnPhotoLimit();
    setPhotos((current) => [...current, ...picked].slice(0, MAX_DEMAND_PHOTOS));
  };

  const removePhoto = (key: string) => {
    const photo = photos.find((p) => p.key === key);
    if (photo?.savedId) setRemovedPhotoIds((ids) => [...ids, photo.savedId!]);
    setPhotos((current) => current.filter((p) => p.key !== key));
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

      const needsAddress = !locationText;
      const needsRegion = !stateUf || !city;
      if (needsAddress || needsRegion) {
        const [address] = await Location.reverseGeocodeAsync(current.coords).catch(() => []);
        if (address && needsAddress) {
          const parts = [address.street, address.streetNumber, address.district, address.city].filter(Boolean);
          if (parts.length) setLocationText(parts.join(', '));
        }
        const detectedUf = findStateUf(address?.region);
        const detectedCity = address?.city ?? address?.subregion;
        if (needsRegion && detectedUf && detectedCity) {
          setStateUf(detectedUf);
          setCity(detectedCity);
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
    if (!stateUf || !city?.trim() || !zone) {
      return Alert.alert('Erro', 'Informe o estado, a cidade e se o local é de zona urbana ou rural.');
    }

    const payload: DemandPayload = {
      title: title.trim(),
      description: description.trim(),
      category_id: categoryId,
      location: locationText.trim(),
      latitude: coords.latitude,
      longitude: coords.longitude,
      state: stateUf,
      city: city.trim(),
      zone,
    };

    try {
      setSubmitting(true);
      const saved = isEditing
        ? await demandService.update(demandId, payload)
        : await demandService.create(payload);

      for (const photoId of removedPhotoIds) {
        await demandService.removePhoto(saved.id, photoId).catch((error) => {
          console.error('Erro ao remover foto:', error?.response?.data || error);
        });
      }

      let failedPhotos = 0;
      for (const photo of photos) {
        if (!photo.base64) continue;
        try {
          await demandService.addPhoto(saved.id, photo.base64);
        } catch (error) {
          console.error('Erro ao enviar foto:', (error as any)?.response?.data || error);
          failedPhotos++;
        }
      }

      const message = isEditing ? 'Demanda atualizada com sucesso!' : 'Demanda registrada com sucesso!';
      if (failedPhotos) {
        const which = failedPhotos === 1 ? '1 foto' : `${failedPhotos} fotos`;
        Alert.alert('Atenção', `${message}\nMas não foi possível enviar ${which}. Tente novamente pela edição.`);
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
    stateUf,
    selectState,
    stateOptions,
    city,
    setCity,
    cityOptions,
    loadingCities,
    citiesFailed,
    zone,
    setZone,
    photos,
    remainingPhotos,
    categories,
    loadingData,
    locating,
    submitting,
    cameraVisible,
    openCamera,
    closeCamera,
    onPhotoTaken,
    pickFromGallery,
    removePhoto,
    captureLocation,
    submit,
  };
}
