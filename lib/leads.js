// Business lead finder: Hybrid Multi-Source Discovery
// (Live Web Business Search + OpenStreetMap Overpass/Nominatim)
// -> real operating businesses in any city/state -> deep website analysis
// for WordPress/Shopify, contact emails, phone numbers, and pitch opportunities.

import { analyzeSite, pool } from './detect.js';

const CONTACT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const OVERPASS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

const OVERPASS_UA = 'OverpassClient/1.0 (contact: parvpathak12@gmail.com)';


// Niche -> OSM tag filters
export const CATEGORIES = {
  restaurant: [['amenity', 'restaurant|cafe|fast_food|bar|pub|ice_cream']],
  jewelry: [['shop', 'jewelry|watches']],
  shopping: [['shop', 'clothes|boutique|shoes|bag|fashion|fashion_accessories|department_store|mall|gift|cosmetics|perfumery']],
  clothing: [['shop', 'clothes|boutique|fashion|shoes']],
  salon_beauty: [['shop', 'hairdresser|beauty|cosmetics|massage'], ['leisure', 'spa']],
  hotel: [['tourism', 'hotel|guest_house|motel|hostel|apartment']],
  gym_fitness: [['leisure', 'fitness_centre|sports_centre'], ['amenity', 'gym'], ['sport', 'yoga|fitness|gymnastics|bodybuilding']],
  bakery_sweets: [['shop', 'bakery|pastry|confectionery|chocolate']],
  furniture_decor: [['shop', 'furniture|interior_decoration|carpet|lighting|bed|kitchen']],
  electronics_mobile: [['shop', 'electronics|mobile_phone|computer|appliance']],
  florist_gifts: [['shop', 'florist|gift']],
  dentist_clinic: [['amenity', 'dentist|clinic|doctors'], ['healthcare', 'dentist|clinic']],
  real_estate: [['office', 'estate_agent|property_management|real_estate'], ['shop', 'estate_agent']],
  roofing_construction: [['craft', 'roofer|carpenter|painter'], ['office', 'construction_company|general_contractor']],
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
  cosmetics_skincare: [['shop', 'cosmetics|perfumery|beauty|chemist'], ['beauty', 'cosmetics|skincare|perfumery|salon'], ['healthcare', 'dermatologist']],
  pharmacy_supplements: [['amenity', 'pharmacy'], ['shop', 'herbalist|nutrition_supplements|medical_supply']],
  sports_outdoor: [['shop', 'sports|bicycle|outdoor']],
  toys_baby: [['shop', 'toys|baby_goods']],
  books_stationery: [['shop', 'books|stationery']],
  art_antiques: [['shop', 'art|craft|antiques'], ['tourism', 'gallery']],
  music_instruments: [['shop', 'musical_instrument']],
  home_services_solar: [['office', 'energy'], ['craft', 'electrician|plumber|hvac|solar']],
  hardware_garden: [['shop', 'hardware|doityourself|paint|garden_centre']],
  event_catering: [['craft', 'caterer'], ['amenity', 'events_venue|conference_centre']],
  photography_studio: [['craft', 'photographer'], ['shop', 'photo']],
  physio_chiro_wellness: [['healthcare', 'physiotherapist|alternative|chiropractor|optometrist']],
  coffee_tea_beverages: [['shop', 'coffee|tea|wine|beverages']],
  logistics_moving: [['office', 'logistics|moving_company|courier']],
  coworking_space: [['amenity', 'coworking_space'], ['office', 'coworking']],
  tattoo_piercing: [['shop', 'tattoo']],
};

