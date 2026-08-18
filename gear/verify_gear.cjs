// verify_gear.cjs — GearPick v6.0 回归：7 品类加载、新品类推荐、移动端布局
let pw;
try { pw = require("playwright"); }
catch(e){ pw = require("playwright-core"); }
const { chromium } = pw;
const path = process.argv[2] || "C:\\Users\\Moyery\\Desktop\\作品集_陈昊\\gear\\index.html";

function fileUrl(p){ return "file:///" + p.split("\\").join("/"); }

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Users\\Moyery\\AppData\\Local\\ms-playwright\\chromium-1208\\chrome-win64\\chrome.exe"
  });
  const results = [];
  const check = (name, ok, detail) => {
    results.push({ name, ok, detail: detail || "" });
    console.log((ok ? "PASS" : "FAIL") + " " + name + (detail ? " :: " + detail : ""));
  };

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", e => errors.push("PAGEERROR: " + e.message));
  await page.goto(fileUrl(path), { waitUntil: "load" });
  await page.waitForTimeout(800);

  const totals = await page.evaluate(() => {
    const keys = ["mice", "keyboards", "mousepads", "headsets", "monitors", "chairs", "accessories"];
    return {
      total: keys.reduce((s, k) => s + (PRODUCTS[k] || []).length, 0),
      keys: keys.map(k => k + ":" + (PRODUCTS[k] || []).length).join(" "),
      tabs: Array.from(document.querySelectorAll("#tabs .tab")).map(b => b.innerText)
    };
  });
  check("GearPick 总数 3000+", totals.total >= 3000, "total=" + totals.total);
  check("7 个品类 Tab", totals.tabs.length === 7, totals.tabs.join(" | "));
  check("新品类数据已内嵌", totals.keys.indexOf("monitors:306") >= 0 && totals.keys.indexOf("chairs:116") >= 0 && totals.keys.indexOf("accessories:252") >= 0, totals.keys);

  for (const tab of ["monitor", "chair", "accessory"]) {
    await page.evaluate((t) => {
      const btn = document.querySelector('#tabs .tab[data-tab="' + t + '"]');
      if (btn) btn.click();
    }, tab);
    await page.waitForTimeout(250);
    await page.click("#submitBtn");
    await page.waitForTimeout(900);
    const res = await page.evaluate(() => ({
      cards: document.querySelectorAll(".result-card").length,
      title: document.getElementById("form-title").textContent,
      text: document.getElementById("results").innerText.length,
      errorHidden: document.getElementById("errorState").hidden
    }));
    check(tab + " 推荐结果", res.cards >= 3 && res.errorHidden && res.text > 0, res.title + " cards=" + res.cards);
  }
  check("桌面控制台零错误", errors.length === 0, errors.join(" | ") || "none");

  const page2 = await browser.newPage({ viewport: { width: 375, height: 667 } });
  const errors2 = [];
  page2.on("console", m => { if (m.type() === "error") errors2.push(m.text()); });
  page2.on("pageerror", e => errors2.push("PAGEERROR: " + e.message));
  await page2.goto(fileUrl(path), { waitUntil: "load" });
  await page2.waitForTimeout(700);
  const mobile = await page2.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
    tabs: document.querySelectorAll("#tabs .tab").length
  }));
  check("移动端无横向溢出", mobile.sw <= mobile.iw, mobile.sw + " <= " + mobile.iw);
  check("移动端 7 Tab", mobile.tabs === 7, "tabs=" + mobile.tabs);
  check("移动端控制台零错误", errors2.length === 0, errors2.join(" | ") || "none");

  await browser.close();
  const failed = results.some(r => !r.ok) || errors.length || errors2.length;
  console.log("CONSOLE_ERRORS:", errors.length ? errors.join(" | ") : "none", "/", errors2.length ? errors2.join(" | ") : "none");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error("FATAL", e.message); process.exit(2); });
