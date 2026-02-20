# AGENTS.md - SoulMirror 项目指南

> 本文件为 AI 编码助手提供项目背景、架构说明和开发指南。

## 项目概述

**SoulMirror**（心灵镜像）是一款 AI 驱动的情绪疗愈日记应用（情绪日记）。它帮助用户记录日常情绪波动，通过 AI 分析提供个性化的情绪洞察和调节建议。

### 核心功能

- **情绪记录**：快速记录当下的心情状态，支持自定义情绪标签
- **能量电池系统**：将情绪转化为可视化的"能量值"（-10 到 +10），追踪每日心理能量变化
- **AI 情绪分析**：DeepSeek AI 提供情绪评分、暖心回复和调节建议
- **深度回看**：基于日记内容和心情记录的 AI 深度反思分析
- **数据可视化**：心情走势图、时段分布统计、触发因素分析
- **数据备份/恢复**：支持 JSON 格式的数据导出和导入

### 应用形态

- **Web 版**：部署于 Cloudflare Pages (https://soulmirror.pages.dev)
- **Android 版**：使用 Capacitor 构建原生应用

---

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端框架** | React 19 + TypeScript |
| **构建工具** | Vite 6 |
| **样式方案** | Tailwind CSS (CDN 引入) |
| **移动方案** | Capacitor 8 |
| **数据存储** | SQLite (原生) / localStorage (Web) |
| **图表库** | Recharts |
| **AI 服务** | DeepSeek API |
| **部署平台** | Cloudflare Pages + Cloudflare Workers |

---

## 项目结构

```
/
├── App.tsx                    # 主应用组件，包含状态管理和路由逻辑
├── index.tsx                  # React 应用入口
├── types.ts                   # TypeScript 类型定义
├── constants.tsx              # 情绪选项、图标组件、配色方案
├── index.html                 # HTML 模板，含 Tailwind CDN 和全局样式
├── vite.config.ts             # Vite 配置
├── capacitor.config.ts        # Capacitor 配置 (appId: com.soulmirror.app)
│
├── services/
│   ├── databaseService.ts     # 数据持久化层 (SQLite/localStorage 双适配)
│   └── geminiService.ts       # AI 服务封装 (DeepSeek API 调用)
│
├── components/                # React 组件目录
│   ├── CalendarStrip.tsx      # 横向日期选择器
│   ├── DailyMoodChart.tsx     # 每日心情走势图
│   ├── Dashboard.tsx          # AI 分析仪表盘 (备份/恢复功能)
│   ├── DeepReflectionSection.tsx  # 深度回看区域
│   ├── DiaryEntryForm.tsx     # 写日记/编辑日记弹窗
│   ├── EnergyBattery.tsx      # 能量电池可视化组件
│   ├── Statistics.tsx         # 统计页面
│   ├── TimelineItem.tsx       # 单条日记卡片
│   └── ...
│
├── utils/
│   ├── energyUtils.ts         # 能量计算工具函数
│   └── timeUtils.ts           # 时间/时长处理工具
│
├── functions/api/
│   └── chat.js                # Cloudflare Pages Function - AI 代理
│
├── worker/
│   ├── ai-proxy.js            # Cloudflare Worker - AI 代理 (独立部署)
│   └── wrangler.toml          # Wrangler 配置文件
│
└── android/                   # Capacitor Android 项目
```

---

## 开发命令

```bash
# 安装依赖
npm install

# 启动开发服务器 (http://localhost:3000)
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 构建并同步到 Android 项目
npm run build && npx cap sync android

# 部署到 Cloudflare Pages (需要 Wrangler 配置)
npm run deploy
```

---

## 架构详解

### 1. 数据层 (databaseService.ts)

采用**双平台适配**设计：

- **原生平台**（Android）：使用 `@capacitor-community/sqlite` 存储
  - 数据库名：`soulmirror_db`
  - 表：`diary_entries`, `daily_notes`, `custom_moods`, `weekly_summaries`, `user_settings`
  
- **Web 平台**：使用 `localStorage` 存储
  - Key: `soulmirror_diary`, `soulmirror_daily_notes`, `soulmirror_custom_moods`

**数据库迁移机制**：服务会自动检测表结构变化并执行 ALTER TABLE 添加新列。

### 2. AI 服务层 (geminiService.ts)

**AI 提供商切换**：修改 `CURRENT_PROVIDER` 常量 (`'DEEPSEEK'` 或 `'GEMINI'`)

**调用模式**：
- **代理模式**（生产）：通过 Cloudflare Worker/Pages Function 转发，保护 API Key
- **直连模式**（开发）：使用本地 `.env.local` 中的 `VITE_DEEPSEEK_API_KEY`

**主要功能函数**：
- `evaluateMoodScore()` - AI 情绪评分 (-10 到 +10)
- `generateMoodMetadata()` - 为自定义情绪生成 emoji/颜色
- `generateAiReply()` - 生成暖心回复
- `generateRegulationSuggestions()` - 负面情绪调节建议
- `analyzeMoods()` - 生成综合分析报告
- `generateDailyDeepReflection()` - 深度回看分析
- `generateWeeklyReport()` - 周报生成

### 3. 能量电池系统

**核心概念**：
- 每日起始能量：100 分
- 每条情绪记录有一个 `energyDelta` (-10 到 +10)
- 累计计算显示实时"剩余能量"

**相关文件**：
- `utils/energyUtils.ts` - 能量计算逻辑
- `components/EnergyBattery.tsx` - 可视化组件

### 4. 情绪评分系统 (v2)

新旧版本兼容：
- `scoreVersion: 'v1'` - 旧版 1-10 分系统
- `scoreVersion: 'v2'` - 新版能量系统 (-10 到 +10)

---

## 环境配置

### 本地开发 (.env.local)

```bash
# 方案1：使用 Cloudflare Worker 代理（推荐，保护 API Key）
VITE_AI_PROXY_URL=https://soulmirror.pages.dev/api/chat

# 方案2：直连 DeepSeek API（仅本地开发）
VITE_DEEPSEEK_API_KEY=sk-xxxxxxxxxx
```

### Cloudflare Worker 部署

```bash
cd worker
# 设置 API Key（只需一次）
wrangler secret put DEEPSEEK_API_KEY
# 部署
wrangler deploy
```

### Cloudflare Pages 部署

```bash
# 构建并部署到主分支（更新主域名）
npm run build
wrangler pages deploy dist --project-name soulmirror --branch main
```

**注意**：必须加 `--branch main` 才能更新主域名，否则只部署到预览环境。

---

## 代码规范

### 命名约定

- **组件**：PascalCase (e.g., `DiaryEntryForm.tsx`)
- **工具函数**：camelCase (e.g., `calculateDurationInMinutes`)
- **类型/接口**：PascalCase (e.g., `DiaryEntry`, `AIAnalysis`)
- **常量**：UPPER_SNAKE_CASE (e.g., `DAILY_STARTING_ENERGY`)

### 样式规范

- 使用 Tailwind CSS 工具类
- 自定义类名放在 `index.html` 的 `<style>` 标签中
- 玻璃拟态效果使用 `.glass` 和 `.glass-card`
- 安全区域适配使用 `.pt-safe-top` / `.pb-safe-bottom`

### 注释规范

- 复杂逻辑使用中文注释
- 函数注释使用 JSDoc 格式

---

## 开发注意事项

### 1. 数据库变更

当需要新增字段时：
1. 修改 `types.ts` 中的类型定义
2. 在 `databaseService.ts` 的 `migrateDatabase()` 中添加迁移逻辑
3. 同时更新 SQLite 和 localStorage 的处理逻辑

### 2. AI Prompt 调试

AI 提示词位于 `geminiService.ts` 各函数内。调试建议：
- 使用 `console.log` 查看请求/响应
-  temperature 范围：结构化输出 1.3，文本输出 1.0

### 3. Android 构建

```bash
# 构建 Web 资源并同步到 Android
npm run build && npx cap sync android

# 然后在 Android Studio 中打开 android 目录进行打包
```

**注意事项**：
- Android 需要配置网络权限（已配置）
- API Key 建议硬编码或通过 BuildConfig 注入（当前实现）

### 4. 跨平台兼容性

- 避免使用浏览器专属 API
- 文件操作使用 Capacitor Filesystem 插件
- 分享功能使用 Capacitor Share 插件

---

## 测试策略

目前项目**无自动化测试**，测试依赖手动验证：

1. **功能测试**：在各视图间切换，验证数据一致性
2. **跨平台测试**：Web 端和 Android 端数据同步验证
3. **AI 功能测试**：检查不同情绪标签的 AI 响应质量

---

## 安全注意事项

1. **API Key 保护**
   - 生产环境必须通过 Cloudflare Worker 代理
   - 不要将 `VITE_DEEPSEEK_API_KEY` 提交到代码仓库
   - `.env.local` 已加入 `.gitignore`

2. **数据隐私**
   - 用户日记数据仅存储在本地（SQLite/localStorage）
   - AI 分析时仅传输必要的文本内容到 DeepSeek API

3. **XSS 防护**
   - 日记内容渲染使用 React 的自动转义
   - 富文本编辑器内容使用 DOMPurify 风格清理（如有需要）

---

## 依赖说明

**核心依赖**：
- `react`, `react-dom` - React 框架
- `@capacitor/*` - 跨平台原生能力
- `@capacitor-community/sqlite` - SQLite 数据库
- `recharts` - 图表库
- `marked` - Markdown 解析

**开发依赖**：
- `vite` - 构建工具
- `typescript` - 类型系统
- `@vitejs/plugin-react` - Vite React 插件

---

## 故障排查

### 常见问题

1. **数据库初始化失败**
   - 检查浏览器是否支持 localStorage
   - Android 检查 SQLite 插件是否正确安装

2. **AI 请求失败**
   - 检查网络连接
   - 验证 `VITE_AI_PROXY_URL` 或 `VITE_DEEPSEEK_API_KEY` 配置
   - 查看浏览器控制台网络请求详情

3. **Capacitor 同步失败**
   - 确保已运行 `npm run build`
   - 检查 `capacitor.config.ts` 中的 `webDir` 配置

---

## 相关资源

- **线上地址**：https://soulmirror.pages.dev
- **AI Studio**: https://ai.studio/apps/drive/1XAkftn0-CKlOotFmZ1QcUiJheDm5e8x_
- **Capacitor 文档**: https://capacitorjs.com/docs
- **DeepSeek API**: https://platform.deepseek.com/
- **Cloudflare Workers**: https://developers.cloudflare.com/workers/
