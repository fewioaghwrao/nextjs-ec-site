import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { executeQuery } from '@/lib/db';
import { generateToken } from '@/lib/jwt';

// JWTのクッキー名
const JWT_COOKIE = 'authToken';

// ログイン処理
export async function POST(request: NextRequest) {
  try {
    // リクエストボディからメールアドレスとパスワードを取得
    const { email, password } = await request.json();

    // 未入力チェック
    if (!email?.trim() || !password?.trim()) {
      return NextResponse.json({ message: 'メールアドレスとパスワードを入力してください。' }, { status: 400 });
    }

    // 入力されたメールアドレスに一致するユーザーを検索
    const users = await executeQuery<{ id: number; name: string; email: string; password: string; is_admin: boolean }>(
      'SELECT * FROM users WHERE email = ? AND enabled = TRUE',
      [email]
    );

    const user = users[0];
    if (!user) { // 該当ユーザーが存在しない
      return NextResponse.json({ message: 'メールアドレスまたはパスワードが違います。' }, { status: 401 });
    }

    // パスワード比較
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return NextResponse.json({ message: 'メールアドレスまたはパスワードが違います。' }, { status: 401 });
    }

    // 認証成功
    // トークンを生成（使いたいユーザー情報をペイロードに含める）
    const token = await generateToken({
      userId: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.is_admin
    });

    const response = NextResponse.json({
      message: 'ログイン成功',
      isAdmin: user.is_admin
    });
    // レスポンスのクッキー設定
    response.cookies.set({
      name: JWT_COOKIE,
      value: token,
      httpOnly: true, // JavaScriptからのアクセスを禁止（XSS対策）
      // secureは本番環境のみtrueにする
      secure: process.env.NODE_ENV === 'production', // 暗号化されたHTTPSでのみ送信（盗聴リスク低減）
      sameSite: 'strict', // 別サイトからのリクエスト時にクッキーを送信しない（CSRF対策）
      // maxAgeは秒単位
      maxAge: 60 * 60, // 有効期限（1時間）
      path: '/', // 全てのパスでクッキーを利用可能にする
    });

    return response; // クッキーを設定したレスポンスを返す
  } catch (error) {
    console.error('ログインAPIエラー：', error);
    return NextResponse.json({ message: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}