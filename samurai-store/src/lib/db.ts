import mysql from 'mysql2/promise';

// DB接続設定を環境変数から取得
const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
};

// DB接続プールを作成
const pool = mysql.createPool(dbConfig);

// SQL文を実行
export async function executeQuery<T = unknown>(sql: string, params: (string | number | null)[] = []): Promise<T[]> {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows as T[];
  } catch (err) {
    console.error('SQL実行エラー：', err);
    throw err; // エラーを呼び出し元に投げる
  }
}