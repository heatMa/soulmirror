
export interface DiaryEntry {
  id: string;
  timestamp: number;
  mood: string;
  moodScore: number; // -10到+10 (能量电池系统)
  moodEmoji?: string; // 心情表情，用于删除心情配置后仍能正确显示
  moodHexColor?: string; // 心情主题色，用于删除心情配置后仍能正确显示
  content: string;
  tags: string[];
  aiReply?: string; // AI 暖心回复
  aiSuggestions?: string[]; // AI 情绪调节建议（负面情绪时生成）
  endTimestamp?: number; // 情绪结束时间（可选，用于自动计算持续时长）
  duration?: number; // 手动填写的持续时长（分钟，可选）
  isActive?: boolean; // 是否进行中（未结束）
  energyDelta?: number; // 本条记录的能量变化值（-10到+10，能量系统）
  scoreVersion?: 'v1' | 'v2'; // 分数版本标记，用于数据迁移（v2 为当前版本）
  // 表单提交时使用的时间字段（不入库）
  entryHours?: number;
  entryMinutes?: number;
  resolved_at?: string | null; // 情绪已好转时间（ISO字符串），null 表示尚未好转
}

export interface EntryComment {
  id: number;
  entry_id: string;
  content: string;
  created_at: string;
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
  deepReflectionSource?: 'journal-only' | 'moods-only' | 'journal-with-moods';  // 分析来源
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

// ==================== 周报系统类型定义 ====================

export interface WeeklyReport {
  id: string;
  weekKey: string;           // '2025-W08'
  weekRange: {
    start: string;           // '2025-02-17'
    end: string;             // '2025-02-23'
  };
  generatedAt: number;
  
  content: {
    // 本周快照
    snapshot: {
      totalEntries: number;
      totalDurationMinutes: number;
      avgEnergyDelta: number;
      dominantMood: string;
      energyTrend: 'up' | 'down' | 'stable';
      peakDay: string;
      peakEnergy: number;
      valleyDay: string;
      valleyEnergy: number;
    };
    
    // 教练观察
    observation: {
      headline: string;
      body: string;
      pattern?: string;
    };
    
    // 一个实验
    experiment: {
      title: string;
      instruction: string;
      duration: string;
      expectedOutcome: string;
    };
    
    // 本周推荐
    recommendation: {
      type: 'book' | 'concept' | 'video' | 'podcast';
      title: string;
      author?: string;
      why: string;
      link?: string;
    };
    
    // 数据可视化
    chartData: {
      dailyEnergy: { day: string; value: number; date: string }[];
      moodDistribution: { mood: string; minutes: number; color: string }[];
      timeQuality: {
        highEnergyHours: number;
        lowEnergyHours: number;
        recoveryEfficiency: number;
      };
    };
  };
  
  // 追踪信息
  tracking?: {
    viewedAt?: number;
    experimentAccepted: boolean;
    experimentCompleted?: boolean;
    dismissed?: boolean;
  };
}


// ==========================================
// 导师系统
// ==========================================

export type MentorType = 'naval' | 'munger' | 'wangyangming' | 'sushi' | 'zengguofan' | 'buddha' | 'murakami' | 'musk' | 'positive-psychology';

export interface MentorConfig {
  id: MentorType;
  name: string;
  title: string;
  avatar: string;
  quote: string;
  systemPrompt: {
    reply: string;
    regulation: string;
    weekly: string;
  };
}

export interface UserSettings {
  selectedMentor: MentorType;
  // 后续扩展：通知设置、主题等
}
