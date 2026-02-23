import React, { useMemo } from 'react';
import { DiaryEntry } from '../types';
import { MoodOption, getHexFromTailwind } from '../constants';

interface Props {
  entries: DiaryEntry[];
  allMoods: MoodOption[];
}

// 星期标签
const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

// 获取星期几 (0=周一, 6=周日)
const getWeekday = (timestamp: number): number => {
  const day = new Date(timestamp).getDay();
  return day === 0 ? 6 : day - 1; // 将周日从0改为6，周一从1改为0
};

const HeatmapChart: React.FC<Props> = ({ entries, allMoods }) => {
  // 构建热力图数据: 24小时 x 7天
  const heatmapData = useMemo(() => {
    // 初始化24x7矩阵
    const matrix: {
      count: number;
      avgScore: number;
      moods: Record<string, number>;
      dominantMood: string | null;
      dominantColor: string | null;
    }[][] = Array(7).fill(null).map(() =>
      Array(24).fill(null).map(() => ({
        count: 0,
        avgScore: 0,
        moods: {},
        dominantMood: null,
        dominantColor: null
      }))
    );

    // 填充数据
    entries.forEach(entry => {
      const weekday = getWeekday(entry.timestamp);
      const hour = new Date(entry.timestamp).getHours();

      const cell = matrix[weekday][hour];
      cell.count++;
      cell.avgScore = ((cell.avgScore * (cell.count - 1)) + entry.moodScore) / cell.count;
      cell.moods[entry.mood] = (cell.moods[entry.mood] || 0) + 1;
    });

    // 计算每个格子的主导情绪
    matrix.forEach(row => {
      row.forEach(cell => {
        if (cell.count > 0) {
          const sortedMoods = Object.entries(cell.moods).sort((a, b) => b[1] - a[1]);
          if (sortedMoods.length > 0) {
            cell.dominantMood = sortedMoods[0][0];
            const moodConfig = allMoods.find(m => m.label === cell.dominantMood);
            cell.dominantColor = moodConfig?.hexColor || getHexFromTailwind(moodConfig?.color || 'bg-gray-400');
          }
        }
      });
    });

    return matrix;
  }, [entries, allMoods]);

  // 找出最大计数用于计算透明度
  const maxCount = useMemo(() => {
    let max = 0;
    heatmapData.forEach(row => {
      row.forEach(cell => {
        if (cell.count > max) max = cell.count;
      });
    });
    return max || 1;
  }, [heatmapData]);

  // 小时标签 (只显示部分)
  const hourLabels = [0, 6, 12, 18, 23];

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[320px]">
        {/* 小时标签行 */}
        <div className="flex mb-1">
          <div className="w-8 flex-shrink-0" /> {/* 占位 */}
          <div className="flex-1 grid gap-[1px]" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
            {Array(24).fill(0).map((_, hour) => (
              <div
                key={hour}
                className="text-center text-[9px] text-gray-400"
              >
                {hourLabels.includes(hour) ? `${hour}` : ''}
              </div>
            ))}
          </div>
        </div>

        {/* 热力图主体 */}
        {WEEKDAYS.map((day, weekdayIndex) => (
          <div key={day} className="flex items-center mb-[2px]">
            {/* 星期标签 */}
            <div className="w-8 flex-shrink-0 text-[10px] text-gray-500 font-medium pr-1 text-right">
              {day}
            </div>

            {/* 24小时格子 */}
            <div className="flex-1 grid gap-[1px]" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
              {heatmapData[weekdayIndex].map((cell, hour) => {
                const opacity = cell.count > 0 ? Math.max(0.2, cell.count / maxCount) : 0;
                const bgColor = cell.dominantColor || '#e5e7eb';

                return (
                  <div
                    key={hour}
                    className="aspect-square rounded-[2px] transition-all hover:scale-110 cursor-pointer group relative"
                    style={{
                      backgroundColor: cell.count > 0 ? bgColor : '#f1f5f9',
                      opacity: cell.count > 0 ? opacity : 1,
                      maxHeight: '14px' // 限制格子高度，使热力图更紧凑
                    }}
                    title={cell.count > 0
                      ? `${day} ${hour}:00 - ${cell.dominantMood} (${cell.count}次)`
                      : `${day} ${hour}:00 - 无记录`
                    }
                  >
                    {/* Tooltip */}
                    {cell.count > 0 && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                        <div className="bg-gray-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                          {cell.dominantMood} ×{cell.count}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* 图例说明 */}
        <div className="flex items-center justify-between mt-3 text-[10px] text-gray-400">
          <span>颜色 = 心情主题色</span>
          <div className="flex items-center gap-2">
            <span>透明度：少</span>
            <div className="flex gap-0.5">
              {[0.2, 0.4, 0.6, 0.8, 1].map((opacity) => (
                <div
                  key={opacity}
                  className="w-3 h-3 rounded-sm bg-gray-500"
                  style={{ opacity }}
                />
              ))}
            </div>
            <span>多</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeatmapChart;
