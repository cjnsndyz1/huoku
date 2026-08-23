// Supabase 客户端 + 认证
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseConfig {
  url: string
  anonKey: string
}

const CONFIG_KEY = 'biaodaxunlian:supabase-config'

let client: SupabaseClient | null = null

export function loadSupabaseConfig(): SupabaseConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* 忽略 */
  }
  return { url: '', anonKey: '' }
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  } catch {
    /* 忽略 */
  }
}

export function hasSupabaseConfig(): boolean {
  const c = loadSupabaseConfig()
  return c.url.trim() !== '' && c.anonKey.trim() !== ''
}

/** 懒初始化客户端；未配置时抛错 */
export function getClient(): SupabaseClient {
  const config = loadSupabaseConfig()
  if (!config.url.trim() || !config.anonKey.trim()) {
    throw new Error('请先在设置里配置 Supabase')
  }
  if (!client) {
    client = createClient(config.url.trim(), config.anonKey.trim())
  }
  return client
}

/** 配置改变后重置客户端 */
export function resetClient(): void {
  client = null
}

// ── 认证 ──

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getClient().auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signUp(email: string, password: string): Promise<void> {
  const { data, error } = await getClient().auth.signUp({ email, password })
  if (error) throw error
  if (!data.session) {
    throw new Error('注册成功，请查收邮箱完成验证后，再回到这里登录')
  }
}

export async function signOut(): Promise<void> {
  await getClient().auth.signOut()
}

export async function isLoggedIn(): Promise<boolean> {
  if (!hasSupabaseConfig()) return false
  const { data } = await getClient().auth.getSession()
  return !!data.session
}
