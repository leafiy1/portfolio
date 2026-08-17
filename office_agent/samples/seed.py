#!/usr/bin/env python3
"""Generate 20 offline evaluation samples for office_agent."""
from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent

SAMPLES = [
    {
        "id": "sample_01",
        "transcript_lines": [
            "# 会议：部门周知会",
            "# 参会人：全员",
            "今天只是同步一下版本进度，没有新增行动项。",
        ],
        "golden_actions": [],
    },
    {
        "id": "sample_02",
        "transcript_lines": [
            "# 会议：需求评审会",
            "# 参会人：产品、研发",
            "我们讨论了搜索页改版，暂不决定上线时间。",
        ],
        "golden_actions": [],
    },
    {
        "id": "sample_03",
        "transcript_lines": [
            "# 会议：项目周会",
            "# 参会人：王工、李经理",
            "王工，麻烦周五前整理本周测试结果。",
        ],
        "golden_actions": [
            {
                "action": "王工，麻烦周五前整理本周测试结果。",
                "owner": "王工",
                "due": "周五前",
                "priority": "medium",
            }
        ],
    },
    {
        "id": "sample_04",
        "transcript_lines": [
            "# Meeting: QA Sync",
            "# Attendees: Alice, Bob",
            "Alice, please prepare the release checklist by tomorrow.",
        ],
        "golden_actions": [
            {
                "action": "Alice, please prepare the release checklist by tomorrow.",
                "owner": "Alice",
                "due": "by tomorrow",
                "priority": "medium",
            }
        ],
    },
    {
        "id": "sample_05",
        "transcript_lines": [
            "# 会议：MES 上线准备会",
            "# 参会人：王工、李经理、陈工",
            "李经理请在8月30日前确认 MES 接口字段。",
            "王工，麻烦今天下班前整理产线测试数据。",
            "陈工，请下周三前完成权限清单。",
        ],
        "golden_actions": [
            {
                "action": "李经理请在8月30日前确认 MES 接口字段。",
                "owner": "李经理",
                "due": "8月30日前",
                "priority": "medium",
            },
            {
                "action": "王工，麻烦今天下班前整理产线测试数据。",
                "owner": "王工",
                "due": "今天下班前",
                "priority": "medium",
            },
            {
                "action": "陈工，请下周三前完成权限清单。",
                "owner": "陈工",
                "due": "下周三前",
                "priority": "medium",
            },
        ],
    },
    {
        "id": "sample_06",
        "transcript_lines": [
            "# 会议：每日站会",
            "# 参会人：张工、刘工、赵工、李经理",
            "张工，请今天内提交采购清单。",
            "刘工，麻烦明天前跟进供应商报价。",
            "赵工，请尽快整理设备台账。",
            "李经理，请周五前复核预算表。",
        ],
        "golden_actions": [
            {
                "action": "张工，请今天内提交采购清单。",
                "owner": "张工",
                "due": "今天内",
                "priority": "medium",
            },
            {
                "action": "刘工，麻烦明天前跟进供应商报价。",
                "owner": "刘工",
                "due": "明天前",
                "priority": "medium",
            },
            {
                "action": "赵工，请尽快整理设备台账。",
                "owner": "赵工",
                "due": None,
                "priority": "high",
            },
            {
                "action": "李经理，请周五前复核预算表。",
                "owner": "李经理",
                "due": "周五前",
                "priority": "medium",
            },
        ],
    },
    {
        "id": "sample_07",
        "transcript_lines": [
            "# 会议：数字化转型例会",
            "# 参会人：王总、陈经理、李工、周工",
            "陈经理，请在周五前确认 ERP 切换窗口。",
            "李工，麻烦今天下班前发送数据字典。",
            "周工，请下周一前完成用户权限梳理。",
            "王总，请在本周五前评审方案。",
            "刘工，请明天前整理风险清单。",
        ],
        "golden_actions": [
            {
                "action": "陈经理，请在周五前确认 ERP 切换窗口。",
                "owner": "陈经理",
                "due": "周五前",
                "priority": "medium",
            },
            {
                "action": "李工，麻烦今天下班前发送数据字典。",
                "owner": "李工",
                "due": "今天下班前",
                "priority": "medium",
            },
            {
                "action": "周工，请下周一前完成用户权限梳理。",
                "owner": "周工",
                "due": "下周一前",
                "priority": "medium",
            },
            {
                "action": "王总，请在本周五前评审方案。",
                "owner": "王总",
                "due": "本周五前",
                "priority": "medium",
            },
            {
                "action": "刘工，请明天前整理风险清单。",
                "owner": "刘工",
                "due": "明天前",
                "priority": "medium",
            },
        ],
    },
    {
        "id": "sample_08",
        "transcript_lines": [
            "# 会议：产线数字化周会",
            "# 参会人：王总、陈经理、李工、周工、吴工",
            "李工，请在周五前确认 MES 接口字段。",
            "周工，麻烦下周三前完成 OEE 报表口径。",
            "吴工，请明天前整理设备传感器清单。",
            "陈经理，请尽快提交 ERP 数据迁移计划。",
            "王总，请本周五前评审 AI 质检试点方案。",
        ],
        "golden_actions": [
            {
                "action": "李工，请在周五前确认 MES 接口字段。",
                "owner": "李工",
                "due": "周五前",
                "priority": "medium",
            },
            {
                "action": "周工，麻烦下周三前完成 OEE 报表口径。",
                "owner": "周工",
                "due": "下周三前",
                "priority": "medium",
            },
            {
                "action": "吴工，请明天前整理设备传感器清单。",
                "owner": "吴工",
                "due": "明天前",
                "priority": "medium",
            },
            {
                "action": "陈经理，请尽快提交 ERP 数据迁移计划。",
                "owner": "陈经理",
                "due": None,
                "priority": "high",
            },
            {
                "action": "王总，请本周五前评审 AI 质检试点方案。",
                "owner": "王总",
                "due": "本周五前",
                "priority": "medium",
            },
        ],
    },
    {
        "id": "sample_09",
        "transcript_lines": [
            "# 会议：看板与报表例会",
            "# 参会人：李工、周工、吴工、陈经理、王总、赵工",
            "李工，请明天前整理设备台账。",
            "周工，麻烦周五前完成报表口径。",
            "吴工，请下周二前统计故障次数。",
            "陈经理，请尽快提交数据迁移计划。",
            "王总，请本周五前评审试点方案。",
            "赵工，请今天下班前更新看板原型。",
        ],
        "golden_actions": [
            {
                "action": "李工，请明天前整理设备台账。",
                "owner": "李工",
                "due": "明天前",
                "priority": "medium",
            },
            {
                "action": "周工，麻烦周五前完成报表口径。",
                "owner": "周工",
                "due": "周五前",
                "priority": "medium",
            },
            {
                "action": "吴工，请下周二前统计故障次数。",
                "owner": "吴工",
                "due": "下周二前",
                "priority": "medium",
            },
            {
                "action": "陈经理，请尽快提交数据迁移计划。",
                "owner": "陈经理",
                "due": None,
                "priority": "high",
            },
            {
                "action": "王总，请本周五前评审试点方案。",
                "owner": "王总",
                "due": "本周五前",
                "priority": "medium",
            },
            {
                "action": "赵工，请今天下班前更新看板原型。",
                "owner": "赵工",
                "due": "今天下班前",
                "priority": "medium",
            },
        ],
    },
    {
        "id": "sample_10",
        "transcript_lines": [
            "# 会议：生产看板需求会",
            "# 参会人：王工、李经理、陈工",
            "大家先随便聊几句，今天主要是生产看板。",
            "王工，麻烦明天前整理看板字段清单。",
            "李经理，请周五前确认权限规则。",
            "前面说的接口字段，更正一下，以 8月10日 版本为准。",
            "陈工，请今天下班前更新原型。",
            "周工，麻烦下周二前统计页面访问日志。",
        ],
        "golden_actions": [
            {
                "action": "王工，麻烦明天前整理看板字段清单。",
                "owner": "王工",
                "due": "明天前",
                "priority": "medium",
            },
            {
                "action": "李经理，请周五前确认权限规则。",
                "owner": "李经理",
                "due": "周五前",
                "priority": "medium",
            },
            {
                "action": "陈工，请今天下班前更新原型。",
                "owner": "陈工",
                "due": "今天下班前",
                "priority": "medium",
            },
            {
                "action": "周工，麻烦下周二前统计页面访问日志。",
                "owner": "周工",
                "due": "下周二前",
                "priority": "medium",
            },
        ],
    },
    {
        "id": "sample_11",
        "transcript_lines": [
            "# 会议：库存看板评审",
            "# 参会人：赵工、钱工、孙工",
            "就是那个，嗯，库存看板，大家看一下。",
            "赵工，麻烦明天前核对库存口径。",
            "钱工，请周五前提交接口联调说明。",
            "孙工，请尽快整理异常库存清单。",
        ],
        "golden_actions": [
            {
                "action": "赵工，麻烦明天前核对库存口径。",
                "owner": "赵工",
                "due": "明天前",
                "priority": "medium",
            },
            {
                "action": "钱工，请周五前提交接口联调说明。",
                "owner": "钱工",
                "due": "周五前",
                "priority": "medium",
            },
            {
                "action": "孙工，请尽快整理异常库存清单。",
                "owner": "孙工",
                "due": None,
                "priority": "high",
            },
        ],
    },
    {
        "id": "sample_12",
        "transcript_lines": [
            "# 会议：临时碰头会",
            "# 参会人：王工、李经理",
            "王工，有空的话跟进一下供应商报价。",
            "李经理，确认一下 ERP 上线窗口，有空告诉我。",
        ],
        "golden_actions": [
            {
                "action": "王工，有空的话跟进一下供应商报价。",
                "owner": "王工",
                "due": None,
                "priority": "low",
            },
            {
                "action": "李经理，确认一下 ERP 上线窗口，有空告诉我。",
                "owner": "李经理",
                "due": None,
                "priority": "low",
            },
        ],
    },
    {
        "id": "sample_13",
        "transcript_lines": [
            "# Meeting: Standup",
            "# Attendees: Alice, Bob",
            "Alice, please send the daily status by 5pm.",
            "Bob, please update the test case list by Friday.",
        ],
        "golden_actions": [
            {
                "action": "Alice, please send the daily status by 5pm.",
                "owner": "Alice",
                "due": "by 5pm",
                "priority": "medium",
            },
            {
                "action": "Bob, please update the test case list by Friday.",
                "owner": "Bob",
                "due": "by Friday",
                "priority": "medium",
            },
        ],
    },
    {
        "id": "sample_14",
        "transcript_lines": [
            "# Meeting: Release Planning",
            "# Attendees: Alice, Bob, Carol",
            "Alice, please confirm the deployment window by Friday.",
            "Bob, please prepare the rollback plan by tomorrow.",
            "Carol, please update the release notes by end of day.",
        ],
        "golden_actions": [
            {
                "action": "Alice, please confirm the deployment window by Friday.",
                "owner": "Alice",
                "due": "by Friday",
                "priority": "medium",
            },
            {
                "action": "Bob, please prepare the rollback plan by tomorrow.",
                "owner": "Bob",
                "due": "by tomorrow",
                "priority": "medium",
            },
            {
                "action": "Carol, please update the release notes by end of day.",
                "owner": "Carol",
                "due": "by end of day",
                "priority": "medium",
            },
        ],
    },
    {
        "id": "sample_15",
        "transcript_lines": [
            "# Meeting: Weekly Operations",
            "# Attendees: Alice, Bob, Carol, Dan",
            "Alice, please send the weekly report by Friday.",
            "Bob, please verify the API response by tomorrow.",
            "Carol, please document the known issues by next Monday.",
            "Dan, please coordinate with QA by end of day.",
        ],
        "golden_actions": [
            {
                "action": "Alice, please send the weekly report by Friday.",
                "owner": "Alice",
                "due": "by Friday",
                "priority": "medium",
            },
            {
                "action": "Bob, please verify the API response by tomorrow.",
                "owner": "Bob",
                "due": "by tomorrow",
                "priority": "medium",
            },
            {
                "action": "Carol, please document the known issues by next Monday.",
                "owner": "Carol",
                "due": "by next Monday",
                "priority": "medium",
            },
            {
                "action": "Dan, please coordinate with QA by end of day.",
                "owner": "Dan",
                "due": "by end of day",
                "priority": "medium",
            },
        ],
    },
    {
        "id": "sample_16",
        "transcript_lines": [
            "# Meeting: Data Platform Review",
            "# Attendees: Alice, Bob, Carol, Dan, Eve",
            "Alice, please confirm the data dictionary by Friday.",
            "Bob, please prepare the ETL validation plan by tomorrow.",
            "Carol, please update the monitoring dashboard by end of day.",
            "Dan, please send the incident summary by next Tuesday.",
            "Eve, please review the security checklist by Friday.",
        ],
        "golden_actions": [
            {
                "action": "Alice, please confirm the data dictionary by Friday.",
                "owner": "Alice",
                "due": "by Friday",
                "priority": "medium",
            },
            {
                "action": "Bob, please prepare the ETL validation plan by tomorrow.",
                "owner": "Bob",
                "due": "by tomorrow",
                "priority": "medium",
            },
            {
                "action": "Carol, please update the monitoring dashboard by end of day.",
                "owner": "Carol",
                "due": "by end of day",
                "priority": "medium",
            },
            {
                "action": "Dan, please send the incident summary by next Tuesday.",
                "owner": "Dan",
                "due": "by next Tuesday",
                "priority": "medium",
            },
            {
                "action": "Eve, please review the security checklist by Friday.",
                "owner": "Eve",
                "due": "by Friday",
                "priority": "medium",
            },
        ],
    },
    {
        "id": "sample_17",
        "transcript_lines": [
            "# Meeting: Onboarding Rollout",
            "# Attendees: mixed",
            "The next action is to update the onboarding doc by Friday.",
            "Alice, please review the API spec by tomorrow.",
            "Bob, please send the status report by end of day.",
            "Carol, please prepare the migration plan by next Monday.",
            "Dan, please verify the rollout checklist by Friday.",
        ],
        "golden_actions": [
            {
                "action": "The next action is to update the onboarding doc by Friday.",
                "owner": None,
                "due": "by Friday",
                "priority": "medium",
            },
            {
                "action": "Alice, please review the API spec by tomorrow.",
                "owner": "Alice",
                "due": "by tomorrow",
                "priority": "medium",
            },
            {
                "action": "Bob, please send the status report by end of day.",
                "owner": "Bob",
                "due": "by end of day",
                "priority": "medium",
            },
            {
                "action": "Carol, please prepare the migration plan by next Monday.",
                "owner": "Carol",
                "due": "by next Monday",
                "priority": "medium",
            },
            {
                "action": "Dan, please verify the rollout checklist by Friday.",
                "owner": "Dan",
                "due": "by Friday",
                "priority": "medium",
            },
        ],
    },
    {
        "id": "sample_18",
        "transcript_lines": [
            "# 会议：出海项目周会",
            "# 参会人：Alice、王工",
            "Alice, please send the English FAQ by Friday.",
            "王工，麻烦明天前整理中文翻译稿。",
            "Alice, please confirm the pricing page copy by end of day.",
            "王工，请下周三前完成本地化测试清单。",
        ],
        "golden_actions": [
            {
                "action": "Alice, please send the English FAQ by Friday.",
                "owner": "Alice",
                "due": "by Friday",
                "priority": "medium",
            },
            {
                "action": "王工，麻烦明天前整理中文翻译稿。",
                "owner": "王工",
                "due": "明天前",
                "priority": "medium",
            },
            {
                "action": "Alice, please confirm the pricing page copy by end of day.",
                "owner": "Alice",
                "due": "by end of day",
                "priority": "medium",
            },
            {
                "action": "王工，请下周三前完成本地化测试清单。",
                "owner": "王工",
                "due": "下周三前",
                "priority": "medium",
            },
        ],
    },
    {
        "id": "sample_19",
        "transcript_lines": [
            "# 会议：口头确认",
            "# 参会人：王工",
            "王工，有空跟进一下本周的供应商报价。",
        ],
        "golden_actions": [
            {
                "action": "王工，有空跟进一下本周的供应商报价。",
                "owner": "王工",
                "due": None,
                "priority": "low",
            }
        ],
    },
    {
        "id": "sample_20",
        "transcript_lines": [
            "# 会议：年度数字化规划会",
            "# 参会人：王总、陈经理、李工、周工、吴工、郑工、孙工",
            "李工，请在周五前整理 MES 现状清单。",
            "周工，请下周一前完成 OEE 口径初稿。",
            "吴工，麻烦明天前提供传感器清单。",
            "陈经理，请尽快确认 ERP 集成范围。",
            "王总，请在本周五前评审年度预算。",
            "郑工，请今天下班前汇总培训需求。",
            "孙工，请下周三前整理数据治理清单。",
            "李经理，请明天前同步项目风险表。",
        ],
        "golden_actions": [
            {
                "action": "李工，请在周五前整理 MES 现状清单。",
                "owner": "李工",
                "due": "周五前",
                "priority": "medium",
            },
            {
                "action": "周工，请下周一前完成 OEE 口径初稿。",
                "owner": "周工",
                "due": "下周一前",
                "priority": "medium",
            },
            {
                "action": "吴工，麻烦明天前提供传感器清单。",
                "owner": "吴工",
                "due": "明天前",
                "priority": "medium",
            },
            {
                "action": "陈经理，请尽快确认 ERP 集成范围。",
                "owner": "陈经理",
                "due": None,
                "priority": "high",
            },
            {
                "action": "王总，请在本周五前评审年度预算。",
                "owner": "王总",
                "due": "本周五前",
                "priority": "medium",
            },
            {
                "action": "郑工，请今天下班前汇总培训需求。",
                "owner": "郑工",
                "due": "今天下班前",
                "priority": "medium",
            },
            {
                "action": "孙工，请下周三前整理数据治理清单。",
                "owner": "孙工",
                "due": "下周三前",
                "priority": "medium",
            },
            {
                "action": "李经理，请明天前同步项目风险表。",
                "owner": "李经理",
                "due": "明天前",
                "priority": "medium",
            },
        ],
    },
]


def main() -> None:
    for sample in SAMPLES:
        sample_dir = ROOT / sample["id"]
        sample_dir.mkdir(parents=True, exist_ok=True)
        transcript = "\n".join(sample["transcript_lines"]) + "\n"
        (sample_dir / "transcript.txt").write_text(transcript, encoding="utf-8")
        (sample_dir / "golden_actions.json").write_text(
            json.dumps(sample["golden_actions"], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    print(f"OK generated {len(SAMPLES)} samples under {ROOT}")


if __name__ == "__main__":
    main()
