import React, { useState } from 'react';
import { ICONS } from '../constants';

interface Props {
  entryCount: number;
  minEntries?: number;
  weekKey: string;
  onGenerate?: (weekKey: string) => Promise<void>;
}

/**
 * 周报预览卡片
 * 在周日20:00前显示，支持手动立即生成
 */
const WeeklyReportPreview: React.FC<Props> = ({ 
  entryCount, 
  minEntries = 3,
  weekKey,
  onGenerate
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  // 解析周Key显示文案
  const getWeekLabel = () => {
    // 解析周数
    const match = weekKey.match(/(\d{4})-W(\d{2})/);
    if (match) {
      const weekNum = parseInt(match[2]);
      return `第${weekNum}周报`;
    }
    return '周报';
  };
  
  const canGenerate = entryCount >= minEntries;
  
  return (
    <div className="mx-4 mb-4 p-4 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400">
          <ICONS.Report />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-700">
            {getWeekLabel()}
          </h3>
          <p className="text-xs text-slate-500">
            {canGenerate ? '可立即生成' : `需${minEntries}条记录生成`}
          </p>
        </div>
        
        {/* 立即生成按钮 */}
        {canGenerate && onGenerate && (
          <button
            onClick={() => setShowConfirm(true)}
            disabled={isGenerating}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {isGenerating ? (
              <>
                <ICONS.Refresh className="animate-spin" />
                生成中
              </>
            ) : (
              '立即生成'
            )}
          </button>
        )}
      </div>
      
      <div className="bg-white/50 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-600">当前记录</span>
          <span className={`text-sm font-medium ${canGenerate ? 'text-emerald-600' : 'text-amber-600'}`}>
            {entryCount} / {minEntries} 条
          </span>
        </div>
        
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              canGenerate ? 'bg-emerald-500' : 'bg-amber-400'
            }`}
            style={{ width: `${Math.min(100, (entryCount / minEntries) * 100)}%` }}
          />
        </div>
        
        <p className="text-xs text-slate-500 mt-2">
          {canGenerate 
            ? '记录已足够，点击右上角按钮立即生成周报'
            : `再记录 ${minEntries - entryCount} 条即可生成周报`
          }
        </p>
      </div>
      
      {/* 确认生成弹窗 */}
      {showConfirm && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowConfirm(false)}
        >
          <div 
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-2">立即生成周报？</h3>
            <p className="text-sm text-slate-600 mb-4">
              将基于本周{entryCount}条记录立即生成周报。
              生成后仍可随时重新生成。
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
                  setIsGenerating(true);
                  try {
                    if (weekKey) {
                      await onGenerate?.(weekKey);
                    }
                  } catch (error) {
                    console.error('生成周报失败:', error);
                    alert('生成失败，请重试');
                  } finally {
                    setIsGenerating(false);
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
    </div>
  );
};

export default WeeklyReportPreview;
