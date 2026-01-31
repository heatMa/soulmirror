
import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DiaryEntry, AIAnalysis } from '../types';
import { analyzeMoods } from '../services/geminiService';
import { ICONS, MOOD_OPTIONS } from '../constants';

interface Props {
  entries: DiaryEntry[];
}

type TimeRange = 'today' | 'week' | 'month';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    // Find config to match color
    const moodConfig = MOOD_OPTIONS.find(m => m.label === data.mood);
    // Convert bg-color to text-color for the tooltip text, roughly
    const textColorClass = moodConfig 
      ? moodConfig.color.replace('bg-', 'text-').replace('slate', 'gray') // simple mapping heuristic or just use the config color
      : 'text-gray-800';

    // Helper map for better text visibility if needed, or just rely on the bg class convention
    // Let's use specific text colors based on the bg class prefix for better contrast
    let finalTextColor = 'text-gray-800';
    if (moodConfig?.color.includes('rose')) finalTextColor = 'text-rose-500';
    else if (moodConfig?.color.includes('amber')) finalTextColor = 'text-amber-500';
    else if (moodConfig?.color.includes('sky')) finalTextColor = 'text-sky-500';
    else if (moodConfig?.color.includes('slate')) finalTextColor = 'text-slate-500';
    else if (moodConfig?.color.includes('indigo')) finalTextColor = 'text-indigo-500';
    else if (moodConfig?.color.includes('red')) finalTextColor = 'text-red-500';
    else if (moodConfig?.color.includes('gray')) finalTextColor = 'text-gray-600';

    return (
      <div className="bg-white px-4 py-3 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 text-left max-w-[220px]">
        <p className="text-[10px] text-gray-400 mb-1.5 font-medium tracking-wide">{data.time}</p>
        <div className="flex items-center justify-between gap-3 mb-2">
           <span className={`text-base font-black ${finalTextColor}`}>
             {data.mood}
           </span>
           <span className="text-xs font-bold text-white bg-indigo-500 px-2 py-0.5 rounded-md shadow-sm shadow-indigo-200">
             {Number(data.score).toFixed(1)}
           </span>
        </div>
        <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed border-t border-gray-50 pt-2">
            {data.content || "无详细内容"}
        </p>
      </div>
    );
  }
  return null;
};

const Dashboard: React.FC<Props> = ({ entries }) => {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('today');

  // Filter entries based on selected time range
  const filteredEntries = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    // Start of week (Monday)
    const dayOfWeek = now.getDay() || 7; // Treat Sunday as 7
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(now.getDate() - dayOfWeek + 1);
    
    // Start of month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return entries.filter(e => {
      if (timeRange === 'today') {
        return e.timestamp >= startOfToday;
      } else if (timeRange === 'week') {
        return e.timestamp >= startOfWeek.getTime();
      } else {
        return e.timestamp >= startOfMonth;
      }
    }).sort((a, b) => a.timestamp - b.timestamp);
  }, [entries, timeRange]);

  const chartData = filteredEntries.map(e => ({
    time: new Date(e.timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      month: timeRange !== 'today' ? 'numeric' : undefined,
      day: timeRange !== 'today' ? 'numeric' : undefined
    }),
    shortTime: timeRange === 'today' 
      ? new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : new Date(e.timestamp).toLocaleDateString([], { month: 'numeric', day: 'numeric' }),
    score: e.moodScore,
    mood: e.mood,
    content: e.content
  }));

  const handleAnalyze = async () => {
    if (filteredEntries.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeMoods(filteredEntries);
      setAnalysis(result);
    } catch (err) {
      setError("AI 休息中，请稍后再试...");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Time Range Selector */}
      <div className="flex justify-center">
        <div className="bg-gray-100 p-1 rounded-xl flex gap-1">
          {(['today', 'week', 'month'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => {
                setTimeRange(range);
                setAnalysis(null); // Clear previous analysis when range changes
              }}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                timeRange === range
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {range === 'today' ? '今天' : range === 'week' ? '本周' : '本月'}
            </button>
          ))}
        </div>
      </div>

      <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          <ICONS.Chart /> 情绪波动曲线
        </h3>
        
        {filteredEntries.length > 0 ? (
          <div className="h-64 w-full -ml-4"> {/* Negative margin to accommodate Y-axis width visually */}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="shortTime" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 10, fill: '#94a3b8'}} 
                  interval="preserveStartEnd"
                  padding={{ left: 10, right: 10 }}
                />
                <YAxis 
                  domain={[0, 10]} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 500}} 
                  ticks={[0, 2, 4, 6, 8, 10]}
                  width={35}
                />
                <Tooltip 
                  content={<CustomTooltip />}
                  cursor={{ stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                  isAnimationActive={false} // Improves performance on touch drag
                />
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#6366f1" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorScore)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-gray-300">
            <div className="mb-2 text-4xl">📉</div>
            <p className="text-sm">该时间段暂无记录</p>
          </div>
        )}
      </section>

      <section className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <ICONS.Brain /> AI 人生教练建议
          </h3>
          <button 
            onClick={handleAnalyze}
            disabled={loading || filteredEntries.length === 0}
            className={`px-6 py-2 rounded-full font-medium transition-all ${
              loading || filteredEntries.length === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700'
            }`}
          >
            {loading ? '分析中...' : '生成智能分析'}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-sm border border-rose-100">
            {error}
          </div>
        )}

        {!analysis && !loading && (
          <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
            <p className="text-gray-400">选择时间范围并点击按钮<br/>让 AI 教练为您解读情绪轨迹</p>
          </div>
        )}

        {analysis && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-3xl border border-indigo-100 shadow-sm">
                <p className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-2">心情晴雨表</p>
                <p className="text-gray-700 leading-relaxed font-medium">{analysis.summary}</p>
                <div className="mt-4 pt-4 border-t border-indigo-200/50 flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                    analysis.moodBarometer.trend === 'rising' ? 'bg-green-100 text-green-600' : 
                    analysis.moodBarometer.trend === 'falling' ? 'bg-rose-100 text-rose-600' : 
                    'bg-blue-100 text-blue-600'
                  }`}>
                    趋势: {analysis.moodBarometer.trend === 'rising' ? '回升' : analysis.moodBarometer.trend === 'falling' ? '波动' : '平稳'}
                  </span>
                  <span className="text-sm text-gray-600">{analysis.moodBarometer.explanation}</span>
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-3xl border border-emerald-100 shadow-sm">
                <p className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-2">亮点记录</p>
                <ul className="space-y-2">
                  {analysis.peaks.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-gray-700 text-sm">
                      <span className="text-emerald-500 mt-1">✨</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <p className="text-sm font-bold text-gray-800 mb-4">来自教练的建议</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {analysis.suggestions.map((s, i) => (
                  <div key={i} className="p-4 bg-gray-50 rounded-2xl text-sm text-gray-600 border border-gray-100 hover:border-indigo-200 transition-colors">
                    {s}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-rose-50/50 p-6 rounded-3xl border border-rose-100">
              <p className="text-sm font-bold text-rose-600 mb-2">需要关注的低谷</p>
              <ul className="space-y-2">
                {analysis.valleys.map((v, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span> {v}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
