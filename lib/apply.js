// Apply assistant: profile, job match score, eligibility, cover letters,
// client pitch emails and an application tracker (stored in ./data).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const PROFILE_FILE = path.join(DATA, 'profile.json');
const APPS_FILE = path.join(DATA, 'applications.json');

// Built from the uploaded resume (Praveen-Pathak-Sr.WebDesigner.docx). Editable in the UI.
export const DEFAULT_PROFILE = {
  name: 'Praveen Pathak',
  title: 'Senior Web Designer (WordPress & Shopify)',
  email: 'parvpathak12@gmail.com',
  phone: '+91 8109567672',
  location: 'Indore, India (IST, UTC+5:30)',
  years: '14.5',
  linkedin: '',
  portfolio: '',
  resumeFile: 'data/Praveen-Pathak-Sr.WebDesigner.docx',
  skills: ['WordPress', 'Shopify', 'HTML5', 'CSS3', 'Bootstrap', 'Responsive Design', 'JavaScript', 'jQuery', 'Angular', 'Figma', 'Photoshop', 'Illustrator', 'InDesign', 'CorelDraw', 'Landing Pages', 'Logo Design', 'Banner Design', 'Team Lead'],
  projects: [
    { name: 'Amipi Inc. (jewelry e-commerce)', url: 'https://www.amipi.com/', tags: ['ecommerce', 'jewelry', 'bootstrap'] },
    { name: 'Simplex Diam (diamond store)', url: 'https://shop.simplexdiam.com/', tags: ['ecommerce', 'jewelry'] },
    { name: 'Brilliant Touch LLC', url: 'https://brillianttouchllc.com/', tags: ['ecommerce', 'jewelry'] },
    { name: 'Raybar Fine Jewelry', url: 'https://www.raybarfinejewelry.com/', tags: ['wordpress', 'jewelry', 'woocommerce'] },
    { name: 'ProGlove', url: 'https://www.proglove.com/de/', tags: ['wordpress', 'corporate'] },
    { name: 'Seattle Fish', url: 'https://www.seattlefish.com/', tags: ['wordpress', 'restaurant', 'food'] },
    { name: 'I Data Medical', url: 'http://idatamedical.com/', tags: ['wordpress', 'medical'] },
    { name: 'Ranveer Realty', url: 'https://ranveerrealty.com/', tags: ['wordpress', 'real estate', 'estate_agent', 'property'] },
  ],
  rateNote: 'Open to full-time, part-time and contract roles; flexible to overlap with US / UK / UAE hours.',
};

async function readJSON(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}
async function writeJSON(file, data) {
  await mkdir(DATA, { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2));
}
export const getProfile = () => readJSON(PROFILE_FILE, DEFAULT_PROFILE);
export const saveProfile = (p) => writeJSON(PROFILE_FILE, { ...DEFAULT_PROFILE, ...p });
export const getApplications = () => readJSON(APPS_FILE, []);
export async function upsertApplication(app) {
  const apps = await getApplications();
  const i = apps.findIndex((a) => a.url === app.url);
  const rec = { ...(i >= 0 ? apps[i] : { createdAt: new Date().toISOString() }), ...app, updatedAt: new Date().toISOString() };
  if (i >= 0) apps[i] = rec; else apps.unshift(rec);
  await writeJSON(APPS_FILE, apps);
  return rec;
}
export async function deleteApplication(url) {
  await writeJSON(APPS_FILE, (await getApplications()).filter((a) => a.url !== url));
}

// ---------- Matching ----------
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function scoreJob(job, profile, fullText) {
  const text = `${job.title} ${job.tags.join(' ')} ${fullText}`.toLowerCase();
  const title = job.title.toLowerCase();
  const hits = profile.skills.filter((s) => new RegExp(`\\b${esc(s.toLowerCase())}`).test(text));
  let score = Math.min(60, hits.length * 8);
  if (/wordpress|shopify|woocommerce|elementor/.test(title)) score += 25;
  if (/designer|front.?end|web developer|ui|theme|landing/.test(title)) score += 15;
  if (/senior|lead|sr\.?/.test(title)) score += 5;
  // penalise stacks not in the profile
  if (/\b(java|golang|rust|kotlin|devops|data engineer|machine learning|ios|android|sales|account executive|recruiter)\b/.test(title)) score -= 30;
  return { score: Math.max(0, Math.min(100, score)), skillHits: hits };
}

