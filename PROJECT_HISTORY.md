# 📜 Project History & Handover Context — Lead & Job Agent

> **Use this file on any new PC or AI coding assistant** (Antigravity, Cursor, Copilot, etc.) to immediately understand the full project history, user preferences, architecture, and setup without losing any context.

---

## 1. Owner & Identity
- **Name:** Praveen Pathak (`parvpathak12@gmail.com`, `+91 8109567672`, Indore, India)
- **Role:** Senior Web Designer (14.5+ years experience — WordPress, WooCommerce, Shopify, HTML5, CSS3, Bootstrap, JS/jQuery, Figma, Photoshop, Illustrator, CorelDraw, InDesign, Graphic Design)
- **Resume File:** `data/Praveen-Pathak-Sr.WebDesigner.docx` (bundled in repo, downloadable via `/api/resume`)
- **GitHub Repo:** `https://github.com/praveenpathak/lead-job-agent` (`main` branch)
- **Live URL:** `https://lead-job-agent.onrender.com`
- **Important Git Isolation Rule:** Personal repo uses `praveenpathak` (`credential.useHttpPath = true`, `https://praveenpathak@github.com/praveenpathak/lead-job-agent.git`). **NEVER** link or push this project to the office account `Amipiwebdev`.

---

## 2. Chronological Build & Conversation History
1. **Core Lead & Job Engine:** Built zero-dependency Node.js 18+ app (`server.js`) with OpenStreetMap (Overpass) business discovery, website tech/contact/SEO analyzer (`lib/detect.js`), and 6 public remote job boards (`lib/jobs.js`: Remotive, RemoteOK, Jobicy, WeWorkRemotely, Arbeitnow, Himalayas).
2. **Resume Integration & Apply Assistant (`lib/apply.js`):** Parsed `Praveen-Pathak-Sr.WebDesigner.docx` into `DEFAULT_PROFILE`, added job match %, India/Worldwide eligibility tags, tailored Cover Letters, and `/api/resume` download.
3. **Locations & IT Tech Stacks:** Expanded to **130+ global locations** (all 28 Indian States + UTs + 37+ Indian cities, 21 US States + 21 US Cities, Canada provinces/cities, UAE/Middle East, UK, Europe, APAC, LATAM, Africa) with **Multi-Select Searchable Checkbox Dropdowns** for both **Locations** and **43 Niches** (including `roofing_construction`, `real_estate`, `jewelry`, `restaurant`, `cosmetics_skincare`, `home_services_solar`, `it_software`, `architecture_cad`, `graphic_printing`, etc.). Added PHP, Laravel, CodeIgniter, React/Next.js, Angular, Vue/Nuxt, Bootstrap, SEO Fix, and Redesign detection.
4. **Remote Job Filters & Portals:** Added `Job Type` (`Full-Time`, `Contract`, `Part-Time`), `Work Mode` (`Remote Only` vs `Remote + On-site/Hybrid`), `Skill Presets` (incl. `CAD + Graphic Design`), plus 1-click search buttons for **LinkedIn Jobs, LinkedIn Hiring Posts, Naukri, Indeed, Glassdoor**, and **Google Maps**.
5. **Safe LinkedIn Integration:** Avoided risky credential scraping; added 1-click **`in LinkedIn Leads`**, **`in Owner`** (per business), and **`📋 Copy Short DM (300c)`** (with quote-safe `currentShortDM` + floating toast notification).
6. **High-Converting Pitch & Portfolio Separation:**
   - **Strict Portfolio Matching:** WordPress leads/jobs ONLY show Top 5 WordPress URLs (`orbitlocal.com`, `hanahunter.com`, `facelabvaldosta.com`, `stjohnskids.com`, `agoodelectricianllc.com`); Shopify leads/jobs ONLY show Top 5 Shopify URLs (`thehimalayanorganics.in`, `samayajewelry.com`, `brillianttouchllc.com`, `bfriesian.com`, `emmajewelryusa.com`).
   - **Tone Switcher:** `Friendly & Positive`, `USA/Dubai Corporate`, `Indian Business (Hinglish Warm)`, and `My Custom Template` (`{name}`, `{website}`, `{platform}`, `{issue}`).
   - **Clean Site Pitch:** Websites with 0 issues automatically get a **Monthly Maintenance & Design Support** pitch (`Clean site → Maintenance pitch`).
   - **Curiosity-Driven Marketing Short DMs:** 300-char hooks for WhatsApp / Instagram / LinkedIn.
   - **1-Click Outreach:** `📧 Open in Gmail` (web compose pre-filled), `💬 WhatsApp` (from phone digits), `📸 Instagram`, `📘 Facebook`, `🌐 Contact Form`.
