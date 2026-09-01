/**
 * ==========================================================================
 *  صندوق الوارد — المحادثات اللي البوت رفع فيها إيده
 * --------------------------------------------------------------------------
 *  رقم المطعم هو نفسه رقم البوت. الشاشة دي هي اللي بتخلي الزبون اللي
 *  البوت مش فاهمه يلاقي بني آدم بدل ما يقف في الحيطة.
 *
 *  التصميم مقصود إنه **زي الواتساب** عشان الموظف ميتعلمش حاجة جديدة:
 *  قايمة محادثات على جنب، والكلام في النص، وخانة رد تحت.
 *
 *  ⚠️ أهم حاجة في الشاشة دي: **عدّاد الـ ٢٤ ساعة**. واتساب مبيسمحش
 *     بالرد بعد ٢٤ ساعة من آخر رسالة للزبون، ولو مخبّينا ده الموظف
 *     هيكتب رد ويفتكر إنه وصل والزبون مستني على الرصيف.
 * ==========================================================================
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchConversations,
  fetchConversation,
  claimConversation,
  releaseConversation,
  replyToConversation,
} from '../api.js'

const REFRESH_MS = 8000

/** الوقت بشكل بيقرأه الموظف بسرعة */
const timeOf = (value) =>
  new Date(value).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })

/** الوقت الفاضل في نافذة الرد — الرقم ده بيمنع رسايل ضايعة */
const windowLabel = (ms) => {
  if (ms <= 0) return { text: 'قفلت — مينفعش ترد', danger: true }
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  if (hours >= 1) return { text: `فاضل ${hours} ساعة للرد`, danger: hours < 3 }
  return { text: `فاضل ${minutes} دقيقة للرد`, danger: true }
}

const REASON_LABEL = {
  'البوت مش فاهم الزبون': '🤔 البوت مش فاهم',
  'الزبون طلب حد يكلّمه': '🙋 طلب حد يكلمه',
  'رسالة صوتية': '🎤 بعت صوت',
  'صورة أو مرفق': '🖼️ بعت صورة',
}

