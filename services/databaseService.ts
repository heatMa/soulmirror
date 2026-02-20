import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import { DiaryEntry, BackupData, ImportResult, WeeklySummary, WeeklyReport } from '../types';
import { MoodOption } from '../constants';

// 数据库名称和版本
const DB_NAME = 'soulmirror_db';
const DB_VERSION = 1;

// localStorage 键名
const STORAGE_KEYS = {
  ENTRIES: 'soulmirror_diary',
  NOTES: 'soulmirror_daily_notes',
  CUSTOM_MOODS: 'soulmirror_custom_moods',
  WEEKLY_SUMMARIES: 'soulmirror_weekly_summaries'
};

// 数据库表创建 SQL
const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS diary_entries (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  mood TEXT NOT NULL,
  mood_score REAL DEFAULT 0,
  mood_emoji TEXT,
  mood_hex_color TEXT,
  content TEXT NOT NULL,
  tags TEXT DEFAULT '[]',
  ai_reply TEXT,
  ai_suggestions TEXT,
  end_timestamp INTEGER,
  duration INTEGER,
  is_active INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS daily_notes (
  date_str TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  deep_reflection TEXT,
  deep_reflection_source TEXT,
  deep_reflection_timestamp INTEGER
);

CREATE TABLE IF NOT EXISTS custom_moods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  score INTEGER DEFAULT 5,
  emoji TEXT NOT NULL,
  color TEXT NOT NULL,
  hex_color TEXT,
  shadow TEXT NOT NULL,
  suggestions TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS user_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS weekly_summaries (
  week_key TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
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

  // ==================== 周报系统方法声明 ====================
  saveWeeklyReport(report: WeeklyReport): Promise<void> {
    throw new Error('Method not implemented');
  }
  getWeeklyReport(weekKey: string): Promise<WeeklyReport | null> {
    throw new Error('Method not implemented');
  }
  getAllWeeklyReports(): Promise<WeeklyReport[]> {
    throw new Error('Method not implemented');
  }
  markReportAsViewed(weekKey: string): Promise<void> {
    throw new Error('Method not implemented');
  }
  acceptExperiment(weekKey: string): Promise<void> {
    throw new Error('Method not implemented');
  }
  completeExperiment(weekKey: string): Promise<void> {
    throw new Error('Method not implemented');
  }
  deleteWeeklyReport(weekKey: string): Promise<void> {
    throw new Error('Method not implemented');
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

        // 数据库迁移：为已有表添加 mood_emoji 列
        await this.migrateDatabase();

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

  /**
   * 数据库迁移
   */
  private async migrateDatabase(): Promise<void> {
    if (!this.isNative || !this.db) return;

    try {
      // 检查 diary_entries 表的列是否存在，不存在则添加
      const tableInfo = await this.db.query("PRAGMA table_info(diary_entries)");
      const columns = tableInfo.values || [];
      const hasMoodEmoji = columns.some((col: any) => col.name === 'mood_emoji');
      const hasMoodHexColor = columns.some((col: any) => col.name === 'mood_hex_color');
      const hasAiReply = columns.some((col: any) => col.name === 'ai_reply');
      const hasAiSuggestions = columns.some((col: any) => col.name === 'ai_suggestions');

      if (!hasMoodEmoji) {
        await this.db.execute('ALTER TABLE diary_entries ADD COLUMN mood_emoji TEXT');
        console.log('数据库迁移：添加 mood_emoji 列');
      }

      if (!hasMoodHexColor) {
        await this.db.execute('ALTER TABLE diary_entries ADD COLUMN mood_hex_color TEXT');
        console.log('数据库迁移：添加 mood_hex_color 列');
      }

      if (!hasAiReply) {
        await this.db.execute('ALTER TABLE diary_entries ADD COLUMN ai_reply TEXT');
        console.log('数据库迁移：添加 ai_reply 列');
      }

      if (!hasAiSuggestions) {
        await this.db.execute('ALTER TABLE diary_entries ADD COLUMN ai_suggestions TEXT');
        console.log('数据库迁移：添加 ai_suggestions 列');
      }

      // 检查 custom_moods 表是否有 hex_color 列
      const moodsTableInfo = await this.db.query("PRAGMA table_info(custom_moods)");
      const moodsColumns = moodsTableInfo.values || [];
      const hasHexColor = moodsColumns.some((col: any) => col.name === 'hex_color');

      if (!hasHexColor) {
        await this.db.execute('ALTER TABLE custom_moods ADD COLUMN hex_color TEXT');
        console.log('数据库迁移：添加 hex_color 列');
      }

      // 确保 user_settings 表存在
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS user_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);

      // 检查 daily_notes 表是否有深度回看相关列
      const notesTableInfo = await this.db.query("PRAGMA table_info(daily_notes)");
      const notesColumns = notesTableInfo.values || [];
      const hasDeepReflection = notesColumns.some((col: any) => col.name === 'deep_reflection');
      const hasDeepReflectionSource = notesColumns.some((col: any) => col.name === 'deep_reflection_source');
      const hasDeepReflectionTimestamp = notesColumns.some((col: any) => col.name === 'deep_reflection_timestamp');

      if (!hasDeepReflection) {
        await this.db.execute('ALTER TABLE daily_notes ADD COLUMN deep_reflection TEXT');
        console.log('数据库迁移：添加 deep_reflection 列');
      }

      if (!hasDeepReflectionSource) {
        await this.db.execute('ALTER TABLE daily_notes ADD COLUMN deep_reflection_source TEXT');
        console.log('数据库迁移：添加 deep_reflection_source 列');
      }

      if (!hasDeepReflectionTimestamp) {
        await this.db.execute('ALTER TABLE daily_notes ADD COLUMN deep_reflection_timestamp INTEGER');
        console.log('数据库迁移：添加 deep_reflection_timestamp 列');
      }

      // 检查 diary_entries 表是否有持续时间相关列
      const entriesTableInfo = await this.db.query("PRAGMA table_info(diary_entries)");
      const entriesColumns = entriesTableInfo.values || [];
      const hasEndTimestamp = entriesColumns.some((col: any) => col.name === 'end_timestamp');
      const hasDuration = entriesColumns.some((col: any) => col.name === 'duration');
      const hasIsActive = entriesColumns.some((col: any) => col.name === 'is_active');

      if (!hasEndTimestamp) {
        await this.db.execute('ALTER TABLE diary_entries ADD COLUMN end_timestamp INTEGER');
        console.log('数据库迁移：添加 end_timestamp 列');
      }

      if (!hasDuration) {
        await this.db.execute('ALTER TABLE diary_entries ADD COLUMN duration INTEGER');
        console.log('数据库迁移：添加 duration 列');
      }

      if (!hasIsActive) {
        await this.db.execute('ALTER TABLE diary_entries ADD COLUMN is_active INTEGER DEFAULT 0');
        console.log('数据库迁移：添加 is_active 列');
      }

      // 检查能量电池系统相关列
      const hasEnergyDelta = entriesColumns.some((col: any) => col.name === 'energy_delta');
      const hasScoreVersion = entriesColumns.some((col: any) => col.name === 'score_version');

      if (!hasEnergyDelta) {
        await this.db.execute('ALTER TABLE diary_entries ADD COLUMN energy_delta REAL');
        console.log('数据库迁移：添加 energy_delta 列');
      }

      if (!hasScoreVersion) {
        await this.db.execute("ALTER TABLE diary_entries ADD COLUMN score_version TEXT DEFAULT 'v1'");
        console.log('数据库迁移：添加 score_version 列');
      }
    } catch (error) {
      console.error('数据库迁移失败:', error);
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
        `INSERT INTO diary_entries (id, timestamp, mood, mood_score, mood_emoji, mood_hex_color, content, tags, end_timestamp, duration, is_active, energy_delta, score_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          entry.timestamp,
          entry.mood,
          entry.moodScore,
          entry.moodEmoji || null,
          entry.moodHexColor || null,
          entry.content,
          JSON.stringify(entry.tags),
          entry.endTimestamp || null,
          entry.duration || null,
          entry.isActive ? 1 : 0,
          entry.energyDelta ?? null,
          entry.scoreVersion || 'v2'
        ]
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
         SET timestamp = ?, mood = ?, mood_score = ?, mood_emoji = ?, mood_hex_color = ?, content = ?, tags = ?, end_timestamp = ?, duration = ?, is_active = ?, energy_delta = ?, score_version = ?
         WHERE id = ?`,
        [
          entry.timestamp,
          entry.mood,
          entry.moodScore,
          entry.moodEmoji || null,
          entry.moodHexColor || null,
          entry.content,
          JSON.stringify(entry.tags),
          entry.endTimestamp || null,
          entry.duration || null,
          entry.isActive ? 1 : 0,
          entry.energyDelta ?? null,
          entry.scoreVersion || 'v2',
          entry.id
        ]
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
   * 更新日记条目的 AI 回复
   */
  async updateEntryAiReply(id: string, aiReply: string): Promise<void> {
    await this.ensureInitialized();

    if (this.isNative && this.db) {
      await this.db.run('UPDATE diary_entries SET ai_reply = ? WHERE id = ?', [aiReply, id]);
    } else {
      const entries = await this.getAllEntries();
      const index = entries.findIndex(e => e.id === id);
      if (index !== -1) {
        entries[index].aiReply = aiReply;
        localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
      }
    }
  }

  /**
   * 更新日记条目的 AI 情绪调节建议
   */
  async updateEntryAiSuggestions(id: string, aiSuggestions: string[]): Promise<void> {
    await this.ensureInitialized();

    if (this.isNative && this.db) {
      await this.db.run('UPDATE diary_entries SET ai_suggestions = ? WHERE id = ?', [JSON.stringify(aiSuggestions), id]);
    } else {
      const entries = await this.getAllEntries();
      const index = entries.findIndex(e => e.id === id);
      if (index !== -1) {
        entries[index].aiSuggestions = aiSuggestions;
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
      moodEmoji: row.mood_emoji as string | undefined,
      moodHexColor: row.mood_hex_color as string | undefined,
      content: row.content as string,
      tags: JSON.parse((row.tags as string) || '[]'),
      aiReply: row.ai_reply as string | undefined,
      aiSuggestions: row.ai_suggestions ? JSON.parse(row.ai_suggestions as string) : undefined,
      endTimestamp: row.end_timestamp as number | undefined,
      duration: row.duration as number | undefined,
      isActive: Boolean(row.is_active),
      energyDelta: row.energy_delta as number | undefined,
      scoreVersion: ((row.score_version as string) || 'v1') as 'v1' | 'v2'
    };
  }

  // ==================== 每日笔记操作 ====================

  /**
   * 获取指定日期的笔记（返回完整日记对象）
   */
  async getDailyNote(dateStr: string): Promise<any> {
    await this.ensureInitialized();

    if (this.isNative && this.db) {
      const result = await this.db.query('SELECT * FROM daily_notes WHERE date_str = ?', [dateStr]);
      const row = result.values?.[0];
      if (!row) return null;
      return {
        date: dateStr,
        content: row.content as string,
        deepReflection: row.deep_reflection as string | undefined,
        deepReflectionSource: row.deep_reflection_source as string | undefined,
        deepReflectionTimestamp: row.deep_reflection_timestamp as number | undefined
      };
    } else {
      const notes = await this.getAllDailyNotes();
      return notes[dateStr] || null;
    }
  }

  /**
   * 获取指定日期的笔记文本（兼容旧接口）
   */
  async getDailyNoteText(dateStr: string): Promise<string> {
    const note = await this.getDailyNote(dateStr);
    return note?.content || '';
  }

  /**
   * 获取所有每日笔记
   */
  async getAllDailyNotes(): Promise<Record<string, any>> {
    await this.ensureInitialized();

    if (this.isNative && this.db) {
      const result = await this.db.query('SELECT * FROM daily_notes');
      const notes: Record<string, any> = {};
      (result.values || []).forEach(row => {
        notes[row.date_str as string] = {
          date: row.date_str as string,
          content: row.content as string,
          deepReflection: row.deep_reflection as string | undefined,
          deepReflectionSource: row.deep_reflection_source as string | undefined,
          deepReflectionTimestamp: row.deep_reflection_timestamp as number | undefined
        };
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
      // 使用 INSERT ... ON CONFLICT 保留其他字段
      await this.db.run(
        `INSERT INTO daily_notes (date_str, content)
         VALUES (?, ?)
         ON CONFLICT(date_str) DO UPDATE SET content = excluded.content`,
        [dateStr, content]
      );
    } else {
      const notes = await this.getAllDailyNotes();
      // 如果已存在该日期的笔记，保留深度回看数据
      const existingNote = notes[dateStr];
      notes[dateStr] = {
        date: dateStr,
        content,
        deepReflection: existingNote?.deepReflection,
        deepReflectionSource: existingNote?.deepReflectionSource,
        deepReflectionTimestamp: existingNote?.deepReflectionTimestamp
      };
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
    }
  }

  /**
   * 更新深度回看内容
   */
  async updateDeepReflection(
    dateStr: string,
    deepReflection: string,
    source: 'journal-only' | 'moods-only' | 'journal-with-moods'
  ): Promise<void> {
    await this.ensureInitialized();

    if (this.isNative && this.db) {
      await this.db.run(
        `UPDATE daily_notes
         SET deep_reflection = ?, deep_reflection_source = ?, deep_reflection_timestamp = ?
         WHERE date_str = ?`,
        [deepReflection, source, Date.now(), dateStr]
      );
    } else {
      const notes = await this.getAllDailyNotes();
      if (notes[dateStr]) {
        notes[dateStr].deepReflection = deepReflection;
        notes[dateStr].deepReflectionSource = source;
        notes[dateStr].deepReflectionTimestamp = Date.now();
        localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
      }
    }
  }

  /**
   * 清空深度回看内容（编辑日记时自动调用）
   */
  async clearDeepReflection(dateStr: string): Promise<void> {
    await this.ensureInitialized();

    if (this.isNative && this.db) {
      await this.db.run(
        `UPDATE daily_notes
         SET deep_reflection = NULL, deep_reflection_source = NULL, deep_reflection_timestamp = NULL
         WHERE date_str = ?`,
        [dateStr]
      );
    } else {
      const notes = await this.getAllDailyNotes();
      if (notes[dateStr]) {
        delete notes[dateStr].deepReflection;
        delete notes[dateStr].deepReflectionSource;
        delete notes[dateStr].deepReflectionTimestamp;
        localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
      }
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
        hexColor: row.hex_color as string | undefined,
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
        `INSERT OR REPLACE INTO custom_moods (label, value, score, emoji, color, hex_color, shadow, suggestions)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [mood.label, mood.value, mood.score, mood.emoji, mood.color, mood.hexColor || null, mood.shadow, JSON.stringify(mood.suggestions)]
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
   * 移除与默认心情重复的自定义心情（用于数据清理）
   */
  async removeDuplicateCustomMoods(defaultLabels: string[]): Promise<void> {
    await this.ensureInitialized();
    const customMoods = await this.getCustomMoods();
    const toRemove = customMoods.filter(m => defaultLabels.includes(m.label));
    if (toRemove.length === 0) return;
    for (const m of toRemove) {
      await this.deleteCustomMood(m.label);
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

  // ==================== 备份与恢复操作 ====================

  /**
   * 导出所有数据为备份格式
   */
  async exportAllData(): Promise<BackupData> {
    await this.ensureInitialized();

    const entries = await this.getAllEntries();
    const dailyNotes = await this.getAllDailyNotes();
    const customMoods = await this.getCustomMoods();

    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      platform: this.getStorageType(),
      data: {
        entries,
        dailyNotes,
        customMoods
      }
    };
  }

  /**
   * 从备份数据导入（覆盖模式：相同ID的条目将被替换）
   */
  async importAllData(backupData: BackupData): Promise<ImportResult> {
    await this.ensureInitialized();

    const result: ImportResult = {
      success: false,
      entriesImported: 0,
      notesImported: 0,
      moodsImported: 0,
      errors: []
    };

    try {
      // 验证备份数据格式
      if (!backupData.version || !backupData.data) {
        result.errors.push('无效的备份文件格式');
        return result;
      }

      // 导入日记条目
      if (backupData.data.entries && Array.isArray(backupData.data.entries)) {
        for (const entry of backupData.data.entries) {
          try {
            if (this.isNative && this.db) {
              // SQLite: 使用 INSERT OR REPLACE
              await this.db.run(
                `INSERT OR REPLACE INTO diary_entries (id, timestamp, mood, mood_score, mood_emoji, mood_hex_color, content, tags)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [entry.id, entry.timestamp, entry.mood, entry.moodScore, entry.moodEmoji || null, entry.moodHexColor || null, entry.content, JSON.stringify(entry.tags)]
              );
            } else {
              // localStorage: 合并条目
              const existingEntries = await this.getAllEntries();
              const index = existingEntries.findIndex(e => e.id === entry.id);
              if (index !== -1) {
                existingEntries[index] = entry;
              } else {
                existingEntries.push(entry);
              }
              // 按时间戳排序（降序）
              existingEntries.sort((a, b) => b.timestamp - a.timestamp);
              localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(existingEntries));
            }
            result.entriesImported++;
          } catch (err) {
            result.errors.push(`导入日记条目失败: ${entry.id}`);
          }
        }
      }

      // 导入每日笔记
      if (backupData.data.dailyNotes && typeof backupData.data.dailyNotes === 'object') {
        const noteEntries = Object.entries(backupData.data.dailyNotes);
        for (const [dateStr, content] of noteEntries) {
          try {
            await this.saveDailyNote(dateStr, content);
            result.notesImported++;
          } catch (err) {
            result.errors.push(`导入笔记失败: ${dateStr}`);
          }
        }
      }

      // 导入自定义心情
      if (backupData.data.customMoods && Array.isArray(backupData.data.customMoods)) {
        for (const mood of backupData.data.customMoods) {
          try {
            await this.saveCustomMood(mood);
            result.moodsImported++;
          } catch (err) {
            result.errors.push(`导入自定义心情失败: ${mood.label}`);
          }
        }
      }

      result.success = result.errors.length === 0;
      return result;
    } catch (error) {
      result.errors.push(`导入过程发生错误: ${error}`);
      return result;
    }
  }

  /**
   * 清空所有数据
   */
  async clearAllData(): Promise<void> {
    await this.ensureInitialized();

    if (this.isNative && this.db) {
      await this.db.execute('DELETE FROM diary_entries');
      await this.db.execute('DELETE FROM daily_notes');
      await this.db.execute('DELETE FROM custom_moods');
    } else {
      localStorage.removeItem(STORAGE_KEYS.ENTRIES);
      localStorage.removeItem(STORAGE_KEYS.NOTES);
      localStorage.removeItem(STORAGE_KEYS.CUSTOM_MOODS);
    }
  }

  // ==================== 周总结操作 ====================

  /**
   * 获取指定周的总结
   */
  async getWeeklySummary(weekKey: string): Promise<WeeklySummary | null> {
    await this.ensureInitialized();

    if (this.isNative && this.db) {
      const result = await this.db.query('SELECT * FROM weekly_summaries WHERE week_key = ?', [weekKey]);
      if (result.values && result.values.length > 0) {
        const row = result.values[0];
        return {
          weekKey: row.week_key as string,
          content: row.content as string,
          createdAt: row.created_at as number
        };
      }
      return null;
    } else {
      const data = localStorage.getItem(STORAGE_KEYS.WEEKLY_SUMMARIES);
      const summaries: Record<string, WeeklySummary> = data ? JSON.parse(data) : {};
      return summaries[weekKey] || null;
    }
  }

  /**
   * 保存周总结
   */
  async saveWeeklySummary(summary: WeeklySummary): Promise<void> {
    await this.ensureInitialized();

    if (this.isNative && this.db) {
      await this.db.run(
        `INSERT OR REPLACE INTO weekly_summaries (week_key, content, created_at) VALUES (?, ?, ?)`,
        [summary.weekKey, summary.content, summary.createdAt]
      );
    } else {
      const data = localStorage.getItem(STORAGE_KEYS.WEEKLY_SUMMARIES);
      const summaries: Record<string, WeeklySummary> = data ? JSON.parse(data) : {};
      summaries[summary.weekKey] = summary;
      localStorage.setItem(STORAGE_KEYS.WEEKLY_SUMMARIES, JSON.stringify(summaries));
    }
  }

  /**
   * 删除指定周的总结
   */
  async deleteWeeklySummary(weekKey: string): Promise<void> {
    await this.ensureInitialized();

    if (this.isNative && this.db) {
      await this.db.run('DELETE FROM weekly_summaries WHERE week_key = ?', [weekKey]);
    } else {
      const data = localStorage.getItem(STORAGE_KEYS.WEEKLY_SUMMARIES);
      const summaries: Record<string, WeeklySummary> = data ? JSON.parse(data) : {};
      delete summaries[weekKey];
      localStorage.setItem(STORAGE_KEYS.WEEKLY_SUMMARIES, JSON.stringify(summaries));
    }
  }
  // ==================== 通用键值存储（user_settings） ====================

  /**
   * 读取设置项
   */
  async getSetting(key: string): Promise<string | null> {
    await this.ensureInitialized();

    if (this.isNative && this.db) {
      const result = await this.db.query('SELECT value FROM user_settings WHERE key = ?', [key]);
      if (result.values && result.values.length > 0) {
        return result.values[0].value as string;
      }
      return null;
    } else {
      return localStorage.getItem(`soulmirror_setting_${key}`);
    }
  }

  /**
   * 保存设置项
   */
  async saveSetting(key: string, value: string): Promise<void> {
    await this.ensureInitialized();

    if (this.isNative && this.db) {
      await this.db.run(
        'INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)',
        [key, value]
      );
    } else {
      localStorage.setItem(`soulmirror_setting_${key}`, value);
    }
  }
}

