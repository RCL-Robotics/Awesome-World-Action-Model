"""Offline behavioral tests; all scholarly records here are synthetic."""
from copy import deepcopy
from datetime import timedelta
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('weekly_queue', ROOT / 'skills/survey-weekly-updater/scripts/arxiv_queue.py')
Q = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(Q)


def feed(ids, total=None, start=0):
    entries = ''.join(f'''<entry><id>http://arxiv.org/abs/{paper_id}</id>
    <title>Synthetic fixture {paper_id}</title><author><name>Fixture Author</name></author>
    <published>2026-09-10T12:00:00Z</published><updated>2026-09-11T12:00:00Z</updated>
    <summary>Offline test only.</summary><category term="cs.RO"/></entry>''' for paper_id in ids)
    return f'''<feed xmlns="{Q.NS['a']}" xmlns:opensearch="{Q.NS['s']}">
    <opensearch:totalResults>{len(ids) if total is None else total}</opensearch:totalResults>
    <opensearch:startIndex>{start}</opensearch:startIndex>{entries}</feed>'''.encode()


class WeeklyQueueTest(unittest.TestCase):
    def setUp(self):
        self.config = {'queries': ['all:graph', 'all:learning'], 'initialLookbackDays': 9,
                       'overlapDays': 2, 'pageSize': 2, 'maxPagesPerQuery': 3}
        self.state = {'schemaVersion': 1, 'candidates': {}}
        self.now = Q.utc('2026-09-14T05:00:00Z')
        self.saved = []

    def persist(self, state):
        self.saved.append(deepcopy(state))

    def test_atom_preserves_version_unicode_and_primary_metadata(self):
        raw = feed(['2609.12345v3']).replace(b'Fixture Author', '测试作者'.encode())
        total, start, rows = Q.parse_feed(raw)
        self.assertEqual((total, start), (1, 0))
        self.assertEqual(rows[0]['id'], '2609.12345')
        self.assertEqual(rows[0]['version'], 3)
        self.assertEqual(rows[0]['authors'], ['测试作者'])
        self.assertEqual(rows[0]['pdfUrl'], 'https://arxiv.org/pdf/2609.12345v3')
        self.assertIsNone(rows[0]['doi'])

    def test_identity_doi_dedup_and_title_collision_is_not_auto_exclusion(self):
        rows = Q.parse_feed(feed(['2609.11111v2', '2609.22222v1', '2609.33333v1']))[2]
        rows[1]['doi'] = '10.1234/example'
        catalog = [{'id': '2609.11111', 'title': 'Earlier version'},
                   {'id': 'publisher-record', 'doi': 'https://doi.org/10.1234/EXAMPLE', 'title': 'Published record'},
                   {'id': 'title-record', 'title': rows[2]['title']}]
        before = deepcopy(catalog)
        Q.merge_candidates(self.state, rows, catalog, Q.stamp(self.now))
        self.assertEqual(catalog, before)
        self.assertEqual(self.state['candidates']['2609.11111']['status'], 'existing')
        self.assertEqual(self.state['candidates']['2609.22222']['catalogMatch'], 'publisher-record')
        self.assertEqual(self.state['candidates']['2609.33333']['status'], 'possible-duplicate')

    def test_full_pagination_and_cross_query_dedup_advance_only_on_complete(self):
        def fetch(query, offset, size):
            if 'all:graph' in query:
                return feed(['2609.11111v1', '2609.22222v1'], 3) if offset == 0 else feed(['2609.33333v1'], 3, 2)
            return feed(['2609.11111v2'])
        Q.scan(self.config, self.state, [], self.now, fetch, self.persist)
        self.assertEqual(len(self.state['candidates']), 3)
        self.assertEqual(self.state['candidates']['2609.11111']['version'], 2)
        self.assertEqual(self.state['lastSuccessfulScan'], Q.stamp(self.now))
        self.assertTrue(all('lastSuccessfulScan' not in state for state in self.saved[:-1]))
        self.assertEqual(self.state['lastAttempt']['status'], 'complete')

    def test_failed_second_query_preserves_candidates_cursor_and_retry_decision(self):
        old = Q.stamp(self.now - timedelta(days=7))
        self.state.update(lastSuccessfulScan=old, queryFingerprint=Q.search_plan(self.config, self.state, self.now)['queryFingerprint'])
        def fail(query, offset, size):
            if 'all:learning' in query:
                raise TimeoutError('synthetic timeout')
            return feed(['2609.11111v1'])
        with self.assertRaises(TimeoutError):
            Q.scan(self.config, self.state, [], self.now, fail, self.persist)
        self.assertEqual(self.state['lastSuccessfulScan'], old)
        self.assertEqual(self.state['lastAttempt']['status'], 'incomplete')
        self.state['candidates']['2609.11111'].update(status='retry', reason='Unreadable source')
        Q.scan(self.config, self.state, [], self.now, lambda *args: feed(['2609.11111v1']), self.persist)
        self.assertEqual(self.state['candidates']['2609.11111']['status'], 'retry')
        self.assertEqual(self.state['candidates']['2609.11111']['reason'], 'Unreadable source')

    def test_empty_valid_feed_completes_but_error_html_and_truncated_pages_do_not(self):
        Q.scan(self.config, self.state, [], self.now, lambda *args: feed([]), self.persist)
        self.assertEqual(self.state['lastAttempt']['status'], 'complete')
        for response in [b'<html>503</html>', feed([], 2), feed(['2609.11111v1'], 2, 1), feed(['error'])]:
            with self.subTest(response=response), self.assertRaises((ValueError, Q.ET.ParseError)):
                Q.scan(self.config, self.state, [], self.now, lambda *args: response, self.persist)
            self.assertEqual(self.state['lastAttempt']['status'], 'incomplete')

    def test_page_limit_does_not_advance_cursor(self):
        self.config.update(maxPagesPerQuery=1)
        with self.assertRaisesRegex(ValueError, 'Pagination limit'):
            Q.scan(self.config, self.state, [], self.now, lambda *args: feed(['2609.11111v1', '2609.22222v1'], 4), self.persist)
        self.assertNotIn('lastSuccessfulScan', self.state)
        self.assertEqual(len(self.state['candidates']), 2)

    def test_delayed_initial_retry_preserves_original_lower_bound(self):
        with self.assertRaises(TimeoutError):
            Q.scan(self.config, self.state, [], self.now, lambda *args: (_ for _ in ()).throw(TimeoutError()), self.persist)
        delayed = Q.search_plan(self.config, self.state, self.now + timedelta(days=7))
        self.assertEqual(delayed['from'], Q.stamp(self.now - timedelta(days=9)))

    def test_first_scheduled_run_keeps_the_configured_setup_window(self):
        self.config['firstScanFrom'] = '2026-09-05T00:00:00Z'
        delayed = Q.search_plan(self.config, self.state, self.now + timedelta(days=7))
        self.assertEqual(delayed['from'], self.config['firstScanFrom'])

    def test_accepted_revision_stays_pinned_and_newly_cataloged_pending_is_existing(self):
        rows = Q.parse_feed(feed(['2609.11111v1', '2609.22222v1']))[2]
        Q.merge_candidates(self.state, rows, [], Q.stamp(self.now))
        first = self.state['candidates']['2609.11111']
        first.update(status='accepted', reason='Verified v1 source')
        Q.merge_candidates(self.state, Q.parse_feed(feed(['2609.11111v2', '2609.22222v1']))[2],
                           [{'id': '2609.22222', 'title': 'Now in committed catalog'}], Q.stamp(self.now))
        self.assertEqual(first['version'], 1)
        self.assertEqual(first['status'], 'accepted')
        self.assertEqual(first['newerVersion']['version'], 2)
        self.assertNotIn('2609.22222', Q.summary(self.state)['queuedIds'])

    def test_same_page_duplicate_and_changing_total_fail_without_cursor(self):
        with self.assertRaisesRegex(ValueError, 'Repeated'):
            Q.scan(self.config, self.state, [], self.now,
                   lambda *args: feed(['2609.11111v1', '2609.11111v1']), self.persist)
        def changing(query, offset, size):
            return feed(['2609.11111v1', '2609.22222v1'], 4) if offset == 0 else feed(['2609.33333v1'], 3, 2)
        with self.assertRaisesRegex(ValueError, 'total changed'):
            Q.scan(self.config, self.state, [], self.now, changing, self.persist)
        self.assertNotIn('lastSuccessfulScan', self.state)

    def test_overlap_initial_window_and_changed_queries(self):
        plan = Q.search_plan(self.config, self.state, self.now)
        self.assertEqual(plan['from'], Q.stamp(self.now - timedelta(days=9)))
        self.state.update(lastSuccessfulScan=Q.stamp(self.now - timedelta(days=7)), queryFingerprint=plan['queryFingerprint'])
        self.assertEqual(Q.search_plan(self.config, self.state, self.now)['from'], plan['from'])
        self.state['lastSuccessfulScan'] = Q.stamp(self.now - timedelta(days=20))
        self.assertEqual(Q.search_plan(self.config, self.state, self.now)['from'], Q.stamp(self.now - timedelta(days=22)))
        self.config['queries'] = ['all:changed']
        self.assertEqual(Q.search_plan(self.config, self.state, self.now)['from'], plan['from'])

    def test_private_state_and_exclusive_lock(self):
        with self.assertRaisesRegex(ValueError, 'outside'):
            Q.private_directory(ROOT / 'public/queue')
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            with Q.locked(folder):
                with self.assertRaisesRegex(ValueError, 'locked'):
                    with Q.locked(folder):
                        self.fail('overlapping queue writer')
            self.assertFalse((folder / '.queue.lock').exists())
            Q.save(folder / 'state.json', self.state)
            self.assertEqual(Q.load(folder / 'state.json'), self.state)

    def test_rate_limit_stops_requests_instead_of_hammering_or_claiming_empty(self):
        error = Q.urllib.error.HTTPError('https://export.arxiv.org/api/query', 429, 'rate limited', {'Retry-After': '3600'}, None)
        with patch.object(Q.urllib.request, 'urlopen', side_effect=error) as request, patch.object(Q.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, '3600'):
                Q.Client()('all:synthetic', 0, 1)
            self.assertEqual(request.call_count, 1)


if __name__ == '__main__':
    unittest.main()
