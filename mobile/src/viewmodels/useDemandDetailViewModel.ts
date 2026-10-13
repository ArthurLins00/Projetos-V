import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { demandService } from '../services/demandService';
import { getApiErrorMessage } from '../services/api';
import { geocodingService, ResolvedAddress } from '../services/geocodingService';
import { Demand, isDemandEditable } from '../models/Demand';

export function useDemandDetailViewModel(demandId: string) {
  const router = useRouter();
  const [demand, setDemand] = useState<Demand | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsAddress, setGpsAddress] = useState<ResolvedAddress | null>(null);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);

  const latitude = demand?.latitude;
  const longitude = demand?.longitude;

  useEffect(() => {
    if (latitude == null || longitude == null) return;
    let active = true;
    setResolvingAddress(true);
    geocodingService
      .reverse({ latitude, longitude })
      .then((address) => {
        if (active) setGpsAddress(address);
      })
      .finally(() => {
        if (active) setResolvingAddress(false);
      });
    return () => {
      active = false;
    };
  }, [latitude, longitude]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      demandService
        .getById(demandId)
        .then((data) => {
          if (!active) return;
          setDemand(data);
          setError(null);
        })
        .catch((err) => {
          if (active) setError(getApiErrorMessage(err, 'Não foi possível carregar a demanda.'));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [demandId])
  );

  const canEdit = !!demand && isDemandEditable(demand);

  const edit = () => router.push(`/(app)/demand/${demandId}/edit`);

  const remove = async () => {
    try {
      setDeleting(true);
      await demandService.remove(demandId);
      Alert.alert('Sucesso', 'Demanda removida.');
      router.back();
    } catch (err) {
      Alert.alert('Erro', getApiErrorMessage(err, 'Não foi possível remover a demanda.'));
    } finally {
      setDeleting(false);
    }
  };

  const confirmRemove = () => {
    Alert.alert('Remover demanda', 'Tem certeza que deseja remover esta demanda?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: remove },
    ]);
  };

  return {
    demand,
    loading,
    deleting,
    error,
    canEdit,
    edit,
    confirmRemove,
    gpsAddress,
    resolvingAddress,
    mapVisible,
    openMap: () => setMapVisible(true),
    closeMap: () => setMapVisible(false),
  };
}
