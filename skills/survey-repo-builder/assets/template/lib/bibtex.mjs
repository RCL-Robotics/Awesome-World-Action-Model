// Literal BibTeX records only. Reject unresolved macros and concatenation rather
// than generating metadata from partially interpreted references.
export function parseBibtex(input) {
  let i = 0;
  const records = [];
  const skip = () => { while (i < input.length) { if (/\s/.test(input[i])) i++; else if (input[i] === '%') { while (i < input.length && input[i] !== '\n') i++; } else break; } };
  const error = message => { throw new Error(`BibTeX at character ${i}: ${message}`); };
  function delimited(open, close) {
    if (input[i++] !== open) error(`Expected ${open}`);
    const start = i;
    let depth = 1;
    while (i < input.length) {
      if (input[i] === '\\') { i += 2; continue; }
      if (open === '{' && input[i] === open) depth++;
      if (input[i] === close && --depth === 0) return input.slice(start, i++);
      i++;
    }
    error(`Unclosed ${open}`);
  }
  while (i < input.length) {
    skip(); if (i === input.length) break;
    const start = i;
    if (input[i++] !== '@') error('Expected @entry.');
    const kind = input.slice(i).match(/^[a-z]+/i)?.[0];
    if (!kind) error('Missing entry type.');
    i += kind.length; skip();
    if (['string', 'preamble', 'comment'].includes(kind.toLowerCase())) error(`@${kind} is unsupported; provide expanded literal records.`);
    const open = input[i++], close = open === '{' ? '}' : ')';
    if (!['{', '('].includes(open)) error('Expected an entry body.');
    skip();
    const key = input.slice(i).match(/^[^,\s{}()]+/)?.[0];
    if (!key) error('Missing citation key.');
    i += key.length; skip();
    if (input[i++] !== ',') error('Expected comma after citation key.');
    const fields = {};
    while (true) {
      skip(); if (input[i] === close) { i++; break; }
      const name = input.slice(i).match(/^[a-z][a-z0-9_-]*/i)?.[0];
      if (!name) error('Expected field name.');
      i += name.length; skip(); if (input[i++] !== '=') error('Expected =.'); skip();
      let value;
      if (input[i] === '{') value = delimited('{', '}');
      else if (input[i] === '"') value = delimited('"', '"');
      else { const number = input.slice(i).match(/^\d+/)?.[0]; if (!number) error('Expand BibTeX macros into literal values first.'); value = number; i += number.length; }
      if (Object.hasOwn(fields, name.toLowerCase())) error(`Duplicate field ${name}.`);
      fields[name.toLowerCase()] = value;
      skip(); if (input[i] === '#') error('Expand concatenated BibTeX values first.');
      if (input[i] === ',') i++; else if (input[i] !== close) error('Expected comma or entry end.');
    }
    const literal = value => String(value || '').replace(/[{}]/g, '').trim();
    const url = fields.url ? literal(fields.url) : fields.doi ? `https://doi.org/${literal(fields.doi).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')}` : fields.eprint && /arxiv/i.test(fields.archiveprefix || fields.eprinttype || '') ? `https://arxiv.org/abs/${literal(fields.eprint)}` : null;
    if (!fields.title || !url) error(`Entry ${key} requires a title and URL, DOI, or arXiv eprint.`);
    let depth = 0, author = '', authors = [];
    const authorText = fields.author || '';
    for (let a = 0; a < authorText.length; a++) {
      const char = authorText[a];
      if (char === '{') depth++; if (char === '}') depth--;
      const separator = depth === 0 ? authorText.slice(a).match(/^\s+and\s+/i) : null;
      if (separator) { if (author.trim()) authors.push(literal(author)); author = ''; a += separator[0].length - 1; }
      else author += char;
    }
    if (author.trim()) authors.push(literal(author));
    records.push({ title: literal(fields.title), authors, url, ...(fields.year ? { year: Number(literal(fields.year)) } : {}), bibtex: input.slice(start, i) });
  }
  return records;
}
