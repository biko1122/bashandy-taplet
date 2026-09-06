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
import { fetchRiders, addRider, updateRider } from '../api'

const displayPhone = (phone) => {
  if (phone?.startsWith('20') && phone.length === 12) {
    const local = '0' + phone.slice(2)
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`
  }
  return phone
}

export default function AdminRiders({ onFlash, onChange }) {
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

  const active = riders.filter((r) => r.isActive)
  const stopped = riders.filter((r) => !r.isActive)

  return (
    <div className="riders">
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

      <section className="riders__list">
        <h3>شغالين ({active.length})</h3>
        {active.length === 0 ? (
          <p className="riders__empty">مفيش مناديب شغالين — الأوردرات مش هتقدر تخرج.</p>
        ) : (
          active.map((rider) => (
            <div className="rider" key={rider.id}>
              <div>
                <b>{rider.name}</b>
                <small dir="ltr">{displayPhone(rider.phone)}</small>
              </div>
              <button type="button" className="rider__stop" onClick={() => toggle(rider)}>
                إيقاف
              </button>
            </div>
          ))
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
                <button type="button" className="rider__start" onClick={() => toggle(rider)}>
                  رجّعه
                </button>
              </div>
            ))}
          </>
        ) : null}
      </section>
    </div>
  )
}
