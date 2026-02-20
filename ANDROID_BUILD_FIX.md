# Android APK 未更新排查指南

## 问题：APK 编译后时间未变化

---

## 快速解决方案

### 步骤 1：强制清理并重新同步

```bash
# 在项目根目录执行
npm run build
npx cap sync android --force
```

### 步骤 2：在 Android Studio 中执行

1. **Build → Clean Project**
   - 清理旧编译文件

2. **Build → Rebuild Project** 
   - 重新编译整个项目

3. **File → Invalidate Caches → Invalidate and Restart**
   - 清除 Android Studio 缓存并重启

### 步骤 3：验证资源已更新

在 Android Studio 中检查：
```
android/app/src/main/assets/public/index.html
```
右键 → **Open In** → **Explorer/Finder**，查看修改时间是否最新。

### 步骤 4：重新构建 APK

**Build → Build Bundle(s) / APK(s) → Build APK(s)**

构建完成后，APK 位置：
```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 常见问题排查

### 问题 1：Android Studio 使用了缓存
**症状**：代码已改，但 APK 行为不变
**解决**：
- Build → Clean Project
- File → Invalidate Caches → Invalidate and Restart

### 问题 2：assets 目录未正确同步
**检查命令**：
```powershell
# 检查 web 资源时间
Get-ChildItem dist/index.html | Select-Object LastWriteTime

# 检查 Android assets 时间  
Get-ChildItem android/app/src/main/assets/public/index.html | Select-Object LastWriteTime
```

**如果时间不一致**：
```bash
# 手动复制（备用方案）
copy dist\* android\app\src\main\assets\public\ /Y
```

### 问题 3：使用了旧的构建变体
**检查**：Build → Select Build Variant
- 确保选择的是 `debug` 而不是其他

### 问题 4：Gradle 缓存
**解决**：
```bash
cd android
.\gradlew clean
.\gradlew build
```

---

## 完整重建流程（终极方案）

```bash
# 1. 清理所有
npm run build
cd android
.\gradlew clean
cd ..

# 2. 删除旧资源
Remove-Item -Recurse -Force android\app\src\main\assets\public\*

# 3. 重新同步
npx cap sync android

# 4. Android Studio 中
# Build → Rebuild Project
# Build → Build APK
```

---

## 验证 APK 已更新

安装 APK 后，检查以下特征：
1. 打开 App 不再显示「数据加载失败」
2. 时间线页面顶部有周报卡片
3. 周报可点击查看详情

---

## 预防措施

每次修改后执行：
```bash
npm run build
npx cap sync android
# 然后 File → Sync Project with Gradle Files
```

在 Android Studio 中，看到 **Sync Now** 提示时立即点击同步。
