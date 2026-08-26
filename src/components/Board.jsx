import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  clearSession,
  fetchActiveOrders,
  fetchHistoryOrders,
  fetchStatusMeta,
  updateOrderStatus,
} from '../api'
import { whatsappUrlFor } from '../whatsapp'
import OrderCard from './OrderCard'
import logo from '../logo-emblem.png'

const POLL_MS = 8000

/* التبويبات — "الكل" و"جديد" و"في الشغل" و"جاهز" والسجل */
const TABS = [
  { id: 'all', label: 'الكل النشط', statuses: ['PENDING', 'ACCEPTED', 'PREPARING', 'READY'] },
  { id: 'new', label: 'جديد', statuses: ['PENDING'] },
  { id: 'working', label: 'في الشغل', statuses: ['ACCEPTED', 'PREPARING'] },
  { id: 'ready', label: 'جاهز', statuses: ['READY'] },
  { id: 'history', label: 'السجل', statuses: ['COMPLETED', 'CANCELLED'] },
]

/* نغمة تنبيه بسيطة للأوردر الجديد — من غير أي ملف صوت */
const beep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const play = (freq, start, duration) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.25, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + duration)
    }
    play(880, 0, 0.18)
    play(1175, 0.2, 0.25)
  } catch {
    /* المتصفح رافض الصوت قبل أي تفاعل — مش مشكلة */
  }
}

