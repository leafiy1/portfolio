#!/usr/bin/env python3
"""Run offline evaluation across office_agent samples."""
from __future__ import annotations

import csv
import json
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SAMPLES_DIR = ROOT / "samples"
OUTPUT_DIR = ROOT / "output" / "eval"


def normalize(text: str) -> str:
    return re.sub(
        r"[\s，。、,.:：;；()（）!！?？\"'“”‘’\-—·]",
        "",
        text,
    ).lower()


def run_sample(sample_dir: Path) -> dict:
    transcript = sample_dir / "transcript.txt"
    golden_path = sample_dir / "golden_actions.json"
    out_dir = OUTPUT_DIR / sample_dir.name
    proc = subprocess.run(
        [
            sys.executable,
            str(ROOT / "src" / "pipeline.py"),
            "--input",
            str(transcript),
            "--out",
            str(out_dir),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if proc.returncode != 0:
        return {
            "sample_id": sample_dir.name,
            "format_ok": False,
            "error": proc.stderr.strip() or proc.stdout.strip(),
            "actions": 0,
            "recall": 0.0,
            "precision": 0.0,
            "owner_accuracy": 0.0,
            "due_accuracy": 0.0,
        }

    golden = json.loads(golden_path.read_text(encoding="utf-8"))
    actual = json.loads((out_dir / "action_items.json").read_text(encoding="utf-8"))
    expected_map = {normalize(item["action"]): item for item in golden}
    actual_map = {normalize(item["action"]): item for item in actual}
    expected_keys = set(expected_map)
    actual_keys = set(actual_map)
    matched = expected_keys & actual_keys

    recall = (
        len(matched) / len(expected_keys)
        if expected_keys
        else (1.0 if not actual_keys else 0.0)
    )
    precision = (
        len(matched) / len(actual_keys)
        if actual_keys
        else (1.0 if not expected_keys else 0.0)
    )
    owner_hits = sum(
        actual_map[key].get("owner") == expected_map[key].get("owner")
        for key in matched
    )
    due_hits = sum(
        actual_map[key].get("due") == expected_map[key].get("due")
        for key in matched
    )
    owner_accuracy = owner_hits / len(matched) if matched else 1.0
    due_accuracy = due_hits / len(matched) if matched else 1.0

    return {
        "sample_id": sample_dir.name,
        "format_ok": (out_dir / "summary.md").exists()
        and (out_dir / "action_items.md").exists()
        and (out_dir / "action_items.json").exists()
        and (out_dir / "meta.json").exists(),
        "error": "",
        "actions": len(actual),
        "recall": round(recall, 4),
        "precision": round(precision, 4),
        "owner_accuracy": round(owner_accuracy, 4),
        "due_accuracy": round(due_accuracy, 4),
    }


def main() -> None:
    if not (SAMPLES_DIR / "sample_01" / "transcript.txt").exists():
        subprocess.run(
            [sys.executable, str(SAMPLES_DIR / "seed.py")],
            check=True,
            cwd=ROOT,
        )

    sample_dirs = sorted(
        path for path in SAMPLES_DIR.glob("sample_*") if path.is_dir()
    )
    rows = [run_sample(path) for path in sample_dirs]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    fields = [
        "sample_id",
        "format_ok",
        "actions",
        "recall",
        "precision",
        "owner_accuracy",
        "due_accuracy",
        "error",
    ]
    with (OUTPUT_DIR / "eval_results.csv").open(
        "w", newline="", encoding="utf-8-sig"
    ) as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)

    summary = {
        "total": len(rows),
        "format_ok_count": sum(row["format_ok"] for row in rows),
        "overall_recall": round(sum(row["recall"] for row in rows) / len(rows), 4),
        "overall_precision": round(
            sum(row["precision"] for row in rows) / len(rows), 4
        ),
        "pass": all(row["format_ok"] for row in rows)
        and sum(row["recall"] for row in rows) / len(rows) >= 0.9
        and sum(row["precision"] for row in rows) / len(rows) >= 0.9,
        "note": "事实错误数需人工复核；本评估只校验格式、行动项召回/精确率、负责人与截止一致率。",
        "rows": rows,
    }
    (OUTPUT_DIR / "eval_results.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"TOTAL {summary['total']}")
    print(f"FORMAT_OK {summary['format_ok_count']}/{summary['total']}")
    print(f"RECALL {summary['overall_recall']:.4f}")
    print(f"PRECISION {summary['overall_precision']:.4f}")
    print(f"PASS {summary['pass']}")


if __name__ == "__main__":
    main()
