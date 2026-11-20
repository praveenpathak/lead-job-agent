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
    // Top 5 WordPress
    { name: 'Orbit Local (Marketing & Business)', url: 'https://www.orbitlocal.com/', tags: ['wordpress', 'marketing', 'seo', 'agency', 'business'] },
    { name: 'Hana Hunter Real Estate', url: 'https://hanahunter.com/', tags: ['wordpress', 'real estate', 'estate_agent', 'property'] },
    { name: 'Face Lab Medical Spa', url: 'https://facelabvaldosta.com/', tags: ['wordpress', 'salon', 'beauty', 'spa', 'medical', 'clinic'] },
    { name: 'St. Johns Pediatric Dentistry', url: 'https://stjohnskids.com/', tags: ['wordpress', 'dentist', 'clinic', 'healthcare', 'medical'] },
    { name: 'A Good Electrician LLC', url: 'https://agoodelectricianllc.com/', tags: ['wordpress', 'local', 'service', 'home'] },
    // Top 5 Shopify
    { name: 'The Himalayan Organics', url: 'https://www.thehimalayanorganics.in/', tags: ['shopify', 'ecommerce', 'health', 'organic', 'grocery', 'store'] },
    { name: 'Samaya Jewelry', url: 'https://www.samayajewelry.com/', tags: ['shopify', 'ecommerce', 'jewelry', 'watches', 'luxury'] },
    { name: 'Brilliant Touch LLC', url: 'https://brillianttouchllc.com/', tags: ['shopify', 'ecommerce', 'jewelry', 'diamonds'] },
    { name: 'B Friesian Fine Jewelry', url: 'https://bfriesian.com/', tags: ['shopify', 'ecommerce', 'jewelry', 'vintage'] },
    { name: 'Emma Jewelry USA', url: 'https://emmajewelryusa.com/', tags: ['shopify', 'ecommerce', 'jewelry', 'fashion', 'boutique'] },
  ],
  rateNote: 'Open to full-time, part-time and contract roles; flexible to overlap with US / UK / UAE hours.',
  primaryService: 'web',
  targetNiches: ['restaurant', 'hospital_clinic'],
  targetCity: 'Indore, India',
  gsheetUrl: '',
  gsheetDocUrl: 'https://docs.google.com/spreadsheets/d/1qyaz_ecGGaj80m6r207WKzYuytHO53r91MMnyHWmQBQ/edit?usp=sharing',
  gsheetId: '1qyaz_ecGGaj80m6r207WKzYuytHO53r91MMnyHWmQBQ',
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
export async function upsertApplications(list) {
  const apps = await getApplications();
  const map = new Map(apps.map((a) => [a.url, a]));
  for (const app of list) {
    if (!app || !app.url) continue;
    const prev = map.get(app.url);
    const rec = { ...(prev || { createdAt: new Date().toISOString() }), ...app, updatedAt: app.updatedAt || new Date().toISOString() };
    map.set(app.url, rec);
  }
  const merged = [...map.values()].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  await writeJSON(APPS_FILE, merged);
  return merged;
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
  const wantShopify = /\bshopify\b|liquid/.test(t);
  const wantWP = /\bwordpress\b|\bwoocommerce\b|\belementor\b/.test(t);
  if (/shopify|woocommerce|store|e-?commerce|shop\b|jewel|retail|clothing|boutique/.test(t)) t += ' ecommerce';
  if (/restaurant|cafe|food|bakery/.test(t)) t += ' food restaurant';

  let list = [...profile.projects];
  if (wantShopify && !wantWP) {
    const only = list.filter((p) => p.tags.includes('shopify'));
    if (only.length) list = only;
  } else if (wantWP && !wantShopify) {
    const only = list.filter((p) => p.tags.includes('wordpress'));
    if (only.length) list = only;
  }

  return list
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
  estate_agent: 'real estate agency', real_estate: 'real estate business', property_management: 'property management company',
  roofer: 'roofing company', construction_company: 'construction & roofing business', general_contractor: 'contracting business',
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

export function pitchEmail(lead, profile, tone = 'friendly') {
  const isNoWeb = /no website/i.test(lead.platform) || !lead.website;
  const issues = (lead.opportunities || []).slice(0, 3);
  const plat = ['WordPress', 'Shopify'].includes(lead.platform) ? lead.platform : 'WordPress / Shopify';
  const domain = lead.website ? lead.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : '';
  const niche = NICHE_LABEL[lead.category] || (lead.category ? lead.category.replace(/_/g, ' ') : 'business');
  const isClean = issues.length === 0 && !isNoWeb;
  const auditItems = issues.map((raw) => ({ raw, impact: humanIssue(raw) }));
  const bullets = auditItems.map((x) => '• ' + x.impact).join('\n');
  const projects = pickProjects(profile, `${lead.category} ${niche} ${lead.platform}`, 2)
    .map((p) => `• ${p.name} — ${p.url}`).join('\n');

  let subject = isNoWeb
    ? `Quick website idea for ${lead.name} — get 3x more local customer enquiries`
    : isClean
      ? `Keeping ${domain || lead.name} fast, secure & updated (monthly care)`
      : `Loved ${domain} — 2 quick ideas to get more enquiries`;

  let body;
  if (isNoWeb) {
    if (tone === 'hinglish') {
      subject = `${lead.name} ke liye modern mobile website & Google Maps profile`;
      body = `Namaste ${lead.name} Team,\n\nAapka ${niche} business dekha — kaafi badhiya setup hai! 👍\nMaine notice kiya ki Google Maps aur online directory par aapka business listed hai, lekin abhi tak aapki koi official website nahi hai.\n\nAaj kal 80%+ customers kisi bhi ${niche} ko visit karne se pehle online website check karte hain. Agar aapki ek clean, fast aur mobile-friendly website ho to:\n• Direct WhatsApp enquiries aur phone calls 3x badh sakti hain\n• Google search & Google Maps me aapka business top par rank karega\n• Timing, services, pricing aur photos customer ko directly mil jayengi\n\nMain ${profile.name} hu (${profile.years}+ yrs Senior Web Designer). Maine aapke business (${lead.name}) ke liye ek modern mobile-friendly website ka free demo preview banaya hai.\n\nMere kuch live projects:\n${projects}\n\nKya main aapko wo demo preview WhatsApp ya email par bhej du? Bas "Yes" reply kar dein!\n\nRegards,\n${profile.name} | ${profile.phone}`;
    } else if (tone === 'corporate') {
      subject = `${lead.name}: Proposal for New Corporate Website & Search Presence`;
      body = `Hello ${lead.name} Team,\n\nI reviewed your business presence in ${lead.address || 'your region'}. While your business is well-established, you currently do not have a dedicated corporate website to capture incoming digital demand.\n\nEstablishing a modern, mobile-responsive web presence will:\n• Secure search real estate against competitors on Google & Google Business Profile\n• Provide prospective clients with immediate access to your portfolio, services, and credentials\n• Increase direct inbound telephone and digital inquiries by up to 40%\n\nI am ${profile.name} (${profile.title}, ${profile.years}+ yrs experience). Recent relevant work:\n${projects}\n\nI have prepared a preliminary visual architecture and scope proposal for ${lead.name}. May I share this with your team for review?\n\nBest regards,\n${profile.name}\n${profile.email} | ${profile.phone}`;
    } else {
      body = `Hi ${lead.name} Team,\n\nHope you're having a great week! I came across ${lead.name} today — you've built a wonderful local reputation in ${lead.address || 'your city'}.\n\nI noticed your business is listed online and on Google Maps, but you don't have an official website yet. Today, over 80% of local customers look up a website on their phone before visiting or calling.\n\nA clean, mobile-optimized website for ${lead.name} would help you:\n• Turn Google & map visitors into direct WhatsApp chats and phone calls\n• Showcase your services, photos, pricing, and business hours clearly\n• Rank above local competitors on Google Search\n\nI'm ${profile.name}, a ${profile.title} (${profile.years}+ yrs experience). Recent projects:\n${projects}\n\nI've already mocked up a complimentary mobile homepage preview tailored for ${lead.name} — completely free to look at.\n\nWould you like me to send it over via email or WhatsApp? Just reply "Yes" and I'll share it right away!\n\nWarm regards,\n${profile.name}\n${profile.email} | ${profile.phone}${profile.linkedin ? `\nLinkedIn: ${profile.linkedin}` : ''}`;
    }
  } else if (tone === 'hinglish') {
    subject = isClean
      ? `${lead.name} website ke monthly care & banner updates ke liye`
      : `${domain || lead.name} par zyada enquiries laane ke 2 quick ideas`;
    body = isClean
      ? `Namaste ${lead.name} Team,\n\nAapki ${plat} website (${domain || lead.name}) dekhi — kaafi clean aur fast banayi hai! 👍\n\nMain ${profile.name} hu (${profile.years}+ yrs ${plat} & Graphic Designer). Main businesses ki website ka monthly care & design support handle karta hu:\n• Regular security, theme/plugin updates & daily backups\n• Festival / offer banners, new landing pages & speed optimization\n\nMere kuch live ${plat} projects:\n${projects}\n\nAgar aap chahein to main aapko ek simple monthly maintenance plan bhej sakta hu — bas "Yes" reply kar dein!\n\nRegards,\n${profile.name} | ${profile.phone}`
      : `Namaste ${lead.name} Team,\n\nAapka ${niche} ka kaam aur ${domain || lead.name} dekha — kaafi impressive hai! Bas browse karte waqt ${issues.length} chhoti cheezein notice hui jinko theek karke aap aur zyada calls & WhatsApp enquiries le sakte hain:\n${bullets}\n\nMain ${profile.name} hu (${profile.years}+ yrs ${plat} Designer). Kuch live kaam:\n${projects}\n\nMaine ${domain || lead.name} ke liye ek chhota 2-minute fix plan banaya hai — kya main wo aapko free mein bhej du? Bas "Yes" reply kar dein!\n\nRegards,\n${profile.name} | ${profile.phone}`;
  } else if (tone === 'corporate') {
    subject = isClean
      ? `${domain || lead.name}: ${plat} Performance, Security & Monthly Retainer`
      : `${domain || lead.name}: Quick ${plat} Conversion & SEO Audit`;
    body = isClean
      ? `Hello ${lead.name} Team,\n\n${domain || lead.name} has a strong ${plat} foundation. As you scale campaigns, keeping Core Web Vitals, security patches, daily backups, and seasonal landing pages updated without hiring full-time dev overhead becomes critical.\n\nI'm ${profile.name} (${profile.title}, ${profile.years}+ yrs). Recent ${plat} work:\n${projects}\n\nWould you like me to share our concise monthly SLA & care checklist? Reply "Yes" and I'll send it right over.\n\nBest regards,\n${profile.name}\n${profile.email} | ${profile.phone}`
      : `Hello ${lead.name} Team,\n\nDuring a brief technical review of ${domain || lead.name}, I identified ${issues.length} high-impact items affecting search visibility and mobile conversion:\n${bullets}\n\nI'm ${profile.name} (${profile.title}, ${profile.years}+ yrs). Relevant ${plat} deliveries:\n${projects}\n\nI've prepared a complimentary 2-minute remediation summary for your team. Shall I send it over?\n\nBest regards,\n${profile.name}\n${profile.email} | ${profile.phone}`;
  } else {
    body = isClean
      ? `Hi ${lead.name} Team,\n\nHope you're having a great week! I came across ${domain || lead.name} today — your ${plat} website looks super clean, fast, and well put together for a ${niche}.\n\nSince your site is already in great shape, I'm reaching out about ongoing Website Maintenance & Design Support — so it stays that way without taking up your team's time:\n• Regular ${plat} core, theme & security updates + daily cloud backups\n• Speed & uptime monitoring so you never lose enquiries or orders\n• Quick graphic, banner & landing page updates whenever you launch offers or seasonal campaigns\n\nI'm ${profile.name}, a ${profile.title} (${profile.years}+ yrs experience). A couple of ${plat} sites I've worked on:\n${projects}\n\nWould you like me to send over our simple monthly maintenance checklist & flexible care options? Just reply "Yes" and I'll share it right away (no obligation!).\n\nWarm regards,\n${profile.name}\n${profile.email} | ${profile.phone}${profile.linkedin ? `\nLinkedIn: ${profile.linkedin}` : ''}`
      : `Hi ${lead.name} Team,\n\nHope you're having a great week! I came across ${domain || lead.name} today and genuinely loved the look of your ${niche} — you've built a great brand presence.\n\nWhile browsing your ${plat} site, I noticed ${issues.length === 1 ? 'one small quick win' : `${issues.length} small quick wins`} that could help you get even more calls and enquiries without changing your brand:\n${bullets}\n\nA little about me: I'm ${profile.name}, a ${profile.title} (${profile.years}+ yrs experience). I recently worked on:\n${projects}\n\n${isNoWeb ? 'I’d love to put together a clean, mobile-friendly homepage preview for you — completely free to look at.' : `I already jotted down a simple 2-minute step-by-step fix plan for ${domain || lead.name}.`}\n\nJust reply "Yes" if you'd like me to send it over (no charge, no obligation — happy to help!).\n\nWarm regards,\n${profile.name}\n${profile.email} | ${profile.phone}${profile.linkedin ? `\nLinkedIn: ${profile.linkedin}` : ''}`;
  }

  const shortIssue = issues[0]
    ? /SEO|H1|OpenGraph/i.test(issues[0]) ? 'hiding your site on Google/WhatsApp previews'
    : /Slow|Heavy/i.test(issues[0]) ? 'slowing down mobile visitors'
    : /mobile/i.test(issues[0]) ? 'making phone visitors pinch & zoom'
    : /SSL/i.test(issues[0]) ? 'showing a "Not Secure" warning'
    : /no online store/i.test(issues[0]) ? 'blocking direct online orders'
    : issues[0].toLowerCase()
    : '';
  const linkedinNote = isNoWeb
    ? `Hey ${lead.name} team! Love your ${niche} in ${lead.address || 'town'} — quick question: are you planning a website soon? I mocked up a free mobile homepage demo that brings direct WhatsApp enquiries. Want to see it?`.slice(0, 295)
    : isClean
      ? `Hey ${lead.name} team! Big fan of ${domain || 'your site'} — super clean ${plat} work! Quick question: who handles your monthly speed, backups & offer-banner updates? Happy to share a free 1-min care checklist!`.slice(0, 295)
      : `Hey ${lead.name} team! Loved your ${niche}. Spotted 1-2 quick fixes on ${domain || 'your site'}${shortIssue ? ' (' + shortIssue + ')' : ''} that could bring more calls. Mind if I send a 2-min fix plan?`.slice(0, 295);
  return {
    subject,
    body,
    linkedinNote,
    whatsapp: whatsappPitch(lead, profile, tone),
    instagram: instagramPitch(lead, profile),
    followUp: followUpPitch(lead, profile, tone),
    auditItems,
    projects: pickProjects(profile, `${lead.category} ${niche} ${lead.platform}`, 2)
  };
}

export function formatWhatsAppPhone(rawPhone, address = '') {
  if (!rawPhone) return '';
  const digits = String(rawPhone).replace(/\D/g, '');
  if (!digits || digits.length < 7) return '';
  const addr = String(address).toLowerCase();

  // UAE (971)
  if (addr.includes('uae') || addr.includes('dubai') || addr.includes('abu dhabi') || addr.includes('sharjah')) {
    if (digits.startsWith('971')) return digits;
    if (digits.startsWith('05') && digits.length === 10) return '971' + digits.slice(1);
    if (digits.startsWith('5') && digits.length === 9) return '971' + digits;
  }
  // India (91)
  if (addr.includes('india') || digits.length === 10 && /^[6-9]/.test(digits)) {
    if (digits.startsWith('91') && digits.length === 12) return digits;
    if (digits.length === 10) return '91' + digits;
  }
  // US / Canada (1)
  if (addr.includes('usa') || addr.includes('canada') || addr.includes('united states')) {
    if (digits.startsWith('1') && digits.length === 11) return digits;
    if (digits.length === 10) return '1' + digits;
  }
  return digits;
}

export function whatsappPitch(lead, profile, tone = 'friendly') {
  const isNoWeb = /no website/i.test(lead.platform) || !lead.website;
  const niche = NICHE_LABEL[lead.category] || (lead.category ? lead.category.replace(/_/g, ' ') : 'business');
  const domain = lead.website ? lead.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') : '';
  const city = (lead.address || '').split(',')[0].trim() || 'your city';

  if (isNoWeb) {
    if (tone === 'hinglish') {
      return `Namaste ${lead.name} Team! 🙏\n\nMain Praveen Pathak hu (${profile.years}+ yrs Senior Web Designer, Indore).\n\nMaine aapka ${niche} business Google Maps par dekha — kaafi badhiya setup hai! 👍 Lekin notice kiya ki abhi tak aapki koi official website nahi hai.\n\nAaj kal 80%+ local customers aane se pehle phone par website check karte hain. Agar aapki ek clean mobile website ho to:\n• Direct WhatsApp enquiries & phone calls 3x badh sakti hain\n• Google Maps & Search me aapka business top par rank karega\n\nMaine ${lead.name} ke liye ek free mobile demo website layout design kiya hai. Kya main wo demo aapke sath yahan share kar du? Bas "Yes" reply kar dein!\n\nWarm regards,\n${profile.name} | ${profile.phone}`;
    }
    return `Hi ${lead.name} Team! 👋\n\nI'm ${profile.name}, a Senior Web Designer (${profile.years}+ yrs experience). Loved your ${niche} reputation in ${city}!\n\nI noticed you have a great business presence, but don't have an official website yet. Today, over 80% of local customers check a website on their phone before visiting.\n\nA modern, mobile-friendly website would help you:\n• Turn Google searchers into direct WhatsApp chats & phone calls\n• Showcase your services, photos, pricing & hours clearly\n\nI mocked up a complimentary mobile homepage demo tailored for ${lead.name}. Would you like me to share it with you? Just reply "Yes"!\n\nWarm regards,\n${profile.name}\n${profile.email} | ${profile.phone}`;
  }

  // With website
  const issue = (lead.opportunities || [])[0] || 'mobile conversion optimization';
  if (tone === 'hinglish') {
    return `Namaste ${lead.name} Team! 🙏\n\nMain Praveen Pathak (${profile.years}+ yrs Web Designer). Aapka ${niche} kaam aur website (${domain || lead.name}) dekhi — kaafi impressive hai! 👍\n\nBas browse karte waqt ek chhota issue notice hua: ${humanIssue(issue)}.\nIsse aapke mobile visitors drop ho rahe hain. Maine iska ek quick 2-minute fix idea banaya hai. Kya main share karu? Bas "Yes" reply kar dein!\n\nRegards,\n${profile.name} | ${profile.phone}`;
  }
  return `Hi ${lead.name} Team! 👋\n\nI'm ${profile.name}, a Senior Web Designer (${profile.years}+ yrs experience). Loved your ${niche} brand at ${domain || lead.name}!\n\nWhile browsing your site, I spotted 1 quick win: ${humanIssue(issue)} — which might be losing you potential customer enquiries on mobile.\n\nI put together a simple 60-second fix summary for ${domain || lead.name}. May I share it with you? (No charge, happy to help!).\n\nWarm regards,\n${profile.name}\n${profile.email} | ${profile.phone}`;
}

export function instagramPitch(lead, profile) {
  const isNoWeb = /no website/i.test(lead.platform) || !lead.website;
  const niche = NICHE_LABEL[lead.category] || (lead.category ? lead.category.replace(/_/g, ' ') : 'brand');
  const city = (lead.address || '').split(',')[0].trim() || 'town';

  if (isNoWeb) {
    return `Hey ${lead.name} team! 👋 Love your ${niche} feed in ${city}. Quick heads-up: noticed you don't have an official website yet for direct WhatsApp orders. I mocked up a free mobile homepage demo for you — mind if I drop it here?`;
  }
  return `Hey ${lead.name} team! 👋 Loved your ${niche} work in ${city}. Spotted 1 quick fix on your website that could bring more direct customer calls on mobile. Put together a free 60-sec preview idea for you — mind if I share it here?`;
}

export function followUpPitch(lead, profile, tone = 'friendly') {
  const isNoWeb = /no website/i.test(lead.platform) || !lead.website;
  const domain = lead.website ? lead.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') : lead.name;

  if (tone === 'hinglish') {
    return `Namaste ${lead.name} Team! 🙏\n\nBas quick follow-up kar raha tha ki kya aapko meri pichli ${isNoWeb ? 'website demo preview' : 'website fix plan'} wali message mili thi?\n\nAgar aap interested hain to main 2 minute me demo link share kar dunga — completely free to look at, koi commitment nahi!\n\nRegards,\n${profile.name} | ${profile.phone}`;
  }
  return `Hi ${lead.name} Team! 👋\n\nHope you're having a productive week! Just following up on the quick ${isNoWeb ? 'mobile website demo' : 'website improvement plan'} I shared for ${domain} a few days ago.\n\nDid you get a chance to take a look? Happy to send over the visual preview whenever you have a moment!\n\nWarm regards,\n${profile.name}\n${profile.email} | ${profile.phone}`;
}