// Search keywords tailored for business search discovery
export const CATEGORY_SEARCH_TERMS = {
  restaurant: 'restaurant cafe dining food',
  jewelry: 'jewelry watches store jewelers',
  shopping: 'boutique fashion retail shop',
  clothing: 'clothing boutique apparel fashion store',
  salon_beauty: 'beauty salon hair salon spa aesthetic',
  hotel: 'hotel boutique resort inn',
  gym_fitness: 'gym fitness center club crossfit yoga studio workout',
  bakery_sweets: 'bakery pastry cakes confectionery',
  furniture_decor: 'furniture interior home decor furnishings',
  electronics_mobile: 'electronics computer repair mobile store',
  florist_gifts: 'florist flowers gift shop floral design',
  dentist_clinic: 'dental clinic dentist cosmetic dentistry',
  real_estate: 'real estate agency property realtor brokerage',
  roofing_construction: 'roofing contractor construction company building',
  travel_agency: 'travel agency tour operator vacations',
  car_dealer: 'car dealer auto repair dealership mechanics',
  school_coaching: 'coaching institute training academy school',
  lawyer_accountant: 'lawyer attorney law firm accountant CPA',
  pet_shop: 'pet shop pet supplies veterinary vet grooming',
  grocery_organic: 'grocery store organic natural market health food',
  optician: 'optician eyewear optical glasses sunglasses',
  wedding: 'wedding planner bridal boutique bridal store',
  it_software: 'software development company web agency IT services',
  architecture_cad: 'architecture architectural firm interior architecture',
  graphic_printing: 'printing services print shop graphic design studio',
  marketing_seo: 'marketing agency SEO digital marketing advertising',
  interior_design: 'interior design studio interior decorator',
  cosmetics_skincare: 'cosmetics skincare beauty brand organic skincare store',
  pharmacy_supplements: 'pharmacy compounding vitamins supplements',
  sports_outdoor: 'sports gear bicycle outdoor shop athletics',
  toys_baby: 'toys baby goods boutique children clothing',
  books_stationery: 'bookstore independent books stationery paper',
  art_antiques: 'art gallery antique store vintage collectibles',
  music_instruments: 'musical instruments guitar piano music shop',
  home_services_solar: 'solar company electrician plumbing HVAC services',
  hardware_garden: 'hardware store garden centre nursery tools',
  event_catering: 'catering caterer event venue party planning',
  photography_studio: 'photography studio photographer portrait commercial',
  physio_chiro_wellness: 'physiotherapy chiropractic wellness clinic holistic',
  coffee_tea_beverages: 'specialty coffee roaster tea shop cafe',
  logistics_moving: 'moving company logistics movers shipping transport',
  coworking_space: 'coworking space shared office flexible workspace',
  tattoo_piercing: 'tattoo studio body piercing tattoo parlor',
};

// Expand states/provinces to top commercial metro hubs so queries find real businesses
export const STATE_EXPANSIONS = {
  'california, usa': ['Los Angeles, USA', 'San Francisco, USA', 'San Diego, USA', 'San Jose, USA'],
  'texas, usa': ['Houston, USA', 'Austin, Texas, USA', 'Dallas, USA'],
  'florida, usa': ['Miami, USA', 'Orlando, USA', 'Tampa, Florida, USA'],
  'new york state, usa': ['New York, USA'],
  'illinois, usa': ['Chicago, USA'],
  'georgia, usa': ['Atlanta, USA'],
  'north carolina, usa': ['Charlotte, USA', 'Raleigh, North Carolina, USA'],
  'washington state, usa': ['Seattle, USA'],
  'arizona, usa': ['Phoenix, USA'],
  'massachusetts, usa': ['Boston, USA'],
  'colorado, usa': ['Denver, USA'],
  'nevada, usa': ['Las Vegas, USA'],
  'pennsylvania, usa': ['Philadelphia, USA'],
  'michigan, usa': ['Detroit, Michigan, USA'],
  'tennessee, usa': ['Nashville, USA'],
  'maryland, usa': ['Baltimore, Maryland, USA'],
  'minnesota, usa': ['Minneapolis, Minnesota, USA'],
  'oregon, usa': ['Portland, Oregon, USA'],
  // India
  'madhya pradesh, india': ['Indore, India', 'Bhopal, India', 'Gwalior, India', 'Jabalpur, India', 'Ujjain, India'],
  'maharashtra, india': ['Mumbai, India', 'Pune, India', 'Nagpur, India'],
  'gujarat, india': ['Ahmedabad, India', 'Surat, India', 'Vadodara, India'],
  'rajasthan, india': ['Jaipur, India'],
  'karnataka, india': ['Bengaluru, India'],
  'tamil nadu, india': ['Chennai, India', 'Coimbatore, India'],
  'telangana, india': ['Hyderabad, India'],
  'andhra pradesh, india': ['Visakhapatnam, India', 'Vijayawada, India'],
  'uttar pradesh, india': ['Noida, India', 'Lucknow, India', 'Kanpur, India'],
  'west bengal, india': ['Kolkata, India'],
  'punjab, india': ['Ludhiana, India', 'Amritsar, India', 'Chandigarh, India'],
  'haryana, india': ['Gurugram, India', 'Faridabad, India'],
  'kerala, india': ['Kochi, India', 'Thiruvananthapuram, India'],
  'bihar, india': ['Patna, India'],
  'odisha, india': ['Bhubaneswar, India'],
  'assam, india': ['Guwahati, India'],
  'jharkhand, india': ['Ranchi, India'],
  'chhattisgarh, india': ['Raipur, India'],
  'uttarakhand, india': ['Dehradun, India'],
  // Canada
  'ontario, canada': ['Toronto, Canada', 'Ottawa, Canada'],
  'british columbia, canada': ['Vancouver, Canada'],
  'quebec, canada': ['Montreal, Canada'],
  'alberta, canada': ['Calgary, Canada', 'Edmonton, Canada'],
};