// ==================== 周报系统操作 ====================
// 注意：这里使用原型扩展方式，保持类的单一性

const WEEKLY_REPORTS_KEY = 'soulmirror_weekly_reports';

// 保存周报
DatabaseService.prototype.saveWeeklyReport = async function(report: WeeklyReport): Promise<void> {
  await this.ensureInitialized();

  if (this.isNative && this.db) {
    // 检查表是否存在，不存在则创建
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS weekly_reports (
        week_key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        generated_at INTEGER NOT NULL,
        viewed_at INTEGER,
        experiment_accepted INTEGER DEFAULT 0,
        experiment_completed INTEGER DEFAULT 0
      )
    `);
    
    await this.db.run(
      `INSERT OR REPLACE INTO weekly_reports (week_key, data, generated_at, viewed_at, experiment_accepted, experiment_completed)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        report.weekKey,
        JSON.stringify(report),
        report.generatedAt,
        report.tracking?.viewedAt || null,
        report.tracking?.experimentAccepted ? 1 : 0,
        report.tracking?.experimentCompleted ? 1 : 0
      ]
    );
  } else {
    const data = localStorage.getItem(WEEKLY_REPORTS_KEY);
    const reports: Record<string, WeeklyReport> = data ? JSON.parse(data) : {};
    reports[report.weekKey] = report;
    localStorage.setItem(WEEKLY_REPORTS_KEY, JSON.stringify(reports));
  }
};

