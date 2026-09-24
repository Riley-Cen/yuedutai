"use strict";

const TAGS = {
  startup: ["创业与商业", "BP、商业模式、GTM、招股书"],
  ai: ["AI 与技术", "模型、AI 产品、工程实践"],
  brand: ["品牌与营销", "广告案例、内容增长"],
  money: ["金融与经济", "市场、宏观、经济学"],
  career: ["职业与副业", "技能、职业选择、个人项目"],
  ideas: ["社会与思想", "社会学、心理、文化"],
};
const ALL = Object.keys(TAGS);
const VERDICT = { useful: "有用", no: "不相关" };
const WEEK = "日一二三四五六";
const THEMES = [["auto", "自动"], ["light", "日间"], ["sepia", "护眼黄"], ["green", "护眼绿"], ["dark", "夜间"]];
const SIZES = [["s", "小"], ["m", "标准"], ["l", "大"], ["xl", "特大"]];

// ---------- 本地存储（读写失败时退回默认值，页面照常可用） ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem("ydt." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("ydt." + k, JSON.stringify(v)); } catch { /* 隐私模式等 */ } },
};
const S = {
  index: null, editions: {}, filter: "all",
  tags: store.get("tags", []), saved: store.get("saved", {}), read: store.get("read", {}),
  fb: store.get("fb", {}), days: store.get("days", []), hint: store.get("hint", false),
  theme: store.get("theme", "auto"), size: store.get("size", "m"),
};

const $ = s => document.querySelector(s);
const view = $("#view");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => new Date().toLocaleDateString("sv-SE");
const dot = d => d.replaceAll("-", ".");
const wk = d => "周" + WEEK[new Date(d + "T00:00:00").getDay()];
const md = d => `${+d.slice(5, 7)}月${+d.slice(8, 10)}日`;
const pad = n => String(n).padStart(2, "0");
const tagName = t => TAGS[t]?.[0] ?? t;
const mine = a => a.tags.filter(t => S.tags.includes(t));
const readMin = a => Math.max(2, Math.round([a.why, ...(a.body || a.points), ...a.takeaway, a.caveat].join("").length / 450));
// 深读正文：以 "## " 开头的是小标题，其余每条一段
const bodyHTML = a => (a.body || []).map(p => p.startsWith("## ") ? `<h3>${esc(p.slice(3))}</h3>` : `<p>${esc(p)}</p>`).join("");
const origLen = a => a.media === "podcast" ? `播客 ${a.minutes} 分钟` : `原文 ${a.minutes} 分钟`;
const subsName = () => S.tags.length === ALL.length ? "全部 6 个方向" : S.tags.map(tagName).join("、");
const dotSep = `<span class="dot" aria-hidden="true"></span>`;
// “结论：依据”式的要点，把冒号前的结论加粗，碎片时间扫一眼就能抓住
const lead = p => { const i = p.indexOf("："); return i > 0 && i <= 24 ? `<b>${esc(p.slice(0, i + 1))}</b>${esc(p.slice(i + 1))}` : esc(p); };

const ICON = {
  mark: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-3.8-6.5 3.8v-16a1 1 0 0 1 1-1z"/></svg>`,
  out: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>`,
  search: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>`,
  down: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></svg>`,
  back: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>`,
};

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 1800);
}
async function getJSON(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(url + " " + r.status);
  return r.json();
}
async function edition(date) {
  if (!S.editions[date]) S.editions[date] = await getJSON(`editions/${date}.json`);
  return S.editions[date];
}

