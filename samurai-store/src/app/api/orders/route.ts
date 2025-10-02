import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { getAuthUser, type AuthUser } from '@/lib/auth';

// 最終的なレスポンス（商品明細を配列化した注文データ）の型定義
export interface OrderData {
  id: number;
  totalPrice: number;
  status: '未処理' | '処理中' | '出荷済み' | '完了' | 'キャンセル' | '返金済み';
  paymentStatus: '未決済' | '決済処理中' | '決済成功' | '決済失敗' | '返金処理中' | '返金済み';
  createdAt: string;
  items: OrderItem[]; // 商品明細の配列
}

// 注文ごとの商品データの型定義
interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
}

// ordersとorder_itemsをテーブル結合した結果レコードの型定義
interface OrderJoinRecord {
  id: number;
  totalPrice: number;
  status: '未処理' | '処理中' | '出荷済み' | '完了' | 'キャンセル' | '返金済み';
  paymentStatus: '未決済' | '決済処理中' | '決済成功' | '決済失敗' | '返金処理中' | '返金済み';
  createdAt: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

// 注文データを取得
export async function GET() {
  try {
    const user: AuthUser | null = await getAuthUser();
    if (!user) {
      return NextResponse.json({ message: 'ログインしてください。' }, { status: 401 });
    }

    // ユーザーIDに紐づく注文と注文明細を取得
    const ordersData = await executeQuery<OrderJoinRecord>(`
      SELECT
        o.id AS id,
        o.total_price AS totalPrice,
        o.status AS status,
        o.payment_status AS paymentStatus,
        o.created_at AS createdAt,
        oi.product_name AS productName,
        oi.quantity AS quantity,
        oi.unit_price AS unitPrice
      FROM orders AS o
      JOIN order_items AS oi ON o.id = oi.order_id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC, oi.id ASC;`,
      [user.userId]
    );

    // Mapオブジェクト（キー＆値のペア）を使い、注文ごとに商品データをまとめる
    const ordersMap = new Map<number, OrderData>();
    ordersData.forEach((row: OrderJoinRecord) => {
      if (!ordersMap.has(row.id)) { // ordersMap未登録の場合
        // 新しいIDをordersMapに登録
        ordersMap.set(row.id, {
          id: row.id,
          totalPrice: row.totalPrice,
          status: row.status,
          paymentStatus: row.paymentStatus,
          createdAt: row.createdAt,
          items: [] // items配列を空で初期化
        });
      }

      // 現在レコードの商品明細をitems配列に追加
      ordersMap.get(row.id)!.items.push({
        productName: row.productName,
        quantity: row.quantity,
        unitPrice: row.unitPrice
      });
    });

    // ordersMapから値だけを取り出した配列を作り、最終的な注文リストとして返す
    const orders = Array.from(ordersMap.values());
    return NextResponse.json({ orders });
  } catch (err) {
    console.error('注文取得エラー：', err);
    return NextResponse.json({ message: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}