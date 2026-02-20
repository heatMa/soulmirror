import { DiaryEntry, WeeklyReport } from '../types';
import { MENTOR_CONFIG, matchBookRecommendation } from '../constants';
import { databaseService } from './databaseService';
import { getEntryDurationMinutes } from '../utils/timeUtils';
import { scheduleWeeklyReportNotification, scheduleExperimentReminder } from './notificationService';

// ==========================================
// 周报生成服务
// ==========================================

/**
 * 根据日期获取周 Key (ISO 8601 格式: 2025-W08)
 * @param date 指定日期，不传则使用当前日期
 */
export function getWeekKeyForDate(date?: Date): string {
  const targetDate = date || new Date();
  
  // 计算 ISO 周数
  const d = new Date(Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()));
  const dayNum = d.getUTCDay() || 7; // 周日记为7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // 调整到周四
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * 获取当前周 Key (兼容旧代码)
 */
export function getCurrentWeekKey(): string {
  return getWeekKeyForDate();
}

/**
 * 获取指定周的日期范围 (ISO 8601)
 */
export function getWeekRange(weekKey: string): { start: string; end: string } {
  const [year, weekStr] = weekKey.split('-W');
  const weekNum = parseInt(weekStr);
  
  // ISO 8601: 计算该年第一周周一的日期
  // 第一周是包含该年第一个周四的周
  const jan4 = new Date(parseInt(year), 0, 4);
  const jan4Day = jan4.getDay() || 7; // 周日记为7
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - (jan4Day - 1)); // 周一
  
  // 目标周的周一
  const monday = new Date(firstMonday);
  monday.setDate(monday.getDate() + (weekNum - 1) * 7);
  
  // 周日
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  
  const formatDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  
  return {
    start: formatDate(monday),
    end: formatDate(sunday)
  };
}

/**
 * 获取上周的 Key
 */
export function getPrevWeekKey(weekKey: string): string {
  const [year, weekStr] = weekKey.split('-W');
  let weekNum = parseInt(weekStr);
  let yearNum = parseInt(year);
  
  weekNum--;
  if (weekNum < 1) {
    yearNum--;
    weekNum = 52; // 简化处理，不考虑闰年53周
  }
  
  return `${yearNum}-W${String(weekNum).padStart(2, '0')}`;
}

// ==========================================
// 数据聚合
// ==========================================

interface WeekSummary {
  weekKey: string;
  weekRange: { start: string; end: string };
  totalEntries: number;
  totalDurationMinutes: number;
  avgEnergyDelta: number;
  dominantMood: string;
  dominantMoodRatio: number;
  energyTrend: 'up' | 'down' | 'stable';
  peakDay: string;
  peakEnergy: number;
  valleyDay: string;
  valleyEnergy: number;
  keywords: string[];
  dailyStats: {
    date: string;
    dayName: string;
    avgEnergy: number;
    entryCount: number;
  }[];
  moodDistribution: { mood: string; minutes: number; count: number }[];
}

/**
 * 聚合一周的数据
 */
