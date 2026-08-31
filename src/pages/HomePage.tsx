import { Link } from 'react-router-dom'
import { Feather, Library, CalendarCheck, TrendingUp, Trophy, Settings, Check } from 'lucide-react'
import { useEntries } from '../hooks/useEntries'
import { computeStats, streakText } from '../utils/stats'
import { hasApiKey } from '../services/coachService'
import SetupGuide from '../components/SetupGuide'

const MILESTONES = [100, 50, 10]

export default function HomePage() {
  const { entries, loading, error, needsSetup } = useEntries()
  const stats = computeStats(entries)
  const milestone = MILESTONES.find((m) => stats.totalCount >= m)
  const recordedToday = stats.todayCount > 0

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
    <div className="page page-center">
      <p className="brand">货库</p>
      <h1 className="title">把今天，说成一句自己的话。</h1>
      <p className="subtitle">每天挖一件小事，记下它，攒成你的货库。</p>

      {loading ? (
        <p className="today-banner today-loading">加载中…</p>
      ) : (
        <p className={`today-banner ${recordedToday ? 'today-done' : 'today-todo'}`}>
          {recordedToday ? <Check size={15} /> : <Feather size={15} />}
          {streakText(stats)}
        </p>
      )}

      {!loading && milestone ? (
        <p className="milestone">
          <Trophy size={16} /> 已攒下 {stats.totalCount} 条货，第 {milestone} 条里程碑达成！
        </p>
      ) : (
        <p className="total-count">{loading ? '' : `累计挖货 ${stats.totalCount} 条`}</p>
      )}

      <div className="actions">
        <Link to="/record" className="btn btn-primary btn-lg">
          <Feather size={18} /> {recordedToday ? '再记一条' : '记一条货'}
        </Link>
        {recordedToday && (
          <Link to="/review" className="btn btn-ghost btn-lg">
            <CalendarCheck size={18} /> 回看
          </Link>
        )}
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

      <Link to="/settings" className="settings-link">
        <Settings size={14} />
        {hasApiKey() ? '设置' : '配置（云同步 + AI）'}
      </Link>
    </div>
  )
}
