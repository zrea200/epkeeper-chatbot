// server/db/index.ts
// 数据库操作封装
import pool from './init.js';

export interface User {
  id: number;
  openid: string;
  nickname: string | null;
  avatar: string | null;
  phone_number: string | null;
  source: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  openid: string;
  nickname?: string;
  avatar?: string;
  phone_number?: string;
  source?: string;
}

/**
 * 创建或更新用户信息
 */
export async function createOrUpdateUser(data: CreateUserData): Promise<User> {
  const { openid, nickname, avatar, phone_number, source = 'miniprogram' } = data;

  const client = await pool.connect();
  try {
    // 检查用户是否已存在
    const checkResult = await client.query('SELECT * FROM users WHERE openid = $1', [openid]);
    const existingUser = checkResult.rows[0] as User | undefined;

    if (existingUser) {
      // 更新用户信息（只更新非空字段）
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (nickname !== undefined && nickname !== null) {
        updateFields.push(`nickname = $${paramIndex++}`);
        updateValues.push(nickname);
      }
      if (avatar !== undefined && avatar !== null) {
        updateFields.push(`avatar = $${paramIndex++}`);
        updateValues.push(avatar);
      }
      if (phone_number !== undefined && phone_number !== null) {
        updateFields.push(`phone_number = $${paramIndex++}`);
        updateValues.push(phone_number);
      }

      if (updateFields.length > 0) {
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(openid);

        const updateSql = `UPDATE users SET ${updateFields.join(', ')} WHERE openid = $${paramIndex}`;
        await client.query(updateSql, updateValues);

        // 返回更新后的用户信息
        const result = await client.query('SELECT * FROM users WHERE openid = $1', [openid]);
        return result.rows[0] as User;
      }

      return existingUser;
    } else {
      // 创建新用户
      const insertResult = await client.query(
        `INSERT INTO users (openid, nickname, avatar, phone_number, source)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [openid, nickname || null, avatar || null, phone_number || null, source]
      );

      return insertResult.rows[0] as User;
    }
  } finally {
    client.release();
  }
}

/**
 * 根据 openid 查询用户
 */
export async function getUserByOpenid(openid: string): Promise<User | undefined> {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users WHERE openid = $1', [openid]);
    return result.rows[0] as User | undefined;
  } finally {
    client.release();
  }
}

/**
 * 根据手机号查询用户
 */
export async function getUserByPhone(phone_number: string): Promise<User | undefined> {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users WHERE phone_number = $1', [phone_number]);
    return result.rows[0] as User | undefined;
  } finally {
    client.release();
  }
}

/**
 * 获取所有用户（分页）
 */
export async function getAllUsers(limit: number = 100, offset: number = 0): Promise<User[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return result.rows as User[];
  } finally {
    client.release();
  }
}

/**
 * 获取用户总数
 */
export async function getUserCount(): Promise<number> {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT COUNT(*) as count FROM users');
    return parseInt(result.rows[0].count);
  } finally {
    client.release();
  }
}
