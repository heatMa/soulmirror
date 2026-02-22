# 美好时光 微信小程序

美好时光 - AI 情绪日记小程序

## 项目结构

```
soulmirror-weapp/
├── app.js / app.json / app.wxss    # 小程序入口
├── project.config.json              # 项目配置
├── sitemap.json                     # 站点地图
├── pages/
│   ├── timeline/        # 首页时间线
│   ├── analysis/        # AI 分析页
│   ├── diary-form/      # 日记编辑页
│   └── settings/        # 设置页
├── components/
│   ├── calendar-strip/  # 日期选择器
│   ├── mood-chart/      # 情绪图表
│   ├── timeline-item/   # 日记卡片
│   ├── mood-picker/     # 心情选择器
│   ├── rich-editor/     # 富文本编辑器
│   └── glass-card/      # 毛玻璃卡片
├── services/
│   ├── database.js      # 数据存储服务
│   ├── ai.js            # AI 服务调用
│   └── utils.js         # 工具函数
├── constants/
│   └── moods.js         # 心情选项配置
├── assets/
│   └── icons/           # tabBar 图标
└── cloudfunctions/
    └── callDeepSeek/    # AI API 云函数
```

## 开发准备

### 1. 微信开发者工具

下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)

### 2. 创建小程序

1. 在 [微信公众平台](https://mp.weixin.qq.com/) 注册小程序账号
2. 获取 AppID
3. 修改 `project.config.json` 中的 `appid` 字段

### 3. 开通云开发

1. 在微信开发者工具中打开项目
2. 点击「云开发」按钮
3. 创建云开发环境
4. 修改 `app.js` 中的 `env` 为你的环境 ID

### 4. 创建数据库集合

在云开发控制台创建以下集合：

- `diary_entries` - 日记条目
- `custom_moods` - 自定义心情

### 5. 部署云函数

1. 右键点击 `cloudfunctions/callDeepSeek`
2. 选择「上传并部署：云端安装依赖」
3. 在云开发控制台 → 云函数 → callDeepSeek → 设置
4. 添加环境变量 `DEEPSEEK_API_KEY`，填入你的 DeepSeek API Key

### 6. 添加 tabBar 图标

在 `assets/icons/` 目录下添加以下图标文件（81x81 像素）：

- `diary.png` - 日记图标（未选中）
- `diary-active.png` - 日记图标（选中）
- `insight.png` - 洞察图标（未选中）
- `insight-active.png` - 洞察图标（选中）

## 功能特性

### 核心功能

- 📝 **心情日记** - 记录每天的心情和想法
- 🎨 **心情选择** - 7 种预设心情 + 自定义心情
- 🏷️ **标签系统** - 快捷标签 + 自定义标签
- 📊 **情绪图表** - 可视化情绪趋势
- 🤖 **AI 分析** - 智能情绪评分、暖心回复、调节建议

### 数据管理

- ☁️ **云同步** - 多设备数据自动同步
- 📤 **导出备份** - 一键导出 JSON 数据
- 📥 **导入恢复** - 从备份恢复数据

## 技术栈

- 小程序原生框架 (WXML/WXSS/JS)
- 微信云开发 (数据库 + 云函数)
- DeepSeek API (AI 能力)
- Canvas 2D (图表绘制)

## AI 功能

所有 AI 功能通过云函数调用 DeepSeek API：

1. **情绪评分** - 根据日记内容智能评分 (1-10)
2. **暖心回复** - 温暖的 AI 回应
3. **调节建议** - 负面情绪时提供调节建议
4. **趋势分析** - 分析一段时间的情绪走向
5. **心情元数据** - 为自定义心情生成 emoji 和颜色

## 注意事项

1. **基础库版本** - 建议设置最低 2.10.0（支持 editor 组件）
2. **云开发配额** - 注意监控免费额度使用情况
3. **API Key 安全** - DeepSeek API Key 仅存储在云函数环境变量中

## License

MIT
