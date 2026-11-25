import fs from 'node:fs';
import { createHash } from 'node:crypto';
import yaml from 'js-yaml';
import rss from '@11ty/eleventy-plugin-rss';

// LL_INPUT lets a test build a modified copy of src/ without touching the real one.
const input = process.env.LL_INPUT || 'src';
const mentors = JSON.parse(fs.readFileSync(`${input}/_data/mentors.json`, 'utf8'));
const problems = JSON.parse(fs.readFileSync(`${input}/_data/problems.json`, 'utf8'));
const byDate = (a, b) => a.date - b.date;

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(rss);
  eleventyConfig.addFilter('concat', (a, b) => [...a, ...b]);
  // Appends a content hash to an asset URL, so a changed file gets a new URL and skips browser caches.
  eleventyConfig.addFilter('v', (url) => `${url}?v=${createHash('sha1').update(fs.readFileSync(`${input}${url}`)).digest('hex').slice(0, 8)}`);
  for (const p of ['assets', 'icon.png', 'CNAME', '.nojekyll']) eleventyConfig.addPassthroughCopy(`${input}/${p}`);

  // The quote bank lives outside src/ so it is never published.
  eleventyConfig.addGlobalData('quotes', () => yaml.load(fs.readFileSync(process.env.LL_QUOTES || 'content/quotes.yaml', 'utf8')) ?? []);

  const letters = (api) => api.getFilteredByGlob(`${input}/letters/*.md`).sort(byDate);
  const guides = (api) => api.getFilteredByGlob(`${input}/journaling-prompts/*.md`).sort(byDate);
  eleventyConfig.addCollection('letters', letters);
  const facts = (api) => api.getFilteredByGlob(`${input}/facts/*.md`).sort(byDate);
  eleventyConfig.addCollection('guides', guides);
  eleventyConfig.addCollection('facts', facts);
  eleventyConfig.addCollection('mentorsWithLetters', (api) => {
    const used = new Set(letters(api).map((p) => p.data.mentor));
    return mentors.filter((m) => used.has(m.id));
  });
  eleventyConfig.addCollection('problemsWithLetters', (api) => {
    const used = new Set(letters(api).map((p) => p.data.problem));
    return problems.filter((p) => used.has(p.id));
  });

  eleventyConfig.addFilter('byMentor', (pages, id, exceptUrl) => pages.filter((p) => p.data.mentor === id && p.url !== exceptUrl));
  eleventyConfig.addFilter('byProblem', (pages, id, exceptUrl) => pages.filter((p) => p.data.problem === id && p.url !== exceptUrl));
  eleventyConfig.addFilter('mentor', (id) => mentors.find((m) => m.id === id));
  eleventyConfig.addFilter('problem', (id) => problems.find((p) => p.id === id));
  eleventyConfig.addFilter('longDate', (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }));
  eleventyConfig.addFilter('isoDate', (d) => new Date(d).toISOString().slice(0, 10));

  return {
    dir: { input, output: process.env.LL_OUTPUT || '_site', includes: '_includes', data: '_data' },
    templateFormats: ['njk', 'md'],
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
  };
}
