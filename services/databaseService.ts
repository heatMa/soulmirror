import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import { DiaryEntry } from '../types';
import { MoodOption } from '../constants';

// 数据库名称和版本
const DB_NAME = 'soulmirror_db';
const DB_VERSION = 1;

// localStorage 键名
const STORAGE_KEYS = {
  ENTRIES: 'soulmirror_diary',
  NOTES: 'soulmirror_daily_notes',
  CUSTOM_MOODS: 'soulmirror_custom_moods'
};

// 数据库表创建 SQL
const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS diary_entries (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  mood TEXT NOT NULL,
  mood_score REAL DEFAULT 0,
  content TEXT NOT NULL,
  tags TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS daily_notes (
  date_str TEXT PRIMARY KEY,
  content TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_moods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  score INTEGER DEFAULT 5,
  emoji TEXT NOT NULL,
  color TEXT NOT NULL,
  shadow TEXT NOT NULL,
  suggestions TEXT DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_entries_timestamp ON diary_entries(timestamp);
`;

/**
 * 数据存储服务接口
 * 在原生平台使用 SQLite，Web 平台使用 localStorage
 */
class DatabaseService {
  private sqlite: SQLiteConnection | null = null;
  private db: SQLiteDBConnection | null = null;
  private initialized = false;
  private platform: string;
  private isNative: boolean;

  constructor() {
    this.platform = Capacitor.getPlatform();
    this.isNative = this.platform !== 'web';
    
    if (this.isNative) {
      this.sqlite = new SQLiteConnection(CapacitorSQLite);
    }
  }

  /**
   * 初始化数据库连接
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      if (this.isNative && this.sqlite) {
        // 原生平台：使用 SQLite
        const retCC = await this.sqlite.checkConnectionsConsistency();
        const isConn = (await this.sqlite.isConnection(DB_NAME, false)).result;

        if (retCC.result && isConn) {
          this.db = await this.sqlite.retrieveConnection(DB_NAME, false);
        } else {
          this.db = await this.sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);
        }

        await this.db.open();
        await this.db.execute(CREATE_TABLES_SQL);
        
        console.log('SQLite 数据库初始化完成');
      } else {
        // Web 平台：使用 localStorage
        console.log('Web 平台使用 localStorage 存储');
      }

      this.initialized = true;
    } catch (error) {
      console.error('数据库初始化失败:', error);
      throw error;
    }
  }

  // ==================== 日记条目操作 ====================

  /**
   * 获取所有日记条目
   */
  async getAllEntries(): Promise<DiaryEntry[]> {
    await this.ensureInitialized();

    if (this.isNative && this.db) {
      const result = await this.db.query('SELECT * FROM diary_entries ORDER BY timestamp DESC');
      return (result.values || []).map(this.mapRowToEntry);
    } else {
      const data = localStorage.getItem(STORAGE_KEYS.ENTRIES);
      return data ? JSON.parse(data) : [];
    }
  }

  /**
   * 根据日期获取日记条目
   */
  async getEntriesByDate(date: Date): Promise<DiaryEntry[]> {
    const entries = await this.getAllEntries();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return entries.filter(e => 
      e.timestamp >= startOfDay.getTime() && e.timestamp <= endOfDay.getTime()
    ).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * 添加日记条目
   */
  async addEntry(entry: Omit<DiaryEntry, 'id'>): Promise<DiaryEntry> {
    await this.ensureInitialized();
    const id = crypto.randomUUID();
    const newEntry: DiaryEntry = { ...entry, id };

    if (this.isNative && this.db) {
      await this.db.run(
        `INSERT INTO diary_entries (id, timestamp, mood, mood_score, content, tags) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, entry.timestamp, entry.mood, entry.moodScore, entry.content, JSON.stringify(entry.tags)]
      );
    } else {
      const entries = await this.getAllEntries();
      entries.unshift(newEntry);
      localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
    }

    return newEntry;
  }

  /**
   * 更新日记条目
   */
  async updateEntry(entry: DiaryEntry): Promise<void> {
    await this.ensureInitialized();

    if (this.isNative && this.db) {
      await this.db.run(
        `UPDATE diary_entries 
         SET timestamp = ?, mood = ?, mood_score = ?, content = ?, tags = ? 
         WHERE id = ?`,
        [entry.timestamp, entry.mood, entry.moodScore, entry.content, JSON.stringify(entry.tags), entry.id]
      );
    } else {
      const entries = await this.getAllEntries();
      const index = entries.findIndex(e => e.id === entry.id);
      if (index !== -1) {
        entries[index] = entry;
        localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
      }
    }
  }

  /**
   * 更新日记条目的心情评分
   */
  async updateEntryMoodScore(id: string, moodScore: number): Promise<void> {
    await this.ensureInitialized();

    if (this.isNative && this.db) {
      await this.db.run('UPDATE diary_entries SET mood_score = ? WHERE id = ?', [moodScore, id]);
    } else {
      const entries = await this.getAllEntries();
      const index = entries.findIndex(e => e.id === id);
      if (index !== -1) {
        entries[index].moodScore = moodScore;
        localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
      }
    }
  }

  /**
   * 删除日记条目
   */
  async deleteEntry(id: string): Promise<void> {
    await this.ensureInitialized();

    if (this.isNative && this.db) {
      await this.db.run('DELETE FROM diary_entries WHERE id = ?', [id]);
    } else {
      const entries = await this.getAllEntries();
      const filtered = entries.filter(e => e.id !== id);
      localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(filtered));
    }
  }

  /**
   * 将数据库行映射为 DiaryEntry 对象
   */
  private mapRowToEntry(row: Record<string, unknown>): DiaryEntry {
    return {
      id: row.id as string,
      timestamp: row.timestamp as number,
      mood: row.mood as string,
      moodScore: row.mood_score as number,
      content: row.content as string,
      tags: JSON.parse((row.tags as string) || '[]')
    };
  }

  // ==================== 每日笔记操作 ====================

  /**
   * 获取指定日期的笔记
   */
  async getDailyNote(dateStr: string): Promise<string> {
    await this.ensureInitialized();

    if (this.isNative && this.db) {
      const result = await this.db.query('SELECT content FROM daily_notes WHERE date_str = ?', [dateStr]);
      return result.values?.[0]?.content as string || '';
    } else {
      const notes = await this.getAllDailyNotes();
      return notes[dateStr] || '';
    }
  }

  /**
   * 获取所有每日笔记
   */
  async getAllDailyNotes(): Promise<Record<string, string>> {
    await this.ensureInitialized();

    if (this.isNative && this.db) {
      const result = await this.db.query('SELECT date_str, content FROM daily_notes');
      const notes: Record<string, string> = {};
      (result.values || []).forEach(row => {
        notes[row.date_str as string] = row.content as string;
      });
      return notes;
    } else {
      const data = localStorage.getItem(STORAGE_KEYS.NOTES);
      return data ? JSON.parse(data) : {};
    }
  }

  /**
   * 保存每日笔记
   */
  async saveDailyNote(dateStr: string, content: string): Promise<void> {
    await this.ensureInitialized();

    if (this.isNative && this.db) {
      await this.db.run(
        `INSERT OR REPLACE INTO daily_notes (date_str, content) VALUES (?, ?)`,
        [dateStr, content]
      );
    } else {
      const notes = await this.getAllDailyNotes();
      notes[dateStr] = content;
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
    }
  }

  // ==================== 自定义心情操作 ====================

  /**
   * 获取所有自定义心情
   */
  async getCustomMoods(): Promise<MoodOption[]> {
    await this.ensureInitialized();

    if (this.isNative && this.db) {
      const result = await this.db.query('SELECT * FROM custom_moods');
      return (result.values || []).map(row => ({
        label: row.label as string,
        value: row.value as string,
        score: row.score as number,
        emoji: row.emoji as string,
        color: row.color as string,
        shadow: row.shadow as string,
        suggestions: JSON.parse((row.suggestions as string) || '[]')
      }));
    } else {
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_MOODS);
      return data ? JSON.parse(data) : [];
    }
  }

  /**
   * 保存自定义心情
   */
  async saveCustomMood(mood: MoodOption): Promise<void> {
    await this.ensureInitialized();

    if (this.isNative && this.db) {
      await this.db.run(
        `INSERT OR REPLACE INTO custom_moods (label, value, score, emoji, color, shadow, suggestions) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [mood.label, mood.value, mood.score, mood.emoji, mood.color, mood.shadow, JSON.stringify(mood.suggestions)]
      );
    } else {
      const moods = await this.getCustomMoods();
      const index = moods.findIndex(m => m.label === mood.label);
      if (index !== -1) {
        moods[index] = mood;
      } else {
        moods.push(mood);
      }
      localStorage.setItem(STORAGE_KEYS.CUSTOM_MOODS, JSON.stringify(moods));
    }
  }

  /**
   * 删除自定义心情
   */
  async deleteCustomMood(label: string): Promise<void> {
    await this.ensureInitialized();

    if (this.isNative && this.db) {
      await this.db.run('DELETE FROM custom_moods WHERE label = ?', [label]);
    } else {
      const moods = await this.getCustomMoods();
      const filtered = moods.filter(m => m.label !== label);
      localStorage.setItem(STORAGE_KEYS.CUSTOM_MOODS, JSON.stringify(filtered));
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 确保数据库已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * 关闭数据库连接
   */
  async close(): Promise<void> {
    if (this.isNative && this.db && this.sqlite) {
      await this.sqlite.closeConnection(DB_NAME, false);
      this.db = null;
      this.initialized = false;
    }
  }

  /**
   * 获取当前存储类型
   */
  getStorageType(): 'sqlite' | 'localStorage' {
    return this.isNative ? 'sqlite' : 'localStorage';
  }
}

// 导出单例实例
export const databaseService = new DatabaseService();