function aggregateWeekData(entries: DiaryEntry[]): WeekSummary {
  const weekKey = getCurrentWeekKey();
  const weekRange = getWeekRange(weekKey);
  
  if (entries.length === 0) {
    return {
      weekKey,
      weekRange,
      totalEntries: 0,
      totalDurationMinutes: 0,
      avgEnergyDelta: 0,
      dominantMood: '无',
      dominantMoodRatio: 0,
      energyTrend: 'stable',
      peakDay: '-',
      peakEnergy: 0,
      valleyDay: '-',
      valleyEnergy: 0,
      keywords: [],
      dailyStats: [],
      moodDistribution: []
    };
  }
  
  // 基础统计
  const totalEntries = entries.length;
  const totalDurationMinutes = entries.reduce((sum, e) => {
    const mins = getEntryDurationMinutes(e);
    return sum + (mins || 30); // 默认30分钟
  }, 0);
  
  const avgEnergyDelta = entries.reduce((sum, e) => sum + (e.energyDelta || e.moodScore / 2), 0) / totalEntries;
  
  // 主导情绪（按时长）
  const moodMinutes: Record<string, number> = {};
  entries.forEach(e => {
    const mins = getEntryDurationMinutes(e) || 30;
    moodMinutes[e.mood] = (moodMinutes[e.mood] || 0) + mins;
  });
  
  const moodEntries = Object.entries(moodMinutes);
  moodEntries.sort((a, b) => b[1] - a[1]);
  const dominantMood = moodEntries[0]?.[0] || '平静';
  const dominantMoodRatio = Math.round((moodEntries[0]?.[1] || 0) / totalDurationMinutes * 100);
  
  // 情绪分布
  const moodDistribution = moodEntries.map(([mood, minutes]) => ({
    mood,
    minutes,
    count: entries.filter(e => e.mood === mood).length
  }));
  
  // 每日统计
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const dailyStats: WeekSummary['dailyStats'] = [];
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekRange.start);
    d.setDate(d.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    const dayEntries = entries.filter(e => {
      const eDate = new Date(e.timestamp);
      return `${eDate.getFullYear()}-${String(eDate.getMonth() + 1).padStart(2, '0')}-${String(eDate.getDate()).padStart(2, '0')}` === dateStr;
    });
    
    const avgEnergy = dayEntries.length > 0
      ? dayEntries.reduce((sum, e) => sum + (e.energyDelta || e.moodScore / 2), 0) / dayEntries.length
      : 0;
    
    dailyStats.push({
      date: dateStr,
      dayName: dayNames[d.getDay()],
      avgEnergy: Math.round(avgEnergy * 10) / 10,
      entryCount: dayEntries.length
    });
  }
  
  // 能量趋势（比较前半周和后半周）
  const firstHalf = dailyStats.slice(0, 3).filter(d => d.entryCount > 0);
  const secondHalf = dailyStats.slice(4).filter(d => d.entryCount > 0);
  
  const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((s, d) => s + d.avgEnergy, 0) / firstHalf.length : 0;
  const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((s, d) => s + d.avgEnergy, 0) / secondHalf.length : 0;
  
  let energyTrend: 'up' | 'down' | 'stable' = 'stable';
  if (secondAvg - firstAvg > 1) energyTrend = 'up';
  else if (firstAvg - secondAvg > 1) energyTrend = 'down';
  
  // 峰值和谷值
  const validDays = dailyStats.filter(d => d.entryCount > 0);
  validDays.sort((a, b) => b.avgEnergy - a.avgEnergy);
  const peakDay = validDays[0]?.dayName || '-';
  const peakEnergy = validDays[0]?.avgEnergy || 0;
  const valleyDay = validDays[validDays.length - 1]?.dayName || '-';
  const valleyEnergy = validDays[validDays.length - 1]?.avgEnergy || 0;
  
  // 关键词提取（简单版本：从内容中提取高频词）
  const allText = entries.map(e => e.content + ' ' + e.tags.join(' ')).join(' ');
  const commonKeywords = ['工作', '学习', '休息', '家人', '朋友', '焦虑', '开心', '压力', '睡眠', '运动'];
  const keywords = commonKeywords.filter(kw => allText.includes(kw));
  
  return {
    weekKey,
    weekRange,
    totalEntries,
    totalDurationMinutes,
    avgEnergyDelta: Math.round(avgEnergyDelta * 10) / 10,
    dominantMood,
    dominantMoodRatio,
    energyTrend,
    peakDay,
    peakEnergy,
    valleyDay,
    valleyEnergy,
    keywords,
    dailyStats,
    moodDistribution
  };
}

// ==========================================
// AI 生成
// ==========================================

interface AIReportContent {
  observation: {
    headline: string;
    body: string;
    pattern?: string;
  };
  experiment: {
    title: string;
    instruction: string;
    duration: string;
    expectedOutcome: string;
  };
}

/**
 * 调用 AI 生成报告内容
 */
