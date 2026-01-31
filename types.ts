
export interface DiaryEntry {
  id: string;
  timestamp: number;
  mood: string;
  moodScore: number; // 1-10
  content: string;
  tags: string[];
}

export interface AIAnalysis {
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
