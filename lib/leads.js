// Business lead finder: OpenStreetMap (Nominatim + Overpass) -> real businesses
// in any city/area -> website analysed for WordPress/Shopify + contacts.
import { analyzeSite, pool } from './detect.js';

const CONTACT_UA = 'LeadJobAgent/1.0 (personal lead research tool)';
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

// Niche -> OSM tag filters
export const CATEGORIES = {
  restaurant: [['amenity', 'restaurant|cafe|fast_food|bar|pub|ice_cream']],
  jewelry: [['shop', 'jewelry|watches']],
  shopping: [['shop', 'clothes|boutique|shoes|bag|fashion|fashion_accessories|department_store|mall|gift|cosmetics|perfumery']],
  clothing: [['shop', 'clothes|boutique|fashion|shoes']],
  salon_beauty: [['shop', 'hairdresser|beauty|cosmetics|massage'], ['leisure', 'spa']],
  hotel: [['tourism', 'hotel|guest_house|motel|hostel|apartment']],
  gym_fitness: [['leisure', 'fitness_centre|sports_centre'], ['sport', 'yoga|fitness']],
  bakery_sweets: [['shop', 'bakery|pastry|confectionery|chocolate']],
  furniture_decor: [['shop', 'furniture|interior_decoration|carpet|lighting|bed|kitchen']],
  electronics_mobile: [['shop', 'electronics|mobile_phone|computer|appliance']],
  florist_gifts: [['shop', 'florist|gift']],
  dentist_clinic: [['amenity', 'dentist|clinic|doctors'], ['healthcare', 'dentist|clinic']],
  real_estate: [['office', 'estate_agent'], ['shop', 'estate_agent']],
  travel_agency: [['shop', 'travel_agency'], ['office', 'travel_agent']],
  car_dealer: [['shop', 'car|car_parts|car_repair|motorcycle']],
  school_coaching: [['amenity', 'school|college|language_school|driving_school|training']],
  lawyer_accountant: [['office', 'lawyer|accountant|tax_advisor|consulting|financial']],
  pet_shop: [['shop', 'pet|pet_grooming'], ['amenity', 'veterinary']],
  grocery_organic: [['shop', 'supermarket|convenience|greengrocer|organic|health_food|deli']],
  optician: [['shop', 'optician']],
  wedding: [['shop', 'wedding|bridal']],
  it_software: [['office', 'it|software|telecommunication'], ['shop', 'computer']],
  architecture_cad: [['office', 'architect|engineer|surveyor|construction_company']],
  graphic_printing: [['shop', 'copyshop|print'], ['craft', 'graphic_design|photographer|signmaker'], ['office', 'graphic_design']],
  marketing_seo: [['office', 'advertising|marketing|pr']],
  interior_design: [['office', 'interior_design'], ['shop', 'interior_decoration']],
};

async function geocode(area) {
  const u = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(area)}`;
  const r = await fetch(u, { headers: { 'User-Agent': CONTACT_UA, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Geocoding failed (HTTP ${r.status})`);
  const j = await r.json();
  if (!j.length) throw new Error(`Area "${area}" not found. Try "City, Country" e.g. "Dubai, UAE".`);
  return j[0];
}

function buildQuery(place, category, limit, needWebsite) {
  const filters = CATEGORIES[category];
  if (!filters) throw new Error('Unknown category: ' + category);
  let scope, header = '';
  if (place.osm_type === 'relation') {
    header = `area(id:${3600000000 + Number(place.osm_id)})->.a;`;
    scope = '(area.a)';
  } else {
    const [s, n, w, e] = place.boundingbox.map(Number);
    scope = `(${s},${w},${n},${e})`;
  }
  const webFilters = needWebsite ? ['["website"]', '["contact:website"]'] : [''];
  const lines = [];
  for (const [k, v] of filters) for (const wf of webFilters) lines.push(`nwr["${k}"~"^(${v})$"]${wf}${scope};`);
  return `[out:json][timeout:100];${header}(${lines.join('')});out center tags ${limit};`;
}

// Query all Overpass mirrors in parallel; first good answer wins (hard 120s cap).
async function overpass(query) {
  const ctrl = new AbortController();
  const hard = setTimeout(() => ctrl.abort(), 120000);
  try {
    return await Promise.any(OVERPASS.map(async (ep) => {
      const r = await fetch(ep, {
        method: 'POST',
        headers: { 'User-Agent': CONTACT_UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: ctrl.signal,
      });
      if (!r.ok) throw new Error(`Overpass HTTP ${r.status}`);
      const j = await r.json();
      if (j.remark && !(j.elements || []).length) throw new Error(j.remark);
      return j;
    }));
  } catch (e) {
    throw new Error('Map data servers busy / timed out – try again in a minute or use a smaller area (city instead of country).');
  } finally {
    clearTimeout(hard);
    ctrl.abort(); // cancel slower mirrors
  }
}

function toBusiness(el) {
  const t = el.tags || {};
  const addr = [t['addr:housenumber'], t['addr:street'], t['addr:suburb'] || t['addr:district'], t['addr:city'], t['addr:postcode']].filter(Boolean).join(', ');
  return {
    name: t.name || t['name:en'] || '(no name)',
    category: t.shop || t.amenity || t.tourism || t.office || t.leisure || t.healthcare || '',
    website: t.website || t['contact:website'] || t.url || '',
    phone: t.phone || t['contact:phone'] || t['contact:mobile'] || '',
    email: t.email || t['contact:email'] || '',
    instagram: t['contact:instagram'] || '',
    facebook: t['contact:facebook'] || '',
    address: addr,
    lat: el.lat ?? el.center?.lat,
    lon: el.lon ?? el.center?.lon,
    osm: `https://www.openstreetmap.org/${el.type}/${el.id}`,
  };
}

function domainKey(rawUrl, name, addr) {
  if (rawUrl) {
    try {
      const u = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : 'https://' + rawUrl);
      return u.hostname.toLowerCase().replace(/^www\./, '');
    } catch { /* fallback */ }
  }
  return (name + '|' + addr).toLowerCase().replace(/\s+/g, '');
}

