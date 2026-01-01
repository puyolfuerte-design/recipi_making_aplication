# 認証機能 設計仕様書

**作成日**: 2025-12-31
**バージョン**: 1.0
**対象機能**: Email/Password認証、セッション管理

---

## 目次

1. [概要](#概要)
2. [アーキテクチャ](#アーキテクチャ)
3. [データモデル](#データモデル)
4. [認証フロー](#認証フロー)
5. [実装詳細](#実装詳細)
6. [セキュリティ](#セキュリティ)
7. [エラーハンドリング](#エラーハンドリング)
8. [テスト](#テスト)

---

## 概要

### 目的
Recipe Stockアプリケーションにおけるユーザー認証機能を提供する。Email/Passwordによる認証方式を採用し、Supabase Authを認証基盤として利用する。

### 主要機能
- ユーザー登録 (サインアップ)
- ログイン (サインイン)
- ログアウト
- セッション管理
- 未認証ユーザーのアクセス制御

### 技術スタック
- **認証基盤**: Supabase Auth
- **セッション管理**: Cookie (httpOnly, secure)
- **バリデーション**: Zod v4
- **フレームワーク**: Next.js 16.1.1 (App Router, Server Actions)

---

## アーキテクチャ

### システム構成図

```
┌─────────────────────────────────────────────────┐
│  Client (Browser)                               │
│  ┌───────────────────────────────────────┐     │
│  │  React Components                     │     │
│  │  - /login (LoginPage)                 │     │
│  │  - /signup (SignUpPage)               │     │
│  │  - AuthForm (Client Component)        │     │
│  └───────────────────────────────────────┘     │
└─────────────────┬───────────────────────────────┘
                  │ HTTP Request
                  ↓
┌─────────────────────────────────────────────────┐
│  Next.js Server                                 │
│  ┌───────────────────────────────────────┐     │
│  │  Middleware (src/middleware.ts)       │     │
│  │  - 認証チェック                        │     │
│  │  - リダイレクト制御                    │     │
│  └───────────────────────────────────────┘     │
│  ┌───────────────────────────────────────┐     │
│  │  Server Actions (src/services/auth.ts)│     │
│  │  - signUp()                           │     │
│  │  - signIn()                           │     │
│  │  - signOut()                          │     │
│  │  - getCurrentUser()                   │     │
│  └───────────────────────────────────────┘     │
│  ┌───────────────────────────────────────┐     │
│  │  Supabase Client                      │     │
│  │  - src/lib/supabase-server.ts         │     │
│  │  - Cookie管理                         │     │
│  └───────────────────────────────────────┘     │
└─────────────────┬───────────────────────────────┘
                  │ HTTPS
                  ↓
┌─────────────────────────────────────────────────┐
│  Supabase (Cloud)                               │
│  ┌───────────────────────────────────────┐     │
│  │  Auth Service                         │     │
│  │  - auth.users テーブル                 │     │
│  │  - auth.sessions テーブル              │     │
│  │  - JWT発行                            │     │
│  └───────────────────────────────────────┘     │
│  ┌───────────────────────────────────────┐     │
│  │  PostgreSQL Database                  │     │
│  │  - public.profiles テーブル            │     │
│  │  - RLS有効                            │     │
│  └───────────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
```

### ディレクトリ構成

```
src/
├── app/
│   ├── login/
│   │   └── page.tsx              # ログインページ
│   ├── signup/
│   │   └── page.tsx              # サインアップページ
│   └── page.tsx                  # ホームページ (認証後)
├── components/
│   └── features/
│       └── auth/
│           └── auth-form.tsx     # 認証フォームコンポーネント
├── lib/
│   ├── supabase.ts               # Client Component用
│   ├── supabase-server.ts        # Server Component用
│   └── env.ts                    # 環境変数 (型安全)
├── services/
│   └── auth.ts                   # 認証Server Actions
└── middleware.ts                 # 認証ミドルウェア
```

---

## データモデル

### auth.users (Supabase管理)

Supabaseが自動管理する認証ユーザーテーブル。

| カラム名 | 型 | NULL | 説明 |
|---------|-----|------|------|
| id | UUID | NOT NULL | ユーザーID (PK) |
| email | TEXT | NOT NULL | メールアドレス |
| encrypted_password | TEXT | NOT NULL | 暗号化パスワード (bcrypt) |
| email_confirmed_at | TIMESTAMPTZ | NULL | メール確認日時 |
| raw_user_meta_data | JSONB | NULL | カスタムメタデータ |
| created_at | TIMESTAMPTZ | NOT NULL | 作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL | 更新日時 |

**アクセス方法**: Supabase Auth API経由のみ (直接SQL操作不可)

### public.profiles

アプリケーション固有のユーザー情報テーブル。

| カラム名 | 型 | NULL | 制約 | 説明 |
|---------|-----|------|------|------|
| id | UUID | NOT NULL | PK, FK → auth.users(id) | ユーザーID |
| display_name | TEXT | NULL | - | 表示名 |
| avatar_url | TEXT | NULL | - | アバター画像URL |
| created_at | TIMESTAMPTZ | NOT NULL | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | NOT NULL | DEFAULT NOW() | 更新日時 |

**RLSポリシー**:
- `Users can view their own profile`: SELECT (auth.uid() = id)
- `Users can insert their own profile`: INSERT (auth.uid() = id)
- `Users can update their own profile`: UPDATE (auth.uid() = id)

**トリガー**:
```sql
-- 新規ユーザー登録時に自動作成
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### セッション管理

**Cookie情報**:
- 名前: `sb-<project-ref>-auth-token`
- 属性: `httpOnly`, `secure`, `sameSite=lax`
- 有効期間: Supabaseが管理 (デフォルト: 7日間)

---

## 認証フロー

### 1. サインアップフロー

```
┌─────────┐
│ ユーザー │
└────┬────┘
     │ 1. /signup にアクセス
     ↓
┌─────────────────┐
│ SignUpPage      │
│ (Server)        │ 2. AuthForm表示
└────┬────────────┘
     │
     ↓
┌─────────────────┐
│ AuthForm        │
│ (Client)        │ 3. メール/PW入力
└────┬────────────┘
     │ 4. フォーム送信
     ↓
┌─────────────────┐
│ signUp()        │
│ (Server Action) │
│                 │ 5. バリデーション (Zod)
│                 │ 6. Supabase Auth API呼び出し
│                 │    - auth.users にレコード作成
│                 │    - JWT発行
│                 │    - Cookie設定
└────┬────────────┘
     │ 7. トリガー実行
     ↓
┌─────────────────┐
│ handle_new_user │
│ (DB Trigger)    │ 8. public.profiles にレコード作成
└────┬────────────┘
     │ 9. redirect('/')
     ↓
┌─────────────────┐
│ HomePage        │
│ (認証済み)       │ 10. ユーザー情報表示
└─────────────────┘
```

### 2. サインインフロー

```
┌─────────┐
│ ユーザー │
└────┬────┘
     │ 1. /login にアクセス
     ↓
┌─────────────────┐
│ LoginPage       │
│ (Server)        │ 2. AuthForm表示
└────┬────────────┘
     │
     ↓
┌─────────────────┐
│ AuthForm        │
│ (Client)        │ 3. メール/PW入力
└────┬────────────┘
     │ 4. フォーム送信
     ↓
┌─────────────────┐
│ signIn()        │
│ (Server Action) │
│                 │ 5. バリデーション (Zod)
│                 │ 6. Supabase Auth API呼び出し
│                 │    - パスワード検証
│                 │    - auth.sessions にレコード作成
│                 │    - JWT発行
│                 │    - Cookie設定
└────┬────────────┘
     │ 7. redirect('/')
     ↓
┌─────────────────┐
│ HomePage        │
│ (認証済み)       │ 8. ユーザー情報表示
└─────────────────┘
```

### 3. ページアクセス時の認証チェック

```
┌─────────┐
│ ユーザー │
└────┬────┘
     │ 1. ページアクセス
     ↓
┌─────────────────┐
│ Middleware      │
│ (全リクエスト)   │
│                 │ 2. Cookie取得
│                 │ 3. Supabase.auth.getUser()
│                 │ 4. セッション検証
└────┬────────────┘
     │
     ├─ 未認証 & 保護ページ
     │  ↓
     │  redirect('/login')
     │
     ├─ 認証済み & 認証ページ (/login, /signup)
     │  ↓
     │  redirect('/')
     │
     └─ 正常
        ↓
        ページレンダリング
```

---

## 実装詳細

### Server Actions (src/services/auth.ts)

#### signUp()

**シグネチャ**:
```typescript
export async function signUp(formData: FormData): Promise<AuthResult>
```

**処理フロー**:
1. FormDataから入力値を取得
2. Zodスキーマでバリデーション
3. Supabase Auth APIでユーザー登録
4. エラー時は `AuthResult` でエラーメッセージ返却
5. 成功時は `/` にリダイレクト

**バリデーションルール**:
```typescript
const signUpSchema = z.object({
  email: z.string().email({ message: '有効なメールアドレスを入力してください' }),
  password: z.string().min(6, { message: 'パスワードは6文字以上である必要があります' }),
  displayName: z.string().min(1, { message: '表示名を入力してください' }).optional(),
})
```

**Supabase API呼び出し**:
```typescript
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      display_name: displayName || email.split('@')[0],
    },
  },
})
```

#### signIn()

**シグネチャ**:
```typescript
export async function signIn(formData: FormData): Promise<AuthResult>
```

**処理フロー**:
1. FormDataから入力値を取得
2. Zodスキーマでバリデーション
3. Supabase Auth APIで認証
4. エラー時は `AuthResult` でエラーメッセージ返却
5. 成功時は `/` にリダイレクト

**バリデーションルール**:
```typescript
const signInSchema = z.object({
  email: z.string().email({ message: '有効なメールアドレスを入力してください' }),
  password: z.string().min(1, { message: 'パスワードを入力してください' }),
})
```

**Supabase API呼び出し**:
```typescript
const { error } = await supabase.auth.signInWithPassword({
  email,
  password,
})
```

#### signOut()

**シグネチャ**:
```typescript
export async function signOut(): Promise<void>
```

**処理フロー**:
1. Supabase Auth APIでログアウト
2. Cookieを削除
3. `/login` にリダイレクト

#### getCurrentUser()

**シグネチャ**:
```typescript
export async function getCurrentUser(): Promise<User | null>
```

**処理フロー**:
1. Supabase Auth APIでユーザー情報取得
2. `User` オブジェクトを返却

### Middleware (src/middleware.ts)

**役割**: 全リクエストで認証チェックとリダイレクト制御を行う

**処理フロー**:
```typescript
1. リクエストからCookieを取得
2. Supabase Clientを作成 (Cookie付き)
3. supabase.auth.getUser() でセッション検証
4. 未認証 & 保護ページ → /login にリダイレクト
5. 認証済み & 認証ページ → / にリダイレクト
6. それ以外 → そのまま通過
```

**保護対象パス**:
- `/` (ホームページ)
- その他すべて (除外パス以外)

**除外パス**:
- `/login`
- `/signup`
- `/_next/static/*` (静的ファイル)
- `/_next/image/*` (画像最適化)
- `/favicon.ico`
- 画像ファイル (`*.svg`, `*.png`, `*.jpg`, `*.jpeg`, `*.gif`, `*.webp`)

**Matcher設定**:
```typescript
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Client Components

#### AuthForm (src/components/features/auth/auth-form.tsx)

**Props**:
```typescript
type AuthFormProps = {
  mode: 'signin' | 'signup'
}
```

**Hooks**:
```typescript
const [state, formAction, pending] = useActionState<AuthResult, FormData>(
  async (_prevState, formData) => action(formData),
  { success: false }
)
```

**機能**:
- ログイン/サインアップフォームの切り替え
- Server Actionsとの連携
- バリデーションエラー表示
- ローディング状態管理

---

## セキュリティ

### パスワード管理

**暗号化**: bcrypt (Supabaseが自動処理)
- ソルト: 自動生成
- ハッシュ化: サーバー側で実行
- 平文保存: なし

**パスワード要件**:
- 最小長: 6文字
- その他の制約: なし (将来的に追加可能)

### セッション管理

**Cookie設定**:
```
httpOnly: true     # JavaScriptからアクセス不可
secure: true       # HTTPS必須 (本番環境)
sameSite: lax      # CSRF保護
```

**JWT有効期限**:
- アクセストークン: 1時間 (Supabaseデフォルト)
- リフレッシュトークン: 7日間 (Supabaseデフォルト)
- 自動リフレッシュ: Supabase SDKが処理

### Row Level Security (RLS)

**profiles テーブル**:
```sql
-- 自分のプロフィールのみ参照可能
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- 自分のプロフィールのみ作成可能
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 自分のプロフィールのみ更新可能
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

### CSRF保護

**対策**:
1. Server Actionsは自動的にCSRF保護
2. Cookie `sameSite=lax` 設定
3. Supabase SDKがトークン検証

---

## エラーハンドリング

### バリデーションエラー

**処理場所**: Server Actions (Zod)

**エラー例**:
```typescript
{
  success: false,
  error: "有効なメールアドレスを入力してください"
}
```

**ユーザー表示**: `AuthForm` コンポーネントで赤背景で表示

### 認証エラー

**Supabaseから返却されるエラー**:
- `Invalid login credentials` - 認証情報が間違っている
- `Email not confirmed` - メールアドレス未確認
- `User already registered` - 既に登録済み

**エラー表示**:
```tsx
{state.error && (
  <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
    {state.error}
  </div>
)}
```

### ネットワークエラー

**処理**: try-catchでキャッチし、汎用エラーメッセージ表示

**例**:
```typescript
try {
  const { error } = await supabase.auth.signIn(...)
} catch (err) {
  return {
    success: false,
    error: '予期しないエラーが発生しました'
  }
}
```

---

## テスト

### 手動テスト手順

#### 1. サインアップテスト

**前提条件**:
- 開発サーバーが起動している (`npm run dev`)
- Supabase Email Providerが有効
- 「Confirm email」設定がOFF

**手順**:
1. `http://localhost:3000/signup` にアクセス
2. 表示名 (任意)、メールアドレス、パスワード (6文字以上) を入力
3. 「新規登録」ボタンをクリック
4. `/` にリダイレクトされることを確認
5. ユーザー情報 (メールアドレス、ユーザーID) が表示されることを確認
6. Supabase Dashboard (`Authentication > Users`) でユーザーが作成されていることを確認
7. Supabase Dashboard (`Table Editor > profiles`) でプロフィールが作成されていることを確認

**期待結果**:
- ✅ ユーザー登録成功
- ✅ 自動ログイン
- ✅ `/` にリダイレクト
- ✅ auth.users にレコード作成
- ✅ public.profiles にレコード作成

#### 2. サインインテスト

**前提条件**:
- 既にユーザーが登録されている

**手順**:
1. ログアウトボタンをクリック (`/login` にリダイレクト)
2. メールアドレスとパスワードを入力
3. 「ログイン」ボタンをクリック
4. `/` にリダイレクトされることを確認
5. ユーザー情報が表示されることを確認

**期待結果**:
- ✅ ログイン成功
- ✅ `/` にリダイレクト
- ✅ セッション確立

#### 3. 認証ガードテスト

**手順**:
1. ログアウト状態で `http://localhost:3000/` にアクセス
2. `/login` にリダイレクトされることを確認
3. ログイン後、`http://localhost:3000/login` にアクセス
4. `/` にリダイレクトされることを確認

**期待結果**:
- ✅ 未認証時は `/login` にリダイレクト
- ✅ 認証済み時は認証ページにアクセス不可

#### 4. バリデーションテスト

**手順**:
1. 無効なメールアドレスを入力 (例: `test`)
2. 「新規登録」または「ログイン」をクリック
3. エラーメッセージが表示されることを確認
4. 短いパスワード (5文字以下) を入力
5. エラーメッセージが表示されることを確認

**期待結果**:
- ✅ バリデーションエラーが表示される
- ✅ フォーム送信がブロックされる

### 自動テスト (未実装)

**将来的な実装予定**:
- Unit Tests (Vitest)
  - Server Actions (signUp, signIn, signOut)
  - バリデーションスキーマ
- Integration Tests (Playwright)
  - ユーザー登録フロー
  - ログインフロー
  - 認証ガード

---

## 設定

### Supabase Dashboard設定

#### 必須設定

**Authentication > Providers > Email**:
```
☑ Enable Email provider
☐ Confirm email  # 開発環境ではOFF推奨
```

**Authentication > URL Configuration**:
```
Site URL: http://localhost:3000
Redirect URLs: http://localhost:3000/**
```

#### 本番環境向け設定

**Authentication > Providers > Email**:
```
☑ Enable Email provider
☑ Confirm email  # 本番環境ではON
```

**Authentication > URL Configuration**:
```
Site URL: https://your-domain.com
Redirect URLs: https://your-domain.com/**
```

**Authentication > Rate Limits**:
適切なレート制限を設定

### 環境変数 (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=https://ibvucbwkdnqtlagwfpvd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**注意**:
- `.env.local` は `.gitignore` に含まれている
- 本番環境では Vercel Dashboard で設定

---

## トラブルシューティング

### よくある問題

#### 1. "Email not confirmed" エラー

**原因**: Supabaseで「Confirm email」がONになっている

**解決方法**:
1. Supabase Dashboard > Authentication > Providers > Email
2. 「Confirm email」のチェックを外す
3. 「Save」をクリック
4. 既存ユーザーを手動確認、または再登録

#### 2. リダイレクトループ

**原因**: Middlewareの設定ミス、またはCookieが保存されていない

**解決方法**:
1. ブラウザのCookieをクリア
2. `src/middleware.ts` の設定確認
3. 開発サーバー再起動

#### 3. Zod v4バリデーションエラー

**症状**: `error.errors is not defined`

**原因**: Zod v3 → v4でAPIが変更された

**解決方法**:
```typescript
// ❌ Zod v3
validationResult.error.errors[0].message

// ✅ Zod v4
validationResult.error.issues[0]?.message
```

#### 4. Middleware警告 ("middleware" convention is deprecated)

**症状**: ビルド時に警告表示

**影響**: 動作には影響なし (Next.js 16.1.1の警告)

**対応**: 将来的にNext.jsが "proxy" に移行予定

---

## 変更履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|---------|
| 1.0 | 2025-12-31 | 初版作成 |

---

## 関連ドキュメント

- [Supabase認証設定ガイド](../supabase-auth-setup.md)
- [データベース設計仕様書](./database.md) (未作成)
- [README.md](../../README.md)
