import type { ChamadoResumo, ChamadosSource, FiltroChamados } from './chamadosSource';
import type { Categoria, ChamadoRegistrado, Orgao, RegraRoteamento, StatusChamado } from './mockData';
import { comRegistro, comRegistroAsync, type Origem } from './logUso';
import { lerCategorias, lerChamados, lerOrgaos, lerRegras } from './repositorio';

// Funções de acesso aos dados do agente. As ferramentas chegam aos dados SOMENTE por aqui, e cada
// chamada vira uma linha em logs/uso-dados.jsonl (ver logUso.ts).

const STATUS_FINALIZADOS: StatusChamado[] = ['Resolvido', 'Fechado'];

export interface RegraEncontrada {
  regra: RegraRoteamento;
  termos: string[];
}

/**
 * Procura a primeira regra de roteamento (de categoria ativa) cuja palavra-chave aparece no texto
 * já normalizado. Sem palavra reconhecida, devolve a regra padrão (triagem manual).
 * O texto do cidadão não vai para o log: só a quantidade de caracteres.
 */
export function encontrarRegraPorTexto(textoNormalizado: string, origem: Origem): RegraEncontrada {
  return comRegistro(
    'encontrarRegraPorTexto',
    'regras',
    origem,
    { tamanho_texto: textoNormalizado.length },
    () => {
      const ativas = new Set(lerCategorias().filter((c) => c.ativa).map((c) => c.id));
      const regras = lerRegras();
      for (const regra of regras) {
        if (regra.padrao || !ativas.has(regra.categoriaId)) continue;
        const termos = regra.palavrasChave.filter((p) => textoNormalizado.includes(p));
        if (termos.length > 0) return { regra, termos };
      }
      const padrao = regras.find((r) => r.padrao);
      if (!padrao) throw new Error('Nenhuma regra padrão cadastrada em regras.json.');
      return { regra: padrao, termos: [] };
    },
    (r) => [r.regra.id],
  );
}

/** Devolve a categoria se ela existir e estiver ativa; senão, erro claro. */
export function buscarCategoriaAtiva(categoriaId: number, origem: Origem): Categoria {
  return comRegistro(
    'buscarCategoriaAtiva',
    'categorias',
    origem,
    { categoria_id: categoriaId },
    () => {
      const categoria = lerCategorias().find((c) => c.id === categoriaId);
      if (!Number.isInteger(categoriaId) || !categoria) throw new Error(`Categoria inexistente: ${categoriaId}.`);
      if (!categoria.ativa) throw new Error(`Categoria inativa: ${categoriaId} (${categoria.nome}).`);
      return categoria;
    },
    (c) => [c.id],
  );
}

/** Devolve o órgão pela sigla; senão, erro claro. */
export function buscarOrgao(sigla: string, origem: Origem): Orgao {
  return comRegistro(
    'buscarOrgao',
    'orgaos',
    origem,
    { sigla },
    () => {
      const orgao = lerOrgaos().find((o) => o.sigla === sigla);
      if (!orgao) throw new Error(`Órgão inexistente: ${sigla}.`);
      return orgao;
    },
    (o) => [o.sigla],
  );
}

/** Chamados ainda não finalizados de uma categoria. Lista vazia quando não há nenhum. */
export function listarChamadosAbertosPorCategoria(categoriaId: number, origem: Origem): ChamadoRegistrado[] {
  return comRegistro(
    'listarChamadosAbertosPorCategoria',
    'chamados',
    origem,
    { categoria_id: categoriaId },
    () => lerChamados().filter((c) => c.categoriaId === categoriaId && !STATUS_FINALIZADOS.includes(c.status)),
    (lista) => lista.map((c) => c.protocolo),
  );
}

/**
 * Chamados que o usuário logado pode ver (perfil acompanhamento, no app). A fonte é o backend
 * (GET /demands com o JWT do usuário) ou o mock da CLI. Lista vazia quando não há nenhum.
 */
export function listarChamadosDoUsuario(fonte: ChamadosSource, filtro: FiltroChamados, origem: Origem): Promise<ChamadoResumo[]> {
  return comRegistroAsync(
    'listarChamadosDoUsuario',
    'chamados_do_usuario',
    origem,
    { ...(filtro.busca && { busca: filtro.busca }), ...(filtro.status && { status: filtro.status }) },
    () => fonte.listar(filtro),
    (lista) => lista.map((c) => c.protocolo),
  );
}
