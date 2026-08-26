import { useEffect, useMemo, useState } from 'react'
import { fetchFullMenu, updateProductPrice, setProductAvailability } from '../api'

/**
 * لوحة الأسعار — للأدمن الأساسي بس (الزرار مش بيظهر أصلاً لغيره،
 * والسيرفر كمان بيرفض أي تعديل من غير صلاحية ADMIN).
 *
 * غيّر السعر → بيتحفظ في قاعدة البيانات → الموقع بيقراه في أول فتح/تحديث.
 * نفس الحكاية مع إيقاف صنف ("خلص النهاردة") — بيظهر رمادي في الموقع فورًا.
 */
export default function AdminPrices({ onFlash }) {
  const [categories, setCategories] = useState(null) // null = لسه بيحمّل
  const [search, setSearch] = useState('')
  /* الأسعار اللي اتكتبت في الخانات ولسه ماتحفظتش: { productId: '25' } */
  const [drafts, setDrafts] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  const load = () => {
    fetchFullMenu()
      .then((result) => {
        setCategories(result.data)
        setError(null)
      })
      .catch((err) => setError(err.message))
  }

  useEffect(load, [])

  /* ------------------------------ الفلترة ------------------------------ */

  const filtered = useMemo(() => {
    if (!categories) return []
    const term = search.trim()
    if (!term) return categories
    return categories
      .map((category) => ({
        ...category,
        products: category.products.filter(
          (product) =>
            product.name.includes(term) ||
            (product.tags ?? []).some((tag) => tag.includes(term))
        ),
      }))
      .filter((category) => category.products.length > 0)
  }, [categories, search])

  /* ------------------------------ الحفظ ------------------------------ */

  const savePrice = async (product) => {
    const raw = drafts[product.id]
    const price = Number(raw)

    if (!Number.isFinite(price) || price <= 0) {
      onFlash({ kind: 'err', text: 'اكتب سعر صحيح أكبر من صفر' })
      return
    }

    setBusyId(product.id)
    try {
      const result = await updateProductPrice(product.id, price)
      /* بنحدّث النسخة المحلية بالسعر اللي السيرفر أكّده */
      setCategories((current) =>
        current.map((category) => ({
          ...category,
          products: category.products.map((p) =>
            p.id === product.id ? { ...p, price: result.data.price } : p
          ),
        }))
      )
      setDrafts((current) => {
        const next = { ...current }
        delete next[product.id]
        return next
      })
      onFlash({ kind: 'ok', text: `"${product.name}" بقى ${result.data.price} ج.م — اتحفظ في الموقع والداتابيز` })
    } catch (err) {
      onFlash({ kind: 'err', text: err.message })
    } finally {
      setBusyId(null)
      setTimeout(() => onFlash(null), 3500)
    }
  }

  const toggleAvailability = async (product) => {
    setBusyId(product.id)
    try {
      const result = await setProductAvailability(product.id, !product.isAvailable)
      setCategories((current) =>
        current.map((category) => ({
          ...category,
          products: category.products.map((p) =>
            p.id === product.id ? { ...p, isAvailable: result.data.isAvailable } : p
          ),
        }))
      )
      onFlash({
        kind: 'ok',
        text: result.data.isAvailable
          ? `"${product.name}" رجع متاح`
          : `"${product.name}" اتعلّم "خلص النهاردة"`,
      })
    } catch (err) {
      onFlash({ kind: 'err', text: err.message })
    } finally {
      setBusyId(null)
      setTimeout(() => onFlash(null), 3500)
    }
  }

  /* ------------------------------- العرض ------------------------------- */

  if (error) {
    return (
      <div className="prices">
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

  if (!categories) {
    return <div className="prices"><div className="empty">بجيب المنيو…</div></div>
  }

  return (
    <div className="prices">
      <div className="prices__head">
        <h2 className="prices__title">💰 الأسعار والتوفّر</h2>
        <input
          type="search"
          className="prices__search"
          placeholder="دوّر على صنف…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <p className="prices__hint">
          غيّر السعر ودوس حفظ — بيتغيّر في الموقع وقاعدة البيانات فورًا.
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">مفيش صنف بالاسم ده</div>
      ) : (
        filtered.map((category) => (
          <section className="pcat" key={category.id}>
            <h3 className="pcat__name">
              {category.name}
              <span className="pcat__count">{category.products.length}</span>
            </h3>

            <ul className="plist">
              {category.products.map((product) => {
                const draft = drafts[product.id]
                const changed = draft !== undefined && Number(draft) !== product.price
                const busy = busyId === product.id

                return (
                  <li
                    className={`prow ${product.isAvailable ? '' : 'prow--off'}`}
                    key={product.id}
                  >
                    <div className="prow__info">
                      <p className="prow__name">{product.name}</p>
                      {/* الاختيارات اللي بتغيّر السعر — للعلم بس */}
                      {(product.optionGroups ?? [])
                        .flatMap((group) => group.choices.filter((choice) => choice.priceDelta > 0))
                        .map((choice) => (
                          <span className="prow__delta" key={choice.id}>
                            {choice.name} +{choice.priceDelta}
                          </span>
                        ))}
                    </div>

                    <div className="prow__price">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0.5"
                        step="0.5"
                        dir="ltr"
                        value={draft !== undefined ? draft : product.price}
                        disabled={busy}
                        onChange={(e) =>
                          setDrafts((current) => ({ ...current, [product.id]: e.target.value }))
                        }
                      />
                      <span className="prow__currency">ج.م</span>
                    </div>

                    {changed ? (
                      <button
                        type="button"
                        className="btn btn--save"
                        disabled={busy}
                        onClick={() => savePrice(product)}
                      >
                        {busy ? '…' : '✓ حفظ'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`btn btn--avail ${product.isAvailable ? '' : 'is-off'}`}
                        disabled={busy}
                        onClick={() => toggleAvailability(product)}
                      >
                        {busy ? '…' : product.isAvailable ? 'متاح' : 'خلص'}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
