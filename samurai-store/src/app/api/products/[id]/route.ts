import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { writeFile, rm } from 'fs/promises';
import { executeQuery } from '@/lib/db'; // DB共通モジュール
import { type ProductData } from '@/types/product';

// 商品データの型定義
type Product = ProductData; // 基本型から変更なし

// 指定IDの商品データを取得
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // URLのパラメータからIDを取得
  const { id } = await context.params;

  // IDを数値に変換
  const productId = parseInt(id, 10);

  try { // DBから商品データを取得
    const result = await executeQuery<Product>(
      'SELECT * FROM products WHERE id = ?;',
      [productId]
    );

    // 指定IDの商品が見つからなかった場合
    if (result.length === 0) {
      return NextResponse.json(
        { message: '商品が見つかりませんでした。' },
        { status: 404 }
      );
    }

    // 取得した商品データを返却
    return NextResponse.json(result[0]);
  } catch (err) {
    console.error('商品取得エラー：', err);
    return NextResponse.json(
      { message: 'サーバーエラーが発生しました。' },
      { status: 500 }
    );
  }
  
}

// 指定IDの商品データを更新
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // URLのパラメータからIDを取得
  const { id } = await context.params;

  // IDを数値に変換
  const productId = parseInt(id, 10);

  try {
    // 既存の商品データを取得（存在確認）
    const existing = await executeQuery<Product>(
      'SELECT * FROM products WHERE id = ?;',
      [productId]
    );
    if (existing.length === 0) {
      return NextResponse.json(
        { message: '商品が見つかりませんでした。' },
        { status: 404 }
      );
    }
    const currentProduct = existing[0]; // 現状の商品データを取得

    // 画像ファイルを含むフォームデータを取得
    const formData = await request.formData();
    const name = formData.get('name')?.toString().trim() || '';
    const file = formData.get('imageFile') as File | null;
    const description = formData.get('description')?.toString().trim() || '商品の説明がありません。';
    const price = Number(formData.get('price'));
    const stock = Number(formData.get('stock'));
    const isFeatured = formData.get('isFeatured') === 'on';

    // 入力値のバリデーション（画像ファイルなしは許容）
    if (!name?.trim() || isNaN(price) || isNaN(stock)) {
      return NextResponse.json({ message: '必須項目が不足しています。' }, { status: 400 });
    }

    // 新旧の画像ファイル名
    const oldFileName = currentProduct.image_url;
    let newFileName = oldFileName; // 暫定的に既存ファイル名

    // 新しい画像ファイルがアップロードされた場合
    if (file && file.size > 0) {
      // 拡張子を安全に取得
      const ext = file.name.split('.').pop();
      if (!ext || !['jpg', 'jpeg', 'png'].includes(ext.toLowerCase())) {
        return NextResponse.json({ message: '対応していないファイル形式です。' }, { status: 400 });
      }

      // 重複しないファイル名を生成
      const timestamp = Date.now(); // 現在の日付
      const random = Math.floor(Math.random() * 10000); // 0～9999の乱数
      newFileName = `${timestamp}_${random}.${ext}`;

      // 保存先のファイルパスを構築
      const newFilePath = path.join(process.cwd(), 'public/uploads', newFileName);

      // 新しいファイルを保存
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(newFilePath, buffer);

      // 既存の画像ファイルがあれば削除
      if (oldFileName) {
        const oldFilePath = path.join(process.cwd(), 'public/uploads', oldFileName);
        try { // ファイルを削除
          await rm(oldFilePath);
        } catch (err) {
          console.error('画像ファイル削除エラー：', err);
        }
      }
    }

    // 商品情報をproductsテーブルで更新
    await executeQuery(`
      UPDATE products
      SET name = ?, image_url = ?, description = ?, price = ?, stock = ?, is_featured = ?
      WHERE id = ?;
    `, [name, newFileName ?? null, description, price, stock, isFeatured ? 1 : 0, productId]);

    return NextResponse.json({ message: '商品を編集しました。' }, { status: 200 });
  } catch (err) {
    console.error('商品更新エラー：', err);
    return NextResponse.json({ message: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}

// 指定IDの商品データを削除
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // URLのパラメータからIDを取得
  const { id } = await context.params;

  // IDを数値に変換
  const productId = parseInt(id, 10);

  try {
    // 既存の商品データを取得（存在確認）
    const existing = await executeQuery<Product>(
      'SELECT * FROM products WHERE id = ?;',
      [productId]
    );
    if (existing.length === 0) {
      return NextResponse.json(
        { message: '商品が見つかりませんでした。' },
        { status: 404 }
      );
    }
    const currentProduct = existing[0]; // 現状の商品データを取得

    // 画像ファイルがあれば削除
    if (currentProduct.image_url) {
      const filePath = path.join(process.cwd(), 'public/uploads', currentProduct.image_url);
      try { // ファイルを削除
        await rm(filePath);
      } catch (err) {
        console.error('画像ファイル削除エラー：', err);
      }
    }

    // DBから商品を削除
    await executeQuery(
      'DELETE FROM products WHERE id = ?;',
      [productId]
    );

    return NextResponse.json({ message: '商品を削除しました。' }, { status: 200 });
  } catch (err) {
    console.error('商品削除エラー：', err);
    return NextResponse.json(
      { message: 'サーバーエラーが発生しました。' },
      { status: 500 }
    );
  }
}