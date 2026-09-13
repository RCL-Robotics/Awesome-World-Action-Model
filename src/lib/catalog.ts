import rawPapers from '../../data/papers.json';
import meta from '../../data/meta.json';
import classificationOverrides from '../../data/classification-overrides.json';
import { comparePapers } from './search.mjs';
import { MAJOR_CATEGORIES, QUADRANTS, QUADRANT_STATUSES, taxonomyLabel } from './taxonomy.mjs';
export { venueLabel } from './display.mjs';

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
  majorCategory: string | null;
  subcategories: string[];
  architecture: string | null;
  predictionParadigm: string | null;
  quadrant: string | null;
  classificationStatus: string | null;
}

export const papers = (rawPapers as Paper[]).toSorted(comparePapers);
export const categoryReviewFor = (id: string) => classificationOverrides.entries.find(entry => entry.paperId === id);
export { meta };
export const repoUrl = 'https://github.com/RCL-Robotics/Awesome-World-Action-Models';
export const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const pathFor = (path = '') => `${base}/${path.replace(/^\//, '')}`;
export const paperPath = (id: string) => pathFor(`papers/${id}/`);
export const paperSourceUrl = (paper: Paper) => paper.paperUrl || paper.arxivUrl || '';
const majorColors = ['#7b8997', '#597eac', '#579483', '#b69b51', '#8b78aa', '#b78457', '#507e86', '#8b7f77'];
const quadrantColors = ['#597eac', '#8b78aa', '#579483', '#b78457', '#97836c', '#8b96a1', '#baa051'];
export const majorCategories = MAJOR_CATEGORIES.map((name, index) => ({ name, label: taxonomyLabel(name), color: majorColors[index], count: papers.filter(p => p.majorCategory === name).length }));
export const quadrantStatuses = QUADRANT_STATUSES.map((name, index) => ({ name, label: QUADRANTS.includes(name) ? name.split(' · ')[0] : taxonomyLabel(name), color: quadrantColors[index], count: papers.filter(p => p.quadrant === name).length }));
export const quadrants = quadrantStatuses.filter(quadrant => QUADRANTS.includes(quadrant.name));
export const subtypes = [...new Set(papers.flatMap(p => p.subcategories || []))].sort((a, b) => taxonomyLabel(a).localeCompare(taxonomyLabel(b), 'en'));
export const majorPendingCount = papers.filter(p => !p.majorCategory).length;
export const quadrantPendingCount = papers.filter(p => !p.quadrant).length;
export const majorCategoryFor = (name: string | null) => majorCategories.find(category => category.name === name);
export const quadrantFor = (name: string | null) => quadrantStatuses.find(quadrant => quadrant.name === name);
export const categories = [
  { name: '3D/4D WAM', label: '3D / 4D', slug: '3d-4d', color: '#5979aa', description: 'Geometry, spatial structure, and dynamic scenes in action-conditioned world models.' },
  { name: 'WAM + RL', label: 'Reinforcement learning', slug: 'rl', color: '#ac7744', description: 'World models connected to policy learning, rewards, and decision-making.' },
  { name: 'Memory WAM', label: 'Memory', slug: 'memory', color: '#9576b0', description: 'Persistent state and context for reasoning and acting across longer horizons.' },
  { name: 'Multimodal / Tactile WAM', label: 'Multimodal / tactile', slug: 'multimodal', color: '#528b81', description: 'Combining vision, touch, and other signals to represent and interact with the world.' },
  { name: 'Real-Time / Efficient WAM', label: 'Real-time / efficient', slug: 'efficient', color: '#bf8952', description: 'Efficient prediction, planning, and inference for practical control.' },
  { name: 'Latent / Representation WAM', label: 'Latent / representation', slug: 'latent', color: '#6d7ac2', description: 'Learning compact representations and predicting dynamics in latent space.' },
  { name: 'Navigation / Driving / Domain WAM', label: 'Navigation / domains', slug: 'domains', color: '#6e9273', description: 'World-Action Models for navigation, driving, and specialized environments.' },
  { name: 'Evaluation / Survey / Theory', label: 'Evaluation / theory', slug: 'evaluation', color: '#968879', description: 'Benchmarks, analysis, surveys, and foundations for understanding world models.' },
  { name: 'General WAM', label: 'General WAMs', slug: 'general', color: '#82929f', description: 'General World-Action Models that connect prediction with action.' },
].map(category => ({ ...category, count: papers.filter(p => p.primaryCategory === category.name).length }));
export const pendingCount = papers.filter(p => p.primaryCategory === 'Uncategorized').length;
export const classifiedCount = categories.reduce((total, category) => total + category.count, 0);
export const uncategorizedCategory = { name: 'Uncategorized', label: 'No research topic', slug: 'uncategorized', color: '#8b96a1', description: 'Papers without one of the supplementary research-topic labels.', count: pendingCount };
export const categoryFor = (name: string) => name === uncategorizedCategory.name ? uncategorizedCategory : categories.find(c => c.name === name);
export const formatDate = (date: string | null, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) => date ? new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`)) : 'Date not recorded';
