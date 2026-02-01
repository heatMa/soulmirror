
import React, { useState, useEffect } from 'react';
import { DiaryEntry } from '../types';
import { MOOD_OPTIONS, MoodOption } from '../constants';
import { generateMoodMetadata } from '../services/geminiService';

interface Props {
  onSave: (entry: Omit<DiaryEntry, 'id' | 'timestamp'>) => void;
  onClose: () => void;
}

const DiaryEntryForm: React.FC<Props> = ({ onSave, onClose }) => {
  const [content, setContent] = useState('');
  const [selectedMood, setSelectedMood] = useState<MoodOption>(MOOD_OPTIONS[2]); 
  const [customMoods, setCustomMoods] = useState<MoodOption[]>([]);
  const [newMoodInput, setNewMoodInput] = useState('');
  const [isAddingMood, setIsAddingMood] = useState(false);
  const [isGeneratingTag, setIsGeneratingTag] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('soulmirror_custom_moods');
    if (saved) {
      try {
        setCustomMoods(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load custom moods");
      }
    }
  }, []);

  const saveCustomMood = (newMood: MoodOption) => {
    if (customMoods.some(m => m.label === newMood.label) || MOOD_OPTIONS.some(m => m.label === newMood.label)) {
      return;
    }
    const updated = [...customMoods, newMood];
    setCustomMoods(updated);
    localStorage.setItem('soulmirror_custom_moods', JSON.stringify(updated));
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
    if (!content.trim()) return;
    
    onSave({
      content,
      mood: selectedMood.label,
      moodScore: selectedMood.score,
      tags: [selectedMood.label]
    });
    
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div 
        className="absolute inset-0 bg-gray-900/30 backdrop-blur-[2px] transition-opacity" 
        onClick={onClose}
      ></div>

      <div className="bg-white/90 backdrop-blur-xl w-full rounded-t-[2.5rem] sm:rounded-[2.5rem] sm:max-w-lg shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] overflow-hidden animate-in slide-in-from-bottom duration-500 z-10 flex flex-col h-[92vh] sm:h-[85vh]">
        
        <div className="p-6 flex justify-between items-center sticky top-0 z-20">
          <div>
            <h2 className="text-xl font-bold text-gray-800">此刻的心情</h2>
            <p className="text-xs text-gray-400 mt-0.5">诚实面对自己的内心</p>
          </div>
          <button onClick={onClose} className="p-2.5 bg-gray-100/50 rounded-full text-gray-500 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 pb-6 space-y-8">
          
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {MOOD_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setSelectedMood(m)}
                  className={`px-4 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 border min-w-[70px] ${
                    selectedMood.label === m.label
                      ? `bg-gray-800 border-gray-800 text-white shadow-xl shadow-gray-200 transform scale-105`
                      : 'bg-white border-white text-gray-500 hover:bg-white/80 shadow-sm'
                  }`}
                >
                  <span className="text-2xl filter drop-shadow-sm">{m.emoji}</span>
                  <span className="text-[11px] font-bold">{m.label}</span>
                </button>
              ))}

              {customMoods.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setSelectedMood(m)}
                  className={`px-4 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 border min-w-[70px] ${
                    selectedMood.label === m.label
                      ? `bg-gray-800 border-gray-800 text-white shadow-xl shadow-gray-200 transform scale-105`
                      : 'bg-white border-white text-gray-500 hover:bg-white/80 shadow-sm'
                  }`}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-[11px] font-bold">{m.label}</span>
                </button>
              ))}

              {!isAddingMood ? (
                <button
                  type="button"
                  onClick={() => setIsAddingMood(true)}
                  className="px-4 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500 min-w-[70px]"
                >
                  <span className="text-2xl">+</span>
                  <span className="text-[11px] font-medium">自定义</span>
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

          <div className="space-y-4">
            <textarea
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="在这里写下你的思绪，无论是开心还是难过，我都会倾听..."
              className="w-full h-56 p-6 bg-white border-none rounded-3xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.03)] focus:shadow-[inset_0_2px_15px_rgba(0,0,0,0.05)] focus:ring-0 transition-all resize-none text-gray-700 text-lg leading-relaxed outline-none placeholder:text-gray-300"
            />
          </div>
        </form>

        <div className="p-6 bg-white/50 backdrop-blur-md pb-safe-bottom">
          <button
            onClick={handleSubmit}
            className={`w-full py-4 font-bold rounded-2xl shadow-lg shadow-indigo-200/50 transition-all active:scale-95 text-lg flex items-center justify-center gap-2 text-white bg-gray-900 hover:bg-black`}
          >
            记录这一刻
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiaryEntryForm;
