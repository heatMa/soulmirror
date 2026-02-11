
import React, { useState, useRef } from 'react';
import { DiaryEntry } from '../types';
import { MoodOption, ICONS, getHexFromTailwind } from '../constants';
import { getEntryDurationDisplay } from '../utils/timeUtils';
import { formatEnergyDisplay } from '../utils/energyUtils';

interface Props {
  entry: DiaryEntry;
  moodConfig: MoodOption;
  isLast: boolean;
  onEdit: (entry: DiaryEntry) => void;
  onDelete: (entry: DiaryEntry) => void;
  onEndMood?: (entry: DiaryEntry) => void; // 点击"结束"时的回调
  countToday: number;
  countWeek: number;
  countMonth: number;
  energyRemaining?: number; // 该条记录后的剩余电量
}

const TimelineItem: React.FC<Props> = ({
  entry,
  moodConfig,
  isLast,
  onEdit,
  onDelete,
  onEndMood,
  countToday,
  countWeek,
  countMonth,
  energyRemaining,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showDeleteBtn, setShowDeleteBtn] = useState(false);

  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const DELETE_THRESHOLD = 80;
  const DELETE_BTN_WIDTH = 70;

  const date = new Date(entry.timestamp);
  const moodHexColor = moodConfig.hexColor || getHexFromTailwind(moodConfig.color);
  const timeString = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const durationDisplay = getEntryDurationDisplay(entry);

  const toggleCollapse = () => {
    if (!showDeleteBtn) {
      setIsCollapsed(!isCollapsed);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchStartX.current - touchCurrentX.current;

    if (diff > 0) {
      const offset = Math.min(diff, DELETE_BTN_WIDTH + 20);
      setSwipeOffset(offset);
    } else if (!showDeleteBtn) {
      setSwipeOffset(Math.max(0, -diff * 0.3));
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset > DELETE_THRESHOLD) {
      setSwipeOffset(DELETE_BTN_WIDTH);
      setShowDeleteBtn(true);
    } else {
      setSwipeOffset(0);
      setShowDeleteBtn(false);
    }
  };

  const handleContentClick = () => {
    if (showDeleteBtn) {
      setSwipeOffset(0);
      setShowDeleteBtn(false);
    }
  };

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

  const handleDelete = () => {
    if (
      confirm(
        `确定要删除这条记录吗？\n\n「${entry.mood}」- ${entry.content.replace(/<[^>]*>/g, '').slice(0, 30)}...`
      )
    ) {
      onDelete(entry);
    } else {
      setSwipeOffset(0);
      setShowDeleteBtn(false);
    }
  };

  const handleEndMood = () => {
    if (onEndMood) {
      onEndMood(entry);
      setSwipeOffset(0);
      setShowDeleteBtn(false);
    }
  };

  return (
    <div className="relative overflow-hidden" ref={containerRef}>
      {/* 删除按钮 */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-red-500 text-white font-bold transition-all"
        style={{ width: DELETE_BTN_WIDTH, opacity: swipeOffset > 20 ? 1 : 0 }}
      >
        <button
          onClick={handleDelete}
          className="w-full h-full flex items-center justify-center gap-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          <span className="text-xs">删除</span>
        </button>
      </div>

      {/* 主内容区域 */}
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
          <div
            className="z-10 w-6 h-6 mt-1 flex items-center justify-center cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse();
            }}
          >
            <svg
              className={`w-3 h-3 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
              fill={moodHexColor}
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          {!isLast && (
            <div
              className="flex-1 w-[2px] my-1 rounded-full"
              style={{ backgroundColor: moodHexColor, opacity: 0.3 }}
            ></div>
          )}
        </div>

        {/* Right Content */}
        <div className={`flex-1 ${isCollapsed ? 'pb-4' : 'pb-8'}`}>
          {/* Header: Emoji, Label, Time, Score, Edit */}
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={(e) => {
              if (!showDeleteBtn) toggleCollapse();
            }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base">{moodConfig.emoji}</span>
              <span className="text-base font-bold" style={{ color: moodHexColor }}>
                {entry.mood}
              </span>
              <span className="text-[11px] font-medium text-gray-400 tracking-tight">
                今{countToday}・周{countWeek}・月{countMonth}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-gray-400 font-mono tracking-tight">
                  {timeString}
                </span>
                {entry.energyDelta !== undefined && energyRemaining !== undefined && (
                  <span className="text-sm font-bold" style={{ color: entry.energyDelta >= 0 ? '#10b981' : '#f43f5e' }}>
                    {formatEnergyDisplay(entry.energyDelta, energyRemaining)}
                  </span>
                )}
                {entry.energyDelta === undefined && entry.moodScore > 0 && (
                  <span className="text-sm font-bold" style={{ color: moodHexColor }}>
                    {entry.moodScore.toFixed(1)}分（旧系统）
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {entry.isActive && onEndMood && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEndMood();
                  }}
                  className="px-2 py-1 text-xs font-medium rounded-lg transition-colors"
                  style={{
                    backgroundColor: `${moodHexColor}20`,
                    color: moodHexColor,
                  }}
                >
                  结束
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(entry);
                }}
                className="p-1.5 hover:bg-gray-50 rounded-full transition-colors"
                style={{ color: moodHexColor }}
              >
                <ICONS.Pen />
              </button>
            </div>
          </div>

          {/* Duration Display */}
          {durationDisplay && (
            <div className="text-xs font-medium text-gray-500 mt-1">
              ⏱️ {durationDisplay}
            </div>
          )}

          {/* Content Body */}
          {!isCollapsed && (
            <>
              <div
                className="text-gray-600 text-[15px] leading-7 font-medium mt-2"
                dangerouslySetInnerHTML={{ __html: entry.content }}
              />

              {/* AI 暖心回复 */}
              {entry.aiReply && (
                <div
                  className="mt-3 pl-3 border-l-2"
                  style={{ borderColor: moodHexColor, opacity: 0.8 }}
                >
                  <p className="text-sm italic" style={{ color: moodHexColor }}>
                    <span className="not-italic mr-1">🤖</span>
                    {entry.aiReply}
                  </p>
                </div>
              )}

              {/* AI 情绪调节建议 */}
              {entry.aiSuggestions && entry.aiSuggestions.length > 0 && (
                <div
                  className="mt-3 rounded-xl p-3"
                  style={{ backgroundColor: `${moodHexColor}15` }}
                >
                  <div className="text-xs font-bold mb-2" style={{ color: moodHexColor }}>
                    💡 试试这样做：
                  </div>
                  <ul className="space-y-1">
                    {entry.aiSuggestions.map((suggestion, index) => (
                      <li key={index} className="text-sm" style={{ color: moodHexColor }}>
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
