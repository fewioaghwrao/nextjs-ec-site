'use client';

import React, { useState } from 'react';

type FavoriteControlsProps = {
  /** 対象の商品ID */
  productId: number | string;
  /** 初期状態：お気に入り済みなら true、未追加なら false（表示文言の初期値になります） */
  initialIsFavorite: boolean;
  /** ログイン済みか（未ログインならボタンを無効化しておくなどに利用） */
  loggedIn?: boolean;
  /** 見た目調整（任意） */
  className?: string;
};

export default function FavoriteControls({
  productId,
  initialIsFavorite,
  loggedIn = true,
  className = 'text-teal-800 hover:underline text-base',
}: FavoriteControlsProps) {
  const [isFavorite, setIsFavorite] = useState<boolean>(initialIsFavorite);
  const [isPending, setIsPending] = useState<boolean>(false);

  // 表示文言（♥/♡ とテキスト）を現在の状態から決定
  const label = isFavorite ? '♥ お気に入り解除' : '♡ お気に入り追加';

 async function handleToggle() {
  try {
    if (!isFavorite) {
      const res = await fetch('/api/favorites', {
  method: 'POST',
  credentials: 'include', // ← Cookie 同送
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ productId: Number(productId) }),
});

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`お気に入り追加に失敗しました。status=${res.status} ${errText}`);
      }
      setIsFavorite(true);
    } else {
      const res = await fetch(`/api/favorites/${productId}`, {
  method: 'DELETE',
  credentials: 'include', // ← Cookie 同送
});

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`お気に入り解除に失敗しました。status=${res.status} ${errText}`);
      }
      setIsFavorite(false);
    }
  } catch (e) {
    console.error(e);
    alert(e instanceof Error ? e.message : 'お気に入り処理に失敗しました。');
  }
}

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending || !loggedIn}
      className={className}
      // ♥/♡ が小さく見えないようにフォントをサンセリフへ（指示どおり）
      style={{ fontFamily: 'sans-serif' }}
      aria-pressed={isFavorite}
      aria-label={label}
      title={!loggedIn ? 'ログインが必要です' : undefined}
    >
      {label}
    </button>
  );
}
