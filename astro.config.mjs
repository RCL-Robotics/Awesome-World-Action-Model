import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://beat-in-our-hearts.github.io',
  base: '/Awesome-World-Action-Model',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
