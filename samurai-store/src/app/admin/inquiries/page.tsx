import Link from 'next/link';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic'; // ヘッダー参照するので動的に

type Inquiry = {
  id: number;
  name: string;
  email: string;
  message: string;
  created_at: string | null;
};

type InquiriesResponse =
  | Inquiry[]
  | { inquiries?: Inquiry[]; data?: Inquiry[]; items?: Inquiry[]; records?: Inquiry[] };

const pickOne = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const toNumber = (v: string | string[] | undefined, fallback: number) => {
  const s = pickOne(v);
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const extractInquiries = (body: InquiriesResponse): Inquiry[] | null => {
  if (Array.isArray(body)) return body;
  if (Array.isArray((body as any)?.inquiries)) return (body as any).inquiries;
  if (Array.isArray((body as any)?.data)) return (body as any).data;
  if (Array.isArray((body as any)?.items)) return (body as any).items;
  if (Array.isArray((body as any)?.records)) return (body as any).records;
  return null;
};

// 自身の絶対URLを導出
function getBaseUrl() {
  const h = headers();
  if (process.env.BASE_URL) return process.env.BASE_URL;
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  return 'http://localhost:3000';
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const page = toNumber(sp.page, 1);
  const perPage = toNumber(sp.perPage, 20);

  const base = getBaseUrl();
  const apiUrl = new URL('/api/inquiries', base);
  apiUrl.searchParams.set('page', String(page));
  apiUrl.searchParams.set('perPage', String(perPage));

  let res: Response;
  try {
    res = await fetch(apiUrl.toString(), { cache: 'no-store' });
  } catch (e) {
    console.error('fetch に失敗しました:', e, 'URL:', apiUrl.toString());
    return (
      <p className="text-center text-gray-500 text-lg py-10">
        問い合わせデータの取得に失敗しました。
      </p>
    );
  }

  if (!res.ok) {
    console.error('APIエラー:', res.status, res.statusText, 'URL:', apiUrl.toString());
    return (
      <p className="text-center text-gray-500 text-lg py-10">
        問い合わせデータの取得に失敗しました。
      </p>
    );
  }

  let body: InquiriesResponse | null = null;
  try {
    body = (await res.json()) as InquiriesResponse;
  } catch (e) {
    console.error('JSON のパースに失敗しました:', e);
    return (
      <p className="text-center text-gray-500 text-lg py-10">
        問い合わせデータの取得に失敗しました。
      </p>
    );
  }

  const inquiries = body ? extractInquiries(body) : null;
  if (!Array.isArray(inquiries)) {
    console.error('問い合わせデータの形式が不正です。受信ボディ:', body);
    return (
      <p className="text-center text-gray-500 text-lg py-10">
        問い合わせデータの形式が不正です。
      </p>
    );
  }

  const thtd = 'px-5 py-3 border-b border-gray-300';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4">
        <Link href="/admin/products" className="text-blue-600 hover:underline" aria-label="管理者用の商品一覧ページへ戻る">
          ← 商品一覧ページに戻る
        </Link>
      </div>

      <h1 className="text-2xl font-semibold text-center mb-6">お問い合わせ一覧</h1>

      <div className="shadow-lg rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <caption className="sr-only">お問い合わせ一覧</caption>
          <thead>
            <tr className="bg-gray-200 text-gray-700 text-left">
              <th className={thtd}>ID</th>
              <th className={thtd}>氏名</th>
              <th className={thtd}>メールアドレス</th>
              <th className={thtd}>お問い合わせ内容</th>
              <th className={thtd}>送信日時</th>
            </tr>
          </thead>
          <tbody>
            {inquiries.length === 0 ? (
              <tr>
                <td colSpan={5} className={`${thtd} text-center text-gray-500`}>
                  お問い合わせが見つかりませんでした。
                </td>
              </tr>
            ) : (
              inquiries.map((q) => (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className={thtd}>{q.id}</td>
                  <td className={thtd}>{q.name}</td>
                  <td className={thtd}>{q.email}</td>
                  <td className={thtd}>{q.message}</td>
                  <td className={thtd}>
                    {q.created_at
                      ? new Date(q.created_at).toLocaleString('ja-JP', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
