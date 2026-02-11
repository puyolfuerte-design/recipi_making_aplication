'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase-server'
import { getCurrentUser } from './auth'
import { z } from 'zod'

export type TagResult = {
  success: boolean
  error?: string
  tag?: {
    id: string
    name: string
  }
}

// バリデーションスキーマ
const createTagSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'タグ名を入力してください' })
    .max(50, { message: 'タグ名は50文字以内で入力してください' }),
})

/**
 * タグを作成
 */
export async function createTag(name: string): Promise<TagResult> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      success: false,
      error: 'ログインが必要です',
    }
  }

  // バリデーション
  const validationResult = createTagSchema.safeParse({ name })
  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error.issues[0].message,
    }
  }

  const supabase = await createClient()

  // 同名タグの重複チェック
  const { data: existingTag } = await supabase
    .from('tags')
    .select('id')
    .eq('user_id', user.id)
    .eq('name', name.trim())
    .single()

  if (existingTag) {
    return {
      success: false,
      error: 'このタグは既に存在します',
    }
  }

  // タグ作成
  const { data: tag, error } = await supabase
    .from('tags')
    .insert({
      user_id: user.id,
      name: name.trim(),
    })
    .select()
    .single()

  if (error) {
    console.error('タグ作成エラー:', error)
    return {
      success: false,
      error: 'タグの作成に失敗しました',
    }
  }

  revalidatePath('/')
  return {
    success: true,
    tag: {
      id: tag.id,
      name: tag.name,
    },
  }
}

/**
 * タグ一覧を取得
 */
export async function getTags() {
  const user = await getCurrentUser()
  if (!user) {
    return []
  }

  const supabase = await createClient()

  const { data: tags, error } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (error) {
    console.error('タグ取得エラー:', error)
    return []
  }

  return tags
}

/**
 * タグを削除
 */
export async function deleteTag(tagId: string): Promise<TagResult> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      success: false,
      error: 'ログインが必要です',
    }
  }

  const supabase = await createClient()

  // 先にrecipe_tagsから関連を削除
  await supabase.from('recipe_tags').delete().eq('tag_id', tagId)

  // タグを削除
  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('id', tagId)
    .eq('user_id', user.id)

  if (error) {
    console.error('タグ削除エラー:', error)
    return {
      success: false,
      error: 'タグの削除に失敗しました',
    }
  }

  revalidatePath('/')
  return {
    success: true,
  }
}

/**
 * レシピにタグを追加
 */
export async function addTagToRecipe(
  recipeId: string,
  tagId: string
): Promise<TagResult> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      success: false,
      error: 'ログインが必要です',
    }
  }

  const supabase = await createClient()

  // レシピの所有者確認
  const { data: recipe } = await supabase
    .from('recipes')
    .select('id')
    .eq('id', recipeId)
    .eq('user_id', user.id)
    .single()

  if (!recipe) {
    return {
      success: false,
      error: 'レシピが見つかりません',
    }
  }

  // タグの所有者確認
  const { data: tag } = await supabase
    .from('tags')
    .select('id')
    .eq('id', tagId)
    .eq('user_id', user.id)
    .single()

  if (!tag) {
    return {
      success: false,
      error: 'タグが見つかりません',
    }
  }

  // 関連追加
  const { error } = await supabase.from('recipe_tags').insert({
    recipe_id: recipeId,
    tag_id: tagId,
  })

  if (error) {
    // 重複エラーは無視
    if (error.code === '23505') {
      return { success: true }
    }
    console.error('タグ追加エラー:', error)
    return {
      success: false,
      error: 'タグの追加に失敗しました',
    }
  }

  revalidatePath('/')
  return {
    success: true,
  }
}

/**
 * レシピからタグを削除
 * どのレシピにも紐づかなくなったタグはマスタから自動削除する
 */
export async function removeTagFromRecipe(
  recipeId: string,
  tagId: string
): Promise<TagResult> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      success: false,
      error: 'ログインが必要です',
    }
  }

  const supabase = await createClient()

  // 1. レシピからタグの紐付けを削除
  const { error } = await supabase
    .from('recipe_tags')
    .delete()
    .eq('recipe_id', recipeId)
    .eq('tag_id', tagId)

  if (error) {
    console.error('タグ削除エラー:', error)
    return {
      success: false,
      error: 'タグの削除に失敗しました',
    }
  }

  // 2. このタグが他のレシピで使われているか確認
  const { count } = await supabase
    .from('recipe_tags')
    .select('*', { count: 'exact', head: true })
    .eq('tag_id', tagId)

  // 3. どこにも使われていなければタグマスタから削除
  if (count === 0) {
    await supabase
      .from('tags')
      .delete()
      .eq('id', tagId)
      .eq('user_id', user.id)
  }

  revalidatePath('/')
  return {
    success: true,
  }
}

/**
 * レシピのタグを取得
 */
export async function getRecipeTags(recipeId: string) {
  const user = await getCurrentUser()
  if (!user) {
    return []
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('recipe_tags')
    .select('tag_id, tags(id, name)')
    .eq('recipe_id', recipeId)

  if (error) {
    console.error('レシピタグ取得エラー:', error)
    return []
  }

  return data.map((item) => item.tags).filter(Boolean)
}
