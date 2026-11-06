// Relatório de segurança da pipeline (workflow seguranca.yml). Junta quatro fontes:
//   audit-<projeto>.json        npm audit de cada projeto (dependências com vulnerabilidade conhecida)
//   gitleaks-atual.json         segredos na versão atual do código (gitleaks dir, com --redact)
//   gitleaks-historico.json     segredos em qualquer commit do histórico (gitleaks git, com --redact)
//   semgrep.json                análise estática do código (SAST)
// e os controles do projeto verificados por controls.mjs. Gera:
//   relatorio-seguranca.html    o resultado em linguagem simples, com o que fazer
//   seguranca.xml               todos os achados em XML estruturado
//   seguranca-junit.xml         os mesmos achados como JUnit (cada achado grave é um "teste" que falha)
//   issue.md / issue.json       corpo da issue da Segurança diária (o que fazer em cada item) e a situação,
//                               usados por sync-issue.mjs
// e um resumo no sumário do job. Fonte ausente aparece como "não executada", sem quebrar o relatório.
// Nunca grava o valor de um segredo: só regra, arquivo, linha e commit.
//
// Uso: node .github/scripts/security/render-security.mjs [--reports reports] [--out security-report]

import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CSS, dateTime, esc, table } from '../lib/report-html.mjs';
import { el, junit, xmlDocument } from '../lib/xml.mjs';
import { checkControls } from './controls.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const REPORTS = opt('--reports', 'reports');
const OUT = opt('--out', 'security-report');
const PROJECTS = ['backend', 'mobile', 'ai-agent', 'e2e'];
const SEVERITIES = ['critical', 'high', 'moderate', 'low', 'info'];
const SEV_PT = { critical: 'crítica', high: 'alta', moderate: 'moderada', low: 'baixa', info: 'informativa' };
const SEMGREP_PT = { ERROR: 'erro', WARNING: 'aviso', INFO: 'informativo' };
const STATUS_PT = { ok: 'OK', aviso: 'Aviso', falha: 'Falha' };
const STATUS_CLS = { ok: 'ok', aviso: 'warn', falha: 'fail' };

