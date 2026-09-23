"use strict";

const TAGS = {
  startup: ["创业与商业", "BP、商业模式、GTM、招股书"],
  ai: ["AI 与技术", "模型、AI 产品、工程实践"],
  brand: ["品牌与营销", "广告案例、内容增长"],
  money: ["金融与经济", "市场、宏观、经济学"],
  career: ["职业与副业", "技能、职业选择、个人项目"],
  ideas: ["社会与思想", "社会学、心理、文化"],
};
const VERDICT = { useful: "有用", no: "不相关" };
const WEEK = "日一二三四五六";

// ---------- 本地存储（读写失败时退回默认值，页面照常可用） ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem("ydt." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("ydt." + k, JSON.stringify(v)); } catch { /* 隐私模式等 */ } },
};
const S = {
  index: null, editions: {},
  tags: store.get("tags", []), saved: store.get("saved", {}), read: store.get("read", {}),
  fb: store.get("fb", {}), days: store.get("days", []), hint: store.get("hint", false),
};

const $ = s => document.querySelector(s);
const view = $("#view");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => new Date().toLocaleDateString("sv-SE");
const dot = d => d.replaceAll("-", ".");
const wk = d => "周" + WEEK[new Date(d + "T00:00:00").getDay()];
const pad = n => String(n).padStart(2, "0");
const tagName = t => TAGS[t]?.[0] ?? t;
const mine = a => a.tags.filter(t => S.tags.includes(t));
const readMin = a => Math.max(2, Math.round([a.why, ...Object.values(a.useful), ...a.points, ...a.takeaway, a.caveat].join("").length / 450));
const origLen = a => a.media === "podcast" ? `播客 ${a.minutes} 分钟` : `原文 ${a.minutes} 分钟`;
const sep = `<span class="sep" aria-hidden="true"></span>`;

