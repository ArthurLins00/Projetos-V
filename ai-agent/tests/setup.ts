// Carregado antes das suítes (--import): os testes gravam o log de uso dos dados num arquivo
// temporário, para não sujar ai-agent/logs/uso-dados.jsonl.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.FISCALIZE_LOG_USO_DADOS ||= path.join(mkdtempSync(path.join(tmpdir(), 'fiscalize-log-')), 'uso-dados.jsonl');
