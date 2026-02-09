import { DiaryEntry, AIAnalysis } from "../types";
import { MoodOption } from "../constants";

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
const AI_PROXY_URL = import.meta.env.VITE_AI_PROXY_URL || "/api/chat";

// DeepSeek 直连地址 (用于本地开发或 Android 原生应用)
const DEEPSEEK_DIRECT_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || "";

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
      "score": 1-10 的整数评分
    }

    颜色规则:
    - 正面/平静 -> 绿色、青色、蓝绿色系 (bg-emerald-500/#10b981, bg-teal-500/#14b8a6, bg-sky-400/#38bdf8)
    - 负面/激烈 -> 紫色、黄色、红色系 (bg-purple-500/#a855f7, bg-amber-500/#f59e0b, bg-rose-500/#f43f5e)
    - 中性/平淡 -> 灰色、蓝灰色系 (bg-slate-500/#64748b, bg-gray-400/#9ca3af)
    评分规则:
    - 1-4: 负面, 5-6: 中性, 7-10: 正面
  `;

  try {
    let jsonString = "{}";

    if (CURRENT_PROVIDER === 'DEEPSEEK') {
      console.log("Using DeepSeek for Metadata...");
      jsonString = await callDeepSeek(
        "你是一个辅助生成 UI 样式的 JSON 生成器。",
        promptText
      );
    } else {
      // Gemini Implementation - 需要 @google/genai 依赖
      throw new Error("Gemini provider not configured. Please use DEEPSEEK.");
    }

    const result = JSON.parse(cleanJsonString(jsonString));
    return {
      emoji: result.emoji || '🏷️',
      color: result.color || 'bg-slate-400',
      hexColor: result.hexColor || '#94a3b8',
      score: result.score || 5
    };
  } catch (error) {
    console.error(`Failed to generate mood metadata (${CURRENT_PROVIDER}):`, error);
    return {
      emoji: '🏷️',
      color: 'bg-slate-400',
      hexColor: '#94a3b8',
      score: 5
    };
  }
};

export const evaluateMoodScore = async (mood: string, content: string): Promise<number> => {
  const promptText = `
    请根据用户的日记内容和心情标签，为用户当前的心情打分（1-10分）。
    
    心情标签: ${mood}
    日记内容: ${content}

    评分标准参考：
    1-2分：崩溃、愤怒、极度消极
    3-4分：难过、焦虑、疲惫
    5-6分：平静、安稳、无波澜
    7-8分：开心、期待、顺利
    9-10分：狂喜、极度兴奋、完美的一天

    请返回 JSON 格式，格式为: { "score": 6.5 }
    score 必须是数字。
  `;

  try {
    let jsonString = "{}";

    if (CURRENT_PROVIDER === 'DEEPSEEK') {
      console.log("Using DeepSeek for Scoring...");
      jsonString = await callDeepSeek(
        "你是一位细腻的情感分析师。请只返回 JSON。",
        promptText
      );
    } else {
      throw new Error("Gemini provider not configured. Please use DEEPSEEK.");
    }

    const result = JSON.parse(cleanJsonString(jsonString));
    return result.score || 6;
  } catch (error) {
    console.error(`Mood evaluation failed (${CURRENT_PROVIDER}):`, error);
    return 0;
  }
};

export const analyzeMoods = async (entries: DiaryEntry[]): Promise<AIAnalysis> => {
  const entriesSummary = entries.map(e => ({
    time: new Date(e.timestamp).toLocaleString(),
    mood: e.mood,
    score: e.moodScore,
    content: e.content
  }));

  const promptText = `
    以下是用户最近的一系列心情日记记录：
    ${JSON.stringify(entriesSummary, null, 2)}

    请分析用户的心情"晴雨表"。
    识别出用户心情较好的时间段和突发的情绪低谷。
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
  moodScore: number
): Promise<string[]> => {
  const promptText = `
    用户刚刚写了一篇负面情绪的心情日记：

    心情标签: ${mood}
    情绪评分: ${moodScore}分（满分10分）
    日记内容: ${content}

    请根据用户的具体情绪和日记内容，给出2-3条针对性的行动建议。

    要求：
    1. 每条建议15-30个字，具体可执行
    2. 首先识别情绪来源类型，然后给出对应建议：
       - 工作压力/任务受挫 → 拆解任务、降低标准、先完成最核心的部分
       - 人际冲突/沟通问题 → 冷静后主动沟通、换位思考、写下想说的话
       - 拖延/自责 → 从最小的一步开始、设置5分钟计时器、允许不完美
       - 孤独/低落 → 联系一个朋友、做一件小事取悦自己、出门走走
       - 焦虑/担忧未来 → 写下具体担忧、聚焦今天能做的一件事、设定边界
    3. 避免泛泛的建议如"深呼吸"、"散散步"、"休息一下"、"放松心情"
    4. 建议要与日记内容相关，而不是通用建议
    5. 语气直接但温和，像朋友给的实用建议

    返回 JSON 格式: { "suggestions": ["建议1", "建议2", "建议3"] }
  `;

  try {
    let jsonString = "{}";

    if (CURRENT_PROVIDER === 'DEEPSEEK') {
      console.log("Using DeepSeek for Regulation Suggestions...");
      jsonString = await callDeepSeek(
        "你是一位实用主义的心理咨询师，擅长给出具体可行的下一步行动，而不是空洞的安慰。请只返回 JSON。",
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
export const generateAiReply = async (mood: string, content: string): Promise<string> => {
  const promptText = `
    用户刚刚写了一篇心情日记：

    心情标签: ${mood}
    日记内容: ${content}

    请用一句温暖、真诚的话回应用户。要求：
    1. 简短有力，不超过30个字
    2. 表达共情和理解，不要说教
    3. 根据情绪调整语气：
       - 开心时：一起分享喜悦
       - 难过时：温柔陪伴，给予力量
       - 平静时：肯定当下的状态
    4. 可以适当使用 emoji，但不要超过1个
    5. 不要用"亲"、"宝"等过于亲昵的称呼

    返回 JSON 格式: { "reply": "你的回复" }
  `;

  try {
    let jsonString = "{}";

    if (CURRENT_PROVIDER === 'DEEPSEEK') {
      console.log("Using DeepSeek for AI Reply...");
      jsonString = await callDeepSeek(
        "你是一位温暖细腻的倾听者，善于用简短的话给人力量。请只返回 JSON。",
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

// 生成 AI 情绪周报
export const generateWeeklyReport = async (entries: DiaryEntry[]): Promise<WeeklyReport> => {
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
    if (entry.moodScore <= 5) {
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
    2. 负面情绪（评分≤5）在哪些时间段更容易出现？
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

  try {
    let jsonString = "{}";

    if (CURRENT_PROVIDER === 'DEEPSEEK') {
      console.log("Using DeepSeek for Weekly Report...");
      jsonString = await callDeepSeek(
        "你是一位专业的心理数据分析师，擅长从情绪数据中发现规律并给出建设性建议。请只返回 JSON。",
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
