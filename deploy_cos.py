#!/usr/bin/env python3
"""
腾讯云 COS 部署脚本
"""
import os
import sys
import json

# 添加 COS SDK
from qcloud_cos import CosConfig
from qcloud_cos import CosS3Client
import sys
import logging

logging.basicConfig(level=logging.INFO, stream=sys.stdout)

# 设置用户属性, 包括 secret_id, secret_key, region
# 从环境变量获取密钥
secret_id = os.environ.get('TENCENTCLOUD_SECRET_ID', '')
secret_key = os.environ.get('TENCENTCLOUD_SECRET_KEY', '')
region = 'ap-guangzhou'
bucket = 'soulmirror-web-20250225'
dist_dir = './dist'

def main():
    print("=== SoulMirror COS 部署 ===")
    
    if not secret_id or not secret_key:
        print("错误: 请设置 TENCENTCLOUD_SECRET_ID 和 TENCENTCLOUD_SECRET_KEY 环境变量")
        sys.exit(1)
    
    # 配置 COS
    config = CosConfig(Region=region, SecretId=secret_id, SecretKey=secret_key)
    client = CosS3Client(config)
    
    # 创建 bucket（如果不存在）
    try:
        client.create_bucket(
            Bucket=bucket,
            ACL='public-read'
        )
        print(f"✓ 创建 Bucket: {bucket}")
    except Exception as e:
        if 'BucketAlreadyExists' in str(e) or 'BucketAlreadyOwnedByYou' in str(e):
            print(f"✓ Bucket 已存在: {bucket}")
        else:
            print(f"创建 Bucket 失败: {e}")
    
    # 设置静态网站托管
    try:
        client.put_bucket_website(
            Bucket=bucket,
            WebsiteConfiguration={
                'IndexDocument': {'Suffix': 'index.html'},
                'ErrorDocument': {'Key': 'index.html'}
            }
        )
        print("✓ 配置静态网站托管")
    except Exception as e:
        print(f"配置静态网站失败: {e}")
    
    # 上传文件
    uploaded = 0
    for root, dirs, files in os.walk(dist_dir):
        for file in files:
            local_path = os.path.join(root, file)
            cos_path = os.path.relpath(local_path, dist_dir)
            
            try:
                client.upload_file(
                    Bucket=bucket,
                    LocalFilePath=local_path,
                    Key=cos_path,
                    PartSize=1,
                    MAXThread=10,
                    EnableMD5=False
                )
                uploaded += 1
                print(f"✓ 上传: {cos_path}")
            except Exception as e:
                print(f"✗ 上传失败 {cos_path}: {e}")
    
    print(f"\n✓ 部署完成！共上传 {uploaded} 个文件")
    print(f"访问地址: http://{bucket}.cos-website.{region}.myqcloud.com")

if __name__ == '__main__':
    main()