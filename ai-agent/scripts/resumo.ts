// Resumo do log de uso dos dados (logs/uso-dados.jsonl):
//   - quantas vezes cada função de acesso foi chamada e quantos erros teve;
//   - quais registros foram mais consultados e quais nunca foram;
//   - as mensagens de erro.
//
//   npm run resumo                      lê o log padrão
//   npm run resumo -- caminho/do/log    lê outro arquivo
//
// Lê os arquivos de dados direto (repositorio.ts), sem passar pelas funções de acesso, para não
// acrescentar linhas ao próprio log que está resumindo.
import { existsSync, readFileSync } from 'node:fs';
import { caminhoLog, type Colecao, type LinhaLog } from '../src/data/logUso';
import { lerCategorias, lerChamados, lerOrgaos, lerRegras } from '../src/data/repositorio';
import { cinza, negrito } from '../src/cli/format';

const arquivo = process.argv[2] ?? caminhoLog();
if (!existsSync(arquivo)) {
  console.error(`Log não encontrado: ${arquivo}\nGere as chamadas primeiro: npm run chamadas`);
  process.exit(1);
}

const linhas: LinhaLog[] = readFileSync(arquivo, 'utf8')
  .split('\n')
  .filter((l) => l.trim())
  .flatMap((l, i) => {
    try {
      return [JSON.parse(l) as LinhaLog];
    } catch {
      console.error(cinza(`(linha ${i + 1} ignorada: JSON inválido)`));
      return [];
    }
  });

if (linhas.length === 0) {
  console.log('O log está vazio. Gere as chamadas primeiro: npm run chamadas');
  process.exit(0);
}

const contar = <K extends string | number>(m: Map<K, number>, k: K, n = 1) => m.set(k, (m.get(k) ?? 0) + n);

console.log(negrito(`Resumo do uso dos dados — ${arquivo}`));
console.log(`${linhas.length} chamadas de ${linhas[0].data_hora} a ${linhas[linhas.length - 1].data_hora}\n`);

// 1. Chamadas e erros por função
const porFuncao = new Map<string, { chamadas: number; erros: number; registros: number; chamadores: Set<string> }>();
for (const l of linhas) {
  const f = porFuncao.get(l.funcao) ?? { chamadas: 0, erros: 0, registros: 0, chamadores: new Set<string>() };
  f.chamadas++;
  if (!l.sucesso) f.erros++;
  f.registros += l.registros_retornados;
  f.chamadores.add(l.chamador);
  porFuncao.set(l.funcao, f);
}
console.log(negrito('Chamadas por função'));
console.table(
  [...porFuncao.entries()]
    .sort((a, b) => b[1].chamadas - a[1].chamadas)
    .map(([funcao, f]) => ({
      funcao,
      chamadas: f.chamadas,
      erros: f.erros,
      registros_retornados: f.registros,
      chamada_por: [...f.chamadores].join(', '),
    })),
);

// 2. Registros mais e nunca consultados, por conjunto de dados
const TODOS: Partial<Record<Colecao, Array<string | number>>> = {
  categorias: lerCategorias().map((c) => c.id),
  orgaos: lerOrgaos().map((o) => o.sigla),
  regras: lerRegras().map((r) => r.id),
  chamados: lerChamados().map((c) => c.protocolo),
};
const colecoes = [...new Set(linhas.map((l) => l.colecao))];
for (const colecao of [...Object.keys(TODOS), ...colecoes].filter((c, i, a) => a.indexOf(c) === i) as Colecao[]) {
  const vezes = new Map<string | number, number>();
  for (const l of linhas) if (l.colecao === colecao) for (const id of l.ids_retornados) contar(vezes, id);
  const ranking = [...vezes.entries()].sort((a, b) => b[1] - a[1]);
  console.log(negrito(`\nConjunto "${colecao}"`));
  console.log(
    `  Mais consultados: ${ranking.length ? ranking.slice(0, 5).map(([id, n]) => `${id} (${n}x)`).join(', ') : 'nenhum'}`,
  );
  const todos = TODOS[colecao];
  if (todos) {
    const nunca = todos.filter((id) => !vezes.has(id));
    console.log(`  Nunca consultados (${nunca.length} de ${todos.length}): ${nunca.length ? nunca.join(', ') : 'nenhum'}`);
  } else {
    console.log(cinza('  (dados vêm do backend, então não há lista completa para comparar)'));
  }
}

// 3. Erros
const erros = new Map<string, number>();
for (const l of linhas) if (!l.sucesso) contar(erros, `${l.funcao} ← ${l.chamador}: ${l.erro}`);
console.log(negrito(`\nErros (${[...erros.values()].reduce((a, b) => a + b, 0)})`));
if (erros.size === 0) console.log('  nenhum');
for (const [msg, n] of erros) console.log(`  ${n}x ${msg}`);
