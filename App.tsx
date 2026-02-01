
import React, { useState, useEffect } from 'react';
import { DiaryEntry, ViewMode } from './types';
import DiaryEntryForm from './components/DiaryEntryForm';
import Dashboard from './components/Dashboard';
import CalendarStrip from './components/CalendarStrip';
import DailyMoodChart from './components/DailyMoodChart';
import { ICONS, MOOD_OPTIONS, MoodOption } from './constants';
import { evaluateMoodScore } from './services/geminiService';

const App: React.FC = () => {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.TIMELINE);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [customMoods, setCustomMoods] = useState<MoodOption[]>([]);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const savedEntries = localStorage.getItem('soulmirror_diary');
    if (savedEntries) {
      try {
        setEntries(JSON.parse(savedEntries));
      } catch (e) { console.error("Failed to load diary entries"); }
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

  const addEntry = (newEntry: Omit<DiaryEntry, 'id' | 'timestamp'>) => {
    const id = crypto.randomUUID();
    const now = new Date();
    let timestamp = now.getTime();
    
    const isSameDay = (d1: Date, d2: Date) => {
      return d1.getDate() === d2.getDate() &&
             d1.getMonth() === d2.getMonth() &&
             d1.getFullYear() === d2.getFullYear();
    };

    if (!isSameDay(selectedDate, now)) {
       const targetTime = new Date(selectedDate);
       targetTime.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
       timestamp = targetTime.getTime();
    }

    const entry: DiaryEntry = {
      ...newEntry,
      id,
      timestamp
    };
    
    setEntries(prev => [entry, ...prev]);

    evaluateMoodScore(entry.mood, entry.content)
      .then((aiScore) => {
        if (aiScore > 0) {
          setEntries(currentEntries => 
            currentEntries.map(e => e.id === id ? { ...e, moodScore: aiScore } : e)
          );
        }
      })
      .catch((error) => {
        console.error("Background AI scoring failed", error);
      });
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

  const getMoodConfig = (moodLabel: string) => {
    return MOOD_OPTIONS.find(m => m.label === moodLabel) || 
           customMoods.find(m => m.label === moodLabel) || 
           MOOD_OPTIONS[2];
  };

  const timelineEntries = entries.filter(entry => {
    const entryDate = new Date(entry.timestamp);
    return entryDate.getDate() === selectedDate.getDate() &&
           entryDate.getMonth() === selectedDate.getMonth() &&
           entryDate.getFullYear() === selectedDate.getFullYear();
  });

  return (
    <div className="min-h-screen text-slate-800 flex flex-col font-sans">
      
      {viewMode === ViewMode.TIMELINE ? (
        <>
          <CalendarStrip 
            selectedDate={selectedDate} 
            onSelectDate={setSelectedDate} 
          />
          
          <main className="flex-1 px-4 pt-4 pb-28 overflow-y-auto no-scrollbar">
            {/* Header Greeting */}
            <div className="mb-6 mt-2 px-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
               <h2 className="text-2xl font-bold text-gray-800 tracking-tight">{greeting}</h2>
               <p className="text-sm text-gray-500/80 mt-1 font-medium">今天感觉如何？</p>
            </div>

            {/* Daily Mood Chart */}
            {timelineEntries.length > 0 && (
              <div className="mb-8 h-48 animate-in fade-in slide-in-from-bottom-6 duration-700">
                 <DailyMoodChart entries={timelineEntries} />
              </div>
            )}

            {timelineEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-1000">
                <div className="w-24 h-24 bg-white/40 backdrop-blur-sm rounded-full flex items-center justify-center mb-6 shadow-sm border border-white/40">
                  <span className="text-4xl opacity-50 grayscale">🌿</span>
                </div>
                <h3 className="text-lg font-bold text-gray-600">一片宁静</h3>
                <p className="text-gray-400 text-sm mt-2 font-medium">此刻无声胜有声<br/>或者，记录下这点滴？</p>
                <button 
                  onClick={() => setShowAddForm(true)}
                  className="mt-8 px-6 py-2.5 bg-white text-gray-800 rounded-full text-sm font-bold shadow-sm border border-white/60 hover:bg-gray-50 transition-colors"
                >
                  记一笔
                </button>
              </div>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500">
                {timelineEntries.map((entry, index) => {
                  const date = new Date(entry.timestamp);
                  const moodConfig = getMoodConfig(entry.mood);
                  
                  return (
                    <div key={entry.id} className="relative pl-4">
                      {/* Timeline Line */}
                      {index !== timelineEntries.length - 1 && (
                        <div className="absolute left-[27px] top-10 bottom-[-24px] w-[2px] bg-gradient-to-b from-gray-200/50 to-transparent z-0 rounded-full"></div>
                      )}

                      <div className="flex gap-4 items-start group">
                         {/* Icon Column */}
                         <div className="flex-shrink-0 z-10 pt-1">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-[0_8px_16px_-4px_rgba(0,0,0,0.05)] bg-white border border-white/50`}>
                               {moodConfig.emoji}
                            </div>
                         </div>

                         {/* Content Card */}
                         <div 
                           className="flex-1 glass-card rounded-[24px] p-5 relative overflow-hidden active:scale-[0.98] transition-transform duration-200"
                           onClick={() => deleteEntry(entry.id)}
                         >
                            <div className="flex justify-between items-start mb-3">
                               <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-gray-400 font-mono bg-white/50 px-2 py-0.5 rounded-md">
                                    {date.getHours().toString().padStart(2, '0')}:{date.getMinutes().toString().padStart(2, '0')}
                                  </span>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md bg-white/50 ${moodConfig.color.replace('bg-', 'text-').replace('500', '600')}`}>
                                    {entry.mood}
                                  </span>
                               </div>
                               <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${moodConfig.color}`}>
                                  {entry.moodScore.toFixed(0)}
                               </div>
                            </div>
                            
                            <p className="text-[15px] text-gray-700 leading-relaxed font-medium">
                               {entry.content}
                            </p>
                         </div>
                      </div>
                    </div>
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
            onClick={() => setShowAddForm(true)}
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
          onSave={addEntry} 
          onClose={() => setShowAddForm(false)} 
        />
      )}
    </div>
  );
};

export default App;
