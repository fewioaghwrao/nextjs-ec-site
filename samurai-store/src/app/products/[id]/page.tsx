// app/products/[id]/page.tsx
import React from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { type ProductData } from '@/types/product';
import { type ReviewsResponse } from '@/types/review';
import { isLoggedIn } from '@/lib/auth';
import { cookies } from 'next/headers';

import CartControls from '@/app/products/[id]/CartControls';
import ReviewControls from '@/app/products/[id]/ReviewControls';
import FavoriteControls from '@/app/products/[id]/FavoriteControls';

type Product = ProductData;

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

/** ★ API経由でお気に入り状態を取得 */
async function getFavoriteExistsViaApi(productId: string): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('authToken')?.value;
    const headers: HeadersInit = token ? { Cookie: `authToken=${token}` } : {};

    const res = await fetch(`${process.env.BASE_URL}/api/favorites/${productId}`, {
      cache: 'no-store',
      headers,
    });

    if (!res.ok) return false;
    const json = await res.json();
    return Boolean(json?.exists);
  } catch (e) {
    console.error('favorite fetch error:', e);
    return false;
  }
}

async function getProduct(id: string): Promise<Product | null> {
  try {
    const res = await fetch(`${process.env.BASE_URL}/api/products/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('商品取得エラー：', err);
    return null;
  }
}

async function getReviews(id: string): Promise<ReviewsResponse | []> {
  const res = await fetch(`${process.env.BASE_URL}/api/products/${id}/reviews`, { cache: 'no-store' });
  if (!res.ok) return [];
  return await res.json();
}

function displayStars(avgRating: number) {
  const rating = Math.round(avgRating);
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

export default async function ProductDetailPage(props: ProductDetailPageProps) {
  const resolvedParams = await props.params;
  const productId = resolvedParams.id;

  const loggedIn = await isLoggedIn();

  // ★ 並列取得：商品／レビュー／お気に入り状態(API) を同時取得
  const [product, reviewsResponse, initialIsFavorite] = await Promise.all([
    getProduct(productId),
    getReviews(productId),
    loggedIn ? getFavoriteExistsViaApi(productId) : Promise.resolve(false),
  ]);

  if (!product) {
    notFound();
  }

  const reviews = Array.isArray(reviewsResponse) ? [] : reviewsResponse.reviews;
  const rating = Array.isArray(reviewsResponse) ? 0 : reviewsResponse.review_avg;
  const reviewCount = Array.isArray(reviewsResponse) ? 0 : reviewsResponse.pagination.totalItems;

  const stock = product.stock ?? 0;

  let stockText = '売り切れ';
  let stockStyle = 'text-red-600';
  if (stock > 10) {
    stockText = '在庫あり';
    stockStyle = 'text-green-600';
  } else if (stock > 0) {
    stockText = '在庫わずか';
    stockStyle = 'text-orange-500';
  }

  const finalImageUrl = product.image_url ? `/uploads/${product.image_url}` : '/images/no-image.jpg';

  return (
    <main className="container mx-auto px-4 py-8">
      {/* ↓↓↓ 以降のHTML構造は一切変更なし ↓↓↓ */}
      <div className="flex flex-col md:flex-row gap-8">
        <Image
          src={finalImageUrl}
          alt={product.name || '商品画像'}
          width={800}
          height={800}
          className="w-full object-contain md:w-1/2 max-h-[600px]"
        />
        <div className="w-full md:w-1/2 space-y-6 pt-4">
          <h1>{product.name}</h1>
          <p className="text-gray-700 whitespace-pre-line">{product.description}</p>
          <p className="text-3xl font-bold text-indigo-600">
            ¥{product.price.toLocaleString()}
            <span className="text-base font-normal text-gray-500">（税込）</span>
          </p>

          {reviewCount > 0 ? (
            <div className="flex items-center mb-4">
              <span className="text-yellow-500 text-xl mr-2">{displayStars(rating)}</span>
              <span className="text-gray-700 text-base">{rating.toFixed(1)}</span>
              <span className="text-gray-500 text-sm ml-2">（レビュー{reviewCount}件）</span>
            </div>
          ) : (
            <p className="text-gray-500 text-sm mb-4">まだレビューがありません</p>
          )}

          <p className={`text-base font-medium ${stockStyle}`}>在庫状況：{stockText}</p>

          <div className="space-y-6 mt-8">
            {stock > 0 && (
              <CartControls
                cartItem={{
                  id: product.id.toString(),
                  title: product.name,
                  price: product.price,
                  imageUrl: product.image_url ?? '',
                }}
                stock={stock}
                loggedIn={loggedIn}
              />
            )}

            {loggedIn && (
              <FavoriteControls
                productId={product.id}
                initialIsFavorite={initialIsFavorite}
                loggedIn={loggedIn}
                className="text-teal-800 hover:underline"
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8 mt-6 p-4 border border-gray-300 rounded-md shadow-sm">
        <div className="w-full md:w-1/2">
          <h2 className="mt-2">レビュー一覧</h2>
          {reviewCount > 0 ? (
            <ul className="space-y-4 list-none">
              {reviews.slice(0, 3).map((r) => (
                <li key={r.id} className="border-b border-gray-300 pb-2">
                  <div className="flex items-center text-sm text-yellow-500 mb-1">{displayStars(r.score)}</div>
                  <p className="text-gray-800">{r.content}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {r.user_name} さん {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </li>
              ))}
              {reviewCount > 3 && (
                <div className="text-center mt-4">
                  <Link href={`/products/${productId}/reviews`} className="text-indigo-600 hover:underline">
                    すべてのレビューを見る（{reviewCount}件）
                  </Link>
                </div>
              )}
            </ul>
          ) : (
            <p className="text-gray-500">まだレビューがありません。</p>
          )}
        </div>

        <div className="w-full md:w-1/2 border-l border-gray-200 pl-6">
          <ReviewControls productId={product.id} loggedIn={loggedIn} />
        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-gray-200">
        <Link href="/products" className="text-indigo-600 hover:underline">
          ← 商品一覧に戻る
        </Link>
      </div>
    </main>
  );
}