const DIRECTORY_DOMAINS = new Set([
  'duckduckgo.com', 'google.com', 'yelp.com', 'yellowpages.com', 'yellowpages.ca', 'yellowpages.ae',
  'tripadvisor.com', 'tripadvisor.in', 'tripadvisor.ae', 'facebook.com', 'instagram.com', 'linkedin.com',
  'twitter.com', 'youtube.com', 'pinterest.com', 'tiktok.com', 'reddit.com', 'amazon.com', 'apple.com',
  'aeroleads.com', 'f6s.com', 'builtinla.com', 'makersrow.com', 'zoominfo.com', 'crunchbase.com',
  'bbb.org', 'mapquest.com', 'wikipedia.org', 'bloomberg.com', 'indeed.com', 'glassdoor.com', 'dnb.com',
  'chamberofcommerce.com', 'groupon.com', 'manta.com', 'trustanalytica.org', 'ewg.org', 'consumerreports.org',
  'retailboss.co', 'statista.com', 'quora.com', 'forbes.com', 'cosmeticsdesign.com', 'cosmeticsdesign-usa.com',
  'yahoo.com', 'bing.com', 'github.com', 'medium.com', 'zomato.com', 'talabat.com', 'deliveroo.com',
  'timeoutdubai.com', 'whatson.ae', 'opentable.com', 'thefork.com', 'eatapp.co', 'restaurantguru.com',
  'restaurantguide.com', 'eazydiner.com', 'justdial.com', 'sulekha.com', 'indiamart.com', 'curlytales.com',
  'moviefone.com', 'netmums.com', 'wedmegood.com', 'bestbuy.com', 'merriam-webster.com',
  'dictionary.cambridge.org', 'thefreedictionary.com', 'wiktionary.org', 'wordreference.com', 'dictionary.com',
  'local.com', 'tophat.com', 'localwp.com', 'onewebcare.com', 'globalmusicvibe.com', 'techbaked.com',
  'eventbrite.com', 'allrecipes.com', 'foodnetwork.com', 'careem.com', 'swiggy.com', 'magicpin.in',
  'dineout.co.in', 'dubizzle.com', 'bayut.com', 'propertyfinder.ae', 'businessinsider.com',
  'hubspot.com', 'upwork.com', 'fiverr.com', 'freelancer.com', 'trustpilot.com', 'sitejabber.com',
  'monster.com', 'expatwoman.com', 'khaleejtimes.com', 'gulfnews.com', 'thenationalnews.com',
  'bandsintown.com', 'songkick.com', 'moviesanywhere.com', 'eventim.co.uk', 'livenation.com', 'primevideo.com',
  'nic.top', 'travelandleisure.com', 'myntra.com', 'obsproject.com', 'rottentomatoes.com', 'imdb.com',
  'xnx.com', 'broxxx.com', 'locally.com', 'top.gg', 'restaurant-guru.in',
  // Weather, travel, news & non-business aggregators
  'accuweather.com', 'weather.com', 'wunderground.com', 'open-meteo.com', 'weatherapi.com',
  'holidify.com', 'makemytrip.com', 'goibibo.com', 'yatra.com', 'trivago.com', 'booking.com', 'agoda.com',
  'skyscanner.com', 'expedia.com', 'cleartrip.com', 'ixigo.com',
  'magicbricks.com', '99acres.com', 'housing.com', 'nobroker.in', 'commonfloor.com',
  'shiksha.com', 'collegedunia.com', 'careers360.com', 'getmyuni.com',
  'ndtv.com', 'indiatoday.in', 'timesofindia.indiatimes.com', 'hindustantimes.com', 'indianexpress.com',
  'thehindu.com', 'news18.com', 'zeenews.india.com', 'aajtak.in', 'jagran.com', 'bhaskar.com', 'amarujala.com',
  'moneycontrol.com', 'economictimes.indiatimes.com', 'livemint.com', 'financialexpress.com', 'business-standard.com',
  'cricbuzz.com', 'espncricinfo.com', 'vasafitness.com', 'planetfitness.com', 'anytimefitness.com', 'crunch.com',
  'xnxx.com', 'xvideos.com', 'pornhub.com', 'redtube.com', 'youporn.com'
]);

function isDirectoryOrSocial(hostname) {
  const h = hostname.toLowerCase().replace(/^www\./, '');
  if (DIRECTORY_DOMAINS.has(h)) return true;
  for (const d of DIRECTORY_DOMAINS) {
    if (h.endsWith('.' + d)) return true;
  }
  return false;
}

