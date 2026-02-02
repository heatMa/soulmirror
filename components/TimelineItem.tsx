
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
        {/* The Emoji Node */}
        <div className="z-10 w-6 h-6 mt-1 flex items-center justify-center text-base">
           {moodConfig.emoji}
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
            <div
              className={`transition-all duration-300 ${!isExpanded ? 'line-clamp-2' : ''}`}
              dangerouslySetInnerHTML={{ __html: entry.content }}
            />
            {!isExpanded && (
               <div className="text-xs text-emerald-500 font-bold mt-1">展开全文</div>
            )}
         </div>
      </div>
    </div>
  );
};

export default TimelineItem;
