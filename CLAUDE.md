# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SoulMirror is an AI-powered emotional diary (情绪日记) mobile app built with React and Capacitor. It helps users track their moods, write daily reflections, and receive AI-generated emotional analysis and suggestions.

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

### Key Files & Structure

```
/
├── App.tsx           # Main application component, state management, routing
├── index.tsx         # React entry point
├── types.ts          # TypeScript interfaces (DiaryEntry, AIAnalysis, ViewMode)
├── constants.tsx     # Mood options, SVG icons, MoodOption interface
├── vite.config.ts    # Vite configuration with Capacitor SQLite support
├── capacitor.config.ts # Capacitor settings (appId: com.soulmirror.app)
│
├── services/
│   ├── databaseService.ts  # Data persistence layer (SQLite/localStorage)
│   └── geminiService.ts    # AI service (DeepSeek/Gemini API calls)
│
└── components/
    ├── Dashboard.tsx       # AI analysis view with mood insights
    ├── DiaryEntryForm.tsx  # Modal for adding/editing diary entries
    ├── CalendarStrip.tsx   # Horizontal date picker
    ├── DailyMoodChart.tsx  # Recharts visualization for daily mood
    ├── DailyNoteEditor.tsx # Rich text editor for daily notes
    └── TimelineItem.tsx    # Individual diary entry card
```

### Data Layer

`databaseService.ts` provides a unified API that:
- Uses `@capacitor-community/sqlite` on Android
- Falls back to localStorage on web browsers
- Manages three data types: diary entries, daily notes, custom moods

### AI Service

`geminiService.ts` exports three functions:
- `generateMoodMetadata()` - Generate emoji/color for custom mood labels
- `evaluateMoodScore()` - Score a diary entry's mood (1-10)
- `analyzeMoods()` - Generate comprehensive mood analysis report

To switch AI providers, change `CURRENT_PROVIDER` at top of `geminiService.ts`.

### View Modes

The app has two views controlled by `ViewMode` enum:
- `TIMELINE` - Calendar + daily entries + mood chart
- `ANALYSIS` - AI-powered Dashboard with insights

## Environment Configuration

Set `GEMINI_API_KEY` in `.env.local` if using Gemini provider. DeepSeek API key is hardcoded in `geminiService.ts`.
