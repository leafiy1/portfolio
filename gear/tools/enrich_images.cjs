'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PRODUCTS_PATH = path.join(ROOT, 'products.json');
const IMAGE_EVIDENCE_PATH = path.join(ROOT, 'image_evidence_v7.json');
const CAPTURED_AT = '2026-08-19';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

const LIMIT = parseInt(arg('--limit', '0'), 10);
const OFFSET = parseInt(arg('--offset', '0'), 10);
const DELAY = parseInt(arg('--delay', '250'), 10);
const WORKERS = Math.max(1, parseInt(arg('--workers', '3'), 10));
const DRY_RUN = arg('--dry-run', '0') === '1';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function candidateUrls(p) {
  const urls = [];
  for (const s of p.sources || []) {
    if (s && s.url) urls.push(s.url);
  }
  if (p.source && typeof p.source === 'string' && /^https?:\/\//.test(p.source)) {
    urls.push(p.source);
  }
  const badHost = /search\.jd\.com|search\.bilibili|search\.smzdm|so\.com\/s|360\.com\/s|reddit|fireopen/i;
  return [...new Set(urls.filter(u => {
    if (!u || badHost.test(u)) return false;
    try {
      const parsed = new URL(u);
      if (/\/collections\//.test(parsed.pathname)) return false;
      const last = parsed.pathname.replace(/\/+$/, '').toLowerCase();
      if (last.length <= 1) return false;
      if (/(^|\/)(search|search\.php|search\.html|gaming-mice|gaming-mice\.html|monitors|monitors\.html|gaming-chairs|office-chairs|webcams|webcams\.html|lighting|capture|products|products\.html|mouse\.html|keyboards|keyboards\.html|mousepads|headsets|accessories|collections|product-category|mice|mouse|keyboard|headset|monitor|chair|audio|displays|computing|seating)$/.test(last)) return false;
      return true;
    } catch (e) {
      return false;
    }
  }))];
}

function cleanImageUrl(raw) {
  if (!raw) return null;
  let u = raw.trim();
  if (u.indexOf('//') === 0) u = 'https:' + u;
  if (!/^https?:\/\//i.test(u)) return null;
  if (/logo|favicon|icon|avatar|sprite|transparent|social|og-image|global-og|navigation|theme\/common|placeholder|empty/i.test(u)) return null;
  if (!/\.(jpg|jpeg|png|webp)(\?|$)/i.test(u)) return null;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return u;
  } catch (e) {
    return null;
  }
}

function parseImage(html) {
  const og = /property=["']og:image["']\s+content=["']([^"']+)["']/i.exec(html)
    || /content=["']([^"']+)["']\s+property=["']og:image["']/i.exec(html);
  if (og) return cleanImageUrl(og[1]);
  const tw = /name=["']twitter:image["']\s+content=["']([^"']+)["']/i.exec(html)
    || /content=["']([^"']+)["']\s+name=["']twitter:image["']/i.exec(html);
  if (tw) return cleanImageUrl(tw[1]);
  const jsonLd = /"image"\s*:\s*"([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i.exec(html);
  if (jsonLd) return cleanImageUrl(jsonLd[1]);
  return null;
}

async function fetchImage(p) {
  const urls = candidateUrls(p);
  if (!urls.length) return { ok: false, reason: 'no official product url' };
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en,zh-CN;q=0.9'
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) continue;
      const html = await res.text();
      const image = parseImage(html);
      if (image) return { ok: true, image, url };
    } catch (e) {
      /* try next candidate */
    }
  }
  return { ok: false, reason: 'no image parsed' };
}

function saveEvidence(evidence) {
  fs.writeFileSync(IMAGE_EVIDENCE_PATH, JSON.stringify(evidence, null, 2), 'utf8');
}

function saveProducts(data) {
  fs.writeFileSync(PRODUCTS_PATH, JSON.stringify(data, null, 2), 'utf8');
}

async function main() {
  const data = JSON.parse(fs.readFileSync(PRODUCTS_PATH, 'utf8'));
  const groups = ['mice', 'keyboards', 'mousepads', 'headsets', 'monitors', 'chairs', 'accessories'];
  const flat = [];
  for (const g of groups) {
    for (const p of data[g] || []) flat.push({ group: g, p });
  }
  const slice = LIMIT > 0 ? flat.slice(OFFSET, OFFSET + LIMIT) : flat.slice(OFFSET);
  const targets = slice.filter(({ p }) => !p.image);
  const evidence = fs.existsSync(IMAGE_EVIDENCE_PATH)
    ? JSON.parse(fs.readFileSync(IMAGE_EVIDENCE_PATH, 'utf8'))
    : {};
  console.log(`targets=${targets.length} offset=${OFFSET} limit=${LIMIT || 'all'} workers=${WORKERS} dry=${DRY_RUN}`);

  let cursor = 0;
  let ok = 0;
  let fail = 0;
  const started = Date.now();

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= targets.length) return;
      const { p } = targets[idx];
      const seq = idx + 1;
      const res = await fetchImage(p);
      if (res.ok) {
        if (!DRY_RUN) {
          p.image = res.image;
          p.image_source = {
            type: 'official',
            label: '\u5b98\u7f51\u4ea7\u54c1\u9875',
            url: res.url,
            captured_at: CAPTURED_AT
          };
        }
        evidence[p.id] = { id: p.id, status: 'ok', image: res.image, url: res.url, captured_at: CAPTURED_AT };
        ok++;
        console.log(`OK ${seq}/${targets.length} ${p.id} ${res.image.slice(0, 100)}`);
      } else {
        evidence[p.id] = { id: p.id, status: 'fail', reason: res.reason || 'unknown', captured_at: CAPTURED_AT };
        fail++;
        if (seq <= 5 || seq % 50 === 0) console.log(`FAIL ${seq}/${targets.length} ${p.id}`);
      }
      if (!DRY_RUN && idx % 20 === 19) {
        saveProducts(data);
        saveEvidence(evidence);
      }
      await sleep(DELAY);
    }
  }

  await Promise.all(Array.from({ length: WORKERS }, () => worker()));
  if (!DRY_RUN) {
    saveProducts(data);
    saveEvidence(evidence);
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`DONE ok=${ok} fail=${fail} elapsed=${secs}s`);
}

main().catch(e => { console.error('FATAL', e); process.exit(2); });
