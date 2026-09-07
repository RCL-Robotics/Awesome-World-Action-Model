import { papers, pathFor, paperPath } from '../lib/catalog';
export function GET() {
  const paths = [pathFor(), pathFor('map/'), pathFor('about/'), ...papers.map(p => paperPath(p.id))];
  const xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + paths.map(path => `<url><loc>https://beat-in-our-hearts.github.io${path}</loc></url>`).join('') + '</urlset>';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}
