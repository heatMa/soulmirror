import React, { useState, useMemo } from 'react';
import { DiaryEntry } from '../types';
import { MOOD_OPTIONS, MoodOption, getHexFromTailwind } from '../constants';

interface Props {
  entries: DiaryEntry[];  // 今日的条目
  allEntries: DiaryEntry[];  // 所有条目（用于计算连续天数）
  customMoods?: MoodOption[];
}

interface BlockData {
  id: string;
  score: number;
  mood: string;
  hexColor: string;
  emoji: string;
  time: string;
  content: string;
  widthPx: number;
}

const EnergyBattery: React.FC<Props> = ({ entries, allEntries, customMoods = [] }) => {
  const [selectedBlock, setSelectedBlock] = useState<BlockData | null>(null);
  const [containerWidth, setContainerWidth] = useState(300);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 块之间的间隙
  const GAP = 4;

  // 动态计算每1分对应的像素宽度
  // 目标：确保10个满分(10分)块 + 9个间隙能完整显示
  const pxPerScore = useMemo(() => {
    const availableWidth = containerWidth - 8; // 减去左右padding
    const maxTotalScore = 10 * 10; // 10个满分块
    const maxGaps = 9 * GAP; // 9个间隙
    return (availableWidth - maxGaps) / maxTotalScore;
  }, [containerWidth]);

  // 监听容器宽度变化
  React.useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // 获取所有心情配置（内置 + 自定义）
  const allMoodConfigs = [...MOOD_OPTIONS, ...customMoods];

  // 根据心情标签获取配置
  const getMoodConfig = (moodLabel: string): MoodOption | undefined => {
    return allMoodConfigs.find(m => m.label === moodLabel);
  };

  // 计算连续记录天数
  const streakDays = useMemo(() => {
    const datesWithEntries = new Set<string>();
    allEntries.forEach(entry => {
      const dateStr = new Date(entry.timestamp).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\//g, '-');
      datesWithEntries.add(dateStr);
    });

    let streak = 0;
    const today = new Date();

    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\//g, '-');

      if (datesWithEntries.has(dateStr)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    return streak;
  }, [allEntries]);

  // 计算历史最长连续天数
  const maxStreakDays = useMemo(() => {
    if (allEntries.length === 0) return 0;

    const datesWithEntries = new Set<string>();
    allEntries.forEach(entry => {
      const dateStr = new Date(entry.timestamp).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\//g, '-');
      datesWithEntries.add(dateStr);
    });

    // 转换为排序的日期数组
    const sortedDates = Array.from(datesWithEntries)
      .map(dateStr => new Date(dateStr))
      .sort((a, b) => a.getTime() - b.getTime());

    let maxStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = sortedDates[i - 1];
      const currDate = sortedDates[i];
      const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    return maxStreak;
  }, [allEntries]);

  // 计算总分数
  const totalScore = useMemo(() => {
    return entries.reduce((sum, entry) => sum + (entry.moodScore || 0), 0);
  }, [entries]);

  // 生成块数据（按时间顺序，最早的在左边）
  const blocks = useMemo((): BlockData[] => {
    if (entries.length === 0) return [];

    // 按时间正序排列（最早的在前面）
    const sortedEntries = [...entries].sort((a, b) => a.timestamp - b.timestamp);

    return sortedEntries.map(entry => {
      const config = getMoodConfig(entry.mood);
      const hexColor = config?.hexColor || getHexFromTailwind(config?.color || 'bg-gray-400');
      const score = entry.moodScore || 1;

      return {
        id: entry.id,
        score,
        mood: entry.mood,
        hexColor,
        emoji: config?.emoji || '🏷️',
        time: new Date(entry.timestamp).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        content: entry.content,
        widthPx: score * pxPerScore
      };
    });
  }, [entries, allMoodConfigs, pxPerScore]);

  // 计算缩放比例（当块总宽度超出容器时）
  const scaleFactor = useMemo(() => {
    if (blocks.length === 0) return 1;

    const availableWidth = containerWidth - 8; // 减去左右padding
    const totalBlocksWidth = blocks.reduce((sum, b) => sum + b.widthPx, 0);
    const totalGapsWidth = (blocks.length - 1) * GAP;
    const totalWidth = totalBlocksWidth + totalGapsWidth;

    if (totalWidth > availableWidth) {
      return availableWidth / totalWidth;
    }
    return 1;
  }, [blocks, containerWidth]);

  if (entries.length === 0) {
    return (
      <div className="w-full glass-card rounded-[2rem] p-5">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm font-bold text-gray-500">今日第 0 次</div>
          <div className="text-sm font-bold text-gray-400">总分: 0</div>
        </div>
        <div className="h-12 bg-gray-200/50 rounded-xl flex items-center justify-center">
          <span className="text-xs text-gray-400">记录心情后显示能量条</span>
        </div>
        <div className="mt-3 flex justify-center gap-3 text-xs">
          <span className="text-orange-500 font-medium">
            连续 {streakDays} 天
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-400 font-medium">
            最长 {maxStreakDays} 天
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full glass-card rounded-[2rem] p-5">
      {/* 顶部统计 */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm font-bold text-gray-600">
          今日第 <span className="text-lg text-gray-800">{entries.length}</span> 次
        </div>
        <div className="text-sm font-bold text-gray-600">
          总分: <span className="text-lg text-indigo-500">{totalScore.toFixed(1)}</span>
        </div>
      </div>

      {/* 能量条 */}
      <div
        ref={containerRef}
        className="relative h-12 bg-gray-200/50 rounded-xl overflow-hidden flex items-center p-1"
        style={{ gap: `${GAP * scaleFactor}px` }}
      >
        {blocks.map((block) => (
          <button
            key={block.id}
            onClick={() => setSelectedBlock(selectedBlock?.id === block.id ? null : block)}
            className={`h-full rounded-lg transition-all duration-200 hover:opacity-80 active:scale-95 flex-shrink-0 ${
              selectedBlock?.id === block.id ? 'ring-2 ring-gray-800 ring-offset-1' : ''
            }`}
            style={{
              width: `${block.widthPx * scaleFactor}px`,
              backgroundColor: block.hexColor,
            }}
            title={`${block.mood} ${block.score.toFixed(1)}分`}
          />
        ))}
      </div>

      {/* 气泡提示 */}
      {selectedBlock && (
        <div className="mt-3 p-3 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200"
          style={{ backgroundColor: `${selectedBlock.hexColor}15` }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{selectedBlock.emoji}</span>
            <span
              className="text-sm font-bold"
              style={{ color: selectedBlock.hexColor }}
            >
              {selectedBlock.mood}
            </span>
            <span className="text-xs text-gray-400">{selectedBlock.time}</span>
            <span
              className="text-xs font-bold ml-auto"
              style={{ color: selectedBlock.hexColor }}
            >
              {selectedBlock.score.toFixed(1)}分
            </span>
          </div>
          <div
            className="text-xs text-gray-600"
            dangerouslySetInnerHTML={{ __html: selectedBlock.content }}
          />
        </div>
      )}

      {/* 底部连续天数 */}
      <div className="mt-3 flex justify-center gap-3 text-xs">
        <span className="text-orange-500 font-medium">
          连续 {streakDays} 天
        </span>
        <span className="text-gray-300">·</span>
        <span className="text-gray-400 font-medium">
          最长 {maxStreakDays} 天
        </span>
      </div>
    </div>
  );
};

export default EnergyBattery;
