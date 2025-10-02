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
        SELECT id, name, price, image_url
        FROM products
        ORDER BY created_at DESC
        LIMIT 4;
      `),
      executeQuery<Product[]>(`
        SELECT id, name, price, image_url
        FROM products
        WHERE is_featured = true
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