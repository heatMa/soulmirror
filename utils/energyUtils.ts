import { DiaryEntry } from '../types';

// 每日起始能量
export const DAILY_STARTING_ENERGY = 100;

/**
 * 计算某天的累计电量序列
 * @param entries 当天的所有记录（会自动按时间排序）
 * @returns 每条记录后的累计电量数组
 */
export const calculateDailyEnergy = (entries: DiaryEntry[]): number[] => {
  const sortedEntries = [...entries].sort((a, b) => a.timestamp - b.timestamp);
  let currentEnergy = DAILY_STARTING_ENERGY;

  return sortedEntries.map(entry => {
    const delta = entry.energyDelta ?? 0;
    currentEnergy = Math.max(0, currentEnergy + delta);
    return currentEnergy;
  });
};

/**
 * 获取单条记录后的剩余电量
 * @param entries 当天的所有记录
 * @param targetEntry 目标记录
 * @returns 剩余电量
 */
export const getEnergyAfterEntry = (
  entries: DiaryEntry[],
  targetEntry: DiaryEntry
): number => {
  const sortedEntries = [...entries]
    .sort((a, b) => a.timestamp - b.timestamp);

  let currentEnergy = DAILY_STARTING_ENERGY;

  for (const entry of sortedEntries) {
    const delta = entry.energyDelta ?? 0;
    currentEnergy = Math.max(0, currentEnergy + delta);

    if (entry.id === targetEntry.id) {
      return currentEnergy;
    }
  }

  return currentEnergy;
};

/**
 * 获取当天的最终电量
 */
export const getTodayFinalEnergy = (entries: DiaryEntry[]): number => {
  const energyLevels = calculateDailyEnergy(entries);
  return energyLevels.length > 0 ? energyLevels[energyLevels.length - 1] : DAILY_STARTING_ENERGY;
};

/**
 * 格式化能量变化显示
 * @param delta 能量变化值
 * @param remaining 剩余电量
 * @returns 格式化字符串，如 "-8分 → 剩余72分"
 */
export const formatEnergyDisplay = (delta: number, remaining: number): string => {
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta}分 → 剩余${Math.round(remaining)}分`;
};

/**
 * 获取过去一周每天的最终电量
 */
export const getWeeklyEnergyData = (entries: DiaryEntry[]): { day: number; energy: number; hasData: boolean }[] => {
  const result: { day: number; energy: number; hasData: boolean }[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const dayEntries = entries.filter(e =>
      e.timestamp >= date.getTime() && e.timestamp <= dayEnd.getTime()
    );

    const dayOfWeek = date.getDay();
    // 转换为周一=1，周日=7
    const adjustedDay = dayOfWeek === 0 ? 7 : dayOfWeek;

    if (dayEntries.length > 0) {
      result.push({
        day: adjustedDay,
        energy: getTodayFinalEnergy(dayEntries),
        hasData: true
      });
    } else {
      result.push({
        day: adjustedDay,
        energy: 0,
        hasData: false
      });
    }
  }

  return result;
};
