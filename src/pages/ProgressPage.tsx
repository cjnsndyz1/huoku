import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Upload } from 'lucide-react'
import { exportHistory, importHistory, loadHistory, todayStr } from '../utils/storage'
import { computeStats } from '../utils/stats'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export default function ProgressPage() {
  const [refresh, setRefresh] = useState(0)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const history = useMemo(() => loadHistory(), [refresh])
  const stats = computeStats(history)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay()

  const activeDays = new Set(history.map((e) => e.date))

  const cells: (string | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push(key)
  }

  const handleExport = () => {
    const json = exportHistory()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `货库备份-${todayStr()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMsg('已导出备份文件')
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const n = importHistory(reader.result as string)
        setMsg(`导入成功，新增 ${n} 条`)
        setRefresh((x) => x + 1)
      } catch (err) {
        setMsg(`导入失败：${err instanceof Error ? err.message : '文件无效'}`)
      }
    }
    reader.readAsText(file)
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
          <span className="summary-value">{stats.totalCount}</span>
          <span className="summary-label">累计挖货</span>
        </div>
        <div className="summary-item">
          <span className="summary-value">{stats.streakDays}</span>
          <span className="summary-label">连续天数</span>
        </div>
        <div className="summary-item">
          <span className="summary-value">{stats.todayCount}</span>
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
          <button type="button" className="btn btn-ghost" onClick={handleExport}>
            <Download size={16} /> 导出 JSON
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> 导入备份
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImport} />
        </div>
        {msg && <p className="backup-msg">{msg}</p>}
      </section>
    </div>
  )
}
