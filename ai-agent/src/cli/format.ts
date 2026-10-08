import type { ToolCallRecord } from '../agent';

const cor = (codigo: number) => (s: string) => (process.stdout.isTTY ? `\x1b[${codigo}m${s}\x1b[0m` : s);
export const cinza = cor(90);
export const verde = cor(32);
export const amarelo = cor(33);
export const ciano = cor(36);
export const negrito = cor(1);

export function formatarChamadaFerramenta(call: ToolCallRecord): string {
  const resultado = 'error' in call.outcome ? `ERRO: ${call.outcome.error}` : JSON.stringify(call.outcome.output);
  return [
    amarelo(`  🔧 ${call.name}(${JSON.stringify(call.args)})`),
    cinza(`     ↳ ${resultado}`),
  ].join('\n');
}
