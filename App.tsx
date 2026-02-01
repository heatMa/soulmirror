
import React, { useState, useEffect } from 'react';
import { DiaryEntry, ViewMode } from './types';
import DiaryEntryForm from './components/DiaryEntryForm';
import Dashboard from './components/Dashboard';
import CalendarStrip from './components/CalendarStrip';
import DailyMoodChart from './components/DailyMoodChart';
import DailyNoteEditor from './components/DailyNoteEditor';
import TimelineItem from './components/TimelineItem';
import { ICONS, MOOD_OPTIONS, MoodOption } from './constants';
import { evaluateMoodScore } from './services/geminiService';

const App: React.FC = () => {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.TIMELINE);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null); // Track entry being edited
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [customMoods, setCustomMoods] = useState<MoodOption[]>([]);
  const [dailyNotes, setDailyNotes] = useState<Record<string, string>>({});
  const [greeting, setGreeting] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Load Diary Entries
  useEffect(() => {
    const savedEntries = localStorage.getItem('soulmirror_diary');
    if (savedEntries) {
      try {
        setEntries(JSON.parse(savedEntries));
      } catch (e) { console.error("Failed to load diary entries"); }
    }
  }, []);

  // Load Daily Notes
  useEffect(() => {
    const savedNotes = localStorage.getItem('soulmirror_daily_notes');
    if (savedNotes) {
      try {
        setDailyNotes(JSON.parse(savedNotes));
      } catch (e) { console.error("Failed to load daily notes"); }
    }
  }, []);

  useEffect(() => {
    const savedCustomMoods = localStorage.getItem('soulmirror_custom_moods');
    if (savedCustomMoods) {
      try {
        setCustomMoods(JSON.parse(savedCustomMoods));
      } catch (e) { console.error("Failed to load custom moods"); }
    }
  }, [showAddForm]); 

  useEffect(() => {
    if (entries.length > 0) {
      localStorage.setItem('soulmirror_diary', JSON.stringify(entries));
    }
  }, [entries]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 6) setGreeting('夜深了，愿你安梦');
    else if (hour < 11) setGreeting('早上好，开启新的一天');
    else if (hour < 14) setGreeting('午安，记得小憩一会');
    else if (hour < 18) setGreeting('下午好，享受这段时光');
    else setGreeting('晚上好，卸下一身疲惫');
  }, []);

  // Handle Add or Update
  const handleSaveEntry = (formData: Omit<DiaryEntry, 'id' | 'timestamp'> & { id?: string, timestamp?: number }) => {
    if (formData.id) {
        // --- Update Existing Entry ---
        const updatedEntry: DiaryEntry = {
            id: formData.id,
            timestamp: formData.timestamp || Date.now(),
            content: formData.content,
            mood: formData.mood,
            moodScore: formData.moodScore,
            tags: formData.tags
        };

        setEntries(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e));

        // Trigger AI Re-scoring
        evaluateMoodScore(updatedEntry.mood, updatedEntry.content)
            .then((aiScore) => {
                if (aiScore > 0) {
                    setEntries(currentEntries => 
                        currentEntries.map(e => e.id === updatedEntry.id ? { ...e, moodScore: aiScore } : e)
                    );
                }
            })
            .catch(console.error);

    } else {
        // --- Add New Entry ---
        const id = crypto.randomUUID();
        const now = new Date();
        let timestamp = now.getTime();
        
        // If adding to a past date selected in calendar
        const isSameDay = (d1: Date, d2: Date) => 
          d1.getDate() === d2.getDate() &&
          d1.getMonth() === d2.getMonth() &&
          d1.getFullYear() === d2.getFullYear();

        if (!isSameDay(selectedDate, now)) {
           const targetTime = new Date(selectedDate);
           targetTime.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
           timestamp = targetTime.getTime();
        }

        const newEntry: DiaryEntry = {
          id,
          timestamp,
          content: formData.content,
          mood: formData.mood,
          moodScore: formData.moodScore,
          tags: formData.tags
        };
        
        setEntries(prev => [newEntry, ...prev]);

        // Background AI Scoring
        evaluateMoodScore(newEntry.mood, newEntry.content)
          .then((aiScore) => {
            if (aiScore > 0) {
              setEntries(currentEntries => 
                currentEntries.map(e => e.id === id ? { ...e, moodScore: aiScore } : e)
              );
            }
          })
          .catch(console.error);
    }
  };

  const deleteEntry = (id: string) => {
    if (confirm("确定要删除这条记录吗？")) {
      const newEntries = entries.filter(e => e.id !== id);
      setEntries(newEntries);
      if (newEntries.length === 0) {
         localStorage.setItem('soulmirror_diary', JSON.stringify([]));
      }
    }
  };

  const saveDailyNote = (dateStr: string, content: string) => {
    setDailyNotes(prev => {
      const updated = { ...prev, [dateStr]: content };
      localStorage.setItem('soulmirror_daily_notes', JSON.stringify(updated));
      return updated;
    });
  };

  const getMoodConfig = (moodLabel: string) => {
    return MOOD_OPTIONS.find(m => m.label === moodLabel) || 
           customMoods.find(m => m.label === moodLabel) || 
           MOOD_OPTIONS[2];
  };

  // Sort by time ascending for the timeline view
  const timelineEntries = entries
    .filter(entry => {
      const entryDate = new Date(entry.timestamp);
      return entryDate.getDate() === selectedDate.getDate() &&
             entryDate.getMonth() === selectedDate.getMonth() &&
             entryDate.getFullYear() === selectedDate.getFullYear();
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  const getSelectedDateStr = () => {
    return selectedDate.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
  };

  const currentDailyNote = dailyNotes[getSelectedDateStr()] || '';

  const copyDailySummary = () => {
    if (timelineEntries.length === 0 && !currentDailyNote) return;
    const dateStr = selectedDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    let summaryText = "";
    if (currentDailyNote) {
       const tempDiv = document.createElement("div");
       tempDiv.innerHTML = currentDailyNote;
       const noteText = tempDiv.innerText;
       summaryText += `📝 每日随笔：\n${noteText}\n\n`;
    }
    if (timelineEntries.length > 0) {
        const entriesText = timelineEntries
          .map(entry => {
            const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
            return `⏰ ${time} | ${entry.mood} ${entry.moodScore > 0 ? `(${entry.moodScore.toFixed(1)}分)` : ''}\n${entry.content}`;
          })
          .join('\n\n------------------\n\n');
        summaryText += `💫 心情记录：\n${entriesText}`;
    }
    const finalContent = `📅 ${dateStr} 心情日记\n\n${summaryText}\n\n✨ 来自 SoulMirror`;
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

  return (
    <div className="min-h-screen text-slate-800 flex flex-col font-sans">
      
      {viewMode === ViewMode.TIMELINE ? (
        <>
          <CalendarStrip 
            selectedDate={selectedDate} 
            onSelectDate={setSelectedDate} 
          />
          
          <main className="flex-1 px-4 pt-4 pb-28 overflow-y-auto no-scrollbar">
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

            {/* Daily Mood Chart */}
            {timelineEntries.length > 0 && (
              <div className="mb-6 h-48 animate-in fade-in slide-in-from-bottom-6 duration-700">
                 <DailyMoodChart entries={timelineEntries} />
              </div>
            )}
            
            {/* Daily Rich Text Note */}
            <div className="mb-6 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
              <DailyNoteEditor 
                dateStr={getSelectedDateStr()}
                initialContent={currentDailyNote}
                onSave={saveDailyNote}
              />
            </div>

            {timelineEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center animate-in fade-in duration-1000">
                 <div className="text-gray-300 text-sm font-medium">
                    今天还没有具体的心情卡片记录...
                 </div>
              </div>
            ) : (
              <div className="glass-card rounded-[32px] p-6 animate-in slide-in-from-bottom-8 duration-500 min-h-[200px]">
                {timelineEntries.map((entry, index) => {
                  const moodConfig = getMoodConfig(entry.mood);
                  const isLast = index === timelineEntries.length - 1;
                  
                  return (
                    <TimelineItem 
                        key={entry.id}
                        entry={entry}
                        moodConfig={moodConfig}
                        isLast={isLast}
                        onEdit={openEditModal}
                    />
                  );
                })}
              </div>
            )}
          </main>
        </>
      ) : (
        <div className="flex-1 px-4 pt-safe-top pb-24 overflow-y-auto no-scrollbar">
           <div className="flex justify-between items-center mb-6 px-2">
              <h2 className="text-2xl font-bold text-gray-800 tracking-tight">AI 情绪洞察</h2>
           </div>
          <Dashboard entries={entries} />
        </div>
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
          </button>

          <div className="w-[1px] h-8 bg-gray-200/50"></div>

          <button
            onClick={() => setViewMode(ViewMode.ANALYSIS)}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
              viewMode === ViewMode.ANALYSIS ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <div className={`transition-transform duration-300 ${viewMode === ViewMode.ANALYSIS ? 'scale-110 -translate-y-1' : ''}`}>
              <ICONS.Sparkles />
            </div>
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
    </div>
  );
};

export default App;
