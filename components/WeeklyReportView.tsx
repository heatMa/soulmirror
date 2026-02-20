import React, { useState } from 'react';
import { WeeklyReport } from '../types';
import { ICONS, MOOD_OPTIONS, getHexFromTailwind } from '../constants';
import { databaseService } from '../services/databaseService';
import { scheduleExperimentReminder } from '../services/notificationService';

interface Props {
  report: WeeklyReport;
  onClose: () => void;
  onExperimentAccept?: () => void;
}

const WeeklyReportView: React.FC<Props> = ({ report, onClose, onExperimentAccept }) => {
  const [accepted, setAccepted] = useState(report.tracking?.experimentAccepted || false);
  
  // 获取心情颜色
  const getMoodColor = (mood: string): string => {
    const option = MOOD_OPTIONS.find(m => m.label === mood);
    return option?.hexColor || getHexFromTailwind(option?.color || 'bg-slate-400');
  };
  
  // 处理接受实验
  const handleAcceptExperiment = async () => {
    await databaseService.acceptExperiment(report.weekKey);
    // 设置实验提醒（周三早上）
    await scheduleExperimentReminder(report.content.experiment.title, 3);
    setAccepted(true);
    onExperimentAccept?.();
  };
  
  // 格式化时长
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}小时`;
    return `${hours}小时${mins}分钟`;
  };
  
  // 获取能量颜色
  const getEnergyColor = (value: number): string => {
    if (value >= 3) return '#10b981';
    if (value >= 0) return '#38bdf8';
    if (value >= -3) return '#f59e0b';
    return '#f43f5e';
  };
  
  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      {/* 头部 - 增加安全区域和按钮点击区域 */}
      <div className="sticky top-0 bg-white/90 backdrop-blur-sm border-b border-slate-100 px-4 pt-8 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="p-4 -ml-2 rounded-full hover:bg-slate-100 active:bg-slate-200 transition-colors touch-manipulation"
            style={{ minWidth: '44px', minHeight: '44px' }}
            aria-label="返回"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">
              第{report.weekKey.split('-W')[1]}周报
            </h1>
            <p className="text-xs text-slate-500">
              {report.weekRange.start} ~ {report.weekRange.end}
            </p>
          </div>
        </div>
        <div className="text-2xl">🧠</div>
      </div>
      
      <div className="p-4 space-y-6 pb-24">
        {/* 本周快照 */}
        <section className="bg-gradient-to-br from-emerald-50/50 to-sky-50/30 rounded-2xl p-4 border border-emerald-100">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-600 text-xs">📊</span>
            本周快照
          </h2>
          
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-3 bg-white rounded-xl border border-slate-100">
              <div className="text-2xl font-bold text-slate-800">{report.content.snapshot.totalEntries}</div>
              <div className="text-xs text-slate-500">条记录</div>
            </div>
            <div className="text-center p-3 bg-white rounded-xl border border-slate-100">
              <div className="text-2xl font-bold text-slate-800">
                {Math.round(report.content.snapshot.totalDurationMinutes / 60 * 10) / 10}h
              </div>
              <div className="text-xs text-slate-500">总时长</div>
            </div>
            <div className="text-center p-3 bg-white rounded-xl border border-slate-100">
              <div className={`text-2xl font-bold ${report.content.snapshot.avgEnergyDelta >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                {report.content.snapshot.avgEnergyDelta > 0 ? '+' : ''}{report.content.snapshot.avgEnergyDelta}
              </div>
              <div className="text-xs text-slate-500">平均能量</div>
            </div>
          </div>
          
          {/* 每日能量走势 */}
          <div className="bg-white rounded-xl p-3 border border-slate-100">
            <div className="text-xs text-slate-500 mb-2">每日能量走势</div>
            <div className="flex items-end justify-between h-20 gap-1">
              {report.content.chartData.dailyEnergy.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className="w-full rounded-t-sm transition-all duration-500"
                    style={{
                      height: `${Math.max(10, Math.min(100, (day.value + 10) / 20 * 100))}%`,
                      backgroundColor: getEnergyColor(day.value),
                      opacity: day.value === 0 ? 0.2 : 0.8
                    }}
                  />
                  <span className="text-[10px] text-slate-400">{day.day.slice(-1)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span>峰值: {report.content.snapshot.peakDay} ({report.content.snapshot.peakEnergy > 0 ? '+' : ''}{report.content.snapshot.peakEnergy})</span>
              <span>谷值: {report.content.snapshot.valleyDay} ({report.content.snapshot.valleyEnergy > 0 ? '+' : ''}{report.content.snapshot.valleyEnergy})</span>
            </div>
          </div>
          
          {/* 情绪分布 */}
          {report.content.chartData.moodDistribution.length > 0 && (
            <div className="mt-3 bg-white rounded-xl p-3 border border-slate-100">
              <div className="text-xs text-slate-500 mb-2">情绪时长分布</div>
              <div className="space-y-2">
                {report.content.chartData.moodDistribution.slice(0, 4).map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getMoodColor(m.mood) }}
                    />
                    <span className="text-xs text-slate-600 w-12">{m.mood}</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: getMoodColor(m.mood),
                          width: `${Math.min(100, (m.minutes / report.content.snapshot.totalDurationMinutes) * 100 * 2)}%`
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-400">{formatDuration(m.minutes)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
        
        {/* 教练观察 */}
        <section className="bg-gradient-to-br from-amber-50/50 to-orange-50/30 rounded-2xl p-4 border border-amber-100">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-600 text-xs">💡</span>
            纳瓦尔观察
          </h2>
          
          <div className="bg-white rounded-xl p-4 border border-amber-100/50">
            <p className="text-lg font-medium text-slate-800 mb-3">
              "{report.content.observation.headline}"
            </p>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {report.content.observation.body}
            </p>
            {report.content.observation.pattern && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-amber-600">观察到的模式：</span>
                  {report.content.observation.pattern}
                </p>
              </div>
            )}
          </div>
        </section>
        
        {/* 本周实验 */}
        <section className="bg-gradient-to-br from-violet-50/50 to-purple-50/30 rounded-2xl p-4 border border-violet-100">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-600 text-xs">
              <ICONS.Experiment />
            </span>
            本周实验
          </h2>
          
          <div className="bg-white rounded-xl p-4 border border-violet-100/50">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-slate-800">{report.content.experiment.title}</h3>
              <span className="text-xs px-2 py-1 bg-violet-100 text-violet-700 rounded-full">
                {report.content.experiment.duration}
              </span>
            </div>
            
            <p className="text-sm text-slate-600 mb-3">
              {report.content.experiment.instruction}
            </p>
            
            <div className="bg-violet-50/50 rounded-lg p-3 mb-4">
              <p className="text-xs text-violet-700">
                <span className="font-medium">预期效果：</span>
                {report.content.experiment.expectedOutcome}
              </p>
            </div>
            
            {!accepted ? (
              <button
                onClick={handleAcceptExperiment}
                className="w-full py-3 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 transition-colors flex items-center justify-center gap-2"
              >
                <ICONS.Check />
                接受挑战
              </button>
            ) : (
              <div className="w-full py-3 bg-emerald-100 text-emerald-700 rounded-xl font-medium flex items-center justify-center gap-2">
                <ICONS.Check />
                已接受 · 下周回顾效果
              </div>
            )}
          </div>
        </section>
        
        {/* 本周推荐 */}
        <section className="bg-gradient-to-br from-sky-50/50 to-blue-50/30 rounded-2xl p-4 border border-sky-100">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-600 text-xs">
              <ICONS.Book />
            </span>
            本周推荐
          </h2>
          
          <div className="bg-white rounded-xl p-4 border border-sky-100/50">
            <div className="flex items-start gap-3">
              <div className="w-12 h-16 bg-gradient-to-br from-sky-400 to-blue-500 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xl">
                📖
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-800">{report.content.recommendation.title}</h3>
                {report.content.recommendation.author && (
                  <p className="text-xs text-slate-500 mb-2">{report.content.recommendation.author}</p>
                )}
                <p className="text-sm text-slate-600 leading-relaxed">
                  {report.content.recommendation.why}
                </p>
              </div>
            </div>
          </div>
        </section>
        
        {/* 生成时间 */}
        <div className="text-center text-xs text-slate-400 pt-4">
          报告生成于 {new Date(report.generatedAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
};

export default WeeklyReportView;
