import type { AgentProfile, ToolContext } from '../perfis/types';

export type ToolOutcome = { output: unknown } | { error: string };

/** Executa a ferramenta pedida pelo modelo. Erros viram `{ error }` para o modelo poder se corrigir. */
export async function executarFerramenta(
  perfil: AgentProfile,
  nome: string,
  args: Record<string, unknown>,
  ctx: ToolContext = {},
): Promise<ToolOutcome> {
  const handler = perfil.handlers[nome];
  if (!handler) return { error: `Ferramenta desconhecida: ${nome}` };
  try {
    return { output: await handler(args, ctx) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
