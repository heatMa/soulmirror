
import React, { useState, useEffect, useRef } from 'react';
import { DiaryEntry } from '../types';
import { MOOD_OPTIONS, MoodOption, ICONS } from '../constants';
import { generateMoodMetadata } from '../services/geminiService';
import { databaseService } from '../services/databaseService';

interface Props {
  initialData?: DiaryEntry | null;
  onSave: (entry: Omit<DiaryEntry, 'id' | 'timestamp'> & { id?: string, timestamp?: number }) => void;
  onClose: () => void;
}

// 富文本颜色选项
const TEXT_COLORS = [
  { value: '#374151', label: '默认', borderClass: 'border-gray-700' },
  { value: '#64748b', label: '蓝灰', borderClass: 'border-slate-500' },
  { value: '#ef4444', label: '红色', borderClass: 'border-red-500' },
  { value: '#84cc16', label: '绿色', borderClass: 'border-lime-500' },
  { value: '#3b82f6', label: '蓝色', borderClass: 'border-blue-500' },
  { value: '#f97316', label: '橙色', borderClass: 'border-orange-500' },
  { value: '#8b5cf6', label: '紫色', borderClass: 'border-violet-500' },
];

const DiaryEntryForm: React.FC<Props> = ({ initialData, onSave, onClose }) => {
  const [selectedMood, setSelectedMood] = useState<MoodOption>(MOOD_OPTIONS[2]);
  const [customMoods, setCustomMoods] = useState<MoodOption[]>([]);
  const [newMoodInput, setNewMoodInput] = useState('');
  const [isAddingMood, setIsAddingMood] = useState(false);
  const [isGeneratingTag, setIsGeneratingTag] = useState(false);
  const [activeColor, setActiveColor] = useState<string>('#374151');
  const contentRef = useRef<HTMLDivElement>(null);

  // 初始化数据（如果是编辑模式）
  useEffect(() => {
    if (initialData) {
      // 设置富文本内容
      if (contentRef.current) {
        contentRef.current.innerHTML = initialData.content || '';
      }
      // 尝试查找匹配的心情，如果没有找到则创建一个临时的
      const allMoods = [...MOOD_OPTIONS, ...customMoods];
      const match = allMoods.find(m => m.label === initialData.mood);
      if (match) {
        setSelectedMood(match);
      } else {
        setSelectedMood({
            label: initialData.mood,
            value: initialData.mood,
            score: initialData.moodScore,
            emoji: '🏷️',
            color: 'bg-gray-400',
            shadow: 'shadow-gray-200',
            suggestions: []
        });
      }
    }
  }, [initialData, customMoods]);

  useEffect(() => {
    // 从数据库加载自定义心情
    databaseService.getCustomMoods()
      .then(setCustomMoods)
      .catch(e => console.error("Failed to load custom moods", e));
  }, []);

  const saveCustomMood = async (newMood: MoodOption) => {
    if (customMoods.some(m => m.label === newMood.label) || MOOD_OPTIONS.some(m => m.label === newMood.label)) {
      return;
    }
    try {
      await databaseService.saveCustomMood(newMood);
      const updated = [...customMoods, newMood];
      setCustomMoods(updated);
    } catch (e) {
      console.error("Failed to save custom mood", e);
    }
  };

  const deleteCustomMood = async (label: string) => {
    if (!confirm(`确定要删除心情「${label}」吗？\n\n删除后，使用该心情的历史记录不受影响。`)) {
      return;
    }
    try {
      await databaseService.deleteCustomMood(label);
      const updated = customMoods.filter(m => m.label !== label);
      setCustomMoods(updated);
      // 如果当前选中的是被删除的心情，切换到默认心情
      if (selectedMood.label === label) {
        setSelectedMood(MOOD_OPTIONS[0]);
      }
    } catch (e) {
      console.error("Failed to delete custom mood", e);
    }
  };

  const handleAddNewMood = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = newMoodInput.trim();
    if (!trimmed) return;

    setIsGeneratingTag(true);
    try {
      const metadata = await generateMoodMetadata(trimmed);
      const newMoodOption: MoodOption = {
        label: trimmed,
        value: trimmed,
        score: metadata.score || 5,
        emoji: metadata.emoji || '🏷️',
        color: metadata.color || 'bg-slate-400',
        shadow: `shadow-gray-200`,
        suggestions: []
      };

      saveCustomMood(newMoodOption);
      setSelectedMood(newMoodOption);
      setNewMoodInput('');
      setIsAddingMood(false);
    } catch (error) {
      console.error("Error adding mood", error);
    } finally {
      setIsGeneratingTag(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const content = contentRef.current?.innerHTML || '';
    if (!content.trim() || content === '<br>') return;

    onSave({
      id: initialData?.id,
      timestamp: initialData?.timestamp,
      content,
      mood: selectedMood.label,
      moodScore: selectedMood.score,
      moodEmoji: selectedMood.emoji,
      tags: [selectedMood.label]
    });

    onClose();
  };

  // 富文本命令执行
  const executeCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (contentRef.current) {
      contentRef.current.focus();
    }
    if (command === 'foreColor' && value) {
      setActiveColor(value);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div 
        className="absolute inset-0 bg-gray-900/30 backdrop-blur-[2px] transition-opacity" 
        onClick={onClose}
      ></div>

      <div className="bg-white/95 backdrop-blur-xl w-full rounded-t-[2.5rem] sm:rounded-[2.5rem] sm:max-w-lg shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] overflow-hidden animate-in slide-in-from-bottom duration-500 z-10 flex flex-col h-[92vh] sm:h-[85vh]">
        
        <div className="p-6 flex justify-between items-center sticky top-0 z-20 bg-white/50 backdrop-blur-sm">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{initialData ? '修改日记' : '此刻的心情'}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{initialData ? '记忆是可以被重新书写的' : '诚实面对自己的内心'}</p>
          </div>
          <button onClick={onClose} className="p-2.5 bg-gray-100/50 rounded-full text-gray-500 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 pb-6 space-y-8">
          
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {MOOD_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setSelectedMood(m)}
                  className={`px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all duration-300 border ${
                    selectedMood.label === m.label
                      ? `bg-gray-800 border-gray-800 text-white shadow-lg shadow-gray-200 transform scale-105`
                      : 'bg-white border-white text-gray-500 hover:bg-white/80 shadow-sm'
                  }`}
                >
                  <span className="text-base">{m.emoji}</span>
                  <span className="text-xs font-bold">{m.label}</span>
                </button>
              ))}

              {customMoods.map((m) => (
                <div key={m.value} className="relative group">
                  <button
                    type="button"
                    onClick={() => setSelectedMood(m)}
                    className={`px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all duration-300 border ${
                      selectedMood.label === m.label
                        ? `bg-gray-800 border-gray-800 text-white shadow-lg shadow-gray-200 transform scale-105`
                        : 'bg-white border-white text-gray-500 hover:bg-white/80 shadow-sm'
                    }`}
                  >
                    <span className="text-base">{m.emoji}</span>
                    <span className="text-xs font-bold">{m.label}</span>
                  </button>
                  {/* 删除按钮 */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCustomMood(m.label);
                    }}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-rose-600"
                    title={`删除「${m.label}」`}
                  >
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}

              {!isAddingMood ? (
                <button
                  type="button"
                  onClick={() => setIsAddingMood(true)}
                  className="px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500"
                >
                  <span className="text-base">+</span>
                  <span className="text-xs font-medium">自定义</span>
                </button>
              ) : (
                <div className="flex flex-col gap-2 w-full animate-in fade-in bg-white p-3 rounded-2xl shadow-sm border border-indigo-100">
                  <input
                    autoFocus
                    type="text"
                    value={newMoodInput}
                    onChange={(e) => setNewMoodInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNewMood()}
                    placeholder="输入心情关键词..."
                    disabled={isGeneratingTag}
                    className="w-full px-3 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="button"
                    onClick={handleAddNewMood}
                    disabled={isGeneratingTag}
                    className="w-full py-2 bg-gray-900 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                  >
                    {isGeneratingTag ? 'AI 生成中...' : '确认添加'}
                  </button>
                </div>
              )}
            </div>
            {isGeneratingTag && <p className="text-xs text-center text-gray-400 animate-pulse">正在为您定制专属情绪色彩...</p>}
          </div>

          <div className="space-y-3">
            {/* 富文本工具栏 */}
            <div className="flex items-center justify-between bg-white/60 rounded-2xl px-3 py-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); executeCommand('undo'); }}
                  className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                  title="撤销"
                >
                  <ICONS.Undo />
                </button>
                <div className="w-[1px] h-4 bg-gray-200 mx-1"></div>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); executeCommand('bold'); }}
                  className="p-1.5 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  title="加粗"
                >
                  <ICONS.Bold />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); executeCommand('italic'); }}
                  className="p-1.5 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  title="斜体"
                >
                  <ICONS.Italic />
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); executeCommand('insertUnorderedList'); }}
                  className="p-1.5 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  title="列表"
                >
                  <ICONS.List />
                </button>
              </div>

              {/* 颜色选择 */}
              <div className="flex items-center gap-2">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      executeCommand('foreColor', color.value);
                    }}
                    className={`w-5 h-5 rounded-full border-2 bg-white flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 ${color.borderClass} ${activeColor === color.value ? 'ring-2 ring-offset-1 ring-gray-200' : ''}`}
                    title={color.label}
                  >
                    {activeColor === color.value && (
                      <div className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: color.value}}></div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 富文本编辑区域 */}
            <div
              ref={contentRef}
              contentEditable
              className="w-full h-64 p-5 bg-white rounded-3xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.03)] focus:shadow-[inset_0_2px_15px_rgba(0,0,0,0.05)] transition-all text-gray-700 text-[15px] leading-7 outline-none overflow-y-auto empty:before:content-[attr(data-placeholder)] empty:before:text-gray-300"
              data-placeholder="在这里写下你的思绪，无论是开心还是难过，我都会倾听..."
              style={{ whiteSpace: 'pre-wrap' }}
            />
          </div>
        </form>

        <div className="p-6 bg-white/50 backdrop-blur-md pb-safe-bottom">
          <button
            onClick={handleSubmit}
            className={`w-full py-4 font-bold rounded-2xl shadow-lg shadow-indigo-200/50 transition-all active:scale-95 text-lg flex items-center justify-center gap-2 text-white bg-gray-900 hover:bg-black`}
          >
            {initialData ? '保存修改' : '记录这一刻'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiaryEntryForm;
