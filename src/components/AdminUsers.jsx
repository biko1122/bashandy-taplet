/**
 * ==========================================================================
 *  حسابات الموظفين — إضافة وقفل وتغيير باسورد
 * --------------------------------------------------------------------------
 *  ليه الشاشة دي موجودة: قبلها كان الحساب بيتعمل بأمر على جهاز المطوّر،
 *  والأمر ده بيكتب في القاعدة اللي في .env المحلي — يعني قاعدة التطوير
 *  مش السيرفر الحقيقي. صاحب المحل عمل حسابات وافتكرها اتعملت، والموظف
 *  وقف قدام التابلت مش عارف يدخل. الشاشة دي بتكلّم السيرفر اللي التابلت
 *  شغال عليه فعلًا، فمفيش مجال للّبس ده.
 *
 *  ⚠️ الباسورد مبيترجعش من السيرفر أبدًا — متخزّن مشفّر. لما تعمل حساب
 *     أو تغيّر باسورد، بنوري القيمة **مرة واحدة** على الشاشة عشان
 *     تكتبها، وبعدها خلاص.
 * ==========================================================================
 */

import { useCallback, useEffect, useState } from 'react'
import { fetchUsers, addUser, updateUser, resetUserPassword } from '../api'

const ROLE_LABEL = { ADMIN: 'مدير', STAFF: 'موظف' }

const lastSeen = (iso) => {
  if (!iso) return 'لسه مدخلش'
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000)
  if (days === 0) return 'دخل النهاردة'
  if (days === 1) return 'دخل امبارح'
  return `آخر دخول من ${days} يوم`
}

export default function AdminUsers({ me, onFlash }) {
  const [users, setUsers] = useState([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('STAFF')
  const [busy, setBusy] = useState(false)
  /* الباسورد اللي لسه اتعمل — بيتعرض مرة واحدة بس */
  const [shown, setShown] = useState(null)
  const [resetting, setResetting] = useState(null)

  const load = useCallback(
    () =>
      fetchUsers()
        .then((r) => setUsers(r.data ?? []))
        .catch((e) => onFlash?.({ kind: 'err', text: e.message })),
    [onFlash]
  )

  useEffect(() => {
    load()
  }, [load])

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    const n = name.trim()
    const e = email.trim().toLowerCase()
    if (n.length < 2 || !e || password.length < 8) return

    setBusy(true)
    try {
      await addUser(n, e, password, role)
      setShown({ name: n, email: e, password })
      setName('')
      setEmail('')
      setPassword('')
      setRole('STAFF')
      await load()
      onFlash?.({ kind: 'ok', text: `حساب ${n} اتعمل ✅` })
    } catch (error) {
      onFlash?.({ kind: 'err', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (user) => {
    try {
      await updateUser(user.id, { isActive: !user.isActive })
      await load()
    } catch (error) {
      onFlash?.({ kind: 'err', text: error.message })
    }
  }

  const doReset = async (user) => {
    const value = (resetting?.value ?? '').trim()
    if (value.length < 8) return
    try {
      await resetUserPassword(user.id, value)
      setShown({ name: user.name, email: user.email, password: value })
      setResetting(null)
      onFlash?.({ kind: 'ok', text: `باسورد ${user.name} اتغيّر ✅` })
    } catch (error) {
      onFlash?.({ kind: 'err', text: error.message })
    }
  }

  const active = users.filter((u) => u.isActive)
  const closed = users.filter((u) => !u.isActive)

  const row = (user) => (
    <div className={`urow ${user.isActive ? '' : 'urow--off'}`} key={user.id}>
      <div className="urow__who">
        <b>
          {user.name}
          <span className={`urow__role urow__role--${user.role.toLowerCase()}`}>
            {ROLE_LABEL[user.role] ?? user.role}
          </span>
          {user.id === me?.id ? <span className="urow__me">انت</span> : null}
        </b>
        <small dir="ltr">{user.email}</small>
        <small>{lastSeen(user.lastLoginAt)}</small>
      </div>

      {resetting?.id === user.id ? (
        <div className="urow__reset">
          <input
            id={`pw-${user.id}`}
            value={resetting.value}
            onChange={(e) => setResetting({ id: user.id, value: e.target.value })}
            placeholder="الباسورد الجديد (٨ على الأقل)"
            dir="ltr"
            autoFocus
          />
          <button type="button" onClick={() => doReset(user)} disabled={resetting.value.trim().length < 8}>
            غيّره
          </button>
          <button type="button" className="urow__ghost" onClick={() => setResetting(null)}>
            لأ
          </button>
        </div>
      ) : (
        <div className="urow__actions">
          <button type="button" onClick={() => setResetting({ id: user.id, value: '' })}>
            باسورد جديد
          </button>
          {/* السيرفر بيمنع المدير يقفل نفسه، وبنخفي الزرار كمان عشان
              محدش يحاول أصلًا */}
          {user.id === me?.id ? null : (
            <button
              type="button"
              className={user.isActive ? 'urow__stop' : 'urow__start'}
              onClick={() => toggle(user)}
            >
              {user.isActive ? 'اقفل' : 'رجّعه'}
            </button>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="users">
      {shown ? (
        <div className="users__shown" role="status">
          <b>اكتب البيانات دي دلوقتي — مش هتظهر تاني</b>
          <div>
            <span>{shown.name}</span>
            <code dir="ltr">{shown.email}</code>
            <code dir="ltr">{shown.password}</code>
          </div>
          <button type="button" onClick={() => setShown(null)}>
            كتبتها، اقفل
          </button>
        </div>
      ) : null}

      <form className="users__form" onSubmit={submit}>
        <h2>👤 ضيف حساب</h2>
        <div className="users__fields">
          <input
            id="u-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="الاسم (مثلًا: أحمد)"
            maxLength={60}
          />
          <input
            id="u-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="اسم الدخول (ahmed@bashandy.local)"
            dir="ltr"
            autoComplete="off"
          />
          <input
            id="u-pass"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="الباسورد (٨ على الأقل)"
            dir="ltr"
            autoComplete="new-password"
          />
          <select id="u-role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="STAFF">موظف</option>
            <option value="ADMIN">مدير</option>
          </select>
          <button type="submit" disabled={busy || name.trim().length < 2 || !email.trim() || password.length < 8}>
            {busy ? '…' : 'إضافة'}
          </button>
        </div>
        <small>
          اسم الدخول مش لازم يكون إيميل حقيقي — خلّيه <b>اسم@bashandy.local</b>.
          والباسورد الموظف هيكتبه كل يوم على شاشة لمس، فخلّيه سهل.
        </small>
      </form>

      <section className="users__list">
        <h3>الحسابات الشغالة ({active.length})</h3>
        {active.map(row)}

        {closed.length ? (
          <>
            <h3>مقفولة ({closed.length})</h3>
            {closed.map(row)}
          </>
        ) : null}
      </section>

      <p className="users__note">
        <b>الموظف</b> بيشوف الأوردرات والمحادثات، ويعلّم المناديب حاضر/غايب،
        ويصفّر أرقام الأوردرات. <b>المدير</b> كمان بيغيّر الأسعار ويشوف الشكاوى
        ويضيف مناديب وحسابات.
      </p>
    </div>
  )
}