function readJson(file) {
  const full = join(REPORTS, file);
  if (!existsSync(full)) return null;
  try {
    const text = readFileSync(full, 'utf8').trim();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const short = (sha) => (sha ? String(sha).slice(0, 7) : '');

// ---------- Leitura de cada fonte ----------

const PROJECT_DIR = { backend: 'backend', mobile: 'mobile', 'ai-agent': 'ai-agent', e2e: '.' };
const majorOf = (version) => Number(String(version ?? '').match(/\d+/)?.[0] ?? NaN);

// Versão instalada de um pacote, lida do package-lock.json do projeto (o script roda na raiz do repositório)
const locks = {};
function installedVersion(projeto, name) {
  if (!(projeto in locks)) {
    try {
      locks[projeto] = JSON.parse(readFileSync(join(PROJECT_DIR[projeto], 'package-lock.json'), 'utf8'));
    } catch {
      locks[projeto] = null;
    }
  }
  return locks[projeto]?.packages?.[`node_modules/${name}`]?.version ?? null;
}

// O npm audit às vezes "corrige" voltando o pacote principal para uma major antiga (ex.: jest 30 → 25, expo 58 → 53).
// Isso desfaz atualizações e quebra o projeto: é marcado como rebaixamento e nunca recomendado.
function describeFix(projeto, fix) {
  if (fix === true) return { correcao: 'npm audit fix', tipo: 'automatica' };
  if (!fix) return { correcao: 'sem correção publicada', tipo: 'nenhuma' };
  const installed = installedVersion(projeto, fix.name);
  if (installed && majorOf(fix.version) < majorOf(installed)) {
    return { correcao: `não aplicar: o npm sugere ${fix.name}@${fix.version}, mais antigo que o instalado (${installed})`, tipo: 'rebaixamento' };
  }
  return { correcao: `${fix.name}@${fix.version}${fix.isSemVerMajor ? ' (versão major)' : ''}`, tipo: fix.isSemVerMajor ? 'major' : 'versao' };
}

function readAudit() {
  return PROJECTS.map((projeto) => {
    const report = readJson(`audit-${projeto}.json`);
    if (!report?.metadata) return { projeto, disponivel: false, contagem: {}, vulnerabilidades: [] };
    const vulnerabilidades = Object.values(report.vulnerabilities || {}).map((v) => {
      const advisory = (v.via || []).find((via) => typeof via === 'object');
      return {
        pacote: v.name,
        severidade: v.severity,
        faixa: v.range || '',
        direta: Boolean(v.isDirect),
        titulo: advisory?.title || `vem de ${(v.via || []).filter((x) => typeof x === 'string').join(', ')}`,
        url: advisory?.url || '',
        // Pacote com o aviso em si (não só "vem de" outro pacote vulnerável)
        origem: Boolean(advisory),
        ...describeFix(projeto, v.fixAvailable),
      };
    });
    vulnerabilidades.sort((a, b) => SEVERITIES.indexOf(a.severidade) - SEVERITIES.indexOf(b.severidade));
    return { projeto, disponivel: true, contagem: report.metadata.vulnerabilities || {}, vulnerabilidades };
  });
}

function readGitleaks(file) {
  const report = readJson(file);
  if (!Array.isArray(report)) return { disponivel: false, achados: [] };
  // Só metadados: o valor (Secret/Match) nunca entra no relatório, mesmo que o --redact falhe
  const achados = report.map((f) => ({
    regra: f.RuleID,
    descricao: f.Description,
    arquivo: f.File,
    linha: f.StartLine,
    commit: f.Commit || '',
    data: f.Date || '',
    impressao: f.Fingerprint,
  }));
  return { disponivel: true, achados };
}

function readSemgrep() {
  const report = readJson('semgrep.json');
  if (!report || !Array.isArray(report.results)) return { disponivel: false, achados: [], erros: 0 };
  const list = (value) => [value].flat().filter(Boolean).map(String);
  const achados = report.results.map((r) => ({
    regra: r.check_id,
    regraCurta: String(r.check_id).split('.').pop(),
    severidade: r.extra?.severity || 'INFO',
    arquivo: r.path,
    linha: r.start?.line,
    mensagem: String(r.extra?.message || '').replace(/\s+/g, ' ').trim(),
    cwe: list(r.extra?.metadata?.cwe),
    owasp: list(r.extra?.metadata?.owasp),
  }));
  const order = { ERROR: 0, WARNING: 1, INFO: 2 };
  achados.sort((a, b) => (order[a.severidade] ?? 3) - (order[b.severidade] ?? 3));
  return { disponivel: true, achados, erros: (report.errors || []).length };
}

// ---------- Análise ----------

function analyze() {
  const audit = readAudit();
  const segredosAtual = readGitleaks('gitleaks-atual.json');
  const segredosHistorico = readGitleaks('gitleaks-historico.json');
  // O histórico inclui a versão atual; mostra à parte só o que já foi removido do código
  const atuais = new Set(segredosAtual.achados.map((a) => `${a.regra}|${a.arquivo}|${a.linha}`));
  segredosHistorico.achados = segredosHistorico.achados.filter((a) => !atuais.has(`${a.regra}|${a.arquivo}|${a.linha}`));
  const sast = readSemgrep();
  const controles = checkControls();

  const vuln = Object.fromEntries(SEVERITIES.map((s) => [s, audit.reduce((sum, p) => sum + (p.contagem[s] || 0), 0)]));
  const sastCount = { ERROR: 0, WARNING: 0, INFO: 0 };
  for (const a of sast.achados) sastCount[a.severidade] = (sastCount[a.severidade] || 0) + 1;
  const ctl = { ok: 0, aviso: 0, falha: 0 };
  for (const c of controles) ctl[c.status]++;

  const fontes = {
    dependencias: audit.some((p) => p.disponivel),
    segredos: segredosAtual.disponivel,
    historico: segredosHistorico.disponivel,
    sast: sast.disponivel,
  };

  const grave = vuln.critical + vuln.high > 0 || segredosAtual.achados.length > 0 || sastCount.ERROR > 0 || ctl.falha > 0;
  const atencao = vuln.moderate > 0 || segredosHistorico.achados.length > 0 || sastCount.WARNING > 0 || ctl.aviso > 0 || Object.values(fontes).some((f) => !f);
  const situacao = grave ? 'vermelho' : atencao ? 'amarelo' : 'verde';

  return {
    generatedAt: new Date().toISOString(),
    run: process.env.GITHUB_RUN_ID
      ? {
          id: process.env.GITHUB_RUN_ID,
          workflow: process.env.GITHUB_WORKFLOW,
          branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME,
          sha: process.env.GITHUB_SHA,
          url: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
        }
      : null,
    ferramentas: {
      'npm audit': process.env.NPM_VERSION ? `npm ${process.env.NPM_VERSION}` : 'npm',
      gitleaks: process.env.GITLEAKS_VERSION || '',
      semgrep: process.env.SEMGREP_VERSION || '',
    },
    situacao, fontes, audit, vuln, segredosAtual, segredosHistorico, sast, sastCount, controles, ctl,
  };
}

// ---------- Linguagem simples: o que precisa de atenção ----------

function risks(d) {
  const list = [];
  if (!d.fontes.dependencias || !d.fontes.segredos || !d.fontes.sast) {
    const faltou = [!d.fontes.dependencias && 'auditoria de dependências', !d.fontes.segredos && 'busca de segredos', !d.fontes.sast && 'análise estática'].filter(Boolean);
    list.push({ nivel: 'warn', titulo: `Parte da verificação não rodou: ${faltou.join(', ')}`, texto: 'O resultado abaixo está incompleto. Veja o log da execução para saber por que a ferramenta falhou e rode o workflow de novo.' });
  }
  if (d.segredosAtual.achados.length) {
    list.push({ nivel: 'fail', titulo: `${plural(d.segredosAtual.achados.length, 'possível segredo encontrado', 'possíveis segredos encontrados')} no código atual`, texto: 'Uma senha, chave de API ou token parece estar escrito direto em um arquivo do repositório, que é público. Se for real, considere-o vazado: troque a chave no serviço de origem, mova o valor para variável de ambiente e remova do código. Se for um valor de teste, registre a exceção no .gitleaks.toml.' });
  }
  if (d.vuln.critical + d.vuln.high) {
    const pacotes = [...new Set(d.audit.flatMap((p) => p.vulnerabilidades.filter((v) => ['critical', 'high'].includes(v.severidade)).map((v) => v.pacote)))];
    list.push({ nivel: 'fail', titulo: `${plural(d.vuln.critical + d.vuln.high, 'vulnerabilidade crítica ou alta', 'vulnerabilidades críticas ou altas')} em bibliotecas`, texto: `Bibliotecas usadas pelo projeto têm falhas de segurança conhecidas (${pacotes.slice(0, 6).join(', ')}${pacotes.length > 6 ? '…' : ''}). Atualize para a versão indicada na coluna "Correção"; se não houver correção, avalie se o trecho vulnerável é usado.` });
  }
  if (d.sastCount.ERROR) {
    list.push({ nivel: 'fail', titulo: `${plural(d.sastCount.ERROR, 'trecho de código com padrão inseguro grave', 'trechos de código com padrões inseguros graves')}`, texto: 'A análise estática encontrou construções que costumam levar a falhas exploráveis (injeção, criptografia fraca, desserialização insegura). Revise cada trecho; se for falso positivo, adicione um comentário nosemgrep explicando o motivo.' });
  }
  for (const c of d.controles.filter((x) => x.status === 'falha')) {
    list.push({ nivel: 'fail', titulo: `Controle enfraquecido: ${c.titulo}`, texto: c.explicacao });
  }
  if (d.vuln.moderate) {
    list.push({ nivel: 'warn', titulo: `${plural(d.vuln.moderate, 'vulnerabilidade moderada', 'vulnerabilidades moderadas')} em bibliotecas`, texto: 'Risco menor, mas vale atualizar na próxima manutenção das dependências.' });
  }
  if (d.sastCount.WARNING) {
    list.push({ nivel: 'warn', titulo: `${plural(d.sastCount.WARNING, 'alerta', 'alertas')} da análise estática`, texto: 'Padrões que merecem revisão, mas que nem sempre são exploráveis. Confira a tabela de análise estática.' });
  }
  if (d.segredosHistorico.achados.length) {
    list.push({ nivel: 'warn', titulo: `${plural(d.segredosHistorico.achados.length, 'possível segredo', 'possíveis segredos')} só no histórico do Git`, texto: 'Já foram removidos do código, mas continuam visíveis em commits antigos de um repositório público. Se algum era uma chave real, ela precisa ser trocada; apagar o arquivo não basta.' });
  }
  for (const c of d.controles.filter((x) => x.status === 'aviso')) {
    list.push({ nivel: 'warn', titulo: c.titulo, texto: c.explicacao });
  }
  return list;
}

// ---------- HTML ----------

const pill = (cls, text) => `<span class="pill ${cls}">${esc(text)}</span>`;
const kpi = (label, value, foot, cls = '') => `<div class="card kpi"><div class="label">${esc(label)}</div><div class="value">${value}</div><div class="foot">${cls ? pill(cls, foot) : esc(foot)}</div></div>`;
const loc = (file, line) => `<code>${esc(file)}${line ? `:${esc(line)}` : ''}</code>`;
const notRun = '<p class="warnbox">Esta verificação não foi executada nesta rodada (ferramenta indisponível ou falhou). Veja o log do job.</p>';

function html(d) {
  const banner = {
    verde: ['ok', 'Nenhum problema de segurança encontrado', 'As dependências não têm vulnerabilidades relevantes, não há segredos no código, a análise estática não apontou problemas e todos os controles documentados estão no código.'],
    amarelo: ['warn', 'Sem problemas graves, mas há pontos de atenção', 'Nada exige ação imediata. Os itens abaixo são melhorias ou controles previstos para produção que ainda não foram implementados.'],
    vermelho: ['fail', 'Há problemas de segurança que precisam de ação', 'Pelo menos um item grave foi encontrado. Comece pela lista "O que precisa de atenção", que está em ordem de prioridade.'],
  }[d.situacao];
  const r = risks(d);
  const runMeta = d.run
    ? `${esc(d.run.workflow)} · ${esc(d.run.branch)} · <code>${esc(short(d.run.sha))}</code> · <a href="${esc(d.run.url)}">execução #${esc(d.run.id)}</a>`
    : 'execução local';

  const auditRows = d.audit.map((p) =>
    p.disponivel
      ? `<tr><td>${esc(p.projeto)}</td>${['critical', 'high', 'moderate', 'low'].map((s) => `<td class="n">${p.contagem[s] || 0}</td>`).join('')}<td class="n">${p.contagem.total || 0}</td></tr>`
      : `<tr><td>${esc(p.projeto)}</td><td colspan="5" class="muted">não auditado</td></tr>`
  );
  const vulnList = d.audit.flatMap((p) => p.vulnerabilidades.map((v) => ({ ...v, projeto: p.projeto })));
  const vulnRows = vulnList.map(
    (v) => `<tr><td>${pill(v.severidade === 'critical' || v.severidade === 'high' ? 'fail' : v.severidade === 'moderate' ? 'warn' : 'na', SEV_PT[v.severidade] || v.severidade)}</td><td>${esc(v.projeto)}</td><td><code>${esc(v.pacote)}</code>${v.direta ? ' <span class="muted small">(direta)</span>' : ''}</td><td>${v.url ? `<a href="${esc(v.url)}">${esc(v.titulo)}</a>` : esc(v.titulo)}</td><td>${esc(v.correcao)}</td></tr>`
  );
  const secretRows = (list, withCommit) =>
    list.map((s) => `<tr><td><code>${esc(s.regra)}</code></td><td>${esc(s.descricao)}</td><td>${loc(s.arquivo, s.linha)}</td>${withCommit ? `<td><code>${esc(short(s.commit))}</code> <span class="muted small">${esc(s.data?.slice(0, 10))}</span></td>` : ''}</tr>`);
  const sastRows = d.sast.achados.map(
    (a) => `<tr><td>${pill(a.severidade === 'ERROR' ? 'fail' : a.severidade === 'WARNING' ? 'warn' : 'na', SEMGREP_PT[a.severidade] || a.severidade)}</td><td>${loc(a.arquivo, a.linha)}</td><td>${esc(a.mensagem)}<div class="muted small"><code>${esc(a.regraCurta)}</code>${a.cwe.length ? ` · ${esc(a.cwe[0])}` : ''}${a.owasp.length ? ` · ${esc(a.owasp[0])}` : ''}</div></td></tr>`
  );
  const ctlRows = d.controles.map(
    (c) => `<tr><td>${pill(STATUS_CLS[c.status], STATUS_PT[c.status])}</td><td><b>${esc(c.titulo)}</b><div class="muted small">${esc(c.id)} · ${esc(c.area)} · ${esc(c.asvs)}</div></td><td>${esc(c.explicacao)}${c.status !== 'ok' && c.correcao ? `<div class="small" style="margin-top:6px"><b>O que fazer:</b> ${esc(c.correcao)}</div>` : ''}</td><td>${c.evidencias.map((e) => loc(e.file, e.line)).join('<br>') || '<span class="muted">—</span>'}</td></tr>`
  );

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório de segurança</title><style>${CSS}</style></head>
<body><main>
<header class="top"><div><h1>Relatório de segurança</h1><div class="muted">Fiscalize · dependências, segredos, código e controles do projeto</div></div>
<div class="muted small">Gerado em ${dateTime(d.generatedAt)}<br>${runMeta}</div></header>

<div class="banner ${banner[0]}"><span class="dot"></span><div><h2>${banner[1]}</h2><p>${banner[2]}</p></div></div>

<div class="grid" style="margin-top:16px">
${kpi('Bibliotecas vulneráveis', d.fontes.dependencias ? d.vuln.critical + d.vuln.high : '—', d.fontes.dependencias ? `${d.vuln.moderate} moderadas · ${d.vuln.low} baixas` : 'não executado', d.fontes.dependencias ? (d.vuln.critical + d.vuln.high ? 'fail' : 'ok') : 'na')}
${kpi('Segredos no código', d.fontes.segredos ? d.segredosAtual.achados.length : '—', d.fontes.historico ? `${d.segredosHistorico.achados.length} só no histórico` : 'histórico não verificado', d.fontes.segredos ? (d.segredosAtual.achados.length ? 'fail' : 'ok') : 'na')}
${kpi('Análise estática', d.fontes.sast ? d.sastCount.ERROR : '—', d.fontes.sast ? `${d.sastCount.WARNING} avisos · ${d.sastCount.INFO} informativos` : 'não executada', d.fontes.sast ? (d.sastCount.ERROR ? 'fail' : d.sastCount.WARNING ? 'warn' : 'ok') : 'na')}
${kpi('Controles do projeto', `${d.ctl.ok}/${d.controles.length}`, `${d.ctl.aviso} avisos · ${d.ctl.falha} falhas`, d.ctl.falha ? 'fail' : d.ctl.aviso ? 'warn' : 'ok')}
</div>

<h2>O que precisa de atenção</h2>
${r.length ? `<ul class="risks">${r.map((x) => `<li class="card ${x.nivel === 'fail' ? 'fail' : ''}"><div class="risk-title">${esc(x.titulo)}</div><div>${esc(x.texto)}</div></li>`).join('')}</ul>` : '<p class="card">Nada a fazer nesta rodada.</p>'}

<h2>O que foi verificado</h2>
<div class="grid">
<div class="card"><b>Bibliotecas (npm audit)</b><div class="muted small">Compara as versões de todas as dependências de backend, app, agente de IA e testes com o banco de vulnerabilidades conhecidas do npm.</div></div>
<div class="card"><b>Segredos (gitleaks)</b><div class="muted small">Procura senhas, chaves de API e tokens escritos no código atual e em todos os commits. O valor encontrado nunca aparece neste relatório.</div></div>
<div class="card"><b>Código (Semgrep)</b><div class="muted small">Análise estática com regras da OWASP para JavaScript, TypeScript, React e JWT: injeção, criptografia fraca, configurações inseguras.</div></div>
<div class="card"><b>Controles do projeto</b><div class="muted small">Confere no código cada controle descrito em docs/seguranca-da-informacao (bcrypt, tokens, CORS, SecureStore…) e aponta o que ainda está só especificado.</div></div>
</div>

<h2>Controles de segurança do projeto</h2>
${table(['Situação', 'Controle', 'Em linguagem simples', 'Onde'], ctlRows)}

<h2>Bibliotecas com vulnerabilidades conhecidas</h2>
${d.fontes.dependencias ? table(['Projeto', { label: 'Críticas', cls: 'n' }, { label: 'Altas', cls: 'n' }, { label: 'Moderadas', cls: 'n' }, { label: 'Baixas', cls: 'n' }, { label: 'Total', cls: 'n' }], auditRows) : notRun}
${vulnRows.length ? `<details><summary>${plural(vulnRows.length, 'pacote afetado', 'pacotes afetados')}</summary>${table(['Gravidade', 'Projeto', 'Pacote', 'Aviso', 'Correção'], vulnRows)}</details>` : ''}

<h2>Segredos no código</h2>
${d.fontes.segredos ? (secretRows(d.segredosAtual.achados).length ? table(['Regra', 'Tipo', 'Onde'], secretRows(d.segredosAtual.achados)) : '<p class="card">Nenhum segredo encontrado na versão atual do código.</p>') : notRun}
${d.fontes.historico && d.segredosHistorico.achados.length ? `<details><summary>${plural(d.segredosHistorico.achados.length, 'achado', 'achados')} só no histórico do Git</summary>${table(['Regra', 'Tipo', 'Onde', 'Commit'], secretRows(d.segredosHistorico.achados, true))}</details>` : ''}

<h2>Análise estática do código</h2>
${d.fontes.sast ? (sastRows.length ? table(['Gravidade', 'Onde', 'O que foi encontrado'], sastRows) : '<p class="card">Nenhum padrão inseguro encontrado.</p>') : notRun}

<h2>Como ler este relatório</h2>
<div class="card small">
<p><b>Gravidade das bibliotecas:</b> crítica e alta podem ser exploradas com facilidade e devem ser corrigidas logo; moderada e baixa exigem condições específicas.</p>
<p><b>ASVS</b> é o padrão de verificação de segurança de aplicações da OWASP; <b>MASVS</b>, o equivalente para apps mobile. <b>CWE</b> é o catálogo de tipos de falha (ex.: CWE-89, injeção de SQL).</p>
<p><b>Falso positivo:</b> nem todo achado é um problema real. Ao confirmar que não é, registre a exceção (<code>.gitleaks.toml</code>, comentário <code>nosemgrep</code>) com o motivo, para que o próximo relatório não repita o alerta.</p>
</div>

<footer>Fiscalize · relatório gerado automaticamente pelo workflow <b>Segurança</b>.
Ferramentas: ${Object.entries(d.ferramentas).map(([k, v]) => `${esc(k)}${v ? ` ${esc(v)}` : ''}`).join(' · ')}.
Dados completos em <code>seguranca.xml</code> e <code>seguranca-junit.xml</code>. Controles descritos em <code>docs/seguranca-da-informacao/README.md</code>.</footer>
</main></body></html>`;
}

// ---------- XML ----------

function xml(d) {
  const root = el(
    'relatorioSeguranca',
    { projeto: 'Fiscalize', geradoEm: d.generatedAt, commit: d.run?.sha, branch: d.run?.branch, execucao: d.run?.url, situacao: d.situacao },
    [
      el('resumo', {}, [
        el('dependencias', { executado: d.fontes.dependencias, criticas: d.vuln.critical, altas: d.vuln.high, moderadas: d.vuln.moderate, baixas: d.vuln.low }),
        el('segredos', { executado: d.fontes.segredos, codigoAtual: d.segredosAtual.achados.length, somenteHistorico: d.segredosHistorico.achados.length }),
        el('analiseEstatica', { executado: d.fontes.sast, erros: d.sastCount.ERROR, avisos: d.sastCount.WARNING, informativos: d.sastCount.INFO }),
        el('controles', { total: d.controles.length, ok: d.ctl.ok, avisos: d.ctl.aviso, falhas: d.ctl.falha }),
      ]),
      el('ferramentas', {}, Object.entries(d.ferramentas).map(([nome, versao]) => el('ferramenta', { nome, versao }))),
      el('pontosDeAtencao', {}, risks(d).map((x) => el('ponto', { nivel: x.nivel === 'fail' ? 'grave' : 'atencao', titulo: x.titulo }, x.texto))),
      el('controles', {}, d.controles.map((c) =>
        el('controle', { id: c.id, area: c.area, status: c.status, referencia: c.asvs, documento: c.referencia }, [
          el('titulo', {}, c.titulo),
          el('explicacao', {}, c.explicacao),
          el('evidencias', {}, c.evidencias.map((e) => el('evidencia', { arquivo: e.file, linha: e.line }))),
        ])
      )),
      el('dependencias', {}, d.audit.map((p) =>
        el('projeto', { nome: p.projeto, executado: p.disponivel, total: p.contagem.total ?? null }, p.vulnerabilidades.map((v) =>
          el('vulnerabilidade', { pacote: v.pacote, severidade: v.severidade, faixa: v.faixa, direta: v.direta, url: v.url, correcao: v.correcao }, v.titulo)
        ))
      )),
      el('segredos', { valoresOcultos: true }, [
        ...d.segredosAtual.achados.map((s) => el('achado', { escopo: 'codigo-atual', regra: s.regra, arquivo: s.arquivo, linha: s.linha, impressao: s.impressao }, s.descricao)),
        ...d.segredosHistorico.achados.map((s) => el('achado', { escopo: 'historico', regra: s.regra, arquivo: s.arquivo, linha: s.linha, commit: s.commit, data: s.data, impressao: s.impressao }, s.descricao)),
      ]),
      el('analiseEstatica', { ferramenta: 'semgrep', errosDeExecucao: d.sast.erros }, d.sast.achados.map((a) =>
        el('achado', { regra: a.regra, severidade: a.severidade, arquivo: a.arquivo, linha: a.linha, cwe: a.cwe.join('; '), owasp: a.owasp.join('; ') }, a.mensagem)
      )),
    ]
  );
  return xmlDocument(root, 'Relatório de segurança do Fiscalize: workflow Segurança (.github/workflows/seguranca.yml)');
}

function junitXml(d) {
  const notRunCase = (what) => ({ name: `${what} não executado`, status: 'skipped', message: 'ferramenta indisponível nesta rodada' });
  return junit(
    [
      {
        name: 'Controles do projeto',
        cases: d.controles.map((c) => ({
          name: `${c.id} ${c.titulo}`,
          classname: `controles.${c.area}`,
          status: c.status === 'falha' ? 'failed' : c.status === 'aviso' ? 'skipped' : 'passed',
          message: c.explicacao,
          details: `${c.explicacao}\n${c.evidencias.map((e) => `${e.file}:${e.line}`).join('\n')}`,
        })),
      },
      {
        name: 'Dependências (npm audit)',
        cases: d.audit.flatMap((p) =>
          !p.disponivel
            ? [notRunCase(`npm audit de ${p.projeto}`)]
            : [
                { name: `${p.projeto}: sem vulnerabilidade crítica ou alta`, classname: `dependencias.${p.projeto}`, status: p.vulnerabilidades.some((v) => ['critical', 'high'].includes(v.severidade)) ? 'failed' : 'passed', message: `${(p.contagem.critical || 0) + (p.contagem.high || 0)} críticas/altas` },
                ...p.vulnerabilidades
                  .filter((v) => ['critical', 'high'].includes(v.severidade))
                  .map((v) => ({ name: `${p.projeto}: ${v.pacote} (${SEV_PT[v.severidade]})`, classname: `dependencias.${p.projeto}`, status: 'failed', message: v.titulo, details: `${v.titulo}\n${v.url}\nCorreção: ${v.correcao}` })),
              ]
        ),
      },
      {
        name: 'Segredos (gitleaks)',
        cases: !d.fontes.segredos
          ? [notRunCase('gitleaks')]
          : d.segredosAtual.achados.length
            ? d.segredosAtual.achados.map((s) => ({ name: `${s.regra} em ${s.arquivo}:${s.linha}`, status: 'failed', message: s.descricao }))
            : [{ name: 'nenhum segredo no código atual', status: 'passed' }],
      },
      {
        name: 'Análise estática (Semgrep)',
        cases: !d.fontes.sast
          ? [notRunCase('semgrep')]
          : d.sast.achados.length
            ? d.sast.achados.map((a) => ({ name: `${a.regraCurta} em ${a.arquivo}:${a.linha}`, classname: `sast.${a.severidade}`, status: a.severidade === 'ERROR' ? 'failed' : 'skipped', message: a.mensagem }))
            : [{ name: 'nenhum padrão inseguro', status: 'passed' }],
      },
    ],
    'Segurança · Fiscalize'
  );
}

// ---------- Sumário do job ----------

function summary(d) {
  const icon = { verde: '🟢', amarelo: '🟡', vermelho: '🔴' }[d.situacao];
  const ctlIcon = { ok: '✅', aviso: '🟡', falha: '❌' };
  return [
    `## ${icon} Segurança`,
    '',
    '| Verificação | Resultado |',
    '|---|---|',
    `| Bibliotecas (npm audit) | ${d.fontes.dependencias ? `${d.vuln.critical} críticas · ${d.vuln.high} altas · ${d.vuln.moderate} moderadas · ${d.vuln.low} baixas` : 'não executado'} |`,
    `| Segredos (gitleaks) | ${d.fontes.segredos ? `${d.segredosAtual.achados.length} no código atual` : 'não executado'}${d.fontes.historico ? ` · ${d.segredosHistorico.achados.length} só no histórico` : ''} |`,
    `| Análise estática (Semgrep) | ${d.fontes.sast ? `${d.sastCount.ERROR} erros · ${d.sastCount.WARNING} avisos · ${d.sastCount.INFO} informativos` : 'não executada'} |`,
    `| Controles do projeto | ${d.ctl.ok} ok · ${d.ctl.aviso} avisos · ${d.ctl.falha} falhas |`,
    '',
    '<details><summary>Controles</summary>',
    '',
    ...d.controles.map((c) => `- ${ctlIcon[c.status]} **${c.id}** ${c.titulo}`),
    '',
    '</details>',
    '',
    'Relatório em linguagem simples (`relatorio-seguranca.html`) e dados em XML (`seguranca.xml`, `seguranca-junit.xml`) no artefato `relatorio-seguranca` desta execução.',
    '',
  ].join('\n');
}

// ---------- Issue da Segurança diária ----------
// Um checklist em Markdown com o que fazer em cada item. A lista de chaves (sem valores de segredo) vira uma
// impressão digital: sync-issue.mjs só comenta na issue quando ela muda, para não notificar todo dia o mesmo.

const SEV_ORDER = { critical: 0, high: 1, moderate: 2, low: 3, info: 4 };

function issueReport(d) {
  const itens = [];
  const lines = [];
  const icon = { verde: '🟢', amarelo: '🟡', vermelho: '🔴' }[d.situacao];
  const situacaoTexto = { verde: 'nenhum problema', amarelo: 'pontos de atenção, sem nada grave', vermelho: 'há itens graves que precisam de ação' }[d.situacao];
  const runLink = d.run ? `[execução #${d.run.id}](${d.run.url})` : 'execução local';

  lines.push(
    `${icon} **Situação em ${dateTime(d.generatedAt)}: ${situacaoTexto}.**`,
    '',
    'Esta issue é mantida pelo workflow **Segurança diária**: o corpo é atualizado a cada execução, um comentário avisa quando aparece ou some algum item, e ela é fechada sozinha quando não sobrar nada. Marque os itens à medida que corrigir; a próxima execução confere de novo.',
    '',
    '| Verificação | Resultado |',
    '|---|---|',
    `| Bibliotecas (npm audit) | ${d.fontes.dependencias ? `${d.vuln.critical} críticas · ${d.vuln.high} altas · ${d.vuln.moderate} moderadas · ${d.vuln.low} baixas` : '⚠️ não executado'} |`,
    `| Segredos (gitleaks) | ${d.fontes.segredos ? `${d.segredosAtual.achados.length} no código atual` : '⚠️ não executado'}${d.fontes.historico ? ` · ${d.segredosHistorico.achados.length} só no histórico` : ''} |`,
    `| Análise estática (Semgrep) | ${d.fontes.sast ? `${d.sastCount.ERROR} erros · ${d.sastCount.WARNING} avisos` : '⚠️ não executada'} |`,
    `| Controles do projeto | ${d.ctl.ok} ok · ${d.ctl.aviso} avisos · ${d.ctl.falha} falhas |`,
    ''
  );

  let n = 0;
  const section = (title) => lines.push(`### ${++n}. ${title}`, '');

  // Segredos no código atual: mais urgente, o repositório é público
  if (d.segredosAtual.achados.length) {
    section('🔴 Segredos no código (repositório público)');
    lines.push('Considere cada valor como vazado. Para cada item: **troque a chave no serviço de origem**, mova o valor para variável de ambiente (`.env` local, secret do GitHub Actions ou do EAS) e apague-o do código. Se for um valor de teste, acrescente `gitleaks:allow` na linha, com o motivo no PR.', '');
    for (const s of d.segredosAtual.achados) {
      lines.push(`- [ ] \`${s.arquivo}:${s.linha}\` — ${s.descricao} (\`${s.regra}\`)`);
      itens.push(`segredo:${s.regra}:${s.arquivo}:${s.linha}`);
    }
    lines.push('');
  }

  // Bibliotecas: um bloco por projeto, com o comando que corrige
  const vulnProjects = d.audit.filter((p) => p.vulnerabilidades.some((v) => v.severidade !== 'low' && v.severidade !== 'info'));
  if (vulnProjects.length) {
    section(`${d.vuln.critical + d.vuln.high ? '🔴' : '🟡'} Bibliotecas com vulnerabilidade conhecida`);
    lines.push('Confira antes se já existe um PR do Dependabot com a atualização: ele roda todo dia e pode ter resolvido parte da lista.', '');
    for (const p of vulnProjects) {
      const dir = PROJECT_DIR[p.projeto];
      const relevant = p.vulnerabilidades.filter((v) => SEV_ORDER[v.severidade] <= SEV_ORDER.moderate);
      relevant.forEach((v) => itens.push(`vuln:${p.projeto}:${v.pacote}:${v.severidade}`));
      // Mostra os pacotes com o aviso em si e as dependências diretas; os demais só herdam o problema deles
      const shown = relevant.filter((v) => v.origem || v.direta).sort((a, b) => SEV_ORDER[a.severidade] - SEV_ORDER[b.severidade]);
      const inherited = relevant.length - shown.length;
      lines.push(`- [ ] **${p.projeto}** (\`${dir}\`): ${['critical', 'high', 'moderate'].filter((s) => p.contagem[s]).map((s) => `${p.contagem[s]} ${SEV_PT[s]}${p.contagem[s] > 1 ? 's' : ''}`).join(', ')}`);
      if (relevant.some((v) => v.tipo === 'automatica')) {
        lines.push(`  - Rode \`npm audit fix --prefix ${dir}\` (**sem** \`--force\`), confira o diff do \`package-lock.json\` e rode os testes.`);
      }
      for (const v of shown) {
        const fix = {
          automatica: 'resolvido pelo `npm audit fix` acima',
          nenhuma: 'sem correção publicada: acompanhe o aviso e avalie se o trecho vulnerável é usado pelo projeto',
          rebaixamento: v.origem
            ? `**não aplique a sugestão do npm** (${v.correcao.replace(/^não aplicar: /, '')}). Force a versão corrigida de \`${v.pacote}\` com \`overrides\` no \`package.json\` de \`${dir}\` e rode os testes, ou aguarde a dependência que o puxa publicar a correção`
            : `**não aplique a sugestão do npm** (${v.correcao.replace(/^não aplicar: /, '')}); o aviso está nos pacotes de que ele depende, listados neste bloco, e some quando eles forem corrigidos`,
          major: `atualize para \`${v.correcao.replace(' (versão major)', '')}\` (versão major: revise o que mudou e rode os testes)`,
          versao: `atualize para \`${v.correcao}\``,
        }[v.tipo];
        lines.push(`  - \`${v.pacote}\` (${SEV_PT[v.severidade]}${v.direta ? ', dependência direta' : ''}): ${v.url ? `[${v.titulo}](${v.url})` : v.titulo} — ${fix}`);
      }
      if (inherited) lines.push(`  - Outros ${inherited} pacotes aparecem no relatório só porque dependem dos acima; somem quando estes forem corrigidos.`);
    }
    lines.push('');
  }

  if (d.sast.achados.some((a) => a.severidade !== 'INFO')) {
    section(`${d.sastCount.ERROR ? '🔴' : '🟡'} Padrões inseguros no código (Semgrep)`);
    lines.push('Corrija o trecho ou, se for falso positivo, acrescente o comentário `// nosemgrep: <regra>` na linha, com o motivo no PR.', '');
    for (const a of d.sast.achados.filter((x) => x.severidade !== 'INFO')) {
      lines.push(`- [ ] \`${a.arquivo}:${a.linha}\` (${SEMGREP_PT[a.severidade]}) — ${a.mensagem}${a.cwe.length ? ` _${a.cwe[0]}_` : ''} · regra \`${a.regraCurta}\``);
      itens.push(`sast:${a.regra}:${a.arquivo}:${a.linha}`);
    }
    lines.push('');
  }

  const pendentes = d.controles.filter((c) => c.status !== 'ok');
  if (pendentes.length) {
    section(`${pendentes.some((c) => c.status === 'falha') ? '🔴' : '🟡'} Controles de segurança do projeto`);
    lines.push('Controles descritos em `docs/seguranca-da-informacao/README.md` (seção 4) que estão ausentes ou enfraquecidos no código.', '');
    for (const c of pendentes) {
      const onde = c.evidencias.map((e) => `\`${e.file}:${e.line}\``).join(', ');
      lines.push(`- [ ] **${c.id} ${c.titulo}** (${c.status === 'falha' ? 'falha' : 'aviso'}, ${c.asvs})`, `  - Situação: ${c.explicacao}`, `  - O que fazer: ${c.correcao}`);
      if (onde) lines.push(`  - Onde: ${onde}`);
      itens.push(`controle:${c.id}:${c.status}`);
    }
    lines.push('');
  }

  if (d.segredosHistorico.achados.length) {
    section('🟡 Segredos só no histórico do Git');
    lines.push('Já saíram do código, mas continuam legíveis nos commits antigos de um repositório público. Se algum era uma chave real, **troque-a no serviço de origem**; apagar o arquivo não basta. Reescrever o histórico só é necessário se a chave não puder ser trocada.', '');
    for (const s of d.segredosHistorico.achados) {
      lines.push(`- [ ] \`${s.arquivo}:${s.linha}\` no commit \`${short(s.commit)}\` — ${s.descricao} (\`${s.regra}\`)`);
      itens.push(`historico:${s.regra}:${s.arquivo}:${s.linha}:${short(s.commit)}`);
    }
    lines.push('');
  }

  const faltou = Object.entries({ 'auditoria de dependências': d.fontes.dependencias, 'busca de segredos': d.fontes.segredos, 'análise estática': d.fontes.sast }).filter(([, ok]) => !ok).map(([k]) => k);
  if (faltou.length) {
    section('⚠️ Verificações que não rodaram');
    lines.push(`- [ ] ${faltou.join(', ')}: veja o log da ${runLink} e rode o workflow de novo (Actions → Segurança diária → Run workflow).`, '');
    itens.push(...faltou.map((f) => `nao-executado:${f}`));
  }

  if (!n) lines.push('Nada a fazer: dependências, segredos, código e controles estão em ordem.', '');
  lines.push('---', '', `Relatório completo (HTML em linguagem simples e XML) no artefato \`relatorio-seguranca\` da ${runLink}.`);

  const hash = createHash('sha256').update(itens.sort().join('\n')).digest('hex').slice(0, 16);
  return {
    json: { situacao: d.situacao, total: itens.length, hash, itens, geradoEm: d.generatedAt, execucao: d.run?.url ?? null },
    markdown: `${lines.join('\n')}\n\n<!-- seguranca-diaria hash:${hash} -->\n`,
  };
}

const data = analyze();
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'relatorio-seguranca.html'), html(data));
writeFileSync(join(OUT, 'seguranca.xml'), xml(data));
writeFileSync(join(OUT, 'seguranca-junit.xml'), junitXml(data));
const issue = issueReport(data);
writeFileSync(join(OUT, 'issue.md'), issue.markdown);
writeFileSync(join(OUT, 'issue.json'), `${JSON.stringify(issue.json, null, 2)}\n`);

const markdown = summary(data);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
else process.stdout.write(markdown);
if (data.situacao === 'vermelho') console.log('::warning::O relatório de segurança encontrou itens graves; veja o artefato relatorio-seguranca.');
