/**
 * ==========================================================================
 *  الاتصال بالباكند — نسخة التابلت
 * --------------------------------------------------------------------------
 *  زي نسخة الموقع بس بتضيف التوكن على كل طلب،
 *  ولو التوكن انتهى (401) بتطرد المستخدم لشاشة الدخول تلقائيًا.
 * ==========================================================================
 */

/* عنوان الـ API — بيتحدد لوحده:
   - النسخة المرفوعة (الإنتاج) → السيرفر اللايف على Railway
   - التطوير المحلي → localhost:4000
   ولو حبيت تغيّره من غير تعديل كود، حط VITE_API_URL وهو بياخد الأولوية. */
const PRODUCTION_API = 'https://bashandy-backend-production.up.railway.app'
const DEFAULT_API = import.meta.env.PROD ? PRODUCTION_API : 'http://localhost:4000'
const BASE_URL = (import.meta.env.VITE_API_URL || DEFAULT_API).replace(/\/$/, '')
const TOKEN_KEY = 'bashandy.tablet.token'
const USER_KEY = 'bashandy.tablet.user'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

export const saveSession = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message)
    this.status = status ?? 0
    this.code = code ?? null
    this.details = details ?? null
  }
}

/** الجلسة خلصت → بنعلن للتطبيق كله يرجع لشاشة الدخول */
const emitAuthExpired = () => {
  clearSession()
  window.dispatchEvent(new Event('tablet-auth-expired'))
}

const request = async (path, { method = 'GET', body } = {}) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)

  /* بنفتكر إحنا بعتنا توكن ولا لأ — عشان نفرّق بين نوعين من الـ 401:
     - 401 على طلب بتوكن   → الجلسة خلصت فعلًا → نرجع لشاشة الدخول
     - 401 على تسجيل الدخول → الباسورد غلط بس → نعرض رسالة السيرفر */
  const hadToken = Boolean(getToken())

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(hadToken ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (error) {
    clearTimeout(timer)
    if (error.name === 'AbortError') {
      throw new ApiError('السيرفر أخد وقت طويل', { code: 'TIMEOUT' })
    }
    throw new ApiError('مش قادر أوصل للسيرفر', { code: 'NETWORK' })
  }
  clearTimeout(timer)

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (response.status === 401 && hadToken) {
    emitAuthExpired()
    throw new ApiError('الجلسة خلصت — سجّل دخول تاني', { status: 401, code: 'UNAUTHORIZED' })
  }

  if (!response.ok || payload?.success === false) {
    const error = payload?.error ?? {}
    throw new ApiError(error.message || 'حصل خطأ', {
      status: response.status,
      code: error.code,
      details: error.details,
    })
  }

  return payload
}

/* ------------------------------- العمليات ------------------------------- */

export const login = (email, password) =>
  request('/api/auth/login', { method: 'POST', body: { email, password } })

export const fetchMe = () => request('/api/auth/me')

/** قواعد الحالات — بنقراها من السيرفر مش مكتوبة هنا */
export const fetchStatusMeta = () => request('/api/orders/meta/statuses')

/** الأوردرات الشغالة — دي اللي بنعمللها تحديث دوري */
export const fetchActiveOrders = () =>
  request('/api/orders?status=PENDING,ACCEPTED,PREPARING,READY&limit=100')

/** السجل — المكتمل والملغي */
export const fetchHistoryOrders = () =>
  request('/api/orders?status=COMPLETED,CANCELLED&limit=40')

export const updateOrderStatus = (orderId, status, note) =>
  request(`/api/orders/${orderId}/status`, { method: 'PATCH', body: { status, note } })

/* ------------------------ لوحة الأسعار (أدمن بس) ------------------------ */

/** المنيو كامل بكل الأصناف (حتى الموقوفة) — للوحة الأسعار */
export const fetchFullMenu = () => request('/api/menu')

/** تغيير سعر صنف — بيتغيّر في قاعدة البيانات وبيظهر في الموقع فورًا */
export const updateProductPrice = (productId, price) =>
  request(`/api/products/${productId}`, { method: 'PATCH', body: { price } })

/** إيقاف/تشغيل صنف ("خلص النهاردة") */
export const setProductAvailability = (productId, isAvailable) =>
  request(`/api/products/${productId}/availability`, { method: 'PATCH', body: { isAvailable } })

/* -------------------------- الشكاوي (أدمن بس) -------------------------- */

/** كل الشكاوي — أحدث الأول. السيرفر بيرفضها لأي حد غير ADMIN. */
export const fetchComplaints = (status) =>
  request(`/api/complaints?limit=100${status ? `&status=${status}` : ''}`)

/** عدّاد الشكاوي بس — طلب خفيف بنعمله دوري عشان الشارة على الزرار */
export const fetchComplaintCounts = () => request('/api/complaints?limit=1')

/** شكوى واحدة بتفاصيلها + آخر أوردرات صاحب الرقم */
export const fetchComplaint = (id) => request(`/api/complaints/${id}`)

/** تغيير حالة الشكوى و/أو إضافة ملاحظة داخلية */
export const updateComplaint = (id, patch) =>
  request(`/api/complaints/${id}`, { method: 'PATCH', body: patch })

export const API_BASE_URL = BASE_URL
