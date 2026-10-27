/**
 * ==========================================================================
 *  مناديب التوصيل — إضافة وإيقاف
 * --------------------------------------------------------------------------
 *  للأدمن بس: مين بيشتغل توصيل دلوقتي. الأسماء دي بتظهر للموظف لما
 *  يدوس "خرج من المطعم"، والزبون بياخد اسم المندوب ورقمه على الواتساب.
 *
 *  فيه حاجتين مختلفين والفرق بينهم مهم:
 *    • **إيقاف** — المندوب اللي مشي أو واخد أجازة طويلة. بيتخفي من
 *      القايمة وبيفضل موجود، فالمدير يرجّعه بنفس الرقم في أي وقت.
 *      ده اللي بيتستعمل في أغلب الوقت.
 *    • **مسح** — الكارت نفسه غلط: رقم اتكتب خطأ، اسم اتسجّل مرتين،
 *      حد اتضاف بالغلط. بيشيله من الداتا خلاص.
 *
 *  والمسح مش بيأذي السجل: اسم المندوب ورقمه متخزّنين **نسخة** جوه كل
 *  أوردر وقت التسليم، فالأوردرات القديمة تفضل مكتوب عليها نفس الاسم.
 * ==========================================================================
 */

import { useCallback, useEffect, useState } from 'react'
import { fetchRiders, addRider, updateRider, setRiderPresence, deleteRider } from '../api'

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
  /* المندوب اللي المدير دوس على سلّته ولسه مأكّدش */
  const [confirming, setConfirming] = useState(null)

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

  /* السؤال بيختفي لوحده. الشاشة في مطبخ، والمدير بيسيبها في نص
     الكلام — زرار «امسحه خلاص» مينفعش يفضل مستني حد يعدّي إيده.
     ٨ ثواني: وقت كفاية يقرا السؤال ويقرر، وقصير كفاية ميفضلش
     مفتوح. (٥ كانت بتقفل عليه وهو لسه بيقرا.) */
  useEffect(() => {
    if (!confirming) return undefined
    const timer = setTimeout(() => setConfirming(null), 8000)
    return () => clearTimeout(timer)
  }, [confirming])

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

  const remove = async (rider) => {
    setConfirming(null)
    try {
      const result = await deleteRider(rider.id)
      await load()
      onChange?.()
      /* بنقول عدد الأوردرات القديمة عن قصد — المدير لازم يعرف إن
         السجل متأثرش، وإلا يفتكر إنه ضيّع تاريخ المندوب. */
      const old = result.data?.orders ?? 0
      onFlash?.({
        kind: 'ok',
        text: old
          ? `${rider.name} اتمسح — و${old} أوردر قديم لسه مكتوب عليهم اسمه`
          : `${rider.name} اتمسح`,
      })
    } catch (error) {
      onFlash?.({ kind: 'err', text: error.message })
    }
  }

  /* خطوتين عن قصد: دي شاشة لمس وزراراها كبيرة، ودوسة بالغلط هنا
     بتشيل كارت مش بترجع. */
  const removeControls = (rider) => {
    if (!canManage) return null
    if (confirming !== rider.id) {
      return (
        <button
          type="button"
          className="rider__del"
          aria-label={`امسح ${rider.name}`}
          onClick={() => setConfirming(rider.id)}
        >
          امسح
        </button>
      )
    }
    return (
      <>
        <button type="button" className="rider__kill" onClick={() => remove(rider)}>
          امسحه خلاص
        </button>
        <button type="button" className="rider__keep" onClick={() => setConfirming(null)}>
          لأ
        </button>
      </>
    )
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
                {/* وهو بيسأل «متأكد؟» بنخفي باقي الزراير — الصف ضيّق،
                    وزرار جنب السؤال بيتدوس بالغلط. */}
                <div className="rider__actions">
                  {confirming === rider.id ? (
                    removeControls(rider)
                  ) : (
                    <>
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
                      {removeControls(rider)}
                    </>
                  )}
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
                <div className="rider__actions">
                  {confirming === rider.id ? (
                    removeControls(rider)
                  ) : (
                    <>
                      {canManage ? (
                        <button
                          type="button"
                          className="rider__start"
                          onClick={() => toggle(rider)}
                        >
                          رجّعه
                        </button>
                      ) : null}
                      {removeControls(rider)}
                    </>
                  )}
                </div>
              </div>
            ))}
          </>
        ) : null}
      </section>
    </div>
  )
}
