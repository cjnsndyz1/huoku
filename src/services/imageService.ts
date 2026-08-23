// 图片云存储：配图存 Supabase Storage（private bucket），按用户文件夹隔离。
// 显示用签名 URL（1 小时有效），保证个人"货"的私密性。

import { getClient } from './supabase'

const BUCKET = 'images'

/** 当前登录用户的文件夹名（uid），未登录抛错 */
async function userFolder(): Promise<string> {
  const { data } = await getClient().auth.getUser()
  const uid = data.user?.id
  if (!uid) throw new Error('请先登录')
  return uid
}

/** 上传压缩图，返回 Storage 路径（{uid}/{uuid}.jpg） */
export async function uploadImage(blob: Blob): Promise<string> {
  const folder = await userFolder()
  const path = `${folder}/${crypto.randomUUID()}.jpg`
  const { error } = await getClient().storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (error) throw error
  return path
}

/** 删除 Storage 里的一张图 */
export async function deleteImage(path: string): Promise<void> {
  const { error } = await getClient().storage.from(BUCKET).remove([path])
  if (error) throw error
}

/** 生成 1 小时有效的签名 URL，失败返回 null */
export async function getSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await getClient().storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error) return null
  return data?.signedUrl ?? null
}
