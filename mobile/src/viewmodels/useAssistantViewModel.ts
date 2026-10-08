import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { assistantService } from '../services/assistantService';
import { getApiErrorMessage } from '../services/api';
import { ASSISTANT_SUGGESTIONS, ChatMessage } from '../models/Assistant';

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function welcomeMessage(perfil?: string): ChatMessage {
  const escopo = perfil === 'Cidadao' ? 'dos seus chamados' : 'de qualquer chamado do sistema';
  return {
    id: 'welcome',
    role: 'assistant',
    text: `Olá! Sou o assistente do Fiscalize. Posso consultar o status ${escopo}. Pergunte, por exemplo, por um ou mais protocolos (DEM-...).`,
  };
}

// Chat com o assistente de IA: consulta de status dos chamados do usuário logado
export function useAssistantViewModel() {
  const router = useRouter();
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>(() => [welcomeMessage(user?.perfil)]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  // Mantém o contexto da conversa no backend; um novo id começa uma conversa nova
  const sessionId = useRef(newId());

  const send = async (text: string = input) => {
    const message = text.trim();
    if (!message || sending) return;

    setInput('');
    setMessages((prev) => [...prev, { id: newId(), role: 'user', text: message }]);
    setSending(true);
    try {
      const response = await assistantService.send(message, sessionId.current);
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: 'assistant', text: response.reply, demands: response.chamados },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          text: getApiErrorMessage(error, 'Não foi possível falar com o assistente agora.'),
          error: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const clear = () => {
    sessionId.current = newId();
    setMessages([welcomeMessage(user?.perfil)]);
  };

  const openDemand = (id: string) => router.push(`/(app)/demand/${id}`);

  return {
    messages,
    input,
    setInput,
    sending,
    send,
    clear,
    openDemand,
    // Sugestões só aparecem antes da primeira pergunta
    suggestions: messages.length === 1 ? ASSISTANT_SUGGESTIONS : [],
  };
}