// ---------- 阅读设置：主题、字号 ----------
function applyPrefs() {
  const r = document.documentElement;
  if (S.theme === "auto") delete r.dataset.theme; else r.dataset.theme = S.theme;
  r.dataset.size = S.size;
  const bg = getComputedStyle(r).getPropertyValue("--bg").trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => { m.removeAttribute("media"); m.content = bg; });
}
function prefsHTML() {
  return `<div class="prefs">
    <p class="label">主题</p>
    <div class="themes">${THEMES.map(([k, n]) =>
      `<button type="button" class="theme t-${k}" data-theme-set="${k}" aria-pressed="${S.theme === k}"><span class="sw" aria-hidden="true">Aa</span>${n}</button>`).join("")}</div>
    <p class="label">字号</p>
    <div class="seg" role="group" aria-label="字号">${SIZES.map(([k, n]) =>
      `<button type="button" data-size-set="${k}" aria-pressed="${S.size === k}">${n}</button>`).join("")}</div>
  </div>`;
}
function bindPrefs(root) {
  const sync = () => {
    document.querySelectorAll("[data-theme-set]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.themeSet === S.theme)));
    document.querySelectorAll("[data-size-set]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.sizeSet === S.size)));
  };
  root.querySelectorAll("[data-theme-set]").forEach(b => b.onclick = () => {
    S.theme = b.dataset.themeSet; store.set("theme", S.theme); applyPrefs(); sync();
  });
  root.querySelectorAll("[data-size-set]").forEach(b => b.onclick = () => {
    S.size = b.dataset.sizeSet; store.set("size", S.size); applyPrefs(); sync();
  });
}
const sheet = $("#sheet");
function openSheet() {
  $("#sheetBody").innerHTML = prefsHTML();
  bindPrefs($("#sheetBody"));
  sheet.hidden = false;
  sheet.querySelector(".done").focus();
}
function closeSheet() { if (!sheet.hidden) { sheet.hidden = true; $("#aa").focus(); } }
$("#aa").onclick = openSheet;
sheet.querySelectorAll("[data-close]").forEach(el => el.onclick = closeSheet);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyPrefs);

// 打开记录：用来算“最近 14 天打开了几天”
function logOpen() {
  const d = today();
  if (!S.days.includes(d)) { S.days = [...S.days, d].slice(-120); store.set("days", S.days); }
}
function daysIn(n) {
  const from = new Date(); from.setDate(from.getDate() - n + 1);
  const f = from.toLocaleDateString("sv-SE");
  return S.days.filter(d => d >= f).length;
}
function toggleSave(a, ed) {
  if (S.saved[a.id]) { delete S.saved[a.id]; toast("已从素材库移除"); }
  else { S.saved[a.id] = { at: Date.now(), no: ed.no, a }; toast("已存进素材库"); }
  store.set("saved", S.saved);
}
const chips = a => { const m = mine(a); return `<div class="chips">${a.tags.map(t => `<span class="chip ${m.includes(t) ? "on" : ""}">${tagName(t)}</span>`).join("")}</div>`; };
const hero = (kicker, h1, rest = "") => `<section class="hero"><p class="kicker">${kicker}</p><h1>${h1}</h1>${rest}</section>`;

// ---------- 订阅方向（可以全选） ----------
function renderOnboard(first) {
  let pick = [...S.tags];
  const draw = () => {
    const full = pick.length === ALL.length;
    view.innerHTML = hero(first ? "欢迎来到阅读台" : "订阅方向", "你想读哪些方向？",
      `<p class="lead">可以全选。首页的排序、每篇里的“对你有用”，都按你订阅的方向来，之后随时能在“我的”里改。</p>`) + `
      <section class="onboard">
        <div class="pick-head"><span class="num">已订阅 ${pick.length} / ${ALL.length}</span>
          <button type="button" class="linkbtn" id="all" aria-pressed="${full}">${full ? "取消全选" : "全选"}</button></div>
        <div class="pick">${Object.entries(TAGS).map(([k, [n, d]]) =>
          `<button type="button" data-k="${k}" aria-pressed="${pick.includes(k)}"><b>${n}</b><small>${d}</small></button>`).join("")}</div>
        <div class="onboard-go"><button class="btn primary" id="go" ${pick.length ? "" : "disabled"}>${
          pick.length ? (first ? "开始阅读" : "保存") : "至少订阅 1 个方向"}</button></div>
      </section>`;
    view.querySelectorAll(".pick button").forEach(b => b.onclick = () => {
      const k = b.dataset.k;
      pick = pick.includes(k) ? pick.filter(x => x !== k) : [...pick, k];
      draw();
    });
    $("#all").onclick = () => { pick = full ? [] : [...ALL]; draw(); };
    $("#go").onclick = () => {
      S.tags = ALL.filter(k => pick.includes(k)); store.set("tags", S.tags); S.filter = "all";
      if (location.hash === "#/") route(); else location.hash = "#/";
    };
  };
  draw();
}

// ---------- 今日 / 某一期 ----------
async function renderEdition(date) {
  const latest = S.index.editions[0];
  const ed = await edition(date || latest.date);
  const isLatest = ed.date === latest.date;
  const n = ed.articles.length;
  const ranked = [...ed.articles].sort((x, y) => mine(y).length - mine(x).length);
  const counts = S.tags.map(t => [t, ed.articles.filter(a => a.tags.includes(t)).length]).filter(([, c]) => c);
  if (!counts.some(([t]) => t === S.filter)) S.filter = "all";
  const minutes = ed.articles.reduce((s, a) => s + readMin(a), 0);
  const readN = ed.articles.filter(a => S.read[a.id]).length;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone;
  view.innerHTML = hero(`${md(ed.date)} ${wk(ed.date)}<span class="sepdot" aria-hidden="true"></span>第 ${ed.no} 期`,
    `${isLatest ? "今日精选" : `第 ${ed.no} 期`}<span class="count num">${n} 篇</span>`, `
      <p class="note" id="note" tabindex="0" role="button" aria-expanded="false">${esc(ed.note)}</p>
      <div class="progress"><div class="bar" aria-hidden="true"><i style="width:${Math.round(readN / n * 100)}%"></i></div>
        <span class="num">已读 ${readN}/${n}<span class="sepdot" aria-hidden="true"></span>约 ${minutes} 分钟</span></div>
      <p class="from num">从 ${ed.sources} 个信源的 ${ed.scanned} 篇候选里选出</p>
      ${ios && !S.hint ? `<div class="notice"><p>加到主屏幕，像 App 一样打开：点 Safari 底部的分享按钮，选“添加到主屏幕”。</p><button type="button" id="hintOk">知道了</button></div>` : ""}`) +
    (counts.length > 1 ? `<div class="filters" role="toolbar" aria-label="按方向筛选">
      <button type="button" data-f="all">全部<small>${n}</small></button>
      ${counts.map(([t, c]) => `<button type="button" data-f="${t}">${tagName(t)}<small>${c}</small></button>`).join("")}</div>` : "") + `
    <ol class="feed" id="feed"></ol>
    <p class="end">${isLatest ? `今日到此 · 约 ${minutes} 分钟` : "本期到此"}</p>`;

  const drawFeed = () => {
    view.querySelectorAll("[data-f]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.f === S.filter)));
    const list = S.filter === "all" ? ranked : ranked.filter(a => a.tags.includes(S.filter));
    $("#feed").innerHTML = list.map(a => `
      <li class="card ${S.read[a.id] ? "is-read" : ""}">
        <a href="#/a/${a.id}">
          <div class="meta"><span class="src">${esc(a.source)}</span>${dotSep}<span>${a.body ? "深读" : "拆解"} ${readMin(a)} 分钟</span>${S.read[a.id] ? `${dotSep}<span class="done">已读</span>` : ""}</div>
          <h2>${esc(a.title)}</h2>
          <p class="why">${esc(a.why)}</p>
        </a>
        <div class="card-foot">${chips(a)}
          <button type="button" class="save" data-id="${a.id}" aria-pressed="${!!S.saved[a.id]}" aria-label="存进素材库">${ICON.mark}</button></div>
      </li>`).join("");
    $("#feed").querySelectorAll(".save").forEach(b => b.onclick = () => {
      toggleSave(ed.articles.find(x => x.id === b.dataset.id), ed);
      b.setAttribute("aria-pressed", String(!!S.saved[b.dataset.id]));
    });
  };
  drawFeed();
  view.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { S.filter = b.dataset.f; drawFeed(); });
  const note = $("#note");
  const flip = () => note.setAttribute("aria-expanded", String(note.classList.toggle("open")));
  note.onclick = flip;
  note.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } };
  $("#hintOk")?.addEventListener("click", () => { S.hint = true; store.set("hint", true); $(".notice").remove(); });
}

