
import React from 'react';

export interface MoodOption {
  label: string;
  value: string;
  score: number;
  emoji: string;
  color: string; // Background color class for the tag/card (Tailwind class)
  hexColor?: string; // Hex color value for dynamic styling (charts, borders, etc.)
  shadow: string; // Shadow color class
  suggestions: string[];
}

// 预设色板 - 用于自定义心情颜色选择
export const MOOD_COLOR_PALETTE = [
  { hex: '#10b981', name: '翠绿', tailwind: 'bg-emerald-500' },
  { hex: '#38bdf8', name: '天蓝', tailwind: 'bg-sky-400' },
  { hex: '#64748b', name: '石墨', tailwind: 'bg-slate-500' },
  { hex: '#818cf8', name: '靛蓝', tailwind: 'bg-indigo-400' },
  { hex: '#f59e0b', name: '琥珀', tailwind: 'bg-amber-500' },
  { hex: '#3b82f6', name: '蔚蓝', tailwind: 'bg-blue-500' },
  { hex: '#f43f5e', name: '玫红', tailwind: 'bg-rose-500' },
  { hex: '#a855f7', name: '紫罗兰', tailwind: 'bg-purple-500' },
  { hex: '#ec4899', name: '粉红', tailwind: 'bg-pink-500' },
  { hex: '#14b8a6', name: '青绿', tailwind: 'bg-teal-500' },
  { hex: '#f97316', name: '橙色', tailwind: 'bg-orange-500' },
  { hex: '#84cc16', name: '青柠', tailwind: 'bg-lime-500' },
];

// 从 Tailwind class 获取对应的 hex 颜色
export const getHexFromTailwind = (tailwindClass: string): string => {
  const mapping: Record<string, string> = {
    'bg-emerald-500': '#10b981',
    'bg-sky-400': '#38bdf8',
    'bg-slate-400': '#94a3b8',
    'bg-slate-500': '#64748b',
    'bg-indigo-400': '#818cf8',
    'bg-amber-500': '#f59e0b',
    'bg-blue-500': '#3b82f6',
    'bg-rose-500': '#f43f5e',
    'bg-purple-500': '#a855f7',
    'bg-pink-500': '#ec4899',
    'bg-teal-500': '#14b8a6',
    'bg-orange-500': '#f97316',
    'bg-lime-500': '#84cc16',
    'bg-gray-400': '#9ca3af',
  };
  return mapping[tailwindClass] || '#64748b';
};

// 过滤掉与默认心情重复的自定义心情，避免界面出现重复项
export const getEffectiveCustomMoods = (customMoods: MoodOption[]): MoodOption[] => {
  const defaultLabels = new Set(MOOD_OPTIONS.map(m => m.label));
  return customMoods.filter(m => !defaultLabels.has(m.label));
};

export const MOOD_OPTIONS: MoodOption[] = [
  { label: '开心', value: 'happy', score: 8, emoji: '😊', color: 'bg-emerald-500', hexColor: '#10b981', shadow: 'shadow-emerald-200', suggestions: ['顺利', '收获', '惊喜'] },
  { label: '平静', value: 'calm', score: 1, emoji: '😌', color: 'bg-sky-400', hexColor: '#38bdf8', shadow: 'shadow-sky-200', suggestions: ['放松', '舒适', '安心'] },
  { label: '心慌', value: 'panic', score: -3, emoji: '😨', color: 'bg-amber-400', hexColor: '#fbbf24', shadow: 'shadow-amber-200', suggestions: ['紧张', '不安', '心跳加速'] },
  { label: '沉溺', value: 'indulge', score: -4, emoji: '🫠', color: 'bg-purple-400', hexColor: '#c084fc', shadow: 'shadow-purple-200', suggestions: ['放纵', '沉浸', '停不下来'] },
  { label: '无精力', value: 'low_energy', score: -5, emoji: '😶', color: 'bg-slate-400', hexColor: '#94a3b8', shadow: 'shadow-slate-200', suggestions: ['疲倦', '提不起劲', '空'] },
  { label: '疲惫', value: 'tired', score: -5, emoji: '😩', color: 'bg-indigo-400', hexColor: '#818cf8', shadow: 'shadow-indigo-200', suggestions: ['累了', '困倦', '需要休息'] },
  { label: '反刍', value: 'ruminate', score: -6, emoji: '🔄', color: 'bg-teal-500', hexColor: '#14b8a6', shadow: 'shadow-teal-200', suggestions: ['反复想', '纠结', '想太多'] },
  { label: '焦虑', value: 'anxious', score: -6, emoji: '😰', color: 'bg-amber-500', hexColor: '#f59e0b', shadow: 'shadow-amber-200', suggestions: ['压力', '担心', '紧张'] },
  { label: '难过', value: 'sad', score: -8, emoji: '😢', color: 'bg-blue-500', hexColor: '#3b82f6', shadow: 'shadow-blue-200', suggestions: ['失落', '委屈', '伤心'] },
  { label: '生气', value: 'angry', score: -10, emoji: '😠', color: 'bg-rose-500', hexColor: '#f43f5e', shadow: 'shadow-rose-200', suggestions: ['不满', '烦躁', '愤怒'] },
  { label: '内耗', value: 'mental_drain', score: -10, emoji: '🌀', color: 'bg-gray-600', hexColor: '#4b5563', shadow: 'shadow-gray-200', suggestions: ['自我消耗', '精神内耗', '耗尽'] },
];

