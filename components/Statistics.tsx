import React, { useState, useMemo, useEffect } from 'react';
import { DiaryEntry } from '../types';
import { MOOD_OPTIONS, MoodOption, getHexFromTailwind, ICONS } from '../constants';
import HeatmapChart from './HeatmapChart';
import MoodHistory from './MoodHistory';
import MoodHourlyDistribution from './MoodHourlyDistribution';
import TriggerAnalysisChart from './TriggerAnalysisChart';
import { WeeklySummaryCard } from './WeeklySummaryCard';
import { generateWeeklyReport, WeeklyReport, DailySummary } from '../services/geminiService';

interface Props {
  entries: DiaryEntry[];
  customMoods: MoodOption[];
}

// 时间段定义
const TIME_PERIODS = [
  { label: '凌晨', range: [0, 6], emoji: '🌙' },
  { label: '早晨', range: [6, 9], emoji: '🌅' },
  { label: '上午', range: [9, 12], emoji: '☀️' },
  { label: '中午', range: [12, 14], emoji: '🌞' },
  { label: '下午', range: [14, 18], emoji: '🌤️' },
  { label: '傍晚', range: [18, 21], emoji: '🌇' },
  { label: '深夜', range: [21, 24], emoji: '🌃' },
];

type ViewType = 'overview' | 'history' | 'report';