// 获取指定周的周报
DatabaseService.prototype.getWeeklyReport = async function(weekKey: string): Promise<WeeklyReport | null> {
  await this.ensureInitialized();

  if (this.isNative && this.db) {
    // 确保表存在（避免查询不存在的表报错）
    try {
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS weekly_reports (
          week_key TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          generated_at INTEGER NOT NULL,
          viewed_at INTEGER,
          experiment_accepted INTEGER DEFAULT 0,
          experiment_completed INTEGER DEFAULT 0
        )
      `);
    } catch (e) {
      // 表已存在或创建失败，继续查询
    }
    
    const result = await this.db.query('SELECT * FROM weekly_reports WHERE week_key = ?', [weekKey]);
    if (result.values && result.values.length > 0) {
      const row = result.values[0];
      const report: WeeklyReport = JSON.parse(row.data as string);
      report.tracking = {
        viewedAt: row.viewed_at as number | undefined,
        experimentAccepted: Boolean(row.experiment_accepted),
        experimentCompleted: Boolean(row.experiment_completed)
      };
      return report;
    }
    return null;
  } else {
    const data = localStorage.getItem(WEEKLY_REPORTS_KEY);
    const reports: Record<string, WeeklyReport> = data ? JSON.parse(data) : {};
    return reports[weekKey] || null;
  }
};

// 获取所有周报
DatabaseService.prototype.getAllWeeklyReports = async function(): Promise<WeeklyReport[]> {
  await this.ensureInitialized();

  if (this.isNative && this.db) {
    // 确保表存在
    try {
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS weekly_reports (
          week_key TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          generated_at INTEGER NOT NULL,
          viewed_at INTEGER,
          experiment_accepted INTEGER DEFAULT 0,
          experiment_completed INTEGER DEFAULT 0
        )
      `);
    } catch (e) {
      // 表已存在或创建失败，继续查询
    }
    
    const result = await this.db.query('SELECT * FROM weekly_reports ORDER BY week_key DESC');
    return (result.values || []).map((row: any) => {
      const report: WeeklyReport = JSON.parse(row.data);
      report.tracking = {
        viewedAt: row.viewed_at,
        experimentAccepted: Boolean(row.experiment_accepted),
        experimentCompleted: Boolean(row.experiment_completed)
      };
      return report;
    });
  } else {
    const data = localStorage.getItem(WEEKLY_REPORTS_KEY);
    const reports: Record<string, WeeklyReport> = data ? JSON.parse(data) : {};
    return Object.values(reports).sort((a, b) => b.weekKey.localeCompare(a.weekKey));
  }
};

