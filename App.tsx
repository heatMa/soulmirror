
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { DiaryEntry, ViewMode, WeeklyReport, MentorType, UserSettings } from './types';
import DiaryEntryForm from './components/DiaryEntryForm';
import Dashboard from './components/Dashboard';
import CalendarStrip from './components/CalendarStrip';
import DailyMoodChart from './components/DailyMoodChart';
import EnergyBattery from './components/EnergyBattery';
import WeeklyGoal from './components/WeeklyGoal';
import TimelineItem from './components/TimelineItem';
import DeepReflectionSection from './components/DeepReflectionSection';
import Statistics from './components/Statistics';
import WeeklyReportCard from './components/WeeklyReportCard';
import WeeklyReportView from './components/WeeklyReportView';
import WeeklyReportPreview from './components/WeeklyReportPreview';
import { ICONS, MOOD_OPTIONS, MoodOption, getEffectiveCustomMoods, DEFAULT_MENTOR } from './constants';
import { evaluateMoodScore, generateAiReply, generateRegulationSuggestions } from './services/geminiService';
import { databaseService } from './services/databaseService';
import { getEnergyAfterEntry } from './utils/energyUtils';
import { 
  getWeekKeyForDate,
  getWeeklyReportStatusForDate,
  regenerateWeeklyReport,
  generateWeeklyReport
} from './services/reportService';
import { initializeNotifications } from './services/notificationService';

