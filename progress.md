# 美好时光 开发进展与经验教训记录

> 记录项目开发过程中的重要决策、技术选择和踩坑经验，供后续开发参考。

---

## 2025-02-19 周报系统开发

### 新增功能
- ✅ 周报系统 MVP 版本（Weekly Report System）
- ✅ 纳瓦尔风格 AI 教练观察
- ✅ 实验挑战与追踪闭环
- ✅ Android 本地通知支持

### 技术实现

#### 1. 周报数据结构 (`types.ts`)
```typescript
interface WeeklyReport {
  weekKey: string;           // '2025-W08'
  content: {
    snapshot: {...}          // 数据摘要
    observation: {...}       // 教练观察
    experiment: {...}        // 可执行实验
    recommendation: {...}    // 书籍推荐
    chartData: {...}         // 可视化数据
  };
  tracking?: {...}          // 追踪状态
}
```

#### 2. 书库推荐系统 (`constants.tsx`)
- 预置 12 本经典书籍
- 关键词匹配算法
- 主导情绪默认推荐

#### 3. Android 通知集成
- `@capacitor/local-notifications` 插件
- AndroidManifest.xml 权限配置
- 每周一/实验日定时提醒

### 踩坑记录

## 周报生成方案实现

### 方案一：周日晚上8点生成（已实现）

**触发时机**：
- 周日 20:00 之前：不生成周报，显示预览卡片
- 周日 20:00 之后：打开 App 时自动生成本周周报

**用户体验流程**：
| 时间 | 界面显示 | 说明 |
|------|---------|------|
| 周一~周日20:00前 | 周报预览卡片 | 显示当前记录数，提示还差几条 |
| 周日20:00后 | 周报卡片 | 自动生成的完整周报 |

**实现细节**：
- `isWeeklyReportGenerationTime()` - 检查当前是否周日20:00后
- `getWeeklyReportStatus()` - 获取周报状态（记录数、是否到时间等）
- 通知改为周日20:00提醒
- 预览卡片 `WeeklyReportPreview` 实时显示进度

**优点**：
- 周报包含整周完整数据
- 避免多次调用 AI API
- 用户有预期（倒计时显示）

---

### 手动重新生成功能（已实现）

**需求**：
- 用户可以随时重新生成周报
- 无次数限制
- 需要确认步骤
- 显示生成时间戳

**界面设计**：
```
┌───────────────────────────────────┐
│ 第08周报        [↻]               │  ← 右上角刷新按钮
│ 02-16 ~ 02-22 · 今天 15:30生成    │  ← 时间戳
│ "你在用缺席记录存在"               │
└───────────────────────────────────┘
```

**确认弹窗**：
- 标题："重新生成周报？"
- 内容："将基于本周X条记录重新生成周报，当前周报内容将被覆盖。"
- 按钮：[取消] [确认生成]

**实现细节**：
- `regenerateWeeklyReport()` - 删除旧周报并重新生成
- `deleteWeeklyReport()` - 数据库删除函数
- 时间戳格式化：刚刚生成 / X小时前 / 昨天 / 具体日期
- Loading 状态：刷新按钮旋转动画

**使用场景**：
- 新增记录后想看到最新分析
- 对当前周报不满意想重试
- 测试不同AI建议

---

### 跨平台兼容性检查清单

**每次修改后必须验证:**

```bash
# 1. Web 构建
npm run build

# 2. Android 同步
npx cap sync android

# 3. Android Studio 构建 APK
# Build → Build Bundle(s) / APK(s) → Build APK(s)
```

| 检查项 | Web | Android | 验证方式 |
|--------|-----|---------|----------|
| 构建通过 | ✅ `npm run build` | ✅ Android Studio | 必需 |
| 数据存储 | localStorage | SQLite | `databaseService` 自动降级 |
| 通知功能 | 静默跳过 | 本地推送 | `isNative` 检查 |
| API 调用 | 直连/代理 | 同 Web | 统一接口 |
| 文件操作 | - | Capacitor Filesystem | 权限声明 |

