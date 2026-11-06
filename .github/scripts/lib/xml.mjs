// Geração de XML sem dependências, usada pelos relatórios de segurança e técnico.
//   el('tecnologia', { id: 'jest' }, [el('nome', {}, 'Jest')])  →  <tecnologia id="jest"><nome>Jest</nome></tecnologia>
// Atributos com valor null/undefined são omitidos; filhos podem ser texto, elementos ou listas.

const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

export const escXml = (value) =>
  String(value ?? '')
    .replace(INVALID_XML_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const attrs = (obj) =>
  Object.entries(obj || {})
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => ` ${k}="${escXml(v)}"`)
    .join('');

// Elemento com indentação: o texto fica na mesma linha; filhos, em linhas próprias
export function el(name, attributes = {}, children = []) {
  const list = (Array.isArray(children) ? children : [children]).flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false);
  if (!list.length) return { xml: `<${name}${attrs(attributes)}/>` };
  if (list.every((c) => typeof c !== 'object')) {
    return { xml: `<${name}${attrs(attributes)}>${escXml(list.join(''))}</${name}>` };
  }
  const inner = list.map((c) => (typeof c === 'object' ? c.xml : escXml(c))).join('\n').replace(/^/gm, '  ');
  return { xml: `<${name}${attrs(attributes)}>\n${inner}\n</${name}>` };
}

export const xmlDocument = (root, comment) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n${comment ? `<!-- ${String(comment).replace(/--/g, '—')} -->\n` : ''}${root.xml}\n`;

// JUnit XML: cada suíte é { name, cases: [{ name, classname, status: 'passed'|'failed'|'skipped', message, details }] }
export function junit(suites, name) {
  const count = (s, st) => s.cases.filter((c) => c.status === st).length;
  const all = suites.flatMap((s) => s.cases);
  const root = el(
    'testsuites',
    { name, tests: all.length, failures: all.filter((c) => c.status === 'failed').length, skipped: all.filter((c) => c.status === 'skipped').length },
    suites.map((s) =>
      el(
        'testsuite',
        { name: s.name, tests: s.cases.length, failures: count(s, 'failed'), skipped: count(s, 'skipped'), errors: 0 },
        s.cases.map((c) =>
          el('testcase', { name: c.name, classname: c.classname || s.name }, [
            c.status === 'failed' ? el('failure', { message: c.message }, c.details || c.message || '') : null,
            c.status === 'skipped' ? el('skipped', { message: c.message }) : null,
          ])
        )
      )
    )
  );
  return xmlDocument(root);
}
