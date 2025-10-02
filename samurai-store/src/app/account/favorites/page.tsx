'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart } from '@/hooks/useCart';

// お気に入り商品の型定義（表示に必要な最終形）
type FavoriteProduct = {
  favorite_id: number;
  product_id: number;
  product_name: string;
  product_price: number;
  product_image_url: string | null;
  product_stock: number;
  created_at: string;
};

// /api/favorites の素データ想定
type FavoriteRow = {
  id: number;
  product_id: number;
  created_at: string;
};

export default function FavoritesPage() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // お気に入り一覧を取得
  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const res = await fetch('/api/favorites', {
          credentials: 'include',
          cache: 'no-store',
        });

        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login');
            return;
          }
          throw new Error('お気に入りの取得に失敗しました');
        }

        const data: { data: FavoriteRow[] } = await res.json();

        // 各商品情報を取得して表示用の形に整形
        const favoritesWithProducts = await Promise.all(
          data.data.map(async (fav) => {
            const productRes = await fetch(`/api/products/${fav.product_id}`, {
              cache: 'no-store',
            });
            if (!productRes.ok) return null;

            const product = await productRes.json();
            return {
              favorite_id: fav.id,
              product_id: fav.product_id,
              product_name: product.name as string,
              product_price: product.price as number,
              product_image_url: (product.image_url as string | null) ?? null,
              product_stock: (product.stock as number) ?? 0,
              created_at: fav.created_at,
            } satisfies FavoriteProduct;
          })
        );

        setFavorites(favoritesWithProducts.filter(Boolean) as FavoriteProduct[]);
      } catch (err) {
        console.error('Fetch favorites error:', err);
        setError(err instanceof Error ? err.message : 'エラーが発生しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFavorites();
  }, [router]);

  if (isLoading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-red-600">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      {/* マイページへ戻るリンク */}
      <div className="mb-4">
        <Link href="/account" className="text-indigo-600 hover:underline">
          ← マイページへ戻る
        </Link>
      </div>

      {/* ページタイトル */}
      <h1 className="text-3xl font-bold mb-8">お気に入り一覧</h1>

      {/* お気に入り商品がない場合 */}
      {favorites.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">お気に入りに登録された商品がありません。</p>
          <Link href="/products" className="text-indigo-600 hover:underline">
            商品一覧を見る
          </Link>
        </div>
      ) : (
        /* お気に入り商品一覧 */
        <div className="space-y-4">
          {favorites.map((favorite) => (
            <FavoriteItemCard
              key={favorite.favorite_id}
              favorite={favorite}
              onRemove={(productId) => {
                setFavorites((prev) => prev.filter((f) => f.product_id !== productId));
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}

// ============================================
// お気に入り商品カードコンポーネント（useCart形式）
// ============================================

type FavoriteItemCardProps = {
  favorite: FavoriteProduct;
  onRemove: (productId: number) => void;
};

function FavoriteItemCard({ favorite, onRemove }: FavoriteItemCardProps) {
  const [isRemoving, setIsRemoving] = useState(false);

  // ProductCard と同じ形式：useCart を使用
  const { addItem, isInCart } = useCart();

  // isInCart は string ID 前提のことが多いので揃える
  const cartId = String(favorite.product_id);
  const inCart = isInCart(cartId);

  // 画像の指定がなければダミー画像を表示（ProductCard と同じ発想）
  const rawImageUrl = favorite.product_image_url ?? undefined;
  const finalImageUrl = rawImageUrl ? `/uploads/${rawImageUrl}` : '/images/no-image.jpg';

  // カートに追加（/api/cart は使わず、useCart に寄せる）
  const handleCart = () => {
    if (inCart || favorite.product_stock <= 0) return;
    addItem({
      id: cartId,
      title: favorite.product_name,
      price: favorite.product_price,
      imageUrl: rawImageUrl, // ProductCard と同じく“ファイル名 or 相対”を渡す想定
    });
  };

  // お気に入り解除
  const handleRemoveFavorite = async () => {
    const confirmed = confirm('本当にお気に入りから削除しますか？');
    if (!confirmed) return;

    setIsRemoving(true);
    try {
      const res = await fetch(`/api/favorites/${favorite.product_id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('お気に入り解除に失敗しました');
      }

      onRemove(favorite.product_id);
    } catch (error) {
      console.error('Remove favorite error:', error);
      alert(error instanceof Error ? error.message : 'お気に入り解除に失敗しました');
      setIsRemoving(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4">
      {/* 商品画像 */}
      <Link href={`/products/${favorite.product_id}`} className="flex-shrink-0">
        <Image
          src={finalImageUrl}
          alt={favorite.product_name}
          width={120}
          height={120}
          className="w-[120px] h-[120px] object-contain"
        />
      </Link>

      {/* 商品情報エリア */}
      <div className="flex-grow">
        {/* 商品名 */}
        <h3 className="text-lg font-semibold mb-2">
          <Link href={`/products/${favorite.product_id}`} className="hover:text-indigo-600">
            {favorite.product_name}
          </Link>
        </h3>

        {/* 価格 */}
        <p className="text-xl font-bold text-indigo-600">
          ¥{favorite.product_price.toLocaleString()}
        </p>

        {/* 在庫表示 */}
        {favorite.product_stock <= 0 && (
          <p className="text-red-600 text-sm mt-1">売り切れ</p>
        )}
      </div>

 {/* ボタンエリア */}
<div className="flex-shrink-0 space-y-2 w-40">
  {/* カートに追加ボタン */}
  <button
    onClick={!inCart && favorite.product_stock > 0 ? handleCart : undefined}
    disabled={inCart || favorite.product_stock <= 0}
    className={`w-full border py-2 px-4 rounded-sm
      ${inCart
        ? 'bg-indigo-500 text-white'
        : favorite.product_stock <= 0
        ? 'border-gray-300 text-gray-400 cursor-not-allowed'
        : 'border-indigo-500 text-indigo-500 hover:bg-indigo-400 hover:text-white'
      }`}
  >
    {inCart ? '追加済み' : favorite.product_stock <= 0 ? '在庫なし' : 'カートに追加'}
  </button>

  {/* お気に入り解除ボタン */}
  <button
    onClick={handleRemoveFavorite}
    disabled={isRemoving}
    className="w-full px-4 py-2 border border-red-500 text-red-500 rounded font-medium hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {isRemoving ? '削除中...' : 'お気に入り解除'}
  </button>
</div>
    </div>
  );
}
