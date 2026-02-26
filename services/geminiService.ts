import { DiaryEntry, AIAnalysis, MentorType } from "../types";
import { MoodOption, MENTORS, DEFAULT_MENTOR } from "../constants";
import { getEntryDurationMinutes, formatDuration } from "../utils/timeUtils";

// ==========================================
// ⚙️ AI 设置开关 (一键切换)
// ==========================================

// 选项: 'GEMINI' | 'DEEPSEEK'
// 部署安卓时，如果 Gemini 不可用，请改为 'DEEPSEEK'
const CURRENT_PROVIDER: 'GEMINI' | 'DEEPSEEK' = 'DEEPSEEK';

// ==========================================
// 🔑 API 配置
// ==========================================

// Google Gemini API Key (如需使用 Gemini，请配置)
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";

// ==========================================
// 🌐 API 端点配置
// ==========================================

// Cloudflare Pages Function 代理地址 (同域名，避免跨域问题)
// 优先使用环境变量配置，否则使用同域名的 /api/chat 路由
const AI_PROXY_URL = (import.meta as any).env?.VITE_AI_PROXY_URL || "/api/chat";

// DeepSeek 直连地址 (用于本地开发或 Android 原生应用)
const DEEPSEEK_DIRECT_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_API_KEY = (import.meta as any).env?.VITE_DEEPSEEK_API_KEY || "";

// 是否使用代理模式：有 API Key 时直连，否则使用代理
const USE_PROXY = !DEEPSEEK_API_KEY;

// ==========================================
// 🐳 DeepSeek 帮助函数
// ==========================================

async function callDeepSeek(systemPrompt: string, userPrompt: string): Promise<string> {
  const requestBody = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    response_format: { type: "json_object" },
    temperature: 1.3
  };

  try {
    let response: Response;

    if (USE_PROXY) {
      // 代理模式：通过 Cloudflare Worker 转发请求
      console.log("Using AI Proxy...");
      response = await fetch(AI_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });
    } else {
      // 直连模式：本地开发或 Android 原生应用
      if (!DEEPSEEK_API_KEY) throw new Error("DeepSeek API Key 未配置");
      console.log("Using DeepSeek Direct...");
      response = await fetch(DEEPSEEK_DIRECT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify(requestBody)
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API Error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content || "{}";
  } catch (error) {
    console.error("DeepSeek Call Failed:", error);
    throw error;
  }
}

// DeepSeek 文本模式调用（用于深度回看等非结构化输出）
async function callDeepSeekText(systemPrompt: string, userPrompt: string): Promise<string> {
  const requestBody = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 1.0
  };

  try {
    let response: Response;

    if (USE_PROXY) {
      console.log("Using AI Proxy (Text Mode)...");
      response = await fetch(AI_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });
    } else {
      if (!DEEPSEEK_API_KEY) throw new Error("DeepSeek API Key 未配置");
      console.log("Using DeepSeek Direct (Text Mode)...");
      response = await fetch(DEEPSEEK_DIRECT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify(requestBody)
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API Error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content || "";
  } catch (error) {
    console.error("DeepSeek Text Call Failed:", error);
    throw error;
  }
}

// 辅助函数：清理 JSON 字符串 (有时候模型会返回 ```json ... ```)
function cleanJsonString(str: string): string {
  if (!str) return "{}";
  // 移除 markdown 代码块标记
  let cleaned = str.replace(/```json/g, "").replace(/```/g, "").trim();
  return cleaned;
}

// ==========================================
// 🚀 业务逻辑导出
// ==========================================

/**
 * 根据心情标签关键词判断应该是正面还是负面
 * 用于校正 AI 生成的错误分数
 */
const getExpectedScoreSign = (label: string): number | null => {
  const negativeKeywords = ['崩溃', '内耗', '难过', '伤心', '痛苦', '绝望', '焦虑', '抑郁', '愤怒', '生气', '烦躁', '疲惫', '累', '纠结', '内疚', '后悔', '失望', '沮丧', '郁闷', '不爽', '糟', '烂', '差', '坏', '烦', '恼', '愁', '悲', '哀', '惨', '恐', '惧', '怕', '慌', '乱', '急', '躁'];
  const positiveKeywords = ['开心', '快乐', '幸福', '满足', '愉快', '兴奋', '激动', '惊喜', '棒', '好', '爽', '赞', '爱', '喜欢', '乐', '笑', '甜', '美', '优', '良', '佳', '安', '静', '平', '和', '宁', '舒', '畅', '顺', '畅', '赢', '胜', '成', '喜', '欢', '悦', '怡', '快', '畅', '爽', '酷', '赞'];
  
  const lowerLabel = label.toLowerCase();
  if (negativeKeywords.some(kw => lowerLabel.includes(kw))) return -1;
  if (positiveKeywords.some(kw => lowerLabel.includes(kw))) return 1;
  return null; // 无法确定
};

