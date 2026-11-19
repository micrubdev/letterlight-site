const SITE = 'https://letterlight.app';
export default {
  layout: 'letter.njk',
  bodyClass: 'doc',
  ogType: 'article',
  eleventyComputed: {
    permalink: (d) => `/letters/${d.mentor}-on-${d.problem}/`,
    mentorData: (d) => d.mentors.find((m) => m.id === d.mentor),
    problemData: (d) => d.problems.find((p) => p.id === d.problem),
    quoteData: (d) => (d.quote ? d.quotes.find((q) => q.id === d.quote.id) : undefined),
    jsonld: (d) => {
      const m = d.mentors.find((x) => x.id === d.mentor);
      const url = `${SITE}/letters/${d.mentor}-on-${d.problem}/`;
      return [
        {
          '@context': 'https://schema.org', '@type': 'Article',
          headline: d.title, description: d.description,
          datePublished: new Date(d.page.date).toISOString().slice(0, 10),
          author: { '@type': 'Organization', name: 'Letterlight', url: SITE },
          publisher: { '@type': 'Organization', name: 'Letterlight', logo: { '@type': 'ImageObject', url: `${SITE}/icon.png` } },
          mainEntityOfPage: url,
          about: m ? { '@type': 'Person', name: m.name } : undefined,
        },
        {
          '@context': 'https://schema.org', '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Letterlight', item: `${SITE}/` },
            { '@type': 'ListItem', position: 2, name: m ? m.name : d.mentor, item: `${SITE}/mentors/${d.mentor}/` },
            { '@type': 'ListItem', position: 3, name: d.title, item: url },
          ],
        },
      ];
    },
  },
};
