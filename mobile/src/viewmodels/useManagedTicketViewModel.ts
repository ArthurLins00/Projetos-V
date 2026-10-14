import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { managementService } from '../services/managementService';
import { getApiErrorMessage } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ManagedTicketDetail, Organ, TeamMember } from '../models/Management';

type Action = 'accept' | 'assign' | 'status' | 'comment' | 'transfer';

export function useManagedTicketViewModel(ticketId: string) {
  const { user } = useAuth();
  const [ticket, setTicket] = useState<ManagedTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [mapVisible, setMapVisible] = useState(false);

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [organs, setOrgans] = useState<Organ[]>([]);

  const [newStatus, setNewStatus] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [message, setMessage] = useState('');
  const [targetOrgan, setTargetOrgan] = useState<string | null>(null);
  const [transferReason, setTransferReason] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await managementService.getById(ticketId);
      setTicket(data);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Não foi possível carregar o chamado.'));
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    managementService.team().then(setTeam).catch(() => undefined);
    managementService.organs().then(setOrgans).catch(() => undefined);
  }, []);

  const run = async (action: Action, task: () => Promise<unknown>, success: string, onDone?: () => void) => {
    try {
      setBusy(action);
      await task();
      onDone?.();
      await load();
      Alert.alert('Pronto', success);
    } catch (err) {
      Alert.alert('Erro', getApiErrorMessage(err, 'Não foi possível concluir a ação.'));
    } finally {
      setBusy(null);
    }
  };

  const accept = () => run('accept', () => managementService.accept(ticketId), 'Você agora é o responsável por este chamado.');

  const assign = (memberId: string) => {
    const member = team.find((m) => m.id === memberId);
    run('assign', () => managementService.accept(ticketId, memberId), `Chamado atribuído a ${member?.nome ?? 'responsável'}.`);
  };

  const submitStatus = () => {
    if (!newStatus || newStatus === ticket?.status) {
      Alert.alert('Atenção', 'Escolha um status diferente do atual.');
      return;
    }
    if (newStatus === 'Resolvido' && !statusNote.trim()) {
      Alert.alert('Atenção', 'Descreva o que foi feito para resolver o chamado.');
      return;
    }
    run('status', () => managementService.updateStatus(ticketId, newStatus, statusNote.trim() || undefined), `Status alterado para "${newStatus}".`, () => {
      setNewStatus(null);
      setStatusNote('');
    });
  };

  const sendMessage = () => {
    if (!message.trim()) return;
    run('comment', () => managementService.comment(ticketId, message.trim()), 'Atualização enviada ao cidadão.', () => setMessage(''));
  };

  const submitTransfer = () => {
    if (!targetOrgan || !transferReason.trim()) {
      Alert.alert('Atenção', 'Escolha o órgão de destino e informe o motivo.');
      return;
    }
    const organ = organs.find((o) => o.id === targetOrgan);
    run('transfer', () => managementService.transfer(ticketId, targetOrgan, transferReason.trim()), `Chamado encaminhado para ${organ?.sigla ?? 'o órgão'}.`, () => {
      setTargetOrgan(null);
      setTransferReason('');
    });
  };

  return {
    ticket,
    loading,
    error,
    busy,
    isMine: !!ticket?.responsavel && ticket.responsavel.id === user?.id,
    team,
    organs,
    accept,
    assign,
    newStatus,
    setNewStatus,
    statusNote,
    setStatusNote,
    submitStatus,
    message,
    setMessage,
    sendMessage,
    targetOrgan,
    setTargetOrgan,
    transferReason,
    setTransferReason,
    submitTransfer,
    mapVisible,
    openMap: () => setMapVisible(true),
    closeMap: () => setMapVisible(false),
  };
}
