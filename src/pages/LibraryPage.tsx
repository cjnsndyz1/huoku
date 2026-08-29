import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Trash2,
  ChevronDown,
  ChevronUp,
  Pencil,
  X,
  Sparkles,
  CircleAlert,
  Save,
} from 'lucide-react'
import { TAGS, type Tag, type HuoEntry } from '../types'
import { formatDate } from '../utils/storage'
import { deleteImage, getSignedUrl } from '../services/imageService'
import { deleteEntry, saveEntry } from '../services/dataService'
import { callCoach } from '../services/coachService'
import { useEntries } from '../hooks/useEntries'
import SetupGuide from '../components/SetupGuide'

function EntryImage({ imageId, small }: { imageId: string; small?: boolean }) {
  const [url, setUrl] = useState<string>()

  useEffect(() => {
    let alive = true
    getSignedUrl(imageId)
      .then((u) => {
        if (alive && u) setUrl(u)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [imageId])

  if (!url) return null
  return small ? (
    <img src={url} className="entry-image-thumb" alt="配图" />
  ) : (
    <img src={url} className="entry-image" alt="配图" />
  )
}

function EntryCard({
  entry,
  onDelete,
  onSaved,
}: {
  entry: HuoEntry
  onDelete: (id: string, imageId?: string) => void
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ happened: entry.happened, thought: entry.thought, judgment: entry.judgment, tag: entry.tag })
  const [saving, setSaving] = useState(false)
  const [digLoading, setDigLoading] = useState(false)
  const [clicheLoading, setClicheLoading] = useState(false)
  const [digResult, setDigResult] = useState('')
  const [clicheResult, setClicheResult] = useState('')
  const [err, setErr] = useState('')

  const startEdit = () => {
    setDraft({ happened: entry.happened, thought: entry.thought, judgment: entry.judgment, tag: entry.tag })
    setEditing(true)
    setOpen(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setErr('')
  }

  const save = async () => {
    setSaving(true)
    setErr('')
    try {
      await saveEntry({
        ...entry,
        happened: draft.happened.trim(),
        thought: draft.thought.trim(),
        judgment: draft.judgment.trim(),
        tag: draft.tag,
      })
      setEditing(false)
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const dig = async () => {
    setDigLoading(true)
    setErr('')
    setDigResult('')
    try {
      const q = await callCoach('dig', { happened: entry.happened, thought: entry.thought, lastQuestion: digResult || undefined })
      setDigResult(q)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '调用失败')
    } finally {
      setDigLoading(false)
    }
  }

  const checkCliche = async () => {
    setClicheLoading(true)
    setErr('')
    setClicheResult('')
    try {
      const fb = await callCoach('cliche', { judgment: entry.judgment })
      setClicheResult(fb)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '调用失败')
    } finally {
      setClicheLoading(false)
    }
  }

  const snippet = entry.judgment || entry.happened || entry.thought || '（空白记录）'

  return (
    <article className={`entry ${open ? 'entry-open' : ''}`}>
      <div className="entry-meta">
        <span className="entry-date">{formatDate(entry.date)}</span>
        <span className="entry-tag">{entry.tag}</span>
        <button
          type="button"
          className="entry-del"
          onClick={() => onDelete(entry.id, entry.imageId)}
          title="删除"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {!open ? (
        <button type="button" className="entry-snippet" onClick={() => setOpen(true)}>
          <span className="entry-snippet-text">{snippet}</span>
          <ChevronDown size={16} className="entry-snippet-icon" />
        </button>
      ) : (
        <div className="entry-detail">
          {entry.imageId && <EntryImage imageId={entry.imageId} />}

          {editing ? (
            <div className="entry-edit">
              <label className="field">
                <span className="field-label">发生了什么</span>
                <textarea rows={2} value={draft.happened} onChange={(e) => setDraft({ ...draft, happened: e.target.value })} />
              </label>
              <label className="field">
                <span className="field-label">我怎么想</span>
                <textarea rows={3} value={draft.thought} onChange={(e) => setDraft({ ...draft, thought: e.target.value })} />
              </label>
              <label className="field">
                <span className="field-label">一句话判断</span>
                <textarea rows={2} value={draft.judgment} onChange={(e) => setDraft({ ...draft, judgment: e.target.value })} />
              </label>
              <div className="tags">
                {TAGS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`tag ${draft.tag === t ? 'tag-active' : ''}`}
                    onClick={() => setDraft({ ...draft, tag: t })}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="entry-edit-actions">
                <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
                  <Save size={16} /> {saving ? '保存中…' : '保存修改'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
                  <X size={16} /> 取消
                </button>
              </div>
              {err && <p className="coach-error">{err}</p>}
            </div>
          ) : (
            <>
              {entry.happened && (
                <>
                  <p className="entry-line-label">发生了什么</p>
                  <p className="entry-happened">{entry.happened}</p>
                </>
              )}
              {entry.thought && (
                <>
                  <p className="entry-line-label">我怎么想</p>
                  <p className="entry-thought">{entry.thought}</p>
                </>
              )}
              {entry.judgment && (
                <>
                  <p className="entry-line-label">一句话判断</p>
                  <p className="entry-judgment">{entry.judgment}</p>
                </>
              )}

              <div className="entry-actions">
                <button type="button" className="btn btn-ghost entry-action-btn" onClick={startEdit}>
                  <Pencil size={15} /> 编辑
                </button>
                <button type="button" className="btn btn-ghost entry-action-btn" disabled={digLoading} onClick={dig}>
                  <Sparkles size={15} /> {digLoading ? 'AI 正在想…' : '再挖一层'}
                </button>
                {entry.judgment && (
                  <button type="button" className="btn btn-ghost entry-action-btn" disabled={clicheLoading} onClick={checkCliche}>
                    <CircleAlert size={15} /> {clicheLoading ? '检测中…' : '再查套话'}
                  </button>
                )}
              </div>
              {digResult && <p className="coach-result">{digResult}</p>}
              {clicheResult && <p className="coach-result">{clicheResult}</p>}
              {err && <p className="coach-error">{err}</p>}
            </>
          )}

          {!editing && (
            <button type="button" className="entry-close" onClick={() => setOpen(false)}>
              <ChevronUp size={16} /> 收起
            </button>
          )}
        </div>
      )}
    </article>
  )
}

export default function LibraryPage() {
  const [filter, setFilter] = useState<Tag | '全部'>('全部')
  const { entries, loading, error, needsSetup, refresh } = useEntries()

  const list = filter === '全部' ? entries : entries.filter((e) => e.tag === filter)

  const remove = async (id: string, imageId?: string) => {
    try {
      await deleteEntry(id)
      if (imageId) deleteImage(imageId).catch(() => {})
      await refresh()
    } catch {
      /* 删除失败静默，刷新后可见 */
    }
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
        <h1>货库</h1>
      </header>

      <div className="filter">
        {(['全部', ...TAGS] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`tag ${filter === t ? 'tag-active' : ''}`}
            onClick={() => setFilter(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="empty">加载中…</p>
      ) : list.length === 0 ? (
        <p className="empty">还没有货。去记第一条吧。</p>
      ) : (
        <div className="entry-list">
          {list.map((e) => (
            <EntryCard key={e.id} entry={e} onDelete={remove} onSaved={refresh} />
          ))}
        </div>
      )}
    </div>
  )
}
