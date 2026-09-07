#!/usr/bin/env python3
"""Resumable, read-only retrieval of catalog source material. No catalog edits.

Validated with Python 3.12.14 and pypdf 6.10.0. Use Python 3.12+ and install
pypdf==6.10.0, or run with the bundled workspace Python runtime. Tests:
  python3 -m unittest discover -s tests -p prepare_sources_test.py

Source material and
manifests live outside the repository, under reading_work/sources by default.
Material availability never means that an LLM has actually read the document.
"""
import argparse
import concurrent.futures
import difflib
import fcntl
import hashlib
import json
import os
import re
import threading
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

from pypdf import PdfReader

REPO = Path(__file__).resolve().parents[2]
DEFAULT_WORK = REPO.parent / 'reading_work'
NETWORK_LOCK = threading.Lock()
EVENT_LOCK = threading.Lock()
NEXT_REQUEST = {}
USER_AGENT = 'Awesome-World-Action-Model-SourceReader/1.0 (research source retrieval)'
MAX_BYTES = 80 * 1024 * 1024
# These catalog entries are official documentation, not conventional papers.
RESOURCE_URLS = {
    'https://www.dyna.co/dyna-2',
    'https://www.figure.ai/news/helix',
    'https://openai.com/index/video-generation-models-as-world-simulators',
    'https://www.microsoft.com/en-us/research/story/advancing-ai-for-the-physical-world',
    'https://github.com/OpenDriveLab/OpenScene',
}


def now():
    return datetime.now(timezone.utc).isoformat()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + f'.{threading.get_ident()}.tmp')
    data = json.dumps(value, ensure_ascii=False, indent=2) + '\n' if not isinstance(value, bytes) else value
    if isinstance(data, str):
        tmp.write_text(data, encoding='utf-8')
    else:
        tmp.write_bytes(data)
    os.replace(tmp, path)


def norm(text):
    return re.sub(r'[^a-z0-9]+', '', unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode().lower())


def identify(expected, first_page, metadata_title=''):
    """Match actual title candidates, not a title copied from catalog metadata."""
    lines = [re.sub(r'\s+', ' ', x).strip() for x in first_page.splitlines() if x.strip()][:35]
    candidates = [metadata_title] if metadata_title else []
    candidates += [' '.join(lines[i:i+n]) for i in range(min(22, len(lines))) for n in range(1, 6)]
    target = norm(expected)
    scored = [(difflib.SequenceMatcher(None, target, norm(c)).ratio(), c) for c in candidates if norm(c)]
    score, observed = max(scored, default=(0, ''), key=lambda item: item[0])
    return observed, score >= 0.88, round(score, 4)


def sections(text):
    """Conservative plain-PDF headings; never list equations or reference entries."""
    found, in_references = [], False
    named = r'(?:Abstract|References|Bibliography|Appendix|Conclusion(?:s)?|Acknowledg(?:e)?ments?)'
    for raw_line in text.splitlines():
        line = re.sub(r'\s+', ' ', raw_line).strip()
        if not 3 <= len(line) <= 100 or len(line.split()) > 14:
            continue
        if re.fullmatch(named, line, re.I):
            if line not in found: found.append(line)
            in_references = bool(re.fullmatch(r'References|Bibliography', line, re.I))
            continue
        if in_references:
            if not re.match(r'^(?:Appendix\b|[A-Z]\.?(?:\d+(?:\.\d+)*)?\s+[A-Z])', line):
                continue
            in_references = False
        match = re.match(r'^(?:\d+(?:\.\d+)*\.?|[A-Z](?:\.\d+)*\.?)\s+([A-Z][A-Za-z][A-Za-z0-9 \-:()/&]+)$', line)
        if match and not re.search(r'[=+{}\[\]<>;,]|\b(?:doi|arxiv|https?|et al)\b', line, re.I):
            if line not in found: found.append(line)
    return found[:150]


