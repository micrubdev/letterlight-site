const SITE = 'https://letterlight.app';
export default {
  layout: 'facts.njk',
  bodyClass: 'doc',
  ogType: 'article',
  eleventyComputed: {
    permalink: (d) => `/facts/${d.mentor}/`,
    mentorData: (d) => d.mentors.find((m) => m.id === d.mentor),
    jsonld: (d) => [
      {
        '@context': 'https://schema.org', '@type': 'Article',
        headline: d.title, description: d.description,
        datePublished: new Date(d.page.date).toISOString().slice(0, 10),
        dateModified: new Date(d.updated ?? d.page.date).toISOString().slice(0, 10),
        author: { '@type': 'Organization', name: 'Letterlight', url: SITE },
        mainEntityOfPage: `${SITE}/facts/${d.mentor}/`,
      },
      {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Letterlight', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'True stories', item: `${SITE}/facts/` },
          { '@type': 'ListItem', position: 3, name: d.title, item: `${SITE}/facts/${d.mentor}/` },
        ],
      },
    ],
  },
};
