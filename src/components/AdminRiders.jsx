/**
 * ==========================================================================
 *  مناديب التوصيل — إضافة وإيقاف
 * --------------------------------------------------------------------------
 *  للأدمن بس: مين بيشتغل توصيل دلوقتي. الأسماء دي بتظهر للموظف لما
 *  يدوس "خرج من المطعم"، والزبون بياخد اسم المندوب ورقمه على الواتساب.
 *
 *  ⚠️ المندوب اللي مشي **بيتقفل مش بيتمسح** — اسمه مكتوب على أوردرات
 *     قديمة، والمسح كان هيضيّعه من السجل.
 * ==========================================================================
 */

import { useCallback, useEffect, useState } from 'react'
import { fetchRiders, addRider, updateRider, setRiderPresence } from '../api'

const displayPhone = (phone) => {
  if (phone?.startsWith('20') && phone.length === 12) {
    const local = '0' + phone.slice(2)
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`
  }
  return phone
}

export default function AdminRiders({ user, onFlash, onChange }) {
  const canManage = user?.role === 'ADMIN'
  const [riders, setRiders] = useState([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(
    () =>
      fetchRiders(true)
        .then((r) => setRiders(r.data ?? []))
        .catch((e) => onFlash?.({ kind: 'err', text: e.message })),
    [onFlash]
  )

  useEffect(() => {
    load()
  }, [load])

  const submit = async (event) => {
    event.preventDefault()
    if (!name.trim() || !phone.trim() || busy) return
    setBusy(true)
    try {
      await addRider(name.trim(), phone.trim())
      setName('')
      setPhone('')
      await load()
      onChange?.()
      onFlash?.({ kind: 'ok', text: 'المندوب اتضاف ✅' })
    } catch (error) {
      onFlash?.({ kind: 'err', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (rider) => {
    try {
      await updateRider(rider.id, { isActive: !rider.isActive })
      await load()
      onChange?.()
    } catch (error) {
      onFlash?.({ kind: 'err', text: error.message })
    }
  }

  /* حاضر / غايب — ده اللي بيتغيّر كل شيفت، فأي موظف يقدر يدوسه.
     بنغيّر الشاشة على طول من غير ما نستنى السيرفر، عشان الدوسة
     تبان فورًا؛ ولو فشلت بنرجّع الحالة ونقول السبب. */
  const togglePresence = async (rider) => {
    const next = !rider.isPresent
    setRiders((list) => list.map((r) => (r.id === rider.id ? { ...r, isPresent: next } : r)))
    try {
      await setRiderPresence(rider.id, next)
      onChange?.()
    } catch (error) {
      setRiders((list) => list.map((r) => (r.id === rider.id ? { ...r, isPresent: !next } : r)))
      onFlash?.({ kind: 'err', text: error.message })
    }
  }

  const active = riders.filter((r) => r.isActive)
  const stopped = riders.filter((r) => !r.isActive)
  const here = active.filter((r) => r.isPresent).length

  return (
    <div className="riders">
      {canManage ? (
      <form className="riders__form" onSubmit={submit}>
        <h2>🛵 ضيف مندوب</h2>
        <div className="riders__fields">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="الاسم"
            maxLength={60}
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="الموبايل (01xxxxxxxxx)"
            dir="ltr"
            inputMode="tel"
          />
          <button type="submit" disabled={busy || !name.trim() || !phone.trim()}>
            {busy ? '…' : 'إضافة'}
          </button>
        </div>
        <small>الرقم ده بيوصل للزبون في رسالة الواتساب — خلي بالك يكون صح.</small>
      </form>
      ) : null}

      <section className="riders__list">
        <h3>
          شغالين ({active.length}) · <span className="riders__here">حاضر دلوقتي {here}</span>
        </h3>
        {active.length === 0 ? (
          <p className="riders__empty">مفيش مناديب شغالين — الأوردرات مش هتقدر تخرج.</p>
        ) : (
          <>
            {here === 0 ? (
              <p className="riders__empty">محدش معلّم حاضر — دوس «حاضر» على اللي في الشيفت.</p>
            ) : null}
            {active.map((rider) => (
              <div className={`rider ${rider.isPresent ? '' : 'rider--away'}`} key={rider.id}>
                <div>
                  <b>{rider.name}</b>
                  <small dir="ltr">{displayPhone(rider.phone)}</small>
                </div>
                <div className="rider__actions">
                  <button
                    type="button"
                    className={`rider__here ${rider.isPresent ? 'is-on' : ''}`}
                    aria-pressed={Boolean(rider.isPresent)}
                    onClick={() => togglePresence(rider)}
                  >
                    {rider.isPresent ? '✓ حاضر' : 'غايب'}
                  </button>
                  {canManage ? (
                    <button type="button" className="rider__stop" onClick={() => toggle(rider)}>
                      إيقاف
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </>
        )}

        {stopped.length ? (
          <>
            <h3>متوقفين ({stopped.length})</h3>
            {stopped.map((rider) => (
              <div className="rider rider--off" key={rider.id}>
                <div>
                  <b>{rider.name}</b>
                  <small dir="ltr">{displayPhone(rider.phone)}</small>
                </div>
                {canManage ? (
                  <button type="button" className="rider__start" onClick={() => toggle(rider)}>
                    رجّعه
                  </button>
                ) : null}
              </div>
            ))}
          </>
        ) : null}
      </section>
    </div>
  )
}
