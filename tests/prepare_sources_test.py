"""Offline regressions for source identity, readiness, and resumable provenance.

Run with Python 3.12+ and pypdf 6.10.0:
    python3 -m unittest discover -s tests -p prepare_sources_test.py
No network calls and no catalog/source-cache mutations occur in these tests.
"""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/reading/prepare-sources.py'
spec = importlib.util.spec_from_file_location('prepare_sources', SCRIPT)
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


class SourcePreparationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='wam-source-test-')
        self.folder = Path(self.temporary.name)
        self.paper = {'id': 'test', 'title': 'Navigation World Models',
                      'paperUrl': 'https://example.org/paper', 'pdfUrl': None, 'arxivUrl': None}

    def tearDown(self):
        self.temporary.cleanup()

    def save(self, html, url='https://example.org/paper', paper=None):
        raw = html.encode('utf-8')
        parsed = prepare.SourceHTML(url)
        parsed.feed(html)
        return prepare.save_html(paper or self.paper, self.folder, raw, url,
                                 '2026-09-07T00:00:00Z', parsed)

    def test_actual_source_title_must_match(self):
        matched = self.save('<h1>Navigation World Models</h1><p>Abstract only.</p>')
        self.assertTrue(matched['titleMatch'])
        rejected = self.save('<h1>Robotic Grasping with Force Sensors</h1>')
        self.assertFalse(rejected['titleMatch'])
        self.assertEqual(rejected['accessStatus'], 'identity-mismatch')
        self.assertNotEqual(rejected['observedTitle'], self.paper['title'])

    def test_abstract_partial_body_and_full_paper_scopes(self):
        abstract = self.save('<h1>Navigation World Models</h1><p>Abstract only.</p>')
        self.assertEqual((abstract['accessStatus'], abstract['scope']),
                         ('partial-text', 'abstract-only'))
        partial = self.save('<article><h1>Navigation World Models</h1>'
                            '<h2>1 Introduction</h2>' + 'body ' * 800 +
                            '<h2>2 Method</h2></article>')
        self.assertEqual((partial['accessStatus'], partial['scope']),
                         ('partial-text', 'selected-sections'))
        full = self.save('<article><h1>Navigation World Models</h1>'
                         '<h2>1 Introduction</h2>' + 'body ' * 2100 +
                         '<h2>2 Method</h2><h2>References</h2></article>',
                         url='https://arxiv.org/html/2600.00001')
        self.assertEqual((full['accessStatus'], full['scope']), ('full-text', 'full-paper'))

    def test_long_publisher_bibliography_does_not_prove_full_text(self):
        landing = self.save('<article><h1>Navigation World Models</h1><h2>Abstract</h2>'
                            + 'citation ' * 2200 + '<h2>References</h2></article>',
                            url='https://publisher.example/article/abstract')
        self.assertNotEqual(landing['accessStatus'], 'full-text')
        self.assertEqual(landing['scope'], 'abstract-only')

    def test_official_resource_is_not_a_paper_scope(self):
        paper = dict(self.paper, paperUrl='https://www.dyna.co/dyna-2')
        resource = self.save('<article><h1>Navigation World Models</h1>'
                             '<h2>System documentation</h2>' + 'documentation ' * 500 +
                             '</article>', paper=paper)
        self.assertEqual((resource['accessStatus'], resource['scope']),
                         ('full-text', 'resource-overview'))
        self.assertEqual(resource['resourceTypeHint'], 'technical-resource')
        minimal = self.save('<h1>Navigation World Models</h1><p>Coming soon.</p>', paper=paper)
        self.assertEqual(minimal['scope'], 'abstract-only')

    def test_resume_checks_both_downloaded_bytes_and_text(self):
        manifest = self.save('<h1>Navigation World Models</h1><p>Abstract only.</p>')
        path = self.folder / 'manifest.json'
        prepare.atomic(path, manifest)
        self.assertTrue(prepare.good_existing(path))
        raw_path = Path(manifest['sourcePath'])
        original_raw = raw_path.read_bytes()
        raw_path.write_bytes(b'changed source')
        self.assertFalse(prepare.good_existing(path))
        raw_path.write_bytes(original_raw)
        Path(manifest['textPath']).write_text('changed extraction')
        self.assertFalse(prepare.good_existing(path))

    def test_candidate_artifacts_are_independent(self):
        first = self.save('<h1>Navigation World Models</h1><p>Abstract only.</p>')
        second = self.save('<h1>Unrelated Work</h1>', 'https://example.org/other')
        self.assertNotEqual(first['sourcePath'], second['sourcePath'])
        self.assertNotEqual(first['textPath'], second['textPath'])
        self.assertEqual(prepare.sha(Path(first['textPath']).read_bytes()), first['textSha256'])
        # Even identical bytes from different URLs retain distinct SOURCE markers.
        third = self.save('<h1>Navigation World Models</h1><p>Abstract only.</p>',
                          'https://example.org/mirror')
        self.assertNotEqual(first['textPath'], third['textPath'])
        self.assertEqual(prepare.sha(Path(first['textPath']).read_bytes()), first['textSha256'])

    def test_landing_page_failure_does_not_corrupt_best_candidate(self):
        from types import SimpleNamespace
        args = SimpleNamespace(work_dir=self.folder, retry=False)
        paper = dict(self.paper, pdfUrl='https://example.org/download')
        def fake_fetch(url, _args):
            body = ('<h1>Navigation World Models</h1><p>Abstract only.</p>'
                    if url.endswith('/download') else '<h1>Unrelated Work</h1>')
            return body.encode(), url, 'text/html', '2026-09-07T00:00:00Z'
        with patch.object(prepare, 'fetch', side_effect=fake_fetch):
            self.assertEqual(prepare.prepare(paper, args), ('prepared', 'partial-text'))
        manifest_path = self.folder / 'sources/test/manifest.json'
        manifest = json.loads(manifest_path.read_text())
        self.assertEqual(manifest['canonicalUrl'], 'https://example.org/download')
        self.assertTrue(prepare.good_existing(manifest_path))
        self.assertEqual(manifest['scope'], 'abstract-only')
        with patch.object(prepare, 'fetch', side_effect=AssertionError('Resume must not fetch')):
            self.assertEqual(prepare.prepare(paper, args), ('cached', 'partial-text'))

    def test_browser_verification_is_unavailable_not_wrong_paper(self):
        blocked = self.save('<title>Verifying your browser | OpenReview</title>'
                            '<h1>Verifying your browser</h1><p>Complete the check below.</p>')
        self.assertEqual(blocked['accessStatus'], 'unavailable')
        self.assertFalse(blocked['titleMatch'])
        stable = 'https://openreview.net/pdf?id=public-id'
        self.assertEqual(prepare.citation_url(self.paper, stable,
                         'https://openreview.net/challenge?redirect=pdf'), stable)
        parsed = prepare.SourceHTML(stable)
        parsed.feed('<a href="/login?redirect=paper.pdf">Sign in</a>')
        self.assertFalse(parsed.pdf_links)

    def test_signed_downloads_keep_stable_public_citations(self):
        stable = 'https://publisher.example/paper.pdf'
        signed = 'https://cdn.example/paper.pdf?X-Amz-Signature=temporary&Expires=123'
        self.assertEqual(prepare.citation_url(self.paper, stable, signed), stable)
        self.assertEqual(prepare.citation_url(self.paper, signed, signed), self.paper['paperUrl'])
        openreview = 'https://openreview.net/pdf?id=public-paper-id'
        self.assertEqual(prepare.citation_url(self.paper, openreview, openreview), openreview)

    def test_pdf_heading_filter_omits_equations_and_reference_entries(self):
        headings = prepare.sections('Abstract\n1 Introduction\n2.1 World Model Training\n'
                                    'x = a + b\nReferences\n1. Foo Bar, Journal 2024.\n'
                                    'A Appendix Experiments')
        self.assertEqual(headings, ['Abstract', '1 Introduction', '2.1 World Model Training',
                                    'References', 'A Appendix Experiments'])


if __name__ == '__main__':
    unittest.main()
