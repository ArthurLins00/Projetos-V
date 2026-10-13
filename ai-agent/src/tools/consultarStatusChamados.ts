import { STATUS_EXIBICAO, type ChamadoResumo, type ChamadosSource } from '../data/chamadosSource';

const MAX_PROTOCOLOS = 10;
const MAX_LISTAGEM = 20;

export interface ConsultarArgs {
  protocolos?: string[];
  status?: string;
}

export type SituacaoPrazo = 'no_prazo' | 'vencido' | 'encerrado' | 'sem_prazo';

export interface ChamadoConsultado extends ChamadoResumo {
  situacao_prazo: SituacaoPrazo;
  horas_para_o_prazo: number | null;
}

export interface ConsultaResultado {
  consultado_em: string;
  total: number;
  resumo_por_status: Record<string, number>;
  chamados: ChamadoConsultado[];
  nao_encontrados: string[];
}

const STATUS_ENCERRADOS = ['Resolvido', 'Fechado'];

function comPrazo(chamado: ChamadoResumo, agora: Date): ChamadoConsultado {
  if (STATUS_ENCERRADOS.includes(chamado.status)) {
    return { ...chamado, situacao_prazo: 'encerrado', horas_para_o_prazo: null };
  }
  const limite = chamado.prazo_limite ? new Date(chamado.prazo_limite).getTime() : NaN;
  if (Number.isNaN(limite)) {
    return { ...chamado, situacao_prazo: 'sem_prazo', horas_para_o_prazo: null };
  }
  const horas = Math.round((limite - agora.getTime()) / 3_600_000);
  return { ...chamado, situacao_prazo: horas < 0 ? 'vencido' : 'no_prazo', horas_para_o_prazo: horas };
}

export async function consultarStatusChamados(
  args: ConsultarArgs,
  fonte: ChamadosSource,
  agora: Date = new Date(),
): Promise<ConsultaResultado> {
  const status = args.status ? String(args.status) : undefined;
  if (status && !(STATUS_EXIBICAO as readonly string[]).includes(status)) {
    throw new Error(`Status inválido: ${status}. Use um de: ${STATUS_EXIBICAO.join(', ')}.`);
  }

  const protocolos = [...new Set((args.protocolos ?? []).map((p) => String(p).trim().toUpperCase()).filter(Boolean))];
  if (protocolos.length > MAX_PROTOCOLOS) {
    throw new Error(`Consulte no máximo ${MAX_PROTOCOLOS} protocolos por vez.`);
  }

  let chamados: ChamadoResumo[];
  const naoEncontrados: string[] = [];

  if (protocolos.length > 0) {
    chamados = [];
    for (const protocolo of protocolos) {
      const encontrados = await fonte.listar({ busca: protocolo });
      const exato = encontrados.find((c) => c.protocolo.toUpperCase() === protocolo);
      if (exato) chamados.push(exato);
      else naoEncontrados.push(protocolo);
    }
  } else {
    chamados = (await fonte.listar(status ? { status } : {})).slice(0, MAX_LISTAGEM);
  }

  const resumo: Record<string, number> = {};
  for (const c of chamados) resumo[c.status] = (resumo[c.status] ?? 0) + 1;

  return {
    consultado_em: agora.toISOString(),
    total: chamados.length,
    resumo_por_status: resumo,
    chamados: chamados.map((c) => comPrazo(c, agora)),
    nao_encontrados: naoEncontrados,
  };
}
