import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';
const config = JSON.parse(readFileSync(new URL('./survey.config.json', import.meta.url), 'utf8'));
export default defineConfig({ site: config.site.origin, base: config.site.base, output: 'static', trailingSlash: 'always', devToolbar: { enabled: false } });
