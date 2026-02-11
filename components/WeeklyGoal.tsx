import React, { useState, useMemo, useEffect } from 'react';
import { DiaryEntry } from '../types';
import { getWeeklyEnergyData, getTodayFinalEnergy, DAILY_STARTING_ENERGY } from '../utils/energyUtils';

interface Props {
  entries: DiaryEntry[];  // 所有条目
}

interface WeeklyGoalData {
  targetEnergy: number;  // 目标平均电量
  enabled: boolean;      // 是否启用目标
}

const STORAGE_KEY = 'soulmirror_weekly_goal';

const WeeklyGoal: React.FC<Props> = ({ entries }) => {
  const [goalData, setGoalData] = useState<WeeklyGoalData>({
    targetEnergy: 70,
    enabled: true
  });
  const [isEditing, setIsEditing] = useState(false);
  const [tempTarget, setTempTarget] = useState(70);

  // 加载目标设置
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setGoalData(parsed);
        setTempTarget(parsed.targetScore);
      } catch (e) {
        console.error('Failed to load weekly goal:', e);
      }
    }
  }, []);

  // 保存目标设置
  const saveGoal = (newGoal: WeeklyGoalData) => {
    setGoalData(newGoal);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newGoal));
  };

  // 计算本周数据
  const weekStats = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    // 获取本周一
    const day = weekStart.getDay();
    const diff = day === 0 ? 6 : day - 1;  // 周日为0，需要回退6天
    weekStart.setDate(weekStart.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);

    // 筛选本周条目
    const weekEntries = entries.filter(e => e.timestamp >= weekStart.getTime());

    // 获取过去一周每天的电量数据
    const weeklyData = getWeeklyEnergyData(weekEntries);
    const daysWithData = weeklyData.filter(d => d.hasData);

    // 计算平均电量
    const avgEnergy = daysWithData.length > 0
      ? daysWithData.reduce((sum, d) => sum + d.energy, 0) / daysWithData.length
      : DAILY_STARTING_ENERGY;

    // 今日电量
    const today = new Date();
    const todayEntries = entries.filter(e => {
      const eDate = new Date(e.timestamp);
      return eDate.getDate() === today.getDate() &&
             eDate.getMonth() === today.getMonth() &&
             eDate.getFullYear() === today.getFullYear();
    });
    const todayEnergy = todayEntries.length > 0 ? getTodayFinalEnergy(todayEntries) : DAILY_STARTING_ENERGY;

    // 计算本周已过天数（包括今天）
    const daysPassed = diff + 1;

    return {
      totalEntries: weekEntries.length,
      daysRecorded: daysWithData.length,
      daysPassed,
      avgEnergy,
      todayEnergy,
      hasData: daysWithData.length > 0
    };
  }, [entries]);

  // 计算进度百分比
  const progress = useMemo(() => {
    if (!weekStats.hasData) return 0;
    const ratio = weekStats.avgEnergy / goalData.targetEnergy;
    return Math.min(100, Math.round(ratio * 100));
  }, [weekStats, goalData.targetEnergy]);

  // 是否达成目标
  const isGoalMet = weekStats.avgEnergy >= goalData.targetEnergy && weekStats.hasData;

  // 处理保存
  const handleSave = () => {
    saveGoal({ ...goalData, targetEnergy: tempTarget });
    setIsEditing(false);
  };

  // 切换启用状态
  const toggleEnabled = () => {
    saveGoal({ ...goalData, enabled: !goalData.enabled });
  };

  if (!goalData.enabled) {
    return (
      <button
        onClick={toggleEnabled}
        className="w-full text-center py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        + 设置本周目标
      </button>
    );
  }

  return (
    <div className="w-full glass-card rounded-[1.5rem] p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">🎯</span>
          <span className="text-sm font-bold text-gray-700">本周目标</span>
        </div>

        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={tempTarget}
              onChange={(e) => setTempTarget(Math.max(0, Math.min(150, Number(e.target.value))))}
              className="w-12 px-2 py-1 text-xs text-center border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
              min="0"
              max="150"
              step="5"
            />
            <span className="text-xs text-gray-400">分</span>
            <button
              onClick={handleSave}
              className="px-2 py-1 text-xs bg-gray-800 text-white rounded-lg"
            >
              保存
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
            >
              取消
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              目标电量: {goalData.targetEnergy}分
            </span>
            <button
              onClick={() => {
                setTempTarget(goalData.targetEnergy);
                setIsEditing(true);
              }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              编辑
            </button>
            <button
              onClick={toggleEnabled}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              隐藏
            </button>
          </div>
        )}
      </div>

      {/* 进度条 */}
      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isGoalMet ? 'bg-green-500' : 'bg-amber-400'
          }`}
          style={{ width: `${progress}%` }}
        />
        {/* 目标线 */}
        <div
          className="absolute top-0 h-full w-0.5 bg-gray-400"
          style={{ left: '100%', transform: 'translateX(-1px)' }}
        />
      </div>

      {/* 状态文字 */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          {weekStats.hasData ? (
            <>
              <span className={`font-bold ${isGoalMet ? 'text-green-600' : 'text-amber-600'}`}>
                平均: {weekStats.avgEnergy.toFixed(0)}
              </span>
              <span className="text-gray-400">/ {goalData.targetEnergy} 分</span>
            </>
          ) : (
            <span className="text-gray-400">暂无电量数据</span>
          )}
        </div>
        <div className="text-gray-400">
          今日: {Math.round(weekStats.todayEnergy)} | 已记录 {weekStats.daysRecorded}/{weekStats.daysPassed} 天
        </div>
      </div>

      {/* 达成提示 */}
      {isGoalMet && (
        <div className="mt-2 text-center text-xs text-green-600 font-medium">
          🎉 本周目标已达成！继续保持~
        </div>
      )}
    </div>
  );
};

export default WeeklyGoal;
