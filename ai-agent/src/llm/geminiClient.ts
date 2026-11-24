import { FunctionCallingConfigMode, GoogleGenAI, type Content, type GenerateContentResponse } from '@google/genai';
import type { ModelClient, ModelTurn } from '../agent';
import type { AgentProfile } from '../perfis/types';

/** Tentativas no último modelo da lista (sem mais nenhum para onde trocar). */
const TENTATIVAS = 5;
/** Tentativas num modelo que ainda tem reserva: falha rápido e passa para o próximo. */
const TENTATIVAS_COM_RESERVA = 2;
const ESPERA_MAXIMA_MS = 65_000;
const JANELA_MS = 60_000;
/** Por quanto tempo um modelo que falhou fica fora da rotação antes de ser tentado de novo. */
const PAUSA_MODELO_MS = 2 * 60_000;
const PAUSA_COTA_DIARIA_MS = 60 * 60_000;

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

function limitadorDe(model: string, rpm: number): LimitadorRpm {
  const chave = `${model}:${rpm}`;
  if (!limitadores.has(chave)) limitadores.set(chave, new LimitadorRpm(rpm));
  return limitadores.get(chave)!;
}

/** Chamada crua a um modelo; separada para os testes simularem a API sem rede. */
export type GerarConteudo = (
  model: string,
  history: Content[],
  perfil: AgentProfile,
) => Promise<GenerateContentResponse>;

export interface GeminiClientOptions {
  /** Substitui a chamada à API (usado nos testes). */
  gerar?: GerarConteudo;
  /** Espera entre tentativas; nos testes vira 0 para não atrasar. */
  esperar?: (ms: number) => Promise<void>;
}

/**
 * Cliente do Gemini com reserva de modelos: tenta o primeiro modelo da lista e, se ele estiver
 * indisponível (sobrecarga 503, modelo descontinuado 404, cota esgotada 429), passa em silêncio
 * para o próximo. O usuário só recebe erro se todos falharem. Modelos que falharam ficam alguns
 * minutos fora da rotação, para as próximas perguntas não pagarem a espera de novo.
 */
export class GeminiClient implements ModelClient {
  private readonly models: string[];
  private readonly gerar: GerarConteudo;
  private readonly esperar: (ms: number) => Promise<void>;
  private readonly pausadoAte = new Map<string, number>();

  constructor(apiKey: string, models: string | string[], private readonly rpm = 15, options: GeminiClientOptions = {}) {
    this.models = [...new Set((Array.isArray(models) ? models : [models]).map((m) => m.trim()).filter(Boolean))];
    if (this.models.length === 0) throw new Error('GeminiClient precisa de pelo menos um modelo.');
    this.esperar = options.esperar ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    if (options.gerar) {
      this.gerar = options.gerar;
    } else {
      const ai = new GoogleGenAI({ apiKey });
      this.gerar = (model, history, perfil) =>
        ai.models.generateContent({
          model,
          contents: history,
          config: {
            systemInstruction: perfil.systemPrompt,
            temperature: 0,
            tools: [{ functionDeclarations: perfil.declarations }],
            toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
          },
        });
    }
  }

  /** Ordem de tentativa: os modelos disponíveis primeiro, os pausados por último (nunca ficam de fora). */
  private ordem(): string[] {
    const agora = Date.now();
    const ativos = this.models.filter((m) => (this.pausadoAte.get(m) ?? 0) <= agora);
    return [...ativos, ...this.models.filter((m) => !ativos.includes(m))];
  }

  async generate(history: Content[], perfil: AgentProfile): Promise<ModelTurn> {
    const ordem = this.ordem();
    let ultimoErro: unknown;
    let response: GenerateContentResponse | undefined;

    for (const [i, model] of ordem.entries()) {
      const temReserva = i < ordem.length - 1;
      try {
        response = await this.tentarModelo(model, history, perfil, temReserva);
        this.pausadoAte.delete(model);
        break;
      } catch (err) {
        ultimoErro = err;
        if (!temReserva || !trocarDeModelo(err)) throw traduzirErro(err);
        this.pausadoAte.set(model, Date.now() + (cotaDiaria(err) ? PAUSA_COTA_DIARIA_MS : PAUSA_MODELO_MS));
        console.warn(`[gemini] ${model} indisponível (${statusDe(err) || 'erro'}); usando ${ordem[i + 1]}.`);
      }
    }
    if (!response) throw traduzirErro(ultimoErro);

    const content: Content = response.candidates?.[0]?.content ?? { role: 'model', parts: [] };
    content.role = 'model';
    const text = (content.parts ?? [])
      .filter((p) => typeof p.text === 'string' && !p.thought)
      .map((p) => p.text)
      .join('')
      .trim();

    return { content, functionCalls: response.functionCalls ?? [], text };
  }

  private async tentarModelo(
    model: string,
    history: Content[],
    perfil: AgentProfile,
    temReserva: boolean,
  ): Promise<GenerateContentResponse> {
    const limitador = limitadorDe(model, this.rpm);
    const maximo = temReserva ? TENTATIVAS_COM_RESERVA : TENTATIVAS;
    for (let tentativa = 1; ; tentativa++) {
      try {
        await limitador.aguardarVez();
        return await this.gerar(model, history, perfil);
      } catch (err) {
        const status = statusDe(err);
        const transitorio = status === 429 || status >= 500;
        // Com reserva, 429 e cota diária não valem a espera: o próximo modelo tem a sua própria cota.
        if (!transitorio || tentativa >= maximo || cotaDiaria(err) || (temReserva && status === 429)) throw err;
        const sugerido = /retry in ([\d.]+)s/i.exec(mensagemDe(err))?.[1];
        const espera = sugerido ? Number(sugerido) * 1000 + 500 : 2000 * tentativa;
        if (status === 429) console.warn(`[gemini] limite de requisições atingido; nova tentativa em ${Math.ceil(espera / 1000)} s...`);
        await this.esperar(Math.min(espera, ESPERA_MAXIMA_MS));
      }
    }
  }
}

function statusDe(err: unknown): number {
  return (err as { status?: number })?.status ?? 0;
}

function mensagemDe(err: unknown): string {
  return String((err as Error)?.message ?? err);
}

function cotaDiaria(err: unknown): boolean {
  return statusDe(err) === 429 && /PerDay/i.test(mensagemDe(err));
}

/** Erros do modelo (não da chave nem da requisição) que justificam tentar outro modelo. */
function trocarDeModelo(err: unknown): boolean {
  const status = statusDe(err);
  return status === 429 || status === 404 || status >= 500;
}

function traduzirErro(err: unknown): unknown {
  if (!cotaDiaria(err)) return err;
  return new Error(
    'Cota diária gratuita do Gemini esgotada nos modelos configurados. Tente amanhã, use outra chave ' +
      'ou ajuste GEMINI_MODEL / GEMINI_FALLBACK_MODELS no .env.',
    { cause: err },
  );
}
