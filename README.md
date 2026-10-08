# 职场英语挑战赛 · 写作大赛训练营（Writing Arena）

面向 **"中国教育电视台·外研社杯"职场英语挑战赛写作大赛**（省赛 / 全国决赛）的自助训练网站。纯静态前端，无构建、无后端，双击 `index.html` 即可使用；可一键部署到 GitHub Pages。

> ⚠️ 本项目为个人学习训练工具，与赛事组委会无任何关联。题库含**原创训练题**与**官方样题**两部分：原创题图表为模拟数据；官方样题只照录题面（题面版权归主办方所有）并附官方原文链接，官方配图与优秀例文不进入本仓库，图表按官方数据重绘、范文由本平台自写。模拟/AI 评分仅供训练参考，不代表真实赛制得分。

## ✨ 功能

- 📚 **题库 93 道**（88 道原创训练题 + 5 道官方样题）：对齐省赛（2 题/120 分钟）与决赛（3 题/150 分钟）的真实题型结构与分值
  - 看文字信息写作（求职信、回复邮件、通知、投诉信、咨询邮件、感谢信、道歉信、建议信、邀请函、备忘录等 10+ 体裁）
  - 看图表信息写作（柱状图 / 折线图 / 饼图 / 表格，数据均为模拟数据并注明）
  - 看短文议论文（哲理故事 + 观点陈述/论证/结论三段式）
  - 应用文写作（决赛题型）
  - 官方样题 5 道（省赛 Part I/II + 决赛 Part I/II/III）：题面照录、标注出处并附官方原文链接，图表按官方数据重绘
  - 按 来源（官方样题 / 原创模拟题）/ 阶段 / 题型 / 难度（基础·进阶·冲刺）/ 主题方向 分类筛选，支持关键词搜索
- ⏱️ **全真模拟作答**：倒计时（到点自动交卷）、实时字数统计、草稿每 30 秒自动保存、提交确认
- 🧑‍🏫 **AI 判分（双模式）**：
  - **模拟评分版（默认，无需任何 Key）**：内置 41 条英语写作规则引擎，按官方四维（内容与切题 35% / 语法与词汇 30% / 组织与连贯 25% / 格式与字数 10%）打分，逐条批改并引用原文（错在哪 / 为什么错 / 怎么改）
  - **真实 AI 评分（可选）**：接入 OpenAI 兼容接口（GPT / Claude / DeepSeek / GLM / 通义 / Gemini / OpenRouter 等），失败自动回退模拟评分并明确标注
- 📖 **判分后展示参考范文**，供对比学习
- 📈 **学习记录**：作答历史、得分明细、总分进步曲线（SVG）、一键导出 JSON

## 🚀 本地运行

方式一（零依赖）：

```
直接双击 index.html
```

方式二（推荐，规避浏览器对 file:// 的部分限制）：

```bash
cd writing-arena
python -m http.server 8000     # 或 npx serve .
# 浏览器打开 http://localhost:8000
```

## 🧠 AI 判分配置（可选）

1. 复制 `js/config.example.js` 为 `js/config.js`（`config.js` 已在 `.gitignore` 中，**不会**提交到仓库）；
2. 修改 `mockMode: false`，填入 `endpoint / model / apiKey`；
3. 常用 OpenAI 兼容 endpoint 示例（已写入 `config.example.js` 注释）：

| 模型厂商 | endpoint 示例 | 备注 |
| --- | --- | --- |
| DeepSeek | `https://api.deepseek.com/v1/chat/completions` | 便宜；见下方选型建议 |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4/chat/completions` | 国内直连 |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | 国内直连 |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` | 有免费额度 |
| OpenAI | `https://api.openai.com/v1/chat/completions` | 质量标杆 |
| OpenRouter | `https://openrouter.ai/api/v1/chat/completions` | 一个 Key 用多个模型（含 Claude） |

🔒 **安全提醒**：Key 只保存在你本机的 `js/config.js` 中，永不入库、不随 GitHub Pages 发布。在线部署版默认无 Key，会自动使用模拟评分。

4. 接入后跑一次自检，确认 Key、模型、跨域与判分全链路都通：

```bash
node tools/ai_check.mjs                 # 默认用 jw06 的参考范文试判
node tools/ai_check.mjs jw06 坏文        # 用一段故意写坏的作文验证区分度
node tools/ai_check.mjs jy01 范文 deepseek-v4-pro   # 第 3 个参数可临时换模型
```

结果页会显示本次判分所用的模型、耗时与 token 消耗（如 `🤖 AI 评分（deepseek-chat · 5.9s · 消耗 1809 tokens）`）。

### 🔬 本机实测记录（2026-09-30，DeepSeek API）

