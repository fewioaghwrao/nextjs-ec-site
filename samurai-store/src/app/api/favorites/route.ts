// app/api/favorites/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import { executeQuery } from '@/lib/db'; // ★ 追加

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ★ DB Pool を削除して executeQuery を使用
async function resolveUserIdFromAuthToken(): Promise<number | null> {
  try {
    const store = await cookies();
    const authToken = store.get('authToken')?.value;
    
    if (!authToken) return null;

    const payload = await verifyToken(authToken);
    if (!payload) return null;

    const userId = payload.userId;
    if (typeof userId === 'number' && userId > 0) {
      return userId;
    }

    return null;
  } catch (e) {
    console.error('Auth token error:', e);
    return null;
  }
}

export async function GET(_req: NextRequest) {
  try {
    const userId = await resolveUserIdFromAuthToken();
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: 認証トークンが無効です。' },
        { status: 401 }
      );
    }

    // ★ executeQuery を使用
    const rows = await executeQuery<{ id: number; user_id: number; product_id: number; created_at: string }>(
      'SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    return NextResponse.json({ ok: true, data: rows }, { status: 200 });
  } catch (err) {
    console.error('GET /api/favorites error:', err);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await resolveUserIdFromAuthToken();
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: 認証トークンが無効です。' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const productId = Number(body?.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Invalid payload: productId は正の整数で必須です。' },
        { status: 400 }
      );
    }

    // ★ executeQuery を使用
    await executeQuery(
      'INSERT IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)',
      [userId, productId]
    );

    console.log('✅ Favorite added: userId=', userId, 'productId=', productId);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error('POST /api/favorites error:', err);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}