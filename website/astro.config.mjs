// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://stephanorgiazzi.github.io/playdot-player',
  base: '/playdot-player/',
  trailingSlash: 'always',
  integrations: [sitemap()],
});
