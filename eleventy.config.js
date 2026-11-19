import fs from 'node:fs';
import yaml from 'js-yaml';

const mentors = JSON.parse(fs.readFileSync('src/_data/mentors.json', 'utf8'));
const problems = JSON.parse(fs.readFileSync('src/_data/problems.json', 'utf8'));
const byDate = (a, b) => a.date - b.date;

export default function (eleventyConfig) {
  for (const p of ['src/assets', 'src/icon.png', 'src/CNAME', 'src/.nojekyll'])
    eleventyConfig.addPassthroughCopy(p);

  // The quote bank lives outside src/ so it is never published.
  eleventyConfig.addGlobalData('quotes', () => yaml.load(fs.readFileSync('content/quotes.yaml', 'utf8')) ?? []);

  const letters = (api) => api.getFilteredByGlob('src/letters/*.md').sort(byDate);
  const guides = (api) => api.getFilteredByGlob('src/journaling-prompts/*.md').sort(byDate);
  eleventyConfig.addCollection('letters', letters);
  eleventyConfig.addCollection('guides', guides);
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
  eleventyConfig.addFilter('isoDate', (d) => new Date(d).toISOString().slice(0, 10));

  return {
    dir: { input: 'src', output: '_site', includes: '_includes', data: '_data' },
    templateFormats: ['njk', 'md'],
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
  };
}
