# Supabase 認証設定ガイド

## Supabase Dashboardでの設定

### 1. Email認証の有効化

1. **Supabase Dashboardにアクセス**
   ```
   https://supabase.com/dashboard/project/ibvucbwkdnqtlagwfpvd
   ```

2. **Authentication > Providers に移動**
   - 左サイドバーから「Authentication」をクリック
   - 「Providers」タブをクリック

3. **Email Providerを有効化**
   - 「Email」をクリック
   - 「Enable Email provider」をONにする
   - 「Confirm email」をOFFにする (開発用 - 本番ではONを推奨)
   - 「Save」をクリック

### 2. Email Templatesの設定 (オプション)

開発環境では確認メールをスキップするため、以下の設定を行います:

1. **Authentication > Email Templates に移動**

2. **Confirm signupテンプレートを編集**
   - デフォルトのままでOK
   - または、開発用に簡素化

### 3. URL Configurationの設定

1. **Authentication > URL Configuration に移動**

2. **Site URLを設定**
   ```
   http://localhost:3000
   ```

3. **Redirect URLsに追加**
   ```
   http://localhost:3000/**
   ```

## 開発時の注意点

### メール確認をスキップする設定

開発効率化のため、以下の設定を行うことを推奨します:

1. **Authentication > Providers > Email**
   - 「Confirm email」をOFFにする

2. これにより、サインアップ後すぐにログインできるようになります

### テスト用ユーザーの作成

手動でテストユーザーを作成する場合:

1. **Authentication > Users に移動**
2. 「Add user」をクリック
3. メールアドレスとパスワードを入力
4. 「Create user」をクリック

または、アプリケーションの `/signup` ページから登録できます。

## 本番環境での設定

本番環境では以下の設定を推奨します:

### 1. Email確認を有効化
- 「Confirm email」をONにする
- Email Templatesをカスタマイズ

### 2. Site URLを本番URLに変更
```
https://your-domain.com
```

### 3. Redirect URLsを制限
```
https://your-domain.com/**
```

### 4. Rate Limitingの設定
- Authentication > Rate Limits
- 適切なレート制限を設定

## トラブルシューティング

### サインアップ時に「Email not confirmed」エラー
→ 「Confirm email」設定をOFFにしてください

### リダイレクトエラー
→ URL Configurationで正しいURLが設定されているか確認してください

### 認証後にリダイレクトされない
→ middleware.tsの設定を確認してください