export const generateMoodMetadata = async (moodLabel: string): Promise<Partial<MoodOption>> => {
  // --- 提示词 ---
  const promptText = `
    用户输入了一个新的心情标签： "${moodLabel}"。
    请根据这个词的语义，生成以下元数据。

    必须严格返回合法的 JSON 格式，不要包含任何 markdown 标记。
    JSON 结构如下:
    {
      "emoji": "最能代表这个心情的 emoji",
      "color": "Tailwind CSS 背景颜色类名 (如 bg-emerald-500, bg-rose-500)",
      "hexColor": "对应的 hex 颜色值 (如 #10b981, #f43f5e)",
      "score": -10 到 +10 的整数评分（新能量系统）
    }

    【重要】评分规则（能量电池系统）:
    - +8 ~ +10: 极度开心、狂喜
    - +3 ~ +7: 愉快、满足、顺利
    - +1 ~ +2: 平静、安稳
    - -1 ~ -3: 轻微不适、小烦恼
    - -4 ~ -6: 疲惫、焦虑、反刍
    - -7 ~ -10: 难过、愤怒、严重内耗

    【关键要求】
    - 负面情绪（如：崩溃、难过、焦虑、愤怒、疲惫）必须返回负数，范围 -5 到 -10
    - 正面情绪（如：开心、满足、兴奋）必须返回正数，范围 +5 到 +10
    - "崩溃"属于严重负面情绪，分数应该是 -8 到 -10 之间

    颜色规则:
    - 正面/平静 -> 绿色、青色、蓝绿色系 (bg-emerald-500/#10b981, bg-teal-500/#14b8a6, bg-sky-400/#38bdf8)
    - 负面/激烈 -> 紫色、黄色、红色系 (bg-purple-500/#a855f7, bg-amber-500/#f59e0b, bg-rose-500/#f43f5e)
    - 中性/平淡 -> 灰色、蓝灰色系 (bg-slate-500/#64748b, bg-gray-400/#9ca3af)
  `;

  try {
    let jsonString = "{}";

    if (CURRENT_PROVIDER === 'DEEPSEEK') {
      console.log("Using DeepSeek for Metadata...");
      jsonString = await callDeepSeek(
        "你是一个辅助生成 UI 样式的 JSON 生成器。请严格按照评分规则返回正确的分数。",
        promptText
      );
    } else {
      // Gemini Implementation - 需要 @google/genai 依赖
      throw new Error("Gemini provider not configured. Please use DEEPSEEK.");
    }

    const result = JSON.parse(cleanJsonString(jsonString));
    console.log(`[MoodMetadata] DeepSeek 原始返回:`, result);
    let score = Math.max(-10, Math.min(10, result.score ?? 0));
    console.log(`[MoodMetadata] 解析后分数: ${score}`);
    
    // 校正：根据关键词修正 AI 可能产生的错误分数
    const expectedSign = getExpectedScoreSign(moodLabel);
    if (expectedSign !== null) {
      if (expectedSign < 0 && score > 0) {
        // 应该是负数但却是正数，取反并加强负面程度
        score = -Math.abs(score) - 3;
        console.log(`[MoodMetadata] 校正分数: ${moodLabel} ${result.score} -> ${score} (负面情绪应为负值)`);
      } else if (expectedSign > 0 && score < 0) {
        // 应该是正数但却是负数，取反
        score = Math.abs(score);
        console.log(`[MoodMetadata] 校正分数: ${moodLabel} ${result.score} -> ${score} (正面情绪应为正值)`);
      }
    }
    
    // 确保在范围内
    score = Math.max(-10, Math.min(10, score));
    
    return {
      emoji: result.emoji || '🏷️',
      color: result.color || 'bg-slate-400',
      hexColor: result.hexColor || '#94a3b8',
      score: score
    };
  } catch (error) {
    console.error(`Failed to generate mood metadata (${CURRENT_PROVIDER}):`, error);
    return {
      emoji: '🏷️',
      color: 'bg-slate-400',
      hexColor: '#94a3b8',
      score: 0  // V2 能量系统默认 0（中性）
    };
  }
};

