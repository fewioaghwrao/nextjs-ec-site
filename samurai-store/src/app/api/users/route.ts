import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db'; // DB共通モジュール
import { getAuthUser, type AuthUser, AUTH_TOKEN } from '@/lib/auth';
import { generateToken } from '@/lib/jwt';
import bcrypt from 'bcrypt';

// 新規ユーザーのデータを登録
export async function POST(request: NextRequest) {
  try {
    // リクエストに含まれる各データを取得
    const { name, email, password } = await request.json();

    // 未入力チェック
    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return NextResponse.json({ message: 'すべての項目を入力してください。' }, { status: 400 });
    }

    // メールアドレスの入力形式チェック（使える記号は.と@のみとする）
    const emailPattern = /^[a-zA-Z0-9.]+@[a-zA-Z0-9.]+$/;
    if (!emailPattern.test(email)) {
      return NextResponse.json({ message: '正しいメールアドレスの形式で入力してください。' }, { status: 400 });
    }

    // メールアドレスの重複チェック
    const existingUser = await executeQuery<{ count: number }>(
      'SELECT COUNT(*) AS count FROM users WHERE email = ?',
      [email]
    );
    if (existingUser[0]?.count > 0) { // 同じメールアドレスの登録あり
      return NextResponse.json({ message: 'このメールアドレスは既に登録されています。' }, { status: 400 });
    }

    // パスワードの文字数チェック
    if (password.length < 8) {
      return NextResponse.json({ message: 'パスワードは8文字以上で入力してください。' }, { status: 400 });
    }

    // パスワードをハッシュ化
    const hashed = await bcrypt.hash(password, 10);

    // ユーザー情報をusersテーブルに追加（一般ユーザーとして登録）
    await executeQuery(`
      INSERT INTO users (name, email, password, is_admin, enabled)
      VALUES (?, ?, ?, false, true);
      `, [name, email, hashed]
    );

    return NextResponse.json({ message: '会員登録が完了しました。' });
  } catch (err) {
    console.error('会員登録エラー：', err);
    return NextResponse.json({ message: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}

// ユーザー情報の更新（氏名とメールアドレスのみ）
export async function PUT(request: NextRequest) {
  try {
    const user: AuthUser | null = await getAuthUser();
    if (!user) {
      return NextResponse.json({ message: 'ログインしてください。' }, { status: 401 });
    }

    // リクエストに含まれる各データを取得
    const { name, email } = await request.json();

    // 未入力チェック
    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ message: 'すべての項目を入力してください。' }, { status: 400 });
    }

    // メールアドレスの入力形式チェック（使える記号は.と@のみとする）
    const emailPattern = /^[a-zA-Z0-9.]+@[a-zA-Z0-9.]+$/;
    if (!emailPattern.test(email)) {
      return NextResponse.json({ message: '正しいメールアドレスの形式で入力してください。' }, { status: 400 });
    }

    // メールアドレスの重複チェック（自分自身は除外）
    const existingUser = await executeQuery<{ count: number }>(
      'SELECT COUNT(*) AS count FROM users WHERE email = ? AND id != ?',
      [email, user.userId]
    );
    if (existingUser[0]?.count > 0) {
      return NextResponse.json({ message: 'このメールアドレスは既に使用されています。' }, { status: 400 });
    }

    // ユーザー情報を更新
    await executeQuery(
      'UPDATE users SET name = ?, email = ? WHERE id = ?;',
      [name, email, user.userId]
    );

    // 更新後のユーザー情報でJWTトークンを再発行
    const newToken = await generateToken({
      userId: user.userId,
      name,
      email,
      isAdmin: user.isAdmin
    });

    const response = NextResponse.json({ message: '会員情報を編集しました。' });
    // レスポンスのクッキー設定
    response.cookies.set({
      name: AUTH_TOKEN,
      value: newToken,
      httpOnly: true, // JavaScriptからのアクセスを禁止（XSS対策）
      // secureは本番環境のみtrueにする
      secure: process.env.NODE_ENV === 'production', // 暗号化されたHTTPSでのみ送信（盗聴リスク低減）
      sameSite: 'strict', // 別サイトからのリクエスト時にクッキーを送信しない（CSRF対策）
      // maxAgeは秒単位
      maxAge: 60 * 60, // 有効期限（1時間）
      path: '/', // 全てのパスでクッキーを利用可能にする
    });

    return response; // クッキーを設定したレスポンスを返す
  } catch (err) {
    console.error('会員情報更新エラー：', err);
    return NextResponse.json({ message: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}