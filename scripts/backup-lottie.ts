/**
 * 备份 Lottie 动画文件
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const sourceDir = path.join(projectRoot, 'client', 'public', 'lottie');
const backupDir = path.join(projectRoot, 'client', 'public', 'lottie-backup');

// 检查源目录是否存在
if (!fs.existsSync(sourceDir)) {
  console.error(`源目录不存在: ${sourceDir}`);
  process.exit(1);
}

// 如果备份目录已存在，先删除
if (fs.existsSync(backupDir)) {
  console.log('删除旧的备份目录...');
  fs.rmSync(backupDir, { recursive: true, force: true });
}

// 复制目录
console.log(`备份中: ${sourceDir} -> ${backupDir}`);
fs.cpSync(sourceDir, backupDir, { recursive: true });

// 计算备份文件大小
const files = fs.readdirSync(backupDir);
let totalSize = 0;
for (const file of files) {
  const filePath = path.join(backupDir, file);
  const stats = fs.statSync(filePath);
  if (stats.isFile()) {
    totalSize += stats.size;
  }
}

console.log(`\n✅ 备份完成！`);
console.log(`备份位置: ${backupDir}`);
console.log(`备份文件数: ${files.length}`);
console.log(`备份总大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