// ---------- 文章 ----------
async function renderArticle(id) {
  const ed = await edition(id.slice(0, 10));
  const idx = ed.articles.findIndex(a => a.id === id);
  if (idx < 0) { view.innerHTML = `<p class="state">找不到这篇。<a class="hl" href="#/">回到今日</a></p>`; return; }
  const a = ed.articles[idx], prev = ed.articles[idx - 1], next = ed.articles[idx + 1];
  const m = mine(a), show = m.length ? m : [a.tags[0]], rest = a.tags.filter(t => !show.includes(t));
  if (!S.read[a.id]) { S.read[a.id] = Date.now(); store.set("read", S.read); }
  const back = ed.date === S.index.editions[0].date ? "#/" : `#/e/${ed.date}`;
  const saveLabel = () => S.saved[a.id] ? `${ICON.mark}已在素材库` : `${ICON.mark}存进素材库`;
  view.innerHTML = `
    <div class="doc-top"><a class="back" href="${back}">${ICON.back}第 ${ed.no} 期</a><span class="num">${pad(idx + 1)} / ${pad(ed.articles.length)}</span></div>
    <article class="doc">
      <p class="kicker">${esc(a.source)}</p>
      <h1>${esc(a.title)}</h1>
      <p class="byline">原题 <cite>${esc(a.orig)}</cite><br><span class="num">${esc(a.author)} · ${dot(a.date)} · ${origLen(a)}</span></p>
      ${chips(a)}
      <p class="lede">${esc(a.why)}</p>

      <section class="block for-you"><h2>${m.length ? "对你有用" : "对做这些事的人有用"}</h2>
        <div class="body for">${show.map(t => `<p><b>${tagName(t)}</b>${esc(a.useful[t])}</p>`).join("")}</div>
        ${rest.length ? `<details class="others"><summary>其他方向的读者怎么用</summary>${rest.map(t => `<p>${tagName(t)}：${esc(a.useful[t])}</p>`).join("")}</details>` : ""}
      </section>

      ${a.body ? `<details class="block brief"><summary>先看要点 · 30 秒</summary>
        <ul class="body points">${a.points.map(p => `<li>${lead(p)}</li>`).join("")}</ul></details>
      <section class="block deep"><h2>深读</h2><div class="body prose">${bodyHTML(a)}</div></section>`
      : `<section class="block"><h2>核心拆解</h2>
        <ul class="body points">${a.points.map(p => `<li>${lead(p)}</li>`).join("")}</ul></section>`}

      <section class="block takeaways"><h2>可以直接拿走的</h2>
        <ul class="body checks">${a.takeaway.map(p => `<li>${esc(p)}</li>`).join("")}</ul></section>

      <section class="block caveats"><h2>局限与反面</h2>
        <div class="body"><p>${esc(a.caveat)}</p></div></section>

      <div class="actions">
        <button type="button" class="btn primary" id="save" aria-pressed="${!!S.saved[a.id]}">${saveLabel()}</button>
        <a class="btn" href="${esc(a.url)}" target="_blank" rel="noopener">读原文${ICON.out}</a>
      </div>
      <div class="fb" id="fb"></div>
      <nav class="pn" aria-label="翻页">
        ${prev ? `<a href="#/a/${prev.id}"><small>上一篇</small><b>${esc(prev.title)}</b></a>` : ""}
        ${next ? `<a class="next" href="#/a/${next.id}"><small>下一篇</small><b>${esc(next.title)}</b></a>`
               : `<a class="next" href="${back}"><small>读完了</small><b>回到本期目录</b></a>`}
      </nav>
    </article>`;
  $("#save").onclick = e => {
    toggleSave(a, ed);
    e.currentTarget.setAttribute("aria-pressed", String(!!S.saved[a.id]));
    e.currentTarget.innerHTML = saveLabel();
  };
  const drawFb = () => {
    const v = S.fb[a.id];
    $("#fb").innerHTML = `<span>这篇选得</span>${Object.entries(VERDICT).map(([k, t]) =>
      `<button type="button" data-v="${k}" aria-pressed="${v === k}">${t}</button>`).join("")}`;
    $("#fb").querySelectorAll("button").forEach(b => b.onclick = () => {
      if (S.fb[a.id] === b.dataset.v) delete S.fb[a.id]; else S.fb[a.id] = b.dataset.v;
      store.set("fb", S.fb); drawFb();
    });
  };
  drawFb();
}