export default function Board({ user, onLogout }) {
  const [orders, setOrders] = useState([])
  const [history, setHistory] = useState([])
  const [meta, setMeta] = useState(null) // labels + transitions من السيرفر
  const [tab, setTab] = useState('all')
  const [connected, setConnected] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [flash, setFlash] = useState(null) // رسالة قصيرة بعد أي عملية

  const [soundOn, setSoundOn] = useState(() => localStorage.getItem('tablet.sound') !== 'off')
  const [autoWa, setAutoWa] = useState(() => localStorage.getItem('tablet.autowa') !== 'off')

  /* بنفتكر الأوردرات اللي شفناها — عشان نعرف الجديد ونضرب النغمة */
  const seenIds = useRef(null)

  /* ------------------------- التحميل والتحديث الدوري ------------------------- */

  const loadActive = useCallback(async () => {
    try {
      const result = await fetchActiveOrders()
      const list = result.data

      /* أوردر PENDING جديد مشفناهوش قبل كده → نغمة */
      if (seenIds.current) {
        const fresh = list.filter(
          (order) => order.status === 'PENDING' && !seenIds.current.has(order.id)
        )
        if (fresh.length && localStorage.getItem('tablet.sound') !== 'off') beep()
      }
      seenIds.current = new Set(list.map((order) => order.id))

      setOrders(list)
      setConnected(true)
    } catch {
      /* السيرفر وقع؟ بنعلّم إن الاتصال مقطوع وبنفضل نحاول */
      setConnected(false)
    }
  }, [])

  const loadHistory = useCallback(async () => {
    try {
      const result = await fetchHistoryOrders()
      setHistory(result.data)
    } catch {
      /* السجل مش حرج — التحديث الجاي هيجيبه */
    }
  }, [])

  useEffect(() => {
    fetchStatusMeta()
      .then((result) => setMeta(result.data))
      .catch(() => {})
    loadActive()

    const timer = setInterval(loadActive, POLL_MS)
    /* أول ما التابلت يرجع للتطبيق نحدّث فورًا بدل انتظار الدورة */
    const onFocus = () => loadActive()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [loadActive])

  useEffect(() => {
    if (tab === 'history') loadHistory()
  }, [tab, loadHistory])

  /* ------------------------------ تغيير الحالة ------------------------------ */

  const handleStatus = useCallback(
    async (order, status) => {
      setBusyId(order.id)

      /* لو ده قبول والواتساب التلقائي شغال: بنفتح النافذة **قبل** الطلب —
         المتصفح بيسمح بفتح نوافذ من ضغطة المستخدم بس، ولو استنينا رد
         السيرفر ممكن الـ popup blocker يمنعها. */
      let waWindow = null
      if (status === 'ACCEPTED' && localStorage.getItem('tablet.autowa') !== 'off') {
        waWindow = window.open('', '_blank')
      }

      try {
        const result = await updateOrderStatus(order.id, status)
        const updated = result.data

        if (waWindow) waWindow.location.href = whatsappUrlFor(updated)

        setOrders((current) =>
          ['COMPLETED', 'CANCELLED'].includes(updated.status)
            ? current.filter((o) => o.id !== updated.id)
            : current.map((o) => (o.id === updated.id ? updated : o))
        )
        setFlash({
          kind: 'ok',
          text: `أوردر #${updated.orderNumber} → ${meta?.labels?.[updated.status] ?? updated.status}`,
        })
      } catch (error) {
        if (waWindow) waWindow.close()
        setFlash({ kind: 'err', text: error.message })
        /* ممكن حد تاني غيّر الحالة قبلنا — نحدّث عشان نشوف الواقع */
        loadActive()
      } finally {
        setBusyId(null)
        setTimeout(() => setFlash(null), 3500)
      }
    },
    [meta, loadActive]
  )

  /* ------------------------------ العدادات ------------------------------ */

  const counts = useMemo(() => {
    const byTab = {}
    for (const t of TABS) {
      byTab[t.id] =
        t.id === 'history'
          ? null
          : orders.filter((order) => t.statuses.includes(order.status)).length
    }
    return byTab
  }, [orders])

  const shown = useMemo(() => {
    const active = TABS.find((t) => t.id === tab)
    if (tab === 'history') return history
    return orders.filter((order) => active.statuses.includes(order.status))
  }, [tab, orders, history])

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    localStorage.setItem('tablet.sound', next ? 'on' : 'off')
    if (next) beep()
  }

  const toggleAutoWa = () => {
    const next = !autoWa
    setAutoWa(next)
    localStorage.setItem('tablet.autowa', next ? 'on' : 'off')
  }

  const handleLogout = () => {
    clearSession()
    onLogout()
  }

  /* ================================ العرض ================================ */

  return (
    <div className="board">
      {/* ------------------------------ الهيدر ------------------------------ */}
      <header className="topbar">
        <div className="topbar__brand">
          <img src={logo} alt="" width="40" height="40" />
          <div>
            <b>أوردرات بشندي</b>
            <small>{user?.name}</small>
          </div>
        </div>

        <nav className="tabs" aria-label="فلترة الأوردرات">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab ${tab === t.id ? 'is-on' : ''} ${
                t.id === 'new' && counts.new > 0 ? 'tab--alert' : ''
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {counts[t.id] !== null ? <span className="tab__count">{counts[t.id]}</span> : null}
            </button>
          ))}
        </nav>

        <div className="topbar__tools">
          <button
            type="button"
            className={`tool ${soundOn ? 'is-on' : ''}`}
            onClick={toggleSound}
            title="نغمة الأوردر الجديد"
          >
            {soundOn ? '🔔' : '🔕'}
          </button>
          <button
            type="button"
            className={`tool ${autoWa ? 'is-on' : ''}`}
            onClick={toggleAutoWa}
            title="فتح واتساب التأكيد تلقائيًا عند القبول"
          >
            💬
          </button>
          <button type="button" className="tool tool--exit" onClick={handleLogout} title="خروج">
            خروج
          </button>
        </div>
      </header>

      {/* -------------------------- تنبيهات الحالة -------------------------- */}
      {!connected ? (
        <div className="alert alert--offline">⚠️ مش قادر أوصل للسيرفر — بحاول تاني…</div>
      ) : null}

      {flash ? <div className={`alert alert--${flash.kind}`}>{flash.text}</div> : null}

      {/* ------------------------------ الكروت ------------------------------ */}
      <main className="grid">
        {shown.length === 0 ? (
          <div className="empty">
            {tab === 'history' ? 'مفيش أوردرات في السجل لسه' : 'مفيش أوردرات هنا دلوقتي ✨'}
          </div>
        ) : (
          shown.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              labels={meta?.labels}
              transitions={meta?.transitions}
              onStatus={handleStatus}
              busyId={busyId}
            />
          ))
        )}
      </main>
    </div>
  )
}
