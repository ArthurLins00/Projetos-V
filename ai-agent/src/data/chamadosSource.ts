/**
 * Origem dos chamados consultados pelo perfil "acompanhamento".
 *
 * Regra de acesso (mesma do backend, GET /demands):
 *   - Cidadão: só enxerga os próprios chamados;
 *   - Gestor / Admin: enxergam todos.
 * No modo integrado quem aplica a regra é o BACKEND, porque a consulta usa o JWT do próprio
 * usuário: o agente nunca tem mais acesso do que a pessoa que está conversando com ele.
 */

export type Perfil = 'Cidadao' | 'Gestor' | 'Admin';

/** Projeção devolvida ao modelo: sem nome/e-mail/CPF de quem abriu o chamado (minimização de dados). */
export interface ChamadoResumo {
  id: string;
  protocolo: string;
  titulo: string;
  categoria: string;
  status: string;
  endereco: string;
  criado_em: string;
  atualizado_em: string;
}

export interface FiltroChamados {
  busca?: string;
  status?: string;
}

export interface ChamadosSource {
  listar(filtro: FiltroChamados): Promise<ChamadoResumo[]>;
}

export const STATUS_EXIBICAO = ['Aberto', 'Em Análise', 'Aguardando', 'Em Andamento', 'Resolvido', 'Fechado'] as const;

// ───────────────────────────── Mock (sem backend) ─────────────────────────────

interface ChamadoMock extends ChamadoResumo {
  donoId: string;
}

export const USUARIOS_DEMO = {
  cidadao: { id: 'cidadao-demo', perfil: 'Cidadao' as Perfil },
  outroCidadao: { id: 'cidadao-vizinho', perfil: 'Cidadao' as Perfil },
  admin: { id: 'admin-demo', perfil: 'Admin' as Perfil },
};

export const CHAMADOS_DEMO: ChamadoMock[] = [
  { id: 'c1', donoId: 'cidadao-demo', protocolo: 'DEM-20260921-A7K2', titulo: 'Fiação exposta com risco elétrico', categoria: 'Iluminação Pública', status: 'Em Andamento', endereco: 'Av. Boa Viagem, 1200', criado_em: '2026-09-21T10:00:00Z', atualizado_em: '2026-10-01T14:30:00Z' },
  { id: 'c2', donoId: 'cidadao-demo', protocolo: 'DEM-20261001-C4RR', titulo: 'Calçada danificada', categoria: 'Infraestrutura', status: 'Aberto', endereco: 'Rua dos Navegantes, 45', criado_em: '2026-10-01T08:15:00Z', atualizado_em: '2026-10-01T08:15:00Z' },
  { id: 'c3', donoId: 'cidadao-demo', protocolo: 'DEM-20260815-B1TT', titulo: 'Poste apagado', categoria: 'Iluminação Pública', status: 'Resolvido', endereco: 'Rua Setúbal, 300', criado_em: '2026-08-15T19:40:00Z', atualizado_em: '2026-08-17T09:00:00Z' },
  { id: 'c4', donoId: 'cidadao-vizinho', protocolo: 'DEM-20261003-E8SG', titulo: 'Esgoto a céu aberto', categoria: 'Água e Esgoto', status: 'Em Análise', endereco: 'Rua da Aurora, 80', criado_em: '2026-10-03T07:20:00Z', atualizado_em: '2026-10-04T11:00:00Z' },
];

/** Simula o backend em memória, aplicando a mesma regra de acesso por perfil. */
export class MockChamadosSource implements ChamadosSource {
  constructor(private readonly usuario: { id: string; perfil: Perfil }) {}

  async listar({ busca, status }: FiltroChamados): Promise<ChamadoResumo[]> {
    const termo = busca?.toLowerCase();
    return CHAMADOS_DEMO
      .filter((c) => this.usuario.perfil !== 'Cidadao' || c.donoId === this.usuario.id)
      .filter((c) => (status ? c.status === status : this.usuario.perfil !== 'Cidadao' || c.status !== 'Fechado'))
      .filter((c) => !termo || [c.protocolo, c.titulo, c.endereco].some((v) => v.toLowerCase().includes(termo)))
      .map(({ donoId: _dono, ...publico }) => publico);
  }
}

// ──────────────────────────── API real do Fiscalize ────────────────────────────

// Valores do enum aceitos pelo filtro ?status= de GET /demands
const STATUS_API: Record<string, string> = {
  Aberto: 'Aberto',
  'Em Análise': 'Em_An_lise',
  Aguardando: 'Aguardando',
  'Em Andamento': 'Em_Andamento',
  Resolvido: 'Resolvido',
  Fechado: 'Fechado',
};

interface DemandApi {
  id: string;
  protocolo: string;
  title: string;
  status: string;
  location: string;
  category?: { nome?: string };
  createdAt: string;
  updatedAt: string;
}

/** Consulta GET /demands do backend com o token do usuário que está no chat. */
export class BackendChamadosSource implements ChamadosSource {
  constructor(private readonly apiUrl: string, private readonly token: string) {}

  async listar({ busca, status }: FiltroChamados): Promise<ChamadoResumo[]> {
    const params = new URLSearchParams({ limit: '50' });
    if (busca) params.set('busca', busca);
    if (status) params.set('status', STATUS_API[status] ?? status);

    const response = await fetch(`${this.apiUrl.replace(/\/$/, '')}/demands?${params}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await response.json().catch(() => ({}))) as { data?: DemandApi[]; error?: string };

    if (response.status === 401 || response.status === 403) {
      throw new Error('Sessão inválida ou sem permissão. Peça ao usuário para entrar novamente no app.');
    }
    if (!response.ok) {
      throw new Error(body.error ?? `Falha ao consultar chamados (HTTP ${response.status}).`);
    }

    // Projeção explícita: o campo `creator` (nome/e-mail) da API é descartado.
    return (body.data ?? []).map((d) => ({
      id: d.id,
      protocolo: d.protocolo,
      titulo: d.title,
      categoria: d.category?.nome ?? '',
      status: d.status,
      endereco: d.location,
      criado_em: d.createdAt,
      atualizado_em: d.updatedAt,
    }));
  }
}
