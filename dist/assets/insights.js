const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const WORDPRESS_POSTS_API = 'https://swishtag.com/wp-json/wp/v2/posts';
const WORDPRESS_CATEGORIES_API = 'https://swishtag.com/wp-json/wp/v2/categories';
const POSTS_PER_PAGE = 10;
const FILTER_FALLBACK_SEARCH = {
  shopify: 'shopify',
  'company-stores': 'company store company stores',
  'promotional-products': 'promotional products promo',
  automation: 'automation',
  integrations: 'integration integrations',
  migration: 'migration',
  commerce: 'commerce ecommerce'
};
let categoryCache;
let tocObserver;

function decodeHtml(value = '') {
  const element = document.createElement('textarea');
  element.innerHTML = value;
  return element.value;
}

function htmlToText(value = '') {
  const element = document.createElement('div');
  element.innerHTML = value;
  return element.textContent.replace(/\s+/g, ' ').trim();
}

function formatDate(value, options = { month: 'short', day: 'numeric' }) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

function estimateReadTime(post) {
  const text = htmlToText(post?.content?.rendered || post?.excerpt?.rendered || '');
  const minutes = Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length / 220));
  return `${minutes} min read`;
}

function getFeaturedImage(post) {
  const media = post?._embedded?.['wp:featuredmedia']?.[0];
  const sizes = media?.media_details?.sizes || {};
  return sizes.large?.source_url || sizes.medium_large?.source_url || sizes.full?.source_url || media?.source_url || '';
}

function getCategory(post) {
  const termGroups = post?._embedded?.['wp:term'] || [];
  const category = termGroups.flat().find(term => term.taxonomy === 'category');
  const text = `${htmlToText(post?.title?.rendered)} ${htmlToText(post?.excerpt?.rendered)} ${category?.name || ''}`.toLowerCase();
  const inferred = [
    { slug: 'migration', name: 'Migration', terms: ['migration', 'migrate', 'moving to shopify', 'checkout', 'seo'] },
    { slug: 'integrations', name: 'Integrations', terms: ['integration', 'erp', 'sage', 'api', 'workflow'] },
    { slug: 'automation', name: 'Automation', terms: ['automation', 'fulfillment', 'ai', 'production'] },
    { slug: 'company-stores', name: 'Company Stores', terms: ['company store', 'corporate swag', 'b2b'] },
    { slug: 'promotional-products', name: 'Promotional Products', terms: ['promotional product', 'promo brand', 'promo products', 'print shop', 'custom print'] },
    { slug: 'shopify', name: 'Shopify', terms: ['shopify'] },
    { slug: 'commerce', name: 'Commerce', terms: ['commerce', 'ecommerce', 'e-commerce'] }
  ].find(item => item.terms.some(term => text.includes(term)));

  if (category && category.slug !== 'blog') return { name: category.name, slug: category.slug };
  return inferred || { name: category?.name || 'Blog', slug: category?.slug || 'blog' };
}

function buildPostUrl(post) {
  const slug = post?.slug || '';
  return slug ? `/insights/blog/?slug=${encodeURIComponent(slug)}` : '/insights/blog/';
}

function setImage(target, imageUrl, altText, fallbackClass = 'a') {
  if (!target) return;
  target.innerHTML = '';
  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = altText || '';
    img.loading = 'lazy';
    target.appendChild(img);
    return;
  }

  const fallback = document.createElement('div');
  fallback.className = `art ${fallbackClass}`;
  target.appendChild(fallback);
}

