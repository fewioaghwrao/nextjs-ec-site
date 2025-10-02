import { executeQuery } from '@/lib/db';
import { CartItem } from '@/hooks/useCart';
import { type ResultSetHeader } from 'mysql2/promise';

// 注文ステータス
type OrderStatus = '未処理' | '処理中' | '出荷済み' | '完了' | 'キャンセル' | '返金済み';
// 決済ステータス
type PaymentStatus = '未決済' | '決済処理中' | '決済成功' | '決済失敗' | '返金処理中' | '返金済み';

// 注文確定前の在庫チェック
export async function checkStock(cartItems: CartItem[]): Promise<string[]> {
  // 不足商品リスト
  const shortageItems: string[] = [];

  // すべてのアイテムを順番にチェック
  for (const item of cartItems) {
    const result = await executeQuery<{ name: string, stock: number }>(
      `SELECT name, stock FROM products WHERE id = ? LIMIT 1;`,
      [item.id]
    );
    const product = result[0];
    // 商品が存在しない、または在庫不足なら不足商品リストに追加
    if (!product || (product.stock ?? 0) < item.quantity) {
      shortageItems.push(product?.name || `ID:${item.id}`);
    }
  }

  // 不足商品リストを返す（なければ空配列）
  return shortageItems;
}

// 注文データを新規登録
export async function createOrder(userId: number, cartItems: CartItem[], address: string, totalPrice: number): Promise<number> {
  if (!Array.isArray(cartItems) || cartItems.length === 0) throw new Error('カートが空です。');
  if (!address?.trim()) throw new Error('配送先が未入力です。');
  if (isNaN(totalPrice) || totalPrice <= 0) throw new Error('合計金額が不正です。');

  // 注文情報をordersテーブルに追加
  const result = await executeQuery<{ insertId: number }>(`
    INSERT INTO orders (user_id, total_price, status, payment_status, shipping_address)
    VALUES (?, ?, '未処理', '未決済', ?);`,
    [userId, totalPrice, address]
  ) as unknown as ResultSetHeader; // 単一オブジェクトとして型変換
  // 追加したデータの注文IDを取得
  const orderId = result.insertId;
  if (!orderId) throw new Error('注文登録に失敗しました。');

  // 注文明細をorder_itemsテーブルに追加
  for (const product of cartItems) {
    await executeQuery(`
      INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price)
      VALUES (?, ?, ?, ?, ?);`,
      [orderId, product.id, product.title, product.quantity, product.price]);
  }

  // 注文IDを返す
  return orderId;
}

// 指定IDの注文データを更新
export async function updateOrder(userId: number, orderId: number, status?: OrderStatus, paymentStatus?: PaymentStatus) {
  if (!userId) throw new Error('認証されていません。');
  if (!orderId) throw new Error('注文IDが必要です。');

  // 更新するカラムと値を組み立てる
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (status) { // 注文ステータス更新
    fields.push('status = ?');
    values.push(status);
  }
  if (paymentStatus) { // 決済ステータス更新
    fields.push('payment_status = ?');
    values.push(paymentStatus);
  }

  if (fields.length === 0) return; // 更新対象なし

  // WHERE句に指定する注文IDとユーザーIDを追加
  values.push(orderId, userId);

 // ordersテーブルの注文情報を更新
  const result = await executeQuery<ResultSetHeader>(`
    UPDATE orders
    SET ${fields.join(', ')}
    WHERE id = ? AND user_id = ? AND payment_status != '決済成功';`,
    values
  );

  // 決済成功かつ注文データ更新成功なら商品の在庫数と販売数を更新
  if (paymentStatus === '決済成功' && result[0].affectedRows > 0) {
    // 注文IDに紐づく商品のIDと注文数を取得
    const orderItems = await executeQuery<{ product_id: number; quantity: number }>(
      `SELECT product_id, quantity FROM order_items WHERE order_id = ?;`,
      [orderId]
    );

    // 購入された商品の在庫数と販売数を順番に更新
    for (const item of orderItems) {
      await executeQuery(`
        UPDATE products
        SET stock = stock - ?, sales_count = sales_count + ?, updated_at = NOW()
        WHERE id = ?;`,
        [item.quantity, item.quantity, item.product_id]
      );
    }
  }
}