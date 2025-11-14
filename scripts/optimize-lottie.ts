/**
 * Lottie 动画优化脚本
 * 
 * 功能：
 * 1. 提取 base64 WebP 图片为外部文件
 * 2. 调整动画尺寸：720×1280 → 540×960
 * 3. 保持帧率 24fps 和完整 192 帧
 * 4. 生成优化后的 JSON 文件
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

interface LottieAsset {
  id: string;
  w: number;
  h: number;
  p?: string; // base64 图片数据
  u?: string; // 外部图片路径
}

interface LottieAnimation {
  v: string;
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  assets: LottieAsset[];
  [key: string]: any;
}

// 目标尺寸（移动端优化）
const TARGET_WIDTH = 540;
const TARGET_HEIGHT = 960;
const SCALE_FACTOR = TARGET_WIDTH / 720; // 720 是原始宽度

// CDN 基础路径（可通过环境变量配置）
// 支持相对路径（如 /lottie/images）和绝对路径（如 https://cdn.example.com/lottie/images）
const CDN_BASE_URL = process.env.CDN_BASE_URL || '/lottie/images';

/**
 * 将 base64 WebP 图片保存为外部文件
 */
function saveBase64Image(base64Data: string, assetId: string, outputDir: string): string {
  // 提取 base64 数据（去掉 data:image/webp;base64, 前缀）
  const base64Match = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!base64Match) {
    throw new Error(`无效的 base64 图片数据: ${assetId}`);
  }

  const [, format, data] = base64Match;
  const imageBuffer = Buffer.from(data, 'base64');
  
  // 确保输出目录存在
  const imagesDir = path.join(outputDir, 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  // 保存图片文件
  const filename = `${assetId}.${format}`;
  const filepath = path.join(imagesDir, filename);
  fs.writeFileSync(filepath, imageBuffer);

  // 返回图片路径信息
  // 如果 CDN_BASE_URL 是绝对路径，返回完整 URL
  if (CDN_BASE_URL.startsWith('http://') || CDN_BASE_URL.startsWith('https://')) {
    return `${CDN_BASE_URL}/${filename}`;
  }
  // 相对路径：返回相对于 JSON 文件的路径
  // 例如：CDN_BASE_URL=/lottie/images，则返回 /lottie/images/filename.webp
  return `${CDN_BASE_URL}/${filename}`;
}

/**
 * 缩放动画尺寸和资源
 */
function scaleAnimation(animation: LottieAnimation): LottieAnimation {
  // 缩放主尺寸
  animation.w = Math.round(animation.w * SCALE_FACTOR);
  animation.h = Math.round(animation.h * SCALE_FACTOR);

  // 缩放所有资源
  if (animation.assets) {
    animation.assets = animation.assets.map(asset => {
      if (asset.w && asset.h) {
        return {
          ...asset,
          w: Math.round(asset.w * SCALE_FACTOR),
          h: Math.round(asset.h * SCALE_FACTOR),
        };
      }
      return asset;
    });
  }

  return animation;
}

/**
 * 优化单个 Lottie 文件
 */
