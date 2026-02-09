import React, { useState, useMemo } from 'react';
import { DiaryEntry } from '../types';
import { MoodOption, getHexFromTailwind } from '../constants';

interface Props {
  entries: DiaryEntry[];
  allMoods: MoodOption[];  // 表单里的心情列表（内置+自定义）
}

type FilterMode = 'default' | 'all' | 'custom';

const MoodHourlyDistribution: React.FC<Props> = ({ entries, allMoods }) => {
  const [filterMode, setFilterMode] = useState<FilterMode>('default');
  const [selectedMoods, setSelectedMoods] = useState<Set<string>>(new Set());

  // 获取所有有记录的心情（按次数排序）
  const moodsWithRecords = useMemo(() => {
    const moodCounts: Record<string, number> = {};
    entries.forEach(entry => {
      moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;
    });
    return Object.entries(moodCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([mood]) => mood);
  }, [entries]);

  // 表单里的心情标签集合
  const formMoodLabels = useMemo(() => {
    return new Set(allMoods.map(m => m.label));
  }, [allMoods]);

  // 根据筛选模式决定要显示的心情
  const visibleMoods = useMemo(() => {
    if (filterMode === 'default') {
      // 默认模式：只显示表单里的心情（且有记录的）
      return moodsWithRecords.filter(mood => formMoodLabels.has(mood));
    } else if (filterMode === 'all') {
      // 全部模式：显示所有有记录的心情
      return moodsWithRecords;
    } else {
      // 自定义模式：显示选中的心情
      return moodsWithRecords.filter(mood => selectedMoods.has(mood));
    }
  }, [filterMode, moodsWithRecords, formMoodLabels, selectedMoods]);

  // 按心情分组，统计每个小时的出现次数
  const moodHourlyData = useMemo(() => {
    const result: {
      mood: string;
      config: MoodOption | undefined;
      hourly: number[];
      maxCount: number;
    }[] = [];

    visibleMoods.forEach(mood => {
      const hourly = new Array(24).fill(0);
      let maxCount = 0;

      entries
        .filter(e => e.mood === mood)
        .forEach(entry => {
          const hour = new Date(entry.timestamp).getHours();
          hourly[hour]++;
          if (hourly[hour] > maxCount) maxCount = hourly[hour];
        });

      result.push({
        mood,
        config: allMoods.find(m => m.label === mood),
        hourly,
        maxCount: maxCount || 1
      });
    });

    return result;
  }, [entries, allMoods, visibleMoods]);

  // 切换心情选中状态
  const toggleMood = (mood: string) => {
    const newSelected = new Set(selectedMoods);
    if (newSelected.has(mood)) {
      newSelected.delete(mood);
    } else {
      newSelected.add(mood);
    }
    setSelectedMoods(newSelected);
    setFilterMode('custom');
  };

  // 点击「默认」按钮
  const handleDefault = () => {
    setFilterMode('default');
    setSelectedMoods(new Set());
  };

  // 点击「全部」按钮
  const handleAll = () => {
    setFilterMode('all');
    setSelectedMoods(new Set(moodsWithRecords));
  };

  // 判断心情是否选中（用于按钮高亮）
  const isMoodSelected = (mood: string) => {
    if (filterMode === 'default') {
      return formMoodLabels.has(mood);
    } else if (filterMode === 'all') {
      return true;
    } else {
      return selectedMoods.has(mood);
    }
  };

  if (entries.length === 0) {
    return (
      <div className="text-center py-4">
        <span className="text-xs text-gray-400">暂无数据</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 筛选器 */}
      <div className="flex flex-wrap gap-1.5">
        {/* 快捷按钮 */}
        <button
          onClick={handleDefault}
          className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
            filterMode === 'default'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          默认
        </button>
        <button
          onClick={handleAll}
          className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
            filterMode === 'all'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          全部
        </button>

        <div className="w-px h-4 bg-gray-200 self-center mx-1" />

        {/* 心情按钮 */}
        {moodsWithRecords.map(mood => {
          const config = allMoods.find(m => m.label === mood);
          const hexColor = config?.hexColor || getHexFromTailwind(config?.color || 'bg-gray-400');
          const isSelected = isMoodSelected(mood);

          return (
            <button
              key={mood}
              onClick={() => toggleMood(mood)}
              className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1 ${
                isSelected
                  ? 'text-white shadow-sm'
                  : 'bg-gray-100 text-gray-400'
              }`}
              style={isSelected ? { backgroundColor: hexColor } : undefined}
            >
              <span>{config?.emoji || '🏷️'}</span>
              <span>{mood}</span>
            </button>
          );
        })}
      </div>

      {/* 时间刻度 */}
      <div className="flex items-center">
        <div className="w-16 shrink-0" /> {/* 占位，与心情标签对齐 */}
        <div className="flex-1 flex">
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} className="flex-1 text-center">
              {i % 6 === 0 && (
                <span className="text-[10px] text-gray-400">{i}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 每个心情的分布 */}
      {moodHourlyData.length === 0 ? (
        <div className="text-center py-4">
          <span className="text-xs text-gray-400">请选择要显示的心情</span>
        </div>
      ) : (
        moodHourlyData.map(({ mood, config, hourly, maxCount }) => {
          const hexColor = config?.hexColor || getHexFromTailwind(config?.color || 'bg-gray-400');

          return (
            <div key={mood} className="flex items-center gap-2">
              {/* 心情标签 */}
              <div className="w-16 shrink-0 flex items-center gap-1">
                <span className="text-base">{config?.emoji || '🏷️'}</span>
                <span className="text-xs text-gray-600 truncate">{mood}</span>
              </div>

              {/* 24小时热力图 */}
              <div className="flex-1 flex gap-[2px]">
                {hourly.map((count, hour) => {
                  const opacity = count > 0 ? Math.max(0.2, count / maxCount) : 0;
                  return (
                    <div
                      key={hour}
                      className="flex-1 h-6 rounded-[3px]"
                      style={{
                        backgroundColor: count > 0 ? hexColor : '#f1f5f9',
                        opacity: count > 0 ? opacity : 1
                      }}
                      title={`${hour}:00 - ${count}次`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default MoodHourlyDistribution;