const CITY_COORDS = {
  // India
  'indore, india': [22.7196, 75.8577], 'mumbai, india': [19.0760, 72.8777], 'delhi, india': [28.6139, 77.2090],
  'new delhi, india': [28.6139, 77.2090], 'bengaluru, india': [12.9716, 77.5946], 'pune, india': [18.5204, 73.8567],
  'hyderabad, india': [17.3850, 78.4867], 'jaipur, india': [26.9124, 75.7873], 'ahmedabad, india': [23.0225, 72.5714],
  'surat, india': [21.1702, 72.8311], 'chennai, india': [13.0827, 80.2707], 'kolkata, india': [22.5726, 88.3639],
  'chandigarh, india': [30.7333, 76.7794], 'noida, india': [28.5355, 77.3910], 'gurugram, india': [28.4595, 77.0266],
  'faridabad, india': [28.4089, 77.3178], 'ghaziabad, india': [28.6692, 77.4538], 'lucknow, india': [26.8467, 80.9462],
  'kanpur, india': [26.4499, 80.3319], 'bhopal, india': [23.2599, 77.4126], 'ujjain, india': [23.1765, 75.7885],
  'jabalpur, india': [23.1815, 79.9864], 'gwalior, india': [26.2183, 78.1828],
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
  // Indian States & UTs
  'madhya pradesh, india': [22.9734, 78.6569], 'maharashtra, india': [19.7515, 75.7139], 'gujarat, india': [22.2587, 71.1924],
  'rajasthan, india': [27.0238, 74.2179], 'karnataka, india': [15.3173, 75.7139], 'tamil nadu, india': [11.1271, 78.6569],
  'telangana, india': [18.1124, 79.0193], 'andhra pradesh, india': [15.9129, 79.7400], 'uttar pradesh, india': [26.8467, 80.9462],
  'west bengal, india': [22.9868, 87.8550], 'punjab, india': [31.1471, 75.3412], 'haryana, india': [29.0588, 76.0856],
  'kerala, india': [10.8505, 76.2711], 'bihar, india': [25.0961, 85.3131], 'odisha, india': [20.9517, 85.0985],
  'assam, india': [26.2006, 92.9376], 'jharkhand, india': [23.6102, 85.2799], 'chhattisgarh, india': [21.2787, 81.8661],
  'uttarakhand, india': [30.0668, 79.0193], 'himachal pradesh, india': [31.1048, 77.1734], 'jammu and kashmir, india': [33.7782, 76.5762],
  'tripura, india': [23.9408, 91.9882], 'meghalaya, india': [25.4670, 91.3662], 'manipur, india': [24.6637, 93.9063],
  'nagaland, india': [26.1584, 94.5624], 'arunachal pradesh, india': [28.2180, 94.7278], 'mizoram, india': [23.1645, 92.9376],
  'sikkim, india': [27.5330, 88.5122], 'puducherry, india': [11.9416, 79.8083],
  // US States
  'california, usa': [36.7783, -119.4179], 'texas, usa': [31.9686, -99.9018], 'florida, usa': [27.6648, -81.5158],
  'new york state, usa': [43.2994, -74.2179], 'illinois, usa': [40.6331, -89.3985], 'pennsylvania, usa': [41.2033, -77.1945],
  'ohio, usa': [40.4173, -82.9071], 'georgia, usa': [32.1656, -82.9001], 'north carolina, usa': [35.7596, -79.0193],
  'michigan, usa': [44.3148, -85.6024], 'new jersey, usa': [40.0583, -74.4057], 'virginia, usa': [37.4316, -78.6569],
  'washington state, usa': [47.7511, -120.7401], 'arizona, usa': [34.0489, -111.0937], 'massachusetts, usa': [42.4072, -71.3824],
  'colorado, usa': [39.5501, -105.7821], 'nevada, usa': [38.8026, -116.4194], 'tennessee, usa': [35.5175, -86.5804],
  'maryland, usa': [39.0458, -76.6413], 'minnesota, usa': [46.7296, -94.6859], 'oregon, usa': [43.8041, -120.5542],
  // Canadian Provinces
  'ontario, canada': [51.2538, -85.3232], 'british columbia, canada': [53.7267, -127.6476], 'quebec, canada': [52.9399, -73.5491],
  'alberta, canada': [53.9333, -116.5765], 'manitoba, canada': [53.7609, -98.8139], 'nova scotia, canada': [44.6820, -63.7443],
  // Latin America & Africa
  'mexico city, mexico': [19.4326, -99.1332], 'sao paulo, brazil': [-23.5505, -46.6333],
  'buenos aires, argentina': [-34.6037, -58.3816], 'bogota, colombia': [4.7110, -74.0721],
  'santiago, chile': [-33.4489, -70.6693], 'johannesburg, south africa': [-26.2041, 28.0473],
  'cape town, south africa': [-33.9249, 18.4241], 'nairobi, kenya': [-1.2921, 36.8219], 'lagos, nigeria': [6.5244, 3.3792],
};