export const evaluateMoodScore = async (mood: string, content: string, presetScore: number = 0): Promise<number> => {
  const promptText = `
    请根据用户的日记内容和心情标签，为用户当前的心情评估能量变化值。

    心情标签: ${mood}
    预设能量值: ${presetScore}
    日记内容: ${content}

    【能量电池系统说明】
    - 每天用户起始能量为 100
    - 正向情绪增加能量（正分），负向情绪消耗能量（负分）
    - 范围：-10 到 +10

    【你的任务】
    根据日记内容的具体描述，在预设分数基础上进行微调：
    - 如果内容描述的情绪强度比标签更强烈，可以适当调整 1-2 分
    - 如果内容比较轻描淡写，可以适当减轻 1-2 分
    - 微调范围：预设分数 ± 2

    【评分参考】
    +8 ~ +10: 极度开心、狂喜
    +3 ~ +7: 愉快、满足、顺利
    +1 ~ +2: 平静、安稳
    -1 ~ -3: 轻微不适、小烦恼
    -4 ~ -6: 疲惫、焦虑、反刍
    -7 ~ -10: 难过、愤怒、严重内耗

    请返回 JSON 格式: { "score": 数值 }
    score 必须是 -10 到 +10 之间的数字。
  `;

  try {
    let jsonString = "{}";

    if (CURRENT_PROVIDER === 'DEEPSEEK') {
      console.log("Using DeepSeek for Energy Scoring...");
      jsonString = await callDeepSeek(
        "你是一位细腻的情感分析师，擅长从文字中感受情绪强度。请只返回 JSON。",
        promptText
      );
    } else {
      throw new Error("Gemini provider not configured. Please use DEEPSEEK.");
    }

    const result = JSON.parse(cleanJsonString(jsonString));
    // 强制限制在预设分数 ±2 范围内，防止 AI 偏离过大
    const rawScore = result.score ?? presetScore;
    const minAllowed = Math.max(-10, presetScore - 2);
    const maxAllowed = Math.min(10, presetScore + 2);
    const score = Math.max(minAllowed, Math.min(maxAllowed, rawScore));
    console.log(`[evaluateMoodScore] 心情:${mood}, 预设:${presetScore}, AI返回:${result.score}, 范围:[${minAllowed},${maxAllowed}], 最终:${score}`);
    return score;
  } catch (error) {
    console.error(`Energy evaluation failed (${CURRENT_PROVIDER}):`, error);
    return presetScore; // 失败时返回预设分数
  }
};

export const analyzeMoods = async (entries: DiaryEntry[]): Promise<AIAnalysis> => {
  const entriesSummary = entries.map(e => ({
    time: new Date(e.timestamp).toLocaleString(),
    mood: e.mood,
    score: e.moodScore,
    content: e.content,
    durationMinutes: getEntryDurationMinutes(e)
  }));

  const promptText = `
    以下是用户最近的一系列心情日记记录：
    ${JSON.stringify(entriesSummary, null, 2)}

    【数据说明】
    - durationMinutes 表示该情绪持续的时间（分钟），null 表示用户未记录持续时间。
    - 持续时间越长的情绪，对用户的整体状态影响越大，分析时应给予更高权重。
      例如"焦虑持续了3小时"和"焦虑闪过10分钟"对用户的消耗完全不同。

    请分析用户的心情"晴雨表"。
    识别出用户心情较好的时间段和突发的情绪低谷。
    如果某条记录有持续时间，请在分析中体现其时间维度的影响。
    给出最真诚、有用的建议。

    【重点】：请用一个最有神韵的汉字或一个简短的词（不超过3个字）来形容这段时间的状态（例如：静、破茧、小确幸、乱、沉淀），放入 keyword 字段。

    必须返回符合以下结构的严格 JSON:
    {
      "keyword": "一个字或词",
      "summary": "全天/全周心情总评字符串",
      "moodBarometer": {
        "period": "分析的时间段",
        "trend": "rising" 或 "falling" 或 "stable",
        "explanation": "趋势说明"
      },
      "suggestions": ["建议1", "建议2"...],
      "peaks": ["心情好的时刻1", "时刻2"...],
      "valleys": ["心情差的时刻1", "时刻2"...]
    }
  `;

  try {
    let jsonString = "{}";

    if (CURRENT_PROVIDER === 'DEEPSEEK') {
      console.log("Using DeepSeek for Analysis...");
      jsonString = await callDeepSeek(
        "你是一位资深的心理咨询师和人生教练。请只返回 JSON 格式的分析报告。",
        promptText
      );
    } else {
      throw new Error("Gemini provider not configured. Please use DEEPSEEK.");
    }

    const result = JSON.parse(cleanJsonString(jsonString));
    return result as AIAnalysis;
  } catch (error) {
    console.error(`Failed to analyze moods (${CURRENT_PROVIDER})`, error);
    throw new Error("AI 分析失败");
  }
};

