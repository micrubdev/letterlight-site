const SITE = 'https://letterlight.app';
export default {
  layout: 'feature.njk',
  bodyClass: 'doc',
  eleventyComputed: {
    permalink: (d) => `/features/${d.page.fileSlug}/`,
    jsonld: (d) => [
      {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Letterlight', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'App features', item: `${SITE}/features/` },
          { '@type': 'ListItem', position: 3, name: d.title, item: `${SITE}/features/${d.page.fileSlug}/` },
        ],
      },
    ],
  },
};
