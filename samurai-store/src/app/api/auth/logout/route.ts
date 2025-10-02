import { NextResponse } from 'next/server';

// JWTのクッキー名
const JWT_COOKIE = 'authToken';

// ログアウト処理
export async function POST() {
  try {
    // トップページへリダイレクト
    const response = NextResponse.redirect(
      new URL('/?logged-out=1', process.env.BASE_URL)
    );

    // クッキーを削除
    response.cookies.delete({
      name: JWT_COOKIE,
      path: '/', // ログイン時に設定したパスと一致させる
    });

    return response;
  } catch (error) {
    console.error('ログアウトAPIエラー：', error);
    return NextResponse.json({ message: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}