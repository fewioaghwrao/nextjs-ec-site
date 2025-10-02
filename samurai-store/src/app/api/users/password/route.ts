import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';
import { getAuthUser, type AuthUser } from '@/lib/auth';
import bcrypt from 'bcrypt';

// ユーザーのパスワードを変更
export async function PUT(request: NextRequest) {
  try {
    const user: AuthUser | null = await getAuthUser();
    if (!user) {
      return NextResponse.json({ message: 'ログインしてください。' }, { status: 401 });
    }

    // リクエストに含まれる各データを取得
    const { oldPassword, newPassword } = await request.json();

    // 未入力チェック
    if (!oldPassword?.trim() || !newPassword?.trim()) {
      return NextResponse.json({ message: 'すべての項目を入力してください。' }, { status: 400 });
    }

    // 新しいパスワードの文字数チェック
    if (newPassword.length < 8) {
      return NextResponse.json({ message: 'パスワードは8文字以上で入力してください。' }, { status: 400 });
    }

    // 現在のパスワードを取得
    const result = await executeQuery<{ password: string }>(
      'SELECT password FROM users WHERE id = ?',
      [user.userId]
    );
    const oldHashed = result[0]?.password;
    if (!oldHashed) {
      return NextResponse.json({ message: 'ユーザー情報が見つかりません。' }, { status: 404 });
    }

    // 現在のパスワードが正しいかチェック
    const passwordMatch = await bcrypt.compare(oldPassword, oldHashed);
    if (!passwordMatch) {
      return NextResponse.json({ message: '現在のパスワードが正しくありません。' }, { status: 400 });
    }

    // 新しいパスワードをハッシュ化して更新
    const newHashed = await bcrypt.hash(newPassword, 10);
    await executeQuery(
      'UPDATE users SET password = ? WHERE id = ?',
      [newHashed, user.userId]
    );

    return NextResponse.json({ message: 'パスワードを変更しました。' });
  } catch (err) {
    console.error('パスワード変更エラー：', err);
    return NextResponse.json({ message: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}