export const ICONS = {
  Plus: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  Chart: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  ),
  Brain: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
    </svg>
  ),
  Home: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ),
  Sparkles: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  ),
  Copy: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
    </svg>
  ),
  Check: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  ),
  Bold: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3.75h4.75a5.5 5.5 0 0 1 0 11H6.75A5.5 5.5 0 0 1 6.75 3.75ZM6.75 14.75h6.25a4.75 4.75 0 0 1 0 9.5H6.75a4.75 4.75 0 0 1 0-9.5Z" />
    </svg>
  ),
  Italic: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 19.5h5.5m-5.5-15h9m-6.75 15 4.5-15" />
    </svg>
  ),
  List: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 17.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  ),
  Pen: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
  ),
  Search: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  ),
  Tag: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
    </svg>
  ),
  Undo: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
    </svg>
  ),
  Download: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M12 9.75l-3 3m0 0 3 3m-3-3H21" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75v-3.75a3 3 0 0 0-3-3H5.25a3 3 0 0 0-3 3v5.25" />
      {/* Revised simpler download icon */}
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
  ),
  Upload: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
  ),
  Backup: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
  ),
  Stats: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
    </svg>
  ),
  Report: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
    </svg>
  ),
  Experiment: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>
  ),
  Book: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  ChevronRight: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  ),
  Lightbulb: () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
    </svg>
  ),
  Refresh: ({ className = '' }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 ${className}`}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  )
};

// ==================== 周报系统配置 ====================

// 推荐书库（纳瓦尔特质）
export const BOOK_RECOMMENDATIONS = [
  {
    title: '《纳瓦尔宝典》',
    author: '埃里克·乔根森',
    keywords: ['财富', '杠杆', '自由', '幸福', '工作'],
    concept: '把自己产品化',
    quote: '追求财富，而不是金钱或地位。'
  },
  {
    title: '《深度工作》',
    author: '卡尔·纽波特',
    keywords: ['专注', '效率', '分心', '焦虑', '疲惫'],
    concept: '深度工作',
    quote: '高质量工作产出 = 时间 × 专注度'
  },
  {
    title: '《当下的力量》',
    author: '埃克哈特·托利',
    keywords: ['焦虑', '后悔', '担忧', '平静', '内耗'],
    concept: '临在',
    quote: '时间一点儿也不珍贵，因为它仅仅是一种幻象。'
  },
  {
    title: '《心流》',
    author: '米哈里·契克森米哈赖',
    keywords: ['沉浸', '专注', '快乐', '充实', '无聊'],
    concept: '心流状态',
    quote: '最优体验发生在挑战与技能平衡时。'
  },
  {
    title: '《原子习惯》',
    author: '詹姆斯·克利尔',
    keywords: ['习惯', '改变', '拖延', '坚持', '动力'],
    concept: '1%进步',
    quote: '你不需要目标，你需要的是系统。'
  },
  {
    title: '《思考，快与慢》',
    author: '丹尼尔·卡尼曼',
    keywords: ['决策', '偏见', '判断', '思维', '错误'],
    concept: '系统1与系统2',
    quote: '直觉是识别的产物。'
  },
  {
    title: '《被讨厌的勇气》',
    author: '岸见一郎',
    keywords: ['人际关系', '在意', '认可', '自由', '自卑'],
    concept: '课题分离',
    quote: '你不是为了满足别人的期待而活着。'
  },
  {
    title: '《精力管理》',
    author: '吉姆·洛尔',
    keywords: ['疲惫', '精力', '恢复', '能量', '倦怠'],
    concept: '全情投入',
    quote: '精力，而非时间，是高效能的基础。'
  },
  {
    title: '《非暴力沟通》',
    author: '马歇尔·卢森堡',
    keywords: ['沟通', '冲突', '情绪', '表达', '关系'],
    concept: '观察-感受-需要-请求',
    quote: '语言是窗，或者是墙。'
  },
  {
    title: '《最小阻力之路》',
    author: '罗伯特·弗里茨',
    keywords: ['创造', '结构性冲突', '愿景', '改变'],
    concept: '结构性张力',
    quote: '创造者关注的是想要创造什么，而不是问题。'
  },
  {
    title: '《反脆弱》',
    author: '纳西姆·塔勒布',
    keywords: ['压力', '混乱', '不确定性', '成长'],
    concept: '反脆弱性',
    quote: '有些事情能从冲击中受益。'
  },
  {
    title: '《奇特的一生》',
    author: '格拉宁',
    keywords: ['时间', '记录', '统计', '效率', '自律'],
    concept: '时间统计法',
    quote: '了解自己是智慧的开端。'
  }
];

// 导师人格配置（纳瓦尔风格）
export const MENTOR_CONFIG = {
  name: '纳瓦尔',
  style: '现代哲学、财富与自由、第一性原理',
  tone: '冷静、深刻、系统化',
  corePrinciples: [
    '把自己产品化',
    '追求杠杆而非线性努力',
    '特定知识不可替代',
    '平静是终极目标',
    '判断力是核心能力'
  ],
  
  // 生成 Prompt 用的系统设定
  systemPrompt: `你是一位融合了纳瓦尔·拉维坎特智慧的数字人生教练。

你的风格：
- 冷静、深刻、不说教
- 用数据说话，但指出数据背后的模式
- 引用纳瓦尔的核心理念，但不生硬
- 给出具体、可执行的建议
- 一次只给一个实验，不贪多

你的使命：
帮助用户通过情绪数据认识自己，做出更好的决策，成为更好的自己。

输出原则：
1. 观察语气，而非评判
2. 指出模式，而非贴标签  
3. 给出一个具体的实验，而非泛泛的建议
4. 推荐内容必须和本周数据相关`
};

// 推荐匹配逻辑
export function matchBookRecommendation(
  keywords: string[],
  dominantMood: string,
  entries: { content: string; tags: string[] }[]
): typeof BOOK_RECOMMENDATIONS[0] {
  // 1. 从所有条目中提取关键词
  const allText = entries.map(e => e.content + ' ' + e.tags.join(' ')).join(' ');
  
  // 2. 计算每本书的匹配分数
  const scored = BOOK_RECOMMENDATIONS.map(book => {
    let score = 0;
    book.keywords.forEach(kw => {
      if (allText.includes(kw)) score += 2;
      if (keywords.includes(kw)) score += 3;
      if (dominantMood.includes(kw)) score += 1;
    });
    return { book, score };
  });
  
  // 3. 返回最高分，如果都低则随机返回一本
  scored.sort((a, b) => b.score - a.score);
  
  if (scored[0].score > 0) {
    return scored[0].book;
  }
  
  // 默认推荐：根据主导情绪
  if (['焦虑', '心慌'].includes(dominantMood)) {
    return BOOK_RECOMMENDATIONS.find(b => b.title.includes('当下的力量'))!;
  }
  if (['疲惫', '无精力'].includes(dominantMood)) {
    return BOOK_RECOMMENDATIONS.find(b => b.title.includes('精力管理'))!;
  }
  if (['沉溺', '反刍'].includes(dominantMood)) {
    return BOOK_RECOMMENDATIONS.find(b => b.title.includes('心流'))!;
  }
  
  // 默认：纳瓦尔宝典
  return BOOK_RECOMMENDATIONS[0];
}