**平台特定注意事项:**

| 平台 | 注意点 |
|------|--------|
| Web | localStorage 5MB 限制、无通知权限 |
| Android | AndroidManifest.xml 权限、receiver 必须在 application 内、SQLite 迁移 |

---

#### ❌ 问题 0: import 语句位置错误导致模块崩溃
**错误表现:**
- Android 打开 App 显示「数据加载失败，请刷新页面重试」
- Web 可能正常（取决于打包顺序）

**错误信息:**
```
// 数据库初始化失败，整个 App 无法启动
```

**原因:** `import` 语句放在了文件末尾，导致 JavaScript 模块解析错误

**错误代码:**
```typescript
// ❌ 错误 - import 在文件末尾
class DatabaseService { ... }

// 文件末尾的 import
import { WeeklyReport } from '../types';
```

**正确代码:**
```typescript
// ✅ 正确 - import 必须在文件顶部
import { WeeklyReport } from '../types';

class DatabaseService { ... }
```

**教训:**
- **ES6 import 必须放在文件最顶部**
- 动态扩展类方法时，类型导入要在文件开头
- 这种错误 Web 构建可能不报错，但 Android 会崩溃
- 添加新类型时，先检查是否在顶部 import

---

#### ❌ 问题 1: AndroidManifest.xml receiver 位置错误
**错误信息:**
```
AAPT: error: unexpected element <receiver> found in <manifest>
```

**原因:** `<receiver>` 元素放在了 `<manifest>` 下，但应该放在 `<application>` 内

**错误代码:**
```xml
<!-- ❌ 错误 -->
</application>
<receiver android:name="..." />  <!-- 在 application 外面 -->
```

**正确代码:**
```xml
<!-- ✅ 正确 -->
<application>
    ...
    <receiver android:name="..." />  <!-- 在 application 内部 -->
</application>
```

**教训:**
- `<receiver>`、`<service>`、`<provider>` 都必须放在 `<application>` 标签内
- 只有 `<uses-permission>` 等声明性标签放在 `<manifest>` 下
- **重要**: Capacitor sync 不会检查 AndroidManifest.xml 语法错误，必须在 Android Studio 中构建 APK 才能发现

---

#### ❌ 问题 2: 中文引号导致构建失败
**错误信息:**
```
ERROR: Expected "}" but found "必须做"
```

**原因:** 模板字符串中使用了中文单引号 `'必须做'`，与 JavaScript 字符串定界符冲突

**代码位置:** `services/reportService.ts:369`
```javascript
// ❌ 错误
instruction: '每次记录时，加一个标签：这是'必须做'还是'选择做''

// ✅ 正确
instruction: '每次记录时，加一个标签：这是「必须做」还是「选择做」'
```

**教训:** 
- 中文内容中避免使用 `'` 或 `"` 作为引号
- 使用直角引号 `「」` 或全角引号 `''` `""`
- 构建前检查包含中文的模板字符串

---

#### ❌ 问题 2: DatabaseService 原型扩展类型声明
**问题:** 在 `databaseService.ts` 末尾动态添加周报方法时，TypeScript 类型不识别

**解决方案:**
```typescript
// 使用 declare module 扩展接口
declare module './databaseService' {
  interface DatabaseService {
    saveWeeklyReport(report: WeeklyReport): Promise<void>;
    // ...
  }
}

// 原型扩展
DatabaseService.prototype.saveWeeklyReport = async function(...) {...}
```

**教训:**
- 单例类的方法扩展需要使用 `declare module`
- 确保扩展的接口与实际实现一致

---

#### ❌ 问题 3: Capacitor 后台任务插件不存在
**问题:** 试图安装 `@capacitor/background-task` 但 npm 404

**原因:** Capacitor 官方没有 `background-task` 插件，本地通知自带 schedule 功能

