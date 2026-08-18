'use strict';
/*
 * GearPick price/image enrichment from manmanbuy mobile global-price search.
 * Direct JD/Taobao/PDD/Douyin search pages require login or anti-bot tokens;
 * manmanbuy mobile search exposes the same platform listings with price + image.
 *
 * Usage:
 *   node tools/enrich_prices.cjs --limit 200 --offset 0 --workers 2 --delay 300
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PRODUCTS_PATH = path.join(ROOT, 'products.json');
const EVIDENCE_PATH = path.join(ROOT, 'price_evidence_v7.json');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const CAPTURED_AT = '2026-08-19';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

const LIMIT = parseInt(arg('--limit', '0'), 10);
const OFFSET = parseInt(arg('--offset', '0'), 10);
const DELAY = parseInt(arg('--delay', '350'), 10);
const WORKERS = Math.max(1, parseInt(arg('--workers', '2'), 10));
const RETRY = arg('--retry', '0') === '1';

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function cleanHtml(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function imageFromBlock(block) {
  const m = /<img[^>]+src="([^"]+)"/.exec(block);
  if (!m) return null;
  let u = m[1];
  if (u.indexOf('/_next/image?') === 0) {
    const q = /url=([^&]+)/.exec(u);
    if (q) {
      try { u = decodeURIComponent(q[1]); } catch (e) { /* keep raw */ }
    }
  }
  return u || null;
}

function parseItems(html) {
  const out = [];
  const marker = 'flex m-row SearchItemH5_box';
  let pos = 0;
  while ((pos = html.indexOf(marker, pos)) !== -1) {
    const start = pos;
    const end = html.indexOf(marker, pos + marker.length);
    const block = end === -1 ? html.slice(start, start + 30000) : html.slice(start, end);
    const titleM = /SearchItemH5_title__W1_kX">(.*?)<\/div>/.exec(block);
    const priceM = /WidgetSearchPriceH5_priceText__sIUPM">([^<]+)/.exec(block);
    const mallM = /SearchItemH5_mall__zy_Og">([^<]+)/.exec(block);
    const saleM = /SearchItemH5_comment__c5uSP">([^<]+)/.exec(block);
    const title = titleM ? cleanHtml(titleM[1]) : '';
    if (!title) {
      pos = end === -1 ? html.length : end;
      continue;
    }
    const priceText = priceM ? priceM[1].trim() : '';
    const price = parseFloat(priceText.replace(/[^\d.]/g, ''));
    out.push({
      title,
      price: Number.isFinite(price) ? price : null,
      mall: mallM ? cleanHtml(mallM[1]) : null,
      sale: saleM ? cleanHtml(saleM[1]) : null,
      img: imageFromBlock(block),
      ended: block.includes('SearchItemH5_over')
    });
    pos = end === -1 ? html.length : end;
  }
  return out;
}

function modelTokens(name) {
  const n = norm(name);
  const tokens = n.match(/[a-z0-9]{2,}/g) || [];
  return [...new Set(tokens.filter(t => /[0-9]/.test(t) || t.length >= 4))];
}

function chineseTokens(name) {
  const n = String(name || '');
  return [...new Set((n.match(/\p{Script=Han}+/gu) || []).filter(t => t.length >= 2))];
}

function hasToken(text, token) {
  if (!/^[a-z0-9]+$/i.test(token)) return text.includes(token);
  const re = new RegExp('(^|[^a-z0-9])' + token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])', 'i');
  return re.test(text);
}

function containsCoreBoundary(text, core, productName) {
  const variant = /^(v\d+|se|max|pro|plus|ultra|lite|mini|4k|8k|\u4e8c\u4ee3|\u4e09\u4ee3|\u5347\u7ea7\u7248|\u65b0\u7248)/i;
  const pn = norm(productName);
  let i = text.indexOf(core);
  while (i >= 0) {
    const tail = text.slice(i + core.length, i + core.length + 12);
    const m = variant.exec(tail);
    if (m && !hasToken(pn, norm(m[1]))) {
      i = text.indexOf(core, i + 1);
      continue;
    }
    const after = tail[0];
    if (!after || !/[a-z0-9]/.test(after)) return true;
    i = text.indexOf(core, i + 1);
  }
  return false;
}

function scoreMatch(product, item) {
  const titleNorm = norm(item.title);
  const nameNorm = norm(product.name);
  const brandNorm = norm(product.brand);
  let score = 0;
  const fullMatch = containsCoreBoundary(titleNorm, nameNorm, product.name);
  const core = nameNorm.split(brandNorm).join('');
  const titleCore = titleNorm.split(brandNorm).join('');
  const coreMatch = core.length >= 2 && containsCoreBoundary(titleCore, core, product.name);
  const plusVariant = /\+/.test(product.name);
  if (fullMatch) score = 100;
  else if (coreMatch && !plusVariant) score = 80;
  return { score, tokenHits: fullMatch || coreMatch ? 1 : 0, fullMatch, coreMatch };
}

function pickBest(product, items) {
  let best = null;
  for (const item of items) {
    if (item.ended || !item.price || !item.img || !item.mall) continue;
    const blocked = /脚贴|脚垫|足贴|防滑贴|收纳盒|键帽|轴体|套装/.test(item.title) &&
      !/套装/.test(product.name);
    if (blocked) continue;
    const scored = scoreMatch(product, item);
    if (scored.score >= 80 && (!best || scored.score > best.score)) {
      best = { ...scored, item };
    }
  }
  return best;
}