const App: React.FC = () => {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.TIMELINE);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [customMoods, setCustomMoods] = useState<MoodOption[]>([]);
  const [dailyNotes, setDailyNotes] = useState<Record<string, string>>({});
  const [greeting, setGreeting] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  
  // 周报相关状态
  const [currentWeekReport, setCurrentWeekReport] = useState<WeeklyReport | null>(null);
  const [showReportView, setShowReportView] = useState(false);
  const [weeklyReportStatus, setWeeklyReportStatus] = useState<{
    canGenerate: boolean;
    entryCount: number;
    isGenerationTime: boolean;
    weekKey: string;
  } | null>(null);
  const [weeklyReportsExpanded, setWeeklyReportsExpanded] = useState(false);

  // 导师系统状态
  const [selectedMentor, setSelectedMentor] = useState<MentorType>(DEFAULT_MENTOR);

  // 初始化数据库并加载数据
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsLoading(true);
        setDbError(null);
        
        // 初始化数据库
        await databaseService.initialize();
        
        // 并行加载所有数据
        const [loadedEntries, loadedNotes, loadedCustomMoods, userSettings] = await Promise.all([
          databaseService.getAllEntries(),
          databaseService.getAllDailyNotes(),
          databaseService.getCustomMoods(),
          databaseService.getUserSettings()
        ]);
        
        // 设置导师
        setSelectedMentor(userSettings.selectedMentor);

        // 清理与默认心情重复的自定义心情（持久化清理，下次加载时不再有重复）
        const defaultLabels = MOOD_OPTIONS.map(m => m.label);
        await databaseService.removeDuplicateCustomMoods(defaultLabels);

        // 修复 V1 系统的旧版自定义心情分数
        const fixedMoods = await databaseService.fixV1CustomMoodScores();
        if (fixedMoods.length > 0) {
          console.log('已修复 V1 系统自定义心情分数:', fixedMoods);
        }

        setEntries(loadedEntries);
        setDailyNotes(loadedNotes);
        setCustomMoods(loadedCustomMoods);
        
        // 初始化通知系统（Android，失败不影响主功能）
        try {
          await initializeNotifications();
        } catch (notifError) {
          console.error('通知初始化失败:', notifError);
        }
        
        console.log('应用数据加载完成');
      } catch (error) {
        console.error('数据库初始化失败:', error);
        setDbError('数据加载失败，请刷新页面重试');
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  // 打开添加表单时重新加载自定义心情
  useEffect(() => {
    if (showAddForm) {
      databaseService.getCustomMoods()
        .then(setCustomMoods)
        .catch(console.error);
    }
  }, [showAddForm]);

  // 关闭表单后也刷新自定义心情（确保新添加的心情能正确显示）
  useEffect(() => {
    if (!showAddForm) {
      databaseService.getCustomMoods()
        .then(setCustomMoods)
        .catch(console.error);
    }
  }, [showAddForm]);

  // 设置问候语（并自动更新）
  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 6) setGreeting('夜深了，愿你安梦');
      else if (hour < 11) setGreeting('早上好，开启新的一天');
      else if (hour < 14) setGreeting('午安，记得小憩一会');
      else if (hour < 18) setGreeting('下午好，享受这段时光');
      else setGreeting('晚上好，卸下一身疲惫');
    };

    // 立即执行一次
    updateGreeting();

    // 每分钟更新一次问候语
    const interval = setInterval(updateGreeting, 60000);

    return () => clearInterval(interval);
  }, []);

  // 处理安卓返回键/手势返回
  useEffect(() => {
    // 只在原生平台（Android）注册返回事件
    const isNative = typeof (window as any).Capacitor !== 'undefined';
    if (!isNative) return;

    const backButtonListener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      // 优先级1：如果周报详情页打开，关闭它
      if (showReportView) {
        setShowReportView(false);
        return;
      }
      
      // 优先级2：如果在分析或统计页面，返回时间线
      if (viewMode !== ViewMode.TIMELINE) {
        setViewMode(ViewMode.TIMELINE);
        return;
      }
      
      // 优先级3：如果可以返回（浏览器历史），则返回
      if (canGoBack) {
        window.history.back();
        return;
      }
      
      // 最后：退出应用
      CapacitorApp.exitApp();
    });

    return () => {
      backButtonListener.remove();
    };
  }, [showReportView, viewMode]);

  // 根据选中的日期加载对应周的周报
  useEffect(() => {
    // 等待数据库初始化完成后再加载周报
    if (isLoading) return;

    const loadWeeklyReportForDate = async () => {
      try {
        const weekKey = getWeekKeyForDate(selectedDate);
        const report = await databaseService.getWeeklyReport(weekKey);

        if (report) {
          setCurrentWeekReport(report);
          setWeeklyReportStatus(null);
        } else {
          // 没有周报，检查是否可以生成预览
          const status = await getWeeklyReportStatusForDate(selectedDate);
          setWeeklyReportStatus(status);
          setCurrentWeekReport(null);
        }
      } catch (error) {
        console.error('加载周报失败:', error);
      }
    };

    loadWeeklyReportForDate();
  }, [selectedDate, isLoading]);

  // 保存日记条目
  const handleSaveEntry = useCallback(async (formData: Omit<DiaryEntry, 'id' | 'timestamp'> & { id?: string, timestamp?: number }) => {
    try {
      if (formData.id) {
        // 更新现有条目
        const updatedEntry: DiaryEntry = {
          id: formData.id,
          timestamp: formData.timestamp || Date.now(),
          content: formData.content,
          mood: formData.mood,
          moodScore: formData.moodScore, // 会被 AI 评分覆盖
          energyDelta: formData.energyDelta,
          scoreVersion: 'v2',
          moodEmoji: formData.moodEmoji,
          moodHexColor: formData.moodHexColor,
          tags: formData.tags,
          endTimestamp: formData.duration ? undefined : formData.endTimestamp,
          duration: formData.duration,
          isActive: formData.isActive
        };

        await databaseService.updateEntry(updatedEntry);
        setEntries(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e));

        // AI 重新评分（能量系统）
        // 从 mood 配置中获取正确的预设分数，避免使用旧版系统的错误分数
        const moodConfig = getMoodConfig(updatedEntry.mood);
        const presetScore = moodConfig.score;
        evaluateMoodScore(updatedEntry.mood, updatedEntry.content, presetScore)
          .then(async (aiScore) => {
            if (aiScore !== undefined) {
              await databaseService.updateEntry({
                ...updatedEntry,
                moodScore: aiScore,
                energyDelta: aiScore,
                scoreVersion: 'v2'
              });
              setEntries(currentEntries =>
                currentEntries.map(e => e.id === updatedEntry.id ? { ...e, moodScore: aiScore, energyDelta: aiScore, scoreVersion: 'v2' } : e)
              );

              // 负面情绪时生成调节建议（评分 ≤ -3）
              if (aiScore <= -3) {
                generateRegulationSuggestions(updatedEntry.mood, updatedEntry.content, aiScore, selectedMentor)
                  .then(async (suggestions) => {
                    if (suggestions && suggestions.length > 0) {
                      await databaseService.updateEntryAiSuggestions(updatedEntry.id, suggestions);
                      setEntries(currentEntries =>
                        currentEntries.map(e => e.id === updatedEntry.id ? { ...e, aiSuggestions: suggestions } : e)
                      );
                    }
                  })
                  .catch(console.error);
              } else {
                // 如果情绪变好了（评分 > -3），清除之前的调节建议
                await databaseService.updateEntryAiSuggestions(updatedEntry.id, []);
                setEntries(currentEntries =>
                  currentEntries.map(e => e.id === updatedEntry.id ? { ...e, aiSuggestions: undefined } : e)
                );
              }

              // AI 暖心回复（编辑后重新生成）
              generateAiReply(updatedEntry.mood, updatedEntry.content, aiScore, selectedMentor)
                .then(async (reply) => {
                  if (reply) {
                    await databaseService.updateEntryAiReply(updatedEntry.id, reply);
                    setEntries(currentEntries =>
                      currentEntries.map(e => e.id === updatedEntry.id ? { ...e, aiReply: reply } : e)
                    );
                  }
                })
                .catch(console.error);
            }
          })
          .catch(console.error);

      } else {
        // 添加新条目
        const now = new Date();
        let timestamp = now.getTime();

        const isSameDay = (d1: Date, d2: Date) =>
          d1.getDate() === d2.getDate() &&
          d1.getMonth() === d2.getMonth() &&
          d1.getFullYear() === d2.getFullYear();

        if (!isSameDay(selectedDate, now)) {
          const targetTime = new Date(selectedDate);
          targetTime.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
          timestamp = targetTime.getTime();
        }

        // 从 mood 配置中获取正确的预设分数
        const moodConfig = getMoodConfig(formData.mood);
        const initialScore = moodConfig.score;

        const entryData = {
          timestamp,
          content: formData.content,
          mood: formData.mood,
          moodScore: initialScore, // 使用 mood 配置的预设分数
          energyDelta: initialScore, // 初始使用预设分数，会被 AI 更新
          scoreVersion: 'v2' as const,
          moodEmoji: formData.moodEmoji,
          moodHexColor: formData.moodHexColor,
          tags: formData.tags,
          endTimestamp: formData.duration ? undefined : formData.endTimestamp,
          duration: formData.duration,
          isActive: formData.isActive
        };

        const newEntry = await databaseService.addEntry(entryData);
        setEntries(prev => [newEntry, ...prev]);

        // AI 后台评分（能量系统）
        // 使用已获取的 moodConfig 中的预设分数
        const presetScore = initialScore;
        evaluateMoodScore(newEntry.mood, newEntry.content, presetScore)
          .then(async (aiScore) => {
            if (aiScore !== undefined) {
              // 计算该条记录后的剩余电量
              const todayEntries = entries.filter(e => {
                const eDate = new Date(e.timestamp);
                const nDate = new Date(newEntry.timestamp);
                return eDate.getDate() === nDate.getDate() &&
                       eDate.getMonth() === nDate.getMonth() &&
                       eDate.getFullYear() === nDate.getFullYear();
              });

              const updatedEntryForEnergy = { ...newEntry, energyDelta: aiScore, scoreVersion: 'v2' as const };
              const energyRemaining = getEnergyAfterEntry([...todayEntries, updatedEntryForEnergy], updatedEntryForEnergy);

              await databaseService.updateEntry({
                ...newEntry,
                moodScore: aiScore,
                energyDelta: aiScore,
                scoreVersion: 'v2' as const
              });

              setEntries(currentEntries =>
                currentEntries.map(e => e.id === newEntry.id ? { ...e, moodScore: aiScore, energyDelta: aiScore, scoreVersion: 'v2' } : e)
              );

              // 负面情绪时生成调节建议（评分 ≤ -3）
              if (aiScore <= -3) {
                generateRegulationSuggestions(newEntry.mood, newEntry.content, aiScore, selectedMentor)
                  .then(async (suggestions) => {
                    if (suggestions && suggestions.length > 0) {
                      await databaseService.updateEntryAiSuggestions(newEntry.id, suggestions);
                      setEntries(currentEntries =>
                        currentEntries.map(e => e.id === newEntry.id ? { ...e, aiSuggestions: suggestions } : e)
                      );
                    }
                  })
                  .catch(console.error);
              }

              // AI 暖心回复
              generateAiReply(newEntry.mood, newEntry.content, aiScore, selectedMentor)
                .then(async (reply) => {
                  if (reply) {
                    await databaseService.updateEntryAiReply(newEntry.id, reply);
                    setEntries(currentEntries =>
                      currentEntries.map(e => e.id === newEntry.id ? { ...e, aiReply: reply } : e)
                    );
                  }
                })
                .catch(console.error);
            }
          })
          .catch(console.error);
      }
    } catch (error) {
      console.error('保存日记条目失败:', error);
    }
  }, [entries, selectedDate]);

  // 删除日记条目
  const deleteEntry = useCallback(async (entry: DiaryEntry) => {
    try {
      await databaseService.deleteEntry(entry.id);
      setEntries(prev => prev.filter(e => e.id !== entry.id));
    } catch (error) {
      console.error('删除日记条目失败:', error);
      alert('删除失败，请重试');
    }
  }, []);

  // 结束情绪记录（设置结束时间）
  const endMood = useCallback(async (entry: DiaryEntry) => {
    try {
      const updatedEntry: DiaryEntry = {
        ...entry,
        endTimestamp: Date.now(),
        isActive: false,
        duration: undefined, // 清空手动填写的时长，优先使用自动计算
      };
      await databaseService.updateEntry(updatedEntry);
      setEntries(prev => prev.map(e => (e.id === entry.id ? updatedEntry : e)));
    } catch (error) {
      console.error('结束情绪失败:', error);
      alert('操作失败，请重试');
    }
  }, []);

  // 保存每日笔记
  const saveDailyNote = useCallback(async (dateStr: string, content: string) => {
    try {
      await databaseService.saveDailyNote(dateStr, content);
      setDailyNotes(prev => ({ ...prev, [dateStr]: content }));
    } catch (error) {
      console.error('保存每日笔记失败:', error);
    }
  }, []);

  // 数据恢复后重新加载所有数据
  const handleDataRestored = useCallback(async () => {
    try {
      const [loadedEntries, loadedNotes, loadedCustomMoods] = await Promise.all([
        databaseService.getAllEntries(),
        databaseService.getAllDailyNotes(),
        databaseService.getCustomMoods()
      ]);
      setEntries(loadedEntries);
      setDailyNotes(loadedNotes);
      setCustomMoods(loadedCustomMoods);
    } catch (error) {
      console.error('刷新数据失败:', error);
    }
  }, []);

  const effectiveCustomMoods = useMemo(() => getEffectiveCustomMoods(customMoods), [customMoods]);

  const getMoodConfig = (moodLabel: string, entry?: DiaryEntry): MoodOption => {
    const found = MOOD_OPTIONS.find(m => m.label === moodLabel) ||
                  customMoods.find(m => m.label === moodLabel);

    if (found) {
      // 如果 entry 中有保存的颜色/emoji，优先使用（因为用户可能自定义过）
      if (entry?.moodHexColor || entry?.moodEmoji) {
        return {
          ...found,
          hexColor: entry.moodHexColor || found.hexColor,
          emoji: entry.moodEmoji || found.emoji
        };
      }
      return found;
    }

    // 找不到配置时，使用 entry 自带的数据（emoji 和 hexColor）
    return {
      label: moodLabel,
      value: moodLabel,
      score: entry?.moodScore || 5,
      emoji: entry?.moodEmoji || '🏷️',
      color: 'bg-gray-400',
      hexColor: entry?.moodHexColor || '#9ca3af',
      shadow: 'shadow-gray-200',
      suggestions: []
    };
  };

  // 按时间降序排序用于时间线视图（最新的在最上面）
  const timelineEntries = entries
    .filter(entry => {
      const entryDate = new Date(entry.timestamp);
      return entryDate.getDate() === selectedDate.getDate() &&
             entryDate.getMonth() === selectedDate.getMonth() &&
             entryDate.getFullYear() === selectedDate.getFullYear();
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  // 计算每条记录的频次统计（今天、本周、本月）- 只统计相同心情标签
  const getEntryCounts = (entry: DiaryEntry) => {
    const entryDate = new Date(entry.timestamp);
    const moodLabel = entry.mood; // 心情标签

    // 今天的记录（按时间升序统计到当前记录为止，只统计相同心情）
    const todayEntries = entries
      .filter(e => {
        const eDate = new Date(e.timestamp);
        return e.mood === moodLabel &&
               eDate.getDate() === entryDate.getDate() &&
               eDate.getMonth() === entryDate.getMonth() &&
               eDate.getFullYear() === entryDate.getFullYear() &&
               e.timestamp <= entry.timestamp;
      })
      .sort((a, b) => a.timestamp - b.timestamp);
    const countToday = todayEntries.findIndex(e => e.id === entry.id) + 1;

    // 本周的记录（周一到周日，只统计相同心情）
    const getWeekStart = (date: Date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 调整到周一
      return new Date(d.setDate(diff));
    };
    const weekStart = getWeekStart(entryDate);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekEntries = entries
      .filter(e => {
        const eDate = new Date(e.timestamp);
        return e.mood === moodLabel &&
               eDate >= weekStart &&
               eDate < weekEnd &&
               e.timestamp <= entry.timestamp;
      })
      .sort((a, b) => a.timestamp - b.timestamp);
    const countWeek = weekEntries.findIndex(e => e.id === entry.id) + 1;

    // 本月的记录（只统计相同心情）
    const monthEntries = entries
      .filter(e => {
        const eDate = new Date(e.timestamp);
        return e.mood === moodLabel &&
               eDate.getMonth() === entryDate.getMonth() &&
               eDate.getFullYear() === entryDate.getFullYear() &&
               e.timestamp <= entry.timestamp;
      })
      .sort((a, b) => a.timestamp - b.timestamp);
    const countMonth = monthEntries.findIndex(e => e.id === entry.id) + 1;

    return { countToday, countWeek, countMonth };
  };

  const getSelectedDateStr = () => {
    return selectedDate.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
  };

  const copyDailySummary = () => {
    if (timelineEntries.length === 0) return;
    const dateStr = selectedDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    let summaryText = "";
    if (timelineEntries.length > 0) {
        const entriesText = timelineEntries
          .map(entry => {
            const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
            return `⏰ ${time} | ${entry.mood} ${entry.moodScore > 0 ? `(${entry.moodScore.toFixed(1)}分)` : ''}\n${entry.content}`;
          })
          .join('\n\n------------------\n\n');
        summaryText += `💫 心情记录：\n${entriesText}`;
    }
    const finalContent = `📅 ${dateStr} 心情日记\n\n${summaryText}\n\n✨ 来自 美好时光`;
    navigator.clipboard.writeText(finalContent).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const openAddModal = () => {
      setEditingEntry(null);
      setShowAddForm(true);
  };

  const openEditModal = (entry: DiaryEntry) => {
      setEditingEntry(entry);
      setShowAddForm(true);
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-gray-800 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">正在加载数据...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (dbError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center px-6">
          <div className="text-5xl mb-4">😢</div>
          <p className="text-gray-700 font-medium mb-4">{dbError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-gray-800 text-white rounded-xl hover:bg-gray-900 transition-colors"
          >
            刷新页面
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-800 flex flex-col font-sans">
      
      {viewMode === ViewMode.TIMELINE ? (
        <>
          <CalendarStrip 
            selectedDate={selectedDate} 
            onSelectDate={setSelectedDate}
            entries={entries}
          />
          
          <main className="flex-1 px-2 pt-4 pb-28 overflow-y-auto no-scrollbar">
            {/* Header Greeting & Actions */}
            <div className="mb-6 mt-2 px-2 animate-in fade-in slide-in-from-bottom-4 duration-700 flex justify-between items-end">
               <div>
                 <h2 className="text-2xl font-bold text-gray-800 tracking-tight">{greeting}</h2>
                 <p className="text-sm text-gray-500/80 mt-1 font-medium">今天感觉如何？</p>
               </div>
               
               <button 
                 onClick={copyDailySummary}
                 className={`p-2.5 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-2 ${
                   isCopied 
                     ? 'bg-emerald-100 text-emerald-600' 
                     : 'bg-white/50 text-gray-500 hover:bg-white hover:text-gray-800'
                 }`}
                 title="复制今日日记"
               >
                 {isCopied ? <ICONS.Check /> : <ICONS.Copy />}
                 {isCopied && <span className="text-xs font-bold">已复制</span>}
               </button>
            </div>

            {/* 查看周报按钮 */}
            <div className="mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <button
                onClick={() => setWeeklyReportsExpanded(!weeklyReportsExpanded)}
                className="w-full glass-card rounded-2xl px-4 py-3 flex items-center justify-between transition-all hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <ICONS.Report />
                  <span className="font-medium text-gray-700">查看周报</span>
                </div>
                <div className={`transition-transform duration-300 ${weeklyReportsExpanded ? 'rotate-90' : ''}`}>
                  <ICONS.ChevronRight />
                </div>
              </button>
            </div>

            {/* 周报列表（展开时显示） */}
            {weeklyReportsExpanded && (
              <>
                {currentWeekReport ? (
                  <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <WeeklyReportCard
                      report={currentWeekReport}
                      onClick={() => {
                        databaseService.markReportAsViewed(currentWeekReport.weekKey);
                        setShowReportView(true);
                      }}
                      onRegenerate={async (weekKey: string) => {
                        try {
                          const newReport = await regenerateWeeklyReport(weekKey);
                          if (newReport) {
                            setCurrentWeekReport(newReport);
                          }
                        } catch (error) {
                          console.error('重新生成周报失败:', error);
                          alert('重新生成失败，请重试');
                        }
                      }}
                    />
                  </div>
                ) : weeklyReportStatus && (
                  <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <WeeklyReportPreview
                      entryCount={weeklyReportStatus.entryCount}
                      minEntries={3}
                      weekKey={weeklyReportStatus.weekKey}
                      onGenerate={async (weekKey: string) => {
                        try {
                          const report = await generateWeeklyReport(weekKey);
                          if (report) {
                            setCurrentWeekReport(report);
                            setWeeklyReportStatus(null);
                          }
                        } catch (error) {
                          console.error('生成周报失败:', error);
                          throw error;
                        }
                      }}
                    />
                  </div>
                )}
              </>
            )}

            {/* Daily Mood Chart - 今日情绪波动 */}
            {timelineEntries.length > 0 && (
              <div className="mb-4 h-48 animate-in fade-in slide-in-from-bottom-6 duration-700">
                 <DailyMoodChart entries={timelineEntries} customMoods={effectiveCustomMoods} />
              </div>
            )}

            {/* Daily Note Editor - 今日笔记 */}
            <div className="mb-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
               <DeepReflectionSection
                 selectedDate={selectedDate}
                 moodEntries={timelineEntries}
               />
            </div>

            {/* Energy Battery - 剩余能量 */}
            <div className="mb-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
               <EnergyBattery entries={timelineEntries} allEntries={entries} customMoods={effectiveCustomMoods} />
            </div>

            {/* 今日记录标题 */}
            <div className="flex justify-between items-center mb-3 px-2">
              <h3 className="text-lg font-bold text-gray-800">今日记录</h3>
            </div>
            
            {timelineEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center animate-in fade-in duration-1000">
                 <div className="text-gray-300 text-sm font-medium">
                    今天还没有具体的心情卡片记录...
                 </div>
              </div>
            ) : (
              <div className="glass-card rounded-[32px] p-4 animate-in slide-in-from-bottom-8 duration-500 min-h-[200px]">
                {timelineEntries.map((entry, index) => {
                  const moodConfig = getMoodConfig(entry.mood, entry);
                  const isLast = index === timelineEntries.length - 1;
                  const { countToday, countWeek, countMonth } = getEntryCounts(entry);

                  // 计算该条记录后的剩余电量
                  const energyRemaining = getEnergyAfterEntry(timelineEntries, entry);

                  return (
                    <TimelineItem
                        key={entry.id}
                        entry={entry}
                        moodConfig={moodConfig}
                        isLast={isLast}
                        onEdit={openEditModal}
                        onDelete={deleteEntry}
                        onEndMood={endMood}
                        countToday={countToday}
                        countWeek={countWeek}
                        countMonth={countMonth}
                        energyRemaining={energyRemaining}
                    />
                  );
                })}
              </div>
            )}
          </main>
        </>
      ) : viewMode === ViewMode.ANALYSIS ? (
        <div className="flex-1 px-4 pt-safe-top pb-24 overflow-y-auto no-scrollbar">
           <div className="flex justify-between items-center mb-6 px-2">
              <h2 className="text-2xl font-bold text-gray-800 tracking-tight">记忆回溯</h2>
           </div>
          <Dashboard entries={entries} onDataRestored={handleDataRestored} customMoods={effectiveCustomMoods} />
        </div>
      ) : (
        <Statistics entries={entries} customMoods={effectiveCustomMoods} />
      )}

      {/* Floating Action Button */}
      {viewMode === ViewMode.TIMELINE && (
        <div className="fixed bottom-[100px] right-6 z-40">
          <button
            onClick={openAddModal}
            className="w-16 h-16 bg-gray-900 text-white rounded-[24px] shadow-2xl shadow-gray-400/50 flex items-center justify-center transition-all hover:scale-105 active:scale-95 active:bg-black group"
          >
            <ICONS.Plus />
          </button>
        </div>
      )}

      <nav className="fixed bottom-6 left-6 right-6 h-[72px] z-40">
        <div className="glass-card w-full h-full rounded-[28px] flex justify-around items-center shadow-xl shadow-gray-200/40">
          <button
            onClick={() => setViewMode(ViewMode.TIMELINE)}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
              viewMode === ViewMode.TIMELINE ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className={`transition-transform duration-300 ${viewMode === ViewMode.TIMELINE ? 'scale-110 -translate-y-1' : ''}`}>
               <ICONS.Home />
            </div>
            <span className="text-xs font-medium">主页</span>
          </button>

          <div className="w-[1px] h-8 bg-gray-200/50"></div>

          <button
            onClick={() => setViewMode(ViewMode.STATISTICS)}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
              viewMode === ViewMode.STATISTICS ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className={`transition-transform duration-300 ${viewMode === ViewMode.STATISTICS ? 'scale-110 -translate-y-1' : ''}`}>
              <ICONS.Chart />
            </div>
            <span className="text-xs font-medium">情绪统计</span>
          </button>

          <div className="w-[1px] h-8 bg-gray-200/50"></div>

          <button
            onClick={() => setViewMode(ViewMode.ANALYSIS)}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
              viewMode === ViewMode.ANALYSIS ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className={`transition-transform duration-300 ${viewMode === ViewMode.ANALYSIS ? 'scale-110 -translate-y-1' : ''}`}>
              <ICONS.Brain />
            </div>
            <span className="text-xs font-medium">记忆回溯</span>
          </button>
        </div>
      </nav>

      {showAddForm && (
        <DiaryEntryForm 
          initialData={editingEntry}
          onSave={handleSaveEntry} 
          onClose={() => setShowAddForm(false)} 
        />
      )}
      
      {/* 周报详情页 */}
      {showReportView && currentWeekReport && (
        <WeeklyReportView 
          report={currentWeekReport}
          onClose={() => setShowReportView(false)}
          onExperimentAccept={() => {
            // 更新本地状态
            setCurrentWeekReport(prev => prev ? {
              ...prev,
              tracking: {
                ...prev.tracking,
                experimentAccepted: true
              }
            } : null);
          }}
        />
      )}
    </div>
  );
};

export default App;
