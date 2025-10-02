import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

// 環境変数から秘密鍵を取得（存在しない場合はエラーにする）
const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY) throw new Error('環境変数JWT_SECRETが設定されていません。');
const secret = new TextEncoder().encode(SECRET_KEY);

// トークンを生成する関数
export function generateToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

// トークンを検証する関数（失敗した場合はnullを返す）
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    return payload;
  } catch (err) {
    console.error('jwtVerify失敗：', err);
    return null;
  }
}