export default function Inbox({ onCountChange }) {
  const [conversations, setConversations] = useState([])
  const [openPhone, setOpenPhone] = useState(null)
  const [thread, setThread] = useState(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)

  const loadList = useCallback(async () => {
    try {
      /* الـ API بيرجّع { success, data } — بنفك الغلاف زي باقي الشاشات */
      const { data } = await fetchConversations()
      setConversations(data?.conversations ?? [])
      onCountChange?.(data?.waiting ?? 0)
    } catch (err) {
      setError(err.message)
    }
  }, [onCountChange])

  const loadThread = useCallback(async (phone) => {
    if (!phone) return
    try {
      setThread((await fetchConversation(phone)).data)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    loadList()
    const timer = setInterval(() => {
      if (!document.hidden) loadList()
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [loadList])

  /* المحادثة المفتوحة بتتحدّث لوحدها كمان — الزبون ممكن يكتب
     والموظف بيقرا، ولو مشفناش رسالته هيرد على كلام ناقص */
  useEffect(() => {
    if (!openPhone) return
    loadThread(openPhone)
    const timer = setInterval(() => {
      if (!document.hidden) loadThread(openPhone)
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [openPhone, loadThread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [thread?.messages?.length])

  const open = async (phone) => {
    setOpenPhone(phone)
    setThread(null)
    setDraft('')
    setError(null)
    await loadThread(phone)
    loadList()
  }

  const send = async (event) => {
    event.preventDefault()
    const message = draft.trim()
    if (!message || sending) return
    setSending(true)
    setError(null)
    try {
      setThread((await replyToConversation(openPhone, message)).data)
      setDraft('')
      loadList()
    } catch (err) {
      setError(err.message)
      /* السيرفر بيستلم المحادثة قبل ما يبعت، فحتى لو الإرسال فشل
         الحالة اتغيّرت. من غير التحديث ده الشاشة بتفضل تقول "لسه مع
         البوت" وهي مش كده. والرسالة الفاشلة بتفضل مكتوبة عشان
         الموظف ينسخها ويبعتها بطريقة تانية بدل ما يعيد كتابتها. */
      loadThread(openPhone)
      loadList()
    } finally {
      setSending(false)
    }
  }

  const take = async () => {
    try {
      setThread((await claimConversation(openPhone)).data)
      loadList()
    } catch (err) {
      setError(err.message)
    }
  }

  const giveBack = async () => {
    try {
      await releaseConversation(openPhone)
      setOpenPhone(null)
      setThread(null)
      loadList()
    } catch (err) {
      setError(err.message)
    }
  }

  const win = thread ? windowLabel(thread.windowLeftMs) : null
  const canReply = thread ? thread.windowLeftMs > 0 : false

  return (
    <div className="inbox">
      {/* ---------------------------- قايمة المحادثات ---------------------------- */}
      <aside className="inbox__list">
        {conversations.length === 0 ? (
          <p className="inbox__empty">
            مفيش محادثات محتاجة رد 👌
            <small>البوت شايل الدنيا. أول ما يقف، المحادثة هتظهر هنا.</small>
          </p>
        ) : (
          conversations.map((c) => (
            <button
              key={c.phone}
              type="button"
              className={`convo ${openPhone === c.phone ? 'is-on' : ''} ${
                c.handoff === 'WAITING' ? 'convo--waiting' : ''
              }`}
              onClick={() => open(c.phone)}
            >
              <div className="convo__top">
                <b>{c.name || c.phone.replace(/^20/, '0')}</b>
                {c.unread > 0 ? <span className="convo__unread">{c.unread}</span> : null}
              </div>
              <div className="convo__reason">
                {REASON_LABEL[c.reason] ?? (c.handoff === 'HUMAN' ? '👤 مع موظف' : c.reason || '')}
              </div>
              <div className="convo__preview">{c.lastMessage || '—'}</div>
              <div className="convo__time">{timeOf(c.lastAt)}</div>
            </button>
          ))
        )}
      </aside>

      {/* ------------------------------- المحادثة ------------------------------- */}
      <section className="inbox__thread">
        {!openPhone ? (
          <p className="inbox__empty">اختار محادثة من الشمال</p>
        ) : !thread ? (
          <p className="inbox__empty">بيحمّل…</p>
        ) : (
          <>
            <header className="thread__head">
              <div>
                <b>{thread.name || thread.phone.replace(/^20/, '0')}</b>
                <small dir="ltr">{thread.phone.replace(/^20/, '0')}</small>
              </div>
              <div className="thread__actions">
                <span className={`thread__window ${win.danger ? 'is-danger' : ''}`}>
                  ⏱️ {win.text}
                </span>
                {thread.handoff === 'HUMAN' ? (
                  <button type="button" className="tool tool--wide" onClick={giveBack}>
                    ↩️ رجّعها للبوت
                  </button>
                ) : (
                  <button type="button" className="tool tool--wide" onClick={take}>
                    ✋ استلم المحادثة
                  </button>
                )}
              </div>
            </header>

            {thread.handoff === 'HUMAN' ? (
              <p className="thread__note">البوت ساكت دلوقتي — إنت اللي بترد.</p>
            ) : (
              <p className="thread__note thread__note--warn">
                لسه مع البوت. أول ما تبعت رد، المحادثة بتبقى بتاعتك والبوت بيسكت.
              </p>
            )}

            <div className="thread__body">
              {thread.messages.map((m) => (
                <div
                  key={m.id}
                  className={`bubble ${m.direction === 'IN' ? 'bubble--in' : 'bubble--out'}`}
                >
                  {m.body ? (
                    <p>{m.body}</p>
                  ) : (
                    <p className="bubble__media">
                      {m.kind === 'audio' ? '🎤 رسالة صوتية' : `📎 ${m.kind}`} — افتحها من الموبايل
                    </p>
                  )}
                  <span className="bubble__meta">
                    {m.direction === 'OUT' ? (m.sentBy === 'BOT' ? 'البوت' : m.sentBy) : ''}{' '}
                    {timeOf(m.receivedAt)}
                  </span>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {error ? <p className="thread__error">{error}</p> : null}

            <form className="thread__reply" onSubmit={send}>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={canReply ? 'اكتب ردك…' : 'عدّى ٢٤ ساعة — كلّمه بالتليفون'}
                rows={2}
                disabled={!canReply || sending}
              />
              <button type="submit" disabled={!canReply || sending || !draft.trim()}>
                {sending ? '…' : 'إرسال'}
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  )
}
