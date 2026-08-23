import type { HuoEntry } from '../types'

export interface Stats {
  todayCount: number
  streakDays: number
  totalCount: number
}

const DAY_MS = 24 * 60 * 60 * 1000

function dayStart(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function computeStats(entries: HuoEntry[], now: Date = new Date()): Stats {
  const days = new Set<number>()
  for (const e of entries) {
    const d = new Date(`${e.date}T00:00:00`)
    if (!Number.isNaN(d.getTime())) days.add(d.getTime())
  }
  const today = dayStart(now)
  const todayCount = entries.filter((e) => {
    const d = new Date(`${e.date}T00:00:00`)
    return d.getTime() === today
  }).length

  let streak = 0
  // 今天练过从今天数，今天还没练从昨天数，避免"刚打开就显示连续 0 天"的挫败感
  let cursor = days.has(today) ? today : today - DAY_MS
  while (days.has(cursor)) {
    streak += 1
    cursor -= DAY_MS
  }
  return { todayCount, streakDays: streak, totalCount: entries.length }
}

export function streakText(stats: Stats): string {
  const { todayCount, streakDays } = stats
  if (todayCount > 0) {
    return streakDays > 1 ? `今天挖了 ${todayCount} 条 · 连续 ${streakDays} 天` : `今天挖了 ${todayCount} 条`
  }
  if (streakDays > 1) return `今天还没挖，已连续 ${streakDays} 天，别断`
  return '今天还没挖，从一件小事开始'
}
