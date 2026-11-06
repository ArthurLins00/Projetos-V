// Rotas da API lidas do código do backend, sem executá-lo: os prefixos vêm de app.use('/x', xRoutes) em
// backend/src/app.ts e as rotas, de router.get|post|put|patch|delete('/caminho', ...) em cada arquivo de rotas.
// Usado pelo relatório técnico (tech-report/) e pela verificação do contrato da API (contract/).
//   [{ metodo: 'GET', caminho: '/demands/:id', acesso: 'autenticado' | 'público' | 'Gestor, Admin', arquivo, linha }]

import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(file, 'utf8');
const lineOf = (src, index) => src.slice(0, index).split('\n').length;

export function expressRoutes(root = '.') {
  const appFile = 'backend/src/app.ts';
  const app = read(`${root}/${appFile}`);
  const imports = Object.fromEntries([...app.matchAll(/import\s+(\w+)\s+from\s+'\.\/routes\/(\w+)'/g)].map((m) => [m[1], `backend/src/routes/${m[2]}.ts`]));
  const routes = [];
  for (const [, prefix, name] of app.matchAll(/app\.use\('([^']+)',\s*(\w+Routes)\)/g)) {
    const file = imports[name];
    if (!file) continue;
    const src = read(`${root}/${file}`);
    const fileAuth = /router\.use\(\s*authenticate/.test(src);
    const fileRoles = src.match(/router\.use\(\s*requireRole\(\[([^\]]*)\]/)?.[1];
    for (const match of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']+)'([\s\S]*?)\);/g)) {
      const [, method, sub, rest] = match;
      const roles = rest.match(/requireRole\(\[([^\]]*)\]/)?.[1] ?? fileRoles;
      const auth = fileAuth || /authenticate/.test(rest);
      routes.push({
        metodo: method.toUpperCase(),
        caminho: `${prefix}${sub === '/' ? '' : sub}` || '/',
        acesso: roles ? roles.replace(/['"\s]/g, '').split(',').join(', ') : auth ? 'autenticado' : 'público',
        arquivo: file,
        linha: lineOf(src, match.index),
      });
    }
  }
  // Rotas registradas direto no app (app.get('/health', ...)); /docs e /docs.json servem a própria documentação
  for (const match of app.matchAll(/app\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)) {
    if (match[2].startsWith('/docs')) continue;
    routes.push({ metodo: match[1].toUpperCase(), caminho: match[2], acesso: 'público', arquivo: appFile, linha: lineOf(app, match.index) });
  }
  return routes;
}

// '/demands/:id/photos/:photoId' → '/demands/{id}/photos/{photoId}' (formato OpenAPI)
export const toOpenApiPath = (path) => path.replace(/:(\w+)/g, '{$1}');
