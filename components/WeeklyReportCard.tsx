import React, { useState } from 'react';
import { WeeklyReport } from '../types';
import { ICONS } from '../constants';

interface Props {
  report: WeeklyReport;
  onClick: () => void;
  onRegenerate?: (weekKey: string) => Promise<void>;
}

const WeeklyReportCard: React.FC<Props> = ({ report, onClick, onRegenerate }) => {
  const isUnread = !report.tracking?.viewedAt;
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  // 格式化生成时间
  const formatGeneratedTime = (timestamp: number): string => {
    const now = new Date();
    const generated = new Date(timestamp);
    const diffMs = now.getTime() - generated.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) {
      return '刚刚生成';
    } else if (diffHours < 24) {
      return `${diffHours}小时前生成`;
    } else if (diffDays === 1) {
      return '昨天生成';
    } else {
      return `${generated.getMonth() + 1}月${generated.getDate()}日生成`;
    }
  };
  
  // 获取能量趋势图标
  const getTrendIcon = () => {
    switch (report.content.snapshot.energyTrend) {
      case 'up':
        return '📈';
      case 'down':
        return '📉';
      default:
        return '➡️';
    }
  };
  
  // 获取主导情绪的简写
  const dominantMood = report.content.snapshot.dominantMood;
  
  return (
    <div 
      onClick={onClick}
      className={`
        relative mx-4 mb-4 p-4 rounded-2xl cursor-pointer
        bg-gradient-to-br from-emerald-500/10 via-sky-500/5 to-transparent
        border border-emerald-500/20
        hover:border-emerald-500/40
        transition-all duration-300
        ${isUnread ? 'ring-2 ring-emerald-500/30 ring-offset-2' : ''}
      `}
    >
      {/* 未读标记 */}
      {isUnread && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
      )}
      
      {/* 头部 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <ICONS.Report />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              第{report.weekKey.split('-W')[1]}周报
            </h3>
            <p className="text-xs text-slate-500">
              {report.weekRange.start.slice(5)} ~ {report.weekRange.end.slice(5)}
              {report.generatedAt && (
                <span className="ml-1 text-slate-400">· {formatGeneratedTime(report.generatedAt)}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 重新生成按钮 */}
          {onRegenerate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowConfirm(true);
              }}
              disabled={isRegenerating}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
              title="重新生成"
            >
              <ICONS.Refresh className={isRegenerating ? 'animate-spin' : ''} />
            </button>
          )}
          <div className="text-lg">{getTrendIcon()}</div>
        </div>
      </div>
      
      {/* 确认重新生成弹窗 */}
      {showConfirm && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            setShowConfirm(false);
          }}
        >
          <div 
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-2">重新生成周报？</h3>
            <p className="text-sm text-slate-600 mb-4">
              将基于本周{report.content.snapshot.totalEntries}条记录重新生成周报，
              当前周报内容将被覆盖。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  setShowConfirm(false);
                  setIsRegenerating(true);
                  try {
                    await onRegenerate?.(report.weekKey);
                  } finally {
                    setIsRegenerating(false);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
              >
                确认生成
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 核心洞察 */}
      <div className="mb-3">
        <p className="text-sm font-medium text-slate-700 line-clamp-2">
          "{report.content.observation.headline}"
        </p>
      </div>
      
      {/* 数据摘要 */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <span>{report.content.snapshot.totalEntries}条记录</span>
        </div>
        <div className="flex items-center gap-1">
          <span>主导: {dominantMood}</span>
        </div>
        <div className={`
          flex items-center gap-1 font-medium
          ${report.content.snapshot.avgEnergyDelta >= 0 ? 'text-emerald-600' : 'text-rose-500'}
        `}>
          <span>能量: {report.content.snapshot.avgEnergyDelta > 0 ? '+' : ''}{report.content.snapshot.avgEnergyDelta}</span>
        </div>
      </div>
      
      {/* 实验状态 */}
      {report.tracking?.experimentAccepted && !report.tracking?.experimentCompleted && (
        <div className="mt-3 pt-3 border-t border-slate-200/50">
          <div className="flex items-center gap-2 text-xs text-emerald-600">
            <ICONS.Experiment />
            <span>实验进行中: {report.content.experiment.title}</span>
          </div>
        </div>
      )}
      
      {/* 查看按钮 */}
      <div className="mt-3 flex items-center justify-end">
        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
          查看详情
          <ICONS.ChevronRight />
        </span>
      </div>
    </div>
  );
};

export default WeeklyReportCard;
