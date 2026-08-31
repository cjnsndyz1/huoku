import { useEffect, useRef, useState } from 'react'
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
  Feather,
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
  const [inView, setInView] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  // 进入视口（提前 200px）才发起 signed URL 请求——列表有多张配图时，滚动到哪加载到哪
  useEffect(() => {
    const el = imgRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!inView) return
    let alive = true
    getSignedUrl(imageId)
      .then((u) => {
        if (alive && u) setUrl(u)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [inView, imageId])

  if (small) {
    return (
      <img
        ref={imgRef}
        src={url}
        className={`entry-image-thumb${loaded ? ' is-loaded' : ''}`}
        alt="配图"
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
      />
    )
  }
  return (
    <img
      ref={imgRef}
      src={url}
      className={`entry-image${loaded ? ' is-loaded' : ''}`}
      alt="配图"
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
    />
  )
}

function EntryCard({
  entry,
  onDelete,
  onSaved,
}: {
  entry: HuoEntry
  onDelete: (entry: HuoEntry) => void
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
          onClick={() => onDelete(entry)}
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

  // P0-1：删除前确认 + 删除后可撤销
  const [pendingDelete, setPendingDelete] = useState<HuoEntry | null>(null)
  const [delErr, setDelErr] = useState('')
  const [deleted, setDeleted] = useState<HuoEntry | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  // 图片延迟删除计时器（按条目 id），撤销时取消，避免误删后图片也跟着没了
  const imgTimers = useRef(new Map<string, number>())
  const toastTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (pendingDelete) {
      confirmRef.current?.focus()
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setPendingDelete(null)
      }
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }
  }, [pendingDelete])

  useEffect(() => {
    // 组件卸载时清掉所有未触发的图片删除计时器
    const timers = imgTimers.current
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [])

  const list = filter === '全部' ? entries : entries.filter((e) => e.tag === filter)

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDelErr('')
    try {
      await deleteEntry(pendingDelete.id)
      if (pendingDelete.imageId) {
        // 图片晚 10 秒再真删，给撤销留出窗口
        const prev = imgTimers.current.get(pendingDelete.id)
        if (prev) window.clearTimeout(prev)
        const t = window.setTimeout(() => {
          deleteImage(pendingDelete.imageId as string).catch(() => {})
          imgTimers.current.delete(pendingDelete.id as string)
        }, 10_000)
        imgTimers.current.set(pendingDelete.id, t)
      }
      setPendingDelete(null)
      setDeleted(pendingDelete)
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
      toastTimer.current = window.setTimeout(() => setDeleted(null), 8000)
      await refresh()
    } catch {
      setDelErr('删除失败，稍后再试')
    }
  }

  const undo = async () => {
    if (!deleted) return
    // 取消图片删除
    const t = imgTimers.current.get(deleted.id)
    if (t) {
      window.clearTimeout(t)
      imgTimers.current.delete(deleted.id)
    }
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    setDeleted(null)
    try {
      await saveEntry(deleted)
      await refresh()
    } catch {
      /* 恢复失败：数据已在云端删除，列表刷新后自然消失 */
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
        <div className="empty-state">
          <p className="empty">
            {filter === '全部' ? '还没有货。去记第一条吧。' : `还没有「${filter}」的货。`}
          </p>
          <Link to="/record" className="btn btn-primary">
            <Feather size={16} /> 去记一条货
          </Link>
        </div>
      ) : (
        <div className="entry-list">
          {list.map((e) => (
            <EntryCard key={e.id} entry={e} onDelete={setPendingDelete} onSaved={refresh} />
          ))}
        </div>
      )}

      {pendingDelete && (
        <div className="modal-mask" onClick={() => setPendingDelete(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="删除确认"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="modal-title">删掉这条货？</h2>
            <p className="modal-text">删掉就找不回来了：</p>
            <blockquote className="modal-quote">
              {pendingDelete.judgment || pendingDelete.happened || pendingDelete.thought || '（空白记录）'}
            </blockquote>
            {delErr && <p className="coach-error">{delErr}</p>}
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPendingDelete(null)}
                ref={confirmRef}
              >
                留下它
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmDelete}>
                删掉
              </button>
            </div>
          </div>
        </div>
      )}

      {deleted && (
        <div className="toast" role="status">
          <span>已删掉 1 条货</span>
          <button type="button" className="toast-undo" onClick={undo}>
            撤销
          </button>
        </div>
      )}
    </div>
  )
}
