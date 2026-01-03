'use server'

import ogs from 'open-graph-scraper'
import { z } from 'zod'

// OGPデータの型定義
export type OGPData = {
  title: string
  description?: string
  image?: string
  url: string
}

// バリデーションスキーマ
const urlSchema = z.object({
  url: z.string().url({ message: '有効なURLを入力してください' }),
})

/**
 * URLからOGP情報を取得
 */
export async function fetchOGP(url: string): Promise<OGPData | null> {
  // URLバリデーション
  const validationResult = urlSchema.safeParse({ url })
  if (!validationResult.success) {
    return null
  }

  try {
    const { result } = await ogs({ url })

    // OGPデータを抽出
    const ogpData: OGPData = {
      title: result.ogTitle || result.dcTitle || 'タイトルなし',
      description: result.ogDescription || result.dcDescription,
      image: result.ogImage?.[0]?.url || result.twitterImage?.[0]?.url,
      url: validationResult.data.url,
    }

    return ogpData
  } catch (error) {
    console.error('OGP取得エラー:', error)
    return null
  }
}
