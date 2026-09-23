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

// ---------- 本地存储（读取失败时退回默认值，页面照常可用） ----------
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
const cn = d => { const t = new Date(d + "T00:00:00"); return `${t.getMonth() + 1}月${t.getDate()}日 周${WEEK[t.getDay()]}`; };
const tagName = t => TAGS[t]?.[0] ?? t;
const mine = a => a.tags.filter(t => S.tags.includes(t));
const readMin = a => Math.max(2, Math.round([a.why, ...Object.values(a.useful), ...a.points, ...a.takeaway, a.caveat].join("").length / 450));
const origLen = a => a.media === "podcast" ? `播客 ${a.minutes} 分钟` : `原文 ${a.minutes} 分钟`;

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
const bookmark = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>`;

// ---------- 页面 ----------
function renderOnboard(first) {
  let pick = [...S.tags];
  const draw = () => {
    view.innerHTML = `
      <section class="onboard">
        <p class="eyebrow">${first ? "欢迎" : "我的方向"}</p>
        <h1>你最近在做什么？</h1>
        <p>选 1–3 个。每期文章的排序、每篇里的“对你有用”，都会按你选的方向来。之后可以在“我的”里改。</p>
        <div class="pick">${Object.entries(TAGS).map(([k, [n, d]]) =>
          `<button type="button" data-k="${k}" aria-pressed="${pick.includes(k)}">${n}<small>${d}</small></button>`).join("")}</div>
        <button class="btn primary" id="go" ${pick.length ? "" : "disabled"}>${first ? "开始读今天这一期" : "保存"}</button>
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
  $("#topMeta").textContent = "";
  draw();
}

async function renderEdition(date) {
  const latest = S.index.editions[0];
  const ed = await edition(date || latest.date);
  const arts = [...ed.articles].sort((x, y) => mine(y).length - mine(x).length);
  const readN = ed.articles.filter(a => S.read[a.id]).length;
  const minutes = ed.articles.reduce((s, a) => s + readMin(a), 0);
  $("#topMeta").textContent = `第 ${ed.no} 期 · 已读 ${readN}/${ed.articles.length}`;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone;
  view.innerHTML = `
    <section class="hero">
      <p class="eyebrow">第 ${ed.no} 期 · ${cn(ed.date)}</p>
      <h1>${ed.articles.length} 篇拆解，读完约 ${minutes} 分钟</h1>
      <p class="note">从 ${ed.sources} 个信源的 ${ed.scanned} 篇里选出。${esc(ed.note)}</p>
      ${ios && !S.hint ? `<div class="banner"><p>加到主屏幕，像 App 一样打开：点 Safari 底部的分享按钮，再点“添加到主屏幕”。</p><button id="hintOk">知道了</button></div>` : ""}
    </section>
    <ul class="cards">${arts.map(a => {
      const m = mine(a);
      return `<li class="card ${S.read[a.id] ? "read" : ""}">
        <a href="#/a/${a.id}">
          <div class="chips">${a.tags.map(t => `<span class="chip ${m.includes(t) ? "on" : ""}">${tagName(t)}</span>`).join("")}</div>
          <h2>${esc(a.title)}</h2>
          <p class="why">${esc(a.why)}</p>
          <span class="meta"><span>${esc(a.source)}</span><span>拆解 ${readMin(a)} 分钟 · ${origLen(a)}</span>${S.read[a.id] ? "<span>已读</span>" : ""}</span>
        </a>
        <button class="save" data-id="${a.id}" aria-pressed="${!!S.saved[a.id]}" aria-label="存进素材库">${bookmark}</button>
      </li>`;
    }).join("")}</ul>
    <p class="end">${ed.date === latest.date ? "今天就这些" : "这一期就这些"}</p>`;
  $("#hintOk")?.addEventListener("click", () => { S.hint = true; store.set("hint", true); $(".banner").remove(); });
  view.querySelectorAll(".save").forEach(b => b.onclick = () => {
    const a = ed.articles.find(x => x.id === b.dataset.id);
    toggleSave(a, ed);
    b.setAttribute("aria-pressed", String(!!S.saved[a.id]));
  });
}

