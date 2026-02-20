
import React, { useState, useEffect } from 'react';
import { DiaryEntry } from '../types';

interface Props {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  entries?: DiaryEntry[];
}

const CalendarStrip: React.FC<Props> = ({ selectedDate, onSelectDate, entries = [] }) => {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date(selectedDate);
    const day = d.getDay(); 
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  });

  useEffect(() => {
    const selectedTime = new Date(selectedDate).setHours(0,0,0,0);
    const weekStart = new Date(currentWeekStart);
    weekStart.setHours(0,0,0,0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    if (selectedTime < weekStart.getTime() || selectedTime >= weekEnd.getTime()) {
        const d = new Date(selectedDate);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const newStart = new Date(d);
        newStart.setDate(diff);
        setCurrentWeekStart(newStart);
    }
  }, [selectedDate]);

  const changeWeek = (offset: number) => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + (offset * 7));
    setCurrentWeekStart(newStart);
  };

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(currentWeekStart);
    d.setDate(currentWeekStart.getDate() + i);
    weekDays.push(d);
  }

  const weekNames = ['日', '一', '二', '三', '四', '五', '六'];
  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getDate() === d2.getDate() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getFullYear() === d2.getFullYear();
  };

  // 获取某一天的记录列表
  const getEntriesForDate = (date: Date): DiaryEntry[] => {
    return entries.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      return isSameDay(entryDate, date);
    });
  };

  // 获取某一天的代表颜色（取第一条记录的心情颜色）
  const getDateColor = (date: Date): string | null => {
    const dayEntries = getEntriesForDate(date);
    if (dayEntries.length === 0) return null;
    
    // 返回第一条记录的心情颜色，如果没有则使用默认颜色
    return dayEntries[0].moodHexColor || '#3B82F6';
  };

  return (
    <div className="pt-safe-top pb-2 px-4 sticky top-0 z-30 transition-all duration-300">
      <div className="glass rounded-[2rem] p-4 shadow-sm">
        <div className="flex justify-between items-end mb-4 px-2">
          <h1 className="text-xl font-bold text-gray-800 font-sans tracking-tight">
             {selectedDate.getMonth() + 1}月 <span className="text-sm font-normal text-gray-400">{selectedDate.getFullYear()}</span>
          </h1>
          <div className="flex gap-1">
            <button 
              onClick={() => changeWeek(-1)}
              className="p-1.5 bg-white/50 text-gray-600 rounded-full hover:bg-white active:scale-95 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button 
              onClick={() => changeWeek(1)}
              className="p-1.5 bg-white/50 text-gray-600 rounded-full hover:bg-white active:scale-95 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-2 text-center">
          {weekDays.map((date, idx) => {
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, new Date());
            const hasEntries = getEntriesForDate(date).length > 0;
            const dateColor = getDateColor(date);
            
            return (
              <button 
                key={idx} 
                onClick={() => onSelectDate(date)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl py-2.5 transition-all duration-300 ${
                  isSelected 
                    ? 'bg-gray-800 text-white shadow-lg shadow-gray-300 scale-105' 
                    : 'text-gray-400 hover:bg-white/60'
                }`}
              >
                <span className={`text-[10px] font-medium ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                  {weekNames[date.getDay()]}
                </span>
                <span className={`text-base font-bold ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                  {date.getDate()}
                </span>
                
                <div className="h-1 flex items-center justify-center">
                  {isSelected && (
                    <div className="w-1 h-1 bg-white rounded-full"></div>
                  )}
                  {!isSelected && hasEntries && dateColor && (
                    <div 
                      className="w-1 h-1 rounded-full" 
                      style={{ backgroundColor: dateColor }}
                    ></div>
                  )}
                  {!isSelected && !hasEntries && isToday && (
                    <div className="w-1 h-1 bg-rose-400 rounded-full"></div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CalendarStrip;