// ---------- 素材库：只在存过的文章里搜，结果带出处，可一键复制引用 ----------
function fields(a) {
  return [["为什么值得看", a.why], ...Object.entries(a.useful).map(([t, v]) => [`对「${tagName(t)}」有用`, v]),
    ...a.points.map(p => ["核心拆解", p]), ...(a.body || []).filter(p => !p.startsWith("## ")).map(p => ["深读", p]), ...a.takeaway.map(p => ["可以拿走", p]), ["局限", a.caveat]];
}
const cite = a => `（出自 ${a.author}《${a.orig}》，${a.source}，${a.date}，${a.url}）`;
function hl(text, terms) {
  let h = esc(text);
  for (const t of terms) h = h.split(esc(t)).join(`<mark>${esc(t)}</mark>`);
  return h;
}
function renderLibrary() {
  const items = Object.values(S.saved).sort((x, y) => y.at - x.at);
  view.innerHTML = hero("素材库", `存下的拆解<span class="count num">${items.length} 篇</span>`,
    `<p class="lead">读到有用的就存进来。写稿、做方案时在这里搜，每一条都带出处，可以直接复制引用。</p>`) +
    (items.length ? `<div class="search"><label class="field">${ICON.search}<input id="q" type="search" placeholder="搜关键词，如：定价、毛利、护城河" autocomplete="off" enterkeyhint="search" aria-label="搜索素材库"></label></div>` : "") +
    `<ul class="results" id="res"></ul>` +
    (items.length ? `<div class="tools"><button type="button" class="btn" id="md">${ICON.down}导出 Markdown（可放进 Obsidian）</button></div>`
                  : `<p class="empty">还没有收藏。在文章底部点“存进素材库”，或者点列表卡片右下角的书签。</p>`);
  const draw = q => {
    const terms = q.trim().split(/\s+/).filter(Boolean);
    const out = items.map(({ a, no }) => {
      const hay = [a.title, a.orig, a.source, ...fields(a).map(f => f[1])].join("\n").toLowerCase();
      if (terms.some(t => !hay.includes(t.toLowerCase()))) return "";
      const snips = terms.length
        ? fields(a).filter(([, v]) => terms.some(t => v.toLowerCase().includes(t.toLowerCase()))).slice(0, 3)
        : a.takeaway.map(p => ["可以拿走", p]);
      return `<li class="res">
        <h3><a href="#/a/${a.id}">${hl(a.title, terms)}</a></h3>
        <div class="meta"><span class="src">${esc(a.source)}</span>${dotSep}<span>第 ${no} 期</span>${dotSep}<span>${a.tags.map(tagName).join(" / ")}</span></div>
        <ul class="snips">${snips.map(([k, v]) => `<li class="snip"><small>${k}</small><span class="t">${hl(v, terms)}</span>
          <button type="button" data-id="${a.id}">${ICON.copy}复制引用</button></li>`).join("")}</ul>
      </li>`;
    }).filter(Boolean);
    $("#res").innerHTML = out.join("") || (items.length ? `<li class="empty">素材库里没有包含“${esc(q)}”的内容。</li>` : "");
    $("#res").querySelectorAll(".snip button").forEach(b => b.onclick = async () => {
      const a = S.saved[b.dataset.id].a;
      const s = b.parentElement.querySelector(".t").textContent.trim() + cite(a);
      try { await navigator.clipboard.writeText(s); toast("已复制，含出处"); }
      catch { prompt("复制下面这段：", s); }
    });
  };
  draw("");
  $("#q")?.addEventListener("input", e => draw(e.target.value));
  $("#md")?.addEventListener("click", () => exportMd(items));
}
function exportMd(items) {
  const out = [`# 阅读台素材库（导出于 ${today()}）`, ""];
  for (const { a } of items) {
    out.push(`## ${a.title}`, "", `- 出处：${a.author}《${a.orig}》，${a.source}，${a.date}`, `- 原文：${a.url}`,
      `- 方向：${a.tags.map(t => "#阅读台/" + tagName(t).replace(/\s/g, "")).join(" ")}`, "",
      `**为什么值得看**：${a.why}`, "", "### 对我有用", ...Object.entries(a.useful).map(([t, v]) => `- ${tagName(t)}：${v}`), "",
      "### 核心拆解", ...a.points.map(p => `- ${p}`), "", "### 可以直接拿走的", ...a.takeaway.map(p => `- ${p}`), "",
      "### 局限", a.caveat, "");
  }
  const blob = new Blob([out.join("\n")], { type: "text/markdown;charset=utf-8" });
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `阅读台素材库-${today()}.md` });
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// ---------- 往期 ----------
function renderArchive() {
  const eds = S.index.editions;
  view.innerHTML = hero("往期", `全部期数<span class="count num">${eds.length} 期</span>`) + `
    <ul class="issues">${eds.map(e => `<li><a href="#/e/${e.date}">
      <span class="d num">${e.date.slice(5).replace("-", ".")}<small>${wk(e.date)}</small></span>
      <span class="t"><b>第 ${e.no} 期 · ${e.count} 篇</b>
        <span>${e.titles.slice(0, 3).map(esc).join("<br>")}${e.count > 3 ? `<br><em>还有 ${e.count - 3} 篇</em>` : ""}</span></span></a></li>`).join("")}</ul>`;
}

