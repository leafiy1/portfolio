'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PRODUCTS_PATH = path.join(ROOT, 'products.json');
const EVIDENCE_PATH = path.join(ROOT, 'pconline_evidence_v7.json');
const CAPTURED_AT = '2026-08-19';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

const LIMIT = parseInt(arg('--limit', '0'), 10);
const OFFSET = parseInt(arg('--offset', '0'), 10);
const DELAY = parseInt(arg('--delay', '450'), 10);
const WORKERS = Math.max(1, parseInt(arg('--workers', '2'), 10));
const DRY_RUN = arg('--dry-run', '0') === '1';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function cleanHtml(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function parseItems(html) {
  const out = [];
  const marker = '<div class="box product';
  let pos = 0;
  while ((pos = html.indexOf(marker, pos)) !== -1) {
    const next = html.indexOf('<div class="box ', pos + marker.length);
    const block = next === -1 ? html.slice(pos, pos + 9000) : html.slice(pos, next);
    const urlM = /<a href="(\/\/product\.pconline\.com\.cn\/[^"]+\.html)"/.exec(block);
    const titleM = /<dt>[\s\S]*?<a href="\/\/product\.pconline\.com\.cn\/[^"]+\.html"[^>]*>([^<]+)<\/a>/.exec(block);
    const priceM = /<i class="iprice">([^<]+)<\/i>/.exec(block);
    const imgM = /#src="([^"]+)"/.exec(block) || /<img[^>]+src="([^"]+)"/.exec(block);
    if (urlM && titleM) {
      const rawPrice = priceM ? cleanHtml(priceM[1]) : '';
      const num = parseFloat(rawPrice.replace(/[^\d.]/g, ''));
      out.push({
        title: cleanHtml(titleM[1]),
        price: Number.isFinite(num) ? num : null,
        raw_price: rawPrice,
        img: imgM ? imgM[1] : null,
        url: urlM[1]
      });
    }
    pos = next === -1 ? html.length : next;
  }
  return out;
}

function boundaryMatch(titleNorm, nameNorm) {
  const i = titleNorm.indexOf(nameNorm);
  if (i < 0) return false;
  const after = titleNorm[i + nameNorm.length];
  return !after || !/[a-z0-9]/.test(after);
}

function pickBest(product, items) {
  const nameNorm = norm(product.name);
  let best = null;
  for (const it of items) {
    if (boundaryMatch(norm(it.title), nameNorm)) {
      if (!best) best = it;
    }
  }
  return best;
}

function buildQuery(product) {
  const name = String(product.name || '');
  const brand = String(product.brand || '');
  if (norm(name).includes(norm(brand))) return name;
  return `${brand} ${name}`.trim();
}

async function fetchMatch(product) {
  const query = buildQuery(product);
  const url = 'https://ks.pconline.com.cn/index.shtml?q=' + encodeURIComponent(query);
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Referer': 'https://ks.pconline.com.cn/',
      'Accept-Language': 'zh-CN,zh;q=0.9'
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = new TextDecoder('gbk').decode(await res.arrayBuffer());
  return { query, url, best: pickBest(product, parseItems(html)) };
}

function applyMatch(product, best, meta) {
  if (best.img) {
    let img = best.img;
    if (img.indexOf('//') === 0) img = 'https:' + img;
    if (!product.image) {
      product.image = img;
      product.image_source = {
        type: 'official',
        label: '\u592a\u5e73\u6d0b\u7535\u8111\u7f51\u4ea7\u54c1\u9875',
        url: meta.url,
        captured_at: CAPTURED_AT
      };
    }
  }
  const discontinued = /停产|停售|暂无|无货/.test(best.raw_price || '');
  if (best.price && !discontinued && (product.price === null || product.price === undefined || product.price === '')) {
    product.price = best.price;
    product.price_note = `\u53c2\u8003\u4ef7\uff08\u592a\u5e73\u6d0b\u7535\u8111\u7f51 ${CAPTURED_AT}\uff0c\u4ef7\u683c\u968f\u6e20\u9053\u4e0e\u6d3b\u52a8\u6d6e\u52a8\uff09`;
    product.price_verified_at = CAPTURED_AT;
    if (!Array.isArray(product.price_sources)) product.price_sources = [];
    product.price_sources.push({
      type: 'ecommerce',
      platform: '\u592a\u5e73\u6d0b\u7535\u8111\u7f51',
      label: '\u592a\u5e73\u6d0b\u7535\u8111\u7f51\u4ea7\u54c1\u9875',
      url: meta.url,
      captured_at: CAPTURED_AT
    });
  }
}

function loadEvidence() {
  if (!fs.existsSync(EVIDENCE_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8')); } catch (e) { return {}; }
}

function saveEvidence(evidence) {
  fs.writeFileSync(EVIDENCE_PATH, JSON.stringify(evidence, null, 2), 'utf8');
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
  const targets = slice.filter(({ p }) => !p.image || p.price === null || p.price === undefined || p.price === '');
  const evidence = loadEvidence();
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
      try {
        const meta = await fetchMatch(p);
        if (meta.best) {
          if (!DRY_RUN) applyMatch(p, meta.best, meta);
          evidence[p.id] = {
            id: p.id,
            status: 'matched',
            query: meta.query,
            url: meta.url,
            title: meta.best.title,
            raw_price: meta.best.raw_price,
            image: meta.best.img,
            captured_at: CAPTURED_AT
          };
          ok++;
          if (seq % 20 === 0 || seq <= 5) console.log(`OK ${seq}/${targets.length} ${p.id} ${meta.best.title} ${meta.best.raw_price}`);
        } else {
          evidence[p.id] = { id: p.id, status: 'no_match', query: meta.query, url: meta.url, captured_at: CAPTURED_AT };
          if (seq % 100 === 0 || seq <= 5) console.log(`SKIP ${seq}/${targets.length} ${p.id}`);
        }
      } catch (e) {
        fail++;
        evidence[p.id] = { id: p.id, status: 'fail', reason: e.message, captured_at: CAPTURED_AT };
        if (seq % 100 === 0 || seq <= 5) console.log(`FAIL ${seq}/${targets.length} ${p.id} :: ${e.message}`);
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
