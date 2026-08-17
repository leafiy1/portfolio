#!/usr/bin/env python3
"""Local text pipeline for meeting transcripts -> summary and action items."""
from __future__ import annotations

import argparse
import json
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Any


PIPELINE_VERSION = "0.1.0"

ACTION_VERBS = (
    "确认", "跟进", "整理", "发送", "提交", "完成", "统计", "安排",
    "推动", "联系", "更新", "对接", "协调", "落实", "提供", "处理",
    "准备", "复核", "评审", "修复", "上线", "输出", "拉通", "同步",
    "核对", "汇总",
)

EN_ACTION_VERBS = (
    "prepare", "update", "send", "confirm", "verify", "document",
    "coordinate", "review", "submit", "complete", "fix", "deploy",
    "output", "sync", "follow", "schedule", "check",
)

OWNER_PATTERNS = [
    re.compile(
        r"(?:由|请|让)\s*"
        r"([\u4e00-\u9fa5A-Za-z0-9]{1,12}(?:工|经理|老师|同学|总|组长|主管|负责人))"
        r"\s*(?:负责|跟进|确认|整理|发送|提交|完成|统计|安排|推动|联系|更新|对接|协调|落实|提供|处理|准备|复核|同步)"
    ),
    re.compile(
        r"^([\u4e00-\u9fa5A-Za-z0-9]{1,12}(?:工|经理|老师|同学|总|组长|主管|负责人))"
        r"\s*(?:请|请在?|麻烦)?\s*[^，。]{0,24}?"
        r"(?:负责|跟进|确认|整理|发送|提交|完成|统计|安排|推动|联系|更新|对接|协调|落实|提供|处理|准备|复核|同步|核对|汇总)"
    ),
    re.compile(
        r"([\u4e00-\u9fa5A-Za-z0-9]{1,12}(?:工|经理|老师|同学|总|组长|主管|负责人))"
        r"\s*[，,、\s]+"
        r"(?:有空(?:的话)?|麻烦|请|需要|记得|负责|跟进|安排|确认|整理|发送|提交|完成|统计|推动|联系|更新|对接|协调|落实|提供|处理|准备|复核|同步)"
    ),
    re.compile(
        r"([A-Za-z]{2,20})\s*[，,、\s]+"
        r"(?:please|can you|need to|should|will|kindly)"
    ),
]

DUE_PATTERNS = [
    r"今天(?:下班前|内)?",
    r"明天(?:下班前|内|前)?",
    r"本周[一二三四五六日](?:前|内)?",
    r"下[周月](?:[一二三四五六日])?(?:前|内)?",
    r"\d{1,2}月\d{1,2}日(?:前|内)?",
    r"\d{4}-\d{2}-\d{2}",
    r"by\s+[\d]{1,2}(?::\d{2})?\s*(?:am|pm)",
    r"by\s+(?:tomorrow|this\s+week|next\s+\w+|end\s+of\s+day)",
    r"by\s+[\w\s:]+",
    r"within\s+\d+\s+(?:day|week|hour)s?",
    r"\bEOD\b",
    r"周五前",
]


def clean_line(line: str) -> str:
    line = line.strip()
    line = re.sub(
        r"^(?:[\dA-Za-z一二三四五六七八九十]+[\.、)）]\s*|[-*•]\s*)",
        "",
        line,
    )
    return line.strip()


def parse_meta(text: str) -> tuple[str, list[str]]:
    title = "未命名会议"
    participants: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        m = re.match(r"^#\s*(?:会议|Meeting)[:：]\s*(.+)", line, re.IGNORECASE)
        if m:
            title = m.group(1).strip()
        m = re.match(
            r"^#\s*(?:参会人|Attendees|Participants)[:：]\s*(.+)",
            line,
            re.IGNORECASE,
        )
        if m:
            participants = [
                item.strip()
                for item in re.split(r"[、,，/]", m.group(1))
                if item.strip()
            ]
    return title, participants


def extract_owner(line: str) -> str | None:
    for pattern in OWNER_PATTERNS:
        m = pattern.search(line)
        if m:
            return m.group(1)
    return None


def extract_due(line: str) -> str | None:
    for pattern in DUE_PATTERNS:
        m = re.search(pattern, line, re.IGNORECASE)
        if m:
            return m.group(0)
    return None


def extract_priority(line: str) -> str:
    if re.search(r"紧急|尽快|最晚|must|urgent|asap", line, re.IGNORECASE):
        return "high"
    if re.search(r"有空|有空的话|if\s+you\s+have\s+time|whenever", line, re.IGNORECASE):
        return "low"
    return "medium"


def normalize(text: str) -> str:
    return re.sub(
        r"[\s，。、,.:：;；()（）!！?？\"'“”‘’\-—·]",
        "",
        text,
    ).lower()


def _looks_like_action(line: str) -> bool:
    lowered = line.lower()
    return any(verb in line for verb in ACTION_VERBS) or any(
        verb in lowered for verb in EN_ACTION_VERBS
    )