async function generateAIContent(summary: WeekSummary): Promise<AIReportContent> {
  const prompt = buildReportPrompt(summary);
  
  try {
    // 使用 DeepSeek API
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(import.meta as any).env?.VITE_DEEPSEEK_API_KEY || ''}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: MENTOR_CONFIG.systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 800
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    // 解析 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        observation: parsed.observation,
        experiment: parsed.experiment
      };
    }
    
    throw new Error('Failed to parse AI response');
  } catch (error) {
    console.error('AI generation failed:', error);
    // 降级到模板生成
    return generateTemplateContent(summary);
  }
}

/**
 * 构建 Prompt
 */
function buildReportPrompt(summary: WeekSummary): string {
  return `
请基于用户上周的情绪日记数据，生成一份周报。

【数据摘要】
- 时间：${summary.weekRange.start} 至 ${summary.weekRange.end}
- 记录条数：${summary.totalEntries} 条
- 总记录时长：${Math.round(summary.totalDurationMinutes / 60 * 10) / 10} 小时
- 主导情绪：${summary.dominantMood}（占比 ${summary.dominantMoodRatio}%）
- 平均能量变化：${summary.avgEnergyDelta > 0 ? '+' : ''}${summary.avgEnergyDelta}
- 能量趋势：${summary.energyTrend === 'up' ? '上升' : summary.energyTrend === 'down' ? '下降' : '平稳'}
- 最高能量日：${summary.peakDay}（${summary.peakEnergy > 0 ? '+' : ''}${summary.peakEnergy}）
- 最低能量日：${summary.valleyDay}（${summary.valleyEnergy > 0 ? '+' : ''}${summary.valleyEnergy}）

【每日能量分布】
${summary.dailyStats.map(d => `${d.dayName}: ${d.avgEnergy > 0 ? '+' : ''}${d.avgEnergy} (${d.entryCount}条)`).join('\n')}

【情绪时长分布】
${summary.moodDistribution.map(m => `${m.mood}: ${Math.round(m.minutes)}分钟`).join('\n')}

【输出格式】（严格 JSON）
{
  "observation": {
    "headline": "一句洞察（12字以内），如：'你在用疲惫证明自己'",
    "body": "具体观察（120字左右）。引用1-2个具体数据点。用第二人称'你'。像纳瓦尔说话：冷静、深刻、不鸡汤。可以引用一句纳瓦尔的核心理念。",
    "pattern": "发现的行为模式（可选，40字）"
  },
  "experiment": {
    "title": "实验名称（8字以内），如：'周三无会议'",
    "instruction": "具体做法（40字），要非常具体、可执行，包含具体时间",
    "duration": "试一周",
    "expectedOutcome": "可能带来的改变（25字）"
  }
}

要求：
1. 不说教，用观察语气
2. 必须引用数据（如"周三的能量跌到-8"）
3. 实验要具体（不要"多运动"，要"周三下午5点去散步30分钟"）
4. 语气像纳瓦尔：简洁、深刻、实用`;
}

/**
 * 模板降级生成（当 AI 失败时）
 */
function generateTemplateContent(summary: WeekSummary): AIReportContent {
  const headlines = [
    '你在用忙碌逃避思考',
    '情绪是你的反馈系统',
    '能量在低效事务中流失',
    '你在忽视自己的信号',
    '平静是稀缺资源'
  ];
  
  const headline = headlines[Math.floor(Math.random() * headlines.length)];
  
  let body = `这周你记录了${summary.totalEntries}条情绪，平均能量为${summary.avgEnergyDelta > 0 ? '+' : ''}${summary.avgEnergyDelta}。`;
  
  if (summary.peakEnergy > summary.valleyEnergy + 3) {
    body += `${summary.peakDay}是你能量最高的一天（${summary.peakEnergy > 0 ? '+' : ''}${summary.peakEnergy}），而${summary.valleyDay}跌到了${summary.valleyEnergy}。纳瓦尔说："判断力是核心能力。"注意这种波动背后的模式。`;
  } else {
    body += `整体能量比较${summary.energyTrend === 'stable' ? '平稳' : summary.energyTrend === 'up' ? '上升' : '下降'}。纳瓦尔说："追求财富，而不是金钱。"你的情绪财富在哪里积累？`;
  }
  
  const experiments = [
    {
      title: '周三无会议',
      instruction: '这周三下午不安排任何会议，用2小时做重要但不紧急的事',
      expectedOutcome: '观察能量是否比上周三更高'
    },
    {
      title: '晨间10分钟',
      instruction: '每天起床后不碰手机，静坐10分钟或写3行日记',
      expectedOutcome: '建立一天的主权感'
    },
    {
      title: '情绪标签',
      instruction: '每次记录时，加一个标签：这是「必须做」还是「选择做」',
      expectedOutcome: '发现有多少事是自我强加的'
    }
  ];
  
  const exp = experiments[Math.floor(Math.random() * experiments.length)];
  
  return {
    observation: {
      headline,
      body,
      pattern: '你倾向于在情绪低谷时记录，而高峰时常常忘记'
    },
    experiment: {
      title: exp.title,
      instruction: exp.instruction,
      duration: '试一周',
      expectedOutcome: exp.expectedOutcome
    }
  };
}

