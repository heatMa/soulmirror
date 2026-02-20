import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

// ==========================================
// 本地通知服务（周报提醒）
// ==========================================

const isNative = Capacitor.isNativePlatform();

/**
 * 请求通知权限
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNative) return true; // Web 端直接返回 true
  
  try {
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  } catch (error) {
    console.error('请求通知权限失败:', error);
    return false;
  }
}

/**
 * 检查通知权限状态
 */
export async function checkNotificationPermission(): Promise<boolean> {
  if (!isNative) return true;
  
  try {
    const result = await LocalNotifications.checkPermissions();
    return result.display === 'granted';
  } catch (error) {
    console.error('检查通知权限失败:', error);
    return false;
  }
}

/**
 * 设置周报通知（每周日晚上 8:00）
 * 提醒用户查看本周周报
 */
export async function scheduleWeeklyReportNotification(): Promise<void> {
  if (!isNative) return;
  
  const hasPermission = await checkNotificationPermission();
  if (!hasPermission) {
    console.log('没有通知权限，跳过设置周报通知');
    return;
  }
  
  try {
    // 先取消之前的周报通知
    await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
    
    // 计算下周日晚上 8:00 的时间
    const now = new Date();
    const nextSunday = new Date(now);
    // 0=周日, 1=周一... 所以下周日 = (0 + 7 - today) % 7，但今天周日且已过20:00则下周日
    const daysUntilSunday = (0 + 7 - now.getDay()) % 7;
    nextSunday.setDate(now.getDate() + (daysUntilSunday === 0 && now.getHours() >= 20 ? 7 : daysUntilSunday));
    nextSunday.setHours(20, 0, 0, 0);
    
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 1,
          title: '📊 本周情绪周报已生成',
          body: '纳瓦尔给你准备了一周观察和一个实验挑战，点击查看',
          schedule: {
            at: nextSunday,
            repeats: true,
            every: 'week'
          },
          extra: {
            type: 'weekly_report'
          },
          iconColor: '#10b981',
          sound: 'default'
        }
      ]
    });
    
    console.log('周报通知已设置:', nextSunday.toLocaleString());
  } catch (error) {
    console.error('设置周报通知失败:', error);
  }
}

/**
 * 设置实验提醒通知
 */
export async function scheduleExperimentReminder(experimentTitle: string, dayOfWeek: number = 3): Promise<void> {
  if (!isNative) return;
  
  const hasPermission = await checkNotificationPermission();
  if (!hasPermission) return;
  
  try {
    // dayOfWeek: 0=周日, 1=周一, ..., 6=周六
    // 默认周三(3)提醒
    const now = new Date();
    const targetDay = new Date(now);
    const daysUntilTarget = (dayOfWeek + 7 - now.getDay()) % 7 || 7;
    targetDay.setDate(now.getDate() + daysUntilTarget);
    targetDay.setHours(9, 0, 0, 0); // 早上 9:00
    
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 2,
          title: '🔬 实验日提醒',
          body: `今天是「${experimentTitle}」实验日，记得执行并记录效果`,
          schedule: {
            at: targetDay
          },
          actionTypeId: 'experiment_reminder',
          extra: {
            type: 'experiment_reminder'
          },
          iconColor: '#8b5cf6'
        }
      ]
    });
    
    console.log('实验提醒已设置:', targetDay.toLocaleString());
  } catch (error) {
    console.error('设置实验提醒失败:', error);
  }
}

/**
 * 取消所有通知
 */
export async function cancelAllNotifications(): Promise<void> {
  if (!isNative) return;
  
  try {
    await LocalNotifications.cancel({ notifications: [{ id: 1 }, { id: 2 }] });
    console.log('所有通知已取消');
  } catch (error) {
    console.error('取消通知失败:', error);
  }
}

/**
 * 获取待发送的通知列表
 */
export async function getPendingNotifications(): Promise<any[]> {
  if (!isNative) return [];
  
  try {
    const result = await LocalNotifications.getPending();
    return result.notifications;
  } catch (error) {
    console.error('获取待发送通知失败:', error);
    return [];
  }
}

/**
 * 初始化通知系统（App 启动时调用）
 */
export async function initializeNotifications(): Promise<void> {
  if (!isNative) return;
  
  try {
    // 请求权限并设置周报通知
    const hasPermission = await requestNotificationPermission();
    if (hasPermission) {
      await scheduleWeeklyReportNotification();
    }
    
    // 监听通知点击（可选，失败不影响主功能）
    try {
      LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
        console.log('通知被点击:', notification);
      });
    } catch (e) {
      console.log('通知点击监听未启用');
    }
    
  } catch (error) {
    console.error('初始化通知系统失败:', error);
    // 通知失败不影响主功能
  }
}
