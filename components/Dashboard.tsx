
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DiaryEntry, AIAnalysis, BackupData, ImportResult } from '../types';
import { analyzeMoods } from '../services/geminiService';
import { databaseService } from '../services/databaseService';
import { ICONS, MOOD_OPTIONS, MoodOption } from '../constants';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface Props {
  entries: DiaryEntry[];
  onDataRestored?: () => void; // 数据恢复后的回调
}

type TimeRange = 'today' | 'yesterday' | 'week' | 'month';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const moodConfig = MOOD_OPTIONS.find(m => m.label === data.mood);
    let finalTextColor = 'text-gray-800';
    if (moodConfig?.color.includes('rose')) finalTextColor = 'text-rose-500';
    else if (moodConfig?.color.includes('amber')) finalTextColor = 'text-amber-500';
    else if (moodConfig?.color.includes('emerald')) finalTextColor = 'text-emerald-500';
    
    return (
      <div className="bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-white/50 text-left max-w-[220px]">
        <p className="text-[10px] text-gray-400 mb-1.5 font-medium tracking-wide">{data.time}</p>
        <div className="flex items-center justify-between gap-3 mb-2">
           <span className={`text-base font-black ${finalTextColor}`}>
             {data.mood}
           </span>
           <span className="text-xs font-bold text-white bg-gray-900 px-2 py-0.5 rounded-lg">
             {Number(data.score).toFixed(1)}
           </span>
        </div>
        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed opacity-80">
            {data.content || "..."}
        </p>
      </div>
    );
  }
  return null;
};

