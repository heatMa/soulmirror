import React, { useState, useMemo } from 'react';
import { DiaryEntry } from '../types';
import { MoodOption, getHexFromTailwind } from '../constants';

interface Props {
  entries: DiaryEntry[];
  allMoods: MoodOption[];
  selectedMood: string | null;
}

const MoodHistory: React.FC<Props> = ({ entries, allMoods, selectedMood }) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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

  // 生成日历数据 (近3个月)
  const calendarData = useMemo(() => {
    const months: {
      year: number;
      month: number;
      days: { date: Date; dateStr: string; hasEntries: boolean; count: number }[];
    }[] = [];

    const today = new Date();

    for (let i = 0; i < 3; i++) {
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
  }, [datesWithEntries, entriesByDate]);

  // 当前选中日期的条目
  const selectedDateEntries = useMemo(() => {
    if (!selectedDate) return [];
    return entriesByDate[selectedDate] || [];
  }, [selectedDate, entriesByDate]);

  // 获取心情配置
  const getMoodConfig = (moodLabel: string) => {
    return allMoods.find(m => m.label === moodLabel);
  };

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
        </h3>

        {calendarData.map((monthData, monthIndex) => (
          <div key={`${monthData.year}-${monthData.month}`} className={monthIndex > 0 ? 'mt-4' : ''}>
            {/* 月份标题 */}
            <div className="text-xs font-medium text-gray-500 mb-2">
              {monthData.year}年{monthData.month + 1}月
            </div>

            {/* 星期标题 */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['一', '二', '三', '四', '五', '六', '日'].map(day => (
                <div key={day} className="text-center text-[10px] text-gray-400">
                  {day}
                </div>
              ))}
            </div>

            {/* 日期格子 */}
            <div className="grid grid-cols-7 gap-1">
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

                return (
                  <button
                    key={dayData.dateStr}
                    onClick={() => setSelectedDate(
                      selectedDate === dayData.dateStr ? null : dayData.dateStr
                    )}
                    className={`aspect-square rounded-lg text-[11px] font-medium transition-all relative ${
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
                      color: hasEntries ? 'white' : (isToday ? '#374151' : '#9ca3af')
                    }}
                  >
                    {dayData.date.getDate()}
                    {/* 记录数量角标 */}
                    {dayData.count > 1 && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-gray-800 text-white text-[8px] rounded-full flex items-center justify-center">
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
                    className="text-sm text-gray-600 line-clamp-3"
                    dangerouslySetInnerHTML={{ __html: entry.content }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 全部记录列表 (当没有选中日期时显示) */}
      {!selectedDate && (
        <div className="glass-card rounded-[2rem] p-4">
          <h3 className="text-sm font-bold text-gray-600 mb-3 px-1">
            {selectedMood ? `「${selectedMood}」的全部记录` : '全部记录'}
            <span className="text-xs text-gray-400 font-normal ml-2">共{entries.length}条</span>
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {entries.slice(0, 20).map(entry => {
              const moodConfig = getMoodConfig(entry.mood);
              const hexColor = moodConfig?.hexColor || getHexFromTailwind(moodConfig?.color || 'bg-gray-400');
              const dateTime = new Date(entry.timestamp).toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
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
                    <span className="text-xs text-gray-400">{dateTime}</span>
                  </div>
                  <div
                    className="text-sm text-gray-600 line-clamp-2"
                    dangerouslySetInnerHTML={{ __html: entry.content }}
                  />
                </div>
              );
            })}
            {entries.length > 20 && (
              <p className="text-center text-xs text-gray-400 pt-2">
                仅显示最近20条，请使用日历查看更多
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MoodHistory;
