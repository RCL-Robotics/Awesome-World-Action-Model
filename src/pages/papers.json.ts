import { papers } from '../lib/catalog';
export function GET() {
  return new Response(JSON.stringify(papers, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