7. **Closing, Tracking & Persistence:**
   - **Browser `localStorage` Persistence:** Persists leads, jobs, URL checks, profile, presets, and `My Applications` across page refreshes and Render free-tier restarts.
   - **CRM & Closing Tools:** `🔥 Hot / ⚡ Warm` lead score, `⚡ Pitch Queue` (`⏭ Next Lead`), `📄 Audit PDF`, `💵 Quote PDF`, `📊 Speed Proof` (PageSpeed), `📞 Call Script`, inline Call Notes, `Deal ($)` & `Won` pipeline stats, `📊 Today's Goal` (`10 Pitches / 5 Applies`), `⏰ 3-Day Follow-up Due` + Morning Banner.
   - **No-JSON Backups:** `📋 Copy Sync Code` / `📥 Restore Sync Code` (`LGA1:...` Base64 string for WhatsApp/Notes/Gmail), `⬇ Excel / CSV`, and optional **Google Sheets Auto-Sync Webhook**.
8. **UI & Performance:** Full-width Light-Theme SaaS CRM shell (left sidebar + workspace), per-location live lead streaming (`⏹ Stop` button), built-in city/state coordinates + Photon/Open-Meteo fallbacks (fixes Nominatim HTTP 429), and 10-min Overpass cache + 5s stream heartbeat.

---

## 3. Architecture & File Map
- `server.js` — Zero-dependency HTTP server (`PORT` env or `3777`), NDJSON streaming for `/api/leads`, `/api/check-urls`, `/api/jobs`, plus `/api/pitch`, `/api/cover-letter`, `/api/profile`, `/api/applications`, `/api/resume`.
- `lib/detect.js` — Fetches HTML + `/contact` page, detects CMS/tech stack, extracts emails/phones/socials, flags SEO/speed/SSL/mobile opportunities.
- `lib/leads.js` — Geocoding (`CITY_COORDS` + Photon + Open-Meteo + Nominatim), clamped bbox Overpass queries with 4 mirrors + 10-min cache + 5s heartbeat, per-location streaming.
- `lib/jobs.js` — Fetches 6 public job boards in parallel, filters by keyword/region/type/mode, scores against profile.
- `lib/apply.js` — Profile defaults, strict WP/Shopify project picker, Pitch & Cover Letter generators, `humanIssue` mapper.
- `public/index.html` — Full-width Light-Theme CRM SPA with `localStorage` persistence, multi-select dropdowns, modals, PDF generators.
- `render.yaml` — Render.com Blueprint config (`node server.js`, Node 22).
- `start.bat` — Windows 1-click launcher.

---

## 4. How to Run on a New System
1. Install **Node.js 18+**.
2. Clone the repo:
   ```bash
   git clone https://github.com/praveenpathak/lead-job-agent.git
   cd lead-job-agent
   ```
3. Isolate personal git config (optional):
   ```bash
   git config --local credential.useHttpPath true
   git config user.name "Praveen Pathak"
   git config user.email "parvpathak12@gmail.com"
   ```
4. Start the app:
   - Windows: double-click `start.bat`
   - Any OS: `node server.js` → open `http://localhost:3777`
5. Transfer saved data from old PC: Click **`📋 Copy Sync Code`** on the old PC → click **`📥 Restore Sync Code`** on the new PC.
