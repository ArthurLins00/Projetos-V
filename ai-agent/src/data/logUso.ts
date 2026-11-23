import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Registro do uso dos dados: uma linha JSON por chamada de função de acesso, sempre acrescentada
// ao final do arquivo (nunca apaga as anteriores). Nunca entram textos livres nem coordenadas,
// só identificadores (categoria, protocolo, sigla, status).

export const LOG_PADRAO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../logs/uso-dados.jsonl');

/** Caminho do log. A variável FISCALIZE_LOG_USO_DADOS troca o arquivo (os testes usam um temporário). */
export function caminhoLog(): string {
  return process.env.FISCALIZE_LOG_USO_DADOS || LOG_PADRAO;
}

export type Colecao = 'categorias' | 'orgaos' | 'regras' | 'chamados' | 'chamados_do_usuario';

export interface LinhaLog {
  data_hora: string;
  funcao: string;
  chamador: string;
  canal: string;
  colecao: Colecao;
  parametros: Record<string, unknown>;
  registros_retornados: number;
  ids_retornados: Array<string | number>;
  sucesso: boolean;
  erro: string | null;
}

/** Quem chamou a função de acesso: a ferramenta do agente e o canal por onde a mensagem chegou. */
export interface Origem {
  ferramenta: string;
  canal?: string;
}

export function registrarUso(linha: Omit<LinhaLog, 'data_hora'>): void {
  const arquivo = caminhoLog();
  try {
    mkdirSync(path.dirname(arquivo), { recursive: true });
    appendFileSync(arquivo, JSON.stringify({ data_hora: new Date().toISOString(), ...linha }) + '\n', 'utf8');
  } catch (err) {
    // Falha ao gravar o log não pode derrubar a resposta ao cidadão.
    console.error(`[log de uso dos dados] não foi possível gravar em ${arquivo}:`, err);
  }
}

/**
 * Executa uma leitura de dados e registra a chamada: em caso de sucesso, quantos registros e quais
 * identificadores voltaram; em caso de erro, a mensagem (e o erro segue para quem chamou).
 */
export function comRegistro<T>(
  funcao: string,
  colecao: Colecao,
  origem: Origem,
  parametros: Record<string, unknown>,
  executar: () => T,
  ids: (resultado: T) => Array<string | number>,
): T {
  const base = { funcao, chamador: origem.ferramenta, canal: origem.canal ?? 'desconhecido', colecao, parametros };
  try {
    const resultado = executar();
    const lista = ids(resultado);
    registrarUso({ ...base, registros_retornados: lista.length, ids_retornados: lista, sucesso: true, erro: null });
    return resultado;
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    registrarUso({ ...base, registros_retornados: 0, ids_retornados: [], sucesso: false, erro: mensagem });
    throw err;
  }
}

/** Versão assíncrona de comRegistro (para a fonte de chamados do backend). */
export async function comRegistroAsync<T>(
  funcao: string,
  colecao: Colecao,
  origem: Origem,
  parametros: Record<string, unknown>,
  executar: () => Promise<T>,
  ids: (resultado: T) => Array<string | number>,
): Promise<T> {
  const base = { funcao, chamador: origem.ferramenta, canal: origem.canal ?? 'desconhecido', colecao, parametros };
  try {
    const resultado = await executar();
    const lista = ids(resultado);
    registrarUso({ ...base, registros_retornados: lista.length, ids_retornados: lista, sucesso: true, erro: null });
    return resultado;
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    registrarUso({ ...base, registros_retornados: 0, ids_retornados: [], sucesso: false, erro: mensagem });
    throw err;
  }
}
