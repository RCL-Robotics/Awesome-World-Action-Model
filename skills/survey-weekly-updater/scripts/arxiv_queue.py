#!/usr/bin/env python3
"""Incremental arXiv candidate queue; no catalog edits, reading or publication.

Python 3.10+ standard library. State and fetched metadata stay outside the repo.
Official protocol: https://info.arxiv.org/help/api/user-manual.html
"""
import argparse
from collections import Counter
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import hashlib
import http.client
import json
import os
from pathlib import Path
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

NS = {'a': 'http://www.w3.org/2005/Atom', 's': 'http://a9.com/-/spec/opensearch/1.1/', 'x': 'http://arxiv.org/schemas/atom'}
ID = re.compile(r'^(\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?/\d{7})(?:v([1-9]\d*))?$')
STATES = ('pending', 'possible-duplicate', 'selected', 'reading', 'retry', 'accepted', 'excluded', 'existing', 'published')


def utc(value=None):
    date = datetime.now(timezone.utc) if value is None else datetime.fromisoformat(value.replace('Z', '+00:00'))
    if date.tzinfo is None:
        raise ValueError('Timestamp must include a timezone')
    return date.astimezone(timezone.utc)


def stamp(date):
    return date.isoformat(timespec='seconds').replace('+00:00', 'Z')


def load(path, default=None):
    try:
        return json.loads(Path(path).read_text(encoding='utf-8'))
    except FileNotFoundError:
        if default is None:
            raise
        return default


