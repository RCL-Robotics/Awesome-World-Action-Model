import rawConfig from '../../survey.config.json';
import rawPapers from '../../data/papers.json';
export interface Paper {
  id: string; title: string; authors: string[]; url: string; year: number | null; date: string | null;
  categories: string[]; tags: string[]; abstract: string; summary: string; bibtex: string;
  codeUrl: string | null; projectUrl: string | null; priority?: number;
}
export interface SurveyConfig {
  schemaVersion: number; mode: string; title: string; description: string; language: string;
  authors: {name: string; affiliation?: string; url?: string}[];
  repository: {owner: string; name: string} | null;
  site: {origin: string; base: string; accent: string};
  categories: {id: string; label: string; description: string; sort: string}[];
  sections: {heading: string; text: string; equation?: string}[];
  figures: {src: string; alt: string; caption: string}[];
  paperUrl: string | null; citation: string; starHistory: boolean; exampleData: boolean;
}
export const config = rawConfig as SurveyConfig;
export const papers = rawPapers as Paper[];
