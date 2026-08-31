import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Feather, Lightbulb, Save } from 'lucide-react'
import { useEntries } from '../hooks/useEntries'
import { TAGS, type Tag, type HuoEntry } from '../types'
import { todayStr } from '../utils/storage'
import { saveEntry } from '../services/dataService'
import SetupGuide from '../components/SetupGuide'

const DAY_MS = 24 * 60 * 60 * 1000
const INTERVALS = [1, 3, 7, 14, 30]

function dateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function ReviewPage() {
  const { entries, loading, error, needsSetup, refresh } = useEntries()
  const now = Date.now()

  // P1-6：今日新想法——复习旧货冒出的判断，就地记成新货
  const [idea, setIdea] = useState('')
  const [ideaTag, setIdeaTag] = useState<Tag>('自我')
  const [ideaSaving, setIdeaSaving] = useState(false)
  const [ideaMsg, setIdeaMsg] = useState('')

  const saveIdea = async () => {
    if (!idea.trim() || ideaSaving) return
    setIdeaSaving(true)
    setIdeaMsg('')
    try {
      const entry: HuoEntry = {
        id: crypto.randomUUID(),
        date: todayStr(),
        happened: '',
        thought: '',
        judgment: idea.trim(),
        tag: ideaTag,
        createdAt: Date.now(),
      }
      await saveEntry(entry)
      setIdea('')
      setIdeaMsg('已存进货库，翻看旧货长出了新货')
      await refresh()
    } catch (e) {
      setIdeaMsg(`保存失败：${e instanceof Error ? e.message : '请检查云同步配置'}`)
    } finally {
      setIdeaSaving(false)
    }
  }

  const groups = INTERVALS.map((days) => {
    const target = dateKey(new Date(now - days * DAY_MS))
    return { days, items: entries.filter((e) => e.date === target) }
  }).filter((g) => g.items.length > 0)

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
        <h1>回看 · 间隔复习</h1>
      </header>
      <p className="subtitle">把旧的货翻出来再看一眼，它才真正变成你的。</p>

      {loading ? (
        <p className="empty">加载中…</p>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <p className="empty">暂时没有该复习的货。坚持记，1 天后这里就会有。</p>
          <Link to="/record" className="btn btn-primary">
            <Feather size={16} /> 去记一条货
          </Link>
        </div>
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

      <section className="new-idea">
        <h2 className="section-title">
          <Lightbulb size={16} /> 今日新想法
        </h2>
        <p className="settings-note">看完旧货冒出的新判断、新角度？一句话记下来，它就是新货。</p>
        <textarea
          rows={2}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="例如：原来我当时的判断，其实是怕…"
        />
        <div className="tags">
          {TAGS.map((t) => (
            <button
              key={t}
              type="button"
              className={`tag ${ideaTag === t ? 'tag-active' : ''}`}
              onClick={() => setIdeaTag(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-primary btn-idea-save"
          disabled={!idea.trim() || ideaSaving}
          onClick={saveIdea}
        >
          <Save size={16} /> {ideaSaving ? '保存中…' : '存成今天的货'}
        </button>
        {ideaMsg && <p className="backup-msg">{ideaMsg}</p>}
      </section>
    </div>
  )
}
