import { useState } from 'react'

/* أسماء الأزرار — المسار المتبسط: اقبل → جاهز → خرج */
const ACTION_LABELS = {
  ACCEPTED: '✓ اقبل الأوردر',
  READY: '🔔 جاهز',
  COMPLETED: '🛵 خرج من المطعم',
  CANCELLED: 'إلغاء',
}

const SOURCE_LABELS = {
  WEBSITE: '🌐 الموقع',
  WHATSAPP: '💬 واتساب',
  TABLET: '📱 تابلت',
  PHONE: '☎️ تليفون',
}

/** الرقم للعرض: 201551627977 → 0155 162 7977 */
const displayPhone = (phone) => {
  if (phone?.startsWith('20') && phone.length === 12) {
    const local = '0' + phone.slice(2)
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`
  }
  return phone
}

/** وقت الأوردر: "12:30 م · من 5 د" */
const timeInfo = (createdAt) => {
  const date = new Date(createdAt)
  const time = date.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000))
  const ago =
    minutes < 1 ? 'دلوقتي' : minutes < 60 ? `من ${minutes} د` : `من ${Math.floor(minutes / 60)} س ${minutes % 60} د`
  return { time, ago }
}

/**
 * كارت الأوردر — كل حاجة الموظف محتاج يشوفها من غير ما يفتح أي حاجة تانية:
 * العميل كامل (اسم/رقم/عنوان)، الأصناف باختياراتها، الملاحظة، والإجمالي.
 */
export default function OrderCard({ order, labels, transitions, onStatus, busyId }) {
  /* الإلغاء على خطوتين عشان مفيش إلغاء بالغلط بصباع على الشاشة */
  const [confirmCancel, setConfirmCancel] = useState(false)

  const busy = busyId === order.id
  const allowed = transitions?.[order.status] ?? []
  const { time, ago } = timeInfo(order.createdAt)
  const isDelivery = order.type === 'DELIVERY'

  const handleAction = (status) => {
    if (status === 'CANCELLED' && !confirmCancel) {
      setConfirmCancel(true)
      /* لو نسي، بيرجع لوحده بعد 4 ثواني */
      setTimeout(() => setConfirmCancel(false), 4000)
      return
    }
    setConfirmCancel(false)
    onStatus(order, status)
  }

  return (
    <article className={`ocard ocard--${order.status.toLowerCase()}`}>
      {/* الزبون طلب الإلغاء من الواتساب — بيبان قبل أي حاجة تانية
          عشان الموظف مايجهّزش أوردر الزبون مبقاش عايزه */}
      {order.cancelRequestedAt ? (
        <div className="ocard__cancelreq">
          ⚠️ الزبون طالب <b>إلغاء الأوردر</b> — كلّمه قبل ما تكمّل
        </div>
      ) : null}

      {/* ---------------- الهيدر: الرقم والوقت والحالة ---------------- */}
      <header className="ocard__head">
        <span className="ocard__number">#{order.orderNumber}</span>

        <div className="ocard__badges">
          <span className={`badge badge--${order.status.toLowerCase()}`}>
            {labels?.[order.status] ?? order.status}
          </span>
          <span className="badge badge--type">{isDelivery ? '🛵 توصيل' : '🏪 استلام'}</span>
          <span className="badge badge--source">{SOURCE_LABELS[order.source] ?? order.source}</span>
        </div>

        <span className="ocard__time">
          {time} <b>· {ago}</b>
        </span>
      </header>

      {/* مين ماسك الأوردر — مهم جدًا مع أكتر من تابلت */}
      {order.handledBy && order.status !== 'PENDING' ? (
        <p className="ocard__handler">👤 بيشتغل عليه: <b>{order.handledBy}</b></p>
      ) : null}

      {/* ---------------- العميل: الاسم والرقم والعنوان كاملين ---------------- */}
      <div className="ocard__customer">
        <p className="ocard__cname">{order.customer.name}</p>

        <a className="ocard__phone" href={`tel:+${order.customer.phone}`} dir="ltr">
          📞 {displayPhone(order.customer.phone)}
        </a>

        {isDelivery ? (
          <p className="ocard__address">
            <span className="ocard__address-label">العنوان:</span> {order.deliveryAddress}
          </p>
        ) : (
          <p className="ocard__address ocard__address--pickup">هيستلم من الفرع بنفسه</p>
        )}
      </div>

      {/* ---------------- ملاحظة العميل — لازم تبان جامد ---------------- */}
      {order.note ? <p className="ocard__note">📝 {order.note}</p> : null}

      {/* ---------------- الأصناف ---------------- */}
      <ul className="ocard__items">
        {order.items.map((item) => (
          <li className="ocard__item" key={item.id}>
            <span className="ocard__qty">{item.quantity}×</span>
            <span className="ocard__iname">
              {item.productName}
              {item.options.length ? (
                <em className="ocard__opts">
                  {item.options.map((option) => `${option.groupName}: ${option.choiceName}`).join(' · ')}
                </em>
              ) : null}
            </span>
            <span className="ocard__iprice">{item.lineTotal} ج</span>
          </li>
        ))}
      </ul>

      {/* ---------------- الإجمالي ---------------- */}
      <div className="ocard__total">
        <span>الإجمالي</span>
        <b>{order.total} ج.م</b>
        {isDelivery && !order.deliveryFee ? (
          <small>غير شامل التوصيل — اتفق مع العميل</small>
        ) : null}
      </div>

      {/* ---------------- الأزرار ---------------- */}
      <div className="ocard__actions">
        {allowed
          .filter((status) => status !== 'CANCELLED')
          .map((status) => (
            <button
              key={status}
              type="button"
              className={`btn btn--advance btn--to-${status.toLowerCase()}`}
              disabled={busy}
              onClick={() => handleAction(status)}
            >
              {busy ? '…' : ACTION_LABELS[status]}
            </button>
          ))}

        {allowed.includes('CANCELLED') ? (
          <button
            type="button"
            className={`btn btn--cancel ${confirmCancel ? 'is-confirm' : ''}`}
            disabled={busy}
            onClick={() => handleAction('CANCELLED')}
          >
            {confirmCancel ? 'متأكد؟ دوس تاني للإلغاء' : ACTION_LABELS.CANCELLED}
          </button>
        ) : null}
      </div>
    </article>
  )
}
