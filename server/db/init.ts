// server/db/init.ts
import { Pool } from 'pg';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 加载 .env 文件（确保在读取环境变量之前加载）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '..', '..', '.env') });

// 从环境变量读取数据库配置
// 如果数据库功能未启用，不初始化连接池
const dbPassword = process.env.DB_PASSWORD;
const enableDatabase = process.env.ENABLE_DATABASE === 'true';

let pool: Pool | null = null;

if (!enableDatabase) {
  // 数据库功能未启用
  console.log('ℹ️ 数据库功能已禁用（ENABLE_DATABASE 未设置为 true）');
} else if (!dbPassword || typeof dbPassword !== 'string') {
  console.error('错误: DB_PASSWORD 环境变量未设置或不是字符串类型');
  console.error('请在 .env 文件中设置 DB_PASSWORD=你的数据库密码');
  throw new Error('数据库密码未配置');
} else {
  const dbConfig = {
    host: process.env.DB_HOST || '124.220.81.123',
    port: parseInt(process.env.DB_PORT || '5433'),
    database: process.env.DB_NAME || 'xhd', // 使用现有的 xhd 数据库
    user: process.env.DB_USER || 'postgres',
    password: dbPassword, // 确保是字符串
    max: 20, // 连接池最大连接数
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  // 创建连接池
  pool = new Pool(dbConfig);

  // 测试连接
  pool.on('connect', () => {
    console.log('PostgreSQL 数据库连接成功');
  });

  pool.on('error', (err) => {
    console.error('PostgreSQL 数据库连接错误:', err);
  });
}

// 初始化数据库表
export async function initDatabase() {
  if (!pool) {
    throw new Error('数据库功能未启用，无法初始化');
  }
  
  const client = await pool.connect();
  try {
    // 创建用户表
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        openid VARCHAR(255) UNIQUE NOT NULL,
        nickname VARCHAR(255),
        avatar TEXT,
        phone_number VARCHAR(20),
        source VARCHAR(50) DEFAULT 'miniprogram',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 创建索引
    await client.query('CREATE INDEX IF NOT EXISTS idx_openid ON users(openid)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_phone_number ON users(phone_number)');
    
    console.log('数据库表初始化完成');
  } catch (err) {
    console.error('数据库初始化错误:', err);
    throw err;
  } finally {
    client.release();
  }
}

// 导出连接池（可能为 null）
export default pool;
