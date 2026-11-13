import { findJobs } from '../lib/jobs.js';
import { findLeads } from '../lib/leads.js';

const which = process.argv[2];
if (which === 'jobs') {
  const r = await findJobs({ keywords: ['wordpress', 'shopify'], region: process.argv[3] || 'any', onProgress: (m) => console.log(m.msg) });
  console.log('TOTAL', r.jobs.length);
  for (const j of r.jobs.slice(0, 8)) console.log('-', j.relevance, '|', j.title, '|', j.company, '|', j.location, '|', j.source);
} else {
  const r = await findLeads({ area: process.argv[3] || 'Dubai, UAE', category: process.argv[4] || 'jewelry', platform: 'both', maxScan: 30, onProgress: (m) => m.msg && console.log(m.msg) });
  for (const l of r.leads) console.log('-', l.platform, '|', l.name, '|', l.website, '|', l.emails.join(';'), '|', l.phones.join(';'), '|', l.opportunities.join('; '));
}
