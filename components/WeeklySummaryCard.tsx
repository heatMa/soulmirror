import React, { useState } from 'react';
import { DiaryEntry, WeeklySummary } from '../types';
import { generateWeeklySummary } from '../services/geminiService';
import { databaseService } from '../services/databaseService';

interface WeeklySummaryCardProps {
  weekKey: string;        // Format: '2025-W06'
  weekEntries: DiaryEntry[];
}

export const WeeklySummaryCard: React.FC<WeeklySummaryCardProps> = ({ weekKey, weekEntries }) => {
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // 加载已有的总结
  React.useEffect(() => {
    const loadExistingSummary = async () => {
      try {
        const existing = await databaseService.getWeeklySummary(weekKey);
        if (existing) {
          setSummary(existing);
        }
        setInitialized(true);
      } catch (err) {
        console.error('Failed to load existing summary:', err);
        setInitialized(true);
      }
    };

    loadExistingSummary();
  }, [weekKey]);

  // 生成新的总结
  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const content = await generateWeeklySummary(weekEntries);
      const newSummary: WeeklySummary = {
        weekKey,
        content,
        createdAt: Date.now()
      };

      await databaseService.saveWeeklySummary(newSummary);
      setSummary(newSummary);
    } catch (err) {
      console.error('Failed to generate summary:', err);
      setError(err instanceof Error ? err.message : '生成失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 复制内容
  const handleCopy = async () => {
    if (!summary) return;

    try {
      await navigator.clipboard.writeText(summary.content);
      alert('已复制到剪贴板');
    } catch (err) {
      console.error('Copy failed:', err);
      alert('复制失败');
    }
  };

  if (!initialized) {
    return null;
  }

  // 判断是否有足够的日记（至少3条）
  const hasEnoughEntries = weekEntries.length >= 3;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800">本周你经历了...</h3>
        {summary && (
          <button
            onClick={handleCopy}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            title="复制总结"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        )}
      </div>

      {!summary ? (
        <div className="text-center py-8">
          {!hasEnoughEntries ? (
            <div>
              <p className="text-gray-500 mb-4">本周记录过少，再多记录一些吧~</p>
              <button
                disabled
                className="px-6 py-3 bg-gray-300 text-gray-500 rounded-xl font-medium cursor-not-allowed"
              >
                生成本周总结
              </button>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-4">点击生成你的专属周记故事</p>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    生成中...
                  </span>
                ) : (
                  '生成本周总结'
                )}
              </button>
            </div>
          )}
          {error && (
            <p className="text-red-500 text-sm mt-4">{error}</p>
          )}
        </div>
      ) : (
        <div>
          <div className="prose prose-slate max-w-none">
            <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
              {summary.content}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-400">
            生成于 {new Date(summary.createdAt).toLocaleString('zh-CN')}
          </div>
        </div>
      )}
    </div>
  );
};