// ---------- 我的 ----------
function renderMe() {
  const readN = Object.keys(S.read).length, savedN = Object.keys(S.saved).length;
  const fbN = Object.keys(S.fb).length, hit = Object.values(S.fb).filter(v => v === "useful").length;
  view.innerHTML = hero("我的", "阅读记录") + `
    <section>
      <div class="stats">
        <div class="stat"><b class="num">${daysIn(14)}<small>/14</small></b><span>最近 14 天<br>打开的天数</span></div>
        <div class="stat"><b class="num">${readN}</b><span>读过的<br>拆解</span></div>
        <div class="stat"><b class="num">${savedN}</b><span>素材库<br>收藏</span></div>
      </div>
      <p class="goal">两周目标：14 天里至少 10 天打开。</p>
      <div class="sec"><h2>阅读设置</h2>${prefsHTML()}</div>
      <div class="sec"><h2>订阅的方向</h2>
        <p>${subsName() || "还没订阅"}。首页排序和每篇的“对你有用”按它来。</p>
        <a class="btn" href="#/onboard">修改订阅</a></div>
      <div class="sec"><h2>选题反馈</h2>
        <p>${fbN ? `你评价过 ${fbN} 篇，其中 ${hit} 篇“有用”。` : "读完可以在文章底部点“有用 / 不相关”。"}目前反馈只存在这台设备上，下个版本会同步给编辑，用来调整选题。</p></div>
      <div class="sec"><h2>数据存在哪</h2>
        <p>订阅方向、已读、素材库和阅读设置都只存在这台设备的浏览器里，不会上传。换设备或清理浏览器数据之前，先在素材库里导出一份 Markdown。</p></div>
    </section>`;
  bindPrefs(view);
}

