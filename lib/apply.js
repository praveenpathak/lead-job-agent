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
    { name: 'Ranveer Realty', url: 'https://ranveerrealty.com/', tags: ['wordpress', 'real estate'] },
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
  const m = fullText.match(/(?:send|email|apply|cv|resume)[^.]{0,80}?([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i);
  return m ? m[1] : '';
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

export function pitchEmail(lead, profile) {
  const issues = (lead.opportunities || []).slice(0, 3);
  const plat = ['WordPress', 'Shopify'].includes(lead.platform) ? lead.platform : 'WordPress / Shopify';
  const subject = `Quick idea for ${lead.name}'s website`;
  const body = `Hi ${lead.name} Team,

I came across ${lead.website ? lead.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : 'your business'} and really liked your ${lead.category || 'business'}.

${issues.length ? `While checking the site I noticed a few things that could be costing you customers:\n${issues.map((i) => '• ' + i).join('\n')}\n` : `I help ${lead.category || 'local'} businesses get more enquiries and online sales from their ${plat} website.\n`}
I'm a ${profile.title} with ${profile.years}+ years of experience and have built sites for jewelry, food and retail brands, e.g.:
${pickProjects(profile, `${lead.category} ${lead.platform}`, 2).map((p) => `• ${p.name} – ${p.url}`).join('\n')}

I can ${lead.platform === 'No website' ? 'build you a fast, mobile-friendly website' : `fix these on your ${plat} site`} quickly and at a reasonable cost. Would you be open to a short 10-minute call this week?

Best regards,
${profile.name}
${profile.email} | ${profile.phone}

(If you'd prefer not to hear from me again, just reply "no" and I won't follow up.)`;
  return { subject, body };
}
