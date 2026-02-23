import React, { useState, useMemo } from 'react';
import { DiaryEntry } from '../types';
import { MoodOption, getHexFromTailwind, ICONS } from '../constants';

interface Props {
  entries: DiaryEntry[];
  allMoods: MoodOption[];
  selectedMood: string | null;
  timeRange: 'week' | 'month' | 'quarter' | 'all';
}

const MoodHistory: React.FC<Props> = ({ entries, allMoods, selectedMood, timeRange }) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // 折叠状态：存储哪些日期被折叠（默认全部展开）
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());

  // 当筛选条件变化时，清除日期选择和折叠状态
  React.useEffect(() => {
    setSelectedDate(null);
    setCollapsedDates(new Set());
  }, [selectedMood, timeRange]);

  // 按日期分组条目
  const entriesByDate = useMemo(() => {
    const grouped: Record<string, DiaryEntry[]> = {};
    entries.forEach(entry => {
      const dateStr = new Date(entry.timestamp).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\//g, '-');
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(entry);
    });
    return grouped;
  }, [entries]);

  // 获取有记录的日期集合
  const datesWithEntries = useMemo(() => {
    return new Set(Object.keys(entriesByDate));
  }, [entriesByDate]);

  // 根据时间范围决定显示多少个月
  const monthsToShow = useMemo(() => {
    switch (timeRange) {
      case 'week':
        return 1;  // 近7天只显示当月
      case 'month':
        return 2;  // 近30天显示2个月
      case 'quarter':
        return 3;  // 近3月显示3个月
      case 'all':
      default:
        return 3;  // 全部显示3个月
    }
  }, [timeRange]);

  // 计算最大次数用于透明度计算
  const maxCount = useMemo(() => {
    let max = 0;
    Object.values(entriesByDate).forEach((dayEntries: DiaryEntry[]) => {
      if (dayEntries.length > max) max = dayEntries.length;
    });
    return max || 1;
  }, [entriesByDate]);

  // 生成日历数据 (根据时间范围动态调整)
  const calendarData = useMemo(() => {
    const months: {
      year: number;
      month: number;
      days: { date: Date; dateStr: string; hasEntries: boolean; count: number }[];
    }[] = [];

    const today = new Date();

    for (let i = 0; i < monthsToShow; i++) {
      const targetDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth();

      // 获取该月天数
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      // 获取该月第一天是星期几 (0=周日)
      const firstDayOfWeek = new Date(year, month, 1).getDay();

      const days: { date: Date; dateStr: string; hasEntries: boolean; count: number }[] = [];

      // 填充前面的空白
      const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
      for (let j = 0; j < adjustedFirstDay; j++) {
        days.push({ date: new Date(0), dateStr: '', hasEntries: false, count: 0 });
      }

      // 填充日期
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = date.toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).replace(/\//g, '-');
        const hasEntries = datesWithEntries.has(dateStr);
        const count = entriesByDate[dateStr]?.length || 0;

        days.push({ date, dateStr, hasEntries, count });
      }

      months.push({ year, month, days });
    }

    return months;
  }, [datesWithEntries, entriesByDate, monthsToShow]);

  // 当前选中日期的条目
  const selectedDateEntries = useMemo(() => {
    if (!selectedDate) return [];
    return entriesByDate[selectedDate] || [];
  }, [selectedDate, entriesByDate]);

  // 获取心情配置
  const getMoodConfig = (moodLabel: string) => {
    return allMoods.find(m => m.label === moodLabel);
  };

  // 切换日期折叠状态
  const toggleDateCollapse = (dateStr: string) => {
    const newCollapsed = new Set(collapsedDates);
    if (newCollapsed.has(dateStr)) {
      newCollapsed.delete(dateStr);
    } else {
      newCollapsed.add(dateStr);
    }
    setCollapsedDates(newCollapsed);
  };

  // 按日期分组并排序的记录
  const groupedEntries = useMemo(() => {
    const grouped: { dateStr: string; entries: DiaryEntry[] }[] = [];
    const dateMap: Record<string, DiaryEntry[]> = {};

    entries.forEach(entry => {
      const dateStr = new Date(entry.timestamp).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\//g, '-');

      if (!dateMap[dateStr]) {
        dateMap[dateStr] = [];
      }
      dateMap[dateStr].push(entry);
    });

    // 转换为数组并按日期倒序排序（最新的在前）
    Object.keys(dateMap)
      .sort((a, b) => b.localeCompare(a))
      .forEach(dateStr => {
        // 每天内的记录按时间正序排序（早的在前）
        const dayEntries = dateMap[dateStr].sort((a, b) => a.timestamp - b.timestamp);
        grouped.push({ dateStr, entries: dayEntries });
      });

    return grouped;
  }, [entries]);

  // 获取今天的日期字符串
  const todayStr = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '-');

  if (entries.length === 0) {
    return (
      <div className="glass-card rounded-[2rem] p-6 text-center">
        <div className="text-4xl mb-3">📭</div>
        <p className="text-sm text-gray-500">
          {selectedMood ? `还没有「${selectedMood}」的记录` : '暂无符合条件的记录'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 日历部分 */}
      <div className="glass-card rounded-[2rem] p-4">
        <h3 className="text-sm font-bold text-gray-600 mb-3 px-1">
          {selectedMood ? `「${selectedMood}」出现的日期` : '记录日历'}
          {selectedMood && (
            <span className="text-xs text-gray-400 font-normal ml-2">
              共{entries.length}次
            </span>
          )}
        </h3>

        {/* 根据月份数量自适应布局：1月=单列，2月=两列，3月+=网格 */}
        <div className={`grid gap-3 ${
          monthsToShow === 1 ? 'grid-cols-1' :
          monthsToShow === 2 ? 'grid-cols-2' :
          'grid-cols-2'
        }`}>
          {calendarData.map((monthData, monthIndex) => (
            <div key={`${monthData.year}-${monthData.month}`} className="space-y-2">
              {/* 月份标题 - 轻微缩小 */}
              <div className="text-[11px] font-medium text-gray-500">
                {monthData.year}年{monthData.month + 1}月
              </div>

              {/* 星期标题 - 轻微缩小 */}
              <div className="grid grid-cols-7 gap-0.5 mb-1">
                {['一', '二', '三', '四', '五', '六', '日'].map(day => (
                  <div key={day} className="text-center text-[9px] text-gray-400">
                    {day}
                  </div>
                ))}
              </div>

              {/* 日期格子 - 减少高度约15-20% */}
              <div className="grid grid-cols-7 gap-0.5">
                {monthData.days.map((dayData, index) => {
                  if (!dayData.dateStr) {
                    return <div key={index} className="aspect-square" />;
                  }

                  const isToday = dayData.dateStr === todayStr;
                  const isSelected = dayData.dateStr === selectedDate;
                  const hasEntries = dayData.hasEntries;

                  // 获取该日期最常见的心情颜色
                  let dominantColor = '#e5e7eb';
                  if (hasEntries) {
                    const dayEntries = entriesByDate[dayData.dateStr];
                    const moodCounts: Record<string, number> = {};
                    dayEntries.forEach(e => {
                      moodCounts[e.mood] = (moodCounts[e.mood] || 0) + 1;
                    });
                    const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
                    if (topMood) {
                      const config = getMoodConfig(topMood[0]);
                      dominantColor = config?.hexColor || getHexFromTailwind(config?.color || 'bg-gray-400');
                    }
                  }

                  // 根据次数计算不透明度 (最小0.3，最大1)
                  const opacity = hasEntries ? Math.max(0.3, dayData.count / maxCount) : 1;

                  return (
                    <button
                      key={dayData.dateStr}
                      onClick={() => setSelectedDate(
                        selectedDate === dayData.dateStr ? null : dayData.dateStr
                      )}
                      className={`aspect-square rounded-md text-[10px] font-medium transition-all relative ${
                        isSelected
                          ? 'ring-2 ring-gray-800 ring-offset-1'
                          : ''
                      } ${
                        isToday
                          ? 'font-bold'
                          : ''
                      }`}
                      style={{
                        backgroundColor: hasEntries ? dominantColor : '#f8fafc',
                        color: hasEntries ? 'white' : (isToday ? '#374151' : '#9ca3af'),
                        opacity: hasEntries ? opacity : 1,
                        maxHeight: '32px' // 限制格子最大高度，约减少15-20%
                      }}
                    >
                      {dayData.date.getDate()}
                      {/* 记录数量角标 */}
                      {dayData.count > 1 && (
                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-gray-800 text-white text-[7px] rounded-full flex items-center justify-center">
                          {dayData.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 选中日期的记录列表 */}
      {selectedDate && selectedDateEntries.length > 0 && (
        <div className="glass-card rounded-[2rem] p-4">
          <h3 className="text-sm font-bold text-gray-600 mb-3 px-1">
            {selectedDate} 的记录
          </h3>
          <div className="space-y-3">
            {selectedDateEntries.map(entry => {
              const moodConfig = getMoodConfig(entry.mood);
              const hexColor = moodConfig?.hexColor || getHexFromTailwind(moodConfig?.color || 'bg-gray-400');
              const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={entry.id}
                  className="p-3 rounded-xl"
                  style={{ backgroundColor: `${hexColor}10` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{moodConfig?.emoji || '🏷️'}</span>
                    <span
                      className="text-sm font-bold"
                      style={{ color: hexColor }}
                    >
                      {entry.mood}
                    </span>
                    <span className="text-xs text-gray-400">{time}</span>
                    {entry.moodScore > 0 && (
                      <span
                        className="text-xs font-medium ml-auto"
                        style={{ color: hexColor }}
                      >
                        {entry.moodScore.toFixed(1)}分
                      </span>
                    )}
                  </div>
                  <div
                    className="text-sm text-gray-600"
                    dangerouslySetInnerHTML={{ __html: entry.content }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 按日期分组的记录列表 (当没有选中日期时显示) */}
      {!selectedDate && (
        <div className="space-y-3">
          {groupedEntries.map(({ dateStr, entries: dayEntries }) => {
            const isCollapsed = collapsedDates.has(dateStr);
            const date = new Date(dateStr);
            const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
            const isToday = dateStr === todayStr;

            return (
              <div key={dateStr} className="glass-card rounded-[2rem] overflow-hidden">
                {/* 可点击的日期标题栏 */}
                <button
                  onClick={() => toggleDateCollapse(dateStr)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className={`transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}>
                      <ICONS.ChevronRight />
                    </div>
                    <h3 className="text-sm font-bold text-gray-700">
                      {date.getMonth() + 1}月{date.getDate()}日 {weekday}
                      {isToday && <span className="ml-2 text-xs text-indigo-500">今天</span>}
                    </h3>
                    <span className="text-xs text-gray-400 font-medium">
                      {dayEntries.length}条记录
                    </span>
                  </div>
                </button>

                {/* 展开的记录列表 */}
                {!isCollapsed && (
                  <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-3">
                    {dayEntries.map(entry => {
                      const moodConfig = getMoodConfig(entry.mood);
                      const hexColor = moodConfig?.hexColor || getHexFromTailwind(moodConfig?.color || 'bg-gray-400');
                      const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      });

                      return (
                        <div
                          key={entry.id}
                          className="p-3 rounded-xl"
                          style={{ backgroundColor: `${hexColor}10` }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-base">{moodConfig?.emoji || '🏷️'}</span>
                            <span
                              className="text-sm font-bold"
                              style={{ color: hexColor }}
                            >
                              {entry.mood}
                            </span>
                            <span className="text-xs text-gray-400">{time}</span>
                            {entry.moodScore > 0 && (
                              <span
                                className="text-xs font-medium ml-auto"
                                style={{ color: hexColor }}
                              >
                                {entry.moodScore.toFixed(1)}分
                              </span>
                            )}
                          </div>
                          <div
                            className="text-sm text-gray-600"
                            dangerouslySetInnerHTML={{ __html: entry.content }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {groupedEntries.length === 0 && (
            <div className="glass-card rounded-[2rem] p-6 text-center">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-sm text-gray-500">
                {selectedMood ? `还没有「${selectedMood}」的记录` : '暂无符合条件的记录'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MoodHistory;
