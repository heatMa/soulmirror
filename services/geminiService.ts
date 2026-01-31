
import { GoogleGenAI, Type } from "@google/genai";
import { DiaryEntry, AIAnalysis } from "../types";
import { MoodOption } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

const MODEL_NAME = "gemini-3-flash-preview";

export const generateMoodMetadata = async (moodLabel: string): Promise<Partial<MoodOption>> => {
  const prompt = `
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

    请直接返回 JSON。
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            emoji: { type: Type.STRING },
            color: { type: Type.STRING },
            score: { type: Type.NUMBER }
          },
          required: ["emoji", "color", "score"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
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
  const prompt = `
    作为一位细腻的情感分析师，请根据用户的日记内容和心情标签，为用户当前的心情打分（1-10分）。
    
    评分标准参考：
    1-2分：崩溃、愤怒、极度消极
    3-4分：难过、焦虑、疲惫
    5-6分：平静、安稳、无波澜
    7-8分：开心、期待、顺利
    9-10分：狂喜、极度兴奋、完美的一天

    请仔细体会文字中的情绪波动。即便是同样的“平静”标签，如果是“享受的平静”可以是6.5分，如果是“压抑的平静”可能是4.5分。
    请返回一个精确的分数（支持一位小数）。

    心情标签: ${mood}
    日记内容: ${content}
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER, description: "情绪评分，1.0-10.0" }
          },
          required: ["score"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return result.score || 6; // Default to 6 if parsing fails
  } catch (error) {
    console.error("Mood evaluation failed:", error);
    return 0; // Return 0 to indicate failure, allowing fallback to preset
  }
};

export const analyzeMoods = async (entries: DiaryEntry[]): Promise<AIAnalysis> => {
  const entriesSummary = entries.map(e => ({
    time: new Date(e.timestamp).toLocaleString(),
    mood: e.mood,
    score: e.moodScore,
    content: e.content
  }));

  const prompt = `
    你是一位资深的心理咨询师和人生教练。
    以下是用户最近的一系列心情日记记录：
    ${JSON.stringify(entriesSummary, null, 2)}
    
    请根据这些记录，分析用户的心情“晴雨表”。
    识别出用户心情较好的时间段和突发的情绪低谷。
    给出最真诚、有用的建议，帮助用户更好的调节情绪。
    请以 JSON 格式返回。
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: "全天/全周心情总评" },
          moodBarometer: {
            type: Type.OBJECT,
            properties: {
              period: { type: Type.STRING },
              trend: { type: Type.STRING, enum: ["rising", "falling", "stable"] },
              explanation: { type: Type.STRING }
            }
          },
          suggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          peaks: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "心情较好的时刻或事件"
          },
          valleys: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "压力较大或心情低落的时刻"
          }
        },
        required: ["summary", "moodBarometer", "suggestions", "peaks", "valleys"]
      }
    }
  });

  try {
    const text = response.text;
    return JSON.parse(text) as AIAnalysis;
  } catch (error) {
    console.error("Failed to parse AI response", error);
    throw new Error("AI 分析失败");
  }
};