// 生成 AI 情绪调节建议（仅在负面情绪时调用）
export const generateRegulationSuggestions = async (
  mood: string,
  content: string,
  moodScore: number,
  mentor: MentorType = DEFAULT_MENTOR
): Promise<string[]> => {
  const mentorConfig = MENTORS[mentor];

  const promptText = `
    用户刚刚写了一篇负面情绪的心情日记：

    心情标签: ${mood}
    情绪能量值: ${moodScore}分（-10到+10分，负数=消耗能量，正数=恢复能量）
    日记内容: ${content}

    请根据用户的具体情绪和日记内容，以${mentorConfig.name}的风格，给出2-3条针对性的行动建议。

    要求：
    1. 每条建议15-30个字，具体可执行
    2. 必须符合你的导师风格（不要空洞的"深呼吸"、"放松心情"）
    3. 建议要与日记内容相关，而不是通用建议

    返回 JSON 格式: { "suggestions": ["建议1", "建议2", "建议3"] }
  `;

  try {
    let jsonString = "{}";

    if (CURRENT_PROVIDER === 'DEEPSEEK') {
      console.log(`Using DeepSeek for Regulation Suggestions (${mentorConfig.name})...`);
      jsonString = await callDeepSeek(
        mentorConfig.systemPrompt.regulation,
        promptText
      );
    } else {
      throw new Error("Gemini provider not configured. Please use DEEPSEEK.");
    }

    const result = JSON.parse(cleanJsonString(jsonString));
    return result.suggestions || [];
  } catch (error) {
    console.error(`Regulation suggestions generation failed (${CURRENT_PROVIDER}):`, error);
    return []; // 失败时返回空数组，不显示建议
  }
};

// 生成 AI 暖心回复
export const generateAiReply = async (
  mood: string, 
  content: string, 
  moodScore?: number,
  mentor: MentorType = DEFAULT_MENTOR
): Promise<string> => {
  const mentorConfig = MENTORS[mentor];
  
  // 判断是否需要鼓励（V2 系统：负数或 ≤ -3 认为是负面情绪）
  const needsEncouragement = moodScore !== undefined && moodScore < 0;

  const promptText = `
    用户刚刚写了一篇心情日记：

    心情标签: ${mood}
    日记内容: ${content}
    ${moodScore !== undefined ? `情绪能量值: ${moodScore}分（-10到+10，负数=负面情绪）` : ''}

    请用一句温暖、真诚的话回应用户。
    
    ${needsEncouragement ? `
    【重要】用户情绪低落（能量值为负数），请在回复最后另起一行，加上一句简短有力的金句：
       - 要与日记内容相关，针对用户的具体困境
       - 15-25个字，有力量感，能给人希望
       - 用「」符号包裹，如：「黑夜之后，总有黎明」
       - 符合你的导师风格，避免老套
    ` : ''}

    返回 JSON 格式: { "reply": "你的回复${needsEncouragement ? '\\n\\n「金句」' : ''}" }
  `;

  try {
    let jsonString = "{}";

    if (CURRENT_PROVIDER === 'DEEPSEEK') {
      console.log(`Using DeepSeek for AI Reply (${mentorConfig.name})...`);
      jsonString = await callDeepSeek(
        mentorConfig.systemPrompt.reply,
        promptText
      );
    } else {
      throw new Error("Gemini provider not configured. Please use DEEPSEEK.");
    }

    const result = JSON.parse(cleanJsonString(jsonString));
    return result.reply || "我听到你了 💫";
  } catch (error) {
    console.error(`AI Reply generation failed (${CURRENT_PROVIDER}):`, error);
    return ""; // 失败时返回空，不显示回复
  }
};

// 每日总结接口
export interface DailySummary {
  date: string;        // 日期 如 "2月9日"
  keyword: string;     // 一个字或词 如 "忙"、"充实"
  emoji: string;       // 代表这天的 emoji
  avgScore: number;    // 平均分
}

// 周报接口
export interface WeeklyReport {
  period: string;
  overallEmoji: string;
  summary: string;
  dailySummaries: DailySummary[];  // 每日总结
  negativePeaks: {
    period: string;
    frequency: number;
    commonMoods: string[];
  }[];
  suggestions: string[];
}

// 触发因素分析接口
export interface TriggerFactor {
  category: string;      // 事件类型（如：工作、社交、家庭）
  count: number;         // 出现次数
  avgScore: number;      // 平均情绪能量值（-10到+10）
  trend: 'positive' | 'neutral' | 'negative';  // 情绪倾向
}

export interface TriggerAnalysis {
  factors: TriggerFactor[];
  insight: string;       // AI 洞察总结
  timestamp: number;     // 分析时间戳（用于缓存判断）
}

