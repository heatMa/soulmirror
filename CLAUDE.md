# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

美好时光 (SoulMirror) is an AI-powered emotional diary (情绪日记) mobile app built with React and Capacitor. It helps users track their moods, write daily reflections, and receive AI-generated emotional analysis and suggestions.

## Development Commands

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Build and sync to Android
npm run build && npx cap sync android
```

## Architecture

### Tech Stack
- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS (via CDN)
- **Mobile**: Capacitor for Android native builds
- **Data Storage**: SQLite on native platforms, localStorage on web
- **AI Provider**: DeepSeek API (configurable to Gemini)
- **Charts**: Recharts
- **Notifications**: `@capacitor/local-notifications` (Android weekly reminders)

### Key Files & Structure

```
/
├── App.tsx                  # Main application component, state management, routing
├── index.tsx                # React entry point
├── types.ts                 # TypeScript interfaces (DiaryEntry, AIAnalysis, ViewMode, WeeklyReport)
├── constants.tsx            # Mood options, SVG icons, MoodOption interface, BOOK_RECOMMENDATIONS
├── vite.config.ts           # Vite configuration with Capacitor SQLite support
├── capacitor.config.ts      # Capacitor settings (appId: com.soulmirror.app)
├── progress.md              # Development progress and lessons learned
│
├── services/
│   ├── databaseService.ts   # Data persistence layer (SQLite/localStorage)
│   ├── geminiService.ts     # AI service (DeepSeek/Gemini API calls)
│   ├── reportService.ts     # Weekly report generation service
│   └── notificationService.ts # Local notifications for Android
│
└── components/
    ├── Dashboard.tsx           # AI analysis view with mood insights
    ├── DiaryEntryForm.tsx      # Modal for adding/editing diary entries
    ├── CalendarStrip.tsx       # Horizontal date picker
    ├── DailyMoodChart.tsx      # Recharts visualization for daily mood
    ├── DailyNoteEditor.tsx     # Rich text editor for daily notes
    ├── TimelineItem.tsx        # Individual diary entry card
    ├── WeeklyReportCard.tsx    # Weekly report entry card on timeline
    └── WeeklyReportView.tsx    # Full weekly report detail view
```

### Data Layer

`databaseService.ts` provides a unified API that:
- Uses `@capacitor-community/sqlite` on Android
- Falls back to localStorage on web browsers
- Manages data types: diary entries, daily notes, custom moods, weekly reports

**Important**: When extending DatabaseService with new methods, use `declare module` pattern:
```typescript
declare module './databaseService' {
  interface DatabaseService {
    newMethod(): Promise<void>;
  }
}
DatabaseService.prototype.newMethod = async function() {...}
```

### AI Service

`geminiService.ts` exports functions:
- `generateMoodMetadata()` - Generate emoji/color for custom mood labels
- `evaluateMoodScore()` - Score a diary entry's mood (-10 to +10, energy system)
- `analyzeMoods()` - Generate comprehensive mood analysis report
- `generateDailyDeepReflection()` - Deep reflection based on journal + moods

`reportService.ts` handles weekly report generation:
- Aggregates week data (entries, duration, energy trends)
- Calls DeepSeek API with Naval-style coaching prompt
- Falls back to local templates if AI fails
- Auto-schedules next week's notification

To switch AI providers, change `CURRENT_PROVIDER` at top of `geminiService.ts`.

### Weekly Report System

New feature (Feb 2025): AI-generated weekly coaching reports
- **Generation**: Triggered on app launch (checks current week)
- **Requirements**: Minimum 3 entries to generate
- **Content**: Data snapshot, Naval-style observation, one experiment, book recommendation
- **Notifications**: Monday 8:00 AM weekly, Wednesday 9:00 AM experiment reminder
- **Storage**: SQLite table `weekly_reports` with tracking state

### View Modes

The app has three views controlled by `ViewMode` enum:
- `TIMELINE` - Calendar + daily entries + mood chart + weekly report card
- `ANALYSIS` - AI-powered Dashboard with insights
- `STATISTICS` - Mood statistics and trends

## Code Style & Best Practices

### String Quotes (CRITICAL)

**Always use Chinese quotation marks for Chinese content:**
```typescript
// ✅ CORRECT - Use Chinese corner quotes
const text = '这是「正确」的用法';
const text2 = '这是「必须做」还是「选择做」';

// ❌ WRONG - ASCII quotes conflict with string delimiters
const text = '这是'错误'的用法';  // Build error!
```

**Why**: ASCII quotes (`'"`) inside JavaScript template strings cause build failures when nested.

### Notification Scheduling

Use `@capacitor/local-notifications` for Android reminders:
```typescript
await LocalNotifications.schedule({
  notifications: [{
    schedule: { at: nextMonday, repeats: true, every: 'week' }
  }]
});
```

Note: There is NO `@capacitor/background-task` plugin. Use notification scheduling instead.

### AI Prompt Design

