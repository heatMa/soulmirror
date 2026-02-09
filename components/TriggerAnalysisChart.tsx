import React, { useState, useEffect, useMemo } from 'react';
import { DiaryEntry } from '../types';
import { analyzeTriggerFactors, TriggerAnalysis, TriggerFactor } from '../services/geminiService';

interface Props {
  entries: DiaryEntry[];  // 本周的日记条目
}

// 缓存 key 前缀
const CACHE_KEY_PREFIX = 'soulmirror_trigger_analysis_';

// 获取本周开始日期的字符串（用于缓存 key）
const getWeekStartKey = (): string => {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart.toISOString().split('T')[0];
};

// 根据趋势获取颜色
const getTrendColor = (trend: TriggerFactor['trend']): string => {
  switch (trend) {
    case 'positive':
      return '#10b981'; // 绿色
    case 'negative':
      return '#f43f5e'; // 红色
    case 'neutral':
    default:
      return '#f59e0b'; // 黄色
  }
};

// 根据趋势获取背景色
const getTrendBgColor = (trend: TriggerFactor['trend']): string => {
  switch (trend) {
    case 'positive':
      return '#d1fae5'; // 浅绿
    case 'negative':
      return '#ffe4e6'; // 浅红
    case 'neutral':
    default:
      return '#fef3c7'; // 浅黄
  }
};

const TriggerAnalysisChart: React.FC<Props> = ({ entries }) => {
  const [analysis, setAnalysis] = useState<TriggerAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取当前条目的哈希值（用于判断是否需要重新分析）
  const entriesHash = useMemo(() => {
    return entries.map(e => e.id).sort().join(',');
  }, [entries]);

  // 加载缓存或分析
  useEffect(() => {
    const loadAnalysis = async () => {
      const cacheKey = CACHE_KEY_PREFIX + getWeekStartKey();
      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          // 检查缓存是否对应当前的条目
          if (parsed.entriesHash === entriesHash && parsed.data) {
            setAnalysis(parsed.data);
            return;
          }
        } catch (e) {
          console.error('Failed to parse cached analysis:', e);
        }
      }

      // 如果没有缓存或缓存过期，且有足够的条目，则分析
      if (entries.length >= 3) {
        await runAnalysis();
      }
    };

    loadAnalysis();
  }, [entriesHash]);

  // 执行分析
  const runAnalysis = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await analyzeTriggerFactors(entries);
      setAnalysis(result);

      // 缓存结果
      const cacheKey = CACHE_KEY_PREFIX + getWeekStartKey();
      localStorage.setItem(cacheKey, JSON.stringify({
        data: result,
        entriesHash,
        cachedAt: Date.now()
      }));
    } catch (e) {
      setError('分析失败，请重试');
      console.error('Trigger analysis error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // 计算柱子最大高度的基准
  const maxCount = useMemo(() => {
    if (!analysis?.factors?.length) return 1;
    return Math.max(...analysis.factors.map(f => f.count), 1);
  }, [analysis]);

  // 条目不足时的提示
  if (entries.length < 3) {
    return (
      <div className="glass-card rounded-[2rem] p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-3">📊 情绪触发因素</h3>
        <div className="text-center py-6">
          <div className="text-3xl mb-2">📝</div>
          <p className="text-sm text-gray-500">
            本周记录 {entries.length} 条，再记录 {3 - entries.length} 条即可分析
          </p>
        </div>
      </div>
    );
  }

  // 加载中
  if (isLoading) {
    return (
      <div className="glass-card rounded-[2rem] p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-3">📊 情绪触发因素</h3>
        <div className="text-center py-6">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">AI 正在分析触发因素...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="glass-card rounded-[2rem] p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-3">📊 情绪触发因素</h3>
        <div className="text-center py-6">
          <div className="text-3xl mb-2">❌</div>
          <p className="text-sm text-gray-500 mb-3">{error}</p>
          <button
            onClick={runAnalysis}
            className="px-4 py-2 bg-gray-800 text-white text-xs rounded-lg"
          >
            重新分析
          </button>
        </div>
      </div>
    );
  }

  // 无分析结果时显示生成按钮
  if (!analysis || !analysis.factors?.length) {
    return (
      <div className="glass-card rounded-[2rem] p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-3">📊 情绪触发因素</h3>
        <div className="text-center py-6">
          <div className="text-3xl mb-2">🔍</div>
          <p className="text-sm text-gray-500 mb-3">分析哪类事件影响你的情绪</p>
          <button
            onClick={runAnalysis}
            className="px-4 py-2 bg-gray-800 text-white text-xs rounded-lg"
          >
            开始分析
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-[2rem] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-700">📊 情绪触发因素</h3>
        <button
          onClick={runAnalysis}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          🔄 刷新
        </button>
      </div>

      {/* 柱状图 */}
      <div className="flex items-end justify-around gap-2 h-32 mb-4 px-2">
        {analysis.factors.map((factor, index) => {
          const heightPercent = (factor.count / maxCount) * 100;
          const color = getTrendColor(factor.trend);

          return (
            <div
              key={index}
              className="flex flex-col items-center flex-1 max-w-[60px]"
            >
              {/* 分数标签 */}
              <div
                className="text-[10px] font-bold mb-1"
                style={{ color }}
              >
                {factor.avgScore.toFixed(1)}
              </div>

              {/* 柱子 */}
              <div
                className="w-full rounded-t-lg transition-all duration-500 min-h-[8px]"
                style={{
                  height: `${Math.max(heightPercent, 10)}%`,
                  backgroundColor: color
                }}
                title={`${factor.category}: ${factor.count}次, 平均${factor.avgScore.toFixed(1)}分`}
              />

              {/* 类别标签 */}
              <div className="mt-2 text-center">
                <div className="text-[10px] text-gray-600 font-medium truncate w-full">
                  {factor.category}
                </div>
                <div className="text-[9px] text-gray-400">
                  {factor.count}次
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 图例 */}
      <div className="flex justify-center gap-4 mb-3">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <span className="text-[10px] text-gray-500">高分(≥7)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-amber-500"></div>
          <span className="text-[10px] text-gray-500">中等(4-6)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-rose-500"></div>
          <span className="text-[10px] text-gray-500">低分(≤3)</span>
        </div>
      </div>

      {/* AI 洞察 */}
      {analysis.insight && (
        <div
          className="p-3 rounded-xl text-xs text-gray-600 leading-relaxed"
          style={{ backgroundColor: '#f8fafc' }}
        >
          💡 {analysis.insight}
        </div>
      )}
    </div>
  );
};

export default TriggerAnalysisChart;
