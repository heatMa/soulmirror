
import React, { useState, useRef, useEffect } from 'react';
import { ICONS } from '../constants';

interface Props {
  dateStr: string;
  initialContent: string;
  onSave: (dateStr: string, content: string) => void;
  // 生成深度回看相关
  onGenerateClick?: () => void;
  isGenerating?: boolean;
  hasDeepReflection?: boolean;
  canGenerate?: boolean; // 是否有内容可以生成
}

// 模拟截图中的颜色列表
// 这些颜色应该使用 border-2 + 背景色 (截图看起来是圆环)
const TEXT_COLORS = [
  { value: '#374151', label: '默认', borderClass: 'border-gray-700' }, // Dark Gray
  { value: '#64748b', label: '蓝灰', borderClass: 'border-slate-500' }, // Slate
  { value: '#ef4444', label: '红色', borderClass: 'border-red-500' },   // Red
  { value: '#84cc16', label: '绿色', borderClass: 'border-lime-500' },  // Lime Green
  { value: '#3b82f6', label: '蓝色', borderClass: 'border-blue-500' },  // Blue
  { value: '#f97316', label: '橙色', borderClass: 'border-orange-500' }, // Orange
  { value: '#8b5cf6', label: '紫色', borderClass: 'border-violet-500' }, // Violet
];

const DailyNoteEditor: React.FC<Props> = ({
  dateStr,
  initialContent,
  onSave,
  onGenerateClick,
  isGenerating = false,
  hasDeepReflection = false,
  canGenerate = true
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [activeColor, setActiveColor] = useState<string>('#374151');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 初始化内容。注意：仅在 dateStr 变化时重置，避免输入时光标跳动
  useEffect(() => {
    if (contentRef.current) {
      if (contentRef.current.innerHTML !== initialContent) {
          contentRef.current.innerHTML = initialContent || '';
      }
    }
  }, [dateStr]); // 不依赖 initialContent，防止循环更新

  const handleInput = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    setStatus('saving');

    timeoutRef.current = setTimeout(() => {
      if (contentRef.current) {
        onSave(dateStr, contentRef.current.innerHTML);
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 2000);
      }
    }, 1000); // 1秒后自动保存
  };

  const executeCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (contentRef.current) {
        contentRef.current.focus();
    }
    if (command === 'foreColor' && value) {
      setActiveColor(value);
    }
    handleInput(); // 格式变化也触发保存
  };

  return (
    <div className="glass-card rounded-[2rem] p-5 relative overflow-hidden transition-all focus-within:ring-1 focus-within:ring-indigo-100 flex flex-col gap-3">
      {/* 顶部标题行 */}
      <div className="flex items-center gap-2 px-1 pb-2">
          <span className="text-gray-400"><ICONS.Pen /></span>
          <h4 className="text-xs font-bold text-gray-600">日记</h4>
      </div>

      {/* 工具栏：生成按钮 + 格式化按钮 */}
      <div className="flex items-center gap-1 px-1 border-b border-gray-100/80 pb-2">
          {/* AI洞察按钮 */}
          {onGenerateClick && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onGenerateClick();
                }}
                disabled={!canGenerate || isGenerating}
                title={!canGenerate ? '请先记录今日心情或写日记' : ''}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${
                  isGenerating
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : !canGenerate
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                }`}
              >
                {isGenerating ? (
                  <>
                    <svg className="w-2.5 h-2.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    生成中
                  </>
                ) : hasDeepReflection ? (
                  <>
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    重新生成
                  </>
                ) : (
                  <>
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    AI洞察
                  </>
                )}
              </button>
              <div className="w-[1px] h-3 bg-gray-200"></div>
            </>
          )}
          <button
              onClick={() => executeCommand('undo')}
              className="p-1 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
              title="撤销"
          >
              <ICONS.Undo />
          </button>
          <div className="w-[1px] h-3 bg-gray-200"></div>
          <button
              onClick={() => executeCommand('bold')}
              className="p-1 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="加粗"
          >
              <ICONS.Bold />
          </button>
          <button
              onClick={() => executeCommand('italic')}
              className="p-1 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="斜体"
          >
              <ICONS.Italic />
          </button>
          <button
              onClick={() => executeCommand('insertUnorderedList')}
              className="p-1 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="列表"
          >
              <ICONS.List />
          </button>
      </div>

      {/* 颜色选择栏 (水平滚动) */}
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar px-1 py-1">
         {TEXT_COLORS.map((color) => (
            <button
              key={color.value}
              onMouseDown={(e) => {
                 e.preventDefault(); // 防止点击按钮时编辑器失去焦点
                 executeCommand('foreColor', color.value);
              }}
              className={`w-6 h-6 rounded-full border-[3px] bg-white flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 ${color.borderClass} ${activeColor === color.value ? 'ring-2 ring-offset-1 ring-gray-200' : ''}`}
              title={color.label}
            >
               {/* 选中态：显示一个微小的 Check，或者实心点，这里用实心点模拟截图中的第一个黑色选中状态 */}
               {activeColor === color.value && (
                  <div className={`w-2 h-2 rounded-full ${color.value === '#374151' ? 'bg-gray-700' : 'bg-current'}`} style={{color: color.value}}></div>
               )}
            </button>
         ))}
      </div>

      <div
        ref={contentRef}
        contentEditable
        onInput={handleInput}
        className="w-full min-h-[120px] max-h-[300px] overflow-y-auto outline-none text-sm text-gray-700 leading-relaxed tracking-wide px-1 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-300"
        data-placeholder="写下今天的碎碎念..."
        style={{ whiteSpace: 'pre-wrap' }}
      />
      
      <div className="absolute bottom-3 right-4 pointer-events-none">
        {status === 'saving' && <span className="text-[10px] text-gray-400 animate-pulse">保存中...</span>}
        {status === 'saved' && <span className="text-[10px] text-emerald-500 font-medium transition-opacity duration-500">已保存</span>}
      </div>
    </div>
  );
};

export default DailyNoteEditor;