/**
 * opts: { area, category, platform, maxScan, onProgress }
 */
export async function findLeads({ area, category, platform = 'both', maxScan = 120, onProgress = () => {} }) {
  onProgress({ stage: 'geocode', msg: `Locating "${area}"...` });
  const place = await geocode(area);
  onProgress({ stage: 'geocode', msg: `Found: ${place.display_name}` });

  const noWebsiteMode = platform === 'nowebsite';
  onProgress({ stage: 'search', msg: `Searching ${category.replace('_', ' ')} businesses on the map...` });
  const data = await overpass(buildQuery(place, category, noWebsiteMode ? 500 : Math.max(maxScan * 3, 200), !noWebsiteMode));

  const seen = new Set();
  let businesses = (data.elements || []).map(toBusiness).filter((b) => {
    const key = domainKey(b.website, b.name, b.address);
    if (seen.has(key) || b.name === '(no name)') return false;
    seen.add(key);
    return true;
  });

  if (noWebsiteMode) {
    const leads = businesses.filter((b) => !b.website && (b.phone || b.email)).map((b) => ({
      ...b, platform: 'No website', theme: '', emails: b.email ? [b.email] : [], phones: b.phone ? [b.phone] : [], socials: {},
      opportunities: ['Business has NO website – pitch a new WordPress / Shopify site'],
    }));
    onProgress({ stage: 'done', msg: `${leads.length} businesses without a website (with phone/email).` });
    return { place: place.display_name, scanned: businesses.length, leads };
  }

  businesses = businesses.slice(0, maxScan);
  onProgress({ stage: 'scan', msg: `${businesses.length} business websites found. Checking each site for WordPress/Shopify...`, total: businesses.length });

  let done = 0;
  const leads = [];
  await pool(businesses, 8, async (b) => {
    const a = await analyzeSite(b.website);
    done++;
    const lead = {
      ...b,
      website: a.finalUrl || b.website,
      platform: a.platform,
      reachable: a.reachable,
      theme: a.theme,
      wpVersion: a.wpVersion,
      woocommerce: a.woocommerce,
      emails: [...new Set([b.email, ...a.emails].filter(Boolean))],
      phones: [...new Map([b.phone, ...a.phones].filter(Boolean).flatMap((p) => p.split(/[;,]/)).map((p) => p.trim()).filter(Boolean).map((p) => [p.replace(/\D/g, '').slice(-9), p])).values()],
      socials: { ...a.socials, ...(b.instagram ? { instagram: b.instagram } : {}), ...(b.facebook ? { facebook: b.facebook } : {}) },
      opportunities: a.reachable ? a.opportunities : ['Website DOWN / unreachable – urgent fix/rebuild pitch'],
    };
    const p = a.platform;
    const opsText = lead.opportunities.join(' ');
    const matchMap = {
      all: true,
      both: p === 'WordPress' || p === 'Shopify',
      wordpress: p === 'WordPress',
      woocommerce: p === 'WordPress' && a.woocommerce,
      shopify: p === 'Shopify',
      ecommerce_other: p === 'Magento' || p === 'BigCommerce',
      migration: p === 'Wix' || p === 'Squarespace' || p === 'GoDaddy Builder',
      php: p === 'PHP' || p === 'Laravel' || p === 'CodeIgniter',
      laravel: p === 'Laravel',
      codeigniter: p === 'CodeIgniter',
      react: p === 'Next.js / React',
      angular: p === 'Angular',
      vue: p === 'Vue / Nuxt',
      bootstrap: p === 'Bootstrap / HTML',
      seo_need: /SEO|H1|OpenGraph/i.test(opsText),
      design_need: /mobile|Slow|Heavy|Old copyright|DOWN|No SSL/i.test(opsText),
    };
    const keep = platform in matchMap ? matchMap[platform] : true;
    if (keep) { leads.push(lead); onProgress({ stage: 'lead', lead }); }
    onProgress({ stage: 'progress', done, total: businesses.length });
  });

  leads.sort((x, y) => (y.emails.length > 0) - (x.emails.length > 0) || y.opportunities.length - x.opportunities.length);
  onProgress({ stage: 'done', msg: `Done. ${leads.length} matching leads out of ${businesses.length} sites scanned.` });
  return { place: place.display_name, scanned: businesses.length, leads };
}
