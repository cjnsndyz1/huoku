// 统一的数据加载 hook：异步拉取 Supabase 记录，处理配置/登录/错误状态
import { useCallback, useEffect, useState } from 'react'
import type { HuoEntry } from '../types'
import { loadEntries } from '../services/dataService'
import { hasSupabaseConfig, isLoggedIn } from '../services/supabase'

export interface UseEntriesResult {
  entries: HuoEntry[]
  loading: boolean
  error: string
  /** true 表示还没配置 Supabase 或未登录 */
  needsSetup: boolean
  refresh: () => Promise<void>
}

export function useEntries(): UseEntriesResult {
  const [entries, setEntries] = useState<HuoEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsSetup, setNeedsSetup] = useState(false)

  const refresh = useCallback(async () => {
    if (!hasSupabaseConfig()) {
      setNeedsSetup(true)
      setLoading(false)
      return
    }
    const logged = await isLoggedIn().catch(() => false)
    if (!logged) {
      setNeedsSetup(true)
      setLoading(false)
      return
    }
    setNeedsSetup(false)
    setLoading(true)
    setError('')
    try {
      setEntries(await loadEntries())
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { entries, loading, error, needsSetup, refresh }
}
