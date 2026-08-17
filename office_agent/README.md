# 办公 Agent · 本地文本管线

> 状态：本地可运行，无真实凭证；先把「会议转写稿 → 摘要 → 行动项」链路跑通，再补 ASR 与飞书分发。

## 当前能力

- 输入：会议转写稿文本（中文/英文/中英混合）。
- 输出：`summary.md`、`action_items.md`、`action_items.json`、`meta.json`。
- 默认模式：规则抽取 + 模板摘要，不调用 LLM、不联网、不读取真实录音，保证可复现、零成本。
- 评测：20 条合成/脱敏样本，覆盖短会、长会、制造业术语、噪音更正、英文、隐式行动项。
- 当前结果：20/20 格式完整，行动项召回/精确率 1.0，负责人/截止一致率 1.0（合成样本）。

## 运行

```powershell
# 1. 生成 20 条样本
python samples/seed.py

# 2. 单条运行
python src/pipeline.py --input samples/sample_01/transcript.txt --out output/sample_01

# 3. 全量评测
python eval/run_eval.py
```

## 目录

```text
office_agent/
  src/pipeline.py       # 文本转写稿 → 摘要/行动项
  samples/seed.py       # 生成 20 条评测样本与 golden 行动项
  eval/run_eval.py      # 行动项召回/精确率、负责人/截止一致率
  output/               # 运行产物（默认不入库）
  .env.example          # 未来接 LLM / 飞书时使用
```

## 后续

1. 接真实 ASR：音频 → 带时间戳转写稿。
2. 接 OpenAI 兼容 LLM：摘要/行动项结构化输出，并记录模型名与成本。
3. 接飞书分发：只在显式配置接收人后启用，默认不群发。
4. 真实会议评测：用脱敏转写稿替代合成样本，更新 `CHECKPOINT.md` 数据。
