// Remote job finder: pulls live jobs from public job-board APIs/feeds and
// filters them for WordPress / Shopify skills + chosen region.
import { UA } from './detect.js';
import { scoreJob, eligibility, applyEmailFrom } from './apply.js';

const H = { 'User-Agent': UA, Accept: 'application/json, application/rss+xml, text/xml, */*' };

async function getJSON(url) {
  const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
async function getText(url) {
  const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}
const strip = (s = '') => String(s).replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();

// ---------- Sources ----------
async function remotive(kw) {
  const j = await getJSON(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(kw)}&limit=100`);
  return (j.jobs || []).map((x) => ({
    title: x.title, company: x.company_name, location: x.candidate_required_location || 'Remote',
    salary: x.salary || '', type: x.job_type || '', tags: x.tags || [], date: x.publication_date,
    url: x.url, description: strip(x.description).slice(0, 4000), source: 'Remotive',
  }));
}
async function remoteok(kw) {
  const j = await getJSON(`https://remoteok.com/api?tag=${encodeURIComponent(kw)}`);
  return (Array.isArray(j) ? j : []).filter((x) => x && x.position).map((x) => ({
    title: x.position, company: x.company, location: x.location || 'Worldwide',
    salary: x.salary_min ? `$${x.salary_min.toLocaleString()} - $${(x.salary_max || x.salary_min).toLocaleString()}` : '',
    type: '', tags: x.tags || [], date: x.date, url: x.url || `https://remoteok.com/remote-jobs/${x.id}`,
    description: strip(x.description).slice(0, 4000), source: 'RemoteOK',
  }));
}
async function jobicy(kw) {
  const j = await getJSON(`https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(kw)}`);
  return (j.jobs || []).map((x) => ({
    title: strip(x.jobTitle), company: x.companyName, location: x.jobGeo || 'Anywhere',
    salary: x.annualSalaryMin ? `${x.salaryCurrency || '$'} ${x.annualSalaryMin} - ${x.annualSalaryMax || ''}/yr` : '',
    type: (x.jobType || []).join(', '), tags: [].concat(x.jobIndustry || []), date: x.pubDate, url: x.url,
    description: strip(x.jobExcerpt || x.jobDescription).slice(0, 4000), source: 'Jobicy',
  }));
}
async function weworkremotely() {
  const feeds = [
    'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss',
    'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss',
    'https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss',
    'https://weworkremotely.com/categories/remote-design-jobs.rss',
    'https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss',
  ];
  const all = [];
  for (const f of feeds) {
    try {
      const xml = await getText(f);
      for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
        const it = m[1];
        const g = (tag) => (it.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`)) || [])[1] || '';
        const raw = strip(g('title'));
        const [company, ...rest] = raw.split(':');
        all.push({
          title: rest.join(':').trim() || raw, company: rest.length ? company.trim() : '', location: strip(g('region')) || 'Anywhere',
          salary: '', type: strip(g('type')), tags: [strip(g('category'))], date: g('pubDate'), url: strip(g('link')),
          description: strip(g('description')).slice(0, 4000), source: 'WeWorkRemotely',
        });
      }
    } catch { /* skip feed */ }
  }
  return all;
}
async function arbeitnow(includeOnsite = false) {
  const all = [];
  for (let p = 1; p <= 3; p++) {
    const j = await getJSON(`https://www.arbeitnow.com/api/job-board-api?page=${p}`);
    for (const x of j.data || []) {
      if (!includeOnsite && !x.remote) continue;
      all.push({
        title: x.title, company: x.company_name, location: (x.remote ? 'Remote · ' : '') + (x.location || 'Remote'), salary: '',
        type: (x.job_types || []).join(', '), tags: x.tags || [], date: new Date(x.created_at * 1000).toISOString(),
        url: x.url, description: strip(x.description).slice(0, 4000), source: 'Arbeitnow',
      });
    }
  }
  return all;
}
async function himalayas() {
  const all = [];
  for (let off = 0; off < 300; off += 20) {
    const j = await getJSON(`https://himalayas.app/jobs/api?limit=20&offset=${off}`);
    for (const x of j.jobs || []) {
      all.push({
        title: x.title, company: x.companyName, location: (x.locationRestrictions || []).join(', ') || 'Worldwide',
        salary: x.minSalary ? `${x.currency || '$'} ${x.minSalary} - ${x.maxSalary || ''}` : '', type: x.employmentType || '',
        tags: [...(x.categories || []), ...(x.skills || [])], date: x.pubDate ? new Date(x.pubDate * 1000).toISOString() : '',
        url: x.applicationLink || `https://himalayas.app/jobs`, description: strip(x.excerpt || x.description).slice(0, 4000), source: 'Himalayas',
      });
    }
    if (!(j.jobs || []).length) break;
  }
  return all;
}

// ---------- Region filter ----------
export const REGIONS = {
  any: null,
  usa: /\b(usa|u\.s\.|united states|us only|us-based|america|north america|est|pst|cst)\b/i,
  uae_dubai: /\b(uae|dubai|abu dhabi|united arab emirates|middle east|mena|gcc|gulf|sharjah)\b/i,
  uk: /\b(uk|united kingdom|england|london|britain|gmt)\b/i,
  europe: /\b(europe|eu|emea|germany|france|spain|netherlands|poland|portugal|cet|italy|ireland)\b/i,
  canada: /\b(canada|toronto|vancouver)\b/i,
  australia: /\b(australia|new zealand|apac|sydney|melbourne)\b/i,
  india: /\b(india|ist|indore|mumbai|delhi|bangalore|bengaluru|pune|hyderabad|chennai|noida|gurgaon)\b/i,
  india_asia: /\b(india|asia|apac|ist|pakistan|bangladesh|philippines|singapore|south asia)\b/i,
  latam: /\b(latam|latin america|brazil|mexico|argentina|colombia)\b/i,
};
const WORLDWIDE = /\b(anywhere|worldwide|global|remote|world)\b/i;

function normalizeType(j) {
  const s = `${j.type || ''} ${j.title || ''} ${(j.description || '').slice(0, 350)}`.toLowerCase();
  if (/full[-_\s]?time|permanent/.test(s)) return 'Full-Time';
  if (/part[-_\s]?time/.test(s)) return 'Part-Time';
  if (/contract|freelance|consultant/.test(s)) return 'Contract';
  return j.type || 'Full-Time / Unspecified';
}

/**
 * opts: { keywords: string[], region, includeWorldwide, strict, jobType, workMode }
 */
export async function findJobs({ keywords = ['wordpress', 'shopify'], region = 'any', includeWorldwide = true, strict = true, jobType = 'all', workMode = 'remote', profile = null, onProgress = () => {} }) {
  const kws = keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
  const tasks = [
    ...kws.map((k) => ['Remotive: ' + k, () => remotive(k)]),
    ...kws.map((k) => ['RemoteOK: ' + k, () => remoteok(k)]),
    ...kws.map((k) => ['Jobicy: ' + k, () => jobicy(k)]),
    ['WeWorkRemotely', weworkremotely],
    ['Arbeitnow', () => arbeitnow(workMode === 'all')],
    ['Himalayas', himalayas],
  ];
  const sourceStatus = [];
  const results = await Promise.all(tasks.map(async ([name, fn]) => {
    try {
      const r = await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 45000).unref())]);
      sourceStatus.push({ name, ok: true, count: r.length });
      onProgress({ msg: `✔ ${name}: ${r.length} jobs fetched` });
      return r;
    } catch (e) {
      sourceStatus.push({ name, ok: false, error: e.message });
      onProgress({ msg: `✖ ${name}: ${e.message}` });
      return [];
    }
  }));

  const re = new RegExp(`\\b(${kws.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'i');
  const regionRe = REGIONS[region] || null;
  const seen = new Set();
  const jobs = [];
  for (const j of results.flat()) {
    if (!j.title || !j.url) continue;
    const head = `${j.title} ${j.tags.join(' ')}`;
    const inTitle = re.test(j.title);
    const inTags = re.test(j.tags.join(' '));
    const descHits = (j.description.match(new RegExp(re.source, 'gi')) || []).length;
    // Strong = skill in job title. Medium = in tags AND description, or mentioned 2+ times in description.
    const strong = inTitle;
    const medium = !strong && ((inTags && descHits >= 1) || descHits >= 2);
    const weak = !strong && !medium && (inTags || descHits >= 1);
    if (!(strong || medium || (!strict && weak))) continue;
    const inHead = strong;
    if (regionRe) {
      const loc = j.location || '';
      const regionMatch = regionRe.test(loc) || regionRe.test(j.title);
      const ww = WORLDWIDE.test(loc) && !/only/i.test(loc);
      if (!regionMatch && !(includeWorldwide && ww)) continue;
    }
    const key = (j.title + '|' + j.company).toLowerCase().replace(/\W+/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    const normType = normalizeType(j);
    if (jobType === 'full_time' && normType !== 'Full-Time') continue;
    if (jobType === 'contract' && normType !== 'Contract') continue;
    if (jobType === 'part_time' && normType !== 'Part-Time') continue;
    const matched = [...new Set((head + ' ' + j.description).toLowerCase().match(new RegExp(re.source, 'gi')) || [])];
    const extra = profile ? { ...scoreJob(j, profile, j.description), eligibility: eligibility(j, j.description), applyEmail: applyEmailFrom(j.description) } : {};
    jobs.push({ ...j, type: normType, matched, ...extra, relevance: inHead ? 'Strong' : medium ? 'Medium' : 'Weak', description: j.description.slice(0, 1500) });
  }
  const rank = { Strong: 0, Medium: 1, Weak: 2 };
  const el = { Eligible: 0, Check: 1, Restricted: 2 };
  jobs.sort((a, b) => (el[a.eligibility] ?? 0) - (el[b.eligibility] ?? 0) || (b.score ?? 0) - (a.score ?? 0) || rank[a.relevance] - rank[b.relevance] || (new Date(b.date) - new Date(a.date) || 0));
  return { jobs, sources: sourceStatus };
}