const geoCache = new Map();
const boxFromCenter = (lat, lon, name) => ({
  lat,
  lon,
  display_name: name,
  boundingbox: [lat - 0.20, lat + 0.20, lon - 0.20, lon + 0.20]
});

async function geocode(area) {
  const key = String(area || '').trim().toLowerCase();
  if (CITY_COORDS[key]) return boxFromCenter(...CITY_COORDS[key], area.trim());
  if (geoCache.has(key)) return geoCache.get(key);

  // 1) Photon (OSM-based, fast & cloud-friendly)
  try {
    const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(area)}&limit=1`, { headers: { 'User-Agent': CONTACT_UA }, signal: AbortSignal.timeout(8000) });
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
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en`, { signal: AbortSignal.timeout(8000) });
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
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(area)}`, { headers: { 'User-Agent': CONTACT_UA, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(10000) });
    if (r.ok) {
      const j = await r.json();
      if (j.length) {
        geoCache.set(key, j[0]);
        return j[0];
      }
    }
  } catch { /* fallback */ }

  return boxFromCenter(0, 0, area);
}

function buildQuery(place, categories, limit, needWebsite) {
  let [s, n, w, e] = place.boundingbox.map(Number);
  const lat = Number(place.lat), lon = Number(place.lon);
  if (n - s > 0.32) { s = lat - 0.16; n = lat + 0.16; }
  if (e - w > 0.32) { w = lon - 0.16; e = lon + 0.16; }
  const scope = `(${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)})`;
  const wfs = needWebsite ? ['["website"]', '["contact:website"]'] : [''];
  const lines = [];
  for (const cat of categories) {
    const filters = CATEGORIES[cat];
    if (!filters) continue;
    for (const [k, v] of filters) {
      for (const wf of wfs) {
        lines.push(`node["${k}"~"^(${v})$"]${wf}${scope};`);
      }
    }
  }
  if (!lines.length) return '';
  const effectiveLimit = Math.max(limit, 350);
  return `[out:json][timeout:25];(${lines.join('')});out center tags ${effectiveLimit};`;
}

const overpassCache = new Map();
// Query Overpass mirrors with resilient 25s timeout and instant cache
async function overpass(query, onTick = () => {}) {
  if (!query) return { elements: [] };
  const hit = overpassCache.get(query);
  if (hit && Date.now() - hit.t < 600_000) return hit.j;
  const ctrl = new AbortController();
  const hard = setTimeout(() => ctrl.abort(), 25000);
  const t0 = Date.now();
  const pulse = setInterval(() => onTick(Math.round((Date.now() - t0) / 1000)), 2000);
  try {
    const j = await Promise.any(OVERPASS.map(async (ep) => {
      const r = await fetch(ep, {
        method: 'POST',
        headers: { 'User-Agent': OVERPASS_UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: ctrl.signal,
      });
      if (!r.ok) throw new Error(`Overpass HTTP ${r.status}`);
      const json = await r.json();
      if (json.elements && json.elements.length > 0) return json;
      throw new Error(json.remark || '0 elements');
    }));
    overpassCache.set(query, { t: Date.now(), j });
    return j;
  } finally {
    clearInterval(pulse);
    clearTimeout(hard);
    ctrl.abort();
  }
}

// Live Multi-Source Business Discovery: DuckDuckGo + Nominatim POI + Google Places / Bing + Directory
async function searchMultiSource(categoryKey, location, maxSites = 150, platform = 'all') {
  const kw = CATEGORY_SEARCH_TERMS[categoryKey] || categoryKey.replace(/_/g, ' ');
  const results = [];
  const seenHosts = new Set();

  function isJunkOrDirectory(host, url, title) {
    if (isDirectoryOrSocial(host)) return true;
    if (/weather|forecast|accuweather|climate|hourly|radar/i.test(host + ' ' + url + ' ' + title)) return true;
    if (/holidify|makemytrip|yatra|goibibo|trivago|booking\.com|agoda|skyscanner/i.test(host)) return true;
    if (/magicbricks|99acres|housing\.com|nobroker|shiksha|collegedunia/i.test(host)) return true;
    if (/dictionary|meaning|wiktionary|merriam|thefreedictionary|cambridge\.org/i.test(host + ' ' + url)) return true;
    if (/xnxx|xvideos|porn|adult|erotic|sex|threesome|compilation/i.test(host + ' ' + url + ' ' + title)) return true;
    if (/(^|\W)(top\s*\d+|best\s*\d+|how\s+to|what\s+is|definition|guide\b|review)($|\W)/i.test(title)) return true;
    if (/\/(blog|articles?|news|wiki|tags?|category|topic|recipes?|definition)\//i.test(url)) return true;
    return false;
  }

  function addUrl(rawUrl, source, title = '') {
    if (!rawUrl || results.length >= maxSites) return;
    try {
      let finalUrl = rawUrl;
      if (rawUrl.includes('uddg=')) {
        const u = new URL(rawUrl.startsWith('http') ? rawUrl : 'https://duckduckgo.com' + rawUrl);
        finalUrl = decodeURIComponent(u.searchParams.get('uddg') || '');
      }
      if (!/^https?:\/\//i.test(finalUrl)) return;
      const u = new URL(finalUrl);
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      if (seenHosts.has(host) || isJunkOrDirectory(host, finalUrl, title)) return;

      // Ensure relevance: site MUST match at least one niche keyword
      const kwWords = kw.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 2);
      const combined = (title + ' ' + host + ' ' + finalUrl).toLowerCase();
      const matchesKw = kwWords.some((w) => combined.includes(w));
      if (!matchesKw) return;

      seenHosts.add(host);
      results.push({
        source,
        name: title && title.length > 2 && title.length < 65 ? title.replace(/\s*[|\-–—].*$/, '').trim() : host.split('.')[0].replace(/[-_]/g, ' '),
        website: u.origin,
        address: location,
        category: categoryKey,
        phone: '',
        email: '',
        instagram: '',
        facebook: '',
        lat: null,
        lon: null,
        osm: ''
      });
    } catch {}
  }

  // 1. DuckDuckGo Local Business Web Discovery
  const ddgProm = (async () => {
    try {
      const q = `"${categoryKey.replace(/_/g, ' ')}" in "${location}" contact website -site:accuweather.com -site:weather.com -site:wikipedia.org`;
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
        headers: {
          'User-Agent': CONTACT_UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(7000)
      });
      if (res.ok) {
        const html = await res.text();
        const matches = [...html.matchAll(/<a class="result__url" href="([^"]+)">([\s\S]*?)<\/a>/g)];
        for (const m of matches) {
          let raw = m[1];
          if (raw.includes('uddg=')) {
            const match = raw.match(/uddg=([^&]+)/);
            if (match) raw = decodeURIComponent(match[1]);
          }
          addUrl(raw, 'Web Discovery', (m[2] || '').replace(/<[^>]+>/g, '').trim());
        }
      }
    } catch {}
  })();

  // 2. OpenStreetMap Nominatim Direct Place Search
  const nomProm = (async () => {
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${kw} in ${location}`)}&format=json&addressdetails=1&limit=25`;
      const res = await fetch(nomUrl, {
        headers: { 'User-Agent': OVERPASS_UA, 'Accept-Language': 'en' },
        signal: AbortSignal.timeout(7000)
      });
      if (res.ok) {
        const items = await res.json();
        for (const item of items) {
          if (!item.display_name) continue;
          const name = item.display_name.split(',')[0].trim();
          if (!name || name.length < 2) continue;
          const key = (name + '|' + item.display_name).toLowerCase();
          if (seenHosts.has(key)) continue;
          seenHosts.add(key);
          results.push({
            source: 'Nominatim / OSM',
            name,
            website: '',
            address: item.display_name,
            category: categoryKey,
            phone: '',
            email: '',
            instagram: '',
            facebook: '',
            lat: Number(item.lat),
            lon: Number(item.lon),
            osm: `https://www.openstreetmap.org/${item.osm_type || 'node'}/${item.osm_id || ''}`
          });
        }
      }
    } catch {}
  })();

  // 3. Multi-angle queries across directory channels (Google Places, YellowPages, Yelp)
  const angles = [
    { source: 'Google Places', q: `"${kw}" in "${location}" "google.com/maps" OR "maps.google.com" official site` },
    { source: 'Google Places', q: `top ${kw} in ${location} contact phone official website` },
    { source: 'YellowPages', q: `"${kw}" in "${location}" "yellowpages" OR "directory" official website` },
    { source: 'Yelp', q: `site:yelp.com/biz "${kw}" "${location}"` },
    { source: 'Web Discovery', q: `"${kw}" "${location}" official website contact phone` }
  ];

  if (platform === 'both' || platform === 'wordpress' || platform === 'woocommerce') {
    angles.push(
      { source: 'Web Discovery', q: `"${kw}" in "${location}" "wp-content" official website` },
      { source: 'Web Discovery', q: `"${kw}" in "${location}" "woocommerce" order contact` }
    );
  }
  if (platform === 'shopify' || platform === 'both') {
    angles.push(
      { source: 'Web Discovery', q: `"${kw}" in "${location}" "cdn.shopify.com" OR "myshopify.com"` }
    );
  }

  const bingProm = Promise.allSettled(angles.map(async ({ source, q }) => {
    try {
      const res = await fetch(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(q)}&setmkt=en-US`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        const xml = await res.text();
        for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
          const item = m[1];
          const t = (item.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
          const l = (item.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
          if (l) addUrl(l, source, t.replace(/&amp;/g, '&'));
        }
      }
    } catch {}
  }));

  await Promise.allSettled([ddgProm, nomProm, bingProm]);
  return results;
}

function toBusiness(el) {
  const t = el.tags || {};
  const addr = [t['addr:housenumber'], t['addr:street'], t['addr:suburb'] || t['addr:district'], t['addr:city'], t['addr:postcode']].filter(Boolean).join(', ');
  let ws = (t.website || t['contact:website'] || t.url || '').trim();
  let fb = (t['contact:facebook'] || '').trim();
  let ig = (t['contact:instagram'] || '').trim();

  if (ws && /facebook\.com/i.test(ws)) {
    if (!fb) fb = ws;
    ws = '';
  }
  if (ws && /instagram\.com/i.test(ws)) {
    if (!ig) ig = ws;
    ws = '';
  }
  if (ws && !/^https?:\/\//i.test(ws)) {
    ws = 'https://' + ws.replace(/^\/\//, '');
  }
  if (ws) {
    try {
      const u = new URL(ws);
      if (isDirectoryOrSocial(u.hostname)) ws = '';
    } catch { ws = ''; }
  }

  return {
    source: 'OpenStreetMap',
    name: t.name || t['name:en'] || '(no name)',
    category: t.shop || t.amenity || t.tourism || t.office || t.leisure || t.healthcare || '',
    website: ws,
    phone: t.phone || t['contact:phone'] || t['contact:mobile'] || '',
    email: t.email || t['contact:email'] || '',
    instagram: ig,
    facebook: fb,
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
 * opts: { area, areas, category, categories, platform, maxScan, signal, onProgress }
 */
export async function findLeads({ area, areas, category, categories, platform = 'both', maxScan = 300, signal = null, onProgress = () => {} }) {
  const rawAreas = (Array.isArray(areas) && areas.length ? areas : [area]).map((a) => String(a || '').trim()).filter(Boolean);
  const catList = (Array.isArray(categories) && categories.length ? categories : [category]).filter((c) => CATEGORIES[c]);
  if (!rawAreas.length) throw new Error('Select at least one location.');
  if (!catList.length) throw new Error('Select at least one niche/category.');

  // Expand state-level selections to their major metropolitan business hubs
  const areaList = [];
  for (const a of rawAreas) {
    const low = a.toLowerCase();
    if (STATE_EXPANSIONS[low]) {
      areaList.push(...STATE_EXPANSIONS[low]);
    } else {
      areaList.push(a);
    }
  }

  const noWebsiteMode = platform === 'nowebsite';
  const seen = new Set();
  const leads = [];
  const places = [];
  let scanned = 0;

  // Stream leads immediately per location so table fills up in real time!
  for (let ai = 0; ai < areaList.length; ai++) {
    if (signal?.aborted || (!noWebsiteMode && scanned >= maxScan)) break;
    const ar = areaList[ai];
    onProgress({ stage: 'geocode', msg: `[${ai + 1}/${areaList.length}] Sourcing leads in "${ar}" (Google Places, YellowPages, Yelp, OSM, Web)...` });
    
    try {
      const chunk = [];

      // 1 & 2: Concurrently query Multi-Source Live Web Directories + OSM Map Server
      const [multiRes, mapRes] = await Promise.allSettled([
        (async () => {
          if (noWebsiteMode) return [];
          const list = [];
          for (const catKey of catList) {
            if (signal?.aborted) break;
            const res = await searchMultiSource(catKey, ar, Math.min(150, maxScan - scanned), platform);
            list.push(...res);
          }
          return list;
        })(),
        (async () => {
          const place = await geocode(ar);
          places.push(place.display_name || ar);
          const q = buildQuery(place, catList, noWebsiteMode ? 500 : Math.max(maxScan - scanned, 350), platform !== 'all' && !noWebsiteMode);
          if (!q) return [];
          const data = await overpass(q, (sec) => onProgress({ stage: 'log', msg: `⏳ Querying map server (${sec}s)...` }));
          return (data.elements || []).map(toBusiness);
        })()
      ]);

      if (multiRes.status === 'fulfilled') {
        for (const b of multiRes.value) {
          const key = domainKey(b.website, b.name, b.address);
          if (seen.has(key)) continue;
          seen.add(key);
          chunk.push(b);
        }
      }
      if (mapRes.status === 'fulfilled') {
        for (const b of mapRes.value) {
          const key = domainKey(b.website, b.name, b.address);
          if (seen.has(key) || b.name === '(no name)') continue;
          seen.add(key);
          chunk.push(b);
        }
      } else {
        if (chunk.length > 0) {
          onProgress({ stage: 'log', msg: `• Map server busy — continuing with ${chunk.length} live businesses found from YellowPages, Yelp, Google Places & Web in ${ar}...` });
        } else {
          onProgress({ stage: 'log', msg: `• Map server busy in ${ar} — switching to live directory search...` });
        }
      }

      // 3. Process chunk: Separate into businesses with websites vs without websites
      const withWeb = chunk.filter((b) => Boolean(b.website));
      const withoutWeb = chunk.filter((b) => !b.website && b.name && b.name !== '(no name)');

      if (noWebsiteMode) {
        for (const b of withoutWeb) {
          const lead = {
            ...b,
            address: b.address || ar,
            source: b.source || 'OpenStreetMap',
            platform: 'No Website',
            website: '',
            theme: '',
            wpVersion: '',
            woocommerce: false,
            emails: b.email ? [b.email] : [],
            phones: b.phone ? [b.phone] : [],
            socials: { ...(b.instagram ? { instagram: b.instagram } : {}), ...(b.facebook ? { facebook: b.facebook } : {}) },
            opportunities: [
              'Business has NO website – Pitch a new modern website & Google Maps profile',
              'High Value Web Development Lead'
            ]
          };
          leads.push(lead);
          onProgress({ stage: 'lead', lead });
        }
        continue;
      }

      // If platform === 'all', ALSO output businesses without websites so user can pitch web development to them!
      if (platform === 'all') {
        for (const b of withoutWeb) {
          const lead = {
            ...b,
            address: b.address || ar,
            source: b.source || 'OpenStreetMap',
            platform: 'No Website',
            website: '',
            theme: '',
            wpVersion: '',
            woocommerce: false,
            emails: b.email ? [b.email] : [],
            phones: b.phone ? [b.phone] : [],
            socials: { ...(b.instagram ? { instagram: b.instagram } : {}), ...(b.facebook ? { facebook: b.facebook } : {}) },
            opportunities: [
              'Business has NO website – Pitch a new modern website & Google Maps profile',
              'High Value Web Development Lead'
            ]
          };
          leads.push(lead);
          onProgress({ stage: 'lead', lead });
        }
      }

      const toScan = withWeb.slice(0, maxScan - scanned);
      if (!toScan.length) {
        if (!withoutWeb.length) {
          onProgress({ stage: 'log', msg: `• ${ar}: 0 new businesses found` });
        }
        continue;
      }

      // Compute source breakdown
      const srcStats = {};
      for (const b of toScan) {
        const s = b.source || 'Web Discovery';
        srcStats[s] = (srcStats[s] || 0) + 1;
      }
      const srcSummary = Object.entries(srcStats).map(([s, n]) => `${n} ${s}`).join(' • ');

      onProgress({ stage: 'scan', msg: `• ${ar}: ${toScan.length} businesses sourced (${srcSummary}) — inspecting live tech, emails & phones...` });

      await pool(toScan, 25, async (b) => {
        if (signal?.aborted) return;
        const a = await analyzeSite(b.website);
        scanned++;
        const lead = {
          ...b,
          source: b.source || 'Web Discovery',
          name: a.title && a.title.length > 2 && a.title.length < 75 && !/just a moment|attention required|403|404|not found/i.test(a.title) ? a.title.replace(/\s*[|\-–—].*$/, '').trim() : b.name,
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
        if (platform in matchMap ? matchMap[platform] : true) {
          leads.push(lead);
          onProgress({ stage: 'lead', lead });
        }
        onProgress({ stage: 'progress', done: scanned, total: maxScan });
      });
    } catch (e) {
      onProgress({ stage: 'log', msg: `⚠ ${ar}: ${e.message}` });
    }
  }

  leads.sort((x, y) => (y.emails.length > 0) - (x.emails.length > 0) || y.opportunities.length - x.opportunities.length);
  onProgress({
    stage: 'done',
    msg: `Done. ${leads.length} matching leads out of ${scanned} sites scanned.${leads.length < 25 && platform !== 'all' ? ' (Tip: Select "All websites" in Platform dropdown to see all ' + scanned + ' businesses!)' : ''}`
  });
  return { place: places.join(' | ') || rawAreas.join(', '), scanned, leads };
}
