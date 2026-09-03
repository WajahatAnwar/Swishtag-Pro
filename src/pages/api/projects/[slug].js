export const prerender = false;

const DEFAULT_PROJECTS_ENDPOINT = 'https://cms.swishtag.com/wp-json/wp/v2/portfolio';
const CACHE_TTL = 5 * 60 * 1000;
const STALE_CACHE_TTL = 60 * 60 * 1000;
const projectCache = globalThis.__swishtagProjectCache
  ?? (globalThis.__swishtagProjectCache = new Map());

function json(data, status = 200, cacheControl = 'no-store') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
    },
  });
}

function requestHeaders() {
  return {
    Accept: 'application/json, text/html;q=0.9',
    Origin: 'https://swishtag.com',
    Referer: 'https://swishtag.com/',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/139 Safari/537.36',
  };
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithRetry(url, options, retries = 2) {
  let lastResponse;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(15000),
      });
      lastResponse = response;
      if (response.ok || response.status === 404 || response.status === 400) {
        return response;
      }
    } catch (error) {
      lastError = error;
    }

    if (attempt < retries) await wait(250 * (attempt + 1));
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error('The upstream request failed.');
}

function decodeHtml(value = '') {
  const namedEntities = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return String(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code) => {
    if (code[0] === '#') {
      const isHex = code[1]?.toLowerCase() === 'x';
      const number = Number.parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : entity;
    }
    return namedEntities[code.toLowerCase()] ?? entity;
  });
}

function stripTags(value = '') {
  return decodeHtml(String(value).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function getAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
  return match?.[2] ?? '';
}

function getMetaContent(html, key) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const metaKey = getAttribute(tag, 'property') || getAttribute(tag, 'name');
    if (metaKey.toLowerCase() === key.toLowerCase()) {
      return decodeHtml(getAttribute(tag, 'content'));
    }
  }
  return '';
}

function extractBalancedDiv(html, id) {
  const openingPattern = new RegExp(`<div\\b[^>]*\\bid\\s*=\\s*(["'])${id}\\1[^>]*>`, 'i');
  const opening = openingPattern.exec(html);
  if (!opening) return '';

  const contentStart = opening.index + opening[0].length;
  const divPattern = /<\/?div\b[^>]*>/gi;
  divPattern.lastIndex = contentStart;
  let depth = 1;
  let match;

  while ((match = divPattern.exec(html))) {
    if (/^<\/div/i.test(match[0])) {
      depth -= 1;
      if (depth === 0) return html.slice(contentStart, match.index);
    } else if (!/\/>$/.test(match[0])) {
      depth += 1;
    }
  }

  return '';
}

function extractLegacyProject(html, slug) {
  const content = extractBalancedDiv(html, 'portfolio-extra');
  if (!content) return null;

  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  const title = stripTags(getMetaContent(html, 'og:title') || titleTag)
    .replace(/\s*[-|]\s*Swishtag\s*$/i, '')
    .trim();
  const excerpt = getMetaContent(html, 'og:description') || getMetaContent(html, 'description');
  const portfolioWrapper = html.match(/<div\b[^>]*\bid\s*=\s*(["'])full_width_portfolio\1[^>]*>/i)?.[0] || '';
  const featuredImage = decodeHtml(getAttribute(portfolioWrapper, 'data-featured-img'))
    || getMetaContent(html, 'og:image');

  return {
    slug,
    date: getMetaContent(html, 'article:published_time') || undefined,
    modified: getMetaContent(html, 'article:modified_time') || undefined,
    link: `https://swishtag.com/project/${encodeURIComponent(slug)}/`,
    title: { rendered: title || slug.replace(/-/g, ' ') },
    excerpt: { rendered: excerpt },
    content: { rendered: content, protected: false },
    _embedded: featuredImage
      ? {
          'wp:featuredmedia': [{
            source_url: featuredImage,
            alt_text: title,
            media_details: { sizes: { full: { source_url: featuredImage } } },
          }],
        }
      : {},
  };
}

async function fetchRestProject(endpoint, slug) {
  const url = new URL(endpoint);
  url.searchParams.set('slug', slug);
  url.searchParams.set('_embed', '1');
  url.searchParams.set('per_page', '1');

  const response = await fetchWithRetry(url, { headers: requestHeaders() }, 1);
  if (!response.ok) return null;

  const result = await response.json();
  const project = Array.isArray(result) ? result[0] : result;
  return project?.slug ? project : null;
}

async function fetchLegacyProject(cmsOrigin, slug) {
  const url = new URL(`/project/${encodeURIComponent(slug)}/`, cmsOrigin);
  const response = await fetchWithRetry(url, {
    headers: { ...requestHeaders(), Accept: 'text/html' },
    redirect: 'follow',
  }, 2);
  if (!response.ok) return null;
  return extractLegacyProject(await response.text(), slug);
}

export async function GET({ params }) {
  const slug = String(params.slug || '').toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 180) {
    return json({ error: 'Invalid project slug.' }, 400);
  }

  const endpoint = import.meta.env.WORDPRESS_PROJECTS_ENDPOINT
    ?? import.meta.env.PUBLIC_WORDPRESS_PROJECTS_ENDPOINT
    ?? DEFAULT_PROJECTS_ENDPOINT;

  let cmsOrigin;
  try {
    cmsOrigin = import.meta.env.WORDPRESS_CMS_ORIGIN || new URL(endpoint).origin;
  } catch (error) {
    return json({ error: 'The WordPress project endpoint is not configured correctly.' }, 500);
  }

  const cacheKey = `${endpoint}:${slug}`;
  const cached = projectCache.get(cacheKey);
  if (cached && Date.now() - cached.savedAt < CACHE_TTL) {
    return json(cached.project, 200, 'public, max-age=300, stale-while-revalidate=3600');
  }

  try {
    const project = await fetchRestProject(endpoint, slug)
      || await fetchLegacyProject(cmsOrigin, slug);

    if (!project) {
      return json({ error: 'Project not found.' }, 404, 'public, max-age=60');
    }

    projectCache.set(cacheKey, { project, savedAt: Date.now() });
    return json(project, 200, 'public, max-age=300, stale-while-revalidate=3600');
  } catch (error) {
    if (cached && Date.now() - cached.savedAt < STALE_CACHE_TTL) {
      return json(cached.project, 200, 'public, max-age=60, stale-while-revalidate=3600');
    }
    return json({ error: 'The project source is temporarily unavailable.' }, 502);
  }
}
