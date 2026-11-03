import fs from 'node:fs';
const response = await fetch('https://yrdly.ng/', { signal: AbortSignal.timeout(20000) });
const html = await response.text();
const title = html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1] || null;
if (!response.ok || !title || !/yrdly/i.test(title)) throw Error(`CTA unavailable or unexpected: ${response.status} / ${title}`);
const result = { checkedAt: new Date().toISOString(), requestedUrl: 'https://yrdly.ng/', resolvedUrl: response.url, httpStatus: response.status, title, nativeStoreAvailabilityClaimed: false };
fs.mkdirSync('output', { recursive: true });
fs.writeFileSync('output/cta-verification.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
