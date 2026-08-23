import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { loadHistory } from '../utils/storage'

const DAY_MS = 24 * 60 * 60 * 1000
const INTERVALS = [1, 3, 7, 14, 30]

function dateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function ReviewPage() {
  const history = useMemo(() => loadHistory(), [])
  const now = Date.now()

  const groups = INTERVALS.map((days) => {
    const target = dateKey(new Date(now - days * DAY_MS))
    return { days, items: history.filter((e) => e.date === target) }
  }).filter((g) => g.items.length > 0)

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/" className="link-back">
          <ArrowLeft size={16} /> 首页
        </Link>
        <h1>回看 · 间隔复习</h1>
      </header>
      <p className="subtitle">把旧的货翻出来再看一眼，它才真正变成你的。</p>

      {groups.length === 0 ? (
        <p className="empty">暂时没有该复习的货。坚持记，1 天后这里就会有。</p>
      ) : (
        groups.map((g) => (
          <section key={g.days} className="review-group">
            <h2 className="review-title">{g.days} 天前</h2>
            {g.items.map((e) => (
              <div key={e.id} className="review-item">
                <p className="entry-judgment">{e.judgment}</p>
                <p className="entry-happened">{e.happened}</p>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  )
}