function createCard(post, index) {
  const category = getCategory(post);
  const article = document.createElement('article');
  article.className = 'article-card';
  article.dataset.category = category.slug;

  const link = document.createElement('a');
  link.href = buildPostUrl(post);

  const imageWrap = document.createElement('div');
  imageWrap.className = 'article-image';
  setImage(imageWrap, getFeaturedImage(post), htmlToText(post?.title?.rendered), String.fromCharCode(97 + (index % 10)));

  const categoryLabel = document.createElement('div');
  categoryLabel.className = 'card-category';
  categoryLabel.textContent = category.name;

  const title = document.createElement('h3');
  title.textContent = decodeHtml(htmlToText(post?.title?.rendered));

  const excerpt = document.createElement('p');
  excerpt.textContent = htmlToText(post?.excerpt?.rendered);

  const bottom = document.createElement('div');
  bottom.className = 'card-bottom';

  const meta = document.createElement('div');
  meta.className = 'meta';
  [formatDate(post?.date), estimateReadTime(post)].filter(Boolean).forEach(value => {
    const span = document.createElement('span');
    span.textContent = value;
    meta.appendChild(span);
  });

  const arrow = document.createElement('span');
  arrow.className = 'card-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '\u2192';

  bottom.append(meta, arrow);
  link.append(imageWrap, categoryLabel, title, excerpt, bottom);
  article.appendChild(link);
  return article;
}

function renderFeaturedPost(post) {
  const featured = $('[data-wp-featured-card]');
  if (!featured || !post) return;

  const category = getCategory(post);
  featured.href = buildPostUrl(post);
  setImage($('.featured-visual', featured), getFeaturedImage(post), htmlToText(post?.title?.rendered), 'a');
  $('.featured-content .eyebrow', featured).textContent = category.name;
  $('.featured-content h2', featured).textContent = decodeHtml(htmlToText(post?.title?.rendered));
  $('.featured-content p', featured).textContent = htmlToText(post?.excerpt?.rendered);

  const meta = $('.featured-content .meta', featured);
  if (meta) {
    meta.innerHTML = '';
    [formatDate(post?.date, { month: 'long', day: 'numeric', year: 'numeric' }), estimateReadTime(post)].filter(Boolean).forEach(value => {
      const span = document.createElement('span');
      span.textContent = value;
      meta.appendChild(span);
    });
  }
}

function setListingState(message, isError = false) {
  const grid = $('[data-wp-posts-grid]');
  if (!grid) return;
  grid.innerHTML = `<div class="insights-state${isError ? ' insights-state--error' : ''}">${message}</div>`;
}

function setLoadMoreState(loadMore, { hidden = false, disabled = false, text = 'Load more insights' } = {}) {
  if (!loadMore) return;
  loadMore.hidden = hidden;
  loadMore.disabled = disabled;
  loadMore.textContent = text;
}

function normalizeSlug(value = '') {
  return value.toLowerCase().replace(/&amp;/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function getCategories() {
  if (categoryCache) return categoryCache;

  const categories = [];
  let page = 1;
  let totalPages = 1;

  do {
    const url = new URL(WORDPRESS_CATEGORIES_API);
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));
    url.searchParams.set('_fields', 'id,slug,name,count');

    const response = await fetch(url);
    if (!response.ok) throw new Error(`WordPress categories returned ${response.status}`);

    categories.push(...await response.json());
    totalPages = Number(response.headers.get('X-WP-TotalPages') || page);
    page += 1;
  } while (page <= totalPages);

  categoryCache = categories;
  return categoryCache;
}

async function getCategoryIds(filter) {
  if (!filter || filter === 'all') return [];

  let categories = [];
  try {
    categories = await getCategories();
  } catch (error) {
    return [];
  }

  const wanted = normalizeSlug(filter);
  const matches = categories.filter(category => {
    const slug = normalizeSlug(category.slug);
    const name = normalizeSlug(category.name);
    return slug === wanted || name === wanted;
  });

  return matches.map(category => category.id);
}

async function fetchPosts({ page = 1, filter = 'all', query = '', signal } = {}) {
  const url = new URL(WORDPRESS_POSTS_API);
  const categoryIds = await getCategoryIds(filter);
  const fallbackSearch = !categoryIds.length && filter !== 'all'
    ? FILTER_FALLBACK_SEARCH[filter] || filter.replace(/-/g, ' ')
    : '';

  url.searchParams.set('_embed', '1');
  url.searchParams.set('per_page', String(POSTS_PER_PAGE));
  url.searchParams.set('page', String(page));
  url.searchParams.set('orderby', 'date');
  url.searchParams.set('order', 'desc');

  if (categoryIds.length) {
    url.searchParams.set('categories', categoryIds.join(','));
  }

  const search = [query, fallbackSearch].filter(Boolean).join(' ').trim();
  if (search) {
    url.searchParams.set('search', search);
  }

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`WordPress returned ${response.status}`);
  return {
    posts: await response.json(),
    totalPages: Number(response.headers.get('X-WP-TotalPages') || page)
  };
}

