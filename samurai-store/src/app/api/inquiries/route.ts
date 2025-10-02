// app/api/inquiries/route.ts
import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

// Prisma を使わないので Node ランタイムを明示
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- MySQL プール（このファイル内でシングルトン化）----
type GlobalWithPool = typeof globalThis & { __mysqlPool?: mysql.Pool };

function createPool() {
  // 環境変数はどちらかで設定してください
  // 1) DATABASE_URL = "mysql://user:pass@host:3306/dbname"
  // 2) DB_HOST / DB_USER / DB_PASSWORD / DB_NAME
  const { DATABASE_URL, DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

  const cfg =
    DATABASE_URL
      ? { uri: DATABASE_URL }
      : {
          host: DB_HOST,
          user: DB_USER,
          password: DB_PASSWORD,
          database: DB_NAME,
        };

  return mysql.createPool({
    ...cfg,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60000,
    enableKeepAlive: true,
  });
}

const g = globalThis as GlobalWithPool;
const pool = g.__mysqlPool ?? createPool();
if (process.env.NODE_ENV !== 'production') g.__mysqlPool = pool;

// ---------------------- GET ----------------------
// 全件取得（送信日時の新しい順）
export async function GET() {
  try {
    const [rows] = await pool.query(
      // created_at の列名は環境に合わせて調整可
      'SELECT id, name, email, message, created_at FROM inquiries ORDER BY created_at DESC'
    );
    return NextResponse.json(rows, { status: 200 });
  } catch (err) {
    console.error('[GET /api/inquiries] ', err);
    return NextResponse.json(
      { message: 'お問い合わせの取得に失敗しました。' },
      { status: 500 }
    );
  }
}

// ---------------------- POST ----------------------
// { name, email, message } を登録（空白チェックのみ）
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json(
        { message: 'Content-Type は application/json を指定してください。' },
        { status: 415 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ message: '不正な JSON です。' }, { status: 400 });
    }

    // 空白チェックのみ（形式チェックはしない）
    const name = (String((body as any).name ?? '')).trim();
    const email = (String((body as any).email ?? '')).trim();
    const message = (String((body as any).message ?? '')).trim();

    if (!name || !email || !message) {
      return NextResponse.json(
        { message: 'すべての項目を入力してください。' },
        { status: 400 }
      );
    }

    // 追加
    const [result] = await pool.execute<mysql.ResultSetHeader>(
      'INSERT INTO inquiries (name, email, message) VALUES (?, ?, ?)',
      [name, email, message]
    );

    const insertedId = result.insertId;

    // 返却用に 1 件取得して返す（任意）
    const [rows] = await pool.query(
      'SELECT id, name, email, message, created_at FROM inquiries WHERE id = ?',
      [insertedId]
    );

    return NextResponse.json(
      Array.isArray(rows) && rows.length ? rows[0] : { id: insertedId, name, email, message },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/inquiries] ', err);
    return NextResponse.json(
      { message: 'お問い合わせの送信に失敗しました。' },
      { status: 500 }
    );
  }
}