// ---------- 路由 ----------
async function route() {
  const h = location.hash.replace(/^#\/?/, "");
  // 进场动画只在换页时播一次，页面内切换（全选、筛选）不重播
  view.classList.add("enter"); clearTimeout(route.t); route.t = setTimeout(() => view.classList.remove("enter"), 400);
  const tab = h.startsWith("library") ? "library" : h.startsWith("archive") ? "archive" : h.startsWith("me") || h === "onboard" ? "me" : "today";
  document.querySelectorAll("[data-tab]").forEach(a => {
    if (a.dataset.tab === tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  document.body.classList.toggle("onboarding", !S.tags.length);
  try {
    if (!S.tags.length || h === "onboard") return renderOnboard(!S.tags.length);
    if (!S.index) S.index = await getJSON("editions/index.json");
    if (!S.index.editions.length) { view.innerHTML = `<p class="state">第一期还在路上。</p>`; return; }
    if (h.startsWith("a/")) await renderArticle(h.slice(2));
    else if (h.startsWith("e/")) await renderEdition(h.slice(2));
    else if (tab === "library") renderLibrary();
    else if (tab === "archive") renderArchive();
    else if (tab === "me") renderMe();
    else await renderEdition();
  } catch (e) {
    console.error(e);
    view.innerHTML = `<p class="state">没打开，检查一下网络后重新进入。</p>`;
  }
}
window.addEventListener("hashchange", () => { route().then(() => { window.scrollTo(0, 0); view.focus({ preventScroll: true }); }); });
applyPrefs();
logOpen();
route();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
