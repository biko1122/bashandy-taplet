import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchComplaints, fetchComplaint, updateComplaint } from '../api'

/**
 * لوحة الشكاوي — لمدير المحل بس.
 *
 * الزرار مش بيظهر أصلاً لموظف التابلت، والسيرفر كمان بيرد 403 على أي
 * حساب مش ADMIN — يعني حتى لو حد عرف اللينك مش هيشوف حاجة.
 *
 * الشكوى بتعدّي بتلات حالات: جديدة → بنشوفها → اتحلّت.
 * لما تفتح شكوى بنجيب معاها آخر أوردرات صاحب الرقم، عشان المدير
 * يبقى شايف تاريخ الزبون وهو بيكلّمه.
 */

const STATUSES = [
  { id: 'NEW', label: 'جديدة', icon: '🔴' },
  { id: 'REVIEWING', label: 'بنشوفها', icon: '🟡' },
  { id: 'RESOLVED', label: 'اتحلّت', icon: '🟢' },
]

const TABS = [
  { id: 'open', label: 'المفتوحة', match: (c) => c.status !== 'RESOLVED' },
  { id: 'NEW', label: 'جديدة', match: (c) => c.status === 'NEW' },
  { id: 'RESOLVED', label: 'اتحلّت', match: (c) => c.status === 'RESOLVED' },
  { id: 'all', label: 'الكل', match: () => true },
]

/** "من ٣ ساعات" — أسهل من التاريخ الكامل وإحنا بنتابع */
const since = (iso) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'دلوقتي'
  if (minutes < 60) return `من ${minutes} دقيقة`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `من ${hours} ساعة`
  const days = Math.round(hours / 24)
  return days === 1 ? 'من يوم' : `من ${days} يوم`
}

