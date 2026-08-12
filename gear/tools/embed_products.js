// GearPick 数据同步脚本：把 products.json 内嵌进 index.html
// 用法：node tools/embed_products.js
// 说明：为兼容 file:// 直开（浏览器禁止 file 下的 fetch），产品库以快照形式内嵌；
//       修改 products.json 后必须重跑本脚本同步 index.html。
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const jsonPath = path.join(root, 'products.json');

const BEGIN = '/*__PRODUCTS_DATA_BEGIN__*/';
const END = '/*__PRODUCTS_DATA_END__*/';

function main() {
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const html = fs.readFileSync(htmlPath, 'utf8');
  const i0 = html.indexOf(BEGIN);
  const i1 = html.indexOf(END);
  if (i0 < 0 || i1 < 0) {
    console.error('未找到内嵌数据标记（' + BEGIN + ' / ' + END + '），请检查 index.html');
    process.exit(1);
  }
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const block = BEGIN + '\nconst PRODUCTS = ' + json + ';\n' + END;
  const next = html.slice(0, i0) + block + html.slice(i1 + END.length);
  fs.writeFileSync(htmlPath, next, 'utf8');
  const n = Object.keys(data).filter(k => Array.isArray(data[k])).reduce((s, k) => s + data[k].length, 0);
  console.log('OK 内嵌 ' + n + ' 款产品 -> index.html (' + Buffer.byteLength(next, 'utf8') + ' bytes)');
}

main();