const Statistics: React.FC<Props> = ({ entries, customMoods }) => {
  const [activeView, setActiveView] = useState<ViewType>('overview');
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'week' | 'month' | 'all'>('week');

  // 合并所有心情配置
  const allMoods = useMemo(() => [...MOOD_OPTIONS, ...customMoods], [customMoods]);

  // 根据时间范围筛选条目
  const filteredEntriesByTime = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    switch (selectedTimeRange) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
      default:
        return entries;
    }

    return entries.filter(e => e.timestamp >= startDate.getTime());
  }, [entries, selectedTimeRange]);

  // 统计每个时间段的主要情绪
  const timePeriodStats = useMemo(() => {
    const stats: Record<string, Record<string, number>> = {};

    TIME_PERIODS.forEach(period => {
      stats[period.label] = {};
    });

    filteredEntriesByTime.forEach(entry => {
      const hour = new Date(entry.timestamp).getHours();
      const period = TIME_PERIODS.find(p => hour >= p.range[0] && hour < p.range[1]);
      if (period) {
        stats[period.label][entry.mood] = (stats[period.label][entry.mood] || 0) + 1;
      }
    });

    // 找出每个时间段的主要情绪
    return TIME_PERIODS.map(period => {
      const moodCounts = stats[period.label];
      const sortedMoods = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]);
      const topMood = sortedMoods[0];
      const moodConfig = topMood ? allMoods.find(m => m.label === topMood[0]) : null;

      return {
        ...period,
        topMood: topMood ? topMood[0] : null,
        count: topMood ? topMood[1] : 0,
        moodConfig,
        allMoods: sortedMoods.slice(0, 3)
      };
    });
  }, [filteredEntriesByTime, allMoods]);

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

  // 根据心情筛选的条目
  const filteredEntries = useMemo(() => {
    let result = entries;

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
  }, [entries, selectedMoodFilter, searchKeyword]);

  // 获取 AI 周报
  const handleGenerateReport = async () => {
    setIsLoadingReport(true);
    try {
      const report = await generateWeeklyReport(weekEntries);
      setWeeklyReport(report);
    } catch (error) {
      console.error('生成周报失败:', error);
    } finally {
      setIsLoadingReport(false);
    }
  };

  // 获取当前周的 weekKey (格式: '2025-W06')
  const getWeekKey = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const diff = now.getTime() - startOfYear.getTime();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const weekNumber = Math.floor(diff / oneWeek) + 1;
    return `${currentYear}-W${String(weekNumber).padStart(2, '0')}`;
  };

  // 获取本周的日记条目
  const weekEntries = useMemo(() => {
    return entries.filter(e =>
      e.timestamp >= Date.now() - 7 * 24 * 60 * 60 * 1000
    );
  }, [entries]);

  return (
    <div className="flex-1 px-4 pt-safe-top pb-24 overflow-y-auto no-scrollbar">
      {/* 标题 */}
      <div className="flex justify-between items-center mb-4 px-2">
        <h2 className="text-2xl font-bold text-gray-800 tracking-tight">情绪统计</h2>
        <div className="flex gap-2">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value as 'week' | 'month' | 'all')}
            className="px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100"
          >
            <option value="week">近7天</option>
            <option value="month">近30天</option>
            <option value="all">全部</option>
          </select>
        </div>
      </div>

      {/* 视图切换 */}
      <div className="flex gap-2 mb-4 px-2">
        {[
          { key: 'overview', label: '总览', icon: '📊' },
          { key: 'history', label: '历史', icon: '📅' },
          { key: 'report', label: '周报', icon: '🤖' },
        ].map(item => (
          <button
            key={item.key}
            onClick={() => setActiveView(item.key as ViewType)}
            className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
              activeView === item.key
                ? 'bg-gray-800 text-white shadow-lg'
                : 'bg-white/50 text-gray-500 hover:bg-white'
            }`}
          >
            <span className="mr-1">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {/* 总览视图 */}
      {activeView === 'overview' && (
        <div className="space-y-4">
          {/* 热力图 */}
          <div className="glass-card rounded-[2rem] p-4">
            <h3 className="text-sm font-bold text-gray-600 mb-3 px-1">情绪热力图</h3>
            <HeatmapChart entries={filteredEntriesByTime} allMoods={allMoods} />
          </div>

          {/* 心情时段分布 */}
          <div className="glass-card rounded-[2rem] p-4">
            <h3 className="text-sm font-bold text-gray-600 mb-3 px-1">心情时段分布</h3>
            <MoodHourlyDistribution entries={filteredEntriesByTime} allMoods={allMoods} />
          </div>

          {/* 时间段主题色 */}
          <div className="glass-card rounded-[2rem] p-4">
            <h3 className="text-sm font-bold text-gray-600 mb-3 px-1">时间段情绪主色调</h3>
            <div className="grid grid-cols-2 gap-2">
              {timePeriodStats.map((period) => (
                <div
                  key={period.label}
                  className="p-3 rounded-xl transition-all"
                  style={{
                    backgroundColor: period.moodConfig
                      ? `${period.moodConfig.hexColor || getHexFromTailwind(period.moodConfig.color)}15`
                      : '#f1f5f9'
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{period.emoji}</span>
                    <span className="text-xs font-bold text-gray-600">{period.label}</span>
                    <span className="text-[10px] text-gray-400">{period.range[0]}:00-{period.range[1]}:00</span>
                  </div>
                  {period.topMood ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{period.moodConfig?.emoji || '🏷️'}</span>
                      <span
                        className="text-xs font-bold"
                        style={{
                          color: period.moodConfig?.hexColor || getHexFromTailwind(period.moodConfig?.color || 'bg-gray-400')
                        }}
                      >
                        {period.topMood}
                      </span>
                      <span className="text-[10px] text-gray-400">×{period.count}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">暂无数据</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 心情排行 */}
          <div className="glass-card rounded-[2rem] p-4">
            <h3 className="text-sm font-bold text-gray-600 mb-3 px-1">心情频次排行</h3>
            <div className="space-y-2">
              {moodStats.slice(0, 5).map((stat, index) => {
                const maxCount = moodStats[0]?.count || 1;
                const percentage = (stat.count / maxCount) * 100;
                const hexColor = stat.config?.hexColor || getHexFromTailwind(stat.config?.color || 'bg-gray-400');

                return (
                  <button
                    key={stat.mood}
                    onClick={() => {
                      setSelectedMoodFilter(stat.mood);
                      setActiveView('history');
                    }}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-5 text-center text-xs font-bold text-gray-400">
                        {index + 1}
                      </span>
                      <span className="text-base">{stat.config?.emoji || '🏷️'}</span>
                      <span className="text-sm font-medium text-gray-700">{stat.mood}</span>
                      <span className="text-xs text-gray-400 ml-auto">{stat.count}次</span>
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
      )}

      {/* 历史视图 */}
      {activeView === 'history' && (
        <div className="space-y-4">
          {/* 搜索和筛选 */}
          <div className="glass-card rounded-[2rem] p-4">
            {/* 搜索框 */}
            <div className="relative mb-3">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="搜索心情或内容..."
                className="w-full px-4 py-2.5 pl-10 bg-gray-50 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <ICONS.Search />
              </div>
            </div>

            {/* 心情标签筛选 */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedMoodFilter(null)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  !selectedMoodFilter
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
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
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                    selectedMoodFilter === mood.label
                      ? 'text-white shadow-sm'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
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

          {/* 历史记录组件 */}
          <MoodHistory
            entries={filteredEntries}
            allMoods={allMoods}
            selectedMood={selectedMoodFilter}
            timeRange={selectedTimeRange}
          />
        </div>
      )}

      {/* 周报视图 */}
      {activeView === 'report' && (
        <div className="space-y-4">
          {/* 情绪触发因素分析 - 放在周报最上方 */}
          <TriggerAnalysisChart entries={entries.filter(e =>
            e.timestamp >= Date.now() - 7 * 24 * 60 * 60 * 1000
          )} />

          {/* 本周叙事性总结 */}
          <WeeklySummaryCard weekKey={getWeekKey()} weekEntries={weekEntries} />

          {!weeklyReport && !isLoadingReport && (
            <div className="glass-card rounded-[2rem] p-6 text-center">
              <div className="text-5xl mb-4">🤖</div>
              <h3 className="text-lg font-bold text-gray-700 mb-2">AI 情绪周报</h3>
              <p className="text-sm text-gray-500 mb-4">
                分析过去一周的情绪数据，找出负面情绪高发时段，提供针对性建议
              </p>
              <button
                onClick={handleGenerateReport}
                className="px-6 py-3 bg-gray-800 text-white rounded-xl font-medium hover:bg-gray-900 transition-colors"
              >
                生成周报
              </button>
            </div>
          )}

          {isLoadingReport && (
            <div className="glass-card rounded-[2rem] p-6 text-center">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500">AI 正在分析您的情绪数据...</p>
            </div>
          )}

          {weeklyReport && (
            <div className="space-y-4">
              {/* 概览卡片 */}
              <div className="glass-card rounded-[2rem] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{weeklyReport.overallEmoji}</span>
                  <div>
                    <h3 className="text-sm font-bold text-gray-700">本周情绪概览</h3>
                    <p className="text-xs text-gray-500">{weeklyReport.period}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{weeklyReport.summary}</p>
              </div>

              {/* 每日一词总结 */}
              {weeklyReport.dailySummaries && weeklyReport.dailySummaries.length > 0 && (
                <div className="glass-card rounded-[2rem] p-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-3">📝 每日一词</h3>
                  <div className="space-y-2">
                    {weeklyReport.dailySummaries.map((day, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                      >
                        <span className="text-xl">{day.emoji}</span>
                        <span className="text-base font-bold text-gray-700 min-w-[60px]">{day.keyword}</span>
                        <span className="text-xs text-gray-400 flex-1">{day.date}</span>
                        <span className="text-xs text-gray-400 font-mono">{day.avgScore.toFixed(1)}分</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 负面情绪高发时段 */}
              {weeklyReport.negativePeaks && weeklyReport.negativePeaks.length > 0 && (
                <div className="glass-card rounded-[2rem] p-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-3">⚠️ 负面情绪高发时段</h3>
                  <div className="space-y-2">
                    {weeklyReport.negativePeaks.map((peak, index) => (
                      <div
                        key={index}
                        className="p-3 bg-rose-50 rounded-xl"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-rose-600">{peak.period}</span>
                          <span className="text-xs text-rose-400">{peak.frequency}次</span>
                        </div>
                        <p className="text-xs text-rose-500">{peak.commonMoods.join('、')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 建议 */}
              {weeklyReport.suggestions && weeklyReport.suggestions.length > 0 && (
                <div className="glass-card rounded-[2rem] p-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-3">💡 针对性建议</h3>
                  <div className="space-y-2">
                    {weeklyReport.suggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="p-3 bg-emerald-50 rounded-xl"
                      >
                        <p className="text-sm text-emerald-700">{suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 重新生成 */}
              <button
                onClick={handleGenerateReport}
                className="w-full py-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                🔄 重新生成周报
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Statistics;