// ==========================================
// 主入口
// ==========================================

/**
 * 生成周报
 */
export async function generateWeeklyReport(weekKey?: string): Promise<WeeklyReport> {
  const targetWeek = weekKey || getCurrentWeekKey();
  const weekRange = getWeekRange(targetWeek);
  
  // 1. 获取该周的所有条目
  const allEntries = await databaseService.getAllEntries();
  const weekEntries = allEntries.filter(e => {
    const date = new Date(e.timestamp);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return dateStr >= weekRange.start && dateStr <= weekRange.end;
  });
  
  // 2. 聚合数据
  const summary = aggregateWeekData(weekEntries);
  
  // 3. 生成 AI 内容
  const aiContent = await generateAIContent(summary);
  
  // 4. 匹配推荐
  const book = matchBookRecommendation(
    summary.keywords,
    summary.dominantMood,
    weekEntries.map(e => ({ content: e.content, tags: e.tags }))
  );
  
  // 5. 组装报告
  const report: WeeklyReport = {
    id: `report_${targetWeek}_${Date.now()}`,
    weekKey: targetWeek,
    weekRange,
    generatedAt: Date.now(),
    content: {
      snapshot: {
        totalEntries: summary.totalEntries,
        totalDurationMinutes: summary.totalDurationMinutes,
        avgEnergyDelta: summary.avgEnergyDelta,
        dominantMood: summary.dominantMood,
        energyTrend: summary.energyTrend,
        peakDay: summary.peakDay,
        peakEnergy: summary.peakEnergy,
        valleyDay: summary.valleyDay,
        valleyEnergy: summary.valleyEnergy
      },
      observation: aiContent.observation,
      experiment: aiContent.experiment,
      recommendation: {
        type: 'book',
        title: book.title,
        author: book.author,
        why: `这周你的情绪关键词是"${summary.dominantMood}"，${book.concept}可能对你有帮助。${book.quote}`,
        link: undefined
      },
      chartData: {
        dailyEnergy: summary.dailyStats.map(d => ({
          day: d.dayName,
          value: d.avgEnergy,
          date: d.date
        })),
        moodDistribution: summary.moodDistribution.map(m => ({
          mood: m.mood,
          minutes: m.minutes,
          color: '' // 会在组件中动态获取
        })),
        timeQuality: {
          highEnergyHours: Math.round(summary.moodDistribution
            .filter(m => ['开心', '平静'].includes(m.mood))
            .reduce((s, m) => s + m.minutes, 0) / 60 * 10) / 10,
          lowEnergyHours: Math.round(summary.moodDistribution
            .filter(m => ['疲惫', '焦虑', '内耗', '难过'].includes(m.mood))
            .reduce((s, m) => s + m.minutes, 0) / 60 * 10) / 10,
          recoveryEfficiency: summary.energyTrend === 'up' ? 75 : summary.energyTrend === 'stable' ? 60 : 45
        }
      }
    },
    tracking: {
      experimentAccepted: false
    }
  };
  
  // 6. 保存
  await databaseService.saveWeeklyReport(report);
  
  // 7. 设置周报通知（下周）
  await scheduleWeeklyReportNotification();
  
  return report;
}

