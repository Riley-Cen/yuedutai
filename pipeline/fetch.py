#!/usr/bin/env python3
"""每日候选池：抓取信源近两周文章（尽量带全文），供编辑按 pipeline/EDITOR.md 选稿。

python3 pipeline/fetch.py                  → pipeline/out/candidates.json
python3 pipeline/fetch.py --paper "主题"    另加该主题的 arXiv 论文
已经出现在 editions/ 里的文章自动排除。标准库 only。
"""
import html, json, re, sys, urllib.parse, urllib.request, datetime as dt
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "pipeline" / "out"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36"
PER_SOURCE = 8
MAX_DAYS = 14

# (栏目, 源名, feed)。标准：长期有原创分析；纯新闻源不收。
SOURCES = [
    ("广告与品牌", "数英", "https://www.digitaling.com/rss"),
    ("广告与品牌", "Marketing Week", "https://www.marketingweek.com/feed/"),
    ("广告与品牌", "Why Is This Interesting", "https://whyisthisinteresting.substack.com/feed"),
    ("广告与品牌", "Creative Review", "https://www.creativereview.co.uk/feed/"),
    ("广告与品牌", "Prof G", "https://www.profgalloway.com/feed/"),
    ("商业模式与 GTM", "Stratechery", "https://stratechery.com/feed/"),
    ("商业模式与 GTM", "Lenny's Newsletter", "https://www.lennysnewsletter.com/feed"),
    ("商业模式与 GTM", "Elena Verna", "https://www.elenaverna.com/feed"),
    ("商业模式与 GTM", "The Generalist", "https://www.generalist.com/feed"),
    ("商业模式与 GTM", "Not Boring", "https://www.notboring.co/feed"),
    ("商业模式与 GTM", "Andrew Chen", "https://andrewchen.substack.com/feed"),
    ("商业模式与 GTM", "Benedict Evans", "https://www.ben-evans.com/benedictevans?format=rss"),
    ("商业模式与 GTM", "Tomasz Tunguz", "https://tomtunguz.com/index.xml"),
    ("商业模式与 GTM", "人人都是产品经理", "https://www.woshipm.com/feed"),
    ("招股书与财报", "Clouded Judgement", "https://cloudedjudgement.substack.com/feed"),
    ("招股书与财报", "Tanay Jaipuria", "https://www.tanayj.com/feed"),
    ("金融", "Net Interest", "https://www.netinterest.co/feed"),
    ("金融", "The Overshoot", "https://theovershoot.co/feed"),
    ("金融", "Apricitas", "https://www.apricitas.io/feed"),
    ("金融", "Liberty Street（纽约联储）", "https://libertystreeteconomics.newyorkfed.org/feed/"),
    ("金融", "FT Alphaville", "https://www.ft.com/alphaville?format=rss"),
    ("经济学", "Conversable Economist", "https://conversableeconomist.com/feed/"),
    ("经济学", "Noahpinion", "https://www.noahpinion.blog/feed"),
    ("经济学", "VoxEU / CEPR", "https://cepr.org/rss/vox-content"),
    ("经济学", "Construction Physics", "https://www.construction-physics.com/feed"),
    ("社会学与思想", "Aeon", "https://aeon.co/feed.rss"),
    ("社会学与思想", "Asterisk", "https://asteriskmag.com/feed"),
    ("社会学与思想", "Culture Study", "https://annehelen.substack.com/feed"),
    ("社会学与思想", "Pew Research", "https://www.pewresearch.org/feed/"),
    ("技术与 AI", "One Useful Thing", "https://www.oneusefulthing.org/feed"),
    ("技术与 AI", "Simon Willison", "https://simonwillison.net/atom/everything/"),
    ("技术与 AI", "Interconnects", "https://www.interconnects.ai/feed"),
    ("技术与 AI", "Import AI", "https://importai.substack.com/feed"),
    ("技术与 AI", "Latent Space", "https://www.latent.space/feed"),
    ("技术与 AI", "阮一峰周刊", "https://www.ruanyifeng.com/blog/atom.xml"),
    ("技术与 AI", "极客公园", "https://www.geekpark.net/rss"),
    ("长文与深度报道", "Works in Progress", "https://worksinprogress.co/rss.xml"),
    ("长文与深度报道", "Asimov Press", "https://www.asimov.press/feed"),
    ("长文与深度报道", "Noema", "https://www.noemamag.com/feed/"),
    ("长文与深度报道", "Palladium", "https://www.palladiummag.com/feed/"),
    ("长文与深度报道", "The Atlantic", "https://www.theatlantic.com/feed/all/"),
    ("长文与深度报道", "The New Yorker", "https://www.newyorker.com/feed/everything"),
    ("长文与深度报道", "Longreads", "https://longreads.com/feed/"),
    ("长文与深度报道", "Rest of World", "https://restofworld.org/feed/latest/"),
    ("长文与深度报道", "ChinaTalk", "https://www.chinatalk.media/feed"),
    ("科学与历史", "Quanta", "https://api.quantamagazine.org/feed/"),
    ("科学与历史", "Knowable", "https://knowablemagazine.org/rss"),
    ("科学与历史", "Nautilus", "https://nautil.us/feed"),
    ("科学与历史", "Public Domain Review", "https://publicdomainreview.org/rss.xml"),
    ("社会学与思想", "Experimental History", "https://www.experimental-history.com/feed"),
    ("社会学与思想", "Astral Codex Ten", "https://www.astralcodexten.com/feed"),
    ("技术与 AI", "少数派", "https://sspai.com/feed"),
    ("论文", "Hugging Face 每日热门论文", "https://papers.takara.ai/api/feed"),
]
SKIP = re.compile(r"(?i)sponsored|webinar|giveaway|podcast|livestream|招聘|直播|预告|榜单|融资快讯")


