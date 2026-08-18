#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 GearPick v6.0 新品类价格核验清单。

只读取 products.json，不改产品数据；输出 markdown 供后续逐批核价使用。
"""
import json
import os


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRODUCTS_PATH = os.path.join(ROOT, "products.json")
OUT_PATH = os.path.join(ROOT, "价格核验清单_v6.md")

CATS = [
    ("monitors", "显示器"),
    ("chairs", "电竞椅"),
    ("accessories", "外设配件"),
]


def main():
    with open(PRODUCTS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    lines = [
        "# GearPick v6.0 新品类价格核验清单",
        "",
        "> 用途：把 674 款新品类从「价格待核实」逐条推进到「有公开参考价」。",
        "> 红线：禁止估算；每款必须记录 `price` / `price_note` / `price_verified_at` / `price_sources` 后写入 `products.json`，再执行 `node tools/embed_products.js`。",
        "",
        "## 工作节奏",
        "",
        "1. 每轮建议核实 20 款，优先从每个品牌头部型号开始。",
        "2. 核实后在同一行备注写入价格，并在 `products.json` 落地字段。",
        "3. 每轮结束更新本清单状态，并将进度写入 `CHECKPOINT.md`。",
        "",
        "## 核验方法（2026-08-18 实测）",
        "",
        "- 优先使用品牌官方产品页、电商商品详情页、比价站页面；价格必须能在页面/快照中看到。",
        "- 本环境实测：Bing 搜索无稳定价格快照，JD 搜索返回 JS 壳，部分品牌官方分类页返回 403，因此**不能用自动搜索结果代替人工核价**。",
        "- 核价时记录来源 URL 与核实日期；价格会浮动，`price_note` 必须写清是官方价/电商价/活动价。",
        "- 无法确认统一基准价的型号继续标「待核实」，不写估算值。",
        "",
        "## 汇总",
        "",
        "| 品类 | 数量 | 已核价 | 待核实 |",
        "| --- | --- | --- | --- |",
    ]

    total = 0
    for key, label in CATS:
        arr = data.get(key, [])
        total += len(arr)
        lines.append("| {} | {} | 0 | {} |".format(label, len(arr), len(arr)))
    lines.append("| 合计 | {} | 0 | {} |".format(total, total))
    lines.append("")

    for key, label in CATS:
        lines.append("## " + label)
        lines.append("")
        lines.append("| ID | 品牌 | 型号 | 类型 | 尺寸 | 价格状态 | 来源 |")
        lines.append("| --- | --- | --- | --- | --- | --- | --- |")
        for it in data.get(key, []):
            src = it.get("sources") or []
            url = src[0]["url"] if src and src[0].get("url") else it.get("source", "")
            lines.append(
                "| {} | {} | {} | {} | {} | 待核实 | [来源]({}) |".format(
                    it.get("id", ""),
                    it.get("brand", ""),
                    it.get("name", ""),
                    it.get("type", ""),
                    it.get("size", "—"),
                    url,
                )
            )
        lines.append("")

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print("written", OUT_PATH, len(lines), "lines")


if __name__ == "__main__":
    main()
