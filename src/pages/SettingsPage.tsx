import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Save, Zap, LogIn, LogOut, Cloud, Eye, EyeOff } from 'lucide-react'
import {
  DEFAULT_CONFIG,
  loadApiConfig,
  saveApiConfig,
  testApiConfig,
} from '../services/coachService'
import { loadAiSettings, saveAiSettings } from '../services/aiSettingsService'
import { isLoggedIn, signIn, signOut, signUp } from '../services/supabase'

export default function SettingsPage() {
  // AI 配置
  const [baseUrl, setBaseUrl] = useState(loadApiConfig().baseUrl)
  const [apiKey, setApiKey] = useState(loadApiConfig().apiKey)
  const [model, setModel] = useState(loadApiConfig().model)
  const [testing, setTesting] = useState(false)
  const [showKey, setShowKey] = useState(false)

  // 登录
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

  // 登录后：从云端拉取 DeepSeek 配置（跨设备自动带过来）
  const syncAiFromCloud = async () => {
    try {
      const cloud = await loadAiSettings()
      if (cloud && cloud.apiKey.trim()) {
        setApiKey(cloud.apiKey)
        setModel(cloud.model)
        setBaseUrl(cloud.baseUrl)
        saveApiConfig(cloud) // 缓存到本地
      }
    } catch {
      /* 云端无配置，忽略 */
    }
  }

  const doLogin = async () => {
    setBusy(true)
    setMsg('')
    try {
      await signIn(email.trim(), password)
      setLoggedIn(true)
      setMsg('登录成功')
      await syncAiFromCloud()
    } catch (e) {
      setMsg(`登录失败：${e instanceof Error ? e.message : '请检查邮箱密码'}`)
    } finally {
      setBusy(false)
    }
  }

  const doSignup = async () => {
    setBusy(true)
    setMsg('')
    try {
      await signUp(email.trim(), password)
      setLoggedIn(true)
      setMsg('注册成功，已登录')
      await syncAiFromCloud()
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

  const saveAi = async () => {
    const cfg = {
      baseUrl: baseUrl.trim() || DEFAULT_CONFIG.baseUrl,
      apiKey: apiKey.trim(),
      model: model.trim() || DEFAULT_CONFIG.model,
    }
    saveApiConfig(cfg) // 本地缓存
    try {
      await saveAiSettings(cfg) // 同步云端
      setMsg('AI 配置已保存并同步到云端')
    } catch {
      setMsg('AI 配置已保存到本地（云端同步失败，请先登录）')
    }
  }

  const testAi = async () => {
    setTesting(true)
    setMsg('')
    const result = await testApiConfig({ baseUrl, apiKey, model })
    setMsg(result)
    setTesting(false)
  }

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/" className="link-back">
          <ArrowLeft size={16} /> 首页
        </Link>
        <h1>设置</h1>
      </header>

      {/* 账号（云同步） */}
      <section className="settings-section">
        <h2 className="section-title">
          <Cloud size={16} /> 账号（云同步）
        </h2>
        <p className="settings-note">
          登录后，你的货和 AI 配置自动在电脑手机间同步。
        </p>

        <div className="form">
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
        <p className="settings-note">
          Key 存在你的账号里（云端同步），走你自己的 DeepSeek 额度。换设备登录后自动带过来。
        </p>

        <div className="form">
          <label className="field">
            <span className="field-label">API Key</span>
            <div className="key-field">
              <input
                type={showKey ? 'text' : 'password'}
                className="text-input"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="key-toggle"
                onClick={() => setShowKey((v) => !v)}
                title={showKey ? '隐藏 API Key' : '显示 API Key'}
                aria-label={showKey ? '隐藏 API Key' : '显示 API Key'}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <label className="field">
            <span className="field-label">模型名</span>
            <input
              type="text"
              className="text-input"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="deepseek-v4-flash"
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
