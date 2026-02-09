
import React, { useState, useRef } from 'react';
import { DiaryEntry } from '../types';
import { MoodOption, ICONS, getHexFromTailwind } from '../constants';

interface Props {
  entry: DiaryEntry;
  moodConfig: MoodOption;
  isLast: boolean;
  onEdit: (entry: DiaryEntry) => void;
  onDelete: (entry: DiaryEntry) => void;
  countToday: number;
  countWeek: number;
  countMonth: number;
}

const TimelineItem: React.FC<Props> = ({ entry, moodConfig, isLast, onEdit, onDelete, countToday, countWeek, countMonth }) => {
  const [isCollapsed, setIsCollapsed] = useState(false); // 完全折叠状态
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showDeleteBtn, setShowDeleteBtn] = useState(false);

  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const DELETE_THRESHOLD = 80; // 滑动超过这个距离显示删除按钮
  const DELETE_BTN_WIDTH = 70; // 删除按钮宽度

  const date = new Date(entry.timestamp);

  // 获取心情的 hex 颜色
  const moodHexColor = moodConfig.hexColor || getHexFromTailwind(moodConfig.color);

  const timeString = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  // 切换折叠状态
  const toggleCollapse = () => {
    if (!showDeleteBtn) {
      setIsCollapsed(!isCollapsed);
    }
  };

  // 触摸开始
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
  };

  // 触摸移动
  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchStartX.current - touchCurrentX.current;

    // 只允许左滑（diff > 0）
    if (diff > 0) {
      // 限制最大滑动距离
      const offset = Math.min(diff, DELETE_BTN_WIDTH + 20);
      setSwipeOffset(offset);
    } else if (!showDeleteBtn) {
      // 右滑恢复
      setSwipeOffset(Math.max(0, -diff * 0.3));
    }
  };

  // 触摸结束
  const handleTouchEnd = () => {
    if (swipeOffset > DELETE_THRESHOLD) {
      // 超过阈值，显示删除按钮
      setSwipeOffset(DELETE_BTN_WIDTH);
      setShowDeleteBtn(true);
    } else {
      // 未超过阈值，恢复原位
      setSwipeOffset(0);
      setShowDeleteBtn(false);
    }
  };

  // 点击其他区域恢复
  const handleContentClick = () => {
    if (showDeleteBtn) {
      setSwipeOffset(0);
      setShowDeleteBtn(false);
    }
  };

  // 鼠标拖拽支持（网页端）
  const handleMouseDown = (e: React.MouseEvent) => {
    touchStartX.current = e.clientX;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = touchStartX.current - e.clientX;
      if (diff > 0) {
        const offset = Math.min(diff, DELETE_BTN_WIDTH + 20);
        setSwipeOffset(offset);
      }
    };

    const handleMouseUp = () => {
      if (swipeOffset > DELETE_THRESHOLD) {
        setSwipeOffset(DELETE_BTN_WIDTH);
        setShowDeleteBtn(true);
      } else {
        setSwipeOffset(0);
        setShowDeleteBtn(false);
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 删除确认
  const handleDelete = () => {
    if (confirm(`确定要删除这条记录吗？\n\n「${entry.mood}」- ${entry.content.replace(/<[^>]*>/g, '').slice(0, 30)}...`)) {
      onDelete(entry);
    } else {
      setSwipeOffset(0);
      setShowDeleteBtn(false);
    }
  };

  return (
    <div className="relative overflow-hidden" ref={containerRef}>
      {/* 删除按钮（在右侧） */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-red-500 text-white font-bold transition-all"
        style={{ width: DELETE_BTN_WIDTH, opacity: swipeOffset > 20 ? 1 : 0 }}
      >
        <button
          onClick={handleDelete}
          className="w-full h-full flex items-center justify-center gap-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="text-xs">删除</span>
        </button>
      </div>

      {/* 主内容区域（可滑动） */}
      <div
        className="flex gap-4 relative bg-white transition-transform"
        style={{ transform: `translateX(-${swipeOffset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onClick={handleContentClick}
      >
        {/* Left Timeline Line */}
        <div className="flex flex-col items-center">
          {/* 折叠三角按钮 - 使用心情颜色 */}
          <div
            className="z-10 w-6 h-6 mt-1 flex items-center justify-center cursor-pointer"
            onClick={(e) => { e.stopPropagation(); toggleCollapse(); }}
          >
            <svg
              className={`w-3 h-3 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
              fill={moodHexColor}
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>

          {/* The Vertical Line - 使用心情颜色 */}
          {!isLast && (
            <div
              className="flex-1 w-[2px] my-1 rounded-full"
              style={{ backgroundColor: moodHexColor, opacity: 0.3 }}
            ></div>
          )}
        </div>

        {/* Right Content */}
        <div className={`flex-1 ${isCollapsed ? 'pb-4' : 'pb-8'}`}>
           {/* Header: Emoji, Label, Time, Score, Edit - 可点击折叠 */}
           <div
             className="flex items-center justify-between cursor-pointer"
             onClick={(e) => {
               // 不阻止冒泡，让整行都可以点击折叠
               if (!showDeleteBtn) toggleCollapse();
             }}
           >
              <div className="flex items-center gap-2">
                 {/* Emoji */}
                 <span className="text-base">{moodConfig.emoji}</span>
                 <span
                   className="text-base font-bold"
                   style={{ color: moodHexColor }}
                 >
                   {entry.mood}
                 </span>
                 {/* 频次统计 */}
                 <span className="text-[11px] font-medium text-gray-400 tracking-tight">
                   今{countToday}・周{countWeek}・月{countMonth}
                 </span>
                 <div className="flex items-baseline gap-2">
                     <span className="text-sm font-medium text-gray-400 font-mono tracking-tight">
                       {timeString}
                     </span>
                     {entry.moodScore > 0 && (
                       <span
                         className="text-sm font-bold"
                         style={{ color: moodHexColor }}
                       >
                         {entry.moodScore.toFixed(1)}分
                       </span>
                     )}
                 </div>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); onEdit(entry); }}
                className="p-1.5 hover:bg-gray-50 rounded-full transition-colors"
                style={{ color: moodHexColor }}
              >
                 <ICONS.Pen />
              </button>
           </div>

           {/* Content Body - 折叠时隐藏 */}
           {!isCollapsed && (
             <>
               <div
                 className="text-gray-600 text-[15px] leading-7 font-medium mt-2"
                 dangerouslySetInnerHTML={{ __html: entry.content }}
               />

               {/* AI 暖心回复 - 使用心情颜色 */}
               {entry.aiReply && (
                 <div
                   className="mt-3 pl-3 border-l-2"
                   style={{ borderColor: moodHexColor, opacity: 0.8 }}
                 >
                   <p
                     className="text-sm italic"
                     style={{ color: moodHexColor }}
                   >
                     <span className="not-italic mr-1">🤖</span>
                     {entry.aiReply}
                   </p>
                 </div>
               )}

               {/* AI 情绪调节建议（仅负面情绪时显示） */}
               {entry.aiSuggestions && entry.aiSuggestions.length > 0 && (
                 <div
                   className="mt-3 rounded-xl p-3"
                   style={{ backgroundColor: `${moodHexColor}15` }}
                 >
                   <div
                     className="text-xs font-bold mb-2"
                     style={{ color: moodHexColor }}
                   >
                     💡 试试这样做：
                   </div>
                   <ul className="space-y-1">
                     {entry.aiSuggestions.map((suggestion, index) => (
                       <li
                         key={index}
                         className="text-sm"
                         style={{ color: moodHexColor }}
                       >
                         • {suggestion}
                       </li>
                     ))}
                   </ul>
                 </div>
               )}
             </>
           )}
        </div>
      </div>
    </div>
  );
};

export default TimelineItem;
