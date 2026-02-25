import React, { useState, useEffect, useCallback } from 'react';
import { DiaryEntry } from '../types';
import { generateAIDiary } from '../services/geminiService';
import { databaseService } from '../services/databaseService';

interface Props {
  date: Date;
  entries: DiaryEntry[];
  initialContent?: string;
  initialGeneratedAt?: number;
  onContentGenerated?: (content: string) => void;
}

export const AIDiaryCard: React.FC<Props> = ({
  date,
  entries,
  initialContent,
  initialGeneratedAt,
  onContentGenerated
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [content, setContent] = useState(initialContent || '');
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt);
  const [error, setError] = useState('');

  const dateStr = date.toISOString().split('T')[0];

  const handleGenerate = useCallback(async () => {
    if (entries.length === 0) {
      setError('暂无情绪记录，无法生成日记');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const result = await generateAIDiary(entries, dateStr);
      setContent(result);
      setGeneratedAt(Date.now());

      // 保存到数据库
      await databaseService.updateAIDiary(dateStr, result);

      onContentGenerated?.(result);
    } catch (err) {
      setError('生成失败，请稍后重试');
      console.error('AI日记生成失败:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [entries, dateStr, onContentGenerated]);

  const toggleExpand = () => {
    if (!isGenerating) {
      setIsExpanded(!isExpanded);
    }
  };

  // 如果没有内容且有条目，自动生成
  useEffect(() => {
    if (!content && entries.length > 0 && !isGenerating && !error) {
      // 检查是否是今天或昨天（早上7点后）
      const now = new Date();
      const entryDate = new Date(date);
      const isToday = entryDate.toDateString() === now.toDateString();
      const isYesterday = entryDate.getDate() === now.getDate() - 1;
      const isAfter7am = now.getHours() >= 7;

      if ((isToday && entries.length > 0) || (isYesterday && isAfter7am)) {
        handleGenerate();
      }
    }
  }, [content, entries, date, isGenerating, error, handleGenerate]);

  // 更新状态当props变化时
  useEffect(() => {
    setContent(initialContent || '');
    setGeneratedAt(initialGeneratedAt);
  }, [initialContent, initialGeneratedAt]);

  // 格式化生成时间
  const formattedTime = generatedAt
    ? new Date(generatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  // 简单的Markdown渲染（处理标题和列表）
  const renderMarkdown = (text: string): string => {
    return text
      .replace(/^## (.*$)/gim, '<h3 class="text-base font-semibold text-amber-700 mt-4 mb-2">$1</h3>')
      .replace(/^### (.*$)/gim, '<h4 class="text-sm font-semibold text-amber-600 mt-3 mb-1">$1</h4>')
      .replace(/^\* (.*$)/gim, '<li class="ml-4 text-sm text-gray-700 mb-1">$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li class="ml-4 text-sm text-gray-700 mb-1">$1</li>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-800">$1</strong>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className="glass-card rounded-[32px] p-4 mb-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 头部 - 始终可见 */}
      <div
        onClick={toggleExpand}
        className="flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">AI晨间日记</h3>
            {formattedTime && (
              <p className="text-xs text-gray-500">生成于 {formattedTime}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isGenerating && (
            <span className="text-xs text-amber-600 animate-pulse">生成中...</span>
          )}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* 折叠预览 - 收起时显示 */}
      {!isExpanded && content && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-sm text-gray-600 line-clamp-2">
            {content.replace(/[#*_`]/g, '').replace(/\n+/g, ' ')}
          </p>
        </div>
      )}

      {/* 展开内容 */}
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {error ? (
            <div className="text-center py-4">
              <p className="text-sm text-red-500 mb-3">{error}</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleGenerate();
                }}
                className="px-4 py-2 bg-amber-500 text-white rounded-full text-sm font-medium hover:bg-amber-600 transition-colors"
              >
                重新生成
              </button>
            </div>
          ) : content ? (
            <div
              className="prose prose-sm max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          ) : isGenerating ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">正在分析情绪记录...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <p className="text-sm">今天还没有情绪记录</p>
              <p className="text-xs mt-1">记录心情后，AI会为你生成日记</p>
            </div>
          ) : null}

          {/* 操作按钮 */}
          {content && !isGenerating && (
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleGenerate();
                }}
                className="px-3 py-1.5 text-xs text-amber-600 hover:bg-amber-50 rounded-full transition-colors"
              >
                重新生成
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIDiaryCard;
