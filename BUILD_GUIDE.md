# 美好时光 完整编译指南

## 📋 编译前准备

确保已安装：
- Node.js 18+
- Android Studio
- Android SDK

---

## 🌐 Web 版本编译

```bash
# 1. 安装依赖
npm install

# 2. 开发模式
npm run dev

# 3. 生产构建
npm run build

# 4. 预览生产构建
npm run preview
```

---

## 📱 Android 版本完整编译流程

### 方式一：自动脚本（推荐）

**Windows (PowerShell):**
```powershell
# 完整构建脚本
npm run build; 
if ($?) { 
    npx cap sync android; 
    if ($?) {
        Write-Host "✅ Web构建和同步完成" -ForegroundColor Green
        Write-Host ""
        Write-Host "下一步：在 Android Studio 中执行：" -ForegroundColor Yellow
        Write-Host "1. Build -> Clean Project" -ForegroundColor Cyan
        Write-Host "2. Build -> Rebuild Project" -ForegroundColor Cyan
        Write-Host "3. Build -> Build Bundle(s) / APK(s) -> Build APK(s)" -ForegroundColor Cyan
    }
}
```

**Mac/Linux:**
```bash
# 完整构建脚本
npm run build && \
npx cap sync android && \
echo "✅ Web构建和同步完成" && \
echo "" && \
echo "下一步：在 Android Studio 中执行：" && \
echo "1. Build -> Clean Project" && \
echo "2. Build -> Rebuild Project" && \
echo "3. Build -> Build Bundle(s) / APK(s) -> Build APK(s)"
```

---

### 方式二：分步手动执行

#### 步骤 1：Web 构建
```bash
npm run build
```

#### 步骤 2：同步到 Android
```bash
npx cap sync android
```

#### 步骤 3：清理 Android 缓存（重要！）

**Windows:**
```powershell
cd android
.\gradlew clean
cd ..
```

**Mac/Linux:**
```bash
cd android
./gradlew clean
cd ..
```

#### 步骤 4：Android Studio 操作

1. **打开项目**
   ```bash
   npx cap open android
   ```
   或手动打开 `android/` 目录

2. **Sync Project with Gradle Files**
   - 点击右上角 **Sync Now**（如果出现）
   - 或 **File → Sync Project with Gradle Files**

3. **清理项目**
   ```
   Build → Clean Project
   ```

4. **重建项目**
   ```
   Build → Rebuild Project
   ```

5. **生成 APK**
   ```
   Build → Build Bundle(s) / APK(s) → Build APK(s)
   ```

---

### 方式三：强制完全重建（解决缓存问题）

**Windows (PowerShell):**
```powershell
# 1. Web构建
npm run build

# 2. 清理 Android 旧资源
Remove-Item -Recurse -Force android\app\src\main\assets\public\*

# 3. 强制同步
npx cap sync android --force

# 4. Gradle 清理
cd android
.\gradlew clean
cd ..

Write-Host "✅ 清理完成" -ForegroundColor Green
Write-Host "请在 Android Studio 中执行：" -ForegroundColor Yellow
Write-Host "Build → Rebuild Project → Build APK" -ForegroundColor Cyan
```

**Mac/Linux:**
```bash
# 1. Web构建
npm run build

# 2. 清理 Android 旧资源
rm -rf android/app/src/main/assets/public/*

# 3. 强制同步
npx cap sync android --force

# 4. Gradle 清理
cd android
./gradlew clean
cd ..

echo "✅ 清理完成"
echo "请在 Android Studio 中执行："
echo "Build → Rebuild Project → Build APK"
```

---

## 📂 APK 输出位置

构建完成后，APK 位于：

```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🔍 验证编译是否成功

### 1. 检查 Web 资源时间
**Windows:**
```powershell
Get-ChildItem dist/index.html | Select-Object LastWriteTime
Get-ChildItem android/app/src/main/assets/public/index.html | Select-Object LastWriteTime
```

**Mac/Linux:**
```bash
ls -la dist/index.html
ls -la android/app/src/main/assets/public/index.html
```

两个时间应该一致。

### 2. 检查 APK 时间
**Windows:**
```powershell
Get-ChildItem android/app/build/outputs/apk/debug/app-debug.apk | Select-Object LastWriteTime
```

**Mac/Linux:**
```bash
ls -la android/app/build/outputs/apk/debug/app-debug.apk
```

APK 时间应该是最新的。

---

## 🚀 快速安装到手机

### 通过 ADB
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### 通过 Android Studio
```
Run → Run 'app'
```

---

## ⚠️ 常见问题

### 问题 1：cap sync 失败
```bash
# 重新安装 Capacitor
npm install @capacitor/cli @capacitor/core
npx cap sync android
```

### 问题 2：Gradle 下载慢
在 `android/gradle/wrapper/gradle-wrapper.properties` 中修改：
```properties
distributionUrl=https://mirrors.cloud.tencent.com/gradle/gradle-8.0-bin.zip
```

### 问题 3：构建时出现内存错误
**Windows:**
```powershell
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

**Mac/Linux:**
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

---

## 📝 完整命令速查表

| 操作 | Windows | Mac/Linux |
|------|---------|-----------|
| Web构建 | `npm run build` | `npm run build` |
| 同步Android | `npx cap sync android` | `npx cap sync android` |
| 打开Android Studio | `npx cap open android` | `npx cap open android` |
| Gradle清理 | `cd android; .\gradlew clean` | `cd android && ./gradlew clean` |
| 强制完全重建 | 见上方脚本 | 见上方脚本 |
| 安装APK | `adb install -r android/app/build/outputs/apk/debug/app-debug.apk` | `adb install -r android/app/build/outputs/apk/debug/app-debug.apk` |

---

## ✅ 编译检查清单

- [ ] `npm run build` 成功
- [ ] `npx cap sync android` 成功
- [ ] Android Studio 中 **Build → Clean Project**
- [ ] Android Studio 中 **Build → Rebuild Project**
- [ ] Android Studio 中 **Build → Build APK**
- [ ] APK 时间戳为最新
- [ ] 安装后 App 正常运行

---

## 💡 提示

1. **每次修改代码后**，必须重新执行完整流程
2. **Android Studio 缓存问题**：File → Invalidate Caches → Invalidate and Restart
3. **Gradle 问题**：删除 `~/.gradle/caches` 后重新构建
4. **Node 模块问题**：删除 `node_modules` 和 `package-lock.json` 后 `npm install`
