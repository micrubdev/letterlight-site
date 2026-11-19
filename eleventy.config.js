export default function (eleventyConfig) {
  for (const p of ['src/assets', 'src/icon.png', 'src/CNAME', 'src/.nojekyll'])
    eleventyConfig.addPassthroughCopy(p);
  return {
    dir: { input: 'src', output: '_site', includes: '_includes', data: '_data' },
    templateFormats: ['njk', 'md'],
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
  };
}