// 生成 AI 情绪周报
export const generateWeeklyReport = async (
  entries: DiaryEntry[],
  mentor: MentorType = DEFAULT_MENTOR
): Promise<WeeklyReport> => {
  if (entries.length === 0) {
    return {
      period: '过去一周',
      overallEmoji: '📭',
      summary: '这周还没有记录，开始记录你的心情吧！',
      dailySummaries: [],
      negativePeaks: [],
      suggestions: ['每天花几分钟记录心情，帮助你更好地了解自己']
    };
  }

  // 按日期分组
  const entriesByDate: Record<string, DiaryEntry[]> = {};
  entries.forEach(entry => {
    const date = new Date(entry.timestamp);
    const dateKey = `${date.getMonth() + 1}月${date.getDate()}日`;
    if (!entriesByDate[dateKey]) {
      entriesByDate[dateKey] = [];
    }
    entriesByDate[dateKey].push(entry);
  });

  // 按日期统计平均分和主要情绪
  const dailyStats = Object.entries(entriesByDate).map(([date, dayEntries]) => {
    const avgScore = dayEntries.reduce((sum, e) => sum + e.moodScore, 0) / dayEntries.length;
    const moods = dayEntries.map(e => e.mood).join('、');
    const contents = dayEntries.map(e => e.content.substring(0, 30)).join('；');
    return { date, avgScore: avgScore.toFixed(1), moods, contents, count: dayEntries.length };
  });

  // 按时间段分析数据
  const timeAnalysis: Record<string, { count: number; negativeMoods: string[]; scores: number[] }> = {};
  const periods = ['凌晨(0-6点)', '早晨(6-9点)', '上午(9-12点)', '中午(12-14点)', '下午(14-18点)', '傍晚(18-21点)', '深夜(21-24点)'];

  periods.forEach(p => {
    timeAnalysis[p] = { count: 0, negativeMoods: [], scores: [] };
  });

  entries.forEach(entry => {
    const hour = new Date(entry.timestamp).getHours();
    let period = '';
    if (hour < 6) period = '凌晨(0-6点)';
    else if (hour < 9) period = '早晨(6-9点)';
    else if (hour < 12) period = '上午(9-12点)';
    else if (hour < 14) period = '中午(12-14点)';
    else if (hour < 18) period = '下午(14-18点)';
    else if (hour < 21) period = '傍晚(18-21点)';
    else period = '深夜(21-24点)';

    timeAnalysis[period].count++;
    timeAnalysis[period].scores.push(entry.moodScore);
    // V2 系统：负数才是负面情绪（不是 <= 5）
    if (entry.moodScore < 0 || entry.energyDelta !== undefined && entry.energyDelta < 0) {
      timeAnalysis[period].negativeMoods.push(entry.mood);
    }
  });

  const entriesSummary = entries.map(e => ({
    time: new Date(e.timestamp).toLocaleString('zh-CN'),
    mood: e.mood,
    score: e.moodScore,
    content: e.content.substring(0, 50)
  }));

  const promptText = `
    以下是用户过去一周的心情记录数据：

    时间段分析：
    ${JSON.stringify(timeAnalysis, null, 2)}

    按日期统计：
    ${JSON.stringify(dailyStats, null, 2)}

    详细记录（部分）：
    ${JSON.stringify(entriesSummary.slice(0, 15), null, 2)}

    请分析用户的情绪周报，重点关注：
    1. 为每一天生成一个字或词（不超过3个字）+ 一个 emoji 来总结这天的状态
    2. 负面情绪（能量值为负数）在哪些时间段更容易出现？
    3. 针对这些高发时段给出具体可执行的建议

    返回 JSON 格式：
    {
      "period": "分析的时间范围，如 2月1日-2月7日",
      "overallEmoji": "最能代表这周情绪的 emoji",
      "summary": "50字以内的整体情绪概括",
      "dailySummaries": [
        {
          "date": "日期，如 2月9日",
          "keyword": "一个字或词（1-3个字），如：忙、充实、静、破茧、小确幸",
          "emoji": "最能代表这天的 emoji",
          "avgScore": 平均分（数字）
        }
      ],
      "negativePeaks": [
        {
          "period": "时间段名称",
          "frequency": 出现次数,
          "commonMoods": ["常见的负面情绪标签"]
        }
      ],
      "suggestions": ["针对性建议1", "建议2", "建议3"]
    }

    要求：
    - dailySummaries 必须包含所有有记录的日期，按日期从新到旧排序
    - keyword 要有神韵、有洞察力，不要只是简单复述心情标签
    - negativePeaks 只列出负面情绪出现次数≥2的时间段，按频率从高到低排序
    - suggestions 要具体、可执行，与高发时段相关联
    - 语气温和鼓励，不要说教
  `;

  const mentorConfig = MENTORS[mentor];

  try {
    let jsonString = "{}";

    if (CURRENT_PROVIDER === 'DEEPSEEK') {
      console.log(`Using DeepSeek for Weekly Report (${mentorConfig.name})...`);
      jsonString = await callDeepSeek(
        mentorConfig.systemPrompt.weekly,
        promptText
      );
    } else {
      throw new Error("Gemini provider not configured. Please use DEEPSEEK.");
    }

    const result = JSON.parse(cleanJsonString(jsonString));
    return {
      period: result.period || '过去一周',
      overallEmoji: result.overallEmoji || '📊',
      summary: result.summary || '这周的情绪数据已收集完成',
      dailySummaries: result.dailySummaries || [],
      negativePeaks: result.negativePeaks || [],
      suggestions: result.suggestions || []
    };
  } catch (error) {
    console.error(`Weekly report generation failed (${CURRENT_PROVIDER}):`, error);
    return {
      period: '过去一周',
      overallEmoji: '❌',
      summary: '周报生成失败，请稍后重试',
      dailySummaries: [],
      negativePeaks: [],
      suggestions: []
    };
  }
};

