// Website analyzer: detects platform (WordPress / Shopify / others), extracts
// contact details and lists sales "opportunities" (problems you can pitch).

export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const PLATFORM_RULES = [
  { name: 'Shopify', test: (h, hd) => /cdn\.shopify\.com|Shopify\.theme|myshopify\.com|shopify-section/i.test(h) || !!hd['x-shopid'] || !!hd['x-shopify-stage'] || /shopify/i.test(hd['powered-by'] || '') },
  { name: 'WordPress', test: (h, hd) => /\/wp-content\/|\/wp-includes\/|<meta[^>]+generator[^>]+WordPress/i.test(h) || /api\.w\.org/i.test(hd['link'] || '') },
  { name: 'Wix', test: (h) => /static\.wixstatic\.com|wix-code|_wixCIDX|X-Wix/i.test(h) },
  { name: 'Squarespace', test: (h) => /static1\.squarespace\.com|Squarespace\.Constants|squarespace-cdn/i.test(h) },
  { name: 'Webflow', test: (h) => /webflow\.(js|com)|data-wf-page/i.test(h) },
  { name: 'GoDaddy Builder', test: (h) => /img1\.wsimg\.com|godaddy website builder/i.test(h) },
  { name: 'BigCommerce', test: (h) => /cdn\d*\.bigcommerce\.com|bigcommerce/i.test(h) },
  { name: 'Magento', test: (h) => /Mage\.Cookies|\/static\/version\d+|magento/i.test(h) },
  { name: 'Joomla', test: (h) => /<meta[^>]+generator[^>]+Joomla/i.test(h) },
  { name: 'Drupal', test: (h) => /<meta[^>]+generator[^>]+Drupal|drupal-settings-json/i.test(h) },
  { name: 'Laravel', test: (h, hd) => /laravel_session|XSRF-TOKEN/i.test(hd['set-cookie'] || '') || /wire:id|\/vendor\/laravel|livewire\.js/i.test(h) || (/<meta[^>]+name=["']csrf-token["']/i.test(h) && /php/i.test(hd['x-powered-by'] || '')) },
  { name: 'CodeIgniter', test: (h, hd) => /ci_session/i.test(hd['set-cookie'] || '') || /codeigniter/i.test(h) },
  { name: 'PHP', test: (h, hd) => /php/i.test(hd['x-powered-by'] || '') || /PHPSESSID/i.test(hd['set-cookie'] || '') || /\.php(?:[?"'#]|$)/i.test(h) },
  { name: 'Next.js / React', test: (h) => /__NEXT_DATA__|_next\/static|data-reactroot|react-dom/i.test(h) },
  { name: 'Angular', test: (h) => /ng-version=|ng-app=/i.test(h) },
  { name: 'Vue / Nuxt', test: (h) => /__NUXT__|data-v-[a-f0-9]+/i.test(h) },
  { name: 'Bootstrap / HTML', test: (h) => /bootstrap(?:\.min)?\.(?:css|js)/i.test(h) },
];

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}/g;
const BAD_EMAIL = /\.(png|jpe?g|gif|webp|svg|css|js)$|example\.|sentry|wixpress|domain\.com|email\.com|yourname|@2x|u003e|godaddy|schema\.org/i;

function normalizeUrl(url) {
  let u = String(url || '').trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u.replace(/^\/\//, '');
  try { return new URL(u).toString(); } catch { return null; }
}

async function fetchPage(url, timeoutMs = 7000) {
  const t0 = Date.now();
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en' },
  });
  const buf = await res.arrayBuffer();
  const html = new TextDecoder('utf-8').decode(buf.slice(0, 1_500_000));
  const headers = {};
  res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
  return { status: res.status, finalUrl: res.url || url, html, headers, ms: Date.now() - t0, bytes: buf.byteLength };
}

function extractEmails(html) {
  const decoded = html.replace(/&#64;|\[at\]|\(at\)/gi, '@').replace(/%40/g, '@');
  const found = new Set();
  for (const m of decoded.matchAll(/mailto:([^"'?>\s]+)/gi)) found.add(decodeURIComponent(m[1]).toLowerCase());
  for (const m of decoded.match(EMAIL_RE) || []) found.add(m.toLowerCase());
  return [...found].filter((e) => !BAD_EMAIL.test(e) && e.length < 80).slice(0, 5);
}

function extractPhones(html) {
  const set = new Set();
  for (const m of html.matchAll(/href=["']tel:([^"']+)["']/gi)) set.add(decodeURIComponent(m[1]).replace(/\s+/g, ' ').trim());
  return [...set].slice(0, 3);
}

function extractSocials(html) {
  const out = {};
  const rules = {
    instagram: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.]+/i,
    facebook: /https?:\/\/(?:www\.|m\.)?facebook\.com\/(?!sharer|tr\?|plugins|dialog)[A-Za-z0-9_.\-\/]+/i,
    linkedin: /https?:\/\/(?:[a-z]+\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9_\-]+/i,
    whatsapp: /https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send)[^"'\s<]*/i,
    tiktok: /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.]+/i,
  };
  for (const [k, re] of Object.entries(rules)) {
    const m = html.match(re);
    if (m) out[k] = m[0];
  }
  return out;
}

function findContactLink(html, base) {
  const m = html.match(/href=["']([^"'#]*(?:contact|kontakt|contacto|get-in-touch|about)[^"'#]*)["']/i);
  if (!m) return null;
  try {
    const u = new URL(m[1], base);
    if (u.hostname !== new URL(base).hostname) return null;
    return u.toString();
  } catch { return null; }
}

function opportunities(page, platform, details) {
  const h = page.html;
  const ops = [];
  if (page.finalUrl.startsWith('http://')) ops.push('No SSL / HTTPS');
  if (!/<meta[^>]+name=["']viewport/i.test(h)) ops.push('Not mobile responsive (no viewport)');
  if (!/<meta[^>]+name=["']description/i.test(h)) ops.push('Missing SEO meta description');
  if (!/<h1[\s>]/i.test(h)) ops.push('Missing H1 heading (SEO issue)');
  if (!/property=["']og:title/i.test(h)) ops.push('No OpenGraph social tags');
  if (page.ms > 4000) ops.push(`Slow load (${(page.ms / 1000).toFixed(1)}s)`);
  if (page.bytes > 2_500_000) ops.push('Heavy homepage (>2.5MB)');
  if (details.wpVersion) {
    const major = parseFloat(details.wpVersion);
    if (major && major < 6.3) ops.push(`Outdated WordPress ${details.wpVersion}`);
  }
  const years = [...h.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d{2})/gi)].map((m) => +m[1]);
  if (years.length) {
    const y = Math.max(...years);
    if (y < new Date().getFullYear() - 1) ops.push(`Old copyright year (${y}) – site not maintained`);
  }
  if (platform === 'Wix' || platform === 'Squarespace' || platform === 'GoDaddy Builder') ops.push(`Migration lead: ${platform} → WordPress/Shopify`);
  if (platform === 'WordPress' && !details.woocommerce && /shop|store|jewel|boutique|cloth|fashion/i.test(h.slice(0, 20000))) ops.push('Sells products but no online store (WooCommerce/Shopify pitch)');
  return ops;
}

export async function analyzeSite(rawUrl, opts = {}) {
  const fallback = { url: rawUrl, finalUrl: null, reachable: false, platform: 'Unknown', theme: '', wpVersion: '', woocommerce: false, emails: [], phones: [], socials: {}, opportunities: [], title: '', error: 'Timeout' };
  let t;
  const hard = new Promise((res) => { t = setTimeout(() => res(fallback), 16000); });
  try { return await Promise.race([analyzeSiteInner(rawUrl, opts), hard]); }
  finally { clearTimeout(t); }
}

async function analyzeSiteInner(rawUrl, { deep = true } = {}) {
  const url = normalizeUrl(rawUrl);
  const result = { url: rawUrl, finalUrl: null, reachable: false, platform: 'Unknown', theme: '', wpVersion: '', woocommerce: false, emails: [], phones: [], socials: {}, opportunities: [], title: '', error: '' };
  if (!url) { result.error = 'Invalid URL'; return result; }

  let page;
  try {
    page = await fetchPage(url);
  } catch (e) {
    try { page = await fetchPage(url.replace(/^https:/, 'http:')); }
    catch (e2) { result.error = (e2.cause && e2.cause.code) || e2.name || 'Fetch failed'; return result; }
  }
  result.reachable = page.status < 500;
  result.finalUrl = page.finalUrl;
  if (page.status >= 400) result.error = `HTTP ${page.status}`;

  const h = page.html;
  for (const rule of PLATFORM_RULES) {
    if (rule.test(h, page.headers)) { result.platform = rule.name; break; }
  }
  result.title = (h.match(/<title[^>]*>([^<]{0,140})/i)?.[1] || '').replace(/\s+/g, ' ').trim();
  result.woocommerce = /woocommerce/i.test(h);
  result.wpVersion = h.match(/<meta[^>]+generator[^>]+WordPress\s*([\d.]+)/i)?.[1] || '';
  if (result.platform === 'WordPress') result.theme = h.match(/\/wp-content\/themes\/([^\/'"?]+)/i)?.[1] || '';
  if (result.platform === 'Shopify') result.theme = h.match(/Shopify\.theme\s*=\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i)?.[1] || '';

  result.emails = extractEmails(h);
  result.phones = extractPhones(h);
  result.socials = extractSocials(h);

  // Visit contact page if no email on the homepage
  if (deep && result.emails.length === 0) {
    const c = findContactLink(h, page.finalUrl);
    if (c) {
      try {
        const cp = await fetchPage(c, 8000);
        result.emails = extractEmails(cp.html);
        if (!result.phones.length) result.phones = extractPhones(cp.html);
        result.socials = { ...extractSocials(cp.html), ...result.socials };
      } catch { /* ignore */ }
    }
  }
  result.opportunities = opportunities(page, result.platform, result);
  return result;
}

// Run async tasks with limited concurrency
export async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await worker(items[idx], idx); } catch (e) { out[idx] = null; }
    }
  });
  await Promise.all(runners);
  return out;
}