const ICON = {
  mark: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-3.8-6.5 3.8v-16a1 1 0 0 1 1-1z"/></svg>`,
  out: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>`,
  search: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>`,
  down: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></svg>`,
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
const band = (eyebrow, h1, rest = "") => `<section class="band"><div class="band-in"><p class="eyebrow">${eyebrow}</p><h1>${h1}</h1>${rest}</div></section>`;

// ---------- 选方向 ----------
function renderOnboard(first) {
  let pick = [...S.tags];
  const draw = () => {
    view.innerHTML = band(first ? "WELCOME" : "PREFERENCES", `你最近在做<span class="hl">什么</span>？`,
      `<p class="lead">选 1–3 个。每期文章的排序、每篇里的“对你有用”，都会按你选的方向来。之后可以在“我的”里修改。</p>`) + `
      <section>
        <div class="pick">${Object.entries(TAGS).map(([k, [n, d]]) =>
          `<button type="button" data-k="${k}" aria-pressed="${pick.includes(k)}"><b>${n}</b><small>${d}</small></button>`).join("")}</div>
        <div class="onboard-go"><span class="num">已选 ${pick.length} / 3</span>
          <button class="btn primary" id="go" ${pick.length ? "" : "disabled"}>${first ? "开始阅读" : "保存"}</button></div>
      </section>`;
    view.querySelectorAll(".pick button").forEach(b => b.onclick = () => {
      const k = b.dataset.k;
      if (pick.includes(k)) pick = pick.filter(x => x !== k);
      else if (pick.length < 3) pick.push(k);
      else { toast("最多选 3 个"); return; }
      draw();
    });
    $("#go").onclick = () => {
      S.tags = pick; store.set("tags", pick);
      if (location.hash === "#/") route(); else location.hash = "#/";
    };
  };
  draw();
}

// ---------- 今日 / 某一期 ----------
async function renderEdition(date) {
  const latest = S.index.editions[0];
  const ed = await edition(date || latest.date);
  const arts = [...ed.articles].sort((x, y) => mine(y).length - mine(x).length);
  const minutes = ed.articles.reduce((s, a) => s + readMin(a), 0);
  const readN = ed.articles.filter(a => S.read[a.id]).length;
  const isLatest = ed.date === latest.date;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone;
  view.innerHTML = band(`ISSUE ${pad(ed.no)} · ${dot(ed.date)} ${wk(ed.date)}`,
    `${isLatest ? "今日精选" : `第 ${ed.no} 期`}<span class="hl">·${ed.articles.length} 篇拆解</span>`, `
      <p class="sub">${S.tags.map(tagName).join('<span class="dotsep" aria-hidden="true"></span>')}</p>
      <p class="lead">${esc(ed.note)}</p>
      <dl class="facts">
        <div><dt>信源</dt><dd>${ed.sources}</dd></div>
        <div><dt>候选</dt><dd>${ed.scanned}</dd></div>
        <div><dt>入选</dt><dd>${ed.articles.length}</dd></div>
        <div><dt>已读</dt><dd>${readN}<small>/ ${ed.articles.length}</small></dd></div>
      </dl>
      ${ios && !S.hint ? `<div class="notice"><p>加到主屏幕，像 App 一样打开：点 Safari 底部的分享按钮，选“添加到主屏幕”。</p><button id="hintOk">知道了</button></div>` : ""}`) + `
    <ol class="feed">${arts.map(a => `
      <li class="entry ${S.read[a.id] ? "is-read" : ""}">
        <a href="#/a/${a.id}">
          <div class="meta"><span class="src">${esc(a.source)}</span>${sep}<span>${dot(a.date)}</span>${sep}<span>拆解 ${readMin(a)} 分钟</span>${S.read[a.id] ? `${sep}<span>已读</span>` : ""}</div>
          <h2>${esc(a.title)}</h2>
          <p class="why">${esc(a.why)}</p>
          ${chips(a)}
        </a>
        <button class="save" data-id="${a.id}" aria-pressed="${!!S.saved[a.id]}" aria-label="存进素材库">${ICON.mark}</button>
      </li>`).join("")}
    </ol>
    <p class="end">${isLatest ? `今日到此 · 约 ${minutes} 分钟` : "本期到此"}</p>`;
  $("#hintOk")?.addEventListener("click", () => { S.hint = true; store.set("hint", true); $(".notice").remove(); });
  view.querySelectorAll(".save").forEach(b => b.onclick = () => {
    const a = ed.articles.find(x => x.id === b.dataset.id);
    toggleSave(a, ed);
    b.setAttribute("aria-pressed", String(!!S.saved[a.id]));
  });
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
    <nav class="crumbs" aria-label="位置"><a href="#/">今日</a><span>/</span><a href="${back}">第 ${ed.no} 期</a><span>/</span><span class="cur">${esc(a.title)}</span></nav>
    <article class="doc">
      <p class="eyebrow">${pad(idx + 1)} / ${pad(ed.articles.length)} · ${esc(a.source)}</p>
      <h1>${esc(a.title)}</h1>
      <p class="byline">原题 <cite>${esc(a.orig)}</cite><br><span class="num">${esc(a.author)} · ${dot(a.date)} · ${origLen(a)}</span></p>
      ${chips(a)}
      <p class="lede">${esc(a.why)}</p>

      <section class="block"><p class="eyebrow">FOR YOU</p><h2>${m.length ? "对你有用的部分" : "对做这些事的人有用"}</h2>
        <div class="body for">${show.map(t => `<p><b>${tagName(t)}</b>${esc(a.useful[t])}</p>`).join("")}</div>
        ${rest.length ? `<details class="others"><summary>其他方向的读者怎么用</summary>${rest.map(t => `<p>${tagName(t)}：${esc(a.useful[t])}</p>`).join("")}</details>` : ""}
      </section>

      <section class="block"><p class="eyebrow">BREAKDOWN</p><h2>核心拆解</h2>
        <ul class="body points">${a.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul></section>

      <section class="block panel"><p class="eyebrow">TAKEAWAYS</p><h2>可以直接拿走的</h2>
        <ul class="body points">${a.takeaway.map(p => `<li>${esc(p)}</li>`).join("")}</ul></section>

      <section class="block"><p class="eyebrow">CAVEATS</p><h2>局限与反面</h2>
        <div class="body"><p class="caveat">${esc(a.caveat)}</p></div></section>

      <div class="actions">
        <button class="btn primary" id="save" aria-pressed="${!!S.saved[a.id]}">${saveLabel()}</button>
        <a class="btn" href="${esc(a.url)}" target="_blank" rel="noopener">读原文${ICON.out}</a>
      </div>
      <div class="fb" id="fb"></div>
      <nav class="pn" aria-label="翻页">
        ${prev ? `<a href="#/a/${prev.id}"><small>PREV</small><b>${esc(prev.title)}</b></a>` : ""}
        ${next ? `<a class="next" href="#/a/${next.id}"><small>NEXT</small><b>${esc(next.title)}</b></a>`
               : `<a class="next" href="${back}"><small>DONE</small><b>本期读完了，回到目录</b></a>`}
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
    ...a.points.map(p => ["核心拆解", p]), ...a.takeaway.map(p => ["可以拿走", p]), ["局限", a.caveat]];
}
const cite = a => `（出自 ${a.author}《${a.orig}》，${a.source}，${a.date}，${a.url}）`;
function hl(text, terms) {
  let h = esc(text);
  for (const t of terms) h = h.split(esc(t)).join(`<mark>${esc(t)}</mark>`);
  return h;
}
function renderLibrary() {
  const items = Object.values(S.saved).sort((x, y) => y.at - x.at);
  view.innerHTML = band("LIBRARY", `素材库<span class="hl">·${items.length} 篇</span>`,
    `<p class="lead">读到有用的就存进来。写稿、做方案时在这里搜，每一条都带出处，可以直接复制引用。</p>`) +
    (items.length ? `<div class="search"><label class="field">${ICON.search}<input id="q" type="search" placeholder="搜关键词，如：定价、留存、护城河" autocomplete="off" enterkeyhint="search" aria-label="搜索素材库"></label></div>` : "") +
    `<ul class="results" id="res"></ul>` +
    (items.length ? `<div class="tools"><button class="btn" id="md">${ICON.down}导出 Markdown（可放进 Obsidian）</button></div>`
                  : `<p class="empty">还没有收藏。在文章底部点“存进素材库”，或者点列表右侧的书签。</p>`);
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
        <div class="meta"><span class="src">${esc(a.source)}</span>${sep}<span>第 ${no} 期</span>${sep}<span>${a.tags.map(tagName).join(" / ")}</span></div>
        <ul class="snips">${snips.map(([k, v]) => `<li class="snip"><small>${k}</small><span class="t">${hl(v, terms)}</span>
          <br><button type="button" data-id="${a.id}">${ICON.copy}复制引用</button></li>`).join("")}</ul>
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
  const md = [`# 阅读台素材库（导出于 ${today()}）`, ""];
  for (const { a } of items) {
    md.push(`## ${a.title}`, "", `- 出处：${a.author}《${a.orig}》，${a.source}，${a.date}`, `- 原文：${a.url}`,
      `- 方向：${a.tags.map(t => "#阅读台/" + tagName(t).replace(/\s/g, "")).join(" ")}`, "",
      `**为什么值得看**：${a.why}`, "", "### 对我有用", ...Object.entries(a.useful).map(([t, v]) => `- ${tagName(t)}：${v}`), "",
      "### 核心拆解", ...a.points.map(p => `- ${p}`), "", "### 可以直接拿走的", ...a.takeaway.map(p => `- ${p}`), "",
      "### 局限", a.caveat, "");
  }
  const blob = new Blob([md.join("\n")], { type: "text/markdown;charset=utf-8" });
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `阅读台素材库-${today()}.md` });
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// ---------- 往期 ----------
function renderArchive() {
  const eds = S.index.editions;
  view.innerHTML = band("ARCHIVE", `往期<span class="hl">·${eds.length} 期</span>`) + `
    <ul class="issues">${eds.map(e => `<li><a href="#/e/${e.date}">
      <span class="d">${e.date.slice(5).replace("-", ".")}<small>NO.${pad(e.no)}</small></span>
      <span><b>第 ${e.no} 期 · ${e.count} 篇</b><span>${e.titles.map(esc).join("<br>")}</span></span></a></li>`).join("")}</ul>`;
}

