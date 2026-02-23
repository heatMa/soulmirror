import React, { useState, useMemo } from 'react';
import { DiaryEntry } from '../types';
import { MOOD_OPTIONS, MoodOption, getHexFromTailwind, ICONS } from '../constants';
import HeatmapChart from './HeatmapChart';
import MoodHistory from './MoodHistory';

interface Props {
  entries: DiaryEntry[];
  customMoods: MoodOption[];
}

type TimeRangeType = 'week' | 'month' | 'quarter' | 'custom';

const Statistics: React.FC<Props> = ({ entries, customMoods }) => {
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRangeType>('week');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // 合并所有心情配置
  const allMoods = useMemo(() => [...MOOD_OPTIONS, ...customMoods], [customMoods]);

  // 根据时间范围筛选条目
  const filteredEntriesByTime = useMemo(() => {
    const now = new Date();
    let startDate: Date | null = null;

    if (selectedTimeRange === 'custom') {
      if (customStartDate && customEndDate) {
        startDate = new Date(customStartDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(customEndDate);
        endDate.setHours(23, 59, 59, 999);
        return entries.filter(e => e.timestamp >= startDate!.getTime() && e.timestamp <= endDate.getTime());
      }
      return entries;
    }

    switch (selectedTimeRange) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        return entries;
    }

    return entries.filter(e => e.timestamp >= startDate!.getTime());
  }, [entries, selectedTimeRange, customStartDate, customEndDate]);

  // 心情统计
  const moodStats = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredEntriesByTime.forEach(entry => {
      stats[entry.mood] = (stats[entry.mood] || 0) + 1;
    });
    return Object.entries(stats)
      .map(([mood, count]) => ({
        mood,
        count,
        config: allMoods.find(m => m.label === mood)
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredEntriesByTime, allMoods]);

  // 根据心情和搜索关键词筛选的条目
  const filteredEntries = useMemo(() => {
    let result = filteredEntriesByTime;

    if (selectedMoodFilter) {
      result = result.filter(e => e.mood === selectedMoodFilter);
    }

    if (searchKeyword.trim()) {
      const keyword = searchKeyword.trim().toLowerCase();
      result = result.filter(e =>
        e.mood.toLowerCase().includes(keyword) ||
        e.content.toLowerCase().includes(keyword)
      );
    }

    return result.sort((a, b) => b.timestamp - a.timestamp);
  }, [filteredEntriesByTime, selectedMoodFilter, searchKeyword]);

  return (
    <div className="flex-1 px-4 pt-safe-top pb-24 overflow-y-auto no-scrollbar">
      {/* 标题 */}
      <div className="flex justify-between items-center mb-4 px-2">
        <h2 className="text-2xl font-bold text-gray-800 tracking-tight">情绪统计</h2>
      </div>

      {/* 时间范围选择器 */}
      <div className="mb-4 px-2">
        <div className="flex gap-2 mb-3">
          {[
            { key: 'week', label: '近7天' },
            { key: 'month', label: '近1月' },
            { key: 'quarter', label: '近3月' },
            { key: 'custom', label: '自定义...' },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setSelectedTimeRange(item.key as TimeRangeType)}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                selectedTimeRange === item.key
                  ? 'bg-gray-800 text-white shadow-lg'
                  : 'bg-white/50 text-gray-500 hover:bg-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* 自定义日期选择 */}
        {selectedTimeRange === 'custom' && (
          <div className="flex gap-2 items-center bg-white/50 rounded-xl p-3">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <span className="text-gray-400">至</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        )}
      </div>

      {/* 搜索框 */}
      <div className="mb-4 px-2">
        <div className="relative">
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="搜索心情或内容..."
            className="w-full px-4 py-2.5 pl-10 bg-white/80 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <ICONS.Search />
          </div>
        </div>
      </div>

      {/* 心情筛选 */}
      <div className="mb-4 px-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedMoodFilter(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              !selectedMoodFilter
                ? 'bg-gray-800 text-white'
                : 'bg-white/80 text-gray-500 hover:bg-white'
            }`}
          >
            全部
          </button>
          {allMoods.map((mood) => (
            <button
              key={mood.label}
              onClick={() => setSelectedMoodFilter(
                selectedMoodFilter === mood.label ? null : mood.label
              )}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                selectedMoodFilter === mood.label
                  ? 'text-white shadow-sm'
                  : 'bg-white/80 text-gray-500 hover:bg-white'
              }`}
              style={selectedMoodFilter === mood.label ? {
                backgroundColor: mood.hexColor || getHexFromTailwind(mood.color)
              } : undefined}
            >
              <span>{mood.emoji}</span>
              <span>{mood.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 记录日历（月历热力图） */}
      <div className="mb-4">
        <div className="glass-card rounded-[2rem] p-4">
          <h3 className="text-sm font-bold text-gray-600 mb-3 px-1">记录日历</h3>
          <HeatmapChart entries={filteredEntriesByTime} allMoods={allMoods} />
        </div>
      </div>

      {/* 心情分布 */}
      <div className="mb-4">
        <div className="glass-card rounded-[2rem] p-4">
          <h3 className="text-sm font-bold text-gray-600 mb-3 px-1">心情分布</h3>
          <div className="space-y-2">
            {moodStats.slice(0, 10).map((stat, index) => {
              const maxCount = moodStats[0]?.count || 1;
              const percentage = (stat.count / maxCount) * 100;
              const hexColor = stat.config?.hexColor || getHexFromTailwind(stat.config?.color || 'bg-gray-400');

              return (
                <button
                  key={stat.mood}
                  onClick={() => {
                    setSelectedMoodFilter(stat.mood);
                  }}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{stat.config?.emoji || '🏷️'}</span>
                    <span className="text-sm font-medium text-gray-700">{stat.mood}</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {stat.count}次 ({Math.round((stat.count / filteredEntriesByTime.length) * 100)}%)
                    </span>
                  </div>
                  <div className="ml-7 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: hexColor
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 记录列表 */}
      <MoodHistory
        entries={filteredEntries}
        allMoods={allMoods}
        selectedMood={selectedMoodFilter}
        timeRange={selectedTimeRange}
      />
    </div>
  );
};

export default Statistics;