/**
 * 检查是否需要生成新周报（周一凌晨调用）
 */
/**
 * 检查是否到周报生成时间（周日晚上8点之后）
 */
export function isWeeklyReportGenerationTime(): boolean {
  const now = new Date();
  const day = now.getDay(); // 0=周日, 1=周一...
  const hour = now.getHours();
  
  // 周日晚上8点(20:00)之后
  return day === 0 && hour >= 20;
}

/**
 * 获取本周周报状态
 */
export async function getWeeklyReportStatus(): Promise<{
  report: WeeklyReport | null;
  canGenerate: boolean;
  entryCount: number;
  isGenerationTime: boolean;
}> {
  const currentWeek = getCurrentWeekKey();
  const report = await databaseService.getWeeklyReport(currentWeek);
  
  const allEntries = await databaseService.getAllEntries();
  const weekRange = getWeekRange(currentWeek);
  const weekEntries = allEntries.filter(e => {
    const date = new Date(e.timestamp);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return dateStr >= weekRange.start && dateStr <= weekRange.end;
  });
  
  return {
    report,
    canGenerate: weekEntries.length >= 3,
    entryCount: weekEntries.length,
    isGenerationTime: isWeeklyReportGenerationTime()
  };
}

/**
 * 获取指定日期所在周的周报状态
 */
export async function getWeeklyReportStatusForDate(date: Date): Promise<{
  report: WeeklyReport | null;
  canGenerate: boolean;
  entryCount: number;
  isGenerationTime: boolean;
  weekKey: string;
}> {
  const weekKey = getWeekKeyForDate(date);
  const report = await databaseService.getWeeklyReport(weekKey);
  
  const allEntries = await databaseService.getAllEntries();
  const weekRange = getWeekRange(weekKey);
  const weekEntries = allEntries.filter(e => {
    const entryDate = new Date(e.timestamp);
    const dateStr = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}-${String(entryDate.getDate()).padStart(2, '0')}`;
    return dateStr >= weekRange.start && dateStr <= weekRange.end;
  });
  
  // 判断是否是指定日期所在周的周日20:00后
  const targetWeekSunday = new Date(weekRange.end);
  targetWeekSunday.setHours(20, 0, 0, 0);
  const now = new Date();
  const isPastGenerationTime = now > targetWeekSunday;
  
  return {
    report,
    canGenerate: weekEntries.length >= 3,
    entryCount: weekEntries.length,
    isGenerationTime: isPastGenerationTime,
    weekKey
  };
}

/**
 * 重新生成周报（强制覆盖）
 */
export async function regenerateWeeklyReport(weekKey?: string): Promise<WeeklyReport | null> {
  const targetWeek = weekKey || getCurrentWeekKey();
  
  // 删除旧周报
  await databaseService.deleteWeeklyReport(targetWeek);
  
  // 重新生成
  return generateWeeklyReport(targetWeek);
}

/**
 * 获取或生成当前周报告
 * 方案一：周日晚上8点后才生成
 */
export async function getOrGenerateCurrentReport(): Promise<WeeklyReport | null> {
  const currentWeek = getCurrentWeekKey();
  let report = await databaseService.getWeeklyReport(currentWeek);
  
  // 如果已经有周报，直接返回
  if (report) {
    return report;
  }
  
  // 检查是否到生成时间（周日晚上8点后）
  if (!isWeeklyReportGenerationTime()) {
    return null; // 还没到生成时间
  }
  
  // 检查是否有足够数据
  const allEntries = await databaseService.getAllEntries();
  const weekRange = getWeekRange(currentWeek);
  const weekEntries = allEntries.filter(e => {
    const date = new Date(e.timestamp);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return dateStr >= weekRange.start && dateStr <= weekRange.end;
  });
  
  // 至少3条记录才生成
  if (weekEntries.length >= 3) {
    report = await generateWeeklyReport(currentWeek);
  }
  
  return report;
}
