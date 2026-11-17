// Business lead finder: OpenStreetMap (Nominatim + Overpass) -> real businesses
// in any city/area -> website analysed for WordPress/Shopify + contacts.
import { analyzeSite, pool } from './detect.js';

const CONTACT_UA = 'LeadJobAgent/1.0 (personal lead research tool)';
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
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

const CITY_COORDS = {
  // India
  'indore, india': [22.7196, 75.8577], 'mumbai, india': [19.0760, 72.8777], 'delhi, india': [28.6139, 77.2090],
  'new delhi, india': [28.6139, 77.2090], 'bengaluru, india': [12.9716, 77.5946], 'pune, india': [18.5204, 73.8567],
  'hyderabad, india': [17.3850, 78.4867], 'jaipur, india': [26.9124, 75.7873], 'ahmedabad, india': [23.0225, 72.5714],
  'surat, india': [21.1702, 72.8311], 'chennai, india': [13.0827, 80.2707], 'kolkata, india': [22.5726, 88.3639],
  'chandigarh, india': [30.7333, 76.7794], 'noida, india': [28.5355, 77.3910], 'gurugram, india': [28.4595, 77.0266],
  'faridabad, india': [28.4089, 77.3178], 'ghaziabad, india': [28.6692, 77.4538], 'lucknow, india': [26.8467, 80.9462],
  'kanpur, india': [26.4499, 80.3319], 'bhopal, india': [23.2599, 77.4126], 'ujjain, india': [23.1765, 75.7885],
  'raipur, india': [21.2514, 81.6296], 'nagpur, india': [21.1458, 79.0882], 'nashik, india': [19.9975, 73.7898],
  'vadodara, india': [22.3072, 73.1812], 'rajkot, india': [22.3039, 70.8022], 'kochi, india': [9.9312, 76.2673],
  'thiruvananthapuram, india': [8.5241, 76.9366], 'goa, india': [15.2993, 74.1240], 'coimbatore, india': [11.0168, 76.9558],
  'madurai, india': [9.9252, 78.1198], 'visakhapatnam, india': [17.6868, 83.2185], 'vijayawada, india': [16.5062, 80.6480],
  'bhubaneswar, india': [20.2961, 85.8245], 'patna, india': [25.5941, 85.1376], 'ranchi, india': [23.3441, 85.3096],
  'guwahati, india': [26.1445, 91.7362], 'dehradun, india': [30.3165, 78.0322], 'ludhiana, india': [30.9010, 75.8573],
  'amritsar, india': [31.6340, 74.8723],
  // UAE & Middle East
  'dubai, uae': [25.2048, 55.2708], 'abu dhabi, uae': [24.4539, 54.3773], 'sharjah, uae': [25.3463, 55.4209],
  'ajman, uae': [25.4052, 55.5136], 'doha, qatar': [25.2854, 51.5310], 'riyadh, saudi arabia': [24.7136, 46.6753],
  'jeddah, saudi arabia': [21.4858, 39.1925], 'dammam, saudi arabia': [26.4207, 50.0888],
  'kuwait city, kuwait': [29.3759, 47.9774], 'muscat, oman': [23.5880, 58.3829], 'manama, bahrain': [26.2285, 50.5860],
  'amman, jordan': [31.9454, 35.9284], 'cairo, egypt': [30.0444, 31.2357],
  // USA
  'new york, usa': [40.7128, -74.0060], 'los angeles, usa': [34.0522, -118.2437], 'chicago, usa': [41.8781, -87.6298],
  'austin, texas, usa': [30.2672, -97.7431], 'houston, usa': [29.7604, -95.3698], 'miami, usa': [25.7617, -80.1918],
  'san francisco, usa': [37.7749, -122.4194], 'san jose, usa': [37.3382, -121.8863], 'san diego, usa': [32.7157, -117.1611],
  'seattle, usa': [47.6062, -122.3321], 'dallas, usa': [32.7767, -96.7970], 'atlanta, usa': [33.7490, -84.3880],
  'boston, usa': [42.3601, -71.0589], 'denver, usa': [39.7392, -104.9903], 'phoenix, usa': [33.4484, -112.0740],
  'las vegas, usa': [36.1699, -115.1398], 'orlando, usa': [28.5383, -81.3792], 'philadelphia, usa': [39.9526, -75.1652],
  'washington, dc, usa': [38.9072, -77.0369], 'charlotte, usa': [35.2271, -80.8431], 'nashville, usa': [36.1627, -86.7816],
  // Canada
  'toronto, canada': [43.6532, -79.3832], 'vancouver, canada': [49.2827, -123.1207], 'montreal, canada': [45.5017, -73.5673],
  'calgary, canada': [51.0447, -114.0719], 'ottawa, canada': [45.4215, -75.6972], 'edmonton, canada': [53.5461, -113.4938],
  'winnipeg, canada': [49.8951, -97.1384], 'halifax, canada': [44.6488, -63.5752],
  // UK & Ireland
  'london, uk': [51.5074, -0.1278], 'manchester, uk': [53.4808, -2.2426], 'birmingham, uk': [52.4862, -1.8904],
  'leeds, uk': [53.8008, -1.5491], 'glasgow, uk': [55.8642, -4.2518], 'edinburgh, uk': [55.9533, -3.1883],
  'bristol, uk': [51.4545, -2.5879], 'liverpool, uk': [53.4084, -2.9916], 'dublin, ireland': [53.3498, -6.2603],
  // Europe
  'berlin, germany': [52.5200, 13.4050], 'munich, germany': [48.1351, 11.5820], 'frankfurt, germany': [50.1109, 8.6821],
  'hamburg, germany': [53.5511, 9.9937], 'paris, france': [48.8566, 2.3522], 'lyon, france': [45.7640, 4.8357],
  'amsterdam, netherlands': [52.3676, 4.9041], 'rotterdam, netherlands': [51.9244, 4.4777],
  'madrid, spain': [40.4168, -3.7038], 'barcelona, spain': [41.3874, 2.1686], 'lisbon, portugal': [38.7223, -9.1393],
  'rome, italy': [41.9028, 12.4964], 'milan, italy': [45.4642, 9.1900], 'zurich, switzerland': [47.3769, 8.5417],
  'geneva, switzerland': [46.2044, 6.1432], 'vienna, austria': [48.2082, 16.3738], 'brussels, belgium': [50.8503, 4.3517],
  'stockholm, sweden': [59.3293, 18.0686], 'copenhagen, denmark': [55.6761, 12.5683], 'oslo, norway': [59.9139, 10.7522],
  'warsaw, poland': [52.2297, 21.0122], 'prague, czechia': [50.0755, 14.4378],
  // Australia, NZ & Asia-Pacific
  'sydney, australia': [-33.8688, 151.2093], 'melbourne, australia': [-37.8136, 144.9631],
  'brisbane, australia': [-27.4698, 153.0251], 'perth, australia': [-31.9505, 115.8605],
  'adelaide, australia': [-34.9285, 138.6007], 'auckland, new zealand': [-36.8485, 174.7633],
  'wellington, new zealand': [-41.2865, 174.7762], 'singapore': [1.3521, 103.8198],
  'kuala lumpur, malaysia': [3.1390, 101.6869], 'bangkok, thailand': [13.7563, 100.5018],
  'jakarta, indonesia': [-6.2088, 106.8456], 'manila, philippines': [14.5995, 120.9842],
  'ho chi minh city, vietnam': [10.8231, 106.6297], 'tokyo, japan': [35.6762, 139.6503],
  'seoul, south korea': [37.5665, 126.9780], 'hong kong': [22.3193, 114.1694], 'taipei, taiwan': [25.0330, 121.5654],
  // Latin America & Africa
  'mexico city, mexico': [19.4326, -99.1332], 'sao paulo, brazil': [-23.5505, -46.6333],
  'buenos aires, argentina': [-34.6037, -58.3816], 'bogota, colombia': [4.7110, -74.0721],
  'santiago, chile': [-33.4489, -70.6693], 'johannesburg, south africa': [-26.2041, 28.0473],
  'cape town, south africa': [-33.9249, 18.4241], 'nairobi, kenya': [-1.2921, 36.8219], 'lagos, nigeria': [6.5244, 3.3792],
};
const geoCache = new Map();
const boxFromCenter = (lat, lon, name) => ({ lat, lon, display_name: name, boundingbox: [lat - 0.35, lat + 0.35, lon - 0.35, lon + 0.35] });

