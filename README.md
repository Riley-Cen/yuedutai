# 阅读台

每天 10 篇全球好文章的中文拆解，攒成写稿、做方案时搜得到、引得了的素材库。手机优先，可以加到主屏幕。

## 怎么运转

1. **抓取**：`pipeline/fetch.py` 从 30 多个分析型信源抓取近两周的文章，生成候选池。
2. **编辑**：Claude 按 `pipeline/EDITOR.md` 的标准选 10 篇、读全文、写拆解，存成 `editions/<日期>.json`。
3. **校验**：`pipeline/validate.py` 检查格式、查重，并重建 `editions/index.json`。
4. **发布**：推送到 `main` 后，GitHub Pages 自动更新网站；`.github/workflows/notify.yml` 发一条微信推送（需要在仓库 Secrets 里设置 `SERVERCHAN_SENDKEY`，没设置就跳过）。

网站是纯静态文件（`index.html`、`app.js`、`style.css`、`sw.js`），不需要构建。读者的方向、已读、素材库都只存在自己设备的浏览器里。

## 本地预览

```bash
python3 -m http.server 8000
```

## 路线

- v1（现在）：每日一期、按方向排序和个性化“对你有用”、收藏、素材库搜索与复制引用、导出 Markdown、离线阅读、微信推送
- v2：跨设备同步（同步码）、用大白话问素材库（回答带出处）、反馈同步给编辑
- 验证标准：种子用户 14 天里至少 10 天打开；素材库每周至少被问 2 次；选题命中率达到 60% 以上
