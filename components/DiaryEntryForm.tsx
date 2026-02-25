
import React, { useState, useEffect, useRef } from 'react';
import { DiaryEntry } from '../types';
import { MOOD_OPTIONS, MoodOption, ICONS, MOOD_COLOR_PALETTE, getHexFromTailwind, getEffectiveCustomMoods } from '../constants';
import { generateMoodMetadata } from '../services/geminiService';
import { databaseService } from '../services/databaseService';
import { formatDuration, parseDurationInput, calculateDurationInMinutes } from '../utils/timeUtils';

interface Props {
  initialData?: DiaryEntry | null;
  onSave: (entry: Omit<DiaryEntry, 'id' | 'timestamp'> & { id?: string, timestamp?: number }) => void;
  onClose: () => void;
  customMoods?: MoodOption[]; // 从父组件传入的自定义心情
  onCustomMoodsChange?: (moods: MoodOption[]) => void; // 自定义心情变化时的回调
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

const DiaryEntryForm: React.FC<Props> = ({ initialData, onSave, onClose, customMoods: propCustomMoods, onCustomMoodsChange }) => {
  const [selectedMood, setSelectedMood] = useState<MoodOption>(MOOD_OPTIONS[2]);
  const [internalCustomMoods, setInternalCustomMoods] = useState<MoodOption[]>([]);
  
  // 优先使用 props 传入的自定义心情
  const customMoods = propCustomMoods ?? internalCustomMoods;
  const [builtinMoodOverrides, setBuiltinMoodOverrides] = useState<Record<string, Partial<MoodOption>>>({});
  const [newMoodInput, setNewMoodInput] = useState('');
  const [isAddingMood, setIsAddingMood] = useState(false);
  const [isGeneratingTag, setIsGeneratingTag] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const [activeColor, setActiveColor] = useState<string>('#374151');
  const [durationInput, setDurationInput] = useState<string>(''); // 持续时间输入
  const [isActive, setIsActive] = useState(false); // 是否进行中
  const [entryTime, setEntryTime] = useState<string>(''); // 记录时间 (HH:MM)
  const contentRef = useRef<HTMLDivElement>(null);

  // 获取合并了自定义配置的内置心情列表
  const getMergedBuiltinMoods = (): MoodOption[] => {
    return MOOD_OPTIONS.map(m => ({
      ...m,
      ...builtinMoodOverrides[m.label]
    }));
  };

  // 加载内置心情的自定义配置
  useEffect(() => {
    try {
      const stored = localStorage.getItem('soulmirror_builtin_mood_overrides');
      if (stored) {
        setBuiltinMoodOverrides(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load builtin mood overrides', e);
    }
  }, []);

  // 保存内置心情的自定义配置
  const saveBuiltinMoodOverride = (label: string, override: Partial<MoodOption>) => {
    const updated = {
      ...builtinMoodOverrides,
      [label]: {
        ...builtinMoodOverrides[label],
        ...override
      }
    };
    setBuiltinMoodOverrides(updated);
    try {
      localStorage.setItem('soulmirror_builtin_mood_overrides', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save builtin mood overrides', e);
    }
  };

  // 初始化数据（如果是编辑模式）
  useEffect(() => {
    if (initialData) {
      // 设置富文本内容
      if (contentRef.current) {
        contentRef.current.innerHTML = initialData.content || '';
      }
      // 尝试查找匹配的心情（自定义优先于默认），如果没有找到则创建一个临时的
      const allMoods = [...getEffectiveCustomMoods(customMoods), ...MOOD_OPTIONS];
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

      // 初始化持续时间
      if (initialData.endTimestamp) {
        const minutes = calculateDurationInMinutes(initialData.timestamp, initialData.endTimestamp);
        setDurationInput(formatDuration(minutes));
      } else if (initialData.duration) {
        setDurationInput(formatDuration(initialData.duration));
      }

      // 初始化进行中状态
      setIsActive(initialData.isActive || false);

      // 初始化记录时间
      const date = new Date(initialData.timestamp);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      setEntryTime(`${hours}:${minutes}`);
    } else {
      // 新建模式：默认使用当前时间
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setEntryTime(`${hours}:${minutes}`);
    }
  }, [initialData, customMoods]);

  useEffect(() => {
    // 如果传入了 prop，不需要内部加载
    if (propCustomMoods) return;
    
    // 从数据库加载自定义心情
    databaseService.getCustomMoods()
      .then(setInternalCustomMoods)
      .catch(e => console.error("Failed to load custom moods", e));
  }, [propCustomMoods]);

  const saveCustomMood = async (newMood: MoodOption) => {
    if (customMoods.some(m => m.label === newMood.label) || MOOD_OPTIONS.some(m => m.label === newMood.label)) {
      return;
    }
    try {
      await databaseService.saveCustomMood(newMood);
      const updated = [...customMoods, newMood];
      setInternalCustomMoods(updated);
      // 通知父组件更新状态，确保 UI 立即刷新
      onCustomMoodsChange?.(updated);
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
      setInternalCustomMoods(updated);
      // 通知父组件更新状态，确保 UI 立即刷新
      onCustomMoodsChange?.(updated);
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
      // 确保 score 是有效的数字，且使用 V2 能量系统（-10 到 +10）
      let score = metadata.score ?? 0;
      // 校正：如果 AI 错误地返回了正值用于负面情绪，强制转换为负值
      if (score > 0 && score <= 10) {
        // 检查是否应该是负面情绪（简单启发式：如果元数据显示负面颜色）
        const isNegativeColor = metadata.color?.includes('rose') ||
                               metadata.color?.includes('red') ||
                               metadata.color?.includes('purple') ||
                               metadata.color?.includes('amber') ||
                               metadata.color?.includes('orange');
        if (isNegativeColor) {
          console.warn(`[DiaryEntryForm] 检测到负面情绪 "${trimmed}" 使用了正分 ${score}，强制转换为负值`);
          score = -Math.abs(score);
        }
      }
      
      const newMoodOption: MoodOption = {
        label: trimmed,
        value: trimmed,
        score: score,
        emoji: metadata.emoji || '🏷️',
        color: metadata.color || 'bg-slate-400',
        hexColor: metadata.hexColor || '#94a3b8',
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

  // 换一换：重新生成心情元数据
  const handleRegenerateMood = async (mood: MoodOption) => {
    setIsRegenerating(true);
    try {
      const metadata = await generateMoodMetadata(mood.label);
      const override = {
        emoji: metadata.emoji || mood.emoji,
        hexColor: metadata.hexColor || mood.hexColor || getHexFromTailwind(mood.color),
        score: metadata.score !== undefined ? metadata.score : mood.score
      };

      const updatedMood: MoodOption = {
        ...mood,
        ...override
      };

      // 判断是内置心情还是自定义心情
      const isBuiltin = MOOD_OPTIONS.some(m => m.label === mood.label);
      if (isBuiltin) {
        saveBuiltinMoodOverride(mood.label, override);
      } else {
        await databaseService.saveCustomMood(updatedMood);
        const updated = customMoods.map(m => m.label === mood.label ? updatedMood : m);
        setInternalCustomMoods(updated);
      }

      setSelectedMood(updatedMood);
    } catch (error) {
      console.error("Error regenerating mood", error);
    } finally {
      setIsRegenerating(false);
    }
  };

  // 更新心情的颜色
  const handleUpdateMoodColor = async (mood: MoodOption, hexColor: string) => {
    const updatedMood: MoodOption = {
      ...mood,
      hexColor: hexColor
    };

    // 判断是内置心情还是自定义心情
    const isBuiltin = MOOD_OPTIONS.some(m => m.label === mood.label);
    if (isBuiltin) {
      saveBuiltinMoodOverride(mood.label, { hexColor });
    } else {
      await databaseService.saveCustomMood(updatedMood);
      const updated = customMoods.map(m => m.label === mood.label ? updatedMood : m);
      setInternalCustomMoods(updated);
    }

    setSelectedMood(updatedMood);
    setShowColorPicker(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const content = contentRef.current?.innerHTML || '';
    if (!content.trim() || content === '<br>') return;

    // 解析持续时间
    let duration: number | undefined;
    if (durationInput.trim()) {
      const parsed = parseDurationInput(durationInput);
      if (parsed === null) {
        alert('请输入有效的持续时间（如"2小时30分"、"1小时"或"45分钟"）');
        return;
      }
      duration = parsed;
    }

    // 解析记录时间 (HH:MM)
    let entryHours = new Date().getHours();
    let entryMinutes = new Date().getMinutes();
    if (entryTime) {
      const [h, m] = entryTime.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        entryHours = h;
        entryMinutes = m;
      }
    }

    onSave({
      id: initialData?.id,
      timestamp: initialData?.timestamp,
      content,
      mood: selectedMood.label,
      moodScore: selectedMood.score,
      moodEmoji: selectedMood.emoji,
      moodHexColor: selectedMood.hexColor || getHexFromTailwind(selectedMood.color),
      tags: [selectedMood.label],
      duration: duration,
      isActive: isActive,
      // 手动填写持续时间时优先使用 duration，不保留 endTimestamp
      endTimestamp: duration ? undefined : initialData?.endTimestamp,
      // 传递用户选择的时间（时分）
      entryHours,
      entryMinutes,
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
              {getMergedBuiltinMoods().map((m) => (
                <div key={m.value} className="relative group">
                  <button
                    type="button"
                    onClick={() => setSelectedMood(m)}
                    className={`px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all duration-300 border ${
                      selectedMood.label === m.label
                        ? `text-white shadow-lg shadow-gray-200 transform scale-105`
                        : 'bg-white border-white text-gray-500 hover:bg-white/80 shadow-sm'
                    }`}
                    style={selectedMood.label === m.label && m.hexColor ? {
                      backgroundColor: m.hexColor,
                      borderColor: m.hexColor
                    } : undefined}
                  >
                    <span className="text-base">{m.emoji}</span>
                    <span className="text-xs font-bold">{m.label}</span>
                    {m.hexColor && (
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-white/50"
                        style={{ backgroundColor: m.hexColor }}
                      />
                    )}
                  </button>
                  {/* 操作按钮组 */}
                  <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* 换一换按钮 */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRegenerateMood(m);
                      }}
                      disabled={isRegenerating}
                      className="w-4 h-4 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-indigo-600 disabled:opacity-50"
                      title="换一换"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    {/* 颜色选择按钮 */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowColorPicker(showColorPicker === m.label ? null : m.label);
                      }}
                      className="w-4 h-4 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-amber-600"
                      title="自定义颜色"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-white"
                        style={{ backgroundColor: m.hexColor || getHexFromTailwind(m.color) }}
                      />
                    </button>
                  </div>
                  {/* 颜色选择器弹出框 */}
                  {showColorPicker === m.label && (
                    <div className="absolute top-full left-0 mt-2 p-2 bg-white rounded-xl shadow-lg border border-gray-100 z-20 animate-in fade-in">
                      <div className="grid grid-cols-6 gap-1.5">
                        {MOOD_COLOR_PALETTE.map((color) => (
                          <button
                            key={color.hex}
                            type="button"
                            onClick={() => handleUpdateMoodColor(m, color.hex)}
                            className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
                              m.hexColor === color.hex ? 'ring-2 ring-offset-1 ring-gray-400' : ''
                            }`}
                            style={{ backgroundColor: color.hex }}
                            title={color.name}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {getEffectiveCustomMoods(customMoods).map((m) => (
                <div key={m.value} className="relative group">
                  <button
                    type="button"
                    onClick={() => setSelectedMood(m)}
                    className={`px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all duration-300 border ${
                      selectedMood.label === m.label
                        ? `bg-gray-800 border-gray-800 text-white shadow-lg shadow-gray-200 transform scale-105`
                        : 'bg-white border-white text-gray-500 hover:bg-white/80 shadow-sm'
                    }`}
                    style={selectedMood.label === m.label && m.hexColor ? {
                      backgroundColor: m.hexColor,
                      borderColor: m.hexColor
                    } : undefined}
                  >
                    <span className="text-base">{m.emoji}</span>
                    <span className="text-xs font-bold">{m.label}</span>
                    {m.hexColor && (
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-white/50"
                        style={{ backgroundColor: m.hexColor }}
                      />
                    )}
                  </button>
                  {/* 操作按钮组 */}
                  <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* 换一换按钮 */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRegenerateMood(m);
                      }}
                      disabled={isRegenerating}
                      className="w-4 h-4 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-indigo-600 disabled:opacity-50"
                      title="换一换"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                    {/* 颜色选择按钮 */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowColorPicker(showColorPicker === m.label ? null : m.label);
                      }}
                      className="w-4 h-4 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-amber-600"
                      title="自定义颜色"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-white"
                        style={{ backgroundColor: m.hexColor || getHexFromTailwind(m.color) }}
                      />
                    </button>
                    {/* 删除按钮 */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCustomMood(m.label);
                      }}
                      className="w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-rose-600"
                      title={`删除「${m.label}」`}
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {/* 颜色选择器弹出框 */}
                  {showColorPicker === m.label && (
                    <div className="absolute top-full left-0 mt-2 p-2 bg-white rounded-xl shadow-lg border border-gray-100 z-20 animate-in fade-in">
                      <div className="grid grid-cols-6 gap-1.5">
                        {MOOD_COLOR_PALETTE.map((color) => (
                          <button
                            key={color.hex}
                            type="button"
                            onClick={() => handleUpdateMoodColor(m, color.hex)}
                            className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
                              m.hexColor === color.hex ? 'ring-2 ring-offset-1 ring-gray-400' : ''
                            }`}
                            style={{ backgroundColor: color.hex }}
                            title={color.name}
                          />
                        ))}
                      </div>
                    </div>
                  )}
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
            {isRegenerating && <p className="text-xs text-center text-indigo-400 animate-pulse">正在重新生成...</p>}
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

            {/* 持续时间输入 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600 block">⏱️ 持续时间（可选）</label>
              <input
                type="text"
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                placeholder="如：2小时30分、1小时、45分钟"
                className="w-full px-4 py-3 bg-white rounded-2xl border border-gray-200 focus:border-indigo-300 focus:outline-none transition-colors text-sm"
              />
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '30分钟', value: '30分钟' },
                  { label: '1小时', value: '1小时' },
                  { label: '2小时', value: '2小时' },
                  { label: '半天', value: '4小时' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDurationInput(option.value)}
                    className="px-3 py-1 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 记录时间选择 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600 block">🕐 记录时间</label>
              <input
                type="time"
                value={entryTime}
                onChange={(e) => setEntryTime(e.target.value)}
                className="w-full px-4 py-3 bg-white rounded-2xl border border-gray-200 focus:border-indigo-300 focus:outline-none transition-colors text-sm"
              />
              <p className="text-xs text-gray-400">默认为当前时间，可修改为今天的其他时刻</p>
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
