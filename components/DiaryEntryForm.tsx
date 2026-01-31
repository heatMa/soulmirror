
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
  // Single selection mode now
  const [selectedMood, setSelectedMood] = useState<MoodOption>(MOOD_OPTIONS[2]); // Default to Calm
  const [customMoods, setCustomMoods] = useState<MoodOption[]>([]);
  const [newMoodInput, setNewMoodInput] = useState('');
  const [isAddingMood, setIsAddingMood] = useState(false);
  const [isGeneratingTag, setIsGeneratingTag] = useState(false);

  // Load custom moods from localStorage
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

  // Save custom moods to localStorage
  const saveCustomMood = (newMood: MoodOption) => {
    // Check if exists
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
      // AI Magic to get emoji and color
      const metadata = await generateMoodMetadata(trimmed);
      
      const newMoodOption: MoodOption = {
        label: trimmed,
        value: trimmed, // simple value
        score: metadata.score || 5,
        emoji: metadata.emoji || '🏷️',
        color: metadata.color || 'bg-slate-400',
        shadow: `shadow-${(metadata.color || 'bg-slate-400').split('-')[1]}-200`, // Approximation
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
    
    // Instant save - AI scoring for the content happens in background in App.tsx
    onSave({
      content,
      mood: selectedMood.label,
      moodScore: selectedMood.score, // Use the base score of the mood first
      tags: [selectedMood.label] // Single tag is the mood itself
    });
    
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>

      {/* Bottom Sheet Card */}
      <div className="bg-white w-full rounded-t-[2rem] sm:rounded-[2rem] sm:max-w-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 z-10 flex flex-col h-[90vh] sm:h-[85vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-20">
          <h2 className="text-lg font-bold text-gray-800">记录此刻心情</h2>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* Mood Selection */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-gray-700 flex justify-between items-center">
              1. 感觉如何?
              <span className="text-[10px] text-gray-400 font-normal">选择最贴切的一个</span>
            </label>
            
            <div className="flex flex-wrap gap-2">
              {MOOD_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setSelectedMood(m)}
                  className={`px-3 py-2.5 rounded-xl flex items-center gap-1.5 transition-all border ${
                    selectedMood.label === m.label
                      ? 'bg-gray-900 border-gray-900 text-white shadow-md scale-105'
                      : 'bg-white border-gray-100 text-gray-600 hover:bg-gray-50'
                  } active:scale-95`}
                >
                  <span className="text-base">{m.emoji}</span>
                  <span className="text-xs font-medium">{m.label}</span>
                </button>
              ))}

              {customMoods.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setSelectedMood(m)}
                  className={`px-3 py-2.5 rounded-xl flex items-center gap-1.5 transition-all border ${
                    selectedMood.label === m.label
                      ? 'bg-gray-900 border-gray-900 text-white shadow-md scale-105'
                      : 'bg-white border-gray-100 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-base">{m.emoji}</span>
                  <span className="text-xs font-medium">{m.label}</span>
                </button>
              ))}

              {!isAddingMood ? (
                <button
                  type="button"
                  onClick={() => setIsAddingMood(true)}
                  className="px-3 py-2.5 rounded-xl flex items-center gap-1.5 transition-all border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500"
                >
                  <span className="text-base">+</span>
                  <span className="text-xs font-medium">自定义</span>
                </button>
              ) : (
                <div className="flex gap-2 w-full items-center animate-in fade-in bg-gray-50 p-2 rounded-xl border border-indigo-100">
                  <input
                    autoFocus
                    type="text"
                    value={newMoodInput}
                    onChange={(e) => setNewMoodInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNewMood()}
                    placeholder="输入心情关键词..."
                    disabled={isGeneratingTag}
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                  />
                  <button 
                    type="button" 
                    onClick={handleAddNewMood} 
                    disabled={isGeneratingTag}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 min-w-[60px] flex justify-center"
                  >
                    {isGeneratingTag ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : 'AI 生成'}
                  </button>
                </div>
              )}
            </div>
            {isGeneratingTag && <p className="text-xs text-indigo-500 animate-pulse">AI 正在分析语义，生成专属配色和图标...</p>}
          </div>

          {/* Content Textarea */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-gray-700">2. 发生了什么?</label>
            <textarea
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="记录下这一刻的思绪..."
              className="w-full h-48 p-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all resize-none text-gray-700 text-base leading-relaxed outline-none"
            />
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-5 border-t border-gray-100 bg-white pb-safe-bottom">
          <button
            onClick={handleSubmit}
            className={`w-full py-4 font-bold rounded-2xl shadow-lg transition-all active:scale-95 text-lg flex items-center justify-center gap-2 text-white ${selectedMood.color} ${selectedMood.shadow}`}
          >
            完成记录
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiaryEntryForm;
