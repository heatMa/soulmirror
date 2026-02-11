import { DiaryEntry } from '../types';

/**
 * 格式化持续时间（分钟 → 可读字符串）
 * @param minutes 持续时长（分钟）
 * @returns 格式化后的字符串，如 "2小时30分" 或 "45分钟"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}分钟`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) {
    return `${hours}小时`;
  }

  return `${hours}小时${mins}分`;
}

/**
 * 计算情绪持续时长（毫秒 → 分钟）
 * @param startTimestamp 开始时间戳（毫秒）
 * @param endTimestamp 结束时间戳（毫秒）
 * @returns 持续时长（分钟）
 */
export function calculateDurationInMinutes(startTimestamp: number, endTimestamp: number): number {
  const durationMs = endTimestamp - startTimestamp;
  return Math.max(1, Math.round(durationMs / 60000)); // 至少1分钟
}

/**
 * 获取 DiaryEntry 的显示持续时长
 * 优先级：endTimestamp 自动计算 > duration 手动填写 > null
 * @param entry 日记条目
 * @returns 持续时长字符串，如 "2小时30分" 或 null
 */
export function getEntryDurationDisplay(entry: DiaryEntry): string | null {
  // 1. 如果有结束时间，自动计算
  if (entry.endTimestamp) {
    const minutes = calculateDurationInMinutes(entry.timestamp, entry.endTimestamp);
    return formatDuration(minutes);
  }

  // 2. 如果有手动填写的时长
  if (entry.duration) {
    return formatDuration(entry.duration);
  }

  // 3. 如果是进行中
  if (entry.isActive) {
    const now = Date.now();
    const minutes = calculateDurationInMinutes(entry.timestamp, now);
    return `${formatDuration(minutes)}（进行中）`;
  }

  // 4. 没有持续时间
  return null;
}

/**
 * 获取 DiaryEntry 的实际持续分钟数（用于统计分析）
 * @param entry 日记条目
 * @returns 持续时长（分钟）或 null
 */
export function getEntryDurationMinutes(entry: DiaryEntry): number | null {
  if (entry.endTimestamp) {
    return calculateDurationInMinutes(entry.timestamp, entry.endTimestamp);
  }

  if (entry.duration) {
    return entry.duration;
  }

  return null;
}

/**
 * 解析用户输入的时长字符串 → 分钟数
 * 支持格式："2小时30分"、"1小时"、"45分钟"、"2h30m"、"1.5h"
 * @param input 用户输入的时长字符串
 * @returns 分钟数，解析失败返回 null
 */
export function parseDurationInput(input: string): number | null {
  if (!input || !input.trim()) return null;

  const cleaned = input.trim();

  // 匹配 "2小时30分" 或 "1小时" 或 "45分钟"
  const chinesePattern = /(?:(\d+)\s*小时)?(?:\s*(\d+)\s*分钟?)?/;
  const match = cleaned.match(chinesePattern);

  if (match) {
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const total = hours * 60 + minutes;
    if (total > 0) return total;
  }

  // 匹配 "2h30m" 或 "1h" 或 "45m"
  const englishPattern = /(?:(\d+)\s*h)?(?:\s*(\d+)\s*m)?/i;
  const match2 = cleaned.match(englishPattern);

  if (match2) {
    const hours = parseInt(match2[1] || '0');
    const minutes = parseInt(match2[2] || '0');
    const total = hours * 60 + minutes;
    if (total > 0) return total;
  }

  // 匹配纯数字（默认为分钟）
  const numberMatch = cleaned.match(/^\d+$/);
  if (numberMatch) {
    return parseInt(cleaned);
  }

  // 匹配小数（如 1.5 表示 1.5 小时）
  const decimalMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*h?$/i);
  if (decimalMatch) {
    return Math.round(parseFloat(decimalMatch[1]) * 60);
  }

  return null;
}
