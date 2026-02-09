import React, { useMemo } from 'react';
import { DiaryEntry } from '../types';
import { MoodOption, getHexFromTailwind } from '../constants';

interface Props {
  entries: DiaryEntry[];
  allMoods: MoodOption[];
}

const MoodHourlyDistribution: React.FC<Props> = ({ entries, allMoods }) => {
  // 按心情分组，统计每个小时的出现次数
  const moodHourlyData = useMemo(() => {
    // 先统计每个心情的总次数
    const moodCounts: Record<string, number> = {};
    entries.forEach(entry => {
      moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;
    });

    // 按次数排序，保留所有心情
    const sortedMoods = Object.entries(moodCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([mood]) => mood);

    // 为每个心情统计24小时分布
    const result: {
      mood: string;
      config: MoodOption | undefined;
      hourly: number[];
      maxCount: number;
    }[] = [];

    sortedMoods.forEach(mood => {
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
  }, [entries, allMoods]);

  if (entries.length === 0) {
    return (
      <div className="text-center py-4">
        <span className="text-xs text-gray-400">暂无数据</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
      {moodHourlyData.map(({ mood, config, hourly, maxCount }) => {
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
      })}
    </div>
  );
};

export default MoodHourlyDistribution;