async function geocode(area) {
  const key = String(area || '').trim().toLowerCase();
  if (CITY_COORDS[key]) return boxFromCenter(...CITY_COORDS[key], area.trim());
  if (geoCache.has(key)) return geoCache.get(key);

  // 1) Photon (OSM-based, fast & cloud-friendly)
  try {
    const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(area)}&limit=1`, { headers: { 'User-Agent': CONTACT_UA }, signal: AbortSignal.timeout(10000) });
    if (r.ok) {
      const f = (await r.json()).features?.[0];
      if (f?.geometry?.coordinates) {
        const [lon, lat] = f.geometry.coordinates;
        const p = f.properties || {};
        const res = boxFromCenter(lat, lon, [p.name, p.city, p.state, p.country].filter(Boolean).join(', ') || area);
        geoCache.set(key, res);
        return res;
      }
    }
  } catch { /* fallback */ }

  // 2) Open-Meteo Geocoding
  try {
    const city = area.split(',')[0].trim();
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`, { signal: AbortSignal.timeout(10000) });
    if (r.ok) {
      const hit = (await r.json()).results?.[0];
      if (hit) {
        const res = boxFromCenter(hit.latitude, hit.longitude, [hit.name, hit.admin1, hit.country].filter(Boolean).join(', '));
        geoCache.set(key, res);
        return res;
      }
    }
  } catch { /* fallback */ }

  // 3) Nominatim fallback
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(area)}`, { headers: { 'User-Agent': CONTACT_UA, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`Geocoding failed (HTTP ${r.status})`);
  const j = await r.json();
  if (!j.length) throw new Error(`Area "${area}" not found. Try "City, Country" e.g. "Dubai, UAE".`);
  geoCache.set(key, j[0]);
  return j[0];
}

function buildQuery(place, category, limit, needWebsite) {
  const filters = CATEGORIES[category];
  if (!filters) throw new Error('Unknown category: ' + category);
  // Bounding box (clamped to ~0.3° around city center) is 5-10x faster than area(id:...) on Overpass.
  let [s, n, w, e] = place.boundingbox.map(Number);
  const lat = Number(place.lat), lon = Number(place.lon);
  if (n - s > 0.8) { s = lat - 0.35; n = lat + 0.35; }
  if (e - w > 0.8) { w = lon - 0.35; e = lon + 0.35; }
  const scope = `(${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)})`;
  const wfs = needWebsite ? ['["website"]', '["contact:website"]'] : [''];
  const lines = [];
  for (const [k, v] of filters) for (const wf of wfs) lines.push(`nw["${k}"~"^(${v})$"]${wf}${scope};`);
  return `[out:json][timeout:45];(${lines.join('')});out center tags ${limit};`;
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
  await pool(businesses, 15, async (b) => {
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
  onProgress({ stage: 'done', msg: `Done. ${leads.length} matching leads out of ${businesses.length} sites scanned.${leads.length < 15 && platform !== 'all' ? ' (Tip: Select "All websites" in Platform dropdown to see all ' + businesses.length + ' businesses!)' : ''}` });
  return { place: place.display_name, scanned: businesses.length, leads };
}
