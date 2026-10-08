/**
 * Perfil "acompanhamento" (chat do app): consulta de status com regra de acesso por perfil.
 * Offline: usa fonte mockada, um backend falso (node:http) e o LLM roteirizado.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { FiscalizeAgent } from '../src/agent';
import { BackendChamadosSource, MockChamadosSource, USUARIOS_DEMO, type ChamadoResumo } from '../src/data/chamadosSource';
import { PERFIL_ACOMPANHAMENTO } from '../src/perfis/acompanhamento';
import { createAgentServer } from '../src/server';
import { consultarStatusChamados } from '../src/tools/consultarStatusChamados';
import { ScriptedModelClient, chamarFerramenta, responder, ultimaSaida } from './scriptedClient';

const cidadao = new MockChamadosSource(USUARIOS_DEMO.cidadao);
const admin = new MockChamadosSource(USUARIOS_DEMO.admin);
const PROTOCOLO_DO_VIZINHO = 'DEM-20261003-E8SG';

async function ouvir(server: Server): Promise<string> {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe('consultar_status_chamados — regra de acesso', () => {
  it('cidadão lista apenas os próprios chamados', async () => {
    const r = await consultarStatusChamados({}, cidadao);
    assert.deepEqual(r.chamados.map((c) => c.protocolo).sort(), ['DEM-20260815-B1TT', 'DEM-20260921-A7K2', 'DEM-20261001-C4RR']);
    assert.deepEqual(r.resumo_por_status, { 'Em Andamento': 1, Aberto: 1, Resolvido: 1 });
  });

  it('cidadão consulta vários protocolos; o de outro cidadão volta como não encontrado', async () => {
    const r = await consultarStatusChamados({ protocolos: ['dem-20260921-a7k2', PROTOCOLO_DO_VIZINHO] }, cidadao);
    assert.deepEqual(r.chamados.map((c) => c.status), ['Em Andamento']);
    assert.deepEqual(r.nao_encontrados, [PROTOCOLO_DO_VIZINHO]);
  });

  it('admin enxerga chamados de qualquer cidadão', async () => {
    const r = await consultarStatusChamados({ protocolos: [PROTOCOLO_DO_VIZINHO] }, admin);
    assert.equal(r.chamados[0]?.status, 'Em Análise');
    assert.equal((await consultarStatusChamados({}, admin)).total, 4);
  });

  it('não devolve dados de quem abriu o chamado', async () => {
    const r = await consultarStatusChamados({}, admin);
    for (const c of r.chamados) assert.ok(!('donoId' in c));
  });

  it('valida status e quantidade de protocolos', async () => {
    await assert.rejects(consultarStatusChamados({ status: 'Perdido' }, cidadao), /Status inválido/);
    const muitos = Array.from({ length: 11 }, (_, i) => `DEM-20260101-000${i}`);
    await assert.rejects(consultarStatusChamados({ protocolos: muitos }, cidadao), /no máximo 10/);
  });
});

describe('BackendChamadosSource — consulta GET /demands com o JWT do usuário', () => {
  let backend: Server;
  let url: string;
  const recebidos: { auth?: string; query: URLSearchParams }[] = [];

  before(async () => {
    backend = createServer((req, res) => {
      const u = new URL(req.url!, 'http://x');
      recebidos.push({ ...(req.headers.authorization && { auth: req.headers.authorization }), query: u.searchParams });
      if (req.headers.authorization !== 'Bearer token-valido') {
        res.writeHead(401).end(JSON.stringify({ error: 'Token inválido.' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({
        data: [{
          id: 'uuid-1', protocolo: 'DEM-20261005-ABCD', title: 'Poste apagado', status: 'Em Andamento',
          location: 'Rua X, 10', category: { id: 3, nome: 'Iluminação Pública' },
          creator: { id: 'u1', nome: 'Fulano', email: 'fulano@x.com' },
          createdAt: '2026-10-05T10:00:00Z', updatedAt: '2026-10-06T10:00:00Z',
        }],
      }));
    });
    url = await ouvir(backend);
  });
  after(() => backend.close());

  it('repassa o token, converte o filtro de status e descarta o creator', async () => {
    const fonte = new BackendChamadosSource(url, 'token-valido');
    const lista = await fonte.listar({ status: 'Em Análise', busca: 'DEM-20261005-ABCD' });

    const req = recebidos.at(-1)!;
    assert.equal(req.auth, 'Bearer token-valido');
    assert.equal(req.query.get('status'), 'Em_An_lise');
    assert.equal(req.query.get('busca'), 'DEM-20261005-ABCD');
    assert.deepEqual(lista[0], {
      id: 'uuid-1', protocolo: 'DEM-20261005-ABCD', titulo: 'Poste apagado', categoria: 'Iluminação Pública',
      status: 'Em Andamento', endereco: 'Rua X, 10', criado_em: '2026-10-05T10:00:00Z', atualizado_em: '2026-10-06T10:00:00Z',
    } satisfies ChamadoResumo);
    assert.doesNotMatch(JSON.stringify(lista), /Fulano|fulano@x\.com/);
  });

  it('token inválido vira erro amigável', async () => {
    await assert.rejects(new BackendChamadosSource(url, 'expirado').listar({}), /Sessão inválida/);
  });
});

describe('Servidor do agente (POST /chat)', () => {
  let server: Server;
  let url: string;
  const tokensUsados: string[] = [];

  before(async () => {
    // Roteiro: a cada mensagem o "modelo" consulta a ferramenta e resume o resultado
    const passos = Array.from({ length: 2 }).flatMap(() => [
      chamarFerramenta('consultar_status_chamados', {}),
      responder((h) => `Você tem ${ultimaSaida(h, 'consultar_status_chamados').total} chamado(s).`),
    ]);
    server = createAgentServer({
      client: new ScriptedModelClient(passos),
      apiUrl: 'http://nao-usado',
      secret: 'segredo-123',
      createSource: (token) => {
        tokensUsados.push(token);
        return token === 'jwt-admin' ? admin : cidadao;
      },
    });
    url = await ouvir(server);
  });
  after(() => server.close());

  const post = (body: unknown, headers: Record<string, string>) =>
    fetch(`${url}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

  it('exige o segredo compartilhado e o token do usuário', async () => {
    assert.equal((await post({ message: 'oi' }, { Authorization: 'Bearer jwt-cidadao' })).status, 403);
    assert.equal((await post({ message: 'oi' }, { 'x-agent-secret': 'segredo-123' })).status, 401);
    assert.equal((await post({ message: '' }, { 'x-agent-secret': 'segredo-123', Authorization: 'Bearer x' })).status, 400);
  });

  it('responde usando a fonte de dados do token recebido e mantém a sessão', async () => {
    const headers = { 'x-agent-secret': 'segredo-123', Authorization: 'Bearer jwt-cidadao' };
    const r1 = await post({ sessionId: 'user-1:abc', message: 'Como estão meus chamados?' }, headers);
    const b1 = (await r1.json()) as any;
    assert.equal(r1.status, 200);
    assert.equal(b1.sessionId, 'user-1:abc');
    assert.equal(b1.reply, 'Você tem 3 chamado(s).');
    assert.equal(b1.toolCalls[0].name, 'consultar_status_chamados');
    assert.equal(b1.toolCalls[0].ok, true);

    const r2 = await post({ sessionId: 'user-1:abc', message: 'E agora?' }, { ...headers, Authorization: 'Bearer jwt-admin' });
    assert.equal(((await r2.json()) as any).reply, 'Você tem 4 chamado(s).');
    assert.deepEqual(tokensUsados, ['jwt-cidadao', 'jwt-admin']);
  });
});

describe('Agente — perfil acompanhamento', () => {
  it('encadeia mensagem → ferramenta → resposta com os protocolos pedidos', async () => {
    const pergunta = 'Qual o status do DEM-20260921-A7K2 e do DEM-20261001-C4RR?';
    const client = new ScriptedModelClient([
      chamarFerramenta('consultar_status_chamados', { protocolos: ['DEM-20260921-A7K2', 'DEM-20261001-C4RR'] }),
      responder((h) =>
        ultimaSaida(h, 'consultar_status_chamados').chamados.map((c: ChamadoResumo) => `${c.protocolo}: ${c.status}`).join('\n'),
      ),
    ]);
    const agent = new FiscalizeAgent(client, { perfil: PERFIL_ACOMPANHAMENTO, contexto: { chamados: cidadao } });
    const reply = await agent.send(pergunta);
    assert.equal(reply.text, 'DEM-20260921-A7K2: Em Andamento\nDEM-20261001-C4RR: Aberto');
  });
});
