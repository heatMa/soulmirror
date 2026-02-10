
export interface DiaryEntry {
  id: string;
  timestamp: number;
  mood: string;
  moodScore: number; // 1-10
  moodEmoji?: string; // 心情表情，用于删除心情配置后仍能正确显示
  moodHexColor?: string; // 心情主题色，用于删除心情配置后仍能正确显示
  content: string;
  tags: string[];
  aiReply?: string; // AI 暖心回复
  aiSuggestions?: string[]; // AI 情绪调节建议（负面情绪时生成）
  endTimestamp?: number; // 情绪结束时间（可选，用于自动计算持续时长）
  duration?: number; // 手动填写的持续时长（分钟，可选）
  isActive?: boolean; // 是否进行中（未结束）
}

export interface AIAnalysis {
  keyword: string; // New: A single character or word describing the period
  summary: string;
  moodBarometer: {
    period: string;
    trend: 'rising' | 'falling' | 'stable';
    explanation: string;
  };
  suggestions: string[];
  peaks: string[]; // Good time periods/events
  valleys: string[]; // Challenging time periods/events
}

export interface WeeklySummary {
  weekKey: string;          // Format: '2025-W06'
  content: string;          // AI generated narrative summary
  createdAt: number;        // Timestamp when summary was generated
}

export enum ViewMode {
  TIMELINE = 'timeline',
  ANALYSIS = 'analysis',
  STATISTICS = 'statistics'
}

// 每日日记和深度回看
export interface DailyJournal {
  date: string;                                      // YYYY-MM-DD
  content: string;                                   // 日记内容（富文本HTML）
  deepReflection?: string;                           // AI深度回看内容（纯文本）
  deepReflectionSource?: 'journal-only' | 'journal-with-moods';  // 分析来源
  deepReflectionTimestamp?: number;                  // AI分析生成时间戳
}

// 备份数据接口
export interface BackupData {
  version: string;
  exportDate: string;
  platform: 'sqlite' | 'localStorage';
  data: {
    entries: DiaryEntry[];
    dailyNotes: Record<string, string>;
    customMoods: import('./constants').MoodOption[];
  };
}

// 导入结果接口
export interface ImportResult {
  success: boolean;
  entriesImported: number;
  notesImported: number;
  moodsImported: number;
  errors: string[];
}
