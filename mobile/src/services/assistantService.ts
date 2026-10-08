import { api } from './api';
import { AssistantResponse } from '../models/Assistant';

const ASSISTANT_TIMEOUT_MS = 60000;

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
