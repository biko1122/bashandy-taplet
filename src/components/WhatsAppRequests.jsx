import { useCallback, useEffect, useState } from 'react'
import { fetchWhatsAppRequests, updateWhatsAppRequest } from '../api'

/**
 * طلبات الواتساب.
 *
 * دي مش أوردرات جاهزة — دي كلام الزبون زي ما كتبه في الشات. الموظف
 * بيقراه، يكلّم الزبون يأكد الأصناف والحساب، وبعدين يعلّم إنه سجّله.
 *
 * ليه مش أوردر عادي؟ لأن الأوردر عندنا لازم أصنافه مربوطة بالمنيو
 * وسعره متحسوب من القاعدة. كلام زي "٢ فول وطعمية" محدش يقدر يحوّله
 * لأسعار غير بني آدم.
 */

const since = (iso) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'دلوقتي'
  if (m < 60) return `من ${m} دقيقة`
  const h = Math.round(m / 60)
  if (h < 24) return `من ${h} ساعة`
  const d = Math.round(h / 24)
  return d === 1 ? 'من يوم' : `من ${d} يوم`
}

export default function WhatsAppRequests({ onFlash, onCountChange }) {
  const [list, setList] = useState(null)
  const [showDone, setShowDone] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    fetchWhatsAppRequests()
      .then((result) => {
        setList(result.data)
        setError(null)
        onCountChange?.(result.newCount ?? 0)
      })
      .catch((err) => setError(err.message))
  }, [onCountChange])

  useEffect(() => {
    load()
    /* الطلبات بتيجي في أي وقت — بنحدّث كل ١٥ ثانية */
    const timer = setInterval(load, 15000)
    return () => clearInterval(timer)
  }, [load])

  const act = async (request, status) => {
    setBusyId(request.id)
    try {
      const result = await updateWhatsAppRequest(request.id, status)
      setList((current) => current.map((r) => (r.id === result.data.id ? result.data : r)))
      onFlash({
        kind: 'ok',
        text:
          status === 'HANDLED'
            ? `طلب #${request.number} اتسجّل ✓`
            : `طلب #${request.number} اتلغى`,
      })
      load()
    } catch (err) {
      /* غالبًا تابلت تاني سبقنا — بنحدّث عشان نشوف الواقع */
      onFlash({ kind: 'err', text: err.message })
      load()
    } finally {
      setBusyId(null)
      setTimeout(() => onFlash(null), 3500)
    }
  }

  if (error) {
    return (
      <div className="war">
        <div className="empty">
          ⚠️ {error}
          <br />
          <button type="button" className="btn btn--primary" onClick={load} style={{ marginTop: '1rem' }}>
            جرّب تاني
          </button>
        </div>
      </div>
    )
  }

  if (!list) {
    return (
      <div className="war">
        <div className="empty">بجيب الطلبات…</div>
      </div>
    )
  }

  const shown = list.filter((r) => (showDone ? true : r.status === 'NEW'))

  return (
    <div className="war">
      <div className="war__head">
        <h2 className="war__title">💬 طلبات الواتساب</h2>
        <p className="war__hint">
          دي كلام الزبون زي ما كتبه — كلّمه أكّد الطلب والحساب، وبعدين علّم إنك سجّلته.
        </p>
        <label className="war__toggle">
          <input
            type="checkbox"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
          />
          ورّيني اللي خلص كمان
        </label>
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          {showDone ? 'مفيش طلبات واتساب لسه' : 'مفيش طلبات جديدة ✨'}
        </div>
      ) : (
        <ul className="wlist">
          {shown.map((r) => {
            const busy = busyId === r.id
            const done = r.status !== 'NEW'

            return (
              <li className={`wcard ${done ? 'wcard--done' : ''}`} key={r.id}>
                <div className="wcard__head">
                  <span className="wcard__num num">#{r.number}</span>
                  <span className="wcard__time">{since(r.createdAt)}</span>
                  {done ? (
                    <span className="wcard__state">
                      {r.status === 'HANDLED' ? '✓ اتسجّل' : 'اتلغى'}
                      {r.handledBy ? ` — ${r.handledBy}` : ''}
                    </span>
                  ) : null}
                </div>

                {/* الطلب نفسه — أهم حاجة في الكارت */}
                <p className="wcard__text">{r.text}</p>

                <div className="wcard__who">
                  <span className="wcard__name">👤 {r.name}</span>
                  <span className="wcard__phone num" dir="ltr">
                    {r.phoneDisplay}
                  </span>
                </div>

                <p className="wcard__address">📍 {r.address}</p>

                <div className="wcard__actions">
                  <a href={`tel:${r.phone}`} className="btn btn--call">
                    📞 كلّمه
                  </a>
                  <a
                    href={`https://wa.me/${r.phone}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="btn btn--wa"
                  >
                    💬 واتساب
                  </a>

                  {!done ? (
                    <>
                      <button
                        type="button"
                        className="btn btn--save"
                        disabled={busy}
                        onClick={() => act(r, 'HANDLED')}
                      >
                        {busy ? '…' : '✓ سجّلته'}
                      </button>
                      <button
                        type="button"
                        className="btn btn--cancel"
                        disabled={busy}
                        onClick={() => act(r, 'CANCELLED')}
                      >
                        إلغاء
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
