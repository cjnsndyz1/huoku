import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Save, Zap, LogIn, LogOut, Cloud } from 'lucide-react'
import {
  DEFAULT_CONFIG,
  loadApiConfig,
  saveApiConfig,
  testApiConfig,
} from '../services/coachService'
import {
  hasSupabaseConfig,
  isLoggedIn,
  loadSupabaseConfig,
  resetClient,
  saveSupabaseConfig,
  signIn,
  signOut,
  signUp,
} from '../services/supabase'

export default function SettingsPage() {
  // AI 配置
  const [baseUrl, setBaseUrl] = useState(loadApiConfig().baseUrl)
  const [apiKey, setApiKey] = useState(loadApiConfig().apiKey)
  const [model, setModel] = useState(loadApiConfig().model)
  const [testing, setTesting] = useState(false)

  // Supabase 配置 + 登录
  const [sbUrl, setSbUrl] = useState(loadSupabaseConfig().url)
  const [sbKey, setSbKey] = useState(loadSupabaseConfig().anonKey)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [busy, setBusy] = useState(false)

  const [msg, setMsg] = useState('')

  useEffect(() => {
    let alive = true
    isLoggedIn()
      .then((v) => {
        if (alive) setLoggedIn(v)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const saveAi = () => {
    saveApiConfig({
      baseUrl: baseUrl.trim() || DEFAULT_CONFIG.baseUrl,
      apiKey: apiKey.trim(),
      model: model.trim() || DEFAULT_CONFIG.model,
    })
    setMsg('AI 配置已保存')
  }

  const testAi = async () => {
    setTesting(true)
    setMsg('')
    const result = await testApiConfig({ baseUrl, apiKey, model })
    setMsg(result)
    setTesting(false)
  }

  const saveSb = () => {
    saveSupabaseConfig({ url: sbUrl.trim(), anonKey: sbKey.trim() })
    resetClient()
    setMsg('Supabase 配置已保存')
  }

  const doLogin = async () => {
    if (!hasSupabaseConfig()) {
      setMsg('请先保存上面的 Supabase 配置')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      await signIn(email.trim(), password)
      setLoggedIn(true)
      setMsg('登录成功')
    } catch (e) {
      setMsg(`登录失败：${e instanceof Error ? e.message : '请检查邮箱密码'}`)
    } finally {
      setBusy(false)
    }
  }

  const doSignup = async () => {
    if (!hasSupabaseConfig()) {
      setMsg('请先保存上面的 Supabase 配置')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      await signUp(email.trim(), password)
      setLoggedIn(true)
      setMsg('注册成功，已登录')
    } catch (e) {
      setMsg(`注册失败：${e instanceof Error ? e.message : '请检查邮箱密码'}`)
    } finally {
      setBusy(false)
    }
  }

  const doLogout = async () => {
    await signOut()
    setLoggedIn(false)
    setMsg('已退出登录')
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/" className="link-back">
          <ArrowLeft size={16} /> 首页
        </Link>
        <h1>设置</h1>
      </header>

      {/* 云存储（Supabase） */}
      <section className="settings-section">
        <h2 className="section-title">
          <Cloud size={16} /> 云同步（Supabase）
        </h2>
        <p className="settings-note">
          数据存云端，电脑手机自动同步。首次使用：填配置 → 注册账号 → 登录。
        </p>

        <div className="form">
          <label className="field">
            <span className="field-label">Supabase URL</span>
            <input
              type="text"
              className="text-input"
              value={sbUrl}
              onChange={(e) => setSbUrl(e.target.value)}
              placeholder="https://xxxx.supabase.co"
            />
          </label>
          <label className="field">
            <span className="field-label">Anon Key</span>
            <input
              type="text"
              className="text-input"
              value={sbKey}
              onChange={(e) => setSbKey(e.target.value)}
              placeholder="eyJhbGciOi..."
            />
          </label>
          <button type="button" className="btn btn-ghost" onClick={saveSb}>
            <Save size={16} /> 保存 Supabase 配置
          </button>

          {!loggedIn ? (
            <>
              <label className="field">
                <span className="field-label">邮箱</span>
                <input
                  type="email"
                  className="text-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              <label className="field">
                <span className="field-label">密码</span>
                <input
                  type="password"
                  className="text-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </label>
              <div className="settings-actions">
                <button type="button" className="btn btn-primary" onClick={doLogin} disabled={busy}>
                  <LogIn size={16} /> 登录
                </button>
                <button type="button" className="btn btn-ghost" onClick={doSignup} disabled={busy}>
                  注册
                </button>
              </div>
            </>
          ) : (
            <div className="settings-actions">
              <span className="login-status">已登录（{email || '当前账号'}）</span>
              <button type="button" className="btn btn-ghost" onClick={doLogout}>
                <LogOut size={16} /> 退出登录
              </button>
            </div>
          )}
        </div>
      </section>

      {/* AI 配置 */}
      <section className="settings-section">
        <h2 className="section-title">
          <Zap size={16} /> AI 教练（DeepSeek）
        </h2>
        <p className="settings-note">Key 只存在你浏览器里，走你自己的 DeepSeek 额度。</p>

        <div className="form">
          <label className="field">
            <span className="field-label">API Key</span>
            <input
              type="text"
              className="text-input"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </label>
          <label className="field">
            <span className="field-label">模型名</span>
            <input
              type="text"
              className="text-input"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="deepseek-chat"
            />
          </label>
          <label className="field">
            <span className="field-label">Base URL（一般不用改）</span>
            <input
              type="text"
              className="text-input"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.deepseek.com/v1"
            />
          </label>
          <div className="settings-actions">
            <button type="button" className="btn btn-primary" onClick={saveAi}>
              <Save size={16} /> 保存 AI 配置
            </button>
            <button type="button" className="btn btn-ghost" onClick={testAi} disabled={testing}>
              <Zap size={16} /> {testing ? '测试中…' : '测试连接'}
            </button>
          </div>
        </div>
      </section>

      {msg && <p className="backup-msg">{msg}</p>}
    </div>
  )
}