async function renderArticle(id) {
  const ed = await edition(id.slice(0, 10));
  const idx = ed.articles.findIndex(a => a.id === id);
  if (idx < 0) { view.innerHTML = `<p class="state">找不到这篇。<a href="#/">回到今天</a></p>`; return; }
  const a = ed.articles[idx], prev = ed.articles[idx - 1], next = ed.articles[idx + 1];
  const m = mine(a), show = m.length ? m : [a.tags[0]], rest = a.tags.filter(t => !show.includes(t));
  if (!S.read[a.id]) { S.read[a.id] = Date.now(); store.set("read", S.read); }
  $("#topMeta").textContent = `第 ${ed.no} 期 · ${idx + 1}/${ed.articles.length}`;
  view.innerHTML = `
    <a class="back" href="#/${ed.date === S.index.editions[0].date ? "" : "e/" + ed.date}">← 第 ${ed.no} 期</a>
    <article class="read-v">
      <div class="chips">${a.tags.map(t => `<span class="chip ${m.includes(t) ? "on" : ""}">${tagName(t)}</span>`).join("")}</div>
      <h1>${esc(a.title)}</h1>
      <p class="orig">原题 <i>${esc(a.orig)}</i><br>${esc(a.author)} · ${esc(a.source)} · ${cn(a.date)} · ${origLen(a)}</p>
      <div class="why-box"><b>为什么值得看</b><p>${esc(a.why)}</p></div>
      <h2>${m.length ? "对你有用的部分" : "对做这些事的人有用"}</h2>
      <div class="useful">${show.map(t => `<p><b>${tagName(t)}：</b>${esc(a.useful[t])}</p>`).join("")}</div>
      ${rest.length ? `<details class="others"><summary>对其他方向的读者</summary>${rest.map(t => `<p><b>${tagName(t)}：</b>${esc(a.useful[t])}</p>`).join("")}</details>` : ""}
      <h2>核心拆解</h2>
      <ul>${a.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
      <h2>可以直接拿走的</h2>
      <ul class="take">${a.takeaway.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
      <h2>局限与反面</h2>
      <p class="caveat">${esc(a.caveat)}</p>
      <div class="actions">
        <button class="btn primary" id="save" aria-pressed="${!!S.saved[a.id]}">${S.saved[a.id] ? "已在素材库" : "存进素材库"}</button>
        <a class="btn" href="${esc(a.url)}" target="_blank" rel="noopener">读原文 ↗</a>
      </div>
      <div class="fb" id="fb"></div>
      <nav class="pn">
        ${prev ? `<a href="#/a/${prev.id}">← 上一篇<b>${esc(prev.title)}</b></a>` : ""}
        ${next ? `<a class="next" href="#/a/${next.id}">下一篇 →<b>${esc(next.title)}</b></a>`
               : `<a class="next" href="#/">回到今天 →<b>这一期读完了</b></a>`}
      </nav>
    </article>`;
  $("#save").onclick = e => {
    toggleSave(a, ed);
    e.currentTarget.setAttribute("aria-pressed", String(!!S.saved[a.id]));
    e.currentTarget.textContent = S.saved[a.id] ? "已在素材库" : "存进素材库";
  };
  const drawFb = () => {
    const v = S.fb[a.id];
    $("#fb").innerHTML = `这篇选得${Object.entries(VERDICT).map(([k, t]) =>
      `<button type="button" data-v="${k}" aria-pressed="${v === k}">${t}</button>`).join("")}`;
    $("#fb").querySelectorAll("button").forEach(b => b.onclick = () => {
      if (S.fb[a.id] === b.dataset.v) delete S.fb[a.id]; else S.fb[a.id] = b.dataset.v;
      store.set("fb", S.fb); drawFb();
    });
  };
  drawFb();
}

