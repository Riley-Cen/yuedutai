#!/usr/bin/env python3
"""校验 editions/*.json 并重建 editions/index.json。有任何问题就以非零状态退出。"""
import json, re, sys
from pathlib import Path

ED = Path(__file__).resolve().parents[1] / "editions"
TAGS = {"startup", "ai", "brand", "money", "career", "ideas"}
REQ = {"id": str, "tags": list, "title": str, "orig": str, "source": str, "author": str, "date": str,
       "url": str, "minutes": int, "why": str, "useful": dict, "points": list, "takeaway": list, "caveat": str}


def check(path, seen):
    errs = []
    try:
        e = json.loads(path.read_text(encoding="utf-8"))
    except Exception as x:
        return None, [f"{path.name}: 不是合法 JSON（{x}）"]
    if e.get("date") != path.stem:
        errs.append(f"{path.name}: date 应为 {path.stem}")
    for k in ("no", "scanned", "sources"):
        if not isinstance(e.get(k), int):
            errs.append(f"{path.name}: {k} 应为整数")
    arts = e.get("articles") or []
    if sum("ai" in a.get("tags", []) for a in arts) > 3:
        errs.append(f"{path.name}: 标了 ai 的最多 3 篇")
    if not 3 <= len(arts) <= 12:
        errs.append(f"{path.name}: 应有 3–12 篇，现在 {len(arts)} 篇")
    for n, a in enumerate(arts, 1):
        where = f"{path.name} 第 {n} 篇"
        for k, t in REQ.items():
            if not isinstance(a.get(k), t) or (t is str and not a[k].strip()):
                errs.append(f"{where}: 缺少 {k} 或类型不对")
        if errs:
            continue
        if a["id"] != f"{e['date']}-{n}":
            errs.append(f"{where}: id 应为 {e['date']}-{n}")
        bad = set(a["tags"]) - TAGS
        if bad or not 1 <= len(a["tags"]) <= 3:
            errs.append(f"{where}: tags 只能从 {sorted(TAGS)} 选 1–3 个")
        if set(a["useful"]) != set(a["tags"]):
            errs.append(f"{where}: useful 的键必须和 tags 一致")
        if not 3 <= len(a["points"]) <= 5 or not 1 <= len(a["takeaway"]) <= 3:
            errs.append(f"{where}: points 3–5 条，takeaway 1–3 条")
        body = a.get("body")
        if not isinstance(body, list) or not all(isinstance(x, str) and x.strip() for x in body):
            errs.append(f"{where}: 缺少 body（深读正文，字符串数组）")
        elif not 1200 <= sum(len(x) for x in body) <= 9000:
            errs.append(f"{where}: body 应为 1200–9000 字，现在 {sum(len(x) for x in body)} 字")
        if not re.match(r"https?://", a["url"]):
            errs.append(f"{where}: url 不对")
        if a["url"] in seen:
            errs.append(f"{where}: 和 {seen[a['url']]} 重复")
        seen[a["url"]] = where
    return e, errs


def main():
    seen, errs, index = {}, [], []
    for p in sorted(ED.glob("20*.json")):
        e, es = check(p, seen)
        errs += es
        if e and not es:
            index.append({"no": e["no"], "date": e["date"], "count": len(e["articles"]),
                          "minutes": sum(min(a["minutes"], 30) for a in e["articles"]),
                          "titles": [a["title"] for a in e["articles"]]})
    nos = [i["no"] for i in index]
    if nos != list(range(1, len(nos) + 1)):
        errs.append(f"期号不连续：{nos}")
    if errs:
        print("\n".join(errs), file=sys.stderr)
        sys.exit(1)
    index.sort(key=lambda i: i["date"], reverse=True)
    (ED / "index.json").write_text(json.dumps({"editions": index}, ensure_ascii=False, indent=1) + "\n",
                                   encoding="utf-8")
    print(f"通过：{len(index)} 期，共 {sum(i['count'] for i in index)} 篇")


if __name__ == "__main__":
    main()