async function loadListingPosts() {
  const grid = $('[data-wp-posts-grid]');
  if (!grid) return;

  const loadMore = $('[data-wp-load-more]');
  const filterButtons = $$('.filter-pill');
  const searchInput = $('#insight-search');
  let page = 1;
  let totalPages = 1;
  let activeFilter = $('.filter-pill.active')?.dataset.filter || 'all';
  let searchQuery = (searchInput?.value || '').trim();
  let requestId = 0;
  let abortController;

  const renderPage = async append => {
    const currentRequest = requestId + 1;
    requestId = currentRequest;
    abortController?.abort();
    abortController = new AbortController();

    if (!append) {
      page = 1;
      totalPages = 1;
      setListingState('Loading insights...');
      setLoadMoreState(loadMore, { hidden: true, disabled: true, text: 'Loading...' });
    } else {
      setLoadMoreState(loadMore, { hidden: false, disabled: true, text: 'Loading...' });
    }

    const result = await fetchPosts({
      page,
      filter: activeFilter,
      query: searchQuery,
      signal: abortController.signal
    });

    if (currentRequest !== requestId) return;
    totalPages = result.totalPages;

    if (!append) {
      renderFeaturedPost(result.posts[0]);
      grid.innerHTML = '';
    }

    result.posts.forEach((post, index) => grid.appendChild(createCard(post, grid.children.length + index)));

    if (!grid.children.length) {
      const emptyFilter = activeFilter === 'all'
        ? ''
        : ` in ${$('.filter-pill.active')?.textContent?.trim() || 'this category'}`;
      const emptySearch = searchQuery ? ` for "${searchQuery}"` : '';
      setListingState(`No insights found${emptyFilter}${emptySearch}.`);
    }

    setLoadMoreState(loadMore, {
      hidden: !result.posts.length || page >= totalPages,
      disabled: false,
      text: 'Load more insights'
    });
  };

  const resetAndLoad = async () => {
    activeFilter = $('.filter-pill.active')?.dataset.filter || 'all';
    searchQuery = (searchInput?.value || '').trim();
    try {
      await renderPage(false);
    } catch (error) {
      if (error.name === 'AbortError') return;
      setListingState('Insights could not be loaded right now. Please try again shortly.', true);
      setLoadMoreState(loadMore, { hidden: true, disabled: false });
    }
  };

  let searchTimer;
  const scheduleSearch = () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(resetAndLoad, 350);
  };

  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      if (button.classList.contains('active')) return;
      filterButtons.forEach(current => current.classList.remove('active'));
      button.classList.add('active');
      resetAndLoad();
    });
  });

  searchInput?.addEventListener('input', scheduleSearch);

  try {
    await renderPage(false);
    loadMore?.addEventListener('click', async () => {
      if (page >= totalPages) {
        setLoadMoreState(loadMore, { hidden: true, disabled: false });
        return;
      }

      page += 1;
      try {
        await renderPage(true);
      } catch (error) {
        if (error.name === 'AbortError') return;
        page -= 1;
        setLoadMoreState(loadMore, { hidden: false, disabled: false, text: 'Try again' });
      }
    });
  } catch (error) {
    if (error.name === 'AbortError') return;
    setListingState('Insights could not be loaded right now. Please try again shortly.', true);
    setLoadMoreState(loadMore, { hidden: true, disabled: false });
  }
}

