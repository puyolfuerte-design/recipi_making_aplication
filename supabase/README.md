# Supabase データベース設定

## SQL実行手順

### 方法1: Supabase Dashboard (推奨)

1. **Supabase Dashboardにアクセス**
   - URL: https://supabase.com/dashboard/project/ibvucbwkdnqtlagwfpvd

2. **SQL Editorを開く**
   - 左サイドバーから「SQL Editor」をクリック
   - 「New query」をクリック

3. **SQLファイルの内容を貼り付け**
   - `supabase/migrations/001_initial_schema.sql` の内容をコピー
   - SQL Editorに貼り付け

4. **実行**
   - 右下の「Run」ボタンをクリック
   - 成功メッセージを確認

### 方法2: Supabase CLI (ローカル開発向け)

```bash
# Supabase CLIのインストール (未インストールの場合)
npm install -g supabase

# Supabaseプロジェクトにログイン
supabase login

# プロジェクトにリンク
supabase link --project-ref ibvucbwkdnqtlagwfpvd

# マイグレーション実行
supabase db push
```

## データベーススキーマ概要

### テーブル構成

```
┌─────────────┐
│   auth.users │ (Supabase Auth)
└──────┬──────┘
       │
       ├─────────────────┐
       │                 │
┌──────▼──────┐   ┌─────▼─────┐
│   profiles  │   │  recipes  │
│             │   │           │
│ - id        │   │ - id      │
│ - display   │   │ - user_id │
│ - avatar    │   │ - title   │
└─────────────┘   │ - url     │
                  │ - image   │
                  │ - memo    │
                  └─────┬─────┘
                        │
                  ┌─────▼──────────┐
                  │  recipe_tags   │
                  │                │
                  │ - recipe_id    │
                  │ - tag_id       │
                  └─────┬──────────┘
                        │
                  ┌─────▼─────┐
                  │   tags    │
                  │           │
                  │ - id      │
                  │ - user_id │
                  │ - name    │
                  └───────────┘
```

### RLSポリシー概要

全テーブルにRow Level Security (RLS)が設定されています:

- ✅ **profiles**: 自分のプロフィールのみ読み書き可能
- ✅ **recipes**: 自分のレシピのみ読み書き可能
- ✅ **tags**: 自分のタグのみ読み書き可能
- ✅ **recipe_tags**: 自分のレシピに紐づくタグのみ操作可能

### 自動化機能

1. **新規ユーザー登録時**: auth.usersにユーザーが作成されると、自動的にprofilesテーブルにレコードが作成されます
2. **タイムスタンプ自動更新**: profiles, recipesテーブルの`updated_at`は自動更新されます

## 型定義の生成

SQLを実行した後、TypeScript型定義を生成してください:

```bash
npm run update-types
```

## トラブルシューティング

### エラー: "permission denied for schema public"
→ Supabase Dashboardの「SQL Editor」から実行してください

### エラー: "relation already exists"
→ テーブルがすでに存在します。`DROP TABLE IF EXISTS`を追加するか、既存テーブルを削除してください

### RLSポリシーが適用されない
→ `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` が実行されているか確認してください