def tag(el):
    return el.tag.split("}")[-1]


def first(el, *names):
    for n in names:
        for c in el:
            if tag(c) == n:
                if n == "link" and c.get("href") and c.get("rel", "alternate") == "alternate":
                    return c.get("href")
                if (c.text or "").strip():
                    return c.text.strip()
    return ""


def when(s):
    if not s:
        return None
    try:
        d = parsedate_to_datetime(s)
    except Exception:
        try:
            d = dt.datetime.fromisoformat(s.replace("Z", "+00:00")[:25])
        except Exception:
            return None
    return d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)


def plain(s):
    s = re.sub(r"(?is)<(script|style|figure|figcaption)[^>]*>.*?</\1>", " ", s or "")
    s = re.sub(r"(?i)</(p|h\d|li|blockquote)>|<br\s*/?>", "\n", s)
    s = html.unescape(re.sub(r"<[^>]+>", " ", s))
    return re.sub(r"[ \t\xa0]+", " ", re.sub(r"\n\s*\n+", "\n\n", s)).strip()


class Paras(HTMLParser):
    """正文提取：收集 <p> 文本，足够给编辑判断用。"""
    def __init__(self):
        super().__init__()
        self.out, self.buf, self.depth = [], [], 0

    def handle_starttag(self, t, a):
        if t == "p":
            self.depth += 1

    def handle_endtag(self, t):
        if t == "p" and self.depth:
            self.depth -= 1
            s = " ".join("".join(self.buf).split())
            if len(s) > 40:
                self.out.append(s)
            self.buf = []

    def handle_data(self, d):
        if self.depth:
            self.buf.append(d)


def get(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=timeout).read()


def page_text(url):
    try:
        p = Paras()
        p.feed(get(url).decode("utf-8", "ignore"))
        return "\n\n".join(p.out)
    except Exception:
        return ""


def fetch(src, picked):
    cat, name, url = src
    err = ""
    for _ in range(2):
        try:
            root = ET.fromstring(get(url))
            break
        except Exception as e:
            err = type(e).__name__
    else:
        return src, [], err
    now = dt.datetime.now(dt.timezone.utc)
    items = []
    for el in root.iter():
        if tag(el) not in ("item", "entry"):
            continue
        title = plain(first(el, "title"))
        link = first(el, "link", "id")
        if not title or not link or link in picked or SKIP.search(title):
            continue
        d = when(first(el, "pubDate", "published", "updated", "date"))
        if d and (now - d).days > MAX_DAYS and "arxiv" not in url:
            continue
        items.append({"cat": cat, "source": name, "title": title, "url": link,
                      "author": plain(first(el, "creator", "author")),
                      "date": d.date().isoformat() if d else "",
                      "text": plain(first(el, "encoded", "content", "description", "summary"))})
        if len(items) >= PER_SOURCE:
            break
    return src, items, "" if items else "无近期内容"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    args = sys.argv[1:]
    picked = {a["url"] for f in (ROOT / "editions").glob("20*.json")
              for a in json.loads(f.read_text(encoding="utf-8"))["articles"]}
    sources = list(SOURCES)
    if "--paper" in args:
        topic = args[args.index("--paper") + 1]
        q = urllib.parse.quote(f'all:"{topic}"')
        sources.append(("论文", f"arXiv · {topic}", "http://export.arxiv.org/api/query?search_query="
                        f"{q}&sortBy=relevance&max_results={PER_SOURCE}"))
    with ThreadPoolExecutor(4) as ex:
        results = list(ex.map(lambda s: fetch(s, picked), sources))
    items = [i for _, its, _ in results for i in its]
    short = [i for i in items if len(i["text"]) < 1500]
    with ThreadPoolExecutor(4) as ex:  # feed 只给摘要的，去原页补正文
        for i, t in zip(short, ex.map(lambda i: page_text(i["url"]), short)):
            if len(t) > len(i["text"]):
                i["text"] = t
    for i in items:
        i["words"] = len(i["text"])
    failed = [f"{s[1]}（{e}）" for s, its, e in results if not its]
    out = OUT / "candidates.json"
    out.write_text(json.dumps({"date": dt.date.today().isoformat(), "sources": len(sources) - len(failed),
                               "failed": failed, "items": items},
                              ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(items)} 篇候选，{len(sources) - len(failed)}/{len(sources)} 个源 → {out}")
    if failed:
        print("没抓到：" + "、".join(failed))


if __name__ == "__main__":
    main()
