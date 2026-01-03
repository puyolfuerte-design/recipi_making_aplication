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

## ✅ Step 2: 堅牢なデータベース設計 (完了)

### 1. データベーススキーマSQL作成
**実施日**: 2025-12-31

**作成ファイル**:
- `supabase/migrations/001_initial_schema.sql` - データベーススキーマSQL
- `supabase/README.md` - SQL実行手順書

**テーブル構成**:
```
auth.users (Supabase Auth)
    │
    ├─→ profiles (ユーザープロフィール)
    │    ├─ id (UUID, PK, FK to auth.users)
    │    ├─ display_name (TEXT)
    │    ├─ avatar_url (TEXT)
    │    ├─ created_at (TIMESTAMPTZ)
    │    └─ updated_at (TIMESTAMPTZ)
    │
    ├─→ recipes (レシピ本体)
    │    ├─ id (UUID, PK)
    │    ├─ user_id (UUID, FK to profiles)
    │    ├─ title (TEXT, NOT NULL)
    │    ├─ url (TEXT)
    │    ├─ image_url (TEXT)
    │    ├─ description (TEXT)
    │    ├─ memo (TEXT)
    │    ├─ is_manual (BOOLEAN)
    │    ├─ created_at (TIMESTAMPTZ)
    │    └─ updated_at (TIMESTAMPTZ)
    │
    └─→ tags (タグマスタ)
         ├─ id (UUID, PK)
         ├─ user_id (UUID, FK to profiles)
         ├─ name (TEXT, NOT NULL)
         └─ created_at (TIMESTAMPTZ)

recipe_tags (中間テーブル)
    ├─ recipe_id (UUID, FK to recipes, PK)
    ├─ tag_id (UUID, FK to tags, PK)
    └─ created_at (TIMESTAMPTZ)
```

### 2. Row Level Security (RLS) 設定
**実施内容**:
全テーブルでRLSを有効化し、`auth.uid()`でユーザーデータを分離

**RLSポリシー**:
- ✅ **profiles**: 自分のプロフィールのみ読み書き可能
  - `Users can view their own profile` (SELECT)
  - `Users can insert their own profile` (INSERT)
  - `Users can update their own profile` (UPDATE)

- ✅ **recipes**: 自分のレシピのみ読み書き可能
  - `Users can view their own recipes` (SELECT)
  - `Users can insert their own recipes` (INSERT)
  - `Users can update their own recipes` (UPDATE)
  - `Users can delete their own recipes` (DELETE)

- ✅ **tags**: 自分のタグのみ読み書き可能
  - `Users can view their own tags` (SELECT)
  - `Users can insert their own tags` (INSERT)
  - `Users can update their own tags` (UPDATE)
  - `Users can delete their own tags` (DELETE)

- ✅ **recipe_tags**: 自分のレシピに紐づくタグのみ操作可能
  - `Users can view their own recipe tags` (SELECT)
  - `Users can insert their own recipe tags` (INSERT)
  - `Users can delete their own recipe tags` (DELETE)

### 3. インデックス作成
**パフォーマンス最適化のため以下のインデックスを作成**:

**recipesテーブル**:
- `idx_recipes_user_id` - user_id検索
- `idx_recipes_created_at` - 作成日時降順
- `idx_recipes_user_created` - user_id + created_at複合インデックス

**tagsテーブル**:
- `idx_tags_user_id` - user_id検索
- `idx_tags_name` - タグ名検索

**recipe_tagsテーブル**:
- `idx_recipe_tags_recipe_id` - recipe_id検索
- `idx_recipe_tags_tag_id` - tag_id検索

### 4. データベーストリガー
**自動化機能**:

1. **新規ユーザー登録時のプロフィール自動作成**
   ```sql
   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW
     EXECUTE FUNCTION public.handle_new_user();
   ```
   - auth.usersに新規ユーザーが作成されると、自動的にprofilesレコードを作成
   - display_nameはメールアドレスの@前部分をデフォルト値として使用

2. **タイムスタンプ自動更新**
   ```sql
   CREATE TRIGGER update_profiles_updated_at
     BEFORE UPDATE ON public.profiles
     FOR EACH ROW
     EXECUTE FUNCTION update_updated_at_column();
   ```
   - profiles, recipesテーブルのupdated_atを自動更新