// ---------- 我的 ----------
function renderMe() {
  const readN = Object.keys(S.read).length, savedN = Object.keys(S.saved).length;
  const fbN = Object.keys(S.fb).length, hit = Object.values(S.fb).filter(v => v === "useful").length;
  view.innerHTML = band("PROFILE", "我的") + `
    <section>
      <div class="stats">
        <div class="stat"><b>${daysIn(14)}<small> /14</small></b><span>最近 14 天<br>打开的天数</span></div>
        <div class="stat"><b>${readN}</b><span>读过的<br>拆解</span></div>
        <div class="stat"><b>${savedN}</b><span>素材库<br>收藏</span></div>
      </div>
      <p class="goal">两周目标：14 天里至少 10 天打开。</p>
      <div class="sec"><p class="eyebrow">DIRECTION</p><h2>我的方向</h2>
        <p>${S.tags.map(tagName).join("、") || "还没选"}。文章排序和“对你有用”按它来。</p>
        <a class="btn" href="#/onboard">修改方向</a></div>
      <div class="sec"><p class="eyebrow">FEEDBACK</p><h2>选题反馈</h2>
        <p>${fbN ? `你评价过 ${fbN} 篇，其中 ${hit} 篇“有用”。` : "读完可以在文章底部点“有用 / 不相关”。"}目前反馈只存在这台设备上，下个版本会同步给编辑，用来调整选题。</p></div>
      <div class="sec"><p class="eyebrow">DATA</p><h2>数据存在哪</h2>
        <p>方向、已读、素材库都只存在这台设备的浏览器里，不会上传。换设备或清理浏览器数据之前，先在素材库里导出一份 Markdown。</p></div>
    </section>`;
}

// ---------- 路由 ----------
async function route() {
  const h = location.hash.replace(/^#\/?/, "");
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
logOpen();
route();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
