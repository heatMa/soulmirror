
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
    const moodConfig = MOOD_OPTIONS.find(m => m.label === data.mood);
    let finalTextColor = 'text-gray-800';
    if (moodConfig?.color.includes('rose')) finalTextColor = 'text-rose-500';
    else if (moodConfig?.color.includes('amber')) finalTextColor = 'text-amber-500';
    else if (moodConfig?.color.includes('emerald')) finalTextColor = 'text-emerald-500';
    
    return (
      <div className="bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl border border-white/50 text-left max-w-[220px]">
        <p className="text-[10px] text-gray-400 mb-1.5 font-medium tracking-wide">{data.time}</p>
        <div className="flex items-center justify-between gap-3 mb-2">
           <span className={`text-base font-black ${finalTextColor}`}>
             {data.mood}
           </span>
           <span className="text-xs font-bold text-white bg-gray-900 px-2 py-0.5 rounded-lg">
             {Number(data.score).toFixed(1)}
           </span>
        </div>
        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed opacity-80">
            {data.content || "..."}
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
  const [timeRange, setTimeRange] = useState<TimeRange>('week'); // Default changed to 'week'

  const filteredEntries = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    const dayOfWeek = now.getDay() || 7; 
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(now.getDate() - dayOfWeek + 1);
    
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
      setError("AI 正在深呼吸，请稍后再试...");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex justify-center">
        <div className="bg-white/40 backdrop-blur-md p-1.5 rounded-2xl flex gap-1 shadow-sm border border-white/40">
          {(['today', 'week', 'month'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => {
                setTimeRange(range);
                setAnalysis(null);
              }}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                timeRange === range
                  ? 'bg-white text-gray-800 shadow-sm scale-105'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {range === 'today' ? '今天' : range === 'week' ? '本周' : '本月'}
            </button>
          ))}
        </div>
      </div>

      <section className="glass-card rounded-[2.5rem] p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 pl-2">
          <ICONS.Chart /> 情绪心电图
        </h3>
        
        {filteredEntries.length > 0 ? (
          <div className="h-64 w-full -ml-2"> 
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis 
                  dataKey="shortTime" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 10, fill: '#9ca3af'}} 
                  interval="preserveStartEnd"
                  padding={{ left: 20, right: 20 }}
                />
                <YAxis 
                  domain={[0, 10]} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fontSize: 10, fill: '#9ca3af', fontWeight: 500}} 
                  ticks={[0, 5, 10]}
                  width={30}
                />
                <Tooltip 
                  content={<CustomTooltip />}
                  cursor={{ stroke: '#4f46e5', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#4f46e5" 
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
            <div className="mb-2 text-4xl opacity-50">📉</div>
            <p className="text-sm font-medium">暂无数据轨迹</p>
          </div>
        )}
      </section>

      <section className="space-y-6">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <ICONS.Brain /> 灵魂镜像
          </h3>
          <button 
            onClick={handleAnalyze}
            disabled={loading || filteredEntries.length === 0}
            className={`px-5 py-2.5 rounded-full font-bold text-sm transition-all ${
              loading || filteredEntries.length === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                : 'bg-gray-900 text-white shadow-lg shadow-gray-400/30 hover:bg-black active:scale-95'
            }`}
          >
            {loading ? '连接心灵中...' : '开始解读'}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-rose-50/80 backdrop-blur text-rose-600 rounded-2xl text-sm border border-rose-100 text-center">
            {error}
          </div>
        )}

        {!analysis && !loading && (
          <div className="text-center py-16 glass-card rounded-[2.5rem] border-dashed border-2 border-gray-300/50">
            <p className="text-gray-400 font-medium">点击右上角按钮<br/>唤醒您的 AI 疗愈师</p>
          </div>
        )}

        {analysis && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="grid grid-cols-1 gap-6">
              
              {/* Main Insight Card */}
              <div className="relative overflow-hidden rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-200">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600"></div>
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/20 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4 opacity-90">
                        <span className="uppercase text-xs font-bold tracking-widest">总体状态</span>
                        <div className="h-[1px] flex-1 bg-white/30"></div>
                    </div>
                    <p className="text-lg leading-relaxed font-medium text-white/95">
                        {analysis.summary}
                    </p>
                    <div className="mt-6 flex items-center gap-3">
                         <span className={`px-3 py-1.5 rounded-lg text-xs font-bold bg-white/20 backdrop-blur`}>
                            趋势: {analysis.moodBarometer.trend === 'rising' ? '↗ 回升' : analysis.moodBarometer.trend === 'falling' ? '↘ 波动' : '→ 平稳'}
                         </span>
                         <span className="text-xs text-white/70">
                            {analysis.moodBarometer.explanation}
                         </span>
                    </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/80 backdrop-blur-md p-6 rounded-[2rem] border border-white/50">
                    <p className="text-sm font-bold text-emerald-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="text-lg">✨</span> 高光时刻
                    </p>
                    <ul className="space-y-3">
                      {analysis.peaks.map((p, i) => (
                        <li key={i} className="flex items-start gap-3 text-gray-700 text-sm font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0"></span> {p}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-gradient-to-br from-rose-50/80 to-orange-50/80 backdrop-blur-md p-6 rounded-[2rem] border border-white/50">
                    <p className="text-sm font-bold text-rose-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="text-lg">☁️</span> 需要呵护
                    </p>
                    <ul className="space-y-3">
                      {analysis.valleys.map((v, i) => (
                        <li key={i} className="flex items-start gap-3 text-gray-700 text-sm font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 flex-shrink-0"></span> {v}
                        </li>
                      ))}
                    </ul>
                  </div>
              </div>
            </div>

            <div className="glass-card p-8 rounded-[2.5rem]">
              <p className="text-sm font-bold text-gray-800 mb-6 flex items-center gap-2">
                 <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">💌</span>
                 给你的专属建议
              </p>
              <div className="space-y-4">
                {analysis.suggestions.map((s, i) => (
                  <div key={i} className="p-5 bg-white/60 rounded-2xl text-sm text-gray-600 border border-white hover:border-indigo-100 transition-colors leading-relaxed shadow-sm">
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
