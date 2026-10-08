import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { demandService } from '../services/demandService';
import { getApiErrorMessage } from '../services/api';
import { Demand, isDemandEditable } from '../models/Demand';

export function useDemandDetailViewModel(demandId: string) {
  const router = useRouter();
  const [demand, setDemand] = useState<Demand | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return { demand, loading, deleting, error, canEdit, edit, confirmRemove };
}