export default function AdminComplaints({ onFlash }) {
  const [list, setList] = useState(null) // null = لسه بيحمّل
  const [tab, setTab] = useState('open')
  const [openId, setOpenId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    fetchComplaints()
      .then((result) => {
        setList(result.data)
        setError(null)
      })
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /* أول ما نفتح شكوى بنجيب تفاصيلها (فيها أوردرات الزبون) */
  useEffect(() => {
    if (!openId) {
      setDetail(null)
      return
    }
    let cancelled = false
    setDetail(null)
    fetchComplaint(openId)
      .then((result) => {
        if (cancelled) return
        setDetail(result.data)
        setNote(result.data.adminNote ?? '')
      })
      .catch((err) => !cancelled && onFlash({ kind: 'err', text: err.message }))
    return () => {
      cancelled = true
    }
  }, [openId, onFlash])

  const shown = useMemo(() => {
    if (!list) return []
    const active = TABS.find((t) => t.id === tab)
    return list.filter(active.match)
  }, [list, tab])

  const counts = useMemo(() => {
    const out = {}
    for (const t of TABS) out[t.id] = (list ?? []).filter(t.match).length
    return out
  }, [list])

  /* --------------------------- الحفظ --------------------------- */

  const apply = async (patch, successText) => {
    setBusy(true)
    try {
      const result = await updateComplaint(openId, patch)
      const updated = result.data
      setDetail((current) => ({ ...current, ...updated }))
      setList((current) => current.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)))
      onFlash({ kind: 'ok', text: successText })
    } catch (err) {
      onFlash({ kind: 'err', text: err.message })
    } finally {
      setBusy(false)
      setTimeout(() => onFlash(null), 3500)
    }
  }

  /* --------------------------- العرض --------------------------- */

  if (error) {
    return (
      <div className="cmp">
        <div className="empty">
          ⚠️ {error}
          <br />
          <button
            type="button"
            className="btn btn--primary"
            onClick={load}
            style={{ marginTop: '1rem' }}
          >
            جرّب تاني
          </button>
        </div>
      </div>
    )
  }

  if (!list) {
    return (
      <div className="cmp">
        <div className="empty">بجيب الشكاوي…</div>
      </div>
    )
  }

  return (
    <div className="cmp">
      <div className="cmp__head">
        <h2 className="cmp__title">📣 شكاوي الزباين</h2>

        <nav className="cmp__tabs" aria-label="فلترة الشكاوي">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`cmp__tab ${tab === t.id ? 'is-on' : ''} ${
                t.id === 'NEW' && counts.NEW > 0 ? 'cmp__tab--alert' : ''
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              <span className="cmp__tab-count">{counts[t.id]}</span>
            </button>
          ))}
        </nav>

        <button type="button" className="btn btn--ghost cmp__refresh" onClick={load}>
          ↻ تحديث
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="empty">مفيش شكاوي هنا ✨</div>
      ) : (
        <ul className="cmp__list">
          {shown.map((complaint) => {
            const status = STATUSES.find((s) => s.id === complaint.status)
            const isOpen = openId === complaint.id

            return (
              <li
                key={complaint.id}
                className={`cmp__item cmp__item--${complaint.status.toLowerCase()} ${
                  isOpen ? 'is-open' : ''
                }`}
              >
                <button
                  type="button"
                  className="cmp__row"
                  onClick={() => setOpenId(isOpen ? null : complaint.id)}
                  aria-expanded={isOpen}
                >
                  <span className="cmp__badge">
                    {status?.icon} {status?.label}
                  </span>

                  <span className="cmp__who">
                    <b>{complaint.name}</b>
                    <span className="cmp__phone num" dir="ltr">
                      {complaint.phoneDisplay}
                    </span>
                  </span>

                  <span className="cmp__peek">{complaint.message}</span>

                  <span className="cmp__when">
                    {since(complaint.createdAt)}
                    <span className="cmp__num num">#{complaint.number}</span>
                  </span>
                </button>

                {isOpen ? (
                  <div className="cmp__detail">
                    {!detail ? (
                      <p className="cmp__loading">بجيب التفاصيل…</p>
                    ) : (
                      <>
                        <p className="cmp__message">{detail.message}</p>

                        <div className="cmp__facts">
                          <a href={`tel:${detail.phone}`} className="cmp__action">
                            📞 كلّمه
                          </a>
                          <a
                            href={`https://wa.me/${detail.phone}`}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="cmp__action"
                          >
                            💬 واتساب
                          </a>
                          {detail.orderNumber ? (
                            <span className="cmp__fact num">
                              الشكوى على أوردر #{detail.orderNumber}
                            </span>
                          ) : null}
                        </div>

                        {/* أوردرات الزبون — عشان المدير يبقى شايف تاريخه */}
                        {detail.recentOrders?.length ? (
                          <div className="cmp__orders">
                            <h4>آخر أوردراته</h4>
                            <ul>
                              {detail.recentOrders.map((order) => (
                                <li key={order.id}>
                                  <span className="num">#{order.number}</span>
                                  <span className="num">{order.total} ج.م</span>
                                  <span>{new Date(order.createdAt).toLocaleDateString('ar-EG')}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <p className="cmp__noorders">
                            مفيش أوردرات على الرقم ده في النظام
                          </p>
                        )}

                        {/* الحالة */}
                        <div className="cmp__states">
                          {STATUSES.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              className={`cmp__state ${
                                detail.status === s.id ? 'is-on' : ''
                              }`}
                              disabled={busy || detail.status === s.id}
                              onClick={() =>
                                apply(
                                  { status: s.id },
                                  `شكوى #${detail.number} → ${s.label}`
                                )
                              }
                            >
                              {s.icon} {s.label}
                            </button>
                          ))}
                        </div>

                        {/* ملاحظة داخلية */}
                        <div className="cmp__note">
                          <label htmlFor={`note-${detail.id}`}>
                            ملاحظة داخلية <small>(الزبون مبيشوفهاش)</small>
                          </label>
                          <textarea
                            id={`note-${detail.id}`}
                            rows={2}
                            maxLength={1000}
                            value={note}
                            placeholder="إيه اللي اتعمل؟"
                            onChange={(e) => setNote(e.target.value)}
                          />
                          <button
                            type="button"
                            className="btn btn--save"
                            disabled={busy || note === (detail.adminNote ?? '')}
                            onClick={() =>
                              apply({ adminNote: note }, `الملاحظة اتحفظت`)
                            }
                          >
                            {busy ? '…' : '✓ احفظ الملاحظة'}
                          </button>
                        </div>

                        {detail.handledBy ? (
                          <p className="cmp__handler">
                            👤 آخر واحد تابعها: {detail.handledBy}
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
