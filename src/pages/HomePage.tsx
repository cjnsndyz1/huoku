import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { Feather, Library, CalendarCheck, TrendingUp, Trophy } from 'lucide-react'
import { loadHistory } from '../utils/storage'
import { computeStats, streakText } from '../utils/stats'

const MILESTONES = [100, 50, 10]

export default function HomePage() {
  const history = useMemo(() => loadHistory(), [])
  const stats = computeStats(history)
  const milestone = MILESTONES.find((m) => stats.totalCount >= m)

  return (
    <div className="page page-center">
      <p className="brand">货库</p>
      <h1 className="title">把今天，说成一句自己的话。</h1>
      <p className="subtitle">每天挖一件小事，记下它，攒成你的货库。</p>
      <p className="today">{streakText(stats)}</p>

      {milestone ? (
        <p className="milestone">
          <Trophy size={16} /> 已攒下 {stats.totalCount} 条货，第 {milestone} 条里程碑达成！
        </p>
      ) : (
        <p className="total-count">累计挖货 {stats.totalCount} 条</p>
      )}

      <div className="actions">
        <Link to="/record" className="btn btn-primary btn-lg">
          <Feather size={18} /> 记一条货
        </Link>
      </div>

      <div className="entry-grid">
        <Link to="/library" className="entry-card">
          <Library size={22} />
          <span>货库</span>
          <small>翻看攒下的货</small>
        </Link>
        <Link to="/review" className="entry-card">
          <CalendarCheck size={22} />
          <span>回看</span>
          <small>复习旧货</small>
        </Link>
        <Link to="/progress" className="entry-card">
          <TrendingUp size={22} />
          <span>进步</span>
          <small>打卡与统计</small>
        </Link>
      </div>
    </div>
  )
}
