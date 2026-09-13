import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://rcl-robotics.github.io',
  base: '/Awesome-World-Action-Models',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
