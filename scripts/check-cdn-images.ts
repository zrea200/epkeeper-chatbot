/**
 * 检查 CDN 上的图片是否完整
 */
import https from 'node:https';

const CDN_BASE_URL = 'https://downloaddocparse.langcore.net/images';
const REQUIRED_IMAGES = Array.from({ length: 192 }, (_, i) => i + 1);

async function checkImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => {
      resolve(false);
    });
  });
}

async function main() {
  console.log(`检查 CDN 图片完整性: ${CDN_BASE_URL}\n`);
  
  const missing: number[] = [];
  const existing: number[] = [];
  
  for (let i = 0; i < REQUIRED_IMAGES.length; i++) {
    const num = REQUIRED_IMAGES[i];
    const url = `${CDN_BASE_URL}/${num}.webp`;
    const exists = await checkImage(url);
    
    if (exists) {
      existing.push(num);
      process.stdout.write('.');
    } else {
      missing.push(num);
      process.stdout.write('X');
    }
    
    // 每 10 个换行
    if ((i + 1) % 10 === 0) {
      process.stdout.write('\n');
    }
  }
  
  console.log('\n');
  console.log(`✅ 存在的图片: ${existing.length} 个`);
  console.log(`❌ 缺失的图片: ${missing.length} 个`);
  
  if (missing.length > 0) {
    console.log('\n缺失的图片编号:');
    console.log(missing.join(', '));
    console.log('\n⚠️  请上传缺失的图片到 CDN！');
  } else {
    console.log('\n✅ 所有图片都已上传到 CDN！');
  }
}

main().catch(console.error);