function buildUrl(query) {
  return 'https://s.manmanbuy.com/m/search/result?keyword=' +
    encodeURIComponent(query) + '&c=search';
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function buildQueries(product) {
  const a = `${product.brand || ''} ${product.name || ''}`.trim();
  const b = `${product.name || ''}`.trim();
  return [...new Set([a, b].filter(Boolean))];
}

async function fetchMatch(product) {
  let lastMeta = null;
  const queries = [];
  for (const query of buildQueries(product)) {
    const url = buildUrl(query);
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Referer': 'https://m.manmanbuy.com/',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const meta = { query, url, html };
    queries.push({ query, url });
    const best = pickBest(product, parseItems(html));
    lastMeta = meta;
    if (best) return { best, meta, queries };
  }
  return { best: null, meta: lastMeta, queries };
}

function sourceObj(platform, url, label) {
  return {
    type: 'ecommerce',
    platform,
    label: label || `\u6162\u6162\u4e70\u5168\u7f51\u6bd4\u4ef7\u00b7${platform}`,
    url,
    captured_at: CAPTURED_AT
  };
}

function applyMatch(product, match, meta) {
  const item = match.item;
  const { query, url } = meta;
  if (product.price === null || product.price === undefined || product.price === '') {
    product.price = item.price;
  }
  product.price_note = `\u7535\u5546\u53c2\u8003\u4ef7\uff08${item.mall}\uff0c${CAPTURED_AT}\u62d3\u53d6\uff0c\u4ef7\u683c\u968f\u6e20\u9053\u4e0e\u6d3b\u52a8\u6d6e\u52a8\uff09`;
  product.price_verified_at = CAPTURED_AT;
  if (!Array.isArray(product.price_sources)) product.price_sources = [];
  if (!product.price_sources.some(s => s.url === url)) {
    product.price_sources.push(sourceObj(item.mall, url));
  }
  product.image = item.img;
  product.image_source = sourceObj(item.mall, url, `\u5546\u54c1\u56fe\u00b7${item.mall}`);
  if (Array.isArray(product.recommend_reason)) {
    product.recommend_reason = product.recommend_reason.map(r => {
      if (typeof r === 'string' && r.indexOf('\u4ef7\u683c\u5f85\u6838\u5b9e') >= 0) {
        return r.replace('\u4ef7\u683c\u5f85\u6838\u5b9e', `\u2605${item.price}\u5143\uff08${item.mall}\uff09`);
      }
      return r;
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
  for (const group of groups) {
    for (const p of data[group] || []) flat.push({ group, p });
  }
  const evidence = loadEvidence();
  const slice = LIMIT > 0 ? flat.slice(OFFSET, OFFSET + LIMIT) : flat.slice(OFFSET);
  const targets = slice.filter(({ p }) => {
    const rec = evidence[p.id];
    if (rec && rec.status === 'matched' && !RETRY) return false;
    return true;
  });
  console.log(`targets=${targets.length} offset=${OFFSET} limit=${LIMIT || 'all'} workers=${WORKERS}`);

  let cursor = 0;
  let matched = 0;
  let failed = 0;
  const started = Date.now();

async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= targets.length) return;
      const { p } = targets[idx];
      const seq = idx + 1;
      const original = {
        price: p.price,
        price_note: p.price_note,
        price_verified_at: p.price_verified_at,
        price_sources: p.price_sources ? p.price_sources.slice() : undefined,
        image: p.image,
        image_source: p.image_source
      };
      function restore() {
        for (const k of Object.keys(original)) {
          if (original[k] === undefined) delete p[k];
          else p[k] = original[k];
        }
      }
      try {
        const { best, meta, queries } = await fetchMatch(p);
        if (best) {
          applyMatch(p, best, meta);
          evidence[p.id] = {
            id: p.id,
            name: p.name,
            brand: p.brand,
            query: meta.query,
            search_url: meta.url,
            queries,
            status: 'matched',
            platform: best.item.mall,
            price: best.item.price,
            match_title: best.item.title,
            image: best.item.img,
            score: best.score,
            captured_at: CAPTURED_AT
          };
          matched++;
          console.log(`MATCH ${seq}/${targets.length} ${p.id} ${p.name} -> ${best.item.mall} ${best.item.price}`);
        } else {
          restore();
          evidence[p.id] = {
            id: p.id,
            name: p.name,
            brand: p.brand,
            query: meta.query,
            search_url: meta.url,
            queries,
            status: 'no_match',
            captured_at: CAPTURED_AT
          };
          console.log(`SKIP ${seq}/${targets.length} ${p.id} ${p.name}`);
        }
      } catch (e) {
        failed++;
        restore();
        console.log(`FAIL ${seq}/${targets.length} ${p.id} ${p.name} :: ${e.message}`);
      }
      if (idx % 20 === 19) {
        saveProducts(data);
        saveEvidence(evidence);
      }
      await sleep(DELAY);
    }
  }

  await Promise.all(Array.from({ length: WORKERS }, () => worker()));
  saveProducts(data);
  saveEvidence(evidence);
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`DONE matched=${matched} failed=${failed} elapsed=${secs}s`);
}

main().catch(e => { console.error('FATAL', e); process.exit(2); });