async function loadSinglePost() {
  const body = $('.article-body');
  const hero = $('.article-hero-main');
  if (!body || !hero) return;

  const params = new URLSearchParams(location.search);
  const isDynamicBlogPage = location.pathname.includes('/insights/blog/');
  const slug = params.get('slug') || location.pathname.split('/').filter(Boolean).at(-1);
  if (!isDynamicBlogPage && !location.pathname.includes('/insights/shopify-migration-checklist-2026/')) return;
  if (!slug || slug === 'blog') {
    renderSinglePostError('No blog post was selected.');
    return;
  }

  let response = await fetch(`${WORDPRESS_POSTS_API}?_embed&slug=${encodeURIComponent(slug)}`);
  if (!response.ok) throw new Error(`WordPress returned ${response.status}`);
  let post = (await response.json())[0];
  if (!post && slug.endsWith('-2026')) {
    response = await fetch(`${WORDPRESS_POSTS_API}?_embed&slug=${encodeURIComponent(slug.replace(/-2026$/, ''))}`);
    if (!response.ok) throw new Error(`WordPress returned ${response.status}`);
    post = (await response.json())[0];
  }
  if (!post) {
    renderSinglePostError('This blog post could not be found.');
    return;
  }

  const category = getCategory(post);
  document.title = `${htmlToText(post.title.rendered)} | Swishtag`;
  const description = $('meta[name="description"]');
  if (description) description.setAttribute('content', htmlToText(post.excerpt.rendered));
  const canonical = $('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', `${location.origin}/insights/blog/?slug=${encodeURIComponent(post.slug)}`);
  const metaUpdates = {
    'og:title': htmlToText(post.title.rendered),
    'og:description': htmlToText(post.excerpt.rendered),
    'og:url': `${location.origin}/insights/blog/?slug=${encodeURIComponent(post.slug)}`
  };
  Object.entries(metaUpdates).forEach(([property, content]) => {
    const tag = $(`meta[property="${property}"]`);
    if (tag) tag.setAttribute('content', content);
  });
  const schema = $('script[type="application/ld+json"]');
  if (schema) {
    schema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: htmlToText(post.title.rendered),
      datePublished: post.date,
      dateModified: post.modified,
      author: { '@type': 'Organization', name: 'Swishtag' },
      publisher: { '@type': 'Organization', name: 'Swishtag' },
      mainEntityOfPage: `${location.origin}/insights/blog/?slug=${encodeURIComponent(post.slug)}`
    });
  }

  const breadcrumbTitle = $('.article-hero .breadcrumbs span:last-child');
  if (breadcrumbTitle) breadcrumbTitle.textContent = htmlToText(post.title.rendered);
  const breadcrumbCategory = $('.article-hero .breadcrumbs a:nth-of-type(2)');
  if (breadcrumbCategory) breadcrumbCategory.textContent = category.name;
  $('.eyebrow', hero).textContent = category.name;
  $('h1', hero).textContent = decodeHtml(htmlToText(post.title.rendered));
  $('.article-dek', hero).textContent = htmlToText(post.excerpt.rendered);

  const heroMeta = $('.hero-meta', hero);
  if (heroMeta) {
    heroMeta.innerHTML = '';
    ['Swishtag Team', formatDate(post.date, { month: 'long', day: 'numeric', year: 'numeric' }), estimateReadTime(post)].forEach(value => {
      const span = document.createElement('span');
      span.textContent = value;
      heroMeta.appendChild(span);
    });
  }

  const image = getFeaturedImage(post);
  const featuredImage = $('.featured-article-image');
  if (featuredImage && image) {
    featuredImage.innerHTML = '';
    const img = document.createElement('img');
    img.src = image;
    img.alt = htmlToText(post.title.rendered);
    featuredImage.appendChild(img);
  }

  const dynamicWrapper = document.createElement('div');
  dynamicWrapper.innerHTML = post.content.rendered;
  prepareArticleContent(dynamicWrapper);
  body.innerHTML = '';
  body.appendChild(dynamicWrapper);
  renderTableOfContents(body);
  initTocObserver();
}

function renderSinglePostError(message) {
  const body = $('.article-body');
  const hero = $('.article-hero-main');
  if (hero) {
    $('.eyebrow', hero).textContent = 'INSIGHTS';
    $('h1', hero).textContent = 'Insight unavailable';
    $('.article-dek', hero).textContent = message;
  }
  if (body) body.innerHTML = `<div class="takeaway"><strong>Sorry about that.</strong>${message}</div>`;
}

