import { DiaryEntry, AIAnalysis } from "../types";
import { MoodOption } from "../constants";

// ==========================================
// ⚙️ AI 设置开关 (一键切换)
// ==========================================

// 选项: 'GEMINI' | 'DEEPSEEK'
// 部署安卓时，如果 Gemini 不可用，请改为 'DEEPSEEK'
const CURRENT_PROVIDER: 'GEMINI' | 'DEEPSEEK' = 'DEEPSEEK'; 

// ==========================================
// 🔑 API Keys 配置
// ==========================================

// Google Gemini API Key
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";

// DeepSeek API Key (已填入你提供的 Key)
const DEEPSEEK_API_KEY = "sk-cbbf0f33f1ea4a619570199acc64fe3d";

// ==========================================
// 🐳 DeepSeek 帮助函数
// ==========================================
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

async function callDeepSeek(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!DEEPSEEK_API_KEY) throw new Error("DeepSeek API Key 未配置");

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }, // 强制 JSON 模式
        temperature: 1.3 // DeepSeek 建议稍微高一点的温度以获得更有创意的结果
      })
    });

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
      "score": 1-10 的整数评分
    }

    颜色规则:
    - 正面/平静 -> 绿色、青色、蓝绿色系
    - 负面/激烈 -> 紫色、黄色、红色系
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
      score: result.score || 5
    };
  } catch (error) {
    console.error(`Failed to generate mood metadata (${CURRENT_PROVIDER}):`, error);
    return {
      emoji: '🏷️',
      color: 'bg-slate-400',
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

    请根据用户的具体情绪和内容，给出2-3条简短、具体、可立即执行的情绪调节建议。

    要求：
    1. 每条建议10-20个字，简洁有力
    2. 建议要针对性强，根据具体情绪类型给出不同建议：
       - 焦虑/压力大 → 放松技巧（深呼吸、肌肉放松等）
       - 难过/低落 → 自我关怀（休息、与人倾诉等）
       - 愤怒/烦躁 → 冷静技巧（暂时离开、运动等）
       - 疲惫/无力 → 恢复能量（小憩、补充能量等）
    3. 包含一条即时可做的事（如深呼吸、喝杯水）
    4. 包含一条稍后安排的事（如早睡、散步、倾诉）
    5. 语气温和鼓励，不要说教

    返回 JSON 格式: { "suggestions": ["建议1", "建议2", "建议3"] }
  `;

  try {
    let jsonString = "{}";

    if (CURRENT_PROVIDER === 'DEEPSEEK') {
      console.log("Using DeepSeek for Regulation Suggestions...");
      jsonString = await callDeepSeek(
        "你是一位温柔的心理咨询师，擅长给出简短实用的情绪调节建议。请只返回 JSON。",
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
