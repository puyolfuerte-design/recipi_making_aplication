'use server'

import { createClient } from '@/lib/supabase-server'
import { getCurrentUser } from './auth'

export type UploadImageResult = {
  success: boolean
  error?: string
  imageUrl?: string
}

/**
 * Base64画像をSupabase Storageにアップロード
 * @param dataUrl Base64エンコードされた画像データ (Data URL形式)
 * @returns アップロードされた画像のパブリックURL
 */
export async function uploadRecipeImage(
  dataUrl: string
): Promise<UploadImageResult> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        error: 'ログインが必要です',
      }
    }

    // Data URLからBase64部分を抽出
    const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!matches) {
      return {
        success: false,
        error: '無効な画像データです',
      }
    }

    const imageType = matches[1]
    const base64Data = matches[2]

    // Base64をBufferに変換
    const buffer = Buffer.from(base64Data, 'base64')

    // ファイル名を生成（ユーザーID + タイムスタンプ + ランダム文字列）
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const fileName = `${user.id}/${timestamp}-${random}.${imageType}`

    const supabase = await createClient()

    // Supabase Storageにアップロード
    const { error: uploadError } = await supabase.storage
      .from('recipe-images')
      .upload(fileName, buffer, {
        contentType: `image/${imageType}`,
        cacheControl: '31536000', // 1年間キャッシュ
        upsert: false,
      })

    if (uploadError) {
      console.error('画像アップロードエラー:', uploadError)
      return {
        success: false,
        error: '画像のアップロードに失敗しました',
      }
    }

    // パブリックURLを取得
    const { data: urlData } = supabase.storage
      .from('recipe-images')
      .getPublicUrl(fileName)

    if (!urlData?.publicUrl) {
      return {
        success: false,
        error: '画像URLの取得に失敗しました',
      }
    }

    return {
      success: true,
      imageUrl: urlData.publicUrl,
    }
  } catch (error) {
    console.error('画像アップロードエラー:', error)
    return {
      success: false,
      error: '画像のアップロード中にエラーが発生しました',
    }
  }
}
