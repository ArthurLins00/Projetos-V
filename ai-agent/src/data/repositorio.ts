import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Categoria, ChamadoRegistrado, Orgao, RegraRoteamento } from './mockData';

// Leitura crua dos arquivos de dados. Uso interno: as ferramentas do agente NÃO importam este
// módulo; elas passam pelas funções de acesso (acesso.ts), que registram cada uso no log.
// Os arquivos são relidos a cada chamada, então editar um JSON muda a resposta sem reiniciar.

export const PASTA_DADOS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dados');

function ler<T>(arquivo: string): T {
  const caminho = path.join(PASTA_DADOS, arquivo);
  try {
    return JSON.parse(readFileSync(caminho, 'utf8')) as T;
  } catch (err) {
    const motivo = err instanceof Error ? err.message : String(err);
    throw new Error(`Não foi possível ler o arquivo de dados ${arquivo}: ${motivo}`);
  }
}

export const lerCategorias = () => ler<Categoria[]>('categorias.json');
export const lerOrgaos = () => ler<Orgao[]>('orgaos.json');
export const lerRegras = () => ler<RegraRoteamento[]>('regras.json');
export const lerChamados = () => ler<ChamadoRegistrado[]>('chamados.json');
