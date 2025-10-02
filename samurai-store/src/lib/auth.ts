import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';

// 認証済みユーザーの型定義
export type AuthUser = {
  userId: number;
  name: string;
  email: string;
  isAdmin: boolean;
};

// JWTの認証に用いるトークン名
export const AUTH_TOKEN = 'authToken';

// 認証済みユーザーの情報を取得
export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies(); // クッキーを非同期で取得
  const token = cookieStore.get(AUTH_TOKEN)?.value;
  if (!token) { // トークンが存在しない
    return null;
  }

  // トークン検証結果を取得
  const user = await verifyToken(token) as AuthUser | null;
  return user;
}

// ユーザーがログイン済みかどうかをチェック
export async function isLoggedIn(): Promise<boolean> {
  const user = await getAuthUser();
  return user !== null;
}

// ユーザーが管理者かどうかをチェック
export async function isAdmin(): Promise<boolean> {
  const user = await getAuthUser();
  return user?.isAdmin ?? false;
}