// 生成每日深度回看分析
export const generateDailyDeepReflection = async (
  journalContent: string,
  moodEntries: DiaryEntry[],
  analysisType: 'journal-only' | 'moods-only' | 'journal-with-moods'
): Promise<string> => {
  // 移除日记内容中的HTML标签
  const cleanJournalContent = journalContent.replace(/<[^>]*>/g, '').trim();

  // 格式化心情记录
  const sortedEntries = moodEntries.length > 0
    ? [...moodEntries].sort((a, b) => a.timestamp - b.timestamp)
    : [];

  let moodSummary = '';
  if (sortedEntries.length > 0) {
    moodSummary = `【今日心情记录】（${sortedEntries.length}条）：\n`;
    moodSummary += sortedEntries.map(e => {
      const time = new Date(e.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      const emoji = e.moodEmoji || '📝';
      const contentText = e.content.replace(/<[^>]*>/g, '');
      const duration = getEntryDurationMinutes(e);
      const durationStr = duration ? `, 持续${formatDuration(duration)}` : '';
      return `${emoji} ${e.mood} (${time}, ${e.moodScore}分${durationStr})\n${contentText}`;
    }).join('\n\n');
  }

  // 根据分析类型构建用户输入
  let userPrompt = '';
  if (analysisType === 'journal-only') {
    userPrompt = `【今日日记】：\n${cleanJournalContent}`;
  } else if (analysisType === 'moods-only') {
    userPrompt = moodSummary;
  } else {
    // journal-with-moods
    userPrompt = `${moodSummary}\n\n【今日日记】：\n${cleanJournalContent}`;
  }

  // 根据分析类型构建不同的 System Prompt
  let systemPrompt = '';

  if (analysisType === 'moods-only') {
    // 仅心情记录模式：侧重情绪波动规律分析
    systemPrompt = `# Role
你是一位精准的情绪模式识别专家。你擅长从碎片化的心情记录中发现用户的情绪波动规律、时间分布特征，以及背后的触发因素。

# Input Context
用户今天记录了 ${sortedEntries.length} 次心情，包含时间、情绪标签、能量值（-10到+10，负数=负面情绪）、持续时间和简短记录。

# Analysis Focus
1. **情绪黑洞**：重点关注持续时间超过1小时的负面情绪（能量值为负数），这些是最消耗能量的"黑洞"
2. **时间规律**：情绪波动在什么时间段最明显？
3. **触发因素**：哪些事件或场景反复触发情绪波动？
4. **重复模式**：是否存在同一个问题反复出现的情况？

# Output Format & Constraints
- **总字数**：180 字以内
- **语气**：精准、直接，禁止安慰性废话
- **结构**：
  1. **问题识别**（30-40字）：今天情绪波动的核心特征是什么？是否存在"情绪黑洞"（长时间负面情绪）？
  2. **情绪黑洞分析**（30-40字）：如果有长时间负面情绪，分析其触发原因和持续机制
  3. **根因分析**（30-40字）：为什么会出现这种模式？是时间规律、触发事件、还是思维惯性？
  4. **具体行动**（30-40字）：给出1条可执行的微小改变建议，重点针对如何缩短负面情绪持续时间
  5. **一句提醒**（15-20字）：一句警醒的话

# Key Principles
- **重点关注**：持续超过1小时的负面情绪，它们对用户状态的消耗远大于短暂的情绪波动
- 重点识别：**重复性情绪波动**、**分析麻痹**（想太多不行动）、**情绪触发点**
- 不要泛泛而谈，要结合具体的时间、持续时间和事件
- 避免"深呼吸"、"放松心情"等无用建议`;
  } else {
    // 仅日记 或 日记+心情记录模式：统一使用新的精简结构
    const hasMultipleSources = analysisType === 'journal-with-moods';

    systemPrompt = `# Role
你是一位融合了纳瓦尔(Naval)、芒格(Munger)智慧的深度反思陪伴者。你的使命是帮助用户减少内耗、识别思维陷阱，成为更好的自己。

${hasMultipleSources ? `# Input Context
- 用户今天记录了 ${sortedEntries.length} 次心情（瞬时情绪快照）
- 用户在一天结束时写了日记（系统性总结）
请把这些记录当作同一天的完整画像，而不是对立的两面。` : `# Input Context
用户今天写了一篇日记，记录了今天的经历和感受。`}

# Analysis Focus
1. **重复性情绪波动**：用户是否在同一个问题上反复纠结、没有真正解决？
2. **分析麻痹**：用户是否陷入过度思考，而不采取行动？
3. **情绪触发点**：哪些事件或场景总是让用户失控或耗能？

# Output Format & Constraints
- **总字数**：150 字以内
- **语气**：精准、直接、不讨好。禁止"我看到你今天很辛苦"等感性废话
- **结构**（必须严格按照以下格式）：

**问题识别**（30-40字）
[一句话指出今天记录中最核心的内耗来源或思维陷阱]

**根因分析**（40-50字）
[从纳瓦尔/芒格视角分析：这是精力分配问题？心理误判？还是缺乏系统性思考？]

**具体行动**（40-50字）
[给出1-2条具体可执行的微小改变，必须与根因直接相关]

**一句提醒**（15-20字）
[一句警醒的话，让用户无法回避]

# Key Principles
- 重点识别三大内耗：重复性问题、分析麻痹、情绪触发点
- 不要泛泛的建议，要针对具体记录内容
- 不要安慰，要刺激思考和行动
- 每个模块独立成段，用加粗标题标识`;
  }

  try {
    if (CURRENT_PROVIDER === 'DEEPSEEK') {
      console.log('Using DeepSeek for Deep Reflection...');
      const result = await callDeepSeekText(systemPrompt, userPrompt);
      return result.trim();
    } else {
      throw new Error('Gemini provider not configured. Please use DEEPSEEK.');
    }
  } catch (error) {
    console.error(`Deep reflection generation failed (${CURRENT_PROVIDER}):`, error);
    throw new Error('AI 深度回看生成失败，请稍后重试');
  }
};

// ==========================================
// AI晨间日记生成
// ==========================================

export const generateAIDiary = async (
  entries: DiaryEntry[],
  dateStr: string,
  mentorType: MentorType = 'naval'
): Promise<string> => {
  if (entries.length === 0) {
    return '暂无情绪记录，无法生成日记。';
  }

  // 格式化情绪记录
  const sortedEntries = [...entries].sort((a, b) => a.timestamp - b.timestamp);

  const entriesSummary = sortedEntries.map(e => {
    const time = new Date(e.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const emoji = e.moodEmoji || '📝';
    const contentText = e.content.replace(/<[^>]*>/g, '').trim();
    const duration = getEntryDurationMinutes(e);
    const durationStr = duration ? `，持续${formatDuration(duration)}` : '';
    const energyDelta = e.energyDelta ?? e.moodScore ?? 0;
    return `${emoji} ${e.mood} (${time}，能量值${energyDelta > 0 ? '+' : ''}${energyDelta}${durationStr})\n${contentText || '（无详细内容）'}`;
  }).join('\n\n');

  // 获取导师特定的AI日记提示词
  const mentor = MENTORS[mentorType];
  const mentorPrompt = mentor?.systemPrompt?.aiDiary;

  const systemPrompt = mentorPrompt || `你是用户的AI晨间日记助手。基于用户前一天的情绪记录，生成一份结构化的晨间复盘日记。

请严格按照以下格式输出：

## 今天的关键词
- 关键词1（简短解释）
- 关键词2（简短解释）
- 关键词3（简短解释）

## 今天3件超出预期的事
1. **第一件事**：描述发生了什么，为什么超出预期...
2. **第二件事**：描述发生了什么，为什么超出预期...
3. **第三件事**：描述发生了什么，为什么超出预期...

## 今天的痛点、内耗，下次如何改进
**痛点1**：描述具体的痛点或内耗场景...
**改进**：下次可以这样做...

**痛点2**：（如果有的话）...
**改进**：...

## 写给今天的一句话
一句鼓励的话或提醒...

## 要求：
- 基于用户记录的事实，不做过度推断
- 语气温暖、客观、有洞察力
- 如果某些部分没有足够数据，可以写「暂无记录」
- 痛点和改进建议要具体可行，避免空泛的安慰
- 总字数控制在300-500字之间
- 使用中文标点符号`;

  const userPrompt = `日期：${dateStr}

昨天的情绪记录（按时间顺序）：

${entriesSummary}`;

  try {
    if (CURRENT_PROVIDER === 'DEEPSEEK') {
      console.log('Using DeepSeek for AI Diary...');
      const result = await callDeepSeekText(systemPrompt, userPrompt);
      return result.trim();
    } else {
      throw new Error('Gemini provider not configured. Please use DEEPSEEK.');
    }
  } catch (error) {
    console.error(`AI Diary generation failed (${CURRENT_PROVIDER}):`, error);
    throw new Error('AI晨间日记生成失败，请稍后重试');
  }
};

// 分析情绪触发因素
export const analyzeTriggerFactors = async (entries: DiaryEntry[]): Promise<TriggerAnalysis> => {
  if (entries.length === 0) {
    return {
      factors: [],
      insight: '暂无数据可分析',
      timestamp: Date.now()
    };
  }

  const entriesSummary = entries.map(e => ({
    time: new Date(e.timestamp).toLocaleString('zh-CN'),
    mood: e.mood,
    score: e.moodScore,
    content: e.content.substring(0, 100)
  }));

  const promptText = `
    以下是用户过去一周的心情日记记录：
    ${JSON.stringify(entriesSummary, null, 2)}

    请分析这些日记内容，提取出影响用户情绪的事件类型/触发因素。

    要求：
    1. 从日记内容中识别出事件类型，例如：工作、社交、家庭、健康、学习、娱乐、感情、金钱、天气、独处等
    2. 每个事件类型统计出现次数和关联的平均情绪分数
    3. 根据平均分判断情绪倾向：≥7分为positive，4-6分为neutral，≤3分为negative
    4. 只返回出现次数≥1的事件类型，最多返回8个
    5. 按平均分从高到低排序
    6. 生成一句20-40字的洞察总结，指出哪类事件对情绪影响最好/最差

    返回 JSON 格式：
    {
      "factors": [
        {
          "category": "事件类型名称",
          "count": 出现次数(数字),
          "avgScore": 平均情绪分(数字，保留1位小数),
          "trend": "positive" 或 "neutral" 或 "negative"
        }
      ],
      "insight": "洞察总结，如：社交活动明显提升你的心情，而工作相关的事件容易导致情绪低落"
    }

    注意：
    - category 要简洁（2-4个字），如"工作会议"、"家人相处"、"独处反思"
    - 如果日记内容没有明确提到某类事件，不要强行归类
    - avgScore 要根据关联日记的 moodScore 字段计算
  `;

  try {
    let jsonString = "{}";

    if (CURRENT_PROVIDER === 'DEEPSEEK') {
      console.log("Using DeepSeek for Trigger Analysis...");
      jsonString = await callDeepSeek(
        "你是一位专业的心理数据分析师，擅长从日记内容中识别情绪触发因素。请只返回 JSON。",
        promptText
      );
    } else {
      throw new Error("Gemini provider not configured. Please use DEEPSEEK.");
    }

    const result = JSON.parse(cleanJsonString(jsonString));
    return {
      factors: result.factors || [],
      insight: result.insight || '分析完成',
      timestamp: Date.now()
    };
  } catch (error) {
    console.error(`Trigger analysis failed (${CURRENT_PROVIDER}):`, error);
    return {
      factors: [],
      insight: '分析失败，请稍后重试',
      timestamp: Date.now()
    };
  }
};

// 生成本周叙事性总结
export const generateWeeklySummary = async (entries: DiaryEntry[]): Promise<string> => {
  if (entries.length === 0) {
    throw new Error('本周记录过少');
  }

  const entriesSummary = entries.map(e => ({
    time: new Date(e.timestamp).toLocaleString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    mood: e.mood,
    score: e.moodScore,
    content: e.content
  }));

  const promptText = `
    以下是用户本周的心情日记记录：
    ${JSON.stringify(entriesSummary, null, 2)}

    请为用户生成一篇温暖陪伴式的叙事性总结，标题为「本周你经历了...」

    要求：
    1. 长度：300-500字，4-5个段落
    2. 语气：温暖陪伴式，像朋友一样关心用户，不要说教或分析
    3. 结构：
       - 第1段：开场，概括本周情绪的整体感受，用生动的比喻或意象
       - 第2-3段：按时间线串联情绪变化，识别高潮、低谷、转折点
         * 要结合具体的日记内容和情绪标签
         * 用故事化的语言，而不是数据罗列
         * 例如："周一的你还在xxx的阴影中，到了周三xxx让你重新振作..."
       - 第4段：分析情绪起伏的内在联系，给予理解和共情
       - 第5段：以温暖鼓励结尾，给予力量和希望
    4. 禁止：
       - 不要使用"你好"、"亲爱的"等称呼
       - 不要出现"数据显示"、"根据记录"等冷冰冰的表达
       - 不要空洞的鸡汤，要结合具体日记内容
       - 不要使用emoji
    5. 风格参考：
       "这一周你像坐上了情绪过山车。周一的失落让你怀疑自己，但周三那个意外的好消息成了转折点。你开始发现，原来那些以为过不去的坎，也不过如此。到了周末，虽然还有些疲惫，但你已经能笑着回望这一周的起伏了。"

    返回 JSON 格式：
    {
      "summary": "叙事性总结内容（300-500字，4-5段）"
    }
  `;

  try {
    let jsonString = "{}";

    if (CURRENT_PROVIDER === 'DEEPSEEK') {
      console.log("Using DeepSeek for Weekly Summary...");
      jsonString = await callDeepSeek(
        "你是一位温暖细腻的文字工作者，擅长用故事化的语言串联情绪变化，给人陪伴感和力量。请只返回 JSON。",
        promptText
      );
    } else {
      throw new Error("Gemini provider not configured. Please use DEEPSEEK.");
    }

    const result = JSON.parse(cleanJsonString(jsonString));
    return result.summary || "本周的故事生成中...";
  } catch (error) {
    console.error(`Weekly summary generation failed (${CURRENT_PROVIDER}):`, error);
    throw new Error("生成总结失败");
  }
};

