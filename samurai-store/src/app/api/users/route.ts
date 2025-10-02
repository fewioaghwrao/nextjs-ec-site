import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db'; // DB共通モジュール
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