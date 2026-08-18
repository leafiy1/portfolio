'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PRODUCTS_PATH = path.join(ROOT, 'products.json');
const EVIDENCE_PATH = path.join(ROOT, 'price_evidence_v7.json');

const BRAND_ALIASES = {
  logitech: ['logitech', '\u7f57\u6280'],
  razer: ['razer', '\u96f7\u86c7'],
  corsair: ['corsair', '\u6d77\u76d7\u8239', '\u7f8e\u5546\u6d77\u76d7\u8239'],
  steelcase: ['steelcase', '\u4e16\u695e'],
  'herman miller': ['herman miller', '\u8d6b\u66fc\u7c73\u52d2'],
  humanscale: ['humanscale', '\u4f18\u95e8\u8bbe'],
  ergotron: ['ergotron', '\u7231\u5347\u683c'],
  sihoo: ['sihoo', '\u897f\u660a'],
  aoc: ['aoc', '\u51a0\u6377'],
  dell: ['dell', '\u6234\u5c14'],
  alienware: ['alienware', '\u5916\u661f\u4eba'],
  hp: ['hp', '\u60e0\u666e'],
  omen: ['omen', 'hp', '\u60e0\u666e'],
  hkc: ['hkc'],
  msi: ['msi', '\u5fae\u661f'],
  gigabyte: ['gigabyte', '\u6280\u5609'],
  benq: ['benq', '\u660e\u57fa'],
  mevo: ['mevo'],
  blue: ['blue'],
  rode: ['rode', '\u7f57\u5fb7'],
  elgato: ['elgato'],
  tourbox: ['tourbox'],
  loupedeck: ['loupedeck'],
  baseus: ['baseus', '\u500d\u601d'],
  caldigit: ['caldigit'],
  roost: ['roost'],
  ugreen: ['ugreen', '\u7eff\u8054'],
  lamicall: ['lamicall'],
  periapt: ['periapt'],
  'fog city audio': ['fog city audio'],
  lunashops: ['lunashops'],
  fifine: ['fifine', '\u98de\u98de'],
  innogear: ['innogear'],
  'gator frameworks': ['gator frameworks'],
  'amazon basics': ['amazon basics'],
  glorious: ['glorious'],
  ducky: ['ducky'],
  filco: ['filco'],
  velcro: ['velcro', '\u9b54\u672f\u8d34', '\u7ef4\u53ef\u7262'],
  branch: ['branch'],
  frost: ['frost'],
  viltrox: ['viltrox', '\u552f\u5353'],
  darmoshark: ['darmoshark', '\u8fbe\u9ca8'],
  vxe: ['vxe'],
  skn: ['skn', '\u9752\u9f99'],
  'atk': ['atk'],
  vaxee: ['vaxee'],
  pulsar: ['pulsar'],
  lamzu: ['lamzu', '\u5170\u65cf'],
  'endgame gear': ['endgame gear', 'xm2we', 'xm2w', 'op1'],
  keychron: ['keychron', '\u9f99\u821f'],
  secretlab: ['secretlab']
};

function brandPresent(p, t) {
  const brand = String(p.brand || '').trim();
  if (!brand) return true;
  const title = String(t || '').toLowerCase();
  const key = brand.toLowerCase();
  const aliases = BRAND_ALIASES[key] || [brand.toLowerCase()];
  return aliases.some(a => title.includes(a.toLowerCase()));
}

function findHeadProduct(head, id) {
  const groups = ['mice', 'keyboards', 'mousepads', 'headsets', 'monitors', 'chairs', 'accessories'];
  for (const g of groups) {
    const hit = (head[g] || []).find(p => p.id === id);
    if (hit) return hit;
  }
  return null;
}

function findProduct(data, id) {
  const groups = ['mice', 'keyboards', 'mousepads', 'headsets', 'monitors', 'chairs', 'accessories'];
  for (const g of groups) {
    const hit = (data[g] || []).find(p => p.id === id);
    if (hit) return hit;
  }
  return null;
}

function restoreFromHead(p, h) {
  const keys = ['price', 'price_note', 'price_verified_at', 'price_sources', 'recommend_reason', 'notes'];
  for (const k of keys) {
    if (h && h[k] !== undefined) p[k] = Array.isArray(h[k]) ? h[k].slice() : h[k];
    else delete p[k];
  }
  delete p.image;
  delete p.image_source;
}

function restoreGeneric(p) {
  delete p.price;
  delete p.price_note;
  delete p.price_verified_at;
  delete p.price_sources;
  delete p.image;
  delete p.image_source;
  p.recommend_reason = ['公开目录收录：型号待核实，价格与参数待补充'];
  p.notes = ['型号来自公开目录/搜索入口，未逐一核实'];
}

