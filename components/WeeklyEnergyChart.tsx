import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { DiaryEntry } from '../types';
import { getWeeklyEnergyData } from '../utils/energyUtils';

interface Props {
  entries: DiaryEntry[];
}

const DAY_LABELS = ['', '一', '二', '三', '四', '五', '六', '日'];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-white/50 text-left z-50">
        <p className="text-xs font-bold text-gray-800">
          周{DAY_LABELS[data.day]}: {data.hasData ? Math.round(data.energy) : '无数据'}
        </p>
      </div>
    );
  }
  return null;
};

const WeeklyEnergyChart: React.FC<Props> = ({ entries }) => {
  const chartData = useMemo(() => {
    return getWeeklyEnergyData(entries);
  }, [entries]);

  const avgEnergy = useMemo(() => {
    const daysWithData = chartData.filter(d => d.hasData);
    if (daysWithData.length === 0) return 100;
    return daysWithData.reduce((sum, d) => sum + d.energy, 0) / daysWithData.length;
  }, [chartData]);

  const maxEnergy = useMemo(() => {
    const max = Math.max(...chartData.map(d => d.energy));
    return Math.max(100, max + 10);
  }, [chartData]);

  return (
    <div className="glass-card rounded-[2rem] p-4 w-full">
      <h3 className="text-sm font-bold text-gray-600 mb-3 px-1">
        过去一周电量 ⚡
      </h3>

      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickFormatter={(value) => DAY_LABELS[value]}
            />
            <YAxis
              domain={[0, (dataMax: number) => Math.max(100, dataMax + 10)]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 9, fill: '#9ca3af' }}
              ticks={[0, 50, 100]}
            />
            {/* 平均分虚线 */}
            <ReferenceLine
              y={avgEnergy}
              stroke="#f43f5e"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{
                value: `平均${Math.round(avgEnergy)}`,
                position: 'right',
                fontSize: 9,
                fill: '#f43f5e',
                fontWeight: 'bold'
              }}
            />
            {/* 100分基准线 */}
            <ReferenceLine
              y={100}
              stroke="#10b981"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{
                value: '100',
                position: 'insideTopLeft',
                fontSize: 8,
                fill: '#10b981',
                offset: 5
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="energy" radius={[4, 4, 0, 0]} animationDuration={1000}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.hasData ? '#4f46e5' : '#e5e7eb'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-center gap-4 mt-3 text-xs text-gray-500">
        <span>平均: <span className="font-bold text-rose-500">{Math.round(avgEnergy)}</span></span>
        <span>最高: <span className="font-bold text-indigo-600">{Math.round(Math.max(...chartData.map(d => d.energy)))}</span></span>
      </div>
    </div>
  );
};

export default WeeklyEnergyChart;
