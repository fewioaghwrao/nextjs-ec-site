'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ContactPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string>('');

  // 共通スタイル
  const inputStyle =
    'w-full border border-gray-300 px-3 py-2 rounded-sm focus:ring-2 focus:ring-indigo-500';
  const labelStyle = 'block font-bold mb-1';
  const badgeStyle =
    'ml-2 px-2 py-0.5 bg-red-500 text-white text-xs font-semibold rounded-md';

  // 送信ハンドラ
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage('');

    const formData = new FormData(e.currentTarget);
    const name = (formData.get('name') as string | null)?.trim() ?? '';
    const email = (formData.get('email') as string | null)?.trim() ?? '';
    const message = (formData.get('message') as string | null)?.trim() ?? '';

    if (!name || !email || !message) {
      setErrorMessage('すべての項目を入力してください。');
      return;
    }

    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });

      if (res.ok) {
        // 成功時：トップへ ?submitted=1 を付けて遷移
        router.push('/?submitted=1');
      } else {
        // 失敗時：APIのエラーメッセージがあれば表示
        const data = await res.json().catch(() => ({}));
        setErrorMessage((data as any).message || '送信に失敗しました。');
      }
    } catch {
      setErrorMessage('通信エラーが発生しました。');
    }
  };

  return (
    <main className="max-w-md mx-auto py-10">
      <Link href="/" className="text-indigo-600 hover:underline">
        ←トップページに戻る
      </Link>

      <h1 className="text-2xl font-bold text-center mb-6">お問い合わせ</h1>

      {errorMessage && (
        <p role="alert" className="text-red-600 text-center mb-4">
          {errorMessage}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="w-full space-y-6 p-8 bg-white shadow-lg rounded-xl"
      >
        <div>
          <label className={labelStyle} htmlFor="name">
            氏名<span className={badgeStyle}>必須</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className={inputStyle}
          />
        </div>

        <div>
          <label className={labelStyle} htmlFor="email">
            メールアドレス<span className={badgeStyle}>必須</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className={inputStyle}
          />
        </div>

        <div>
          <label className={labelStyle} htmlFor="message">
            お問い合わせ内容<span className={badgeStyle}>必須</span>
          </label>
          <textarea
            id="message"
            name="message"
            required
            className={`${inputStyle} h-32`}
          />
        </div>

        <button
          type="submit"
          className="w-full mt-2 bg-indigo-500 hover:bg-indigo-600 text-white py-2 rounded-sm"
        >
          送信
        </button>
      </form>
    </main>
  );
}
