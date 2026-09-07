import rawPapers from '../../data/papers.json';
import meta from '../../data/meta.json';
import { comparePapers } from './search.mjs';

export interface Paper {
  id: string;
  title: string;
  authors: string;
  affiliations: string;
  contribution: string;
  abstract: string;
  submittedDate: string | null;
  primaryCategory: string;
  secondaryCategories: string[];
  bibtexKey: string;
  arxivUrl: string | null;
  codeUrls: string[];
  projectUrl: string | null;
  venue: string | null;
  paperUrl: string;
  pdfUrl: string | null;
  doi: string | null;
  publicationYear: number | null;
  bibtex: string;
}

export const papers = (rawPapers as Paper[]).toSorted(comparePapers);
export { meta };
export const repoUrl = 'https://github.com/Beat-in-our-hearts/Awesome-World-Action-Model';
export const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const pathFor = (path = '') => `${base}/${path.replace(/^\//, '')}`;
export const paperPath = (id: string) => pathFor(`papers/${id}/`);
export const paperSourceUrl = (paper: Paper) => paper.paperUrl || paper.arxivUrl || '';
export const categories = [
  { name: '3D/4D WAM', label: '3D / 4D', slug: '3d-4d', color: '#5979aa', description: 'Geometry, spatial structure, and dynamic scenes in action-conditioned world models.' },
  { name: 'WAM + RL', label: 'Reinforcement learning', slug: 'rl', color: '#ac7744', description: 'World models connected to policy learning, rewards, and decision-making.' },
  { name: 'Memory WAM', label: 'Memory', slug: 'memory', color: '#9576b0', description: 'Persistent state and context for reasoning and acting across longer horizons.' },
  { name: 'Multimodal / Tactile WAM', label: 'Multimodal / tactile', slug: 'multimodal', color: '#528b81', description: 'Combining vision, touch, and other signals to represent and interact with the world.' },
  { name: 'Real-Time / Efficient WAM', label: 'Real-time / efficient', slug: 'efficient', color: '#bf8952', description: 'Efficient prediction, planning, and inference for practical control.' },
  { name: 'Latent / Representation WAM', label: 'Latent / representation', slug: 'latent', color: '#6d7ac2', description: 'Learning compact representations and predicting dynamics in latent space.' },
  { name: 'Navigation / Driving / Domain WAM', label: 'Navigation / domains', slug: 'domains', color: '#6e9273', description: 'World action models for navigation, driving, and specialized environments.' },
  { name: 'Evaluation / Survey / Theory', label: 'Evaluation / theory', slug: 'evaluation', color: '#968879', description: 'Benchmarks, analysis, surveys, and foundations for understanding world models.' },
  { name: 'General WAM', label: 'General world models', slug: 'general', color: '#82929f', description: 'Broad world-model approaches that connect prediction with action.' },
].map(category => ({ ...category, count: papers.filter(p => p.primaryCategory === category.name).length }));
export const pendingCount = papers.filter(p => p.primaryCategory === 'Uncategorized').length;
export const classifiedCount = categories.reduce((total, category) => total + category.count, 0);
export const uncategorizedCategory = { name: 'Uncategorized', label: 'Awaiting classification', slug: 'uncategorized', color: '#8b96a1', description: 'Papers whose research direction has not been recorded yet.', count: pendingCount };
export const categoryFor = (name: string) => name === uncategorizedCategory.name ? uncategorizedCategory : categories.find(c => c.name === name);
export const formatDate = (date: string | null, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) => date ? new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`)) : 'Date not recorded';