def wait_for_host(url, arxiv_delay):
    host = urllib.parse.urlparse(url).hostname or ''
    family = 'arxiv.org' if host in ('arxiv.org', 'export.arxiv.org', 'www.arxiv.org') else host
    gap = arxiv_delay if family == 'arxiv.org' else 0.75
    with NETWORK_LOCK:
        start = max(time.monotonic(), NEXT_REQUEST.get(family, 0))
        NEXT_REQUEST[family] = start + gap
    delay = start - time.monotonic()
    if delay > 0:
        time.sleep(delay)


def fetch(url, args):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ('https', 'http') or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Not a credential-free HTTP(S) source URL')
    if parsed.hostname in ('localhost', '127.0.0.1', '::1'):
        raise ValueError('Local network sources are not permitted')
    for attempt in range(2):
        wait_for_host(url, args.arxiv_delay)
        try:
            request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/pdf,text/html,*/*;q=0.5'})
            with urllib.request.urlopen(request, timeout=args.timeout) as response:
                data = response.read(MAX_BYTES + 1)
                if len(data) > MAX_BYTES:
                    raise ValueError('Source exceeds 80 MB safety limit')
                return data, response.geturl(), response.headers.get('Content-Type', ''), now()
        except urllib.error.HTTPError as error:
            if attempt == 0 and error.code in (429, 500, 502, 503, 504):
                retry = error.headers.get('Retry-After', '8')
                time.sleep(min(45, max(3, float(retry) if retry.isdigit() else 8)))
                continue
            raise


class SourceHTML(HTMLParser):
    def __init__(self, url):
        super().__init__(convert_charrefs=True)
        self.url, self.parts, self.links, self.pdf_links, self.supplements = url, [], [], [], []
        self.title, self.citation_title, self.document_title = '', '', ''
        self.skip, self.in_title = 0, False
        self.current_link = None
        self.article = False
        self.sections = []
        self.heading = None
        self.omitted_images = 0

    def handle_starttag(self, tag, attrs):
        attr = dict(attrs)
        if tag in ('script', 'style', 'nav', 'footer'):
            self.skip += 1
        if tag == 'title':
            self.in_title = True
        if tag == 'meta':
            name = (attr.get('name') or attr.get('property') or '').lower()
            if name == 'citation_title': self.citation_title = attr.get('content', '')
            if name == 'citation_pdf_url': self.pdf_links.append(urllib.parse.urljoin(self.url, attr.get('content', '')))
        if tag == 'article' or 'ltx_document' in attr.get('class', ''):
            self.article = True
        if tag in ('h1', 'h2', 'h3', 'h4'):
            self.heading = []
            self.parts.append('\n[SECTION] ')
        if tag in ('p', 'div', 'tr', 'li', 'section', 'figure', 'br'):
            self.parts.append('\n')
        if tag == 'img':
            alt = attr.get('alt', '').strip()
            if alt: self.parts.append('[IMAGE ALT: ' + alt + ']')
            self.omitted_images += 1
        if tag == 'a' and attr.get('href'):
            self.current_link = [urllib.parse.urljoin(self.url, attr['href']), []]

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'nav', 'footer'):
            self.skip = max(0, self.skip - 1)
        if tag == 'title': self.in_title = False
        if tag in ('h1', 'h2', 'h3', 'h4') and self.heading is not None:
            heading_text = ''.join(self.heading).strip()
            self.sections.append(heading_text)
            if tag == 'h1' and not self.document_title: self.document_title = heading_text
            self.heading = None
            self.parts.append('\n')
        if tag == 'a' and self.current_link:
            url, labels = self.current_link
            label = ''.join(labels).strip()
            self.links.append((url, label))
            if 'supp' in (url + ' ' + label).lower() and ('.pdf' in url.lower()):
                self.supplements.append({'url': url, 'label': label or 'Supplemental material', 'downloaded': False})
            elif '.pdf' in urllib.parse.urlparse(url).path.lower() or re.fullmatch(r'\[?pdf\]?', label, re.I):
                self.pdf_links.append(url)
            self.current_link = None

    def handle_data(self, data):
        if self.in_title: self.title += data
        if self.current_link: self.current_link[1].append(data)
        if self.heading is not None: self.heading.append(data)
        if not self.skip: self.parts.append(data)

    def text(self):
        return '\n'.join(re.sub(r'[ \t]+', ' ', x).strip() for x in ''.join(self.parts).splitlines() if x.strip())


def blank_manifest(paper):
    return {'paperId': paper['id'], 'accessStatus': 'pending', 'canonicalUrl': paper['paperUrl'],
            'observedTitle': None, 'titleMatch': False, 'kind': 'text', 'sha256': None,
            'textSha256': None, 'scope': None, 'wordCount': 0, 'accessedAt': None, 'textPath': None,
            'sectionsAvailable': [], 'omissions': [], 'reason': 'Source retrieval queued; no reading claimed.'}


def save_pdf(paper, folder, raw, url, accessed_at, supplements=None):
    stem = 'source-' + sha(url.encode('utf-8') + raw)[:16]
    source_path = folder / (stem + '.pdf')
    atomic(source_path, raw)
    reader = PdfReader(source_path)
    texts = [page.extract_text() or '' for page in reader.pages]
    observed, matched, score = identify(paper['title'], texts[0] if texts else '', str((reader.metadata or {}).get('/Title', '')))
    text = '\n\n'.join(f'[SOURCE: {url}] [PDF PAGE {i+1} OF {len(texts)}]\n{body}' for i, body in enumerate(texts))
    text_path = folder / (stem + '.txt')
    atomic(text_path, text.encode('utf-8'))
    atomic(folder / (stem + '.pages.json'), [{'page': i+1, 'text': body} for i, body in enumerate(texts)])
    weak = [i+1 for i, body in enumerate(texts) if len(body.strip()) < 80]
    manifest = blank_manifest(paper)
    manifest.update({'accessStatus': 'full-text' if matched and len(text.split()) > 350 and not weak else ('identity-mismatch' if not matched else 'partial-text'),
                     'canonicalUrl': url, 'observedTitle': observed, 'titleMatch': matched,
                     'titleSimilarity': score, 'kind': 'pdf', 'sha256': sha(raw), 'textSha256': sha(text.encode('utf-8')),
                     'wordCount': len(text.split()), 'accessedAt': accessed_at, 'textPath': str(text_path),
                     'sourcePath': str(source_path), 'pageCount': len(texts), 'sectionsAvailable': sections('\n'.join(texts)),
                     'omissions': ['Text extraction does not reconstruct figure images; inspect the retained PDF for figures and equation/table layout.'],
                     'reason': 'Complete retrieved PDF retained and every page extracted; source title checked against catalog. This is material availability, not a completed reading.'})
    if weak:
        manifest['omissions'].append('Pages with little extracted text require visual inspection: ' + ', '.join(map(str, weak)))
        manifest['reason'] = 'Complete PDF retained, but text extraction may omit content from low-text pages; only partial text readiness is established.'
    manifest['scope'] = 'full-paper' if manifest['accessStatus'] == 'full-text' else 'selected-sections'
    manifest['supplements'] = supplements or []
    if manifest['supplements']: manifest['omissions'].append('Separate supplemental materials were discovered but are not part of the primary text; inspect supplements individually.')
    else: manifest['omissions'].append('Separate supplemental material availability has not been fully verified.')
    if not matched: manifest['reason'] = 'Extracted title does not reliably match catalog; do not route to reading until identity is reviewed.'
    return manifest


def save_html(paper, folder, raw, url, accessed_at, parsed):
    text = '[SOURCE: ' + url + ']\n' + parsed.text()
    stem = 'source-' + sha(url.encode('utf-8') + raw)[:16]
    source_path, text_path = folder / (stem + '.html'), folder / (stem + '.txt')
    atomic(source_path, raw); atomic(text_path, text.encode('utf-8'))
    observed, matched, score = identify(paper['title'], parsed.text()[:10000], parsed.citation_title or parsed.document_title or parsed.title)
    resource = paper['paperUrl'].rstrip('/') in RESOURCE_URLS
    complete_resource = resource and len(text.split()) >= 350 and (parsed.article or len(parsed.sections) >= 2)
    source_url = urllib.parse.urlparse(url)
    known_full_html = source_url.hostname in ('arxiv.org', 'ar5iv.org', 'ar5iv.labs.arxiv.org') and '/html/' in source_url.path
    # Publisher landing pages may expose long bibliographies despite withholding the body.
    # Only a recognized full-paper renderer can pass the automatic HTML full-text gate.
    complete = (known_full_html and parsed.article and len(text.split()) >= 2000 and bool(re.search(r'\b(?:references|bibliography)\b', text, re.I))) or complete_resource
    body_heading = any(re.match(r'^(?:[0-9A-Z]+(?:\.[0-9]+)*[. ]*)?(?:Introduction|Methods?|Experiments?|Results?|Approach|Model|Formulation|Discussion|Conclusions?|Appendix)\b', heading, re.I) for heading in parsed.sections)
    body_available = parsed.article and len(text.split()) >= 700 and body_heading
    manifest = blank_manifest(paper)
    manifest.update({'scope': ('resource-overview' if resource else 'full-paper') if complete else ('selected-sections' if body_available else 'abstract-only'),
                     'accessStatus': ('full-text' if complete else 'partial-text') if matched else 'identity-mismatch',
                     'canonicalUrl': url, 'observedTitle': observed, 'titleMatch': matched, 'titleSimilarity': score,
                     'kind': 'html', 'sha256': sha(raw), 'textSha256': sha(text.encode('utf-8')), 'wordCount': len(text.split()),
                     'accessedAt': accessed_at, 'textPath': str(text_path), 'sourcePath': str(source_path),
                     'sectionsAvailable': parsed.sections or sections(text), 'supplements': parsed.supplements,
                     'omissions': ['External figure assets are not downloaded; HTML alt text and mathematical text are retained where available.'],
                     'reason': 'Article body and references detected in complete downloaded HTML; availability is not a completed reading.' if complete else 'Only a landing page, abstract, or incomplete HTML body is available; not sufficient for a full reading.'})
    if complete_resource:
        manifest['reason'] = 'Official resource documentation retrieved; this is a resource overview, not a conventional paper or a completed reading.'
        manifest['resourceTypeHint'] = 'technical-resource'
    if not complete: manifest['omissions'].append('Full article body or complete references were not established.')
    if not matched: manifest['reason'] = 'Source title is not reliably matched; identity review required.'
    gate_title = parsed.citation_title or parsed.document_title or parsed.title
    blocked = re.search(r'verifying your browser|verify you are human|just a moment|access denied|attention required|sign in|log in|page not found', gate_title, re.I)
    if not matched and blocked:
        manifest.update({'accessStatus': 'unavailable', 'scope': None,
                         'reason': 'The source website returned an access/verification or unavailable-page response; no paper text was retrieved. No access control was bypassed.'})
    return manifest


def citation_url(paper, requested_url, resolved_url):
    """Keep temporary publisher download credentials out of report citations."""
    def temporary(url):
        parsed = urllib.parse.urlparse(url)
        keys = [key.lower() for key, _ in urllib.parse.parse_qsl(parsed.query)]
        return bool(parsed.username or parsed.password or any(
            re.search(r'token|signature|credential|x-amz|x-goog|expires|policy|session|authorization|auth', key)
            or key in ('key', 'key-pair-id') for key in keys))
    if temporary(requested_url): return paper['paperUrl']
    gated_path = re.match(r'^/(?:challenge|login|signin|captcha)(?:/|$)', urllib.parse.urlparse(resolved_url).path)
    return requested_url if temporary(resolved_url) or gated_path else resolved_url


def candidates(paper):
    urls = []
    if paper.get('pdfUrl'): urls.append(paper['pdfUrl'])
    if paper.get('arxivUrl'): urls.append('https://arxiv.org/pdf/' + paper['id'])
    url = paper['paperUrl']
    if 'openaccess.thecvf.com/' in url and '/html/' in url and url.endswith('_paper.html'):
        urls.append(url.replace('/html/', '/papers/').replace('_paper.html', '_paper.pdf'))
    if 'openreview.net/forum?' in url: urls.append(url.replace('/forum?', '/pdf?'))
    urls.append(url)
    if paper.get('arxivUrl'): urls.append('https://arxiv.org/html/' + paper['id'])
    return list(dict.fromkeys(urls))


def good_existing(path):
    try:
        m = json.loads(path.read_text())
        if m.get('accessStatus') not in ('full-text', 'partial-text', 'unavailable', 'identity-mismatch'): return False
        if m.get('textPath') and m.get('textSha256'):
            if sha(Path(m['textPath']).read_bytes()) != m['textSha256']: return False
            if m.get('sourcePath') and m.get('sha256') and sha(Path(m['sourcePath']).read_bytes()) != m['sha256']: return False
            return True
        return m.get('accessStatus') in ('unavailable', 'identity-mismatch')
    except (OSError, ValueError): return False


def prepare(paper, args):
    folder = args.work_dir / 'sources' / paper['id']
    folder.mkdir(parents=True, exist_ok=True)
    manifest_path = folder / 'manifest.json'
    if good_existing(manifest_path):
        existing = json.loads(manifest_path.read_text())
        # A normal retry never overwrites an already verified full source or the calibration input.
        if not args.retry or existing['accessStatus'] == 'full-text' or paper['id'] == '2302.13971':
            return 'cached', existing['accessStatus']
    attempts, best = [], None
    queue, seen = candidates(paper), set()
    # Reuse only the already checked full NWM PDF; old plain-text caches lack raw-source provenance.
    nwm = args.work_dir / 'smoke_sources/navigation_world_models.pdf'
    if paper['id'] == 'ref-2624494a0f9cbb4a61d2' and nwm.exists():
        supplements = []
        prov = args.work_dir / 'pilot/nwm-supplemental.provenance.json'
        if prov.exists():
            item = json.loads(prov.read_text()); item.update({'sourcePath': str(args.work_dir / 'pilot/nwm-supplemental.pdf'), 'textPath': str(args.work_dir / 'pilot/nwm-supplemental.txt'), 'downloaded': True}); supplements.append(item)
        best = save_pdf(paper, folder, nwm.read_bytes(), 'https://openaccess.thecvf.com/content/CVPR2025/papers/Bar_Navigation_World_Models_CVPR_2025_paper.pdf', datetime.fromtimestamp(nwm.stat().st_mtime, timezone.utc).isoformat(), supplements)
        atomic(manifest_path, best); return 'prepared', best['accessStatus']
    while queue and len(seen) < 5:
        url = queue.pop(0)
        if url in seen: continue
        seen.add(url)
        try:
            raw, final_url, content_type, accessed_at = fetch(url, args)
            public_url = citation_url(paper, url, final_url)
            if raw.lstrip().startswith(b'%PDF-'):
                result = save_pdf(paper, folder, raw, public_url, accessed_at)
                if final_url != public_url: result['downloadUrl'] = final_url
                attempts.append({'url': url, 'status': 'downloaded', 'kind': 'pdf'})
                if result['accessStatus'] == 'full-text': best = result; break
                # Do not overwrite a better matched artifact while trying other candidates.
                if best is None or result['titleMatch']: best = result
                if result['accessStatus'] == 'identity-mismatch': break
            else:
                decoded = raw.decode('utf-8', errors='replace')
                parsed = SourceHTML(final_url); parsed.feed(decoded)
                attempts.append({'url': url, 'status': 'downloaded', 'kind': 'html'})
                discovered = [u for u in dict.fromkeys(parsed.pdf_links) if u not in seen and urllib.parse.urlparse(u).scheme in ('http', 'https')]
                queue = discovered[:2] + queue
                result = save_html(paper, folder, raw, public_url, accessed_at, parsed)
                if final_url != public_url: result['downloadUrl'] = final_url
                if result['accessStatus'] == 'full-text': best = result; break
                if best is None or (result['titleMatch'] and not best['titleMatch']): best = result
        except Exception as error:
            attempts.append({'url': url, 'status': 'failed', 'error': str(error)[:350]})
    if best is None:
        best = blank_manifest(paper)
        best.update({'accessStatus': 'unavailable', 'accessedAt': now(), 'reason': 'No usable source retrieved. See attempts; no metadata-derived reading generated.', 'omissions': ['Full source material not available.']})
    best['attempts'] = attempts
    atomic(manifest_path, best)
    return 'prepared', best['accessStatus']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog', type=Path, default=REPO / 'data/papers.json')
    parser.add_argument('--work-dir', type=Path, default=DEFAULT_WORK)
    parser.add_argument('--workers', type=int, default=2)
    parser.add_argument('--arxiv-delay', type=float, default=3.1)
    parser.add_argument('--timeout', type=int, default=35)
    parser.add_argument('--retry', action='store_true', help='Retry incomplete terminal entries; verified full-text sources remain cached.')
    parser.add_argument('--limit', type=int)
    parser.add_argument('--only', action='append', default=[])
    args = parser.parse_args()
    if not 1 <= args.workers <= 2: parser.error('--workers must be 1 or 2')
    if args.arxiv_delay < 3: parser.error('--arxiv-delay must be at least 3 seconds')
    args.work_dir = args.work_dir.resolve()
    if args.work_dir == REPO or REPO in args.work_dir.parents: parser.error('Source cache must stay outside the repository')
    args.work_dir.mkdir(parents=True, exist_ok=True)
    lock = open(args.work_dir / '.prepare-sources.lock', 'a+')
    try: fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError: parser.error('Another source preparation process is already running')
    papers = json.loads(args.catalog.read_text())
    if args.only: papers = [p for p in papers if p['id'] in args.only]
    if args.limit: papers = papers[:args.limit]
    # Seed every pending status before network work so downstream watchers can operate immediately.
    for p in papers:
        path = args.work_dir / 'sources' / p['id'] / 'manifest.json'
        if not path.exists(): atomic(path, blank_manifest(p))
    priority = {'2302.13971': -2, 'ref-2624494a0f9cbb4a61d2': -1}
    papers.sort(key=lambda p: priority.get(p['id'], 0))
    print(json.dumps({'event': 'started', 'at': now(), 'papers': len(papers), 'workers': args.workers, 'arxivDelay': args.arxiv_delay}), flush=True)
    counts = Counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(prepare, p, args): p for p in papers}
        for future in concurrent.futures.as_completed(futures):
            paper = futures[future]
            try: outcome, status = future.result()
            except Exception as error:
                outcome, status = 'failed', 'unavailable'
                m = blank_manifest(paper); m.update({'accessStatus': status, 'accessedAt': now(), 'reason': str(error)[:500]})
                atomic(args.work_dir / 'sources' / paper['id'] / 'manifest.json', m)
            counts[status] += 1
            event = {'event': outcome, 'at': now(), 'paperId': paper['id'], 'accessStatus': status, 'finished': sum(counts.values()), 'total': len(papers), 'counts': dict(counts)}
            with EVENT_LOCK:
                with open(args.work_dir / 'source-events.jsonl', 'a') as stream: stream.write(json.dumps(event) + '\n')
                atomic(args.work_dir / 'source-progress.json', event)
            print(json.dumps(event), flush=True)
    print(json.dumps({'event': 'finished', 'at': now(), 'counts': dict(counts)}), flush=True)


if __name__ == '__main__':
    main()
