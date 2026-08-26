import { useState } from 'react'
import { login, saveSession } from '../api'
import logo from '../logo-emblem.png'

/** شاشة الدخول — إيميل وباسورد الموظف/الأدمن. */
export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const result = await login(email.trim(), password)
      saveSession(result.data.token, result.data.user)
      onLogin(result.data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <form className="login__box" onSubmit={handleSubmit}>
        <img className="login__logo" src={logo} alt="" width="88" height="88" />
        <h1 className="login__title">أوردرات بشندي</h1>
        <p className="login__sub">شاشة المطعم — سجّل دخول عشان تشوف الطلبات</p>

        <label className="login__field">
          <span>الإيميل</span>
          <input
            type="email"
            dir="ltr"
            value={email}
            autoComplete="username"
            required
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="login__field">
          <span>الباسورد</span>
          <input
            type="password"
            dir="ltr"
            value={password}
            autoComplete="current-password"
            required
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error ? <p className="login__error">{error}</p> : null}

        <button className="btn btn--primary login__submit" type="submit" disabled={busy}>
          {busy ? 'ثواني…' : 'دخول'}
        </button>
      </form>
    </div>
  )
}
