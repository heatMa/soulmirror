import React, { useState, useMemo } from 'react';
import { DiaryEntry } from '../types';
import { MoodOption, getHexFromTailwind, ICONS } from '../constants';
import { databaseService } from '../services/databaseService';

// 复制文本到剪贴板
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for non-secure contexts
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const result = document.execCommand('copy');
    document.body.removeChild(textArea);
    return result;
  } catch (err) {
    console.error('复制失败:', err);
    return false;
  }
};

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
  // 复制状态
  const [isCopying, setIsCopying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  // 视图模式：列表或卡片
  const [viewMode, setViewMode] = useState<'list' | 'card'>('card');
  // 列表模式下展开的条目
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // 从数据库读取视图偏好（支持 SQLite 和 localStorage 双平台）
  React.useEffect(() => {
    const loadViewMode = async () => {
      try {
        const settings = await databaseService.getUserSettings();
        if (settings.moodHistoryViewMode) {
          setViewMode(settings.moodHistoryViewMode);
        }
      } catch (err) {
        console.error('加载视图偏好失败:', err);
        // 失败时使用默认值
      }
    };
    loadViewMode();
  }, []);

  // 保存视图偏好到数据库（支持 SQLite 和 localStorage 双平台）
  React.useEffect(() => {
    const saveViewMode = async () => {
      try {
        const currentSettings = await databaseService.getUserSettings();
        await databaseService.saveUserSettings({
          ...currentSettings,
          moodHistoryViewMode: viewMode
        });
      } catch (err) {
        console.error('保存视图偏好失败:', err);
      }
    };
    saveViewMode();
  }, [viewMode]);

  // 当筛选条件变化时，清除日期选择和折叠状态
  React.useEffect(() => {
    setSelectedDate(null);
    setCollapsedDates(new Set());
    setExpandedEntryId(null);
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

  // 格式化记录为文本（方案A格式）
  const formatEntriesForCopy = useMemo(() => {
    if (entries.length === 0) return '';

    // 按日期分组
    const grouped: Record<string, DiaryEntry[]> = {};
    entries.forEach(entry => {
      const dateStr = new Date(entry.timestamp).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\//g, '-');
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push(entry);
    });

    // 获取日期范围
    const dates = Object.keys(grouped).sort();
    const startDate = dates[dates.length - 1]; // 最早的日期（按时间倒序）
    const endDate = dates[0]; // 最晚的日期

    // 构建文本
    let text = `📊 情绪日记报告 (${startDate} 至 ${endDate})\n`;
    if (selectedMood) {
      text += `🎯 筛选心情：${selectedMood}\n`;
    }
    text += `📝 共 ${entries.length} 条记录\n\n`;

    // 按日期倒序遍历
    dates.forEach(dateStr => {
      const date = new Date(dateStr);
      const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
      text += `${dateStr} ${weekday}\n━━━━━━━━━━━━━━━\n`;

      // 每天内的记录按时间正序排序
      const dayEntries = grouped[dateStr].sort((a, b) => a.timestamp - b.timestamp);
      dayEntries.forEach(entry => {
        const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit'
        });
        const moodConfig = getMoodConfig(entry.mood);
        const emoji = moodConfig?.emoji || '🏷️';
        const energyText = entry.energyDelta !== undefined
          ? ` (${entry.energyDelta >= 0 ? '+' : ''}${entry.energyDelta}分)`
          : '';

        // 清理HTML标签
        const plainContent = entry.content.replace(/<[^>]*>/g, '');

        text += `\n🕐 ${time}  ${emoji} ${entry.mood}${energyText}\n`;
        if (plainContent) {
          text += `内容：${plainContent}\n`;
        }
      });

      text += '\n\n';
    });

    return text.trim();
  }, [entries, selectedMood]);

  // 处理复制
  const handleCopy = async () => {
    if (entries.length === 0) return;
    setIsCopying(true);
    const success = await copyToClipboard(formatEntriesForCopy);
    setIsCopying(false);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // 剥离 HTML 标签
  const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>/g, '');
  };

  // 切换列表条目展开状态
  const toggleEntryExpand = (entryId: string) => {
    setExpandedEntryId(expandedEntryId === entryId ? null : entryId);
  };

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
                    {entry.energyDelta !== undefined && (
                      <span
                        className="text-xs font-medium ml-auto"
                        style={{ color: entry.energyDelta >= 0 ? '#10b981' : '#f43f5e' }}
                      >
                        {entry.energyDelta >= 0 ? '+' : ''}{entry.energyDelta}分
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
          {/* 筛选心情后的视觉反馈横幅 */}
          {selectedMood && (
            (() => {
              const moodConfig = getMoodConfig(selectedMood);
              const hexColor = moodConfig?.hexColor || getHexFromTailwind(moodConfig?.color || 'bg-gray-400');
              return (
                <div
                  className="px-4 py-3 rounded-xl flex items-center justify-between"
                  style={{
                    backgroundColor: `${hexColor}15`,
                    borderLeft: `3px solid ${hexColor}`
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{moodConfig?.emoji || '🏷️'}</span>
                    <div>
                      <span
                        className="text-sm font-bold"
                        style={{ color: hexColor }}
                      >
                        {selectedMood}
                      </span>
                      <span className="text-xs text-gray-500 ml-2">
                        共 {entries.length} 条记录
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()
          )}

          {/* 标题栏 + 视图切换 + 复制按钮 */}
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-600">记录列表</h3>
              <span className="text-xs text-gray-400">
                共 {entries.length} 条
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* 视图切换按钮 */}
              <div className="flex items-center bg-white/50 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-all ${
                    viewMode === 'list'
                      ? 'bg-white shadow-sm text-gray-800'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                  title="列表视图"
                >
                  <ICONS.List />
                </button>
                <button
                  onClick={() => setViewMode('card')}
                  className={`p-1.5 rounded-md transition-all ${
                    viewMode === 'card'
                      ? 'bg-white shadow-sm text-gray-800'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                  title="卡片视图"
                >
                  <ICONS.Grid />
                </button>
              </div>

              {/* 复制按钮 */}
              <button
                onClick={handleCopy}
                disabled={isCopying || entries.length === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                  copySuccess
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-800 text-white hover:bg-gray-700'
                } ${isCopying ? 'opacity-70' : ''}`}
              >
                {copySuccess ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    已复制
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    复制全部
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 列表模式 */}
          {viewMode === 'list' && (
            <div className="space-y-1">
              {entries.sort((a, b) => b.timestamp - a.timestamp).map(entry => {
                const moodConfig = getMoodConfig(entry.mood);
                const hexColor = moodConfig?.hexColor || getHexFromTailwind(moodConfig?.color || 'bg-gray-400');
                const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit'
                });
                const isExpanded = expandedEntryId === entry.id;
                const plainContent = stripHtml(entry.content);

                return (
                  <div key={entry.id}>
                    {/* 列表项头部（始终显示） */}
                    <div
                      onClick={() => toggleEntryExpand(entry.id)}
                      className="flex items-center gap-3 px-3 py-2.5 bg-white/60 rounded-xl hover:bg-white/80 transition-colors cursor-pointer"
                    >
                      {/* 左侧：表情 + 心情 */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-lg">{moodConfig?.emoji || '🏷️'}</span>
                        <span
                          className="text-sm font-medium"
                          style={{ color: hexColor }}
                        >
                          {entry.mood}
                        </span>
                        {entry.energyDelta !== undefined && (
                          <span className={`text-xs ${entry.energyDelta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {entry.energyDelta >= 0 ? '+' : ''}{entry.energyDelta}
                          </span>
                        )}
                      </div>

                      {/* 中间：内容摘要 */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-600 truncate">
                          {plainContent || '无内容'}
                        </p>
                      </div>

                      {/* 右侧：时间 */}
                      <div className="flex-shrink-0 text-right">
                        <span className="text-xs text-gray-400 font-mono">
                          {time}
                        </span>
                      </div>
                    </div>

                    {/* 展开内容 */}
                    {isExpanded && (
                      <div className="mx-2 px-3 py-3 bg-white/40 rounded-b-xl border-t border-gray-100">
                        <div
                          className="text-sm text-gray-600 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: entry.content }}
                        />
                        {/* AI 回复 */}
                        {entry.aiReply && (
                          <div className="mt-3 pl-3 border-l-2" style={{ borderColor: hexColor }}>
                            <p className="text-sm italic" style={{ color: hexColor }}>
                              <span className="not-italic mr-1">🤖</span>
                              {entry.aiReply}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 卡片模式 */}
          {viewMode === 'card' && groupedEntries.map(({ dateStr, entries: dayEntries }) => {
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
                            {entry.energyDelta !== undefined && (
                              <span
                                className="text-xs font-medium ml-auto"
                                style={{ color: entry.energyDelta >= 0 ? '#10b981' : '#f43f5e' }}
                              >
                                {entry.energyDelta >= 0 ? '+' : ''}{entry.energyDelta}分
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