function optimizeLottieFile(
  inputPath: string,
  outputPath: string,
  imagesOutputDir: string
): { originalSize: number; optimizedSize: number; imagesExtracted: number } {
  console.log(`\n处理文件: ${path.basename(inputPath)}`);

  // 读取原始文件
  const originalContent = fs.readFileSync(inputPath, 'utf-8');
  const originalSize = Buffer.byteLength(originalContent, 'utf8');
  const animation: LottieAnimation = JSON.parse(originalContent);

  // 提取并保存 base64 图片
  let imagesExtracted = 0;
  if (animation.assets && Array.isArray(animation.assets)) {
    animation.assets = animation.assets.map(asset => {
      if (asset.p && asset.p.startsWith('data:image/')) {
        // 提取 base64 图片
        const imageUrl = saveBase64Image(asset.p, asset.id, imagesOutputDir);
        imagesExtracted++;
        
        // 移除 base64 数据，添加外部路径
        const { p, ...rest } = asset;
        // Lottie 格式：u 是目录路径（相对于 JSON 文件），p 是文件名
        // 如果 CDN_BASE_URL 是绝对路径，u 为空，p 包含完整 URL
        // 如果是相对路径，u 是目录路径，p 是文件名
        if (CDN_BASE_URL.startsWith('http://') || CDN_BASE_URL.startsWith('https://')) {
          // 绝对路径：u 为空，p 包含完整 URL
          return {
            ...rest,
            u: '', // 空字符串表示使用完整 URL
            p: imageUrl, // 完整 URL
          };
        } else {
          // 相对路径：u 是目录路径，p 是文件名
          // 例如：/lottie/images/filename.webp -> u: /lottie/images, p: filename.webp
          const imageDir = path.dirname(imageUrl);
          const imageName = path.basename(imageUrl);
          return {
            ...rest,
            u: imageDir || '', // 目录路径
            p: imageName, // 文件名
          };
        }
      }
      return asset;
    });
  }

  // 缩放动画尺寸
  const scaledAnimation = scaleAnimation(animation);

  // 保存优化后的 JSON
  const optimizedContent = JSON.stringify(scaledAnimation);
  const optimizedSize = Buffer.byteLength(optimizedContent, 'utf8');
  fs.writeFileSync(outputPath, optimizedContent, 'utf-8');

  const sizeReduction = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);
  console.log(`  原始大小: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  优化后: ${(optimizedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  减少: ${sizeReduction}%`);
  console.log(`  提取图片: ${imagesExtracted} 个`);

  return { originalSize, optimizedSize, imagesExtracted };
}

/**
 * 主函数
 */
function main() {
  const lottieDir = path.join(projectRoot, 'client', 'public', 'lottie');
  const outputDir = path.join(projectRoot, 'client', 'public', 'lottie-optimized');
  const imagesOutputDir = outputDir;

  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 查找所有 Lottie JSON 文件
  const files = fs.readdirSync(lottieDir).filter(file => file.endsWith('.json'));
  
  if (files.length === 0) {
    console.error('未找到 Lottie 文件！');
    process.exit(1);
  }

  console.log(`找到 ${files.length} 个 Lottie 文件`);
  console.log(`目标尺寸: ${TARGET_WIDTH}×${TARGET_HEIGHT}`);
  console.log(`CDN 路径: ${CDN_BASE_URL}`);
  console.log('开始优化...');

  let totalOriginalSize = 0;
  let totalOptimizedSize = 0;
  let totalImagesExtracted = 0;

  // 处理每个文件
  for (const file of files) {
    const inputPath = path.join(lottieDir, file);
    const outputPath = path.join(outputDir, file);
    
    try {
      const result = optimizeLottieFile(inputPath, outputPath, imagesOutputDir);
      totalOriginalSize += result.originalSize;
      totalOptimizedSize += result.optimizedSize;
      totalImagesExtracted += result.imagesExtracted;
    } catch (error) {
      console.error(`处理 ${file} 时出错:`, error);
    }
  }

  // 输出总结
  console.log('\n=== 优化完成 ===');
  console.log(`总原始大小: ${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`总优化后: ${(totalOptimizedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`总减少: ${((totalOriginalSize - totalOptimizedSize) / totalOriginalSize * 100).toFixed(1)}%`);
  console.log(`提取图片总数: ${totalImagesExtracted} 个`);
  console.log(`\n优化后的文件保存在: ${outputDir}`);
  console.log(`图片文件保存在: ${path.join(imagesOutputDir, 'images')}`);
  console.log('\n下一步：');
  console.log('1. 检查优化后的文件');
  console.log('2. 将优化后的文件复制回 client/public/lottie/（或直接使用 lottie-optimized）');
  console.log('3. 配置 CDN 路径（通过环境变量 CDN_BASE_URL）');
}

// 运行脚本
main();

