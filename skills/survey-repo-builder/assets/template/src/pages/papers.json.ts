import papers from '../../data/papers.json';
export function GET() { return new Response(JSON.stringify(papers), { headers: { 'Content-Type': 'application/json; charset=utf-8' } }); }
