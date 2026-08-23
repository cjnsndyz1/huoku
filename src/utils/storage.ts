import type { HuoEntry } from '../types'

const KEY = 'biaodaxunlian:history'
const LIMIT = 200

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 隐私模式 / 存储满时静默降级 */
  }
}

function isValidEntry(e: unknown): e is HuoEntry {
  if (typeof e !== 'object' || e === null) return false
  const a = e as Partial<HuoEntry>
  return (
    typeof a.id === 'string' &&
    typeof a.date === 'string' &&
    typeof a.happened === 'string' &&
    typeof a.judgment === 'string' &&
    typeof a.createdAt === 'number'
  )
}

export function loadHistory(): HuoEntry[] {
  const list = readJson<HuoEntry[]>(KEY)
  if (!Array.isArray(list)) return []
  return list.filter(isValidEntry).sort((a, b) => b.createdAt - a.createdAt)
}

export function saveEntry(entry: HuoEntry): void {
  const list = [entry, ...loadHistory().filter((e) => e.id !== entry.id)]
  writeJson(KEY, list.slice(0, LIMIT))
}

export function deleteEntry(id: string): void {
  writeJson(
    KEY,
    loadHistory().filter((e) => e.id !== id),
  )
}

/** 本地时区今天，如 2026-08-22 */
export function todayStr(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 2026-08-22 -> 08-22 */
export function formatDate(dateStr: string): string {
  const parts = dateStr.split('-')
  return parts.length === 3 ? `${parts[1]}-${parts[2]}` : dateStr
}

export function formatDateTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 导出全部记录为 JSON 字符串 */
export function exportHistory(): string {
  return JSON.stringify(loadHistory(), null, 2)
}

/** 导入 JSON 字符串，按 id 去重合并，返回新增条数 */
export function importHistory(json: string): number {
  const parsed = JSON.parse(json)
  if (!Array.isArray(parsed)) throw new Error('不是有效的备份文件')
  const incoming = parsed.filter(isValidEntry)
  const existing = loadHistory()
  const existingIds = new Set(existing.map((e) => e.id))
  const fresh = incoming.filter((e) => !existingIds.has(e.id))
  writeJson(KEY, [...fresh, ...existing].slice(0, LIMIT))
  return fresh.length
}
