
import React, { useState } from 'react';
import { DiaryEntry } from '../types';
import { MoodOption, ICONS } from '../constants';

interface Props {
  entry: DiaryEntry;
  moodConfig: MoodOption;
  isLast: boolean;
  onEdit: (entry: DiaryEntry) => void;
}

const TimelineItem: React.FC<Props> = ({ entry, moodConfig, isLast, onEdit }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const date = new Date(entry.timestamp);
  
  // 简单的文字颜色映射，模拟截图风格
  const getTextColor = () => {
     if (moodConfig.color.includes('rose') || moodConfig.color.includes('fuchsia')) return 'text-rose-500';
     if (moodConfig.color.includes('amber')) return 'text-amber-600';
     if (moodConfig.color.includes('emerald') || moodConfig.color.includes('teal')) return 'text-emerald-600';
     return 'text-slate-600';
  };

  const timeString = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex gap-4 relative">
      {/* Left Timeline Line */}
      <div className="flex flex-col items-center">
        {/* The Icon Node */}
        <div className={`z-10 w-4 h-4 mt-1 rounded-full flex items-center justify-center text-[10px] shadow-sm ${getTextColor()}`}>
           {/* 使用简单的 Font Awesome 风格的心形，或者直接用 Emoji 如果 moodConfig 没有 heart */}
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
             <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
           </svg>
        </div>
        
        {/* The Vertical Line */}
        {!isLast && (
          <div className="flex-1 w-[2px] bg-emerald-100/80 my-1 rounded-full"></div>
        )}
      </div>

      {/* Right Content */}
      <div className="flex-1 pb-8">
         {/* Header: Label, Time, Edit */}
         <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
               <span className={`text-base font-bold ${getTextColor()}`}>
                 {entry.mood}
               </span>
               <div className="flex items-baseline gap-2">
                   <span className="text-sm font-medium text-gray-400 font-mono tracking-tight">
                     {timeString}
                   </span>
                   {entry.moodScore > 0 && (
                     <span className={`text-sm font-bold ${getTextColor()}`}>
                       {entry.moodScore.toFixed(1)}分
                     </span>
                   )}
               </div>
            </div>
            
            <button 
              onClick={() => onEdit(entry)}
              className="p-1.5 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
            >
               <ICONS.Pen />
            </button>
         </div>

         {/* Content Body */}
         <div 
           className="text-gray-600 text-[15px] leading-7 font-medium cursor-pointer"
           onClick={() => setIsExpanded(!isExpanded)}
         >
            <div className={`transition-all duration-300 whitespace-pre-wrap ${!isExpanded ? 'line-clamp-2' : ''}`}>
               {entry.content}
            </div>
            {!isExpanded && (
               <div className="text-xs text-emerald-500 font-bold mt-1">展开全文</div>
            )}
         </div>
      </div>
    </div>
  );
};

export default TimelineItem;
