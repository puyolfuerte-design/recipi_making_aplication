'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase-server'
import { getCurrentUser } from './auth'
import { fetchOGP } from './ogp'
import type { Database } from '@/types/supabase'

export type RecipeResult = {
  success: boolean
  error?: string
  recipe?: {
    id: string
    title: string
  }
}

// マイグレーション002が適用されるまでの型拡張（適用後は自動的に上書きされ冗長になるが無害）
type RecipeInsert = Database['public']['Tables']['recipes']['Insert'] & {
  ingredients?: string | null
  instructions?: string | null
}
type RecipeUpdate = Database['public']['Tables']['recipes']['Update'] & {
  ingredients?: string | null
  instructions?: string | null
}

/**
 * URLからOGP情報を取得してプレビュー
 */
export async function previewRecipe(url: string) {
  const ogpData = await fetchOGP(url)

  if (!ogpData) {
    return {
      success: false,
      error: 'レシピ情報を取得できませんでした',
    }
  }

  return {
    success: true,
    data: ogpData,
  }
}

/**
 * レシピを登録 (URL自動取得)
 */
export async function createRecipeFromURL(
  formData: FormData
): Promise<RecipeResult> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      success: false,
      error: 'ログインが必要です',
    }
  }

  const url = formData.get('url') as string
  const memo = formData.get('memo') as string

  // URLバリデーション
  if (!url) {
    return {
      success: false,
      error: 'URLを入力してください',
    }
  }

  // OGP情報取得
  const ogpData = await fetchOGP(url)
  if (!ogpData) {
    return {
      success: false,
      error: 'レシピ情報を取得できませんでした。手動入力をお試しください。',
    }
  }

  // FormDataの値を優先、なければOGP取得値を使用
  const ingredients =
    (formData.get('ingredients') as string)?.trim() ||
    ogpData.ingredients ||
    null
  const instructions =
    (formData.get('instructions') as string)?.trim() ||
    ogpData.instructions ||
    null

  const supabase = await createClient()

  // レシピ登録
  const { data: recipe, error } = await supabase
    .from('recipes')
    .insert({
      user_id: user.id,
      title: ogpData.title,
      url: ogpData.url,
      image_url: ogpData.image,
      description: ogpData.description,
      memo: memo || null,
      is_manual: false,
      ingredients,
      instructions,
    } as RecipeInsert)
    .select()
    .single()

  if (error) {
    console.error('レシピ登録エラー:', error)
    return {
      success: false,
      error: 'レシピの登録に失敗しました',
    }
  }

  revalidatePath('/')
  return {
    success: true,
    recipe: {
      id: recipe.id,
      title: recipe.title,
    },
  }
}

/**
 * レシピを手動登録
 */
export async function createRecipeManually(
  formData: FormData
): Promise<RecipeResult> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      success: false,
      error: 'ログインが必要です',
    }
  }

  const rawData = {
    title: formData.get('title') as string,
    description: formData.get('description') as string,
    memo: formData.get('memo') as string,
    ingredients: (formData.get('ingredients') as string)?.trim() || null,
    instructions: (formData.get('instructions') as string)?.trim() || null,
  }

  // バリデーション
  if (!rawData.title) {
    return {
      success: false,
      error: 'タイトルを入力してください',
    }
  }

  const supabase = await createClient()

  // レシピ登録
  const { data: recipe, error } = await supabase
    .from('recipes')
    .insert({
      user_id: user.id,
      title: rawData.title,
      url: null,
      image_url: null,
      description: rawData.description || null,
      memo: rawData.memo || null,
      is_manual: true,
      ingredients: rawData.ingredients,
      instructions: rawData.instructions,
    } as RecipeInsert)
    .select()
    .single()

  if (error) {
    console.error('レシピ登録エラー:', error)
    return {
      success: false,
      error: 'レシピの登録に失敗しました',
    }
  }

  revalidatePath('/')
  return {
    success: true,
    recipe: {
      id: recipe.id,
      title: recipe.title,
    },
  }
}

/**
 * レシピ一覧を取得
 */
export async function getRecipes() {
  const user = await getCurrentUser()
  if (!user) {
    return []
  }

  const supabase = await createClient()

  const { data: recipes, error } = await supabase
    .from('recipes')
    .select(`
      *,
      recipe_tags(
        tag_id,
        tags(id, name)
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('レシピ取得エラー:', error)
    return []
  }

  return recipes
}

/**
 * レシピを更新
 */
export async function updateRecipe(
  recipeId: string,
  formData: FormData
): Promise<RecipeResult> {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: 'ログインが必要です' }
  }

  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const memo = (formData.get('memo') as string)?.trim() || null
  const ingredients =
    (formData.get('ingredients') as string)?.trim() || null
  const instructions =
    (formData.get('instructions') as string)?.trim() || null

  if (!title) {
    return { success: false, error: 'タイトルを入力してください' }
  }

  const supabase = await createClient()

  const { data: recipe, error } = await supabase
    .from('recipes')
    .update({ title, description, memo, ingredients, instructions } as RecipeUpdate)
    .eq('id', recipeId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('レシピ更新エラー:', error)
    return { success: false, error: 'レシピの更新に失敗しました' }
  }

  revalidatePath('/')
  return { success: true, recipe: { id: recipe.id, title: recipe.title } }
}

/**
 * レシピを削除
 * 削除後に孤児タグ（どのレシピにも紐づかなくなったタグ）を自動削除する
 */
export async function deleteRecipe(recipeId: string): Promise<RecipeResult> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      success: false,
      error: 'ログインが必要です',
    }
  }

  const supabase = await createClient()

  // 1. 削除前に紐づくタグIDを取得
  const { data: recipeTags } = await supabase
    .from('recipe_tags')
    .select('tag_id')
    .eq('recipe_id', recipeId)

  const tagIds = recipeTags?.map((rt) => rt.tag_id) ?? []

  // 2. レシピを削除（recipe_tagsはRLSのCASCADEで連動削除）
  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', recipeId)
    .eq('user_id', user.id)

  if (error) {
    console.error('レシピ削除エラー:', error)
    return {
      success: false,
      error: 'レシピの削除に失敗しました',
    }
  }

  // 3. 各タグの利用カウントを確認し、0ならマスタから削除
  for (const tagId of tagIds) {
    const { count } = await supabase
      .from('recipe_tags')
      .select('*', { count: 'exact', head: true })
      .eq('tag_id', tagId)

    if (count === 0) {
      await supabase
        .from('tags')
        .delete()
        .eq('id', tagId)
        .eq('user_id', user.id)
    }
  }

  revalidatePath('/')
  return {
    success: true,
  }
}
