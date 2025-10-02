import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { type ReviewData } from '@/types/review';
import { getAuthUser, type AuthUser } from '@/lib/auth';

// レビューの型定義
type Review = ReviewData; // 基本型から変更なし

// 指定した商品IDのレビュー一覧を取得
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // URLのパラメータからIDを取得
  const { id } = await context.params;
  const productId = parseInt(id, 10); // 数値に変換

  try {
    const { searchParams } = new URL(request.url);

    // ページネーションに必要な情報を取得
    let page = Number(searchParams.get('page')) || 1;
    const perPage = 10; // 表示件数は固定
    page = Math.max(1, Math.min(page, 1000));

    // オフセット（スキップする件数）を計算
    const offset = (page - 1) * perPage;

    // 2つのデータベース操作を並行処理で実施
    const [reviews, totalItemsResult] = await Promise.all([
      // レビュー一覧を取得（テーブル結合でユーザー名も取得）
      executeQuery<Review[]>(`
        SELECT
          r.id,
          r.product_id,
          r.user_id,
          r.score,
          r.content,
          r.created_at,
          u.name AS user_name
        FROM reviews AS r
        JOIN users AS u ON r.user_id = u.id
        WHERE r.product_id = ?
        ORDER BY r.created_at DESC
        LIMIT ?
        OFFSET ?
        ;`, [productId, perPage, offset]
      ),
      // 該当商品の全レビュー件数と平均レビュー評価を取得
      executeQuery<{ count: number, review_avg: number }>(`
        SELECT
          COUNT(*) AS count,
          COALESCE(ROUND(AVG(score), 1), 0) AS review_avg
        FROM reviews
        WHERE product_id = ?
        ;`, [productId]
      )
    ]);

    const review_avg = Number(totalItemsResult[0].review_avg) || 0;
    const totalItems = Number(totalItemsResult[0].count) || 0;

    // 総ページ数を計算
    const totalPages = Math.max(1, Math.ceil(totalItems / perPage));

    // 取得したレビューデータとページネーション情報を返す
    return NextResponse.json({
      reviews,
      review_avg,
      pagination: { currentPage: page, perPage, totalItems, totalPages }
    });
  } catch (err) {
    console.error('レビュー取得エラー：', err);
    return NextResponse.json({ message: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}

// レビューを新規登録
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // URLのパラメータからIDを取得
  const { id } = await context.params;
  const productId = parseInt(id, 10); // 数値に変換

  try {
    const user: AuthUser | null = await getAuthUser();
    if (!user) {
      return NextResponse.json({ message: 'ログインしてください。' }, { status: 401 });
    }

    // リクエストに含まれるレビュー情報を取得
    const body = await request.json();
    const score = Number(body.rating); // 星の数（1～5）
    const content = body.content?.toString().trim() || ''; // レビュー内容

    // 入力値のバリデーション
    if (isNaN(score) || !content) {
      return NextResponse.json({ message: '必須項目が不足しています。' }, { status: 400 });
    }

    // レビュー情報をreviewsテーブルに追加
    await executeQuery(`
      INSERT INTO reviews (product_id, user_id, score, content)
      VALUES (?, ?, ?, ?);
    `, [productId, user.userId, score, content]);

    return NextResponse.json({ message: 'レビューを登録しました。' }, { status: 201 });
  } catch (err) {
    console.error('レビュー登録エラー：', err);
    return NextResponse.json({ message: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}