#!/bin/bash
# 腾讯云部署脚本
# 用于手动部署 SoulMirror 到腾讯云 COS

echo "=== SoulMirror 腾讯云部署脚本 ==="

# 配置变量
COS_BUCKET="soulmirror-web-$(date +%s)"
REGION="ap-guangzhou"
DIST_DIR="./dist"

# 检查 dist 目录
if [ ! -d "$DIST_DIR" ]; then
    echo "错误: dist 目录不存在，请先运行 npm run build"
    exit 1
fi

echo "1. 构建产物检查完成"
echo "2. 准备部署到腾讯云 COS..."
echo "   Bucket: $COS_BUCKET"
echo "   Region: $REGION"
echo ""
echo "部署步骤:"
echo "1. 安装腾讯云 CLI: pip install tccli"
echo "2. 配置密钥: tccli configure"
echo "3. 创建 COS Bucket: tccli cos CreateBucket"
echo "4. 开启静态网站: tccli cos PutBucketWebsite"
echo "5. 上传文件: tccli cos sync $DIST_DIR cos://$COS_BUCKET/"
echo ""
echo "或使用 Serverless Framework:"
echo "1. npm install -g serverless"
echo "2. serverless deploy"
echo ""
echo "dist 目录内容:"
ls -la $DIST_DIR
