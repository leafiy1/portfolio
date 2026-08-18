// verify_game.cjs — 迷宫饭 v2.5.0 回归：新游戏、装备共鸣、Boss 多阶段、移动端布局
let pw;
try { pw = require("playwright"); }
catch(e){ pw = require("playwright-core"); }
const { chromium } = pw;
const path = process.argv[2] || "C:\\Users\\Moyery\\Desktop\\作品集_陈昊\\05_dungeon_meshi_game\\index.html";

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
  await page.evaluate(() => { try{ localStorage.clear(); }catch(e){} });
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    newGame();
    const ov = document.getElementById("tutorial-overlay");
    if (ov) ov.remove();
    tutDone();
  });
  const title = await page.title();
  check("标题加载", title.length > 0, title);

  const fresh = await page.evaluate(() => ({
    party: PARTY.length,
    phaseBox: !!document.getElementById("b-phase"),
    eqBox: !!document.getElementById("b-eq")
  }));
  check("新游戏初始化", fresh.party === 4 && fresh.phaseBox && fresh.eqBox, "PARTY=" + fresh.party);

  const resonance = await page.evaluate(() => {
    PARTY.forEach(m=>{ m.weapon = "w_legend"; m.armor = "a_myth"; m.hp = 1000; m.full = 100; m.lvl = 10; });
    startBattle("slime");
    return document.getElementById("b-eq").innerText;
  });
  check("装备共鸣展示", resonance.indexOf("龙威") >= 0 && resonance.indexOf("龙鳞反震") >= 0, resonance.replace(/\n/g, " | "));

  const attack = await page.evaluate(() => {
    startBattle("gluttonking");
    const before = B.enemies[0].hp;
    actAttack();
    return { before: before, after: B ? B.enemies[0].hp : -1 };
  });
  check("攻击造成伤害", attack.after >= 0 && attack.after < attack.before, attack.before + " -> " + attack.after);

  const phases = await page.evaluate(() => {
    startBattle("gluttonking");
    const boss = B.enemies[0];
    boss.hp = Math.max(1, Math.round(boss.maxhp * 0.05));
    checkBossPhase(boss);
    return {
      phase: boss.phase,
      label: document.getElementById("b-phase").innerText,
      skill: boss.activeSkill.name,
      enemies: B.enemies.length
    };
  });
  check("Boss 多阶段", phases.phase === 3 && phases.label.indexOf("千年饥渴") >= 0, "phase=" + phases.phase + " " + phases.skill);
  check("阶段召唤小怪", phases.enemies > 1, "enemies=" + phases.enemies);

  check("桌面控制台零错误", errors.length === 0, errors.join(" | ") || "none");

  const page2 = await browser.newPage({ viewport: { width: 375, height: 667 } });
  const errors2 = [];
  page2.on("console", m => { if (m.type() === "error") errors2.push(m.text()); });
  page2.on("pageerror", e => errors2.push("PAGEERROR: " + e.message));
  await page2.goto(fileUrl(path), { waitUntil: "load" });
  await page2.waitForTimeout(600);
  const mobile = await page2.evaluate(() => {
    newGame();
    const ov = document.getElementById("tutorial-overlay");
    if (ov) ov.remove();
    tutDone();
    startBattle("gluttonking");
    return {
      sw: document.documentElement.scrollWidth,
      iw: window.innerWidth,
      battle: document.getElementById("battle-screen").classList.contains("open"),
      phase: document.getElementById("b-phase").innerText
    };
  });
  check("移动端战斗打开", mobile.battle && mobile.phase.length > 0, "phase=" + mobile.phase);
  check("移动端无横向溢出", mobile.sw <= mobile.iw, mobile.sw + " <= " + mobile.iw);
  check("移动端控制台零错误", errors2.length === 0, errors2.join(" | ") || "none");

  await browser.close();
  const failed = results.some(r => !r.ok) || errors.length || errors2.length;
  console.log("CONSOLE_ERRORS:", errors.length ? errors.join(" | ") : "none", "/", errors2.length ? errors2.join(" | ") : "none");
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error("FATAL", e.message); process.exit(2); });
