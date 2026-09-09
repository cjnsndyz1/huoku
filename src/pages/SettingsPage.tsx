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
import { isLoggedIn, signIn, signOut, signUp, authErrorText } from '../services/supabase'

/** 给认证请求加超时：supabase.co 网络挂起时若没有超时，busy 会永久卡死、按钮全部失灵（"点了没反应"） */
function withTimeout<T>(p: Promise<T>, ms = 20000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('连接超时，请检查网络后重试')), ms)
  })
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer))
}

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

  // 操作结果消息：ok=墨绿 / err=朱砂 / info=中性，避免「失败也显成功绿」误导
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null)
  // 当前进行中的认证动作：驱动按钮忙碌文案（登录中…/注册中…），避免请求挂起时「点了没反应」
  const [action, setAction] = useState<'login' | 'signup' | null>(null)

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
    setAction('login')
    setMsg(null)
    try {
      await withTimeout(signIn(email.trim(), password))
      setLoggedIn(true)
      setMsg({ kind: 'ok', text: '登录成功' })
      await syncAiFromCloud()
    } catch (e) {
      setMsg({ kind: 'err', text: authErrorText(e) })
    } finally {
      setAction(null)
    }
  }

  const doSignup = async () => {
    setAction('signup')
    setMsg(null)
    try {
      const status = await withTimeout(signUp(email.trim(), password))
      if (status === 'confirmed') {
        setLoggedIn(true)
        // 新账号首登标记：首页显示一次性欢迎条，说明空货库是正常的（避免误以为数据丢了）
        try {
          localStorage.setItem('biaodaxunlian:just-registered', '1')
        } catch {
          /* 忽略 */
        }
        setMsg({ kind: 'ok', text: '注册成功，已登录' })
        await syncAiFromCloud()
      } else {
        // 开了邮箱验证：注册已成功但没自动登录，去收邮件验证
        setMsg({
          kind: 'info',
          text: '注册成功！请查收邮箱里的验证邮件，点开链接完成验证，再回来登录',
        })
      }
    } catch (e) {
      setMsg({ kind: 'err', text: authErrorText(e) })
    } finally {
      setAction(null)
    }
  }

  const doLogout = async () => {
    await signOut()
    setLoggedIn(false)
    setMsg({ kind: 'ok', text: '已退出登录' })
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
      setMsg({ kind: 'ok', text: 'AI 配置已保存并同步到云端' })
    } catch {
      setMsg({ kind: 'info', text: 'AI 配置已保存到本地（云端同步失败，请先登录）' })
    }
  }

  const testAi = async () => {
    setTesting(true)
    setMsg(null)
    const result = await testApiConfig({ baseUrl, apiKey, model })
    // 连接成功是确认态；其余（Key 无效/填错/网络）都是需要动手修的提醒
    setMsg(result === '连接成功' ? { kind: 'ok', text: result } : { kind: 'err', text: result })
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
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={doLogin}
                  disabled={action !== null}
                >
                  <LogIn size={16} /> {action === 'login' ? '登录中…' : '登录'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={doSignup}
                  disabled={action !== null}
                >
                  {action === 'signup' ? '注册中…' : '注册'}
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

      {msg && <p className={`backup-msg msg-${msg.kind}`}>{msg.text}</p>}
    </div>
  )
}
