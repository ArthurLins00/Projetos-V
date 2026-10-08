import { FunctionCallingConfigMode, GoogleGenAI, type Content } from '@google/genai';
import type { ModelClient, ModelTurn } from '../agent';
import type { AgentProfile } from '../perfis/types';

const TENTATIVAS = 5;
const ESPERA_MAXIMA_MS = 65_000;
const JANELA_MS = 60_000;

/**
 * Limitador de requisições por minuto (janela deslizante), compartilhado por todos os clientes
 * do processo. Evita estourar a cota do plano gratuito em vez de só reagir ao erro 429.
 */
class LimitadorRpm {
  private readonly envios: number[] = [];
  private fila: Promise<void> = Promise.resolve();

  constructor(private readonly rpm: number) {}

  aguardarVez(): Promise<void> {
    const vez = this.fila.then(async () => {
      for (;;) {
        const agora = Date.now();
        while (this.envios.length && agora - this.envios[0]! >= JANELA_MS) this.envios.shift();
        if (this.envios.length < this.rpm) {
          this.envios.push(agora);
          return;
        }
        const espera = this.envios[0]! + JANELA_MS - agora + 50;
        console.warn(`[gemini] ${this.rpm} requisições no último minuto (GEMINI_RPM); aguardando ${Math.ceil(espera / 1000)} s...`);
        await new Promise((r) => setTimeout(r, espera));
      }
    });
    this.fila = vez;
    return vez;
  }
}

const limitadores = new Map<string, LimitadorRpm>();

/** Adaptador do Google Gen AI SDK (Gemini API) para a interface ModelClient. */
export class GeminiClient implements ModelClient {
  private readonly ai: GoogleGenAI;

  private readonly limitador: LimitadorRpm;

  /** `rpm`: máximo de requisições por minuto ao modelo (cota do plano da chave). */
  constructor(apiKey: string, private readonly model: string, rpm = 15) {
    this.ai = new GoogleGenAI({ apiKey });
    const chave = `${model}:${rpm}`;
    if (!limitadores.has(chave)) limitadores.set(chave, new LimitadorRpm(rpm));
    this.limitador = limitadores.get(chave)!;
  }

  async generate(history: Content[], perfil: AgentProfile): Promise<ModelTurn> {
    const response = await comRetentativa(async () => {
      await this.limitador.aguardarVez();
      return this.ai.models.generateContent({
        model: this.model,
        contents: history,
        config: {
          systemInstruction: perfil.systemPrompt,
          temperature: 0, // respostas o mais determinísticas possível
          tools: [{ functionDeclarations: perfil.declarations }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
        },
      });
    });

    // Devolvemos o content original do modelo (inclui thought signatures do Gemini 2.5).
    const content: Content = response.candidates?.[0]?.content ?? { role: 'model', parts: [] };
    content.role = 'model';
    const text = (content.parts ?? [])
      .filter((p) => typeof p.text === 'string' && !p.thought)
      .map((p) => p.text)
      .join('')
      .trim();

    return { content, functionCalls: response.functionCalls ?? [], text };
  }
}

/**
 * Repete em erros transitórios (429 / 5xx). No 429 o Gemini informa quanto esperar
 * ("Please retry in 27.9s"): respeitamos esse tempo (o plano gratuito limita requisições por minuto).
 */
async function comRetentativa<T>(fn: () => Promise<T>): Promise<T> {
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await fn();
    } catch (err) {
      const status = (err as { status?: number }).status ?? 0;
      const transitorio = status === 429 || status >= 500;
      if (!transitorio || tentativa >= TENTATIVAS) throw err;
      // Cota DIÁRIA esgotada: esperar alguns segundos não resolve, então falha logo com uma explicação
      if (status === 429 && /PerDay/i.test(String((err as Error).message))) {
        throw new Error(
          'Cota diária gratuita do Gemini esgotada para este modelo. Tente amanhã, use outra chave ' +
            'ou troque GEMINI_MODEL no .env por outro modelo da sua chave.',
          { cause: err },
        );
      }
      const sugerido = /retry in ([\d.]+)s/i.exec(String((err as Error).message))?.[1];
      const espera = sugerido ? Number(sugerido) * 1000 + 500 : 2000 * tentativa;
      if (status === 429) console.warn(`[gemini] limite de requisições atingido; nova tentativa em ${Math.ceil(espera / 1000)} s...`);
      await new Promise((r) => setTimeout(r, Math.min(espera, ESPERA_MAXIMA_MS)));
    }
  }
}
