import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Upload } from 'lucide-react'
import { todayStr } from '../utils/storage'
import { computeStats } from '../utils/stats'
import { saveEntry } from '../services/dataService'
import { useEntries } from '../hooks/useEntries'
import SetupGuide from '../components/SetupGuide'
import type { HuoEntry } from '../types'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export default function ProgressPage() {
  const { entries, loading, error, needsSetup, refresh } = useEntries()
  const [msg, setMsg] = useState('')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const stats = computeStats(entries)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay()

  const activeDays = new Set(entries.map((e) => e.date))

  const cells: (string | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push(key)
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `货库备份-${todayStr()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMsg(`已导出 ${entries.length} 条记录`)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImporting(true)
    setMsg('')
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result as string)
        if (!Array.isArray(parsed)) throw new Error('不是有效的备份文件')
        for (const item of parsed as HuoEntry[]) {
          await saveEntry(item)
        }
        setMsg(`导入成功 ${parsed.length} 条`)
        await refresh()
      } catch (err) {
        setMsg(`导入失败：${err instanceof Error ? err.message : '文件无效'}`)
      } finally {
        setImporting(false)
      }
    }
    reader.readAsText(file)
  }

  if (needsSetup) return <SetupGuide />
  if (error) {
    return (
      <div className="page page-center">
        <p className="coach-error">{error}</p>
        <Link to="/settings" className="btn btn-ghost">
          去设置
        </Link>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/" className="link-back">
          <ArrowLeft size={16} /> 首页
        </Link>
        <h1>进步 · 打卡</h1>
      </header>

      <div className="summary">
        <div className="summary-item">
          <span className="summary-value">{loading ? '—' : stats.totalCount}</span>
          <span className="summary-label">累计挖货</span>
        </div>
        <div className="summary-item">
          <span className="summary-value">{loading ? '—' : stats.streakDays}</span>
          <span className="summary-label">连续天数</span>
        </div>
        <div className="summary-item">
          <span className="summary-value">{loading ? '—' : stats.todayCount}</span>
          <span className="summary-label">今日</span>
        </div>
      </div>

      <section className="calendar-section">
        <h2 className="section-title">
          {year} 年 {month + 1} 月
        </h2>
        <div className="calendar">
          {WEEKDAYS.map((w) => (
            <div key={w} className="cal-weekday">
              {w}
            </div>
          ))}
          {cells.map((key, i) =>
            key === null ? (
              <div key={`empty-${i}`} className="cal-cell cal-empty" />
            ) : (
              <div key={key} className={`cal-cell ${activeDays.has(key) ? 'cal-active' : ''}`}>
                {Number(key.slice(-2))}
              </div>
            ),
          )}
        </div>
        <p className="cal-legend">绿色 = 那天挖了货</p>
      </section>

      <section className="calendar-section backup">
        <h2 className="section-title">数据备份</h2>
        <div className="backup-actions">
          <button type="button" className="btn btn-ghost" onClick={handleExport} disabled={loading}>
            <Download size={16} /> 导出 JSON
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={importing}>
            <Upload size={16} /> {importing ? '导入中…' : '导入备份'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </div>
        {msg && <p className="backup-msg">{msg}</p>}
      </section>
    </div>
  )
}
