import { useEffect, useState } from 'react'
import Login from './components/Login'
import Board from './components/Board'
import { fetchMe, getStoredUser, getToken, clearSession } from './api'

/**
 * البوابة: فيه توكن محفوظ؟ نتأكد إنه لسه شغال ونفتح الشاشة.
 * مفيش؟ شاشة الدخول.
 */
export default function App() {
  const [user, setUser] = useState(getStoredUser)
  const [checking, setChecking] = useState(Boolean(getToken()))

  /* التوكن المحفوظ ممكن يكون خلص من امبارح — بنتأكد مع السيرفر */
  useEffect(() => {
    if (!getToken()) {
      setChecking(false)
      return
    }
    fetchMe()
      .then((result) => setUser(result.data))
      .catch(() => {
        clearSession()
        setUser(null)
      })
      .finally(() => setChecking(false))
  }, [])

  /* أي طلب رجّع 401 → بنرجع لشاشة الدخول تلقائيًا */
  useEffect(() => {
    const onExpired = () => setUser(null)
    window.addEventListener('tablet-auth-expired', onExpired)
    return () => window.removeEventListener('tablet-auth-expired', onExpired)
  }, [])

  if (checking) {
    return <div className="splash">ثواني…</div>
  }

  if (!user) {
    return <Login onLogin={setUser} />
  }

  return <Board user={user} onLogout={() => setUser(null)} />
}
