/**
 * 部署优化后的 Lottie 文件
 * 将优化后的 JSON 和图片文件复制到原 lottie 目录
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const optimizedDir = path.join(projectRoot, 'client', 'public', 'lottie-optimized');
const targetDir = path.join(projectRoot, 'client', 'public', 'lottie');
const imagesSourceDir = path.join(optimizedDir, 'images');
const imagesTargetDir = path.join(targetDir, 'images');

// 检查优化后的目录是否存在
if (!fs.existsSync(optimizedDir)) {
  console.error(`优化后的目录不存在: ${optimizedDir}`);
  console.error('请先运行: pnpm optimize:lottie');
  process.exit(1);
}

console.log('开始部署优化后的文件...\n');

// 1. 复制 JSON 文件
const jsonFiles = fs.readdirSync(optimizedDir).filter(f => f.endsWith('.json'));
console.log(`复制 ${jsonFiles.length} 个 JSON 文件...`);
for (const file of jsonFiles) {
  const source = path.join(optimizedDir, file);
  const target = path.join(targetDir, file);
  fs.copyFileSync(source, target);
  console.log(`  ✓ ${file}`);
}

// 2. 复制图片目录
if (fs.existsSync(imagesSourceDir)) {
  console.log(`\n复制图片目录...`);
  if (fs.existsSync(imagesTargetDir)) {
    // 如果目标目录已存在，先删除
    fs.rmSync(imagesTargetDir, { recursive: true, force: true });
  }
  fs.cpSync(imagesSourceDir, imagesTargetDir, { recursive: true });
  
  const imageCount = fs.readdirSync(imagesTargetDir).length;
  console.log(`  ✓ 已复制 ${imageCount} 个图片文件到 ${imagesTargetDir}`);
} else {
  console.log('\n⚠ 警告: 未找到图片目录，可能优化过程有问题');
}

console.log('\n✅ 部署完成！');
console.log(`优化后的文件已部署到: ${targetDir}`);
console.log(`图片文件已部署到: ${imagesTargetDir}`);
console.log('\n现在可以测试动画是否正常工作了！');

