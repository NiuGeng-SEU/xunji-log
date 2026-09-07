# 训记训练数据看板

[English](README.md) | [简体中文](README.zh-CN.md)

一个基于[训记](https://xunjiapp.cn/) Open API 数据构建的个人自托管训练看板。项目把每天的力量和有氧记录整理为交互式总览、按年份趋势、个人纪录对比和可下钻的训练历史。

本仓库在 [imklayhu/xunji-log](https://github.com/imklayhu/xunji-log) 基础上进行了较大幅度修改，部分看板展示设计参考了 [yihong0618/running_page](https://github.com/yihong0618/running_page)。

![训练看板总览](https://github.com/user-attachments/assets/dc9d7a37-1ca5-4173-ba6c-50c7b9dd1786)

## 主要功能

- **总览：**训练热力图、月度力量/有氧统计、训练部位分布和 Top 动作。
- **力量训练：**目标、连续训练、Max & PR、所选年份与上一年比较、部位占比和月度时长。
- **有氧训练：**里程、消耗、心率、年度个人最佳、比赛成绩预测和活动记录。
- **时间筛选：**支持日历年、全部历史或滚动近一年（视页面而定）。
- **数据下钻：**可打开日期、月份、训练部位和动作查看原始训练明细。
- **每日自动更新：**GitHub Actions 可拉取训记数据、重新分析并部署 GitHub Pages。
- **自托管：**支持 Python/Node.js 本机运行和 Docker Compose 部署。

## 数据流程

```text
训记 Open API
      │
      ▼
data/cache/YYYY/MM/YYYY-MM-DD.json
      │
      ▼
scripts/analyze.py ──► analysis.json 与静态下钻文件
      │
      ▼
React/Vite 看板 ──► 本机服务或 GitHub Pages
```

浏览器页面不会触发 GitHub Actions。线上数据更新由 `.github/workflows/sync.yml` 中的定时任务或手动运行工作流完成。

## 环境要求

- 从训记 App 获取的 Open API/LLM Key（一般以 `xjllm_` 开头）
- Docker 与 Docker Compose；或者 Python 3.10+、Node.js 20+

切勿提交 API Key。训练记录属于个人健康数据，公开部署前请先阅读[隐私说明](#隐私说明)。

## Docker 快速开始

```bash
git clone https://github.com/NiuGeng-SEU/xunji-log.git
cd xunji-log
cp .env.example .env
```

在 `.env` 中填写 `XUNJI_API_KEY`，然后运行：

```bash
docker compose up -d --build
```

访问 <http://127.0.0.1:8080>。当 `SYNC_ENABLED=true` 时，Docker 服务可以定时增量同步。

## 本机运行

```bash
git clone https://github.com/NiuGeng-SEU/xunji-log.git
cd xunji-log

python3 -m venv .venv
.venv/bin/pip install -r server/requirements.txt

cd web
npm ci
npm run build
cd ..

export XUNJI_API_KEY=xjllm_你的密钥
.venv/bin/python scripts/fetch_training.py --incremental --refresh-days 3
.venv/bin/python scripts/analyze.py
./scripts/local-ops.sh start
```

访问 <http://127.0.0.1:8080>。常用运维命令：

```bash
./scripts/local-ops.sh status
./scripts/local-ops.sh refresh
./scripts/local-ops.sh restart
./scripts/local-ops.sh stop
./scripts/local-ops.sh logs
```

前端开发时，可在 `web/` 中运行 `npm run dev`；Vite 默认使用 <http://127.0.0.1:5173>。

## GitHub Actions 与 Pages

1. Fork 本仓库，或将代码复制到自己的 GitHub 仓库。
2. 在 **Settings → Secrets and variables → Actions** 中添加 `XUNJI_API_KEY`。
3. 将 GitHub Pages 的 Source 设置为 **GitHub Actions**。
4. 手动运行一次 **Daily Sync Xunji Data & Deploy**，或等待定时任务。

工作流会：

- 增量刷新最近三天的训记数据；
- 将每日缓存写入 `data/cache/YYYY/MM/`；
- 重新生成汇总和下钻数据；
- 提交发生变化的数据；
- 构建并部署看板。

当前 GitHub Actions 定时任务在每天 22:30 UTC（北京时间 06:30）运行。如需修改，请编辑 `.github/workflows/sync.yml` 中的 cron 表达式。

## 配置

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `XUNJI_API_KEY` | — | 必填，训记 Open API Key |
| `DASHBOARD_HOST` | `127.0.0.1` | 本机服务监听地址 |
| `DASHBOARD_PORT` | `8080` | 看板端口 |
| `SYNC_ENABLED` | `true` | 是否启用 Docker/本机定时同步 |
| `SYNC_CRON` | `30 6 * * *` | 本机定时同步时间 |
| `SYNC_REFRESH_DAYS` | `3` | 每次强制重抓的最近天数 |
| `TZ` | `America/New_York` | 运行时区 |

## 项目结构

```text
.github/workflows/   每日数据同步与 Pages 部署
data/cache/          按年月组织的训记原始每日响应
scripts/             抓取、分析、导出和运维脚本
server/              FastAPI 服务和本机同步接口
web/src/pages/       Overview、Strength、Cardio 页面
web/public/data/     GitHub Pages 使用的静态分析和下钻数据
```

## 质量检查

```bash
.venv/bin/python -m unittest discover -s tests -v
cd web
npm run typecheck
npm run build
```

图表显示值最多保留一位小数；源分析数据仍保留原有计算精度。

## API 接口

| 方法 | 地址 | 用途 |
| --- | --- | --- |
| `GET` | `/api/health` | 服务和数据状态 |
| `GET` | `/api/analysis` | 看板汇总数据 |
| `GET` | `/api/day/{date}` | 单日训练明细 |
| `GET` | `/api/drill?type=&key=` | 月份/部位/动作/日期下钻 |
| `GET` | `/api/sync/status` | 本机定时同步状态 |
| `POST` | `/api/sync` | 在本机执行增量同步 |
| `POST` | `/api/refresh` | 使用已有缓存重新分析 |

## 隐私说明

本仓库可能在 `data/` 和 `web/public/data/` 中保存原始及汇总后的个人训练数据。如果仓库或 GitHub Pages 是公开的，这些记录也会公开。需要保密时，请使用私有仓库或仅在本机部署。

看板没有内置登录功能。不要在没有身份验证或其他访问控制的情况下直接暴露到公网。如果 API Key 泄露，请立即在训记中轮换。

## 致谢

- 数据来源：[训记 Open API](https://xunjiapp.cn/)
- 上游项目：[imklayhu 的 xunji-log](https://github.com/imklayhu/xunji-log)
- 设计参考：[yihong0618 的 running_page](https://github.com/yihong0618/running_page)
- 开发协助：Gemini 3.8 Flash、ChatGPT 5.6 Sol（medium reasoning）

训记、训记 API 及相关商标归各自权利人所有。本项目不是训记官方产品。

## 许可证

[MIT](LICENSE)
