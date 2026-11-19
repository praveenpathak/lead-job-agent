// lib/audit.js – Generates high-converting, mobile-responsive Client Technical Audit Landing Pages
import crypto from 'node:crypto';

const auditStore = new Map();

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[m]));
}

export function createAuditRecord(lead, profile = {}) {
  const hash = crypto.createHash('md5').update(`${lead.name || ''}_${lead.address || ''}_${lead.website || ''}_${Date.now()}`).digest('hex').slice(0, 10);
  const record = {
    id: hash,
    lead,
    profile,
    createdAt: new Date().toISOString()
  };
  auditStore.set(hash, record);
  return { id: hash, url: '/audit/' + hash };
}

export function getAuditRecord(id) {
  return auditStore.get(id);
}

export function calculateHealthScore(lead) {
  let score = 100;
  const isNoWeb = lead.platform === 'No Website' || !lead.website;
  if (isNoWeb) return 32;

  const ops = lead.opportunities || [];
  const opsText = ops.join(' ').toLowerCase();

  if (lead.reachable === false) score -= 45;
  if (/no ssl|https/i.test(opsText)) score -= 20;
  if (/slow|heavy/i.test(opsText)) score -= 18;
  if (/missing seo|missing h1/i.test(opsText)) score -= 15;
  if (/no opengraph|smo/i.test(opsText)) score -= 12;
  if (/not mobile responsive/i.test(opsText)) score -= 25;
  if (/outdated/i.test(opsText)) score -= 15;
  if (!lead.socials?.instagram && !lead.socials?.facebook) score -= 10;

  return Math.max(28, Math.min(88, score));
}

