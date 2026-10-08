import { api } from './api';
import { AssistantResponse } from '../models/Assistant';

// O modelo de IA pode levar alguns segundos (várias chamadas de ferramenta)
const ASSISTANT_TIMEOUT_MS = 60000;

// Assistente de IA (rota /ai/chat do backend)
export const assistantService = {
  async send(message: string, sessionId: string): Promise<AssistantResponse> {
    const response = await api.post<AssistantResponse>(
      '/ai/chat',
      { message, sessionId },
      { timeout: ASSISTANT_TIMEOUT_MS }
    );
    return response.data;
  },
};
