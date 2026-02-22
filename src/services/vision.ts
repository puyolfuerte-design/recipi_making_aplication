'use server'

import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export type ExtractedRecipeData = {
  title: string
  description: string
  ingredients: string
  instructions: string
  memo: string
}

export type VisionResult = {
  success: boolean
  error?: string
  data?: ExtractedRecipeData
}

/**
 * 画像からレシピ情報を抽出
 * @param imageDataUrl Base64エンコードされた画像データ (Data URL形式)
 * @returns 抽出されたレシピ情報
 */
export async function extractRecipeFromImage(
  imageDataUrl: string
): Promise<VisionResult> {
  try {
    // Data URLのバリデーション
    if (!imageDataUrl.startsWith('data:image/')) {
      return {
        success: false,
        error: '有効な画像データではありません',
      }
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `あなたはレシピ画像からテキスト情報を抽出する専門家です。
画像内のレシピ情報を正確に読み取り、JSON形式で返してください。

重要なルール:
- 画像から読み取れる情報のみを抽出してください
- 推測や補完は一切行わないでください
- 読み取れない項目は必ず空文字列("")にしてください
- テキストは可能な限り元の表記を保ってください

JSONフォーマット:
{
  "title": "レシピのタイトル（読み取れない場合は空文字列）",
  "description": "レシピの説明や概要（読み取れない場合は空文字列）",
  "ingredients": "材料リスト（1行ずつ改行で区切る。読み取れない場合は空文字列）",
  "instructions": "調理手順（1行ずつ改行で区切る。読み取れない場合は空文字列）",
  "memo": "その他のメモや注意事項（読み取れない場合は空文字列）"
}`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'この画像からレシピ情報を抽出してください。',
            },
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl,
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return {
        success: false,
        error: 'レシピ情報を抽出できませんでした',
      }
    }

    // JSONパース
    const extractedData = JSON.parse(content) as ExtractedRecipeData

    // 基本的なバリデーション
    if (!extractedData.title && !extractedData.ingredients && !extractedData.instructions) {
      return {
        success: false,
        error: '画像からレシピ情報を読み取れませんでした',
      }
    }

    return {
      success: true,
      data: {
        title: extractedData.title || '',
        description: extractedData.description || '',
        ingredients: extractedData.ingredients || '',
        instructions: extractedData.instructions || '',
        memo: extractedData.memo || '',
      },
    }
  } catch (error) {
    console.error('Vision API エラー:', error)
    return {
      success: false,
      error: '画像の解析中にエラーが発生しました',
    }
  }
}
