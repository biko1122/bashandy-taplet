import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * منع شاشة التابلت من إنها تنام.
 *
 * المشكلة: التابلت في المطبخ بيقفل شاشته بعد دقيقة، والموظف بيلاقي
 * أوردر جديد جه وهو مشافوش. Screen Wake Lock API بتحل ده — بتقول
 * للنظام "متطفّيش الشاشة طول ما الصفحة دي مفتوحة".
 *
 * تلات حاجات مهمة في التعامل معاها:
 *
 *  1. المتصفح **بيسحب** القفل لوحده أول ما الصفحة تروح ورا (تاب تاني،
 *     أو الشاشة تتقفل بإيد الموظف). عشان كده بنعيد طلبه كل ما الصفحة
 *     ترجع تبان — من غير ده بيشتغل مرة واحدة بس وبعدين يبطّل.
 *
 *  2. محتاجة HTTPS. الموقع على Vercel فده متوفر، ولوكال هوست كمان بيشتغل.
 *
 *  3. مش كل المتصفحات بتدعمها (سفاري القديم مثلًا). بنرجّع supported
 *     عشان الواجهة تخفي الزرار بدل ما توري حاجة مش شغالة.
 */
export default function useWakeLock(enabled = true) {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const sentinelRef = useRef(null)
  const [active, setActive] = useState(false)

  const release = useCallback(async () => {
    try {
      await sentinelRef.current?.release()
    } catch {
      /* اتسحب خلاص — مش مشكلة */
    }
    sentinelRef.current = null
    setActive(false)
  }, [])

  const acquire = useCallback(async () => {
    if (!supported || sentinelRef.current) return
    try {
      const sentinel = await navigator.wakeLock.request('screen')
      sentinelRef.current = sentinel
      setActive(true)
      /* المتصفح ممكن يسحبه في أي وقت — بنعلّم على ده عشان الواجهة تبان صح */
      sentinel.addEventListener('release', () => {
        sentinelRef.current = null
        setActive(false)
      })
    } catch {
      /* الجهاز رافض (بطارية ضعيفة مثلًا) — بنكمل عادي من غير قفل */
      setActive(false)
    }
  }, [supported])

  useEffect(() => {
    if (!supported) return undefined

    if (!enabled) {
      release()
      return undefined
    }

    acquire()

    /* أهم سطر في الملف: لما الصفحة ترجع تبان، القفل بيكون اتسحب —
       فلازم نطلبه تاني، وإلا الشاشة هتنام بعد أول مرة الموظف يقفلها */
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      release()
    }
  }, [enabled, supported, acquire, release])

  return { supported, active }
}
