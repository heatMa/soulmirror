import { DiaryEntry, AIAnalysis } from "../types";
import { MoodOption } from "../constants";

// DeepSeek API 配置
const API_KEY = process.env.API_KEY || "";
const API_BASE_URL = "https://api.deepseek.com/v1";
const MODEL_NAME = "deepseek-chat";

// 通用的 DeepSeek API 调用函数
async function callDeepSeek(
  systemPrompt: string,
  userPrompt: string,
  jsonMode: boolean = true
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: jsonMode ? { type: "json_object" } : undefined,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API 调用失败: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}

export const generateMoodMetadata = async (moodLabel: string): Promise<Partial<MoodOption>> => {
  const systemPrompt = `你是一个心情分析助手，需要根据用户输入的心情标签生成元数据。请始终返回有效的 JSON 格式。`;
  
  const userPrompt = `
    用户输入了一个新的心情标签： "${moodLabel}"。
    请根据这个词的语义，生成以下元数据：
    1. emoji: 一个最能代表这个心情的 emoji 表情。
    2. color: 一个 Tailwind CSS 的背景颜色类名 (bg-xxx-xxx)。
       - 规则：
       - 正面/积极/平静的情绪 (如开心、期待、安稳) -> 使用绿色、青色、蓝绿色系 (如 bg-emerald-500, bg-teal-500, bg-cyan-500)。
       - 负面/消极/激烈的情绪 (如难过、愤怒、焦虑、不舒服) -> 使用紫色、黄色、红色系 (如 bg-violet-500, bg-amber-500, bg-rose-500)。
    3. score: 一个预估的基础评分 (1-10)。
       - 1-4: 负面
       - 5-6: 中性
       - 7-10: 正面

    请返回 JSON 格式: {"emoji": "...", "color": "...", "score": ...}
  `;

  try {
    const responseText = await callDeepSeek(systemPrompt, userPrompt);
    const result = JSON.parse(responseText);
    return {
      emoji: result.emoji || '🏷️',
      color: result.color || 'bg-slate-400',
      score: result.score || 5
    };
  } catch (error) {
    console.error("Failed to generate mood metadata:", error);
    return {
      emoji: '🏷️',
      color: 'bg-slate-400',
      score: 5
    };
  }
};

export const evaluateMoodScore = async (mood: string, content: string): Promise<number> => {
  const systemPrompt = `你是一位细腻的情感分析师，擅长从文字中体会情绪波动。请始终返回有效的 JSON 格式。`;
  
  const userPrompt = `
    请根据用户的日记内容和心情标签，为用户当前的心情打分（1-10分）。
    
    评分标准参考：
    1-2分：崩溃、愤怒、极度消极
    3-4分：难过、焦虑、疲惫
    5-6分：平静、安稳、无波澜
    7-8分：开心、期待、顺利
    9-10分：狂喜、极度兴奋、完美的一天

    请仔细体会文字中的情绪波动。即便是同样的"平静"标签，如果是"享受的平静"可以是6.5分，如果是"压抑的平静"可能是4.5分。
    请返回一个精确的分数（支持一位小数）。

    心情标签: ${mood}
    日记内容: ${content}

    请返回 JSON 格式: {"score": ...}
  `;

  try {
    const responseText = await callDeepSeek(systemPrompt, userPrompt);
    const result = JSON.parse(responseText);
    return result.score || 6;
  } catch (error) {
    console.error("Mood evaluation failed:", error);
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

  const systemPrompt = `你是一位资深的心理咨询师和人生教练，擅长分析情绪模式并给出有建设性的建议。请始终返回有效的 JSON 格式。`;

  const userPrompt = `
    以下是用户最近的一系列心情日记记录：
    ${JSON.stringify(entriesSummary, null, 2)}
    
    请根据这些记录，分析用户的心情"晴雨表"。
    识别出用户心情较好的时间段和突发的情绪低谷。
    给出最真诚、有用的建议，帮助用户更好的调节情绪。

    请返回以下 JSON 格式:
    {
      "summary": "全天/全周心情总评",
      "moodBarometer": {
        "period": "时间段描述",
        "trend": "rising 或 falling 或 stable",
        "explanation": "趋势解释"
      },
      "suggestions": ["建议1", "建议2", ...],
      "peaks": ["心情较好的时刻或事件1", ...],
      "valleys": ["压力较大或心情低落的时刻1", ...]
    }
  `;

  try {
    const responseText = await callDeepSeek(systemPrompt, userPrompt);
    return JSON.parse(responseText) as AIAnalysis;
  } catch (error) {
    console.error("Failed to parse AI response", error);
    throw new Error("AI 分析失败");
  }
};
