import { STATUS_EXIBICAO, type ChamadoResumo, type ChamadosSource } from '../data/chamadosSource';

const MAX_PROTOCOLOS = 10;
const MAX_LISTAGEM = 20;

export interface ConsultarArgs {
  protocolos?: string[];
  status?: string;
}

export interface ConsultaResultado {
  total: number;
  resumo_por_status: Record<string, number>;
  chamados: ChamadoResumo[];
  nao_encontrados: string[];
}

export async function consultarStatusChamados(args: ConsultarArgs, fonte: ChamadosSource): Promise<ConsultaResultado> {
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

  return { total: chamados.length, resumo_por_status: resumo, chamados, nao_encontrados: naoEncontrados };
}