### 5. TypeScript型定義の生成
**実施内容**:
```bash
npm run update-types
```

**生成ファイル**:
- `src/types/supabase.ts` - Supabase型定義

**型定義の適用**:
- `src/lib/supabase.ts` - `createBrowserClient<Database>`
- `src/lib/supabase-server.ts` - `createServerClient<Database>`

**利点**:
- データベース操作の型安全性を確保
- IDEの補完が効くようになる
- `any`を使用せずに開発可能

### 6. 動作確認
**テストスクリプト作成**:
- `scripts/test-database-schema.ts` - データベーススキーマ確認テスト

**実行方法**:
```bash
npm run test:db
```

**テスト結果**:
```
✅ profilesテーブル: 正常
✅ recipesテーブル: 正常
✅ tagsテーブル: 正常
✅ recipe_tagsテーブル: 正常
```

### package.json追加スクリプト
```json
{
  "scripts": {
    "test:db": "tsx scripts/test-database-schema.ts",
    "update-types": "npx supabase gen types typescript --project-id ibvucbwkdnqtlagwfpvd > src/types/supabase.ts"
  }
}
```

---

## ✅ Step 3: 認証基盤 (Supabase Auth) (完了)

### 1. 認証用Server Actionsの作成
**実施日**: 2025-12-31

**作成ファイル**:
- `src/services/auth.ts` - 認証ロジック (Server Actions)

**実装機能**:
- ✅ `signUp()` - ユーザー登録
- ✅ `signIn()` - ログイン
- ✅ `signOut()` - ログアウト
- ✅ `getCurrentUser()` - 現在のユーザー情報取得

**特徴**:
- Zodによるバリデーション (Zod v4対応)
- Server Actionsでサーバーサイド実行
- 型安全なエラーハンドリング

### 2. 認証フォームコンポーネントの作成

**作成ファイル**:
- `src/components/features/auth/auth-form.tsx` - 認証フォームコンポーネント

**特徴**:
- Client Componentとして実装
- `useActionState`でServer Actionsと連携
- ログイン/サインアップ両対応
- リアルタイムバリデーション
- ローディング状態の表示

### 3. 認証ページの作成

**作成ファイル**:
- `src/app/login/page.tsx` - ログインページ
- `src/app/signup/page.tsx` - 新規登録ページ
- `src/app/page.tsx` - ホームページ (認証後)

**機能**:
- ✅ ログインフォーム
- ✅ 新規登録フォーム
- ✅ ページ間リンク
- ✅ 認証済みユーザー情報表示
- ✅ ログアウトボタン

### 4. Middleware実装 (認証ガード)

**作成ファイル**:
- `src/middleware.ts` - 認証ミドルウェア

**機能**:
- ✅ 未認証ユーザーを `/login` にリダイレクト
- ✅ 認証済みユーザーは認証ページにアクセス不可
- ✅ Cookie経由のセッション管理
- ✅ 静的ファイルは除外

**保護対象**:
- `/` (ホームページ) - 認証必須
- その他の全ページ - 認証必須 (login, signup以外)

**除外対象**:
- `/login` - 誰でもアクセス可
- `/signup` - 誰でもアクセス可
- 静的ファイル (画像, CSS等)

### 5. Supabase認証設定

**ドキュメント作成**:
- `docs/supabase-auth-setup.md` - Supabase認証設定ガイド

**必要な設定** (Supabase Dashboard):
1. **Email Providerの有効化**
   - Authentication > Providers > Email
   - 「Enable Email provider」をON

