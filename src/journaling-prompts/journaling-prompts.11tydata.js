const SITE = 'https://letterlight.app';
export default {
  layout: 'guide.njk',
  bodyClass: 'doc',
  ogType: 'article',
  eleventyComputed: {
    permalink: (d) => `/journaling-prompts/${d.problem}/`,
    problemData: (d) => d.problems.find((p) => p.id === d.problem),
    jsonld: (d) => [
      {
        '@context': 'https://schema.org', '@type': 'Article',
        headline: d.title, description: d.description,
        datePublished: new Date(d.page.date).toISOString().slice(0, 10),
        dateModified: new Date(d.updated ?? d.page.date).toISOString().slice(0, 10),
        author: { '@type': 'Organization', name: 'Letterlight', url: SITE },
        mainEntityOfPage: `${SITE}/journaling-prompts/${d.problem}/`,
      },
      {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Letterlight', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Journaling prompts', item: `${SITE}/journaling-prompts/` },
          { '@type': 'ListItem', position: 3, name: d.title, item: `${SITE}/journaling-prompts/${d.problem}/` },
        ],
      },
    ],
  },
};
