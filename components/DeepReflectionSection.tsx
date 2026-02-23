import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import { DiaryEntry } from '../types';
import { ICONS } from '../constants';
import { databaseService } from '../services/databaseService';
import { generateDailyDeepReflection } from '../services/geminiService';
import DailyNoteEditor from './DailyNoteEditor';

interface Props {
  selectedDate: Date;
  moodEntries: DiaryEntry[];
}

const DeepReflectionSection: React.FC<Props> = ({ selectedDate, moodEntries }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [journalContent, setJournalContent] = useState('');
  const [deepReflection, setDeepReflection] = useState('');
  const [deepReflectionSource, setDeepReflectionSource] = useState<'journal-only' | 'moods-only' | 'journal-with-moods'>('journal-only');
  const [isReflectionCollapsed, setIsReflectionCollapsed] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSourceDialog, setShowSourceDialog] = useState(false);
  const [error, setError] = useState('');
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const dateStr = selectedDate.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');

  // 判断是否有内容可以生成分析
  const hasJournal = journalContent.trim().length > 0;
  const hasMoods = moodEntries.length > 0;
  const hasAnyContent = hasJournal || hasMoods;

  // Load journal and deep reflection when date changes
  useEffect(() => {
    loadJournalData();
  }, [dateStr]);

  const loadJournalData = async () => {
    try {
      const note = await databaseService.getDailyNote(dateStr);
      if (note) {
        setJournalContent(note.content || '');
        setDeepReflection(note.deepReflection || '');
        setDeepReflectionSource(note.deepReflectionSource || 'journal-only');
        setIsReflectionCollapsed(true); // Always collapse when loading new date
      } else {
        setJournalContent('');
        setDeepReflection('');
        setDeepReflectionSource('journal-only');
      }
      setError('');
    } catch (err) {
      console.error('Failed to load journal:', err);
    }
  };

  const handleJournalSave = async (date: string, content: string) => {
    setJournalContent(content);

    // Auto-save with debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        await databaseService.saveDailyNote(date, content);
        // Clear deep reflection when journal content changes
        if (deepReflection) {
          await databaseService.clearDeepReflection(date);
          setDeepReflection('');
        }
      } catch (err) {
        console.error('Failed to save journal:', err);
      }
    }, 500);
  };

  const handleGenerateClick = () => {
    // 如果既没有日记也没有心情记录，不应该执行（按钮应该是disabled的）
    if (!hasAnyContent) {
      setError('请先记录今日心情或写日记');
      return;
    }

    // 新的弹窗逻辑：只要有任何内容就弹窗让用户选择
    setShowSourceDialog(true);
    setError('');
  };

  const handleGenerate = async (source: 'journal-only' | 'moods-only' | 'journal-with-moods') => {
    setShowSourceDialog(false);
    setIsGenerating(true);
    setError('');

    try {
      const result = await generateDailyDeepReflection(journalContent, moodEntries, source);
      setDeepReflection(result);
      setDeepReflectionSource(source);
      setIsReflectionCollapsed(true);

      // Save to database
      await databaseService.updateDeepReflection(dateStr, result, source);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '生成失败，请稍后重试';
      setError(errorMessage);
      console.error('Deep reflection generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const toggleReflectionCollapse = () => {
    setIsReflectionCollapsed(!isReflectionCollapsed);
  };

  const handleRegenerate = () => {
    // 重新生成时也弹窗选择
    setShowSourceDialog(true);
  };

  return (
    <div className="glass-card rounded-[32px] p-4 mb-4">
      {/* Header: 深度洞察 + 折叠按钮 */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={toggleExpanded}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📖</span>
          <h3 className="text-sm font-bold text-gray-700">深度洞察</h3>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : 'rotate-0'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* 日记编辑器（按钮已集成到编辑器内部） */}
          <DailyNoteEditor
            dateStr={dateStr}
            initialContent={journalContent}
            onSave={handleJournalSave}
            onGenerateClick={handleGenerateClick}
            isGenerating={isGenerating}
            hasDeepReflection={!!deepReflection}
            canGenerate={hasAnyContent}
          />

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* AI 深度回看结果卡片（折叠式） */}
          {deepReflection && (
            <div
              className="border-l-4 border-indigo-400 bg-indigo-50 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md"
              onClick={toggleReflectionCollapse}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-indigo-700">💡 AI洞察</span>
                <svg
                  className={`w-4 h-4 text-indigo-600 transition-transform duration-200 ${
                    isReflectionCollapsed ? 'rotate-180' : 'rotate-0'
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </div>

              {isReflectionCollapsed ? (
                // 预览前2-3行（纯文本，去掉Markdown符号）
                <p className="text-sm text-gray-700 line-clamp-3">
                  {deepReflection.replace(/[#*_`]/g, '').replace(/\n+/g, ' ')}
                </p>
              ) : (
                // 完整内容（Markdown渲染）
                <div className="space-y-3">
                  <div
                    className="prose prose-sm prose-indigo max-w-none text-gray-700 leading-relaxed
                      [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-indigo-800 [&_h3]:mt-3 [&_h3]:mb-2
                      [&_p]:text-sm [&_p]:my-2
                      [&_strong]:text-indigo-700
                      [&_ul]:my-2 [&_ul]:pl-4 [&_li]:text-sm [&_li]:my-1"
                    dangerouslySetInnerHTML={{ __html: marked.parse(deepReflection) as string }}
                  />
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRegenerate();
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-700 hover:underline font-semibold flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      重新生成
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Source Selection Dialog - 默认选中"日记+心情记录" */}
      {showSourceDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-lg animate-in slide-in-from-bottom-8">
            <h3 className="text-lg font-bold text-gray-800 mb-4">选择分析来源</h3>
            <div className="space-y-3">
              {/* 日记 + 心情记录（默认推荐） */}
              {hasJournal && hasMoods && (
                <button
                  onClick={() => handleGenerate('journal-with-moods')}
                  className="w-full p-4 border-2 border-indigo-400 bg-indigo-50 rounded-xl hover:border-indigo-600 transition-all text-left"
                >
                  <div className="font-semibold text-indigo-700">
                    📝+😊 日记 + 心情记录（推荐）
                  </div>
                  <div className="text-sm text-indigo-600 mt-1">
                    综合分析今天的 {moodEntries.length} 条心情记录和日记内容
                  </div>
                </button>
              )}

              {/* 仅日记 */}
              {hasJournal && (
                <button
                  onClick={() => handleGenerate('journal-only')}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all text-left"
                >
                  <div className="font-semibold text-gray-800">📝 仅日记</div>
                  <div className="text-sm text-gray-500 mt-1">只分析今天的日记内容</div>
                </button>
              )}

              {/* 仅心情记录 */}
              {hasMoods && (
                <button
                  onClick={() => handleGenerate('moods-only')}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all text-left"
                >
                  <div className="font-semibold text-gray-800">😊 仅心情记录</div>
                  <div className="text-sm text-gray-500 mt-1">分析今天 {moodEntries.length} 条心情的波动规律</div>
                </button>
              )}
            </div>

            {/* 取消按钮 */}
            <button
              onClick={() => setShowSourceDialog(false)}
              className="w-full mt-4 p-2.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors font-medium"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeepReflectionSection;