// 标记周报为已读
DatabaseService.prototype.markReportAsViewed = async function(weekKey: string): Promise<void> {
  await this.ensureInitialized();
  const report = await this.getWeeklyReport(weekKey);
  if (report) {
    report.tracking = {
      ...report.tracking,
      viewedAt: Date.now()
    };
    await this.saveWeeklyReport(report);
  }
};

// 接受实验
DatabaseService.prototype.acceptExperiment = async function(weekKey: string): Promise<void> {
  await this.ensureInitialized();
  const report = await this.getWeeklyReport(weekKey);
  if (report) {
    report.tracking = {
      ...report.tracking,
      experimentAccepted: true
    };
    await this.saveWeeklyReport(report);
  }
};

// 完成实验
DatabaseService.prototype.completeExperiment = async function(weekKey: string): Promise<void> {
  await this.ensureInitialized();
  const report = await this.getWeeklyReport(weekKey);
  if (report) {
    report.tracking = {
      ...report.tracking,
      experimentCompleted: true
    };
    await this.saveWeeklyReport(report);
  }
};

// 删除周报
DatabaseService.prototype.deleteWeeklyReport = async function(weekKey: string): Promise<void> {
  await this.ensureInitialized();

  if (this.isNative && this.db) {
    // 确保表存在
    try {
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS weekly_reports (
          week_key TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          generated_at INTEGER NOT NULL,
          viewed_at INTEGER,
          experiment_accepted INTEGER DEFAULT 0,
          experiment_completed INTEGER DEFAULT 0
        )
      `);
    } catch (e) {
      // 表已存在或创建失败，继续
    }
    
    await this.db.run('DELETE FROM weekly_reports WHERE week_key = ?', [weekKey]);
  } else {
    const data = localStorage.getItem(WEEKLY_REPORTS_KEY);
    const reports: Record<string, WeeklyReport> = data ? JSON.parse(data) : {};
    delete reports[weekKey];
    localStorage.setItem(WEEKLY_REPORTS_KEY, JSON.stringify(reports));
  }
};

// 导出单例实例
export const databaseService = new DatabaseService();
