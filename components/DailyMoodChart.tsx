
import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Scatter, ComposedChart, Bar, Cell } from 'recharts';
import { DiaryEntry } from '../types';
import { MOOD_OPTIONS, MoodOption, getHexFromTailwind } from '../constants';
import { calculateDailyEnergy, DAILY_STARTING_ENERGY } from '../utils/energyUtils';

interface Props {
  entries: DiaryEntry[];
  customMoods?: MoodOption[];
}

interface ChartDataPoint {
  hour: number;
  energy: number | null; // 累计电量
  delta?: number; // 本次能量变化
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
  endHour: 24
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
    if (data.energy === null) return null;

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
        <div className="text-[11px] font-mono text-gray-700 mt-1">
          <span>剩余: {Math.round(data.energy)}分</span>
          {data.delta !== undefined && (
            <span className="ml-2" style={{ color: data.delta >= 0 ? '#10b981' : '#f43f5e' }}>
              {data.delta >= 0 ? '+' : ''}{data.delta}分
            </span>
          )}
        </div>
      </div>
    );
  }
  return null;
};

// 自定义数据点组件
const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (payload.energy === null || cx === undefined || cy === undefined) return null;

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
  const getMoodHexColor = (moodLabel: string, entry?: DiaryEntry): string => {
    // 优先使用 entry 保存的颜色
    if (entry?.moodHexColor) {
      return entry.moodHexColor;
    }
    const config = allMoodConfigs.find(m => m.label === moodLabel);
    if (config) {
      return config.hexColor || getHexFromTailwind(config.color);
    }
    return '#64748b';
  };

  if (!entries || entries.length === 0) return null;

  // 计算累计电量数据
  const energyLevels = useMemo(() => calculateDailyEnergy(entries), [entries]);

  // 将条目转换为图表数据点（包含累计电量）
  const entryPoints: ChartDataPoint[] = useMemo(() => {
    const points = [...entries]
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((e, index) => {
        const date = new Date(e.timestamp);
        const hour = date.getHours() + date.getMinutes() / 60;
        return {
          hour,
          energy: energyLevels[index],
          delta: e.energyDelta ?? e.moodScore ?? 0,  // 确保 delta 始终有值
          mood: e.mood,
          content: e.content,
          time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          hexColor: getMoodHexColor(e.mood, e)
        };
      });

    // 调试：打印数据点信息
    console.log('DailyMoodChart entryPoints:', points.map(p => ({
      hour: p.hour,
      delta: p.delta,
      energy: p.energy
    })));

    return points;
  }, [entries, energyLevels]);

  // 获取当前小时用于显示参考线
  const currentHour = new Date().getHours() + new Date().getMinutes() / 60;

  // 计算当天情绪电量的平均值
  const averageEnergy = useMemo(() => {
    if (entryPoints.length === 0) return DAILY_STARTING_ENERGY;
    return entryPoints.reduce((sum, point) => sum + (point.energy || 0), 0) / entryPoints.length;
  }, [entryPoints]);

  // 计算图表的最大电量值（用于动态Y轴范围）
  const maxEnergy = useMemo(() => {
    if (entryPoints.length === 0) return DAILY_STARTING_ENERGY;
    const max = Math.max(...entryPoints.map(p => p.energy || 0));
    return Math.max(DAILY_STARTING_ENERGY, max + 10);
  }, [entryPoints]);

  // 右侧 Y 轴固定范围：-10 到 +10
  const maxDelta = 10;

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
          <ComposedChart data={entryPoints} margin={{ top: 5, right: 35, left: -20, bottom: 0 }}>
            {/* 移除渐变色背景 */}
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
            <XAxis
              dataKey="hour"
              type="number"
              domain={[timeRange.startHour, timeRange.endHour]}
              allowDataOverflow={true}
              axisLine={false}
              tickLine={false}
              tick={{fontSize: 9, fill: '#9ca3af'}}
              ticks={generateTicks()}
              tickFormatter={(value) => `${Math.floor(value)}:00`}
            />
            {/* 左侧Y轴：累计能量 */}
            <YAxis
              yAxisId="left"
              domain={[0, maxEnergy]}
              axisLine={false}
              tickLine={false}
              tick={{fontSize: 9, fill: '#9ca3af'}}
              ticks={[0, 50, 100, Math.round(maxEnergy)]}
            />
            {/* 右侧Y轴：能量变化量（固定范围 -10 到 +10） */}
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[-10, 10]}
              axisLine={false}
              tickLine={false}
              tick={{fontSize: 9, fill: '#9ca3af'}}
              ticks={[-10, -5, 0, 5, 10]}
              width={35}
            />
            <ReferenceLine x={currentHour} stroke="#e5e7eb" strokeDasharray="3 3" />
            {/* 100分基准线（左轴） */}
            <ReferenceLine
              yAxisId="left"
              y={DAILY_STARTING_ENERGY}
              stroke="#10b981"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{
                value: '100',
                position: 'left',
                fontSize: 9,
                fill: '#10b981',
                fontWeight: 'bold'
              }}
            />
            {/* 平均电量虚线（左轴） */}
            <ReferenceLine
              yAxisId="left"
              y={averageEnergy}
              stroke="#f43f5e"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{
                value: `平均${averageEnergy.toFixed(0)}`,
                position: 'right',
                fontSize: 9,
                fill: '#f43f5e',
                fontWeight: 'bold'
              }}
            />
            {/* 变化量的零线（右轴） */}
            <ReferenceLine
              yAxisId="right"
              y={0}
              stroke="rgba(0,0,0,0.1)"
              strokeWidth={0.5}
            />
            <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            {/* 能量变化柱状图（右轴，双向） - 先渲染在背景 */}
            <Bar
              yAxisId="right"
              dataKey="delta"
              animationDuration={800}
              barSize={10}
              maxBarSize={10}
              radius={[4, 4, 4, 4]}
            >
              {entryPoints.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.delta && entry.delta > 0 ? '#10b981' : '#f43f5e'}
                  opacity={0.5}
                />
              ))}
            </Bar>
            {/* 累计能量曲线（左轴） - 后渲染在前景 */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="energy"
              stroke="#3b82f6"
              strokeWidth={3}
              fillOpacity={0}
              fill="none"
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
