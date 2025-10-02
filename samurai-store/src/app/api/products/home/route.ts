import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { type ProductData } from '@/types/product';

// 商品データの型定義
type Product = Pick<ProductData, 'id' | 'name' | 'price' | 'image_url' | 'review_avg' | 'review_count'>;

// トップページ専用の商品データ取得
export async function GET() {
  try {
    // 各セクションに対するSELECT文を並行処理で実施
    const [pickUp, newArrival, hotItems] = await Promise.all([
      executeQuery<Product[]>(`
        SELECT id, name, price, image_url
        FROM products
        ORDER BY sales_count DESC
        LIMIT 3;
      `),
      executeQuery<Product[]>(`
        SELECT
          p.id,
          p.name,
          p.price,
          p.image_url,
          COALESCE(ROUND(AVG(r.score), 1), 0) AS review_avg,
          COALESCE(COUNT(r.id), 0) AS review_count
        FROM products AS p
        LEFT JOIN reviews AS r ON r.product_id = p.id
        GROUP BY p.id
        ORDER BY p.created_at DESC
        LIMIT 4;
      `),
      executeQuery<Product[]>(`
        SELECT
          p.id,
          p.name,
          p.price,
          p.image_url,
          COALESCE(ROUND(AVG(r.score), 1), 0) AS review_avg,
          COALESCE(COUNT(r.id), 0) AS review_count
        FROM products AS p
        LEFT JOIN reviews AS r ON r.product_id = p.id
        WHERE p.is_featured = true
        GROUP BY p.id
        ORDER BY RAND()
        LIMIT 4;
      `)
    ]);

    // 取得したデータを返却
    return NextResponse.json({ pickUp, newArrival, hotItems });
  } catch (err) {
    console.error('トップページ商品取得エラー：', err);
    return NextResponse.json({ message: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}