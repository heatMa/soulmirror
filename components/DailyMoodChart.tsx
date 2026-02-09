
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Scatter, ComposedChart } from 'recharts';
import { DiaryEntry } from '../types';
import { MOOD_OPTIONS, MoodOption, getHexFromTailwind } from '../constants';

interface Props {
  entries: DiaryEntry[];
  customMoods?: MoodOption[];
}

interface ChartDataPoint {
  hour: number;
  score: number | null;
  mood?: string;
  content?: string;
  time?: string;
  hexColor?: string;
}

interface TimeRangeSettings {
  startHour: number;
  endHour: number;
}

const DEFAULT_TIME_RANGE: TimeRangeSettings = {
  startHour: 6,
  endHour: 18
};

// 从 localStorage 读取用户设置的时间范围
const getStoredTimeRange = (): TimeRangeSettings => {
  try {
    const stored = localStorage.getItem('soulmirror_chart_time_range');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load time range settings', e);
  }
  return DEFAULT_TIME_RANGE;
};

// 保存时间范围到 localStorage
const saveTimeRange = (range: TimeRangeSettings) => {
  try {
    localStorage.setItem('soulmirror_chart_time_range', JSON.stringify(range));
  } catch (e) {
    console.error('Failed to save time range settings', e);
  }
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    if (data.score === null) return null;

    return (
      <div className="bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-white/50 text-left z-50">
        <div className="flex items-center gap-2 mb-1">
           <span className="text-xs text-gray-400 font-mono">{data.time}</span>
           <span
             className="text-xs font-bold"
             style={{ color: data.hexColor || '#64748b' }}
           >
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

// 自定义数据点组件
const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (payload.score === null || cx === undefined || cy === undefined) return null;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={payload.hexColor || '#4f46e5'}
      stroke="white"
      strokeWidth={2}
      style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
    />
  );
};

const DailyMoodChart: React.FC<Props> = ({ entries, customMoods = [] }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRangeSettings>(getStoredTimeRange);
  const [tempStartHour, setTempStartHour] = useState(timeRange.startHour);
  const [tempEndHour, setTempEndHour] = useState(timeRange.endHour);

  // 获取所有心情配置（内置 + 自定义）
  const allMoodConfigs = [...MOOD_OPTIONS, ...customMoods];

  // 根据心情标签获取颜色
  const getMoodHexColor = (moodLabel: string): string => {
    const config = allMoodConfigs.find(m => m.label === moodLabel);
    if (config) {
      return config.hexColor || getHexFromTailwind(config.color);
    }
    return '#64748b';
  };

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
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        hexColor: getMoodHexColor(e.mood)
      };
    });

  // 获取当前小时用于显示参考线
  const currentHour = new Date().getHours() + new Date().getMinutes() / 60;

  // 生成横轴刻度
  const generateTicks = () => {
    const { startHour, endHour } = timeRange;
    const ticks = [startHour];
    const mid = Math.floor((startHour + endHour) / 2);
    if (mid !== startHour && mid !== endHour) {
      ticks.push(mid);
    }
    ticks.push(endHour);
    return ticks;
  };

  // 保存时间范围设置
  const handleSaveSettings = () => {
    if (tempStartHour >= tempEndHour) {
      alert('开始时间必须早于结束时间');
      return;
    }
    const newRange = { startHour: tempStartHour, endHour: tempEndHour };
    setTimeRange(newRange);
    saveTimeRange(newRange);
    setShowSettings(false);
  };

  // 重置为默认
  const handleResetSettings = () => {
    setTempStartHour(DEFAULT_TIME_RANGE.startHour);
    setTempEndHour(DEFAULT_TIME_RANGE.endHour);
  };

  return (
    <div className="w-full h-full glass-card rounded-[2rem] p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-white/30 to-transparent pointer-events-none" />

      {/* 标题和设置按钮 */}
      <div className="flex items-center justify-between mb-2 pl-1">
        <h4 className="text-xs font-bold text-gray-400">今日情绪波动</h4>
        <button
          onClick={() => {
            setTempStartHour(timeRange.startHour);
            setTempEndHour(timeRange.endHour);
            setShowSettings(!showSettings);
          }}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="设置时间范围"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <div className="absolute top-12 right-4 bg-white rounded-xl shadow-lg border border-gray-100 p-3 z-20 animate-in fade-in slide-in-from-top-2">
          <div className="text-xs font-bold text-gray-600 mb-2">显示时间范围</div>
          <div className="flex items-center gap-2 mb-3">
            <select
              value={tempStartHour}
              onChange={(e) => setTempStartHour(Number(e.target.value))}
              className="px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
              ))}
            </select>
            <span className="text-gray-400">至</span>
            <select
              value={tempEndHour}
              onChange={(e) => setTempEndHour(Number(e.target.value))}
              className="px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              {Array.from({ length: 25 }, (_, i) => (
                <option key={i} value={i}>{i === 24 ? '24:00' : `${i.toString().padStart(2, '0')}:00`}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleResetSettings}
              className="flex-1 px-2 py-1 text-xs text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              重置
            </button>
            <button
              onClick={handleSaveSettings}
              className="flex-1 px-2 py-1 text-xs text-white bg-indigo-500 rounded-lg hover:bg-indigo-600"
            >
              确定
            </button>
          </div>
        </div>
      )}

      <div className="h-[calc(100%-1.5rem)] w-full -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={entryPoints} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
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
              domain={[timeRange.startHour, timeRange.endHour]}
              axisLine={false}
              tickLine={false}
              tick={{fontSize: 9, fill: '#9ca3af'}}
              ticks={generateTicks()}
              tickFormatter={(value) => `${Math.floor(value)}:00`}
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
              dot={<CustomDot />}
              activeDot={{ r: 6, strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DailyMoodChart;