用 `tools/ai_check.mjs` 在真实 API 上跑同一道题（jw06 商务约见邮件）的参考范文与一段"故意写坏"的作文：

| 模型 | 参考范文 | 故意写坏的作文 | 单篇耗时 | 单篇 token |
| --- | --- | --- | --- | --- |
| `deepseek-chat` | 89–91 分（A） | 16–21 分（D） | 5.9–7.8 秒 | 约 1.8–2.5K |
| `deepseek-v4-pro` | 88 分（A） | 8 分（D） | 28–36 秒 | 约 4–5.2K（含推理 token） |
| `deepseek-flash` | 86 分（A） | 10 分（D） | 21–24 秒 | 约 4.9–6.3K（含推理 token） |

跨题型一致性：同一模型给 jw06 / jy01（议论文）/ st01（省赛图表）三篇参考范文分别打 89 / 88 / 88 分，尺度稳定。批改质量抽查：能指出参考范文里 `held from 8 to 10 April` 作后置定语与将来时冲突（建议改 `which will be held`）、`a good chance` 在商务语境偏口语（建议 `opportunity`）；对坏文章则准确抓出 `I am write` → `I am writing`、`He go` 主谓不一致、`want discuss about` 双错等。

跨域实测：`api.deepseek.com` 对浏览器预检（OPTIONS）返回 200 并回显 `Access-Control-Allow-Origin`，三种打开方式都实测通过——GitHub Pages 线上域名、`http://localhost:8000`（本地静态服务器）、以及直接双击的 `file://`（`Origin: null`）。因此**纯静态页面可以直接调用真实 AI，无需自建后端代理**（Key 仍应只留在本地 `js/config.js` 里）。

**建议**：日常练习用 `deepseek-chat`（快、省，且对水平差异的区分稳定）；需要"最严阅卷"的精批场景，把 `js/config.js` 的 `model` 改为 `deepseek-v4-pro`，同时把 `timeoutMs` 保持 120000。
⚠️ 说明：以上检验的是"同一模型对不同水平作文的区分度与点评质量"，并不等于与真人阅卷老师的评分一致性；正式模拟仍建议严格限时 + 对照片范文。

### 🧪 AI 判分模型选型建议（基于公开研究）

**结论：追求"最接近真人老师批改"，首选 Claude 或 GPT 系列；追求性价比，选 Gemini / GLM；DeepSeek 便宜但评分与真人一致性偏差略大，更适合做语法纠错与初稿反馈。**

> 补充：本节结论来自公开研究；本项目 2026-09-30 在自建题库上的实测（见下方"本机实测记录"）显示 DeepSeek 的**区分度与点评质量稳定**，但"与真人阅卷的一致性"仍需用真实考生样卷进一步验证——两者并不冲突：能分辨好文与坏文 ≠ 分数与教师逐分对齐。

依据：

