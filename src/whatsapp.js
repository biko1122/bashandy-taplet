/**
 * ==========================================================================
 *  رسالة تأكيد الواتساب — من التابلت
 * --------------------------------------------------------------------------
 *  دي النسخة اليدوية الشغالة **دلوقتي**: بتفتح واتساب (المثبت على التابلت
 *  أو واتساب ويب) على رقم العميل برسالة جاهزة مكتوبة — الموظف بيدوس
 *  "إرسال" وبس.
 *
 *  ولما حساب WhatsApp Business API يتجهّز (آخر مرحلة في المشروع)،
 *  السيرفر هيبعت نفس الرسالة دي **تلقائيًا** وقت القبول — الكود بتاعها
 *  جاهز في الباكند (services/whatsapp.service.js) ومستني المفاتيح بس.
 * ==========================================================================
 */

/** نص رسالة التأكيد — نفس صيغة السيرفر بالظبط عشان العميل ياخد شكل واحد */
export const buildConfirmationMessage = (order) => {
  const lines = order.items.map((item) => {
    const options = item.options?.length
      ? ` (${item.options.map((option) => option.choiceName).join('، ')})`
      : ''
    return `• ${item.quantity} × ${item.productName}${options}`
  })

  const typeLine =
    order.type === 'DELIVERY'
      ? `🛵 الطلب توصيل على العنوان:\n${order.deliveryAddress}\n(رسوم التوصيل بيأكدها معاك المطعم)`
      : '🏪 الطلب استلام من الفرع — 31 ش الشيخ علي يوسف، المنيرة'

  return [
    `أهلًا ${order.customer.name} 👋`,
    '',
    `طلبك رقم *#${order.orderNumber}* من مطعم عبدالله بشندي *اتأكد* ✅`,
    '',
    ...lines,
    '',
    `💰 الإجمالي: ${order.total} ج.م`,
    '',
    typeLine,
  ].join('\n')
}

/**
 * لينك wa.me — رقم العميل متخزّن أصلًا بالصيغة الدولية (201551627977)
 * وهي دي بالظبط الصيغة اللي wa.me عايزها. مفيش أي تحويل.
 */
export const whatsappUrlFor = (order) =>
  `https://wa.me/${order.customer.phone}?text=${encodeURIComponent(buildConfirmationMessage(order))}`
