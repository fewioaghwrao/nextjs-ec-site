// app/api/favorites/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import { executeQuery } from '@/lib/db'; // ★ 追加

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ★ DB Pool を削除
async function resolveUserIdFromAuthToken(): Promise<number | null> {
  try {
    const store = await cookies();
    const authToken = store.get('authToken')?.value;
    
    if (!authToken) {
      console.log('⚠️ No authToken cookie');
      return null;
    }

    const payload = await verifyToken(authToken);
    if (!payload) {
      console.log('⚠️ Invalid token');
      return null;
    }

    const userId = payload.userId;
    if (typeof userId === 'number' && userId > 0) {
      console.log('✅ Valid userId:', userId);
      return userId;
    }

    console.log('⚠️ Invalid userId in payload:', userId);
    return null;
  } catch (e) {
    console.error('❌ Auth token error:', e);
    return null;
  }
}

function parseProductId(idParam: string | string[] | undefined): number | null {
  if (typeof idParam !== 'string') return null;
  const n = Number(idParam);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * GET /api/favorites/[id]
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await resolveUserIdFromAuthToken();
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: 認証トークンが無効です。' },
        { status: 401 }
      );
    }

    const params = await context.params;
    const productId = parseProductId(params?.id);
    if (!productId) {
      return NextResponse.json(
        { ok: false, error: 'Invalid path param: [id] は正の整数の productId が必要です。' },
        { status: 400 }
      );
    }

    // ★ executeQuery を使用
    const rows = await executeQuery<{ id: number }>(
      'SELECT 1 FROM favorites WHERE user_id = ? AND product_id = ? LIMIT 1',
      [userId, productId]
    );

    const exists = rows.length > 0;
    return NextResponse.json({ ok: true, exists }, { status: 200 });
  } catch (err) {
    console.error('GET /api/favorites/[id] error:', err);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/favorites/[id]
 */
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await resolveUserIdFromAuthToken();
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized: 認証トークンが無効です。' },
        { status: 401 }
      );
    }

    const params = await context.params;
    const productId = parseProductId(params?.id);
    if (!productId) {
      return NextResponse.json(
        { ok: false, error: 'Invalid path param: [id] は正の整数の productId が必要です。' },
        { status: 400 }
      );
    }

    // ★ executeQuery を使用（DELETEの結果を取得する方法）
    const result = await executeQuery(
      'DELETE FROM favorites WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );

    // executeQueryの戻り値から削除件数を取得
    const deleted = (result as any)?.affectedRows ?? 0;

    console.log('✅ Favorite deleted:', deleted, 'userId=', userId, 'productId=', productId);

    return NextResponse.json({ ok: true, deleted }, { status: 200 });
  } catch (err) {
    console.error('DELETE /api/favorites/[id] error:', err);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