- System prompt location: `constants.tsx` → `MENTOR_CONFIG.systemPrompt`
- Temperature: 0.8 for structured output (JSON), 1.0 for creative text
- Always include fallback template generation for offline/reliability

## Deployment

### Web (腾讯云云开发 CloudBase) - 主要部署方式

项目默认部署到腾讯云云开发（CloudBase）静态托管：

```bash
# 构建
npm run build

# 部署到腾讯云（环境 ID: soulmirror-3gen9oau21b35f0d）
cloudbase hosting:deploy dist -e soulmirror-3gen9oau21b35f0d
# 或使用短命令
npx tcb hosting:deploy dist -e soulmirror-3gen9oau21b35f0d
```

- **线上地址**: https://soulmirror-3gen9oau21b35f0d-1403375226.tcloudbaseapp.com
- **部署方式**: 手动部署（CLI）
- **环境名称**: soulmirror
- **环境 ID**: soulmirror-3gen9oau21b35f0d

**部署前准备**:
1. 安装腾讯云 CLI: `npm install -g @cloudbase/cli`
2. 登录: `cloudbase login`

### Web (Cloudflare Pages) - 备选部署

如需部署到 Cloudflare Pages（原方案）：

```bash
# 构建并部署到生产环境（主域名 soulmirror.pages.dev）
npm run build && npx wrangler pages deploy dist --project-name soulmirror --branch main
```

- **线上地址**: https://soulmirror.pages.dev
- **部署方式**: 手动部署（非 Git 集成）
- **重要**: 必须加 `--branch main` 才能更新主域名，否则只会部署到预览环境

### Android

构建并同步到 Android 项目：

```bash
npm run build && npx cap sync android
```

然后在 Android Studio 中打开 `android` 目录进行打包。

**AndroidManifest.xml** requires these permissions for notifications:
- `POST_NOTIFICATIONS` (Android 13+)
- `SCHEDULE_EXACT_ALARM`
- `USE_EXACT_ALARM`
- `RECEIVE_BOOT_COMPLETED`

## Environment Configuration

Set in `.env.local`:
- `VITE_DEEPSEEK_API_KEY` - For DeepSeek API calls
- `VITE_AI_PROXY_URL` - Optional proxy endpoint

DeepSeek API key fallback is hardcoded in `geminiService.ts` for development.

## Common Issues & Solutions

### Import Statement Placement (CRITICAL)
**Cause**: `import` statements placed after class definitions  
**Symptom**: App crashes on Android startup with "数据加载失败"  
**Fix**: Move all `import` to the top of the file:
```typescript
// ✅ CORRECT
import { Type } from './module';
class MyClass { ... }

// ❌ WRONG - causes Android crash
class MyClass { ... }
import { Type } from './module';
```

---

### Build Error: Expected "}" but found Chinese text
**Cause**: ASCII quotes inside Chinese strings  
**Fix**: Replace `'必须做'` with `'「必须做」'`

### DatabaseService method not found
**Cause**: TypeScript doesn't recognize dynamically added prototype methods  
**Fix**: Add `declare module './databaseService'` interface extension

### Android notifications not working
**Cause**: Missing permissions in AndroidManifest.xml  
**Fix**: Ensure all notification permissions are declared (see Architecture section)

### AAPT: error: unexpected element <receiver> found in <manifest>
**Cause**: `<receiver>`, `<service>`, `<provider>` placed outside `<application>`  
**Fix**: Move all component declarations inside `<application>` tags:
```xml
<!-- ❌ WRONG -->
</application>
<receiver android:name="..." />

<!-- ✅ CORRECT -->
<application>
    ...
    <receiver android:name="..." />
</application>
```

---

## Cross-Platform Compatibility Checklist

Before committing changes, verify:

### Code Changes
- [ ] No browser-only APIs (window.*, document.*) without Capacitor fallback
- [ ] No Node.js-only modules in frontend code
- [ ] All file operations use `@capacitor/filesystem` or compatible abstraction
- [ ] **All `import` statements at the TOP of the file (NOT after class definitions)**

### Database Changes
- [ ] SQLite schema updates handle migration (ALTER TABLE)
- [ ] localStorage fallback works when SQLite unavailable
- [ ] New columns have default values or nullable

### Android Specific
- [ ] AndroidManifest.xml components are inside `<application>`
- [ ] New permissions added to manifest (if needed)
- [ ] Notifications use `@capacitor/local-notifications` API
- [ ] Back button behavior handled (if adding new pages)

### Web Specific
- [ ] Web build passes (`npm run build`)
- [ ] No native-only plugin calls without platform check (`Capacitor.isNativePlatform()`)

### Testing Required
```bash
# Web
npm run dev
npm run build

# Android
npm run build
npx cap sync android
# Then build APK in Android Studio
```

## Reference

- [progress.md](./progress.md) - Detailed development log and lessons learned
- [AGENTS.md](./AGENTS.md) - Project overview in Chinese
- [Capacitor Local Notifications](https://capacitorjs.com/docs/apis/local-notifications)
- [Capacitor SQLite](https://github.com/capacitor-community/sqlite)
