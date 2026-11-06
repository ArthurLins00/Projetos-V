// Contrato da API: compara as rotas registradas no Express com as documentadas no Swagger (OpenAPI).
//   - rota no código sem documentação: o app ou os testes dependem de algo que ninguém descreveu;
//   - rota documentada que não existe: o Swagger promete algo que a API não atende;
//   - rota protegida documentada sem "security": o Swagger diz que ela é pública.
// Gera contrato-api.json (o resultado) e contrato-api-junit.xml (uma rota por caso) e escreve o resumo no sumário
// do job. Sai com código 1 se houver divergência, para o job reprovar.
//
// Uso: node .github/scripts/contract/check-contract.mjs <openapi.json> [--out contract-report]
//   O openapi.json é exportado do backend (o workflow faz isso com ts-node a partir de src/config/swagger.ts).

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expressRoutes, toOpenApiPath } from '../lib/api-routes.mjs';
import { junit } from '../lib/xml.mjs';

const args = process.argv.slice(2);
const specFile = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--out');
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'contract-report';
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

if (!specFile) {
  console.error('Uso: node check-contract.mjs <openapi.json> [--out pasta]');
  process.exit(2);
}

const spec = JSON.parse(readFileSync(specFile, 'utf8'));
const globalSecurity = Array.isArray(spec.security) && spec.security.length > 0;
const key = (method, path) => `${method} ${path}`;

const code = new Map(expressRoutes().map((r) => [key(r.metodo, toOpenApiPath(r.caminho)), r]));
const documented = new Map();
for (const [path, item] of Object.entries(spec.paths || {})) {
  for (const method of METHODS) {
    if (!item[method]) continue;
    const security = item[method].security ?? (globalSecurity ? spec.security : []);
    documented.set(key(method.toUpperCase(), path), { path, method: method.toUpperCase(), protegida: security.length > 0 });
  }
}

const semDocumentacao = [...code.entries()].filter(([k]) => !documented.has(k)).map(([, r]) => r);
const inexistentes = [...documented.entries()].filter(([k]) => !code.has(k)).map(([, d]) => d);
const semSecurity = [...code.entries()]
  .filter(([k, r]) => documented.has(k) && r.acesso !== 'público' && !documented.get(k).protegida)
  .map(([, r]) => r);
const ok = semDocumentacao.length + inexistentes.length + semSecurity.length === 0;

const result = {
  geradoEm: new Date().toISOString(),
  ok,
  totais: { codigo: code.size, documentadas: documented.size, emComum: [...code.keys()].filter((k) => documented.has(k)).length },
  semDocumentacao,
  inexistentes,
  semSecurity,
};

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'contrato-api.json'), `${JSON.stringify(result, null, 2)}\n`);
writeFileSync(
  join(OUT, 'contrato-api-junit.xml'),
  junit(
    [
      {
        name: 'Rotas do código documentadas no Swagger',
        cases: [...code.entries()].map(([k, r]) => {
          const doc = documented.get(k);
          const failed = !doc || (r.acesso !== 'público' && !doc.protegida);
          return {
            name: k,
            classname: r.arquivo,
            status: failed ? 'failed' : 'passed',
            message: !doc ? `não documentada (${r.arquivo}:${r.linha})` : failed ? `exige ${r.acesso}, mas o Swagger não declara security` : '',
          };
        }),
      },
      {
        name: 'Rotas do Swagger existentes no código',
        cases: [...documented.entries()].map(([k]) => ({ name: k, status: code.has(k) ? 'passed' : 'failed', message: code.has(k) ? '' : 'documentada, mas não existe no Express' })),
      },
    ],
    'Contrato da API · Fiscalize'
  )
);

const list = (title, items, fmt) => (items.length ? [`**${title}**`, '', ...items.map((i) => `- ${fmt(i)}`), ''] : []);
const summary = [
  `## ${ok ? '✅' : '❌'} Contrato da API`,
  '',
  `${result.totais.codigo} rotas no código · ${result.totais.documentadas} no Swagger · ${result.totais.emComum} em comum`,
  '',
  ...list('Rotas sem documentação no Swagger', semDocumentacao, (r) => `\`${r.metodo} ${toOpenApiPath(r.caminho)}\` (${r.arquivo}:${r.linha})`),
  ...list('Documentadas, mas inexistentes no código', inexistentes, (d) => `\`${d.method} ${d.path}\``),
  ...list('Protegidas no código, mas sem security no Swagger', semSecurity, (r) => `\`${r.metodo} ${toOpenApiPath(r.caminho)}\` (exige ${r.acesso})`),
  ok ? 'Toda rota do Express está documentada no Swagger e vice-versa.' : 'Atualize `backend/src/config/swagger.ts` ou as rotas para que os dois voltem a bater.',
  '',
].join('\n');

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
else process.stdout.write(summary);
process.exit(ok ? 0 : 1);