def save(path, value):
    temporary = path.with_name(path.name + f'.{os.getpid()}.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)


def identity(value):
    value = str(value or '')
    if '://' in value:
        url = urllib.parse.urlparse(value)
        if url.hostname not in ('arxiv.org', 'www.arxiv.org', 'export.arxiv.org'):
            return None
        value = re.sub(r'^/(abs|pdf|html)/', '', url.path).removesuffix('.pdf').rstrip('/')
    match = ID.fullmatch(value)
    return (match[1], int(match[2] or 1)) if match else None


def doi(value):
    return re.sub(r'^(https?://(?:dx\.)?doi\.org/|doi:\s*)', '', str(value or '').strip(), flags=re.I).lower()


def title_key(value):
    return ''.join(c for c in unicodedata.normalize('NFKC', value).casefold() if c.isalnum())


def parse_feed(raw):
    if len(raw) > 12_000_000 or b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():
        raise ValueError('Unbounded or unsupported XML feed')
    root = ET.fromstring(raw)
    if root.tag != '{' + NS['a'] + '}feed':
        raise ValueError('Response is not an Atom feed')
    entries = []
    for entry in root.findall('a:entry', NS):
        text = lambda name: ' '.join((entry.findtext(name, '', NS)).split())
        found = identity(text('a:id'))
        if not found:
            raise ValueError('arXiv error or invalid entry: ' + text('a:title'))
        paper_id, version = found
        title = text('a:title')
        authors = [' '.join((a.findtext('a:name', '', NS)).split()) for a in entry.findall('a:author', NS)]
        published, updated = stamp(utc(text('a:published'))), stamp(utc(text('a:updated')))
        if not title or not authors or any(not author for author in authors):
            raise ValueError('Missing source title or authors')
        entries.append({'id': paper_id, 'version': version, 'title': title, 'authors': authors,
                        'published': published, 'updated': updated, 'abstract': text('a:summary'),
                        'doi': doi(text('x:doi')) or None, 'journalRef': text('x:journal_ref') or None,
                        'arxivCategories': [c.attrib['term'] for c in entry.findall('a:category', NS)],
                        'paperUrl': f'https://arxiv.org/abs/{paper_id}',
                        'versionUrl': f'https://arxiv.org/abs/{paper_id}v{version}',
                        'pdfUrl': f'https://arxiv.org/pdf/{paper_id}v{version}'})
    total = int(root.findtext('s:totalResults', '-1', NS))
    start = int(root.findtext('s:startIndex', '-1', NS))
    if total < 0 or start < 0 or start + len(entries) > total:
        raise ValueError('Missing or inconsistent pagination metadata')
    return total, start, entries


def configuration(path):
    config = load(path)
    if not isinstance(config.get('queries'), list) or not config['queries'] or any(not isinstance(q, str) or not q.strip() for q in config['queries']):
        raise ValueError('Configure a nonempty queries array')
    for key, default, upper in [('initialLookbackDays', 9, 3660), ('overlapDays', 2, 30), ('pageSize', 100, 2000), ('maxPagesPerQuery', 10, 100)]:
        config.setdefault(key, default)
        if type(config[key]) is not int or not 1 <= config[key] <= upper:
            raise ValueError(f'Invalid {key}')
    return config


def search_plan(config, state, now):
    fingerprint = hashlib.sha256(json.dumps(config['queries'], ensure_ascii=False).encode()).hexdigest()
    previous = state.get('lastSuccessfulScan') if state.get('queryFingerprint') == fingerprint else None
    since = utc(previous) - timedelta(days=config['overlapDays']) if previous else now - timedelta(days=config['initialLookbackDays'])
    incomplete = state.get('lastAttempt', {})
    if incomplete.get('queryFingerprint') == fingerprint and incomplete.get('status') in ('running', 'incomplete'):
        since = min(since, utc(incomplete['from']))
    if since > now:
        raise ValueError('Discovery cursor is in the future; check the host clock')
    date_query = f'submittedDate:[{since:%Y%m%d%H%M} TO {now:%Y%m%d%H%M}]'
    return {'from': stamp(since), 'to': stamp(now), 'queryFingerprint': fingerprint,
            'queries': [f'({query}) AND {date_query}' for query in config['queries']]}


def merge_candidates(state, entries, catalog, now):
    by_id, by_doi, by_title = {}, {}, {}
    for paper in catalog:
        for value in [paper.get('id'), paper.get('arxivUrl'), paper.get('paperUrl'), paper.get('url')]:
            found = identity(value)
            if found:
                by_id[found[0]] = paper['id']
        if doi(paper.get('doi')):
            by_doi[doi(paper['doi'])] = paper['id']
        if paper.get('title'):
            by_title[title_key(paper['title'])] = paper['id']
    for paper in entries:
        old = state['candidates'].get(paper['id'])
        if old and old['version'] > paper['version']:
            continue
        match = by_id.get(paper['id']) or by_doi.get(doi(paper['doi']))
        possible = by_title.get(title_key(paper['title']))
        status = 'published' if old and old['status'] == 'published' else 'existing' if match else old['status'] if old else 'possible-duplicate' if possible else 'pending'
        # Decisions, source fingerprints and retained attempts belong to one version.
        # Observe a revision without moving an accepted/active decision onto its bytes.
        if old and paper['version'] > old['version'] and old['status'] not in ('pending', 'possible-duplicate'):
            old.update(newerVersion=paper, lastSeenAt=now, catalogMatch=match, status=status)
            continue
        row = {**paper, 'firstSeenAt': old['firstSeenAt'] if old else now, 'lastSeenAt': now,
               'status': status, 'catalogMatch': match, 'possibleTitleMatch': possible,
               'history': old.get('history', []) if old else []}
        if old and 'reason' in old:
            row['reason'] = old['reason']
        if old and 'newerVersion' in old:
            row['newerVersion'] = old['newerVersion']
        state['candidates'][paper['id']] = row


class Client:
    def __init__(self):
        self.last_request = 0

    def __call__(self, query, offset, size):
        url = 'https://export.arxiv.org/api/query?' + urllib.parse.urlencode({
            'search_query': query, 'start': offset, 'max_results': size,
            'sortBy': 'submittedDate', 'sortOrder': 'ascending'})
        for attempt in range(3):
            time.sleep(max(0, 3.2 - (time.monotonic() - self.last_request)))
            self.last_request = time.monotonic()
            try:
                request = urllib.request.Request(url, headers={'User-Agent': 'SurveyWeeklyUpdater/1.0 (academic metadata discovery)', 'Accept': 'application/atom+xml'})
                with urllib.request.urlopen(request, timeout=35) as response:
                    return response.read(12_000_001)
            except (OSError, http.client.HTTPException) as error:
                if isinstance(error, urllib.error.HTTPError) and error.code == 429:
                    retry_after = error.headers.get('Retry-After', 'a later run') if error.headers else 'a later run'
                    raise RuntimeError(f'arXiv rate limited (HTTP 429); retry after {retry_after}; search is incomplete') from error
                if isinstance(error, urllib.error.HTTPError) and error.code not in (429, 500, 502, 503, 504):
                    raise
                if attempt == 2:
                    raise
                time.sleep(5 * (attempt + 1))


def scan(config, state, catalog, now, fetch, persist):
    plan = search_plan(config, state, now)
    state['lastAttempt'] = {**plan, 'status': 'running', 'fetched': 0}
    persist(state)
    try:
        for query in plan['queries']:
            offset, seen, expected_total = 0, set(), None
            for _ in range(config['maxPagesPerQuery']):
                total, start, entries = parse_feed(fetch(query, offset, config['pageSize']))
                if start != offset or len(entries) != min(config['pageSize'], total - offset):
                    raise ValueError('Incomplete pagination; cursor preserved')
                if expected_total is not None and total != expected_total:
                    raise ValueError('Pagination total changed; cursor preserved')
                expected_total = total
                if len({p['id'] for p in entries}) != len(entries) or any(p['id'] in seen for p in entries):
                    raise ValueError('Repeated pagination entry; cursor preserved')
                seen.update(p['id'] for p in entries)
                merge_candidates(state, entries, catalog, stamp(now))
                state['lastAttempt']['fetched'] += len(entries)
                persist(state)
                offset += len(entries)
                if offset >= total:
                    break
            else:
                raise ValueError('Pagination limit reached; refine queries or increase maxPagesPerQuery; cursor preserved')
        state['lastSuccessfulScan'] = stamp(now)
        state['queryFingerprint'] = plan['queryFingerprint']
        state['lastAttempt']['status'] = 'complete'
        persist(state)
    except Exception as error:
        state['lastAttempt'].update(status='incomplete', error=str(error))
        persist(state)
        raise


def private_directory(value, catalog=None, config=None):
    target = Path(value).resolve()
    anchors = [Path(__file__).resolve(), *[Path(p).resolve() for p in (catalog, config) if p]]
    for anchor in anchors:
        for root in anchor.parents:
            if (root / '.git').exists() and target.is_relative_to(root):
                raise ValueError('Queue/state must stay outside the Git repository')
    return target


@contextmanager
def locked(directory):
    directory.mkdir(parents=True, exist_ok=True)
    lock = directory / '.queue.lock'
    try:
        descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        raise ValueError('Queue is locked; verify its owner is no longer running before recovery')
    try:
        with os.fdopen(descriptor, 'w') as stream:
            json.dump({'pid': os.getpid(), 'startedAt': stamp(utc())}, stream)
        yield
    finally:
        lock.unlink()


def summary(state):
    return {'lastSuccessfulScan': state.get('lastSuccessfulScan'), 'lastAttempt': state.get('lastAttempt'),
            'counts': dict(Counter(p['status'] for p in state['candidates'].values())),
            'queuedIds': [p['id'] for p in state['candidates'].values() if p['status'] not in ('excluded', 'existing', 'published')]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['discover', 'status', 'decide'])
    parser.add_argument('--state-dir', required=True)
    parser.add_argument('--config')
    parser.add_argument('--catalog')
    parser.add_argument('--plan', action='store_true')
    parser.add_argument('--probe', action='store_true')
    parser.add_argument('--id')
    parser.add_argument('--status', choices=STATES)
    parser.add_argument('--reason')
    args = parser.parse_args()
    directory = private_directory(args.state_dir, args.catalog, args.config)
    path = directory / 'state.json'
    empty = {'schemaVersion': 1, 'candidates': {}}
    if args.command == 'status':
        print(json.dumps(summary(load(path, empty)), indent=2))
        return
    if args.command == 'discover':
        if not args.config or not args.catalog:
            parser.error('discover requires --config and --catalog')
        config, catalog, now = configuration(args.config), load(args.catalog), utc()
        if not isinstance(catalog, list):
            raise ValueError('Catalog must be a JSON array')
        if args.plan or args.probe:
            plan = search_plan(config, load(path, empty), now)
            if args.probe:
                total, _, entries = parse_feed(Client()(plan['queries'][0], 0, min(5, config['pageSize'])))
                plan['probe'] = {'total': total, 'entries': entries, 'stateChanged': False}
            print(json.dumps(plan, ensure_ascii=False, indent=2))
            return
    with locked(directory):
        state = load(path, empty)
        if args.command == 'decide':
            if args.id not in state['candidates'] or not args.status or not args.reason or not args.reason.strip():
                parser.error('decide requires a queued --id, --status and nonempty --reason')
            paper = state['candidates'][args.id]
            paper['history'].append({'at': stamp(utc()), 'version': paper['version'], 'from': paper['status'], 'to': args.status, 'reason': args.reason})
            paper.update(status=args.status, reason=args.reason)
            save(path, state)
        else:
            scan(config, state, catalog, now, Client(), lambda value: save(path, value))
        print(json.dumps(summary(state), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'arXiv queue: {error}', file=sys.stderr)
        sys.exit(1)