function reasonsFor(rec, p) {
  const id = p.id;
  const t = rec.match_title || '';
  const price = rec.price;
  const reasons = [];
  const genericBad = /手机壳|手机膜|手机贴膜|橡皮|油烟机|自行车|T恤|牛奶|皂|座套|卧铺|卡车|货车|牛奶片|油烟|书包|文具|固态|U盘|SSD|贝尔金|BOYA|博雅|ASICS|亚瑟士|3M|特斯拉|中控|汽车|跑鞋|运动鞋|男鞋|女鞋|球鞋|惠威|HiVi|租赁|出租|租用/;
  if (genericBad.test(t)) reasons.push('unrelated listing');

  if ((id.indexOf('mon-') === 0 || id.indexOf('acc-') === 0 || id.indexOf('chr-') === 0) && !brandPresent(p, t)) {
    reasons.push('brand mismatch');
  }

  if (id.indexOf('m-') === 0 || id.indexOf('m2-') === 0) {
    if (!/鼠标|滑鼠/.test(t)) reasons.push('not a mouse');
    const acc = /贴纸|贴膜|防滑贴|止滑贴|脚贴|脚垫|足贴|防尘贴|收纳|保护套|保护贴|保护膜|保护壳|手机壳|数据线|充电线|电源线|适配器|鼠标线|伞绳|软线|编码器|声音包|收纳包|袋套|包袋|外壳|上盖|中壳|维修|耳机|键盘|麦克风|座套|壳|电池|线夹|微动板|微动开关|热插拔微动|鼠标主板|pcb/;
    if (acc.test(t)) reasons.push('mouse accessory or other product');
  }

  if (id.indexOf('kb-') === 0 || id.indexOf('kb2-') === 0) {
    if (!/键盘/.test(t) && /鼠标|耳机|显示器|手机|油烟机|笔记本|自行车|橡皮/.test(t)) reasons.push('not a keyboard');
    const acc = /键盘膜|防尘罩|防尘膜|防尘盖|收纳包|保护套|保护膜|保护包|保护壳|手托|掌托|腕托|护腕|声音包|轴下垫|夹心棉|底棉|键帽|增补|包袋|套盒|贴膜|数据线|充电线|适配器|手机膜|橡皮|油烟机|自行车|T恤|牛奶|皂|手机壳|维修|配件|防摔/;
    if (acc.test(t)) reasons.push('keyboard accessory or other product');
  }

  if (id.indexOf('mp-') === 0 || id.indexOf('mp2-') === 0) {
    if (!/鼠标垫|桌垫|滑鼠垫|游戏垫|pad|垫子|桌布/i.test(t)) reasons.push('not a mousepad');
    if (/T恤|皂|牛奶|供电器|手机|笔记本|键盘|橡皮/.test(t)) reasons.push('unrelated product');
  }

  if (id.indexOf('hs-') === 0 || id.indexOf('hs2-') === 0) {
    if (!/耳机|耳麦|头戴/.test(t)) reasons.push('not a headset');
    const acc = /耳罩|耳机套|耳垫|耳包|海绵套|头梁|咪杆|数据线|充电线|音频线|耳机线|接收器|替换|配件|麦克风咪杆|麦克风配件|耳套|保护套|保护壳|外壳|防摔|电池|咪罩|耳机盒|充电盒|连接线|防喷|收纳|充电仓|软壳|线材|伞绳|耳塞套|耳帽|适用于|适配|镀金OFC|原装麦克风/;
    if (acc.test(t)) reasons.push('headset accessory or other product');
  }

  if (id.indexOf('mon-') === 0) {
    if (!/显示器|屏幕|显示屏|显示|屏|monitor/i.test(t)) reasons.push('not a monitor');
    if (price !== null && price < 200) reasons.push('price implausible for monitor');
  }

  if (id.indexOf('chr-') === 0) {
    if (!/椅|座椅|人体工学|chair/i.test(t)) reasons.push('not a chair');
    if (price !== null && price < 300) reasons.push('price implausible for chair');
  }

  if (id.indexOf('acc-') === 0) {
    if (/开发板|下载器|FPGA|紫光|高云/.test(t)) reasons.push('unrelated cable/development accessory');
    if (/hub|dock|扩展坞|集线器/.test(p.name) && !/hub|扩展坞|dock|集线器/i.test(t)) reasons.push('hub title mismatch');
    const relevant = /支架|臂|arm|mount|底座|riser|夹|座|摄像头|camera|webcam|麦克风|mic|话筒|录音|线|cable|hdmi|usb|dp|typec|type-c|hub|扩展坞|dock|集线器|stream deck|控制台|控制器|stand|桌垫|鼠标垫|pad|桌布|键帽|keycap|手托|腕托|掌托|rest|充电|charger|适配器|电源|采集|capture|hd60|脚踏|脚托|footrest|升降桌|standing|desk|手机支架|手机架|phone stand|保护壳/i;
    if (!relevant.test(t)) reasons.push('no matching accessory category');
  }

  return reasons;
}

function main() {
  const data = JSON.parse(fs.readFileSync(PRODUCTS_PATH, 'utf8'));
  const head = JSON.parse(cp.execFileSync('git', ['show', 'HEAD:gear/products.json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  }));
  const evidence = JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8'));
  let removed = 0;
  for (const id of Object.keys(evidence)) {
    const rec = evidence[id];
    if (!rec || rec.status !== 'matched') continue;
    const p = findProduct(data, id);
    if (!p) continue;
    const reasons = reasonsFor(rec, p);
    if (!reasons.length) continue;
    const h = findHeadProduct(head, id);
    if (h) restoreFromHead(p, h);
    else restoreGeneric(p);
    rec.status = 'no_match';
    rec.filtered_reason = reasons.join('; ');
    delete rec.match_title;
    delete rec.platform;
    delete rec.price;
    delete rec.image;
    delete rec.score;
    removed++;
  }
  fs.writeFileSync(PRODUCTS_PATH, JSON.stringify(data, null, 2), 'utf8');
  fs.writeFileSync(EVIDENCE_PATH, JSON.stringify(evidence, null, 2), 'utf8');
  console.log('removed', removed);
}

main();
