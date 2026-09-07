// Deterministic generator for the kiosk's tone + order-handover text.
//
// Same approach as lib/voice-prompt-templates.ts: pure string templates, no LLM
// call. Instant, free, and it can't hallucinate a rule that contradicts the
// kiosk's locked ordering prompt. Owners can edit whatever it produces.

export type KioskLanguage = 'en' | 'ur' | 'ar'
export type KioskToneStyle = 'formal' | 'friendly'
export type RestaurantHandover = 'counter' | 'table'
export type SalonHandover = 'reception' | 'called'
export type KioskVertical = 'restaurant' | 'salon'

export interface KioskToneOptions {
  language: KioskLanguage
  toneStyle: KioskToneStyle
  vertical: KioskVertical
  /** Which handover applies — key depends on the vertical. */
  handover: RestaurantHandover | SalonHandover
  /** Optional: greet in the local language before continuing in English. */
  greetLocally: boolean
}

export interface GeneratedKioskTone {
  tone: string
  handover: string
}

export const TONE_STYLE_LABELS: Record<KioskLanguage, { formal: string; friendly: string }> = {
  en: { formal: 'Professional', friendly: 'Warm' },
  ur: { formal: 'پیشہ ورانہ', friendly: 'گرم جوش' },
  ar: { formal: 'رسمي', friendly: 'ودود' },
}

export const RESTAURANT_HANDOVER_LABELS: Record<RestaurantHandover, string> = {
  counter: 'Collect at counter',
  table: 'Brought to table',
}

export const SALON_HANDOVER_LABELS: Record<SalonHandover, string> = {
  reception: 'Wait in reception',
  called: 'Stylist collects you',
}

// ── Tone ─────────────────────────────────────────────────────────────────────

const TONE: Record<KioskLanguage, Record<KioskToneStyle, string>> = {
  en: {
    formal:
      'Polite and professional. Speak clearly and get to the point without small talk.',
    friendly:
      'Warm and welcoming. Sound like a friendly member of staff, but stay brief.',
  },
  ur: {
    formal:
      'شائستہ اور پیشہ ورانہ انداز رکھیں۔ صاف بات کریں اور غیر ضروری گفتگو سے گریز کریں۔',
    friendly:
      'گرم جوش اور خوش اخلاق رہیں۔ ایک دوستانہ ملازم کی طرح بات کریں، مگر مختصر رکھیں۔',
  },
  ar: {
    formal:
      'كن مهذباً ومهنياً. تحدث بوضوح وادخل في صلب الموضوع دون إطالة.',
    friendly:
      'كن ودوداً ومرحباً. تحدث كموظف لطيف، مع الحفاظ على الاختصار.',
  },
}

const GREET_LOCALLY: Record<KioskLanguage, string> = {
  en: '',
  ur: ' گاہک کو پہلے اردو میں سلام کریں، پھر گفتگو جاری رکھیں۔',
  ar: ' حيّ العميل بالعربية أولاً، ثم تابع الحديث.',
}

// ── Handover ─────────────────────────────────────────────────────────────────

const RESTAURANT_HANDOVER: Record<KioskLanguage, Record<RestaurantHandover, string>> = {
  en: {
    counter: 'Wait near the counter — we call your order number when it is ready.',
    table: 'Take a seat, your order is brought to your table.',
  },
  ur: {
    counter: 'کاؤنٹر کے پاس انتظار کریں، آرڈر تیار ہونے پر آپ کا نمبر پکارا جائے گا۔',
    table: 'تشریف رکھیں، آپ کا آرڈر آپ کی میز پر پہنچا دیا جائے گا۔',
  },
  ar: {
    counter: 'انتظر قرب الكاونتر، سيتم مناداة رقم طلبك عند جاهزيته.',
    table: 'تفضل بالجلوس، سيصل طلبك إلى طاولتك.',
  },
}

const SALON_HANDOVER: Record<KioskLanguage, Record<SalonHandover, string>> = {
  en: {
    reception: 'Take a seat in the waiting area until your appointment time.',
    called: 'Take a seat — your stylist will come for you when they are ready.',
  },
  ur: {
    reception: 'اپنی اپائنٹمنٹ کے وقت تک انتظار گاہ میں تشریف رکھیں۔',
    called: 'تشریف رکھیں، آپ کے اسٹائلسٹ تیار ہوتے ہی آپ کو بلا لیں گے۔',
  },
  ar: {
    reception: 'تفضل بالجلوس في منطقة الانتظار حتى موعدك.',
    called: 'تفضل بالجلوس، سيأتي مصفف الشعر إليك عندما يكون جاهزاً.',
  },
}

export function generateKioskTone(opts: KioskToneOptions): GeneratedKioskTone {
  const { language, toneStyle, vertical, handover, greetLocally } = opts

  let tone = TONE[language][toneStyle]
  // Only meaningful when the interface language is English but the walk-up
  // customer is likely to be greeted in the local language first.
  if (greetLocally && language !== 'en') {
    tone += GREET_LOCALLY[language]
  }

  const handoverText =
    vertical === 'salon'
      ? SALON_HANDOVER[language][handover as SalonHandover]
      : RESTAURANT_HANDOVER[language][handover as RestaurantHandover]

  return { tone, handover: handoverText }
}
