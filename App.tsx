
import React, { useState, useEffect } from 'react';
import { DiaryEntry, ViewMode } from './types';
import DiaryEntryForm from './components/DiaryEntryForm';
import Dashboard from './components/Dashboard';
import CalendarStrip from './components/CalendarStrip';
import { ICONS, MOOD_OPTIONS, MoodOption } from './constants';
import { evaluateMoodScore } from './services/geminiService';

const App: React.FC = () => {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.TIMELINE);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [customMoods, setCustomMoods] = useState<MoodOption[]>([]);

  // Load entries ONLY on mount
  useEffect(() => {
    const savedEntries = localStorage.getItem('soulmirror_diary');
    if (savedEntries) {
      try {
        setEntries(JSON.parse(savedEntries));
      } catch (e) { console.error("Failed to load diary entries"); }
    }
  }, []);

  // Load custom moods on mount AND when form closes (to sync new tags)
  useEffect(() => {
    const savedCustomMoods = localStorage.getItem('soulmirror_custom_moods');
    if (savedCustomMoods) {
      try {
        setCustomMoods(JSON.parse(savedCustomMoods));
      } catch (e) { console.error("Failed to load custom moods"); }
    }
  }, [showAddForm]); 

  // Save to localStorage whenever entries change
  useEffect(() => {
    if (entries.length > 0) {
      localStorage.setItem('soulmirror_diary', JSON.stringify(entries));
    } else {
      // Handle empty state case if needed, or just allow saving empty array if initialized
      const saved = localStorage.getItem('soulmirror_diary');
      if (!saved && entries.length === 0) return; // Nothing to save yet
      localStorage.setItem('soulmirror_diary', JSON.stringify(entries));
    }
  }, [entries]);

  const addEntry = (newEntry: Omit<DiaryEntry, 'id' | 'timestamp'>) => {
    const id = crypto.randomUUID();
    
    // Determine timestamp:
    const now = new Date();
    let timestamp = now.getTime();
    
    const isSameDay = (d1: Date, d2: Date) => {
      return d1.getDate() === d2.getDate() &&
             d1.getMonth() === d2.getMonth() &&
             d1.getFullYear() === d2.getFullYear();
    };

    if (!isSameDay(selectedDate, now)) {
       const targetTime = new Date(selectedDate);
       // Use current time of day but on the selected date
       targetTime.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
       timestamp = targetTime.getTime();
    }

    const entry: DiaryEntry = {
      ...newEntry,
      id,
      timestamp
    };
    
    // 1. Update state
    setEntries(prev => [entry, ...prev]);

    // 2. Background AI Processing for Score Correction
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

  const isDaytime = (date: Date) => {
    const hour = date.getHours();
    return hour >= 6 && hour < 18;
  };

  const timelineEntries = entries.filter(entry => {
    const entryDate = new Date(entry.timestamp);
    return entryDate.getDate() === selectedDate.getDate() &&
           entryDate.getMonth() === selectedDate.getMonth() &&
           entryDate.getFullYear() === selectedDate.getFullYear();
  });

  return (
    <div className="min-h-screen bg-[#F7F8FC] text-slate-900 flex flex-col font-[Noto+Sans+SC]">
      
      {viewMode === ViewMode.TIMELINE ? (
        <>
          <CalendarStrip 
            selectedDate={selectedDate} 
            onSelectDate={setSelectedDate} 
          />
          
          <main className="flex-1 px-4 pt-6 pb-28 overflow-y-auto no-scrollbar">
            {timelineEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in duration-500">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-3xl shadow-inner grayscale opacity-50">
                  📅
                </div>
                <h3 className="text-lg font-bold text-gray-500">这一天是空白的</h3>
                <p className="text-gray-400 text-sm mt-2 max-w-[200px]">如果这是今天，不妨记录下现在的心情？</p>
              </div>
            ) : (
              <div className="space-y-0 animate-in slide-in-from-bottom-2 duration-300">
                <div className="text-center mb-6">
                   <span className="bg-white/50 px-4 py-1.5 rounded-full text-xs text-gray-500 backdrop-blur-sm">日记记录</span>
                </div>

                {timelineEntries.map((entry, index) => {
                  const date = new Date(entry.timestamp);
                  const isDay = isDaytime(date);
                  const moodConfig = getMoodConfig(entry.mood);
                  const isLast = index === timelineEntries.length - 1;

                  return (
                    <div key={entry.id} className="flex gap-3 mb-1">
                      {/* Left: Time */}
                      <div className="w-14 pt-4 text-right flex-shrink-0">
                        <span className="block text-lg font-bold text-gray-700 leading-none">
                          {date.getHours()}
                          <span className="text-xs align-top ml-0.5 font-normal text-gray-400">
                             :{date.getMinutes().toString().padStart(2, '0')}
                          </span>
                        </span>
                        <span className="text-[10px] text-gray-300 font-medium tracking-wide">
                           {date.getHours() < 12 ? 'AM' : 'PM'}
                        </span>
                      </div>

                      {/* Center: Line & Icon */}
                      <div className="relative flex flex-col items-center w-8 flex-shrink-0 pt-3">
                        {!isLast && (
                          <div className="absolute top-8 bottom-[-24px] w-[2px] bg-indigo-50/80 z-0"></div>
                        )}
                        <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-[3px] border-[#F7F8FC] ${isDay ? 'bg-amber-100 text-amber-500' : 'bg-indigo-100 text-indigo-500'}`}>
                           {isDay ? <ICONS.Sun /> : <ICONS.Moon />}
                        </div>
                      </div>

                      {/* Right: Card */}
                      <div 
                        className="flex-1 pb-6 min-w-0"
                        onClick={() => deleteEntry(entry.id)}
                      >
                         <div className={`rounded-2xl p-4 shadow-md relative overflow-hidden group active:scale-[0.99] transition-all border border-white/20 ${moodConfig.color} ${moodConfig.shadow || 'shadow-gray-200'}`}>
                            
                            {/* Score Badge */}
                            <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/10 shadow-sm">
                              <span className="text-xs font-bold text-white tracking-wide">
                                {entry.moodScore.toFixed(1)} <span className="text-[9px] opacity-80 font-normal">AI</span>
                              </span>
                            </div>

                            <div> 
                              <div className="flex items-center gap-2 mb-2 pr-12">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-white/90 shadow-sm ${moodConfig.color.replace('bg-', 'text-')}`}>
                                   <span className="text-sm">{moodConfig.emoji || '🏷️'}</span>
                                   {entry.mood}
                                </span>
                              </div>
                              <p className="text-sm text-white/95 font-medium leading-relaxed break-words line-clamp-4">
                                {entry.content}
                              </p>
                            </div>
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
        <div className="flex-1 px-4 pt-16 pb-24 overflow-y-auto no-scrollbar">
           <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">情绪洞察</h2>
           </div>
          <Dashboard entries={entries} />
        </div>
      )}

      {/* Floating Action Button */}
      {viewMode === ViewMode.TIMELINE && (
        <div className="fixed bottom-[88px] right-6 z-50">
          <button
            onClick={() => setShowAddForm(true)}
            className="w-14 h-14 bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-200 flex items-center justify-center transition-all hover:scale-105 active:scale-95 active:bg-blue-600"
          >
            <ICONS.Plus />
          </button>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 pb-safe-bottom h-[72px] z-40 flex justify-around items-center shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.02)] rounded-t-[20px]">
        <button
          onClick={() => setViewMode(ViewMode.TIMELINE)}
          className={`flex flex-col items-center justify-center w-full h-full gap-1 ${
            viewMode === ViewMode.TIMELINE ? 'text-blue-500' : 'text-gray-300'
          }`}
        >
          <div className={`transition-transform duration-200 ${viewMode === ViewMode.TIMELINE ? 'scale-110' : ''}`}>
             <ICONS.Home />
          </div>
          <span className="text-[10px] font-bold">日历</span>
        </button>

        <button
          onClick={() => setViewMode(ViewMode.ANALYSIS)}
          className={`flex flex-col items-center justify-center w-full h-full gap-1 ${
            viewMode === ViewMode.ANALYSIS ? 'text-blue-500' : 'text-gray-300'
          }`}
        >
          <div className={`transition-transform duration-200 ${viewMode === ViewMode.ANALYSIS ? 'scale-110' : ''}`}>
            <ICONS.Sparkles />
          </div>
          <span className="text-[10px] font-bold">洞察</span>
        </button>
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
