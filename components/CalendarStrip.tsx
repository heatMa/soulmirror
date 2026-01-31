
import React, { useState, useEffect } from 'react';

interface Props {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

const CalendarStrip: React.FC<Props> = ({ selectedDate, onSelectDate }) => {
  // State to track the start of the currently visible week
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const d = new Date(selectedDate);
    const day = d.getDay(); // 0 (Sun) to 6 (Sat)
    // Adjust to make Monday the first day
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  });

  // Sync view when selectedDate changes (e.g., from outside navigation or today reset)
  useEffect(() => {
    const selectedTime = new Date(selectedDate).setHours(0,0,0,0);
    
    // Calculate start and end of current visible week
    const weekStart = new Date(currentWeekStart);
    weekStart.setHours(0,0,0,0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // If selectedDate is outside current view, update view to show it
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

  // Generate the 7 days for the current view
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

  return (
    <div className="bg-white pt-safe-top pb-4 px-4 border-b border-gray-100 shadow-[0_4px_20px_-12px_rgba(0,0,0,0.05)] sticky top-0 z-30">
      <div className="flex justify-between items-end mb-4 px-2">
         <h1 className="text-xl font-bold text-gray-900 font-mono">
           {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月
         </h1>
         <div className="flex gap-2">
           <button 
             onClick={() => changeWeek(-1)}
             className="p-2 bg-gray-50 text-gray-600 rounded-full hover:bg-gray-100 active:scale-95 transition-all"
           >
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
           </button>
           <button 
             onClick={() => changeWeek(1)}
             className="p-2 bg-gray-50 text-gray-600 rounded-full hover:bg-gray-100 active:scale-95 transition-all"
           >
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
           </button>
         </div>
      </div>
      
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekDays.map((date, idx) => {
          const isSelected = isSameDay(date, selectedDate);
          const isToday = isSameDay(date, new Date());
          
          return (
            <button 
              key={idx} 
              onClick={() => onSelectDate(date)}
              className={`flex flex-col items-center gap-1 rounded-2xl py-2 transition-all active:scale-95 ${
                isSelected 
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-200' 
                  : 'text-gray-400 hover:bg-gray-50'
              }`}
            >
              <span className={`text-[10px] font-medium ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                {weekNames[date.getDay()]}
              </span>
              <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                {date.getDate()}
              </span>
              
              {/* Dot indicators */}
              <div className="h-1.5 flex items-center justify-center">
                {isToday && !isSelected && (
                  <div className="w-1 h-1 bg-blue-400 rounded-full"></div>
                )}
                {isSelected && (
                  <div className="w-1 h-1 bg-white rounded-full"></div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarStrip;