export function renderAuditHTML(lead, profile = {}, host = 'localhost:3777') {
  const score = calculateHealthScore(lead);
  const isNoWeb = lead.platform === 'No Website' || !lead.website;
  const niche = lead.category ? lead.category.replace(/_/g, ' ') : 'Business';
  const consultantName = profile.name || 'Praveen Pathak';
  const consultantPhone = profile.phone || '+91 8109567672';
  const consultantEmail = profile.email || 'parvpathak12@gmail.com';
  const consultantTitle = profile.title || 'Senior Web & Digital Growth Specialist (14.5+ Yrs Exp)';
  const waDigits = consultantPhone.replace(/\D/g, '');

  const waLeadMsg = encodeURIComponent(`Hi ${consultantName}, I just reviewed the digital audit report for "${lead.name}". I'd like to discuss fixing these issues and growing our customer inquiries.`);
  const waCtaUrl = `https://wa.me/${waDigits}?text=${waLeadMsg}`;

  const ops = lead.opportunities || [];
  const opsText = ops.join(' ').toLowerCase();

  const checks = [
    {
      title: 'Mobile Usability & Fast Loading',
      status: isNoWeb ? 'fail' : (/slow|heavy|not mobile/i.test(opsText) ? 'warn' : 'pass'),
      detail: isNoWeb
        ? 'No mobile website detected. Over 82% of local searchers use mobile phones to find services.'
        : (/slow/i.test(opsText) ? 'Page loads slowly on mobile devices, causing high visitor drop-off rates.' : 'Basic mobile layout accessible.')
    },
    {
      title: 'Google Search & Local SEO Visibility',
      status: isNoWeb || /missing seo|missing h1|meta/i.test(opsText) ? 'fail' : 'warn',
      detail: isNoWeb
        ? 'Business is missing On-Page SEO and Google rich local search schema.'
        : 'Missing critical H1 or meta description tags needed to rank on Page 1 of Google.'
    },
    {
      title: 'Google Maps & Local Customer Inquiries',
      status: (lead.phones || []).length ? 'pass' : 'warn',
      detail: (lead.phones || []).length
        ? `Reachable phone detected (${(lead.phones || [])[0]}), but needs 1-click WhatsApp booking button.`
        : 'No direct phone or instant inquiry channel configured for prospective clients.'
    },
    {
      title: 'Social Media & Social Sharing (SMO)',
      status: lead.socials?.instagram || lead.socials?.facebook ? 'pass' : 'fail',
      detail: lead.socials?.instagram || lead.socials?.facebook
        ? 'Active social media presence detected. High potential for daily post & festival creative campaigns.'
        : 'Missing linked social media profiles or OpenGraph sharing preview tags.'
    },
    {
      title: 'Marketing Collaterals & Promotional Creatives',
      status: 'warn',
      detail: 'Needs modern marketing flyers, pamphlets, table standees, and daily branded festival posts to retain regular customers.'
    },
    {
      title: 'SSL Security & Trust Badge',
      status: isNoWeb ? 'fail' : (/no ssl|http:/i.test(opsText) ? 'fail' : 'pass'),
      detail: isNoWeb
        ? 'No official secure online presence.'
        : (/no ssl/i.test(opsText) ? 'Insecure HTTP connection. Browsers mark the site as "Not Secure".' : 'Valid SSL encryption active.')
    }
  ];

  let scoreColor = '#dc2626';
  let scoreLabel = 'Critical Attention Needed';
  let scoreBg = '#fef2f2';
  if (score >= 70) {
    scoreColor = '#059669';
    scoreLabel = 'Good Foundation — Growth Tweaks Ready';
    scoreBg = '#ecfdf5';
  } else if (score >= 50) {
    scoreColor = '#d97706';
    scoreLabel = 'Average — Missing Key Growth Elements';
    scoreBg = '#fffbeb';
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Digital Presence Audit: ${esc(lead.name)}</title>
  <meta name="description" content="Complimentary digital presence and website technical audit prepared for ${esc(lead.name)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #4f46e5;
      --primary-dark: #4338ca;
      --bg: #f8fafc;
      --card: #ffffff;
      --text: #0f172a;
      --muted: #64748b;
      --border: #e2e8f0;
      --green: #059669;
      --red: #dc2626;
      --amber: #d97706;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.55;
      padding-bottom: 90px;
    }
    .top-bar {
      background: #0f172a;
      color: #94a3b8;
      font-size: 11.5px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .08em;
      padding: 10px 20px;
      text-align: center;
    }
    .top-bar span { color: #38bdf8; }
    .container {
      max-width: 860px;
      margin: 0 auto;
      padding: 24px 18px;
    }
    .header-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 26px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.04);
      margin-bottom: 22px;
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      justify-content: space-between;
      align-items: center;
    }
    .client-title {
      font-size: 24px;
      font-weight: 800;
      color: var(--text);
      letter-spacing: -0.02em;
    }
    .client-sub {
      color: var(--muted);
      font-size: 13.5px;
      margin-top: 4px;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
    }
    .badge-niche { background: #e0e7ff; color: #4338ca; }
    .badge-loc { background: #f1f5f9; color: #475569; }
    
    .score-box {
      background: ${scoreBg};
      border: 2px solid ${scoreColor}33;
      border-radius: 14px;
      padding: 16px 22px;
      text-align: center;
      min-width: 170px;
    }
    .score-num {
      font-size: 42px;
      font-weight: 800;
      color: ${scoreColor};
      line-height: 1;
    }
    .score-denom { font-size: 18px; color: var(--muted); font-weight: 600; }
    .score-lbl {
      font-size: 11px;
      font-weight: 700;
      color: ${scoreColor};
      text-transform: uppercase;
      letter-spacing: .05em;
      margin-top: 5px;
    }

    .section-title {
      font-size: 17px;
      font-weight: 700;
      color: var(--text);
      margin: 28px 0 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .check-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 14px;
    }
    .check-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
      transition: transform .15s, box-shadow .15s;
    }
    .check-card:hover {
      box-shadow: 0 8px 24px rgba(0,0,0,0.06);
    }
    .check-hdr {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    .icon-fail { color: var(--red); font-size: 18px; }
    .icon-warn { color: var(--amber); font-size: 18px; }
    .icon-pass { color: var(--green); font-size: 18px; }
    .check-title { font-weight: 700; font-size: 14px; color: var(--text); }
    .check-desc { font-size: 12.5px; color: var(--muted); line-height: 1.5; }

    .compare-card {
      background: linear-gradient(135deg, #ffffff, #f8fafc);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      margin-top: 24px;
    }
    .compare-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 16px;
    }
    @media (max-width: 640px) {
      .compare-grid { grid-template-columns: 1fr; }
    }
    .comp-col {
      padding: 16px;
      border-radius: 12px;
    }
    .comp-current {
      background: #fef2f2;
      border: 1px solid #fecaca;
    }
    .comp-growth {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
    }
    .comp-title {
      font-size: 13.5px;
      font-weight: 800;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .comp-list { list-style: none; font-size: 12.5px; }
    .comp-list li {
      margin-bottom: 8px;
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }

    .consultant-card {
      background: #0f172a;
      color: #fff;
      border-radius: 16px;
      padding: 24px;
      margin-top: 26px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }
    .cons-info b { font-size: 17px; display: block; color: #fff; }
    .cons-info span { font-size: 12.5px; color: #94a3b8; }
    .cons-btn {
      background: #059669;
      color: #fff;
      text-decoration: none;
      padding: 12px 22px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 14px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 15px rgba(5,150,105,0.35);
      transition: all .2s;
    }
    .cons-btn:hover { background: #047857; transform: translateY(-1px); }

    .sticky-bar {
      position: fixed;
      bottom: 0;
      inset-inline: 0;
      background: #ffffff;
      border-top: 1px solid var(--border);
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.08);
      z-index: 90;
    }
    .sticky-bar .txt { font-size: 12px; color: var(--muted); }
    .sticky-bar .txt b { color: var(--text); }
  </style>
</head>
<body>

  <div class="top-bar">
    🔒 Confidential Technical Audit &bull; Prepared by <span>${esc(consultantName)}</span>
  </div>

  <div class="container">
    <div class="header-card">
      <div>
        <div class="client-sub">
          <span class="badge badge-niche">📂 ${esc(niche)}</span>
          <span class="badge badge-loc">📍 ${esc(lead.address || 'Local Region')}</span>
        </div>
        <h1 class="client-title" style="margin-top:8px">${esc(lead.name)}</h1>
        <p style="font-size:13px;color:var(--muted);margin-top:4px">
          ${isNoWeb ? '⚠️ <b>No Official Mobile Website Detected</b>' : `🌐 Live URL: <a href="${esc(lead.website)}" target="_blank" style="color:#4f46e5;text-decoration:none">${esc(lead.website)}</a>`}
        </p>
      </div>
      <div class="score-box">
        <div class="score-num">${score}<span class="score-denom">/100</span></div>
        <div class="score-lbl">${esc(scoreLabel)}</div>
      </div>
    </div>

    <div class="section-title">
      🔍 6-Point Technical &amp; Growth Assessment
    </div>
    <div class="check-grid">
      ${checks.map((c) => `
        <div class="check-card">
          <div class="check-hdr">
            <span class="${c.status === 'pass' ? 'icon-pass' : (c.status === 'fail' ? 'icon-fail' : 'icon-warn')}">
              ${c.status === 'pass' ? '✔' : (c.status === 'fail' ? '✖' : '⚠')}
            </span>
            <span class="check-title">${esc(c.title)}</span>
          </div>
          <div class="check-desc">${esc(c.detail)}</div>
        </div>
      `).join('')}
    </div>

    <div class="compare-card">
      <h3 style="font-size:16px;font-weight:800;color:var(--text)">🚀 Revenue Growth Roadmap for ${esc(lead.name)}</h3>
      <p style="font-size:12.5px;color:var(--muted);margin-top:4px">How modernizing your digital presence converts local searchers into paying clients:</p>
      
      <div class="compare-grid">
        <div class="comp-col comp-current">
          <div class="comp-title" style="color:#b91c1c">❌ Current Situation</div>
          <ul class="comp-list" style="color:#991b1b">
            <li><span>✖</span> Prospective clients search on Google Maps &amp; find competitors first.</li>
            <li><span>✖</span> Missing 1-click WhatsApp booking channel for immediate inquiries.</li>
            <li><span>✖</span> No daily festival &amp; promotional post designs to retain customers.</li>
            <li><span>✖</span> Missing modern digital menu / brochure for easy mobile sharing.</li>
          </ul>
        </div>
        <div class="comp-col comp-growth">
          <div class="comp-title" style="color:#047857">✔ With Growth Setup (30 Days)</div>
          <ul class="comp-list" style="color:#065f46">
            <li><span>✔</span> Modern mobile website with instant WhatsApp order &amp; call buttons.</li>
            <li><span>✔</span> Google Maps &amp; Local SEO setup to rank in the Top 3 local results.</li>
            <li><span>✔</span> 15–30 High-resolution branded social media creatives &amp; festival banners.</li>
            <li><span>✔</span> Professional PDF &amp; print-ready marketing flyers &amp; standees.</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="consultant-card">
      <div class="cons-info">
        <b>${esc(consultantName)}</b>
        <span>${esc(consultantTitle)} &bull; ${esc(consultantEmail)}</span>
        <div style="margin-top:6px;font-size:12px;color:#cbd5e1">
          Have questions about this audit? Let's connect for a quick 5-minute complimentary walkthrough.
        </div>
      </div>
      <a href="${waCtaUrl}" target="_blank" class="cons-btn">
        💬 Chat on WhatsApp
      </a>
    </div>
  </div>

  <div class="sticky-bar">
    <div class="txt">
      Audit Prepared for: <b>${esc(lead.name)}</b>
    </div>
    <a href="${waCtaUrl}" target="_blank" class="cons-btn" style="padding:8px 16px;font-size:12.5px">
      💬 Fix These Issues
    </a>
  </div>

</body>
</html>`;
}
