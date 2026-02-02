
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { DiaryEntry } from '../types';
import { MOOD_OPTIONS } from '../constants';

interface Props {
  entries: DiaryEntry[];
}

interface ChartDataPoint {
  hour: number;
  score: number | null;
  mood?: string;
  content?: string;
  time?: string;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    if (data.score === null) return null;

    const moodConfig = MOOD_OPTIONS.find(m => m.label === data.mood);
    let finalTextColor = 'text-gray-800';
    if (moodConfig?.color.includes('rose')) finalTextColor = 'text-rose-500';
    else if (moodConfig?.color.includes('amber')) finalTextColor = 'text-amber-500';
    else if (moodConfig?.color.includes('emerald')) finalTextColor = 'text-emerald-500';
    else if (moodConfig?.color.includes('teal')) finalTextColor = 'text-teal-500';
    else if (moodConfig?.color.includes('cyan')) finalTextColor = 'text-cyan-500';
    else if (moodConfig?.color.includes('violet')) finalTextColor = 'text-violet-500';
    else if (moodConfig?.color.includes('fuchsia')) finalTextColor = 'text-fuchsia-500';

    return (
      <div className="bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-white/50 text-left z-50">
        <div className="flex items-center gap-2 mb-1">
           <span className="text-xs text-gray-400 font-mono">{data.time}</span>
           <span className={`text-xs font-bold ${finalTextColor}`}>
             {data.mood}
           </span>
        </div>
        <p className="text-[10px] text-gray-600 line-clamp-1 max-w-[120px]">
            {data.content}
        </p>
      </div>
    );
  }
  return null;
};

const DailyMoodChart: React.FC<Props> = ({ entries }) => {
  if (!entries || entries.length === 0) return null;

  // 将条目转换为以小时为横轴的数据点
  const entryPoints: ChartDataPoint[] = [...entries]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(e => {
      const date = new Date(e.timestamp);
      const hour = date.getHours() + date.getMinutes() / 60;
      return {
        hour,
        score: e.moodScore,
        mood: e.mood,
        content: e.content,
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    });

  // 获取当前小时用于显示参考线
  const currentHour = new Date().getHours() + new Date().getMinutes() / 60;

  return (
    <div className="w-full h-full glass-card rounded-[2rem] p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-white/30 to-transparent pointer-events-none" />
      <h4 className="text-xs font-bold text-gray-400 mb-2 pl-1">今日情绪波动</h4>
      <div className="h-[calc(100%-1.5rem)] w-full -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={entryPoints} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorScoreDaily" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
            <XAxis
              dataKey="hour"
              type="number"
              domain={[0, 24]}
              axisLine={false}
              tickLine={false}
              tick={{fontSize: 9, fill: '#9ca3af'}}
              ticks={[0, 6, 12, 18, 24]}
              tickFormatter={(value) => `${value}:00`}
            />
            <YAxis
              domain={[0, 10]}
              axisLine={false}
              tickLine={false}
              tick={{fontSize: 9, fill: '#9ca3af'}}
              ticks={[0, 5, 10]}
            />
            <ReferenceLine x={currentHour} stroke="#e5e7eb" strokeDasharray="3 3" />
            <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: '#4f46e5', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#4f46e5"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorScoreDaily)"
              animationDuration={1000}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DailyMoodChart;
