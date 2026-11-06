// Peças comuns dos relatórios HTML da pipeline (relatório de qualidade e catálogo de testes): mesmo visual,
// claro e escuro, autocontido (abre direto do artefato, sem internet).

export const TREND_POINTS = 30;

export const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');


export const dateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '—';

export const CSS = `
:root{--bg:#f6f7f9;--card:#fff;--text:#1b1f24;--muted:#5b6470;--line:#e3e6ea;--accent:#2f5bea;
--ok:#1a7f4b;--ok-bg:#e3f4ea;--warn:#9a6200;--warn-bg:#fdf1d8;--fail:#b42318;--fail-bg:#fde4e1;--na:#5b6470;--na-bg:#eceef1;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#101318;--card:#181c22;--text:#e7eaee;--muted:#9aa3ad;--line:#2a3039;--accent:#7c9cff;
--ok:#5fd394;--ok-bg:#15301f;--warn:#f2c35b;--warn-bg:#33280f;--fail:#ff8a80;--fail-bg:#3a1714;--na:#9aa3ad;--na-bg:#232830;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 48px}
header.top{display:flex;flex-wrap:wrap;gap:8px 24px;align-items:flex-end;justify-content:space-between;margin-bottom:20px}
h1{font-size:24px;margin:0}h2{font-size:18px;margin:32px 0 12px}h3{font-size:15px;margin:20px 0 8px}
.muted{color:var(--muted)}.small{font-size:13px}a{color:var(--accent)}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.kpi .label{font-size:13px;color:var(--muted)}.kpi .value{font-size:28px;font-weight:700;margin:4px 0}
.kpi .foot{font-size:13px;color:var(--muted);display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.banner{border-radius:12px;padding:20px;border:1px solid var(--line);display:flex;gap:16px;align-items:center}
.banner .dot{width:44px;height:44px;border-radius:50%;flex:none}
.banner.ok{background:var(--ok-bg)}.banner.ok .dot{background:var(--ok)}
.banner.warn{background:var(--warn-bg)}.banner.warn .dot{background:var(--warn)}
.banner.fail{background:var(--fail-bg)}.banner.fail .dot{background:var(--fail)}
.banner h2{margin:0 0 4px;font-size:20px}.banner p{margin:0}
.pill{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap}
.pill.ok{background:var(--ok-bg);color:var(--ok)}.pill.warn{background:var(--warn-bg);color:var(--warn)}
.pill.fail{background:var(--fail-bg);color:var(--fail)}.pill.na{background:var(--na-bg);color:var(--na)}
.table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--card)}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:8px 12px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);background:var(--card)}
tr:last-child td{border-bottom:0}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
details{background:var(--card);border:1px solid var(--line);border-radius:10px;margin:8px 0;padding:8px 12px}
summary{cursor:pointer;font-weight:600}pre{white-space:pre-wrap;word-break:break-word;font-size:12px;background:var(--bg);padding:12px;border-radius:8px;overflow:auto;max-height:320px}
code{font-size:12px}.spark-line{fill:none;stroke:var(--accent);stroke-width:2}.spark-target{stroke:var(--muted);stroke-dasharray:3 3;stroke-width:1}
.spark-dot.ok{fill:var(--ok)}.spark-dot.warn{fill:var(--warn)}
.strip{display:flex;gap:3px;flex-wrap:wrap}.strip .cell{width:14px;height:22px;border-radius:3px}
.cell.ok{background:var(--ok)}.cell.warn{background:var(--warn)}.cell.fail{background:var(--fail)}.cell.na{background:var(--na-bg)}
.strip-legend{display:flex;justify-content:space-between;max-width:${TREND_POINTS * 17}px}
.trend{font-size:12px;font-weight:600}.trend.up{color:var(--ok)}.trend.down{color:var(--fail)}.trend.flat{color:var(--muted)}
ul.risks{list-style:none;padding:0;margin:0;display:grid;gap:10px}ul.risks li{border-left:4px solid var(--warn)}ul.risks li.fail{border-left-color:var(--fail)}
.risk-title{font-weight:600;margin-bottom:4px}.warnbox{border-left:4px solid var(--warn);padding:8px 12px;background:var(--warn-bg);border-radius:6px;margin:8px 0}
footer{margin-top:40px;font-size:13px;color:var(--muted)}
`;

export const table = (headers, rows) =>
  `<div class="table-wrap"><table><thead><tr>${headers
    .map((h) => (typeof h === 'string' ? `<th>${h}</th>` : `<th class="${h.cls}">${h.label}</th>`))
    .join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