- 2025 年发表于 *Education and Information Technologies* 的研究《Evaluating the performance of ChatGPT and Claude in automated writing scoring: Insights from the Many-facet Rasch model》用多面 Rasch 模型（测量学上评估评分者一致性/偏差的标准方法）对 ChatGPT 与 Claude 的作文自动评分做了系统检验——这也是目前公开文献中对该问题的专门研究，两大旗舰模型是研究者默认的"评分者"候选（[ACM 收录页](https://dl.acm.org/doi/10.1007/s10639-025-13774-4)）。
- 一项学位论文实测发现 **DeepSeek 的评分与教师评分存在显著偏差**（"significantly less accurate, with several major deviations from teacher scoring"，如部分题给分与教师明显不同），提示其不适合直接承担"打分"职能（[theseus.fi 论文](https://www.theseus.fi/bitstream/handle/10024/905724/Dominguez%20Eguia_Aaron.pdf?sequence=3&isAllowed=y)）。
- 印尼 Telkom 大学对比研究将 ChatGPT 4o、Gemini 2.0、LLaMA 4 作为英语作文反馈的三个主流候选（[Telkom University 研究库](https://repository.telkomuniversity.ac.id/pustaka/242656/analisis-performa-respon-llms-terhadap-essay-bahasa-inggris-studi-komparatif-chatgpt-4o-gemini-2-0-dan-llama-4-dalam-bentuk-buku-karya-ilmiah.html)）。

实用组合建议（本站已按此设计）：

| 用途 | 推荐 | 理由 |
| --- | --- | --- |
| 四维打分 + 质性批改（主） | **Claude Sonnet/Opus 或 GPT-5.x** | 与真人评分一致性研究最多、反馈措辞最像"严格阅卷老师" |
| 兼顾成本与质量 | **Gemini 2.x / GLM-4.x** | 免费额度/低价，反馈质量良好 |
| 硬性语法检查（辅） | **LanguageTool 公开 API** | 免费、规则精确，与 LLM 互补（本项目内置规则引擎即此思路的本地实现） |
| 预算极优先 | DeepSeek | 单价最低；建议只用它做初稿批注，四维总分仍交给规则引擎校准 |

## 📂 目录结构

```
writing-arena/
├── index.html             # 题库（筛选 + 统计）
├── practice.html          # 作答（倒计时/字数/草稿）
├── result.html            # 判分结果（四维分 + 逐条批改 + 范文）
├── history.html           # 学习记录（统计 + 进步曲线）
├── css/style.css          # 设计系统（响应式）
├── js/
│   ├── app.js             # 题库页逻辑
│   ├── practice.js        # 作答页逻辑
│   ├── result.js          # 结果页逻辑
│   ├── history.js         # 记录页逻辑
│   ├── chart.js           # 自绘 SVG 图表（bar/line/pie/table）
│   ├── scorer.js          # 判分引擎（mock 规则 + 真实 AI 适配器）★ AI 接入点在此
│   ├── config.js          # 你的 API 配置（不入库）
│   ├── config.example.js  # 配置模板
│   └── questions-data.js  # 内嵌题库（自动生成，保证 file:// 双击可用）
├── data/
│   ├── questions.json     # 题库源数据（合并生成，可人工编辑）
│   └── raw/*.json         # 分类原始题目
├── tools/merge_questions.mjs  # 题库合并校验脚本（含 answerTerms 自动抽取）
├── tools/keyword_audit.mjs    # 内容切题度体检（参考范文自评，可接 CI）
├── tools/render_smoke.mjs     # 全站渲染冒烟测试（Node + 最小 DOM 桩）
├── tools/ai_check.mjs         # 真实 AI 接入自检（Key/模型/CORS/判分全链路）
├── .github/workflows/pages.yml # GitHub Pages 自动部署
└── README.md
```

## 📝 题库结构

每道题（`data/questions.json`）：

```jsonc
{
  "id": "sw01",                      // 唯一 id
  "stage": "省赛",                   // 省赛 | 决赛 | 综合
  "qtype": "看文字信息写作",          // 看文字信息写作 | 看图表信息写作 | 看短文议论文 | 应用文写作
  "title": "……",
  "theme": "AI 与就业",               // 主题分类
  "difficulty": "基础",               // 基础 | 进阶 | 冲刺
  "minWords": 200,                   // 目标词数
  "timeLimitMin": 50,                // 建议限时（分钟）
  "scoringWeights": { "content": 35, "grammar": 30, "organization": 25, "format": 10 }, // 官方四维权重
  "materials": "……",                 // 题目材料（含情境说明）
  "genre": "……",                     // 体裁说明
  "tips": ["……"],                    // 写作提示（数组，源文件写换行字符串也可，合并时自动规范化）
  "keywords": ["application", "…"],   // 5-8 个英文关键词（判分用；概念标签）
  "modelAnswer": "……",               // 参考范文（判分后展示）
  "topic": "求职与就业",              // 主题方向（9 选 1，由 merge 脚本按 theme 自动映射，勿手写）
  "answerTerms": ["…"],              // 参考范文实词（合并脚本自动抽取，判分用，勿手写）
  "source": "original",              // original 原创模拟题（默认，可省略） | official 官方样题
  "sourceLabel": "原创模拟题",        // 由 merge 脚本按 source 自动写入，勿手写
  "sourceUrl": "https://…",          // 官方样题必填：官方原文链接
  "sourceNote": "……",                // 官方样题必填：出处说明（显示在作答页）
  "chart": {                          // 仅图表题
    "type": "bar",                    // bar | line | pie | table
    "title": "……", "unit": "……",
    "labels": ["2020", "…"],
    "series": [{ "name": "……", "data": [1, 2] }]
  }
}
```

关于 `keywords` 与 `answerTerms`：`keywords` 是出题人写的**概念标签**（如 `apology`、`efficiency`、`call to action`），学生和参考答案都不会逐字照抄；`answerTerms` 则由 `tools/merge_questions.mjs` 从每道题自己的参考范文里抽取（剔除通用词与专有名词）。模拟判分的"内容与切题"维把两者加权合并（标签 35% + 范文实词 65%，词形用宽松词根对齐，如 efficiency/efficient、communication/communicate），避免把用词正常的好文章误判成跑题。

修改/新增题目后运行合并脚本重新生成：

```bash
node tools/merge_questions.mjs      # 校验 + 生成 data/questions.json 与 js/questions-data.js
node tools/keyword_audit.mjs        # 内容切题度体检（用 93 篇参考范文自评，<85% 或实词过少时 exit 1）
node tools/render_smoke.mjs         # 全站渲染冒烟测试（四个页面 + 内嵌数据 + 判分引擎）
```

`data/raw/*.json` 是题库源文件（人工编辑），`data/questions.json` 与 `js/questions-data.js` 是生成物，不要手改。

## 🏛️ 官方样题模块（`data/raw/official_sample.json`）

题库分**原创模拟题**与**官方样题**两类，首页可用「来源」筛选切换。

| id | 赛事阶段 | 题型 | 官方要求 | 本站处理 |
| --- | --- | --- | --- | --- |
| os01 | 省赛 Part I（40 分） | 看文字信息写作 | 求职邮件 ≥200 词（Justin Jia → John Smith，WY E-commerce 售后专员） | 题面照录；范文自写 |
| os02 | 省赛 Part II（60 分） | 看图表信息写作 | 全球电力来源占比报告 ≥300 词（2022 vs 2050） | 图表按官方数据自绘为柱状图；范文自写 |
| os03 | 决赛 Part I（25 分） | 看文字信息写作 | 约见客户邮件 ≥100 词（Elizabeth Wang → Charles Truss） | 题面照录；范文自写 |
| os04 | 决赛 Part II（40 分） | 看图表信息写作 | 中国高铁运营数据报告 ≥200 词（2016—2020） | 图表按官方数据自绘为表格；范文自写 |
| os05 | 决赛 Part III（35 分） | 看短文议论文 | 读「花盆与懒汉」故事写议论文 ≥250 词，自拟标题 | 题面照录；范文自写 |

官方原文：[写作大赛样题页](https://vep.fltrp.com/contents/199328243319443457)（省赛 2 题 + 决赛 3 题）。该页现行样题为 2024 年沿用版本，页面「即将发布」栏为空，2026 年尚未发布新样题。

**版权处理原则**（新增官方样题时请遵守）：

1. 只照录**题面**（考试指令与故事文本），不搬运官方配图、优秀例文与范文；
2. 图表一律**按官方公布的数据重新绘制**（柱状图 / 折线图 / 饼图 / 表格，见 `js/chart.js`），官方原图不进入本仓库；
3. 参考范文由本平台自写，并在 `sourceNote` 中写清「题面照录，范文为本平台自写」；
4. 每题必须给出 `sourceUrl`（官方原文链接）与 `sourceNote`，合并脚本会强制校验，缺失即报错、不予合并。

官方样题里的图表数值是用读图工具从官方配图逐值读出后录入的；若官方更新图片或数据，请同步修改 `data/raw/official_sample.json` 中对应题目的 `chart` 与 `materials` 数据说明。

## 🌐 部署到 GitHub Pages

**线上地址：<https://peng684596.github.io/writing-arena/>** —— 已在仓库 **Settings → Pages** 中以**分支部署**方式启用（Source = *Deploy from a branch* → `main` → `/(root)`）。纯静态站点用分支部署最简单，不需要任何工作流、不需要额外权限。

自己部署一份：

1. 新建仓库并推送本目录的全部文件（**不要**推送 `js/config.js`，它已被 `.gitignore` 排除）；
2. 仓库 **Settings → Pages → Build and deployment**：Source 选 **Deploy from a branch**，分支选 `main`、目录选 `/(root)`，保存；
3. 约 1 分钟后访问 `https://<你的用户名>.github.io/<仓库名>/`。

可选：改用 Actions 工作流部署（本目录已备好 `.github/workflows/pages.yml`，内容为 `configure-pages` → `upload-pages-artifact`(path `.`) → `deploy-pages`）。注意 GitHub 要求令牌具备 **`workflow`** 权限才能推送工作流文件，否则会以 `404 Not Found` 拒绝；如需启用，可在网页端手工新建该文件，或给令牌补上 `workflow` 权限后再推送，并将 Pages 的 Source 改为 **GitHub Actions**。

> 提示：线上版本不包含你的 `js/config.js`（已被 gitignore），将自动使用模拟评分。若需在线版也支持真实 AI 判分，建议自建一层轻量代理（如 Cloudflare Worker）转发请求并注入 Key——浏览器直连第三方 API 常因 CORS 被拦截，且 Key 暴露在前端不安全。

## ❓ 常见问题

- **为什么本地能判分、部署后不能调用真实 AI？** 线上版没有 Key（安全设计）+ 第三方 API 的 CORS 限制，详见上文部署提示。
- **评分和真实赛制一致吗？** 四维权重、题型、限时均按官方章程对齐；但评分由规则引擎/LLM 模拟，仅供训练参考。
- **记录存哪里？** 全部保存在浏览器 localStorage（`wa_history` / `wa_draft_*`），换浏览器或清除站点数据会丢失，重要记录请用"导出"备份。
