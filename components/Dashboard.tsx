
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DiaryEntry, BackupData, ImportResult, MentorType, UserSettings } from '../types';
import { databaseService } from '../services/databaseService';
import { ICONS, MOOD_OPTIONS, MoodOption, MENTORS, DEFAULT_MENTOR } from '../constants';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface Props {
  entries: DiaryEntry[];
  onDataRestored?: () => void; // 数据恢复后的回调
}

const Dashboard: React.FC<Props> = ({ entries, onDataRestored }) => {

  // 导师系统状态
  const [selectedMentor, setSelectedMentor] = useState<MentorType>(DEFAULT_MENTOR);
  const [mentorLoading, setMentorLoading] = useState(false);

  // 加载用户设置（导师选择）
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await databaseService.getUserSettings();
        setSelectedMentor(settings.selectedMentor);
      } catch (e) {
        console.error('加载用户设置失败:', e);
      }
    };
    loadSettings();
  }, []);

  // 切换导师
  const handleSelectMentor = async (mentor: MentorType) => {
    if (mentor === selectedMentor) return;

    setMentorLoading(true);
    try {
      await databaseService.saveUserSettings({ selectedMentor: mentor });
      setSelectedMentor(mentor);
    } catch (e) {
      console.error('保存导师设置失败:', e);
    } finally {
      setMentorLoading(false);
    }
  };

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

    const header = `美好时光 心情日记导出 - ${label}\n生成时间: ${now.toLocaleString()}\n====================================\n\n`;
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
            encoding: undefined
          });

          console.log('文件保存成功:', result.uri);

          // 使用 Share API 让用户选择保存位置或分享
          await Share.share({
            title: '保存备份文件',
            text: '请选择保存位置',
            url: result.uri,
            dialogTitle: '保存 美好时光 备份'
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

      {/* --- Mentor Selection Section --- */}
      <section className="animate-in fade-in slide-in-from-bottom-8 duration-600">
        <div className="glass-card rounded-[2rem] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <span className="text-lg">🎭</span>
              人生导师
            </h3>
            <span className="text-xs text-gray-400">
              选择一位 AI 人格陪伴你
            </span>
          </div>
          
          {/* 导师选择网格 */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {(Object.keys(MENTORS) as MentorType[]).map((mentorId) => {
              const mentor = MENTORS[mentorId];
              const isSelected = selectedMentor === mentorId;
              
              return (
                <button
                  key={mentorId}
                  onClick={() => handleSelectMentor(mentorId)}
                  disabled={mentorLoading}
                  className={`p-3 rounded-xl text-center transition-all border ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-400 shadow-sm'
                      : 'bg-white/50 border-transparent hover:bg-white hover:border-gray-200'
                  } ${mentorLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="text-2xl mb-1">{mentor.avatar}</div>
                  <div className={`text-xs font-bold ${isSelected ? 'text-indigo-700' : 'text-gray-700'}`}>
                    {mentor.name}
                  </div>
                </button>
              );
            })}
          </div>
          
          {/* 当前导师信息 */}
          <div className="bg-white/50 rounded-xl p-4 border border-white/60">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{MENTORS[selectedMentor].avatar}</span>
              <div>
                <p className="text-sm font-bold text-gray-800">{MENTORS[selectedMentor].name}</p>
                <p className="text-xs text-gray-500">{MENTORS[selectedMentor].title}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 italic pl-1">
              「{MENTORS[selectedMentor].quote}」
            </p>
          </div>
        </div>
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
                              <div
                                className="text-sm text-gray-700 leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: entry.content }}
                              />
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