export function eligibility(job, fullText) {
  const loc = (job.location || '').toLowerCase();
  const t = `${job.title} ${fullText}`.toLowerCase();
  if (/(india|asia|apac|ist\b|anywhere|worldwide|global|world)/.test(loc) && !/(us|usa|uk|eu|canada) only/.test(loc)) return 'Eligible';
  if (/(must (be|reside|live) in the (us|united states|uk|eu)|us citizens? only|authorized to work in the (us|united states)|u\.s\. based|us-based|green card|security clearance)/.test(t)) return 'Restricted';
  if (/\bonly\b/.test(loc) || /^(usa|united states|us|uk|united kingdom|canada|germany|europe)\b/.test(loc)) return 'Restricted';
  return 'Check';
}

export function applyEmailFrom(fullText) {
  const m = fullText.match(/(?:send|email|apply|cv|resume|contact)[^.\n]{0,80}?([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i)
    || fullText.match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
  if (!m) return '';
  return /no-?reply|example\.com|sentry|wixpress/i.test(m[1]) ? '' : m[1];
}

// ---------- Writing ----------
function pickProjects(profile, text, n = 3) {
  let t = text.toLowerCase();
  if (/shopify|woocommerce|store|e-?commerce|shop\b|jewel|retail|clothing|boutique/.test(t)) t += ' ecommerce';
  if (/restaurant|cafe|food|bakery/.test(t)) t += ' food restaurant';
  return [...profile.projects]
    .map((p) => ({ p, s: p.tags.filter((tag) => t.includes(tag)).length }))
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.p);
}

export function coverLetter(job, profile) {
  const text = `${job.title} ${job.tags.join(' ')} ${job.description || ''}`;
  const skills = (job.skillHits && job.skillHits.length ? job.skillHits : ['WordPress', 'Shopify', 'HTML5', 'CSS3']).slice(0, 6).join(', ');
  const projects = pickProjects(profile, text).map((p) => `• ${p.name} – ${p.url}`).join('\n');
  const isShopify = /shopify|liquid/i.test(text);
  const isWP = /wordpress|woocommerce|elementor/i.test(text);
  const focus = isShopify && isWP ? 'WordPress and Shopify' : isShopify ? 'Shopify' : isWP ? 'WordPress' : 'web design and front-end';
  const subject = `Application: ${job.title} – ${profile.name} (${profile.years}+ yrs ${focus})`;
  const body = `Hi ${job.company ? job.company + ' ' : ''}Hiring Team,

I'm writing to apply for the ${job.title} role. I'm a ${profile.title} with ${profile.years} years of hands-on experience designing and building responsive, conversion-focused websites, with strong expertise in ${skills}.

What I can bring to your team:
• ${focus} builds from design to launch – custom themes, landing pages and store front-ends that work perfectly on desktop, tablet and mobile
• Pixel-perfect conversion of Figma / Photoshop designs into clean HTML5, CSS3, Bootstrap and JavaScript/jQuery
• Graphic design skills (logos, banners, marketing creatives), so design and development stay consistent
• Experience leading junior designers and managing projects end-to-end

A few websites I've worked on:
${projects}

I work remotely from ${profile.location} and am ${profile.rateNote.charAt(0).toLowerCase() + profile.rateNote.slice(1)}
${profile.portfolio ? `\nPortfolio: ${profile.portfolio}` : ''}${profile.linkedin ? `\nLinkedIn: ${profile.linkedin}` : ''}
My resume is attached. I'd love to discuss how I can help ${job.company || 'your team'}.

Best regards,
${profile.name}
${profile.email} | ${profile.phone}`;
  return { subject, body };
}

const NICHE_LABEL = {
  estate_agent: 'real estate agency', real_estate: 'real estate business',
  restaurant: 'restaurant', cafe: 'cafe', fast_food: 'food brand',
  jewelry: 'jewelry brand', watches: 'watch & jewelry brand',
  clothes: 'fashion brand', boutique: 'boutique', shoes: 'footwear brand',
  hairdresser: 'salon', beauty: 'beauty studio', spa: 'spa & wellness center',
  hotel: 'hotel', fitness_centre: 'fitness studio', bakery: 'bakery',
  dentist: 'dental clinic', clinic: 'clinic', lawyers: 'law firm', lawyer: 'law firm',
  architect: 'architecture studio', travel_agency: 'travel agency',
};

function humanIssue(op) {
  if (/Missing SEO meta/i.test(op)) return 'No Google meta description — Google shows random text instead of a strong call-to-action to click your site';
  if (/Missing H1/i.test(op)) return 'Missing main H1 heading — weakens your Google ranking against local competitors';
  if (/OpenGraph/i.test(op)) return 'No WhatsApp/social preview tags — shared links look plain without a clean title & preview image';
  if (/No SSL/i.test(op)) return 'Browser shows a "Not Secure" warning — this immediately hurts visitor trust';
  if (/mobile responsive/i.test(op)) return 'Not mobile-friendly — 70%+ visitors browsing on phones struggle to navigate';
  if (/Slow load/i.test(op)) return `${op} — slow pages cause potential customers to leave before the site opens`;
  if (/Heavy homepage/i.test(op)) return 'Heavy homepage (>2.5MB) — slows down mobile loading and hurts Google PageSpeed';
  if (/Old copyright/i.test(op)) return `${op} — can make the business look inactive to new visitors`;
  if (/no online store/i.test(op)) return 'No direct online ordering/checkout — customers cannot buy or book directly on the site';
  if (/Migration lead/i.test(op)) return `${op} — upgrading gives you much better SEO, speed, and custom design control`;
  if (/DOWN/i.test(op)) return 'Your website was unreachable when checked — you may be losing active enquiries right now';
  return op;
}

export function pitchEmail(lead, profile) {
  const issues = (lead.opportunities || []).slice(0, 3);
  const plat = ['WordPress', 'Shopify'].includes(lead.platform) ? lead.platform : 'WordPress / Shopify';
  const domain = lead.website ? lead.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : '';
  const niche = NICHE_LABEL[lead.category] || (lead.category ? lead.category.replace(/_/g, ' ') : 'business');
  const subject = domain
    ? `Quick fix for ${domain} (more leads from Google & mobile)`
    : `Quick website idea for ${lead.name}`;
  const bullets = issues.map((i) => '• ' + humanIssue(i)).join('\n');
  const projects = pickProjects(profile, `${lead.category} ${niche} ${lead.platform}`, 2)
    .map((p) => `• ${p.name} — ${p.url}`).join('\n');

  const body = `Hi ${lead.name} Team,

I was looking at ${domain || lead.name} earlier — you have a great ${niche}, and your brand already stands out locally.

${issues.length
    ? `While reviewing your ${plat} site, I spotted ${issues.length === 1 ? 'one quick issue' : `${issues.length} quick issues`} that may be quietly costing you enquiries:\n${bullets}\n`
    : `I noticed a few easy design & conversion upgrades on your ${plat} site that could help turn more visitors into enquiries.\n`}
I'm ${profile.name}, a ${profile.title} with ${profile.years}+ years of experience helping brands improve speed, Google visibility, and conversions. A couple of sites I've worked on:
${projects}

${lead.platform === 'No website'
    ? 'I can design and launch a fast, mobile-ready website for you in days so customers can find and contact you easily.'
    : `I can clean these up on your ${plat} site quickly without disrupting your live website.`}

Want me to send over a free 2-minute breakdown of how to fix these? (No obligation — happy to help!)

Best regards,
${profile.name}
${profile.email} | ${profile.phone}${profile.linkedin ? `\nLinkedIn: ${profile.linkedin}` : ''}

(If this isn't relevant right now, just reply "no" and I won't follow up.)`;
  const topIssue = issues[0] ? `noticed ${issues[0].toLowerCase()}` : `had a quick ${plat} growth idea`;
  const linkedinNote = `Hi! Checked ${lead.name}'s site & ${topIssue}. I'm a Sr. Web Designer (${profile.years}+ yrs in WordPress/Shopify) — happy to share a quick 2-min fix idea. Let's connect!`.slice(0, 295);
  return { subject, body, linkedinNote };
}