const Dashboard: React.FC<Props> = ({ entries, onDataRestored }) => {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const [customMoods, setCustomMoods] = useState<MoodOption[]>([]);

  // Search & Filter State
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Backup & Restore State
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [pendingBackupData, setPendingBackupData] = useState<BackupData | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [restoreMessage, setRestoreMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load custom moods for color mapping
  useEffect(() => {
    databaseService.getCustomMoods()
      .then(setCustomMoods)
      .catch(e => console.error("Failed to load custom moods", e));
  }, []);

  const getMoodConfig = (moodLabel: string) => {
    return MOOD_OPTIONS.find(m => m.label === moodLabel) || 
           customMoods.find(m => m.label === moodLabel) || 
           MOOD_OPTIONS[2]; // Default fallback
  };

  const filteredEntries = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    // Logic for yesterday
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const endOfYesterday = startOfToday; // 00:00 today is end of yesterday

    const dayOfWeek = now.getDay() || 7; 
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(now.getDate() - dayOfWeek + 1);
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return entries.filter(e => {
      if (timeRange === 'today') {
        return e.timestamp >= startOfToday;
      } else if (timeRange === 'yesterday') {
        return e.timestamp >= startOfYesterday.getTime() && e.timestamp < endOfYesterday;
      } else if (timeRange === 'week') {
        return e.timestamp >= startOfWeek.getTime();
      } else {
        return e.timestamp >= startOfMonth;
      }
    }).sort((a, b) => a.timestamp - b.timestamp);
  }, [entries, timeRange]);

  // 图表数据：今天/昨天使用小时作为横轴，本周/本月使用日期
  const chartData = useMemo(() => {
    if (timeRange === 'today' || timeRange === 'yesterday') {
      // 使用数值型小时作为横轴
      return filteredEntries.map(e => {
        const date = new Date(e.timestamp);
        const hour = date.getHours() + date.getMinutes() / 60;
        return {
          hour,
          time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          score: e.moodScore,
          mood: e.mood,
          content: e.content
        };
      });
    } else {
      // 本周/本月使用日期字符串
      return filteredEntries.map(e => ({
        time: new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        shortTime: new Date(e.timestamp).toLocaleDateString([], { month: 'numeric', day: 'numeric' }),
        score: e.moodScore,
        mood: e.mood,
        content: e.content
      }));
    }
  }, [filteredEntries, timeRange]);

  // 判断是否使用固定 0-24 横轴
  const useFixedHourAxis = timeRange === 'today' || timeRange === 'yesterday';

  // --- Statistics Logic ---
  const tagStats = useMemo(() => {
    const stats: Record<string, number> = {};
    entries.forEach(e => {
      stats[e.mood] = (stats[e.mood] || 0) + 1;
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const filteredHistory = useMemo(() => {
    if (!activeTag && !searchTerm) return [];
    
    return entries.filter(e => {
      const matchesTag = activeTag ? e.mood === activeTag : true;
      const matchesSearch = searchTerm 
        ? e.content.includes(searchTerm) || e.mood.includes(searchTerm)
        : true;
      return matchesTag && matchesSearch;
    }).sort((a, b) => b.timestamp - a.timestamp); // Reverse chronological
  }, [entries, activeTag, searchTerm]);

  const handleAnalyze = async () => {
    if (filteredEntries.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeMoods(filteredEntries);
      setAnalysis(result);
    } catch (err) {
      setError("AI 正在深呼吸，请稍后再试...");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (rangeType: 'today' | 'week' | 'month') => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    let startTime = startOfToday;
    let label = "";

    if (rangeType === 'today') {
      startTime = startOfToday;
      label = "过去1天";
    } else if (rangeType === 'week') {
      const dayOfWeek = now.getDay() || 7; 
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(now.getDate() - dayOfWeek + 1);
      startTime = startOfWeek.getTime();
      label = "过去1周";
    } else if (rangeType === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      startTime = startOfMonth;
      label = "过去1月";
    }

    const dataToExport = entries
      .filter(e => e.timestamp >= startTime)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (dataToExport.length === 0) {
      alert(`没有找到${label}的记录`);
      return;
    }

    const header = `SoulMirror 心情日记导出 - ${label}\n生成时间: ${now.toLocaleString()}\n====================================\n\n`;
    const body = dataToExport.map(e => {
      const time = new Date(e.timestamp).toLocaleString();
      return `[${time}] ${e.mood} (评分: ${e.moodScore.toFixed(1)})\n内容: ${e.content}\n------------------------------------`;
    }).join('\n\n');

    const content = header + body;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `soulmirror_export_${rangeType}_${now.toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 备份所有数据
  const handleBackup = async () => {
    try {
      const backupData = await databaseService.exportAllData();
      const jsonStr = JSON.stringify(backupData, null, 2);
      const date = new Date().toISOString().split('T')[0];
      const filename = `soulmirror_backup_${date}.json`;

      // 判断是否在原生平台上
      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        // Android/iOS 平台 - 使用 Filesystem API
        try {
          const result = await Filesystem.writeFile({
            path: filename,
            data: jsonStr,
            directory: Directory.Documents,
            encoding: 'utf8'
          });

          console.log('文件保存成功:', result.uri);

          // 使用 Share API 让用户选择保存位置或分享
          await Share.share({
            title: '保存备份文件',
            text: '请选择保存位置',
            url: result.uri,
            dialogTitle: '保存 SoulMirror 备份'
          });

          alert(`备份完成！\n\n文件名: ${filename}\n\n请在分享菜单中选择"保存到文件"或其他存储位置。\n妥善保管此文件，恢复数据时需要使用。`);
        } catch (nativeError) {
          console.error('原生平台备份失败:', nativeError);
          alert('备份失败，请检查应用权限设置');
        }
      } else {
        // Web 平台 - 使用传统下载方式
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);

        alert(`备份完成！\n\n文件名: ${filename}\n保存位置: 下载文件夹 (Downloads)\n\n请妥善保管此文件，恢复数据时需要使用。`);
      }
    } catch (err) {
      alert('备份失败，请重试');
      console.error('备份失败:', err);
    }
  };

  // 触发文件选择
  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  // 处理文件选择
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 重置文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text) as BackupData;

      // 验证基本格式
      if (!data.version || !data.data) {
        alert('无效的备份文件格式');
        return;
      }

      // 显示确认对话框
      setPendingBackupData(data);
      setShowRestoreDialog(true);
      setRestoreStatus('idle');
      setRestoreMessage('');
    } catch (err) {
      alert('无法解析备份文件，请确保选择正确的 JSON 文件');
      console.error('解析备份文件失败:', err);
    }
  };

  // 执行恢复
  const handleConfirmRestore = async () => {
    if (!pendingBackupData) return;

    setRestoreStatus('loading');
    setRestoreMessage('正在恢复数据...');

    try {
      const result = await databaseService.importAllData(pendingBackupData);

      if (result.success) {
        setRestoreStatus('success');
        setRestoreMessage(
          `恢复成功！导入了 ${result.entriesImported} 条日记、${result.notesImported} 条笔记、${result.moodsImported} 个自定义心情`
        );
        // 延迟后关闭对话框并刷新数据
        setTimeout(() => {
          setShowRestoreDialog(false);
          setPendingBackupData(null);
          onDataRestored?.();
        }, 2000);
      } else {
        setRestoreStatus('error');
        setRestoreMessage(
          `部分数据恢复成功：${result.entriesImported} 条日记、${result.notesImported} 条笔记、${result.moodsImported} 个自定义心情。\n错误: ${result.errors.join(', ')}`
        );
      }
    } catch (err) {
      setRestoreStatus('error');
      setRestoreMessage('恢复失败，请重试');
      console.error('恢复失败:', err);
    }
  };

  // 关闭恢复对话框
  const handleCancelRestore = () => {
    setShowRestoreDialog(false);
    setPendingBackupData(null);
    setRestoreStatus('idle');
    setRestoreMessage('');
  };

  return (
    <div className="space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex justify-center">
        <div className="bg-white/40 backdrop-blur-md p-1.5 rounded-2xl flex gap-1 shadow-sm border border-white/40 overflow-x-auto no-scrollbar max-w-full">
          {(['today', 'yesterday', 'week', 'month'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => {
                setTimeRange(range);
                setAnalysis(null);
              }}
              className={`px-3 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                timeRange === range
                  ? 'bg-white text-gray-800 shadow-sm scale-105'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {range === 'today' ? '今天' : range === 'yesterday' ? '昨天' : range === 'week' ? '本周' : '本月'}
            </button>
          ))}
        </div>
      </div>

      <section className="glass-card rounded-[2.5rem] p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 pl-2">
          <ICONS.Chart /> 情绪心电图
        </h3>
        
        {filteredEntries.length > 0 ? (
          <div className="h-64 w-full -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                {useFixedHourAxis ? (
                  <XAxis
                    dataKey="hour"
                    type="number"
                    domain={[0, 24]}
                    axisLine={false}
                    tickLine={false}
                    tick={{fontSize: 10, fill: '#9ca3af'}}
                    ticks={[0, 6, 12, 18, 24]}
                    tickFormatter={(value) => `${value}:00`}
                  />
                ) : (
                  <XAxis
                    dataKey="shortTime"
                    axisLine={false}
                    tickLine={false}
                    tick={{fontSize: 10, fill: '#9ca3af'}}
                    interval="preserveStartEnd"
                    padding={{ left: 20, right: 20 }}
                  />
                )}
                <YAxis
                  domain={[0, 10]}
                  axisLine={false}
                  tickLine={false}
                  tick={{fontSize: 10, fill: '#9ca3af', fontWeight: 500}}
                  ticks={[0, 5, 10]}
                  width={30}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ stroke: '#4f46e5', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#4f46e5"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorScore)"
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-gray-300">
            <div className="mb-2 text-4xl opacity-50">📉</div>
            <p className="text-sm font-medium">
               {timeRange === 'yesterday' ? '昨天没有记录哦' : timeRange === 'today' ? '今天还没有记录哦' : '暂无数据轨迹'}
            </p>
          </div>
        )}
      </section>

      <section className="space-y-6">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <ICONS.Brain /> 灵魂镜像
          </h3>
          <button 
            onClick={handleAnalyze}
            disabled={loading || filteredEntries.length === 0}
            className={`px-5 py-2.5 rounded-full font-bold text-sm transition-all ${
              loading || filteredEntries.length === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                : 'bg-gray-900 text-white shadow-lg shadow-gray-400/30 hover:bg-black active:scale-95'
            }`}
          >
            {loading ? '连接心灵中...' : '开始解读'}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-rose-50/80 backdrop-blur text-rose-600 rounded-2xl text-sm border border-rose-100 text-center">
            {error}
          </div>
        )}

        {!analysis && !loading && (
          <div className="text-center py-16 glass-card rounded-[2.5rem] border-dashed border-2 border-gray-300/50">
            <p className="text-gray-400 font-medium">点击右上角按钮<br/>唤醒您的 AI 疗愈师</p>
          </div>
        )}

        {analysis && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="grid grid-cols-1 gap-6">
              
              {/* Main Insight Card */}
              <div className="relative overflow-hidden rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-200">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600"></div>
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/20 rounded-full blur-3xl"></div>
                <div className="absolute -left-10 bottom-0 w-32 h-32 bg-indigo-400/30 rounded-full blur-2xl"></div>
                
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-3 opacity-90">
                            <span className="uppercase text-xs font-bold tracking-widest border border-white/30 px-2 py-0.5 rounded-full">AI 洞察</span>
                        </div>
                        {/* Keyword Display */}
                        {analysis.keyword && (
                          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-2 flex flex-col items-center shadow-lg transform rotate-2">
                             <span className="text-[10px] uppercase tracking-widest text-white/70">关键词</span>
                             <span className="text-3xl font-serif font-bold text-white tracking-widest leading-tight" style={{ fontFamily: '"Noto Serif SC", serif' }}>
                               {analysis.keyword}
                             </span>
                          </div>
                        )}
                    </div>

                    <p className="text-lg leading-relaxed font-medium text-white/95 mb-6">
                        {analysis.summary}
                    </p>

                    <div className="flex items-center gap-3">
                         <span className={`px-3 py-1.5 rounded-lg text-xs font-bold bg-white/20 backdrop-blur border border-white/10`}>
                            趋势: {analysis.moodBarometer.trend === 'rising' ? '↗ 回升' : analysis.moodBarometer.trend === 'falling' ? '↘ 波动' : '→ 平稳'}
                         </span>
                         <span className="text-xs text-white/70">
                            {analysis.moodBarometer.explanation}
                         </span>
                    </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/80 backdrop-blur-md p-6 rounded-[2rem] border border-white/50">
                    <p className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="text-lg">✨</span> 高光时刻
                    </p>
                    <ul className="space-y-3">
                      {analysis.peaks.map((p, i) => (
                        <li key={i} className="flex items-start gap-3 text-gray-700 text-sm font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0"></span> {p}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-gradient-to-br from-rose-50/80 to-orange-50/80 backdrop-blur-md p-6 rounded-[2rem] border border-white/50">
                    <p className="text-sm font-bold text-rose-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="text-lg">☁️</span> 需要呵护
                    </p>
                    <ul className="space-y-3">
                      {analysis.valleys.map((v, i) => (
                        <li key={i} className="flex items-start gap-3 text-gray-700 text-sm font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 flex-shrink-0"></span> {v}
                        </li>
                      ))}
                    </ul>
                  </div>
              </div>
            </div>

            <div className="glass-card p-8 rounded-[2.5rem]">
              <p className="text-sm font-bold text-gray-800 mb-6 flex items-center gap-2">
                 <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">💌</span>
                 给你的专属建议
              </p>
              <div className="space-y-4">
                {analysis.suggestions.map((s, i) => (
                  <div key={i} className="p-5 bg-white/60 rounded-2xl text-sm text-gray-600 border border-white hover:border-indigo-100 transition-colors leading-relaxed shadow-sm">
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* --- Memory Recall / Filter Section --- */}
      <section className="animate-in fade-in slide-in-from-bottom-12 duration-700">
         <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center px-2 mb-6 gap-4">
            <div className="flex items-center gap-2">
               <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                 <ICONS.Tag /> 记忆回溯
               </h3>
               <span className="text-xs text-gray-400 font-medium bg-white/50 px-2 py-0.5 rounded-full">
                 {entries.length} 条记录
               </span>
            </div>

            {/* Export & Backup Actions */}
            <div className="flex items-center gap-2">
              {/* Backup/Restore Buttons */}
              <div className="flex items-center bg-white/60 backdrop-blur-sm p-1 rounded-xl border border-white/60 shadow-sm">
                <div className="flex gap-1">
                   <button
                     onClick={handleBackup}
                     className="px-2.5 py-1 text-[10px] font-bold text-gray-600 hover:bg-white hover:text-gray-900 rounded-lg transition-colors flex items-center gap-1"
                     title="备份所有数据"
                   >
                     <ICONS.Download />
                     <span>备份</span>
                   </button>
                   <button
                     onClick={handleRestoreClick}
                     className="px-2.5 py-1 text-[10px] font-bold text-gray-600 hover:bg-white hover:text-gray-900 rounded-lg transition-colors flex items-center gap-1"
                     title="从备份文件恢复"
                   >
                     <ICONS.Upload />
                     <span>恢复</span>
                   </button>
                </div>
              </div>

              {/* Export Actions */}
              <div className="flex items-center bg-white/60 backdrop-blur-sm p-1 rounded-xl border border-white/60 shadow-sm">
                <div className="flex items-center px-2 text-gray-400 gap-1 border-r border-gray-200 mr-1">
                   <ICONS.Download />
                   <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">导出</span>
                </div>
                <div className="flex gap-1">
                   <button
                     onClick={() => handleExport('today')}
                     className="px-2.5 py-1 text-[10px] font-bold text-gray-600 hover:bg-white hover:text-gray-900 rounded-lg transition-colors"
                     title="导出过去1天的记录"
                   >
                     1天
                   </button>
                   <button
                     onClick={() => handleExport('week')}
                     className="px-2.5 py-1 text-[10px] font-bold text-gray-600 hover:bg-white hover:text-gray-900 rounded-lg transition-colors"
                     title="导出过去1周的记录"
                   >
                     1周
                   </button>
                   <button
                     onClick={() => handleExport('month')}
                     className="px-2.5 py-1 text-[10px] font-bold text-gray-600 hover:bg-white hover:text-gray-900 rounded-lg transition-colors"
                     title="导出过去1个月的记录"
                   >
                     1月
                   </button>
                </div>
              </div>
            </div>
         </div>

         <div className="glass-card rounded-[2.5rem] p-6 space-y-6">
            {/* Search Input */}
            <div className="relative">
               <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                  <ICONS.Search />
               </div>
               <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="搜索记忆中的关键词..." 
                  className="w-full pl-11 pr-4 py-3 bg-white/60 border border-white/60 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-gray-400"
               />
            </div>

            {/* Tag Cloud */}
            <div>
               <p className="text-xs font-bold text-gray-400 mb-3 px-1 uppercase tracking-wider">心情分布</p>
               <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => setActiveTag(null)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                       activeTag === null
                       ? 'bg-gray-800 text-white border-gray-800 shadow-md'
                       : 'bg-white/40 text-gray-500 border-transparent hover:bg-white'
                    }`}
                  >
                    全部
                  </button>
                  {tagStats.map(([tag, count]) => {
                     const moodConfig = getMoodConfig(tag);
                     const isActive = activeTag === tag;
                     
                     return (
                       <button
                         key={tag}
                         onClick={() => setActiveTag(isActive ? null : tag)}
                         className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${
                           isActive 
                             ? `${moodConfig.color} text-white border-transparent shadow-md`
                             : 'bg-white/40 text-gray-600 border-transparent hover:bg-white'
                         }`}
                       >
                         <span>{moodConfig.emoji}</span>
                         {tag}
                         <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-gray-200/50 text-gray-500'}`}>
                           {count}
                         </span>
                       </button>
                     );
                  })}
               </div>
            </div>

            {/* Filtered Results */}
            {(activeTag || searchTerm) && (
               <div className="pt-4 border-t border-gray-100 space-y-4">
                  <div className="flex justify-between items-center px-1">
                     <p className="text-sm font-bold text-gray-600">
                        {filteredHistory.length > 0 ? `找到 ${filteredHistory.length} 个瞬间` : '没有找到相关记录'}
                     </p>
                     {(activeTag || searchTerm) && (
                       <button 
                         onClick={() => { setActiveTag(null); setSearchTerm(''); }}
                         className="text-xs text-indigo-500 font-medium hover:text-indigo-700"
                       >
                         清除筛选
                       </button>
                     )}
                  </div>

                  <div className="grid gap-3 max-h-[400px] overflow-y-auto no-scrollbar">
                     {filteredHistory.map(entry => {
                        const moodConfig = getMoodConfig(entry.mood);
                        const date = new Date(entry.timestamp);
                        
                        return (
                           <div key={entry.id} className="bg-white/60 p-4 rounded-2xl border border-white hover:bg-white transition-colors">
                              <div className="flex justify-between items-start mb-2">
                                 <div className="flex items-center gap-2">
                                    <span className="text-xl">{moodConfig.emoji}</span>
                                    <div>
                                       <p className="text-xs font-bold text-gray-500">
                                         {date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                                       </p>
                                       <p className={`text-[10px] font-bold ${moodConfig.color.replace('bg-', 'text-').replace('500', '600')}`}>
                                          {entry.mood}
                                       </p>
                                    </div>
                                 </div>
                                 <div className={`text-xs font-bold px-2 py-1 rounded-lg ${moodConfig.color} text-white`}>
                                   {entry.moodScore.toFixed(0)}
                                 </div>
                              </div>
                              <p className="text-sm text-gray-700 leading-relaxed">
                                 {entry.content}
                              </p>
                           </div>
                        );
                     })}
                  </div>
               </div>
            )}
         </div>
      </section>

      {/* Hidden file input for restore */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Restore Confirmation Dialog */}
      {showRestoreDialog && pendingBackupData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <ICONS.Upload /> 恢复数据确认
            </h3>

            {restoreStatus === 'idle' && (
              <>
                <div className="bg-gray-50 rounded-2xl p-4 mb-4 space-y-2">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">备份时间:</span>{' '}
                    {new Date(pendingBackupData.exportDate).toLocaleString('zh-CN')}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">来源平台:</span>{' '}
                    {pendingBackupData.platform === 'sqlite' ? 'SQLite (移动端)' : 'localStorage (浏览器)'}
                  </p>
                  <div className="border-t border-gray-200 pt-2 mt-2">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">日记条目:</span>{' '}
                      {pendingBackupData.data.entries?.length || 0} 条
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">每日笔记:</span>{' '}
                      {Object.keys(pendingBackupData.data.dailyNotes || {}).length} 条
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">自定义心情:</span>{' '}
                      {pendingBackupData.data.customMoods?.length || 0} 个
                    </p>
                  </div>
                </div>

                <p className="text-xs text-amber-600 bg-amber-50 rounded-xl p-3 mb-4">
                  注意：相同 ID 的条目将被备份数据覆盖，新条目将被添加。
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={handleCancelRestore}
                    className="flex-1 px-4 py-3 rounded-xl font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirmRestore}
                    className="flex-1 px-4 py-3 rounded-xl font-bold text-sm bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
                  >
                    确认恢复
                  </button>
                </div>
              </>
            )}

            {restoreStatus === 'loading' && (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-sm text-gray-600">{restoreMessage}</p>
              </div>
            )}

            {restoreStatus === 'success' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ICONS.Check />
                </div>
                <p className="text-sm text-emerald-600 font-medium">{restoreMessage}</p>
              </div>
            )}

            {restoreStatus === 'error' && (
              <div className="py-4">
                <div className="bg-rose-50 rounded-xl p-4 mb-4">
                  <p className="text-sm text-rose-600 whitespace-pre-wrap">{restoreMessage}</p>
                </div>
                <button
                  onClick={handleCancelRestore}
                  className="w-full px-4 py-3 rounded-xl font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  关闭
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
