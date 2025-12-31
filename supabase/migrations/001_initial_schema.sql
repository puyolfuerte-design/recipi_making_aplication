-- Recipe Stock Database Schema
-- 作成日: 2025-12-31
-- 説明: レシピ管理アプリのためのデータベーススキーマ

-- ============================================
-- 1. profiles テーブル (ユーザープロフィール)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- プロフィール更新時のタイムスタンプ自動更新
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. recipes テーブル (レシピ本体)
-- ============================================
CREATE TABLE IF NOT EXISTS public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT,
  image_url TEXT,
  description TEXT,
  memo TEXT,
  is_manual BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 制約: URL入力の場合はis_manual=false、手動入力の場合はis_manual=true
  CONSTRAINT url_or_manual CHECK (
    (url IS NOT NULL AND is_manual = false) OR
    (url IS NULL AND is_manual = true)
  )
);

CREATE TRIGGER update_recipes_updated_at
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. tags テーブル (タグマスタ)
-- ============================================
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ユーザーごとに同じタグ名は重複不可
  CONSTRAINT unique_user_tag UNIQUE (user_id, name)
);

-- ============================================
-- 4. recipe_tags テーブル (中間テーブル)
-- ============================================
CREATE TABLE IF NOT EXISTS public.recipe_tags (
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 主キー: recipe_idとtag_idの組み合わせ
  PRIMARY KEY (recipe_id, tag_id)
);

-- ============================================
-- 5. インデックスの作成
-- ============================================

-- recipes テーブル
CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON public.recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON public.recipes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_user_created ON public.recipes(user_id, created_at DESC);

-- tags テーブル
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON public.tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_name ON public.tags(name);

-- recipe_tags テーブル
CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe_id ON public.recipe_tags(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag_id ON public.recipe_tags(tag_id);

-- ============================================
-- 6. Row Level Security (RLS) の有効化
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_tags ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. RLS ポリシーの設定
-- ============================================

-- profiles テーブル: 自分のプロフィールのみ読み書き可能
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- recipes テーブル: 自分のレシピのみ読み書き可能
CREATE POLICY "Users can view their own recipes"
  ON public.recipes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recipes"
  ON public.recipes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recipes"
  ON public.recipes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recipes"
  ON public.recipes FOR DELETE
  USING (auth.uid() = user_id);

-- tags テーブル: 自分のタグのみ読み書き可能
CREATE POLICY "Users can view their own tags"
  ON public.tags FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tags"
  ON public.tags FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags"
  ON public.tags FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags"
  ON public.tags FOR DELETE
  USING (auth.uid() = user_id);

-- recipe_tags テーブル: 自分のレシピに紐づくタグのみ操作可能
CREATE POLICY "Users can view their own recipe tags"
  ON public.recipe_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes
      WHERE recipes.id = recipe_tags.recipe_id
      AND recipes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own recipe tags"
  ON public.recipe_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.recipes
      WHERE recipes.id = recipe_tags.recipe_id
      AND recipes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own recipe tags"
  ON public.recipe_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.recipes
      WHERE recipes.id = recipe_tags.recipe_id
      AND recipes.user_id = auth.uid()
    )
  );

-- ============================================
-- 8. 新規ユーザー登録時のプロフィール自動作成
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
