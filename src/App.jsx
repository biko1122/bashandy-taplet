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
  const [offline, setOffline] = useState(false)

  /* التوكن المحفوظ ممكن يكون خلص من امبارح — بنتأكد مع السيرفر */
  useEffect(() => {
    if (!getToken()) {
      setChecking(false)
      return
    }
    fetchMe()
      .then((result) => setUser(result.data))
      .catch((error) => {
        /* ⚠️ السيرفر مش راد **مش** معناه إن الجلسة خلصت.
           كنا بنمسح التوكن على أي خطأ، فأول قطعة نت كانت بتطلّع
           الموظف برّه ويرجع يسجّل دخول من تاني وسط الشغل. دلوقتي
           بنمسحها بس لما السيرفر يقول فعلًا إن التوكن مش مقبول. */
        if (error?.code === 'NETWORK' || error?.code === 'TIMEOUT') return
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

  /* السيرفر وقع؟ لازم يبان.
     من غير الشريط ده اللوحة بتفضل عارضة آخر لقطة وهي متجمّدة،
     والموظف فاكر إن مفيش أوردرات جديدة. */
  useEffect(() => {
    const onServer = (event) => setOffline(event.detail?.ok === false)
    window.addEventListener('tablet-server', onServer)
    return () => window.removeEventListener('tablet-server', onServer)
  }, [])

  const banner = offline ? (
    <div className="offline" role="alert">
      ⚠️ مفيش اتصال بالسيرفر — اللي على الشاشة ممكن يكون قديم، والأوردرات
      الجديدة مش هتظهر. اتأكد من النت.
    </div>
  ) : null

  if (checking) {
    return (
      <>
        {banner}
        <div className="splash">ثواني…</div>
      </>
    )
  }

  if (!user) {
    return (
      <>
        {banner}
        <Login onLogin={setUser} />
      </>
    )
  }

  return (
    <>
      {banner}
      <Board user={user} onLogout={() => setUser(null)} />
    </>
  )
}