**解决方案:**
```typescript
// 使用 LocalNotifications.schedule 代替
await LocalNotifications.schedule({
  notifications: [{
    schedule: { at: nextMonday, repeats: true, every: 'week' }
  }]
});
```

**教训:**
- 先查官方文档再安装插件
- Capacitor 本地通知已支持定时和重复

---

### 设计决策记录

#### 决策 1: 周报生成时机
**选项 A:** 周一凌晨后台自动生成（需后台任务）  
**选项 B:** 用户打开 App 时检查生成

**选择:** B

**理由:**
- Capacitor 后台任务能力有限
- 本地通知可以提前提醒用户
- 简化实现，避免电池消耗争议

---

#### 决策 2: AI 失败降级策略
**选项 A:** 显示错误，让用户重试  
**选项 B:** 自动使用本地模板生成

**选择:** B

**理由:**
- 用户体验优先，不因 API 问题阻断功能
- 模板内容足够应对基础场景
- 无网络时仍可正常使用

---

#### 决策 3: 实验完成检测自动化程度
**选项 A:** 全自动（AI 分析下周数据判断）  
**选项 B:** 半自动（AI 提示，用户确认）  
**选项 C:** 手动（用户自己标记）

**选择:** C（MVP），计划升级到 B

**理由:**
- 全自动容易误判（用户可能只是忘记记录）
- 手动方式简单可靠
- 后续可通过数据分析建议用户

---

### 代码规范更新

#### 字符串引号规范
```typescript
// ✅ 推荐：中文使用直角引号
const text = '这是「正确」的引号用法';

// ❌ 避免：中文使用 ASCII 引号
const text = '这是'错误'的引号用法';

// ✅ 备选：全角引号
const text = '这是"正确"的引号用法';
```

#### 类扩展规范
```typescript
// 1. 声明扩展接口
declare module './service' {
  interface Service {
    newMethod(): Promise<void>;
  }
}

// 2. 实现扩展
Service.prototype.newMethod = async function() {...}
```

---

## 待办事项

### 周报系统后续优化
- [ ] 历史周报列表页面
- [ ] 实验完成自动检测（AI 分析）
- [ ] 周报分享功能（生成图片）
- [ ] 多导师人格切换（芒格/孔子/混合）
- [ ] 年报生成功能

### 技术债务
- [ ] 考虑使用动态导入减少 bundle 体积（当前 830KB+）
- [ ] 周报详情页考虑虚拟滚动优化长列表

---

## 参考资源

### Capacitor 插件
- [Local Notifications](https://capacitorjs.com/docs/apis/local-notifications)
- [SQLite Community Plugin](https://github.com/capacitor-community/sqlite)

### AI Prompt 设计
- 系统提示词位置: `constants.tsx` -> `MENTOR_CONFIG.systemPrompt`
- 温度设置: 结构化输出 0.8，创造性文本 1.0

### 通知配置
- 周报通知 ID: 1（每周一 8:00）
- 实验提醒 ID: 2（周三 9:00）

---

## 2025-02-22 腾讯云部署迁移

### 部署平台变更

**从 Cloudflare Pages 迁移到腾讯云云开发 (CloudBase)**

#### 变更原因
- 国内访问速度更快
- 与微信生态更好的集成能力
- 免费额度充足

#### 部署配置
```bash
# 腾讯云 CLI 命令
cloudbase hosting:deploy dist -e soulmirror-3gen9oau21b35f0d

# 环境信息
- 环境名称: soulmirror
- 环境 ID: soulmirror-3gen9oau21b35f0d
- 访问域名: https://soulmirror-3gen9oau21b35f0d-1403375226.tcloudbaseapp.com
```

#### 文档更新
- ✅ CLAUDE.md 部署章节更新，腾讯云为主要部署方式
- ✅ progress.md 添加部署迁移记录

---

*最后更新: 2025-02-22*
