export interface AssistantDemandRef {
  id: string;
  protocolo: string;
  titulo: string;
  status: string;
}

export interface AssistantResponse {
  sessionId: string;
  reply: string;
  chamados: AssistantDemandRef[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  demands?: AssistantDemandRef[];
  error?: boolean;
}

export const ASSISTANT_SUGGESTIONS = [
  'Como estão os meus chamados?',
  'Quais chamados estão em andamento?',
  'Quais já foram resolvidos?',
];
