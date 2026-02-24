
import React, { useState, useRef, useEffect } from 'react';
import { DiaryEntry, EntryComment } from '../types';

interface EntryCommentSheetProps {
  entry: DiaryEntry;
  comments: EntryComment[];
  onClose: () => void;
  onAddComment: (content: string) => Promise<void>;
  onDeleteComment: (commentId: number) => Promise<void>;
  onToggleResolved: () => Promise<void>;
}

function formatCommentTime(createdAt: string, entryTimestamp: number): string {
  const commentDate = new Date(createdAt);
  const entryDate = new Date(entryTimestamp);

  const isSameDay =
    commentDate.getFullYear() === entryDate.getFullYear() &&
    commentDate.getMonth() === entryDate.getMonth() &&
    commentDate.getDate() === entryDate.getDate();

  if (isSameDay) {
    return commentDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  const month = commentDate.getMonth() + 1;
  const day = commentDate.getDate();
  const hour = commentDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return `${month}月${day}日 ${hour}`;
}

function formatResolvedTime(resolvedAt: string): string {
  const d = new Date(resolvedAt);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const time = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return `${month}月${day}日 ${time}`;
}

const EntryCommentSheet: React.FC<EntryCommentSheetProps> = ({
  entry,
  comments,
  onClose,
  onAddComment,
  onDeleteComment,
  onToggleResolved,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTogglingResolved, setIsTogglingResolved] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isResolved = Boolean(entry.resolved_at);

  // Scroll to bottom of comments list when comments change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [comments, entry.resolved_at]);

  const handleAddComment = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddComment(trimmed);
      setInputValue('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddComment();
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (deletingId !== null) return;
    setDeletingId(commentId);
    try {
      await onDeleteComment(commentId);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleResolved = async () => {
    if (isTogglingResolved) return;
    setIsTogglingResolved(true);
    try {
      await onToggleResolved();
    } finally {
      setIsTogglingResolved(false);
    }
  };

  // Truncate entry content (strip HTML tags first)
  const contentText = entry.content.replace(/<[^>]*>/g, '');
  const truncatedContent = contentText.length > 120 ? contentText.slice(0, 120) + '...' : contentText;

  const entryTime = new Date(entry.timestamp).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header: original entry info */}
        <div className="px-5 pt-2 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{entry.moodEmoji || '📝'}</span>
            <span className="font-bold text-gray-800">{entry.mood}</span>
            <span className="text-xs text-gray-400 ml-auto">{entryTime}</span>
          </div>
          {truncatedContent && (
            <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
              {truncatedContent}
            </p>
          )}
        </div>

        {/* Comments section header */}
        <div className="px-5 pt-3 pb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">进展记录</span>
          {comments.length > 0 && (
            <span className="text-xs text-gray-400">{comments.length} 条</span>
          )}
        </div>

        {/* Comments list */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-5 pb-2 min-h-0"
        >
          {comments.length === 0 && !isResolved ? (
            <div className="py-8 text-center text-gray-300 text-sm">
              还没有进展记录，记录一下吧
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {comments.map(comment => (
                <div key={comment.id} className="flex items-start gap-3 group">
                  <div className="flex-1 bg-gray-50 rounded-2xl px-4 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">
                        {formatCommentTime(comment.created_at, entry.timestamp)}
                      </span>
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        disabled={deletingId === comment.id}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400 text-xs ml-2 flex-shrink-0"
                        aria-label="删除评论"
                      >
                        {deletingId === comment.id ? '...' : '删除'}
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{comment.content}</p>
                  </div>
                </div>
              ))}

              {/* Resolved marker */}
              {isResolved && entry.resolved_at && (
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-emerald-200" />
                  <span className="text-xs text-emerald-600 font-medium whitespace-nowrap flex items-center gap-1">
                    <span>✓</span>
                    <span>{formatResolvedTime(entry.resolved_at)} 已好转</span>
                  </span>
                  <div className="flex-1 h-px bg-emerald-200" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed bottom area: input + toggle button */}
        <div className="border-t border-gray-100 px-4 pt-3 pb-4 bg-white">
          {/* Comment input row */}
          <div className="flex items-center gap-2 mb-3">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="有什么新进展..."
              className="flex-1 bg-gray-100 rounded-2xl px-4 py-2.5 text-sm text-gray-800 outline-none placeholder-gray-400 focus:ring-2 focus:ring-emerald-300 transition-all"
              maxLength={500}
            />
            <button
              onClick={handleAddComment}
              disabled={!inputValue.trim() || isSubmitting}
              className={`px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all active:scale-95 ${
                inputValue.trim() && !isSubmitting
                  ? 'bg-emerald-500 text-white shadow-sm hover:bg-emerald-600'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? '...' : '发布'}
            </button>
          </div>

          {/* Toggle resolved button */}
          <button
            onClick={handleToggleResolved}
            disabled={isTogglingResolved}
            className={`w-full py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
              isResolved
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : 'bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-600'
            }`}
          >
            <span className={`transition-transform ${isResolved ? 'scale-110' : ''}`}>✓</span>
            <span>
              {isTogglingResolved
                ? '处理中...'
                : isResolved
                  ? '已好转（点击可撤销）'
                  : '标记为已好转'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default EntryCommentSheet;
