// DeepSeek 配置存 Supabase user_settings 表，按账号隔离（RLS）。
// 换设备后只需登录，配置自动从云端同步，无需重新填写。
import type { ApiConfig } from './coachService'
import { currentUserId, getClient } from './supabase'

interface UserSettingsRow {
  deepseek_key: string
  model: string
  base_url: string
}

/** 读取当前账号的 DeepSeek 配置；没配置过或未登录返回 null */
export async function loadAiSettings(): Promise<ApiConfig | null> {
  const { data, error } = await getClient()
    .from('user_settings')
    .select('deepseek_key, model, base_url')
    .single()
  if (error || !data) return null
  return {
    baseUrl: (data as UserSettingsRow).base_url,
    apiKey: (data as UserSettingsRow).deepseek_key,
    model: (data as UserSettingsRow).model,
  }
}

/** 保存当前账号的 DeepSeek 配置到云端（按 user_id 隔离） */
export async function saveAiSettings(config: ApiConfig): Promise<void> {
  const uid = await currentUserId()
  if (!uid) throw new Error('未登录，无法保存到云端')
  const { error } = await getClient().from('user_settings').upsert({
    user_id: uid,
    deepseek_key: config.apiKey,
    model: config.model,
    base_url: config.baseUrl,
  })
  if (error) throw error
}