function prepareArticleContent(wrapper) {
  $$('script, style, iframe', wrapper).forEach(element => element.remove());
  $$('#ez-toc-container', wrapper).forEach(element => element.remove());
  $$('img', wrapper).forEach(image => {
    const lazySrc = image.dataset.src || image.dataset.lazySrc || image.getAttribute('data-original');
    const lazySrcset = image.dataset.srcset || image.dataset.lazySrcset;
    const lazySizes = image.dataset.sizes;
    const currentSrc = image.getAttribute('src') || '';

    if (lazySrc && (!currentSrc || currentSrc.startsWith('data:image'))) {
      image.src = lazySrc;
    }
    if (lazySrcset && !image.getAttribute('srcset')) {
      image.setAttribute('srcset', lazySrcset);
    }
    if (lazySizes && !image.getAttribute('sizes')) {
      const sizes = lazySizes.replace(/^auto,\s*/i, '').trim();
      if (sizes && sizes !== 'auto') image.setAttribute('sizes', sizes);
    }

    image.loading = 'lazy';
    image.decoding = 'async';
    image.classList.remove('lazyload', 'lazyloaded');
    image.removeAttribute('data-src');
    image.removeAttribute('data-srcset');
    image.removeAttribute('data-sizes');
    image.removeAttribute('data-lazy-src');
    image.removeAttribute('data-lazy-srcset');
    image.removeAttribute('data-original');
  });
  $$('a[href]', wrapper).forEach(link => {
    try {
      const url = new URL(link.getAttribute('href'), location.href);
      if (url.hostname === 'swishtag.com' && url.pathname.startsWith('/blogs/')) {
        const slug = url.pathname.split('/').filter(Boolean).at(-1);
        if (slug) link.href = `/insights/blog/?slug=${encodeURIComponent(slug)}`;
      }
    } catch (error) {}
  });
}

function renderTableOfContents(body) {
  const headings = $$('h2', body).slice(0, 8);
  const toc = $('.toc');
  const mobileToc = $('.toc-mobile div');
  const mobileSummary = $('.toc-mobile summary');

  if (!headings.length) {
    if (toc) toc.hidden = true;
    if ($('.toc-mobile')) $('.toc-mobile').hidden = true;
    return;
  }

  const links = headings.map((heading, index) => {
    if (!heading.id) heading.id = `section-${index + 1}`;
    const a = document.createElement('a');
    a.href = `#${heading.id}`;
    a.textContent = heading.textContent;
    return a;
  });

  if (toc) {
    toc.hidden = false;
    toc.innerHTML = '<h4>In this insight</h4>';
    links.forEach(link => toc.appendChild(link.cloneNode(true)));
  }

  if (mobileToc) {
    if (mobileSummary) mobileSummary.textContent = 'In this insight';
    mobileToc.innerHTML = '';
    links.forEach(link => mobileToc.appendChild(link.cloneNode(true)));
    $('.toc-mobile').hidden = false;
  }
}

loadListingPosts();
loadSinglePost().catch(() => {});

// Reading progress
const progress = $('.progress');
if (progress) {
  window.addEventListener('scroll', () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const value = max > 0 ? (doc.scrollTop / max) * 100 : 0;
    progress.style.width = `${value}%`;
  }, { passive: true });
}

// TOC active state
function initTocObserver() {
  if (tocObserver) tocObserver.disconnect();
  const tocLinks = $$('.toc a');
  const sections = tocLinks.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  if (!sections.length) return;

  tocObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      tocLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
    });
  }, { rootMargin: '-28% 0px -62% 0px', threshold: 0.01 });
  sections.forEach(section => tocObserver.observe(section));
}
initTocObserver();

// FAQ
$$('.faq-question').forEach(button => {
  button.addEventListener('click', () => {
    const item = button.closest('.faq-item');
    const open = item.classList.toggle('open');
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
});
