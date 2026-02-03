
export interface DiaryEntry {
  id: string;
  timestamp: number;
  mood: string;
  moodScore: number; // 1-10
  moodEmoji?: string; // 心情表情，用于删除心情配置后仍能正确显示
  content: string;
  tags: string[];
  aiReply?: string; // AI 暖心回复
  aiSuggestions?: string[]; // AI 情绪调节建议（负面情绪时生成）
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

export enum ViewMode {
  TIMELINE = 'timeline',
  ANALYSIS = 'analysis'
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
