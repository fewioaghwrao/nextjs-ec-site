import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { updateOrder } from '@/app/api/orders/orderService';

// 環境変数からStripeシークレットキーとWebhookシークレットを取得
const SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!SECRET_KEY) throw new Error('環境変数STRIPE_SECRET_KEYが設定されていません。');
if (!STRIPE_WEBHOOK_SECRET) throw new Error('環境変数STRIPE_WEBHOOK_SECRETが設定されていません。');

// Stripe初期化
const stripe = new Stripe(SECRET_KEY, {
  apiVersion: '2025-09-30.clover', // 最新のAPIバージョンを指定
});

// Webhookイベントの処理
export async function POST(request: NextRequest) {
  const requestBody = await request.text();
  // Stripeからの署名データ
  const signature = request.headers.get('stripe-signature') as string;
  // Stripeのイベントオブジェクト
  let event: Stripe.Event;

  try { // Webhookからの決済完了イベントを待つ
    event = stripe.webhooks.constructEvent(
      requestBody,
      signature ?? '',
      STRIPE_WEBHOOK_SECRET ?? ''
    );
  } catch (err) {
    console.error('Webhook署名検証エラー：', err);
    return NextResponse.json({ message: 'Webhook署名検証に失敗しました。' }, { status: 400 });
  }

  // Checkoutセッション完了イベントの場合
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    // 注文IDとユーザーIDはmetadataに含まれている前提
    const orderId = session.metadata?.orderId;
    const userId: string = session.metadata?.userId ?? '';
    if (!orderId || !userId) {
      console.error('WebhookにorderIdまたはuserIdが含まれていません。');
      return NextResponse.json({ message: '注文情報が不正です。' }, { status: 400 });
    }

    try { // 注文データを本登録（注文ステータス：処理中、決済ステータス：決済成功）
      await updateOrder(Number(userId), Number(orderId), '処理中', '決済成功');
    } catch (err) {
      console.error('注文ステータス更新エラー：', err);
      return NextResponse.json({ message: '注文ステータス更新に失敗しました。' }, { status: 500 });
    }
  }

  // Webhookの受信を通知（処理成功/失敗にかかわらず送る）
  return NextResponse.json({ received: true }, { status: 200 });
}