def extract_actions(text: str) -> list[dict[str, Any]]:
    actions: list[dict[str, Any]] = []
    seen: set[str] = set()
    for idx, raw in enumerate(text.splitlines()):
        line = clean_line(raw)
        if not line or line.startswith("#") or line.startswith("//"):
            continue
        if len(line) < 6 or not _looks_like_action(line):
            continue
        if re.search(r"没有(?:新增)?行动项|暂不|无需|只是|不决定|不新增", line):
            continue
        if re.match(r"^(?:为什么|如何|什么|是否|大家|咱们|我们|会议|议题|结论|风险|时间|地点)", line):
            continue

        m = re.search(r"(?:行动项|ACTION|ToDo|待办)[:：]\s*(.*)", line, re.IGNORECASE)
        action_text = m.group(1).strip() if m else line
        key = normalize(action_text)
        if not key or key in seen:
            continue
        seen.add(key)
        actions.append(
            {
                "id": f"A{len(actions) + 1:02d}",
                "action": action_text,
                "owner": extract_owner(line),
                "due": extract_due(line),
                "priority": extract_priority(line),
                "status": "open",
                "source_line": idx + 1,
            }
        )
    return actions


def build_summary(
    title: str,
    participants: list[str],
    text: str,
    actions: list[dict[str, Any]],
) -> str:
    lines = [clean_line(line) for line in text.splitlines() if clean_line(line)]
    conclusions = [
        line
        for line in lines
        if any(k in line for k in ("结论", "决定", "确认了", "确定", "方案", "决策"))
    ]
    risks = [
        line
        for line in lines
        if any(k in line for k in ("风险", "待确认", "注意", "问题", "不确定"))
    ]
    action_lines = [
        f"{index}. {item['action']}"
        f"（负责人：{item['owner'] or '待指派'}；截止：{item['due'] or '待定'}；优先级：{item['priority']}）"
        for index, item in enumerate(actions, start=1)
    ]
    summary_parts = [
        f"# {title}",
        "",
        f"- 参会人：{'、'.join(participants) if participants else '未标注'}",
        "",
        "## 摘要",
        "",
    ]
    if conclusions:
        summary_parts.extend(["- " + item for item in conclusions])
    else:
        summary_parts.append("- 会议无明确结论，建议以行动项为准。")
    summary_parts.extend(["", "## 行动项", ""])
    summary_parts.extend(action_lines or ["- 无行动项。"])
    summary_parts.extend(["", "## 风险与待确认", ""])
    summary_parts.extend(["- " + item for item in risks] or ["- 无。"])
    return "\n".join(summary_parts)


def write_outputs(
    input_path: Path,
    out_dir: Path,
    text: str,
    actions: list[dict[str, Any]],
    elapsed_ms: int,
) -> tuple[dict[str, Any], dict[str, Any]]:
    out_dir.mkdir(parents=True, exist_ok=True)
    title, participants = parse_meta(text)
    summary = build_summary(title, participants, text, actions)

    action_items_md_lines = [
        "# 行动项",
        "",
        "| 编号 | 行动 | 负责人 | 截止 | 优先级 | 状态 | 来源行 |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for item in actions:
        action_items_md_lines.append(
            f"| {item['id']} | {item['action']} | {item['owner'] or '待指派'} | "
            f"{item['due'] or '待定'} | {item['priority']} | open | {item['source_line']} |"
        )
    action_items_md = "\n".join(action_items_md_lines) + "\n"

    (out_dir / "summary.md").write_text(summary, encoding="utf-8")
    (out_dir / "action_items.md").write_text(action_items_md, encoding="utf-8")
    (out_dir / "action_items.json").write_text(
        json.dumps(actions, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    meta = {
        "pipeline": "office_agent/local-text",
        "version": PIPELINE_VERSION,
        "input_file": str(input_path),
        "output_dir": str(out_dir),
        "run_at": datetime.now().isoformat(timespec="seconds"),
        "duration_ms": elapsed_ms,
        "stages": {
            "transcript_read": {"status": "ok", "mode": "manual_text"},
            "asr": {
                "status": "skipped",
                "mode": "manual_text",
                "note": "未提供音频，使用人工/合成转写稿",
            },
            "summarize": {
                "status": "ok",
                "mode": "rule_based",
                "note": "未调用 LLM，保持本地可复现",
            },
            "actions": {"status": "ok", "count": len(actions)},
            "distribution": {
                "status": "skipped",
                "reason": "未配置 FEISHU_APP_ID / FEISHU_APP_SECRET",
            },
        },
        "llm": {"provider": None, "model": None},
    }
    (out_dir / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return meta, {"summary": summary, "action_items_md": action_items_md}


def run_pipeline(input_path: Path, out_dir: Path) -> tuple[dict[str, Any], list[dict[str, Any]], int]:
    started = time.perf_counter()
    text = input_path.read_text(encoding="utf-8")
    actions = extract_actions(text)
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    meta, _ = write_outputs(input_path, out_dir, text, actions, elapsed_ms)
    return meta, actions, elapsed_ms


def main() -> None:
    parser = argparse.ArgumentParser(description="office_agent local text pipeline")
    parser.add_argument("--input", required=True, help="path to transcript text file")
    parser.add_argument("--out", default="output/run", help="output directory")
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    out_dir = Path(args.out).resolve()
    if not input_path.exists():
        raise SystemExit(f"input not found: {input_path}")

    meta, actions, elapsed_ms = run_pipeline(input_path, out_dir)
    print(f"OK {input_path.name} -> {out_dir} ({elapsed_ms}ms)")
    print(f"ACTIONS: {len(actions)}")
    print(f"MODE: {meta['stages']['summarize']['mode']}")


if __name__ == "__main__":
    main()