// 素材库：只在存过的文章里搜，结果带出处，可一键复制引用
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
  $("#topMeta").textContent = `${items.length} 篇`;
  view.innerHTML = `
    <section class="page-h"><h1>素材库</h1>
      <p>读到有用的就存进来。写稿、做方案时在这里搜，每条都带出处，可以直接复制引用。</p></section>
    ${items.length ? `<div class="search"><input id="q" type="search" placeholder="搜关键词，比如：定价、内容增长、护城河" autocomplete="off" enterkeyhint="search"></div>` : ""}
    <ul class="results" id="res"></ul>
    ${items.length ? "" : `<p class="empty">还没有存东西。在文章里点“存进素材库”，或者点卡片右上角的书签。</p>`}
    ${items.length ? `<div class="tools"><button class="btn" id="md">导出为 Markdown（可放进 Obsidian）</button></div>` : ""}`;
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
        <p class="src">第 ${no} 期 · ${esc(a.source)} · ${a.tags.map(tagName).join(" / ")}</p>
        <ul class="snips">${snips.map(([k, v], i) => `<li class="snip"><small>${k}</small>${hl(v, terms)}
          <button type="button" data-id="${a.id}" data-i="${i}" data-k="${esc(k)}">复制引用</button></li>`).join("")}</ul>
      </li>`;
    }).filter(Boolean);
    $("#res").innerHTML = out.join("") || (items.length ? `<li class="empty">素材库里没有包含“${esc(q)}”的内容。</li>` : "");
    $("#res").querySelectorAll(".snip button").forEach(b => b.onclick = async () => {
      const a = S.saved[b.dataset.id].a;
      const text = b.parentElement.cloneNode(true);
      text.querySelectorAll("small,button").forEach(n => n.remove());
      const s = text.textContent.trim() + cite(a);
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
      `### 局限`, a.caveat, "");
  }
  const blob = new Blob([md.join("\n")], { type: "text/markdown;charset=utf-8" });
  const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `阅读台素材库-${today()}.md` });
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function renderArchive() {
  const eds = S.index.editions;
  $("#topMeta").textContent = `${eds.length} 期`;
  view.innerHTML = `
    <section class="page-h"><h1>往期</h1></section>
    <ul class="list">${eds.map(e => `<li><a href="#/e/${e.date}"><b>第 ${e.no} 期 · ${cn(e.date)}</b>
      <span>${e.titles.slice(0, 2).map(esc).join(" / ")}${e.count > 2 ? ` 等 ${e.count} 篇` : ""}</span></a></li>`).join("")}</ul>`;
}

function renderMe() {
  const readN = Object.keys(S.read).length, savedN = Object.keys(S.saved).length;
  const fbN = Object.keys(S.fb).length, hit = Object.values(S.fb).filter(v => v === "useful").length;
  $("#topMeta").textContent = "";
  view.innerHTML = `
    <section class="page-h"><h1>我的</h1></section>
    <div class="stats">
      <div class="stat"><b>${daysIn(14)}<small style="font-size:14px">/14</small></b><span>最近 14 天打开的天数</span></div>
      <div class="stat"><b>${readN}</b><span>读过的拆解</span></div>
      <div class="stat"><b>${savedN}</b><span>素材库</span></div>
    </div>
    <section class="section"><h2>我的方向</h2>
      <p>${S.tags.map(tagName).join("、") || "还没选"}。文章排序和“对你有用”按它来。</p>
      <a class="btn" href="#/onboard" style="display:inline-flex">修改方向</a></section>
    <section class="section"><h2>选题反馈</h2>
      <p>${fbN ? `你评价过 ${fbN} 篇，其中 ${hit} 篇“有用”。` : "读完可以在文章底部点“有用 / 不相关”。"}目前反馈只存在这台设备上，下个版本会同步给编辑，用来调整选题。</p></section>
    <section class="section"><h2>数据存在哪</h2>
      <p>方向、已读、素材库都只存在这台设备的浏览器里，不上传。换设备或清理浏览器数据前，先在素材库里导出一份 Markdown。</p></section>`;
}

// ---------- 路由 ----------
async function route() {
  const h = location.hash.replace(/^#\/?/, "");
  const tab = h.startsWith("library") ? "library" : h.startsWith("archive") ? "archive" : h.startsWith("me") || h === "onboard" ? "me" : "today";
  document.querySelectorAll(".tabs a").forEach(a => {
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
    view.innerHTML = `<p class="state">没打开。检查一下网络，下拉或重新进入试试。</p>`;
  }
}
window.addEventListener("hashchange", () => { route().then(() => { window.scrollTo(0, 0); view.focus({ preventScroll: true }); }); });
logOpen();
route();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
