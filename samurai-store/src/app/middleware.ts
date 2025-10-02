import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { AUTH_TOKEN } from '@/lib/auth';

// ログインが必要なページリスト
const authPages = [
  '/account', // マイページ
  '/account/edit', // 会員編集ページ
  '/account/orders', // 注文履歴一覧ページ
  '/account/password', // パスワード変更ページ
  '/account/favorites', // お気に入りページ
  '/order-confirm', // 注文確認ページ
];

// 管理者専用ページリスト
const adminPages = [
  '/admin/products', // 管理者用の商品一覧ページ
  '/admin/products/register', // 管理者用の商品登録ページ
  '/admin/inquiries', // 管理者用のお問い合わせ一覧ページ
];

// リクエスト受信時に実行されるミドルウェア
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 現在のURLパスが、保護ページのいずれかに該当するかチェック
  const isProtected = [...authPages, ...adminPages].some((path) =>
    pathname.startsWith(path)
  );

  // 保護ページでなければリクエストを許可
  if (!isProtected) return NextResponse.next();

  // クッキーからトークン取得
  const token = request.cookies.get(AUTH_TOKEN)?.value;
  if (!token) { // トークンがなければログインページへ
    return redirectToLogin(request);
  }

  // ユーザー情報を取得してトークン検証
  const user = await verifyToken(token);
  if (!user) { // 検証NGならログインページへ
    return redirectToLogin(request);
  }

  // 管理者ページへのリクエストの場合は、管理者権限があるかチェック
  if (adminPages.some((path) => pathname.startsWith(path))) {
    if (!user.isAdmin) { // 管理者権限がなければログインページへ
      return redirectToLogin(request);
    }
  }

  // すべてのチェックを通過：リクエストを許可
  return NextResponse.next();
}

// ログインページへリダイレクト
function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}