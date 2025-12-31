# recipi_making_aplication
1. プロジェクト概要
個人向けレシピ管理アプリ「Recipe Stock」を開発する。 点在するレシピサイトのURL、あるいは手動入力によるレシピを一元管理し、タグで整理・検索できるWebアプリ。
2. 技術スタック & アーキテクチャ原則
以下の構成でプロジェクトを初期化し、開発を進めること。
* Framework: Next.js (App Router)
    * 原則: 常に Server Components (RSC) をデフォルトとし、インタラクション(Form, Button等)が必要な末端のコンポーネントのみ 'use client' を適用すること。
* Styling: Tailwind CSS, shadcn/ui
    * 原則: shadcn/ui はプロジェクト内にコードを「所有」する。適宜コンポーネントをカスタマイズして使用すること。
* Database/Auth: Supabase (PostgreSQL)
    * 原則: Row Level Security (RLS) を必須とする。全てのテーブルに対して、適切な policy を設定するSQLを生成すること。
* Deployment: Vercel (環境変数は .env.local と Vercel Dashboard で同期)
* Main Library: lucide-react (icons), open-graph-scraper (OGP取得), zod (バリデーション)
3. 実装の優先順位とロードマップ
Step 1: プロジェクト初期化 & 共通基盤
* Next.js プロジェクトの作成。
* shadcn/ui の導入と、基本パーツ(Button, Card, Input, Toast)のセットアップ。
* Supabase クライアントの初期化(Server/Client両対応)。
* .env.example の作成と、型安全な環境変数アクセスの定義。
Step 2: 堅牢なデータベース設計
以下のテーブルを作成するSQLを生成・実行せよ。必ず全てのテーブルに RLS を設定し、他人のデータが読み書きできないようにすること。
* profiles: ユーザープロフィール(id: uuid references auth.users, display_name, avatar_url)
* recipes: レシピ本体(id, user_id references profiles, title, url, image_url, description, memo, is_manual, created_at)
* tags: タグマスタ(id, user_id, name)
* recipe_tags: 中間テーブル(recipe_id, tag_id)
* INDEXの作成: 検索性を考慮し、user_id や created_at に適切なインデックスを貼ること。
Step 3: 認証基盤 (Supabase Auth)
* Email/Passwordによるサインアップ・ログイン。
* 開発効率のため、テスト用ユーザーの自動承認設定(または手順)を提示すること。
* middleware.ts を実装し、未認証ユーザーを強制的に LP/Login へリダイレクトするガードを構築すること。
Step 4: OGP取得 & レシピ登録ロジック
* Server Actions: URLを受け取り、open-graph-scraper を用いてタイトルと画像を取得するアクションを実装。
* Error Handling: スクレイピング失敗時の代替プレースホルダー(No Image)処理と、ユーザーへのエラー通知(Toast)を実装すること。
* Validation: zod を用い、URLの形式や必須入力項目のバリデーションをサーバー/クライアント両側で行うこと。
4. 遵守事項・品質基準
1. TypeScript: any の使用は厳禁。Supabase の型定義を生成し、データベース操作を型安全に行うこと。
2. UI/UX: ローディング状態(Skeleton screens)と、エラー境界(error.tsx)を適切に配置すること。
3. 保守性: コンポーネントは機能単位で components/features や components/ui に適切に分割せよ。
4. Security: Supabase Service Role Key は絶対にクライアントサイドで使用せず、常に anon key と RLS で保護すること。

---

# 開発履歴

## ✅ Step 1: プロジェクト初期化 & 共通基盤 (完了)

### 1. Next.jsプロジェクトのセットアップ
**実施日**: 2025-12-31

**実施内容**:
- Next.js 16.1.1 (App Router) プロジェクトを初期化
- TypeScript strict mode有効化
- Tailwind CSS v4導入
- ESLint設定完了

**コマンド**:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

**ディレクトリ構成**:
```
src/
├── app/              # Next.js App Router (ルーティング & ページ)
├── components/
│   ├── ui/          # shadcn/ui基本コンポーネント
│   └── features/    # ドメイン固有コンポーネント (レシピ関連など)
├── lib/             # 共通ユーティリティ & Supabaseクライアント
├── services/        # Server Actions & スクレイピングロジック
└── types/           # TypeScript型定義 (Supabase生成型含む)
```

### 2. shadcn/uiのセットアップ
**実施内容**:
- shadcn/ui初期化
- 基本UIコンポーネントのインストール

**インストール済みコンポーネント**:
- `button` - ボタン
- `card` - カード
- `input` - 入力フィールド
- `sonner` - トースト通知 (Toast代替)

**コマンド**:
```bash
npx shadcn@latest init -d
npx shadcn@latest add button card input sonner
```

**ファイル**:
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/sonner.tsx`
- `src/lib/utils.ts` (shadcn共通ユーティリティ)

### 3. Supabaseクライアントの初期化
**実施内容**:
- `@supabase/ssr`および`@supabase/supabase-js`のインストール
- Server/Client両対応のSupabaseクライアント作成

**インストールコマンド**:
```bash
npm install @supabase/ssr @supabase/supabase-js
```

**作成ファイル**:
- `src/lib/supabase.ts` - Client Component用クライアント
- `src/lib/supabase-server.ts` - Server Component用クライアント

**特徴**:
- Client: `createBrowserClient`使用
- Server: `createServerClient`でCookie経由のセッション管理
- 両方とも型安全な環境変数経由で認証情報を取得

### 4. 追加ライブラリのインストール
**実施内容**:
```bash
npm install lucide-react open-graph-scraper zod
```

**ライブラリ用途**:
- `lucide-react` - アイコンライブラリ
- `open-graph-scraper` - OGP(Open Graph Protocol)メタデータ取得
- `zod` - スキーマバリデーション

### 5. 環境変数の型安全設定
**実施内容**:
- `.env.example`テンプレート作成
- Zodスキーマで環境変数をバリデーション

**作成ファイル**:
- `.env.example` - 環境変数テンプレート
- `.env.local` - 実際の環境変数 (gitignore済み)
- `src/lib/env.ts` - 型安全な環境変数アクセス

**env.tsの仕組み**:
```typescript
// zodで環境変数をバリデーション
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
})

export const env = envSchema.parse({...})
```

### 6. Supabase疎通確認
**実施内容**:
- 接続テストスクリプトの作成
- Supabase Authとの疎通確認

**作成ファイル**:
- `scripts/test-supabase-connection.ts` - 接続テストスクリプト

**実行方法**:
```bash
npm run test:supabase
```

**接続先情報**:
- URL: `https://ibvucbwkdnqtlagwfpvd.supabase.co`
- 認証: Anon Key使用
- 状態: ✅ 正常接続確認済み

**package.json追加スクリプト**:
```json
{
  "scripts": {
    "test:supabase": "tsx scripts/test-supabase-connection.ts"
  }
}
```

### トラブルシューティング
**問題**: `npm run build`実行時に`Error: Cannot find module '../server/require-hook'`エラー

**原因**: `node_modules/.bin/next`が破損していた

**解決方法**:
```bash
rm node_modules/.bin/next
ln -s ../next/dist/bin/next node_modules/.bin/next
```

---

## 🔄 次のステップ: Step 2 - 堅牢なデータベース設計

**実施予定内容**:
1. Supabaseデータベースにテーブル作成SQL実行
2. RLS (Row Level Security) ポリシー設定
3. インデックス作成
4. Supabase型定義の生成 (`npm run update-types`)
