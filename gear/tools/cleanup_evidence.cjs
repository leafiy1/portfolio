'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PRODUCTS_PATH = path.join(ROOT, 'products.json');
const EVIDENCE_PATH = path.join(ROOT, 'price_evidence_v7.json');

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
  const genericBad = /手机壳|手机膜|手机贴膜|橡皮|笔记本|油烟机|自行车|T恤|牛奶|皂|座套|卧铺|卡车|货车|牛奶片|油烟|书包|文具/;
  if (genericBad.test(t)) reasons.push('unrelated listing');

  if (id.indexOf('m-') === 0 || id.indexOf('m2-') === 0) {
    if (!/鼠标/.test(t)) reasons.push('not a mouse');
    const acc = /贴纸|贴膜|防滑贴|止滑贴|脚贴|脚垫|足贴|防尘贴|收纳|保护套|保护贴|保护膜|保护壳|手机壳|数据线|充电线|电源线|接收器|适配器|鼠标线|伞绳|软线|编码器|声音包|收纳包|袋套|包袋|外壳|上盖|中壳|维修|耳机|键盘|麦克风|座套|壳|电池|线夹/;
    if (acc.test(t)) reasons.push('mouse accessory or other product');
  }

  if (id.indexOf('kb-') === 0 || id.indexOf('kb2-') === 0) {
    if (!/键盘/.test(t) && /鼠标|耳机|显示器|手机|油烟机|笔记本|自行车|橡皮/.test(t)) reasons.push('not a keyboard');
    const acc = /键盘膜|防尘罩|防尘膜|防尘盖|收纳包|保护套|保护膜|保护包|保护壳|手托|掌托|腕托|护腕|声音包|轴下垫|夹心棉|底棉|键帽|增补|包袋|套盒|贴膜|数据线|充电线|适配|接收器|手机膜|橡皮|笔记本|油烟机|自行车|T恤|牛奶|皂|手机壳|支架|桌垫|鼠标垫|旋钮|维修|配件|电池|防摔/;
    if (acc.test(t)) reasons.push('keyboard accessory or other product');
  }

  if (id.indexOf('mp-') === 0 || id.indexOf('mp2-') === 0) {
    if (!/鼠标垫|桌垫|滑鼠垫|游戏垫|pad|垫子|桌布/i.test(t)) reasons.push('not a mousepad');
    if (/T恤|皂|牛奶|供电器|手机|笔记本|键盘|橡皮/.test(t)) reasons.push('unrelated product');
  }

  if (id.indexOf('hs-') === 0 || id.indexOf('hs2-') === 0) {
    if (!/耳机|耳麦|头戴/.test(t)) reasons.push('not a headset');
    const acc = /耳罩|耳机套|耳垫|耳包|海绵套|头梁|咪杆|数据线|充电线|音频线|耳机线|接收器|替换|配件|麦克风咪杆|麦克风配件|耳套|保护套|保护壳|外壳|防摔|电池|咪罩|耳机盒|充电盒|连接线|防喷|收纳|充电仓|软壳|线材|伞绳|耳塞套|耳帽/;
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