2. **開発環境向け設定**
   - 「Confirm email」をOFF (メール確認スキップ)
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/**`

3. **本番環境向け設定**
   - 「Confirm email」をON
   - Site URL: 本番ドメイン
   - Rate Limitingの設定

### 6. 動作確認

**ビルドテスト**:
```bash
npm run build
```
✅ ビルド成功

**開発サーバー起動**:
```bash
npm run dev
```

**動作確認手順**:
1. `http://localhost:3000` にアクセス → `/login` にリダイレクト
2. `/signup` で新規ユーザー登録
3. 登録後、自動的にログインして `/` にリダイレクト
4. ユーザー情報が表示される
5. ログアウトボタンで `/login` にリダイレクト

### トラブルシューティング

**問題**: Zod v4でバリデーションエラー
- **原因**: `error.errors` → `error.issues` に変更
- **解決**: `validationResult.error.issues[0]` を使用

**問題**: middleware警告 ("middleware" convention is deprecated)
- **状況**: Next.js 16.1.1の警告 (動作には影響なし)
- **対応**: 将来的に "proxy" に移行予定

---

## 🔄 Step 4: OGP取得 & レシピ登録ロジック (進行中)

### 1. OGP取得機能の実装
**実施日**: 2026-01-01

**作成ファイル**:
- `src/services/ogp.ts` - OGP取得Server Action

**実装内容**:
- ✅ `fetchOGP()` - URLからOGP情報を取得
  - open-graph-scraperを使用
  - タイトル、説明、画像URLを抽出
  - エラーハンドリング実装

**OGP取得対象**:
```typescript
{
  title: string        // og:title または dc:title
  description?: string // og:description
  image?: string      // og:image または twitter:image
  url: string         // 元のURL
}
```

**エラー処理**:
- URLバリデーション失敗 → null返却
- OGP取得失敗 → null返却 (コンソールエラー出力)

### 2. レシピ管理Server Actionsの実装

**作成ファイル**:
- `src/services/recipes.ts` - レシピCRUD操作

**実装機能**:

#### ✅ レシピ登録 (URL自動取得)
```typescript
createRecipeFromURL(formData: FormData): Promise<RecipeResult>
```
- URLからOGP情報を自動取得
- recipesテーブルに登録 (`is_manual: false`)
- メモの追加可能

#### ✅ レシピ登録 (手動入力)
```typescript
createRecipeManually(formData: FormData): Promise<RecipeResult>
```
- タイトル、説明、メモを手動入力
- recipesテーブルに登録 (`is_manual: true`)

#### ✅ レシピ一覧取得
```typescript
getRecipes(): Promise<Recipe[]>
```
- 認証ユーザーのレシピのみ取得
- 作成日時降順でソート
- タグ情報も同時に取得 (recipe_tags JOIN)

#### ✅ レシピ削除
```typescript
deleteRecipe(recipeId: string): Promise<RecipeResult>
```
- 自分のレシピのみ削除可能 (RLSで保護)

**バリデーション**:
- Zodによるスキーマバリデーション
- URLフォーマット検証
- 必須項目チェック

**セキュリティ**:
- `getCurrentUser()`で認証チェック
- RLSで自動的にuser_idフィルタリング
- 他人のレシピは操作不可

### 3. タグ管理Server Actionsの実装

**作成ファイル**:
- `src/services/tags.ts` - タグCRUD操作

**実装機能**:
- ✅ `createTag()` - 新規タグ作成
- ✅ `getTags()` - タグ一覧取得
- ✅ `deleteTag()` - タグ削除
- ✅ `addTagToRecipe()` - レシピにタグを追加
- ✅ `removeTagFromRecipe()` - レシピからタグを削除
- ✅ `getRecipeTags()` - レシピのタグを取得

### 4. レシピ登録UIの実装

**作成ファイル**:
- `src/components/features/recipe/recipe-form.tsx` - レシピ登録フォーム

**機能**:
- ✅ URLから追加モード
  - URLプレビュー機能 (OGP情報表示)
  - 画像サムネイル表示
  - メモ入力欄
- ✅ 手動入力モード
  - タイトル、説明、メモ入力
- ✅ トースト通知 (成功/エラー)
- ✅ ローディング状態表示

### 5. レシピ一覧UIの実装

**作成ファイル**:
- `src/components/features/recipe/recipe-card.tsx` - レシピカード
- `src/components/features/recipe/recipe-list.tsx` - レシピ一覧
- `src/components/features/recipe/recipe-skeleton.tsx` - スケルトンローダー
- `src/components/features/recipe/index.ts` - エクスポート

**機能**:
- ✅ レシピカード表示 (画像、タイトル、説明、メモ)
- ✅ URL/手動バッジ表示
- ✅ 削除機能 (確認ダイアログ付き)
- ✅ 外部リンク (レシピ元サイトへ)
- ✅ スケルトンローディング
- ✅ 空状態の表示

### 6. ホームページの更新

**更新ファイル**:
- `src/app/page.tsx` - メインページ
- `src/app/layout.tsx` - レイアウト (Toaster追加)

**機能**:
- ✅ ヘッダー (ユーザー情報、ログアウトボタン)
- ✅ レシピ登録フォーム
- ✅ レシピ一覧表示 (Suspenseでストリーミング)
- ✅ トースト通知機能

### 7. 追加shadcn/uiコンポーネント

**インストール済み**:
```bash
npx shadcn@latest add badge
```
- `src/components/ui/badge.tsx` - バッジコンポーネント

### 8. タグ管理UIの実装
**実施日**: 2026-01-03

**作成ファイル**:
- `src/components/features/recipe/tag-manager.tsx` - タグ管理コンポーネント
- `src/components/features/recipe/tag-filter.tsx` - タグフィルターコンポーネント

**機能**:
- ✅ レシピカードにタグ表示
- ✅ レシピへのタグ追加/削除
- ✅ 新規タグの作成
- ✅ タグによるレシピフィルタリング

### 9. 実装状況

**完了:**
- ✅ OGP取得機能 (Server Action)
- ✅ レシピCRUD Server Actions
- ✅ タグCRUD Server Actions
- ✅ レシピ登録フォームコンポーネント (UI)
- ✅ レシピ一覧表示コンポーネント (UI)
- ✅ ホームページ更新
- ✅ タグ管理UIコンポーネント
- ✅ タグフィルタリング機能

---

## ✅ Step 4: OGP取得 & レシピ登録ロジック (完了)

**ビルドテスト**: 2026-01-03
```bash
npm run build
```
✅ ビルド成功

---

## 📊 現在の実装状況サマリー

### 完了済み機能

| Step | 機能 | 状態 |
|------|------|------|
| Step 1 | プロジェクト初期化 & 共通基盤 | ✅ 完了 |
| Step 2 | データベース設計 & RLS | ✅ 完了 |
| Step 3 | 認証基盤 (Supabase Auth) | ✅ 完了 |
| Step 4 | OGP取得 & レシピ登録 | ✅ 完了 |

### ファイル構成 (Step 4完了時点)

```
src/
├── app/
│   ├── layout.tsx          # Toaster追加
│   ├── page.tsx            # ホームページ (レシピ一覧)
│   ├── login/page.tsx
│   └── signup/page.tsx
├── components/
│   ├── ui/
│   │   ├── badge.tsx       # 新規追加
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   └── sonner.tsx
│   └── features/
│       ├── auth/
│       │   └── auth-form.tsx
│       └── recipe/
│           ├── index.ts
│           ├── recipe-form.tsx
│           ├── recipe-card.tsx
│           ├── recipe-list.tsx
│           ├── recipe-skeleton.tsx
│           ├── tag-manager.tsx    # 新規追加
│           └── tag-filter.tsx     # 新規追加
├── services/
│   ├── auth.ts
│   ├── ogp.ts
│   ├── recipes.ts
│   └── tags.ts
└── ...
```

### 利用可能なコマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# Supabase接続テスト
npm run test:supabase

# データベーススキーマテスト
npm run test:db

# Supabase型定義更新
npm run update-types
```

---

## 🎉 開発完了

すべてのStep (1〜4) が完了しました。

### 実装済み機能一覧

1. **認証機能**
   - Email/Passwordによるサインアップ・ログイン
   - 認証ガード (middleware)
   - ログアウト

2. **レシピ管理**
   - URLからOGP情報を自動取得して登録
   - 手動でのレシピ登録
   - レシピ一覧表示 (カード形式)
   - レシピ削除

3. **タグ機能**
   - タグの作成・削除
   - レシピへのタグ付け
   - タグによるレシピフィルタリング

4. **UI/UX**
   - スケルトンローディング
   - トースト通知
   - レスポンシブデザイン
