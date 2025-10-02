import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { checkStock, createOrder } from '@/app/api/orders/orderService';
import { getAuthUser, type AuthUser } from '@/lib/auth';
import { CartItem } from '@/hooks/useCart';
import { executeQuery } from '@/lib/db';

// 配送費用
const SHIPPING_COST = 500; // 500円固定とする

// 環境変数からStripeシークレットキーを取得
const SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!SECRET_KEY) throw new Error('環境変数STRIPE_SECRET_KEYが設定されていません。');

// Stripe初期化
const stripe = new Stripe(SECRET_KEY, {
  apiVersion: '2025-09-30.clover', // 最新のAPIバージョンを指定
});

// Checkoutセッションを作成
export async function POST(request: NextRequest) {
  try {
    // リクエストボディからカート情報とお届け先を取得
    const { items, address }: {
      items: CartItem[];
      address: string;
    } = await request.json();

    // 在庫チェック
    const shortageItems = await checkStock(items);
    if (shortageItems.length > 0) {
      return NextResponse.json({ message: `在庫不足の商品があります：${shortageItems.join('、')}` }, { status: 400 });
    }
   // データベースに保存された商品データを取得
    const productIds = items.map(item => item.id);
    if (productIds.length === 0) {
      return NextResponse.json({ message: '商品が選択されていません。' }, { status: 400 });
    }
    const placeholders = productIds.map(() => '?').join(','); // ?,?,?...
    const products = await executeQuery<{ id: number; name: string; price: number }>(`
      SELECT id, name, price
      FROM products
      WHERE id IN (${placeholders});
    `, productIds); // リストに含まれる商品データをまとめて取得

    if (products.length === 0) {
      return NextResponse.json({ message: '商品が見つかりませんでした。' }, { status: 404 });
    }

    // Stripeのline_itemsを作成
    let totalPrice = 0; // 合計金額
    const line_items = items.map(item => {
      // 合計金額はデータベース情報をもとにサーバー側で計算（改ざん対策）

      const product = products.find(p => p.id === Number(item.id));
      if (!product) throw new Error(`商品ID ${item.id} が見つかりません。`);

      // 商品ごとの小計を求め、合計金額に加算
      const subtotal = product.price * item.quantity;
      totalPrice += subtotal;

      return {
        price_data: {
          currency: 'jpy', // 日本円
          product_data: { name: product.name }, // 商品名
          unit_amount: product.price, // 単価（円）
        },
        quantity: item.quantity, // 数量
      };
    });

    // 送料を追加
    totalPrice += SHIPPING_COST;
    line_items.push({
      price_data: {
        currency: 'jpy', // 日本円
        product_data: { name: '送料' },
        unit_amount: SHIPPING_COST,
      },
      quantity: 1,
    });

    // 認証済みユーザーの取得
    const user: AuthUser | null = await getAuthUser();
    if (!user) {
      return NextResponse.json({ message: '認証されていません。' }, { status: 401 });
    }
    // カート内の価格情報をデータベースの登録内容で上書き（改ざん対策）
    const correctPriceItems = items.map(item => {
      const product = products.find(p => p.id === Number(item.id));
      if (!product) throw new Error(`商品ID ${item.id} が見つかりません。`);
      return { ...item, price: product.price };
    });

    // データベースに注文データを仮登録
    const orderId = await createOrder(user.userId, correctPriceItems, address, totalPrice);

    // StripeのCheckoutセッションを作成
    const checkoutSession = await stripe.checkout.sessions.create({
      line_items: line_items,
      mode: 'payment',
      customer_email: user.email || undefined,
      // 決済成功時のリダイレクト先
      success_url: `${request.nextUrl.origin}/account?session_id={CHECKOUT_SESSION_ID}`,
      // 決済キャンセル時のリダイレクト先
      cancel_url: `${request.nextUrl.origin}/order-confirm`,
      // メタデータ
      metadata: {
        // Webhookで注文を特定できるように注文IDを含める
        orderId: orderId.toString(),
        userId: user.userId.toString()
      }
    });

    // フロントエンドにStripeのURLを返す
    return NextResponse.json({ url: checkoutSession.url }, { status: 200 });
  } catch (err) {
    console.error('注文・決済処理エラー：', err);
    return NextResponse.json({ message: '注文登録または決済処理に失敗しました。' }, { status: 500 });
  }
}