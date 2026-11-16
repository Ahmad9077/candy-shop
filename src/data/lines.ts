// Every spoken line of «البقالة» (DESIGN.md §4, with the changes of §8.6, §9 and §10.4). Self-contained for Node
// scripts.
//
// Three voices, two speakers:
//   - counting: the narrator at normal speed, the recorded number clips ar/n/0 … ar/n/10,
//     and «زائد» / «يساوي» for the receipt sentence;
//   - customers: the c/ lines, the same recordings played at each animal's playbackRate;
//   - guide: the g/ lines, the narrator at normal speed, said once when a thing first arrives
//     and again when she taps Dabdoob's «؟».
// Nobody praises or consoles: the effects and the customers' reactions carry the feeling.
// Rules (tests/unit/lines.test.ts): Kuwaiti, no «…», no «أوه/آه», no banned words or praise,
// never equal to a line of the earlier quizzes, prefix lines without an end mark.

export const QUIZ_ID = 'candy-shop'

/** Her name, said in a few named lines only (§8.5). */
export const CHILD_NAME = 'ديما'

export const NUMBER_WORDS = ['صفر', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'] as const

export const LINES = {
  // Reused recordings (the receipt sentence).
  'ui/plus': 'زائد',
  'ui/equal': 'يساوي',
  // Customers.
  'c/hi-1': 'هلا!',
  'c/hi-2': 'مرحبا!',
  'c/hi-3': 'السلام عليكم!',
  'c/hi-4': 'صباح الخير!',
  'c/want': 'أبي',
  'c/may-i': 'ممكن',
  'c/two-bags': 'في كيسين',
  'c/thanks-1': 'شكراً!',
  'c/thanks-2': 'لذيذ!',
  'c/thanks-3': 'مشكورين!',
  'c/thanks-4': 'أحلى بقالة!',
  'c/thanks-5': 'باي باي!',
  'c/thanks-6': 'وايد حلو!',
  'c/hi-dima': 'هلا ديما!',
  'c/thanks-dima': 'مشكورة يا ديما!',
  'c/p-choc': 'كاكاو',
  'c/p-candy': 'حلاو',
  'c/p-takis': 'تاكيز',
  'c/wait-1': 'لحظة، خل نعد.',
  'c/wait-2': 'خل نشوف كم فيها.',
  'c/wait-3': 'نعدهم؟',
  'c/too-few': 'ناقص شوي.',
  'c/too-many': 'هذا زايد.',
  'c/not-my-house-1': 'مو بيتي!',
  'c/not-my-house-2': 'بيتي مو هني!',
  'c/delivered': 'وصل الطلب! شكراً دبدوب.',
  // Guide.
  'g/open': 'البقالة فتحت! وأول زبون وصل.',
  'g/tap-jar': 'نلمس اللي يبيه الزبون، وتنزل حبة في العلبة.',
  'g/take-out': 'وإذا زادت حبة، نلمسها وترجع.',
  'g/ring-bell': 'وإذا كمل الطلب، ندق الجرس.',
  'g/two-bags': 'هذا الزبون يبي طلبه في كيسين. نوزعه مثل ما نبي.',
  'g/two-bags-new': 'كل مرة نوزعه غير، ونعبي بيت العدد.',
  'g/house-done': 'بيت العدد كمل! وهذي خمسة نقاط زيادة.',
  'g/ready-box': 'هذي علبة جاهزة، وعددها مكتوب عليها. نكمل عليها بس.',
  'g/tap-box': 'نلمس العلبة ونسمع كم فيها.',
  'g/delivery': 'طلب توصيل! دبدوب يوصله بالسكوتر.',
  'g/ride': 'كل لمسة يمشي دبدوب بيت واحد.',
  'g/door': 'وإذا وصل، نلمس باب البيت.',
  'g/sticker': 'الزبون يبي الكل في كيس واحد. نختار ستيكر العدد.',
  'g/bigger-first': 'نبدأ بالعدد الأكبر.',
  'g/closed': 'البقالة سكرت. نعد نقاط اليوم!',
  'g/new-customer': 'زبون جديد صار يعرف بقالتنا!',
  'g/new-day': 'يوم جديد، والبقالة تفتح.',
  'g/goal': 'ديما، عندنا تحدي! إذا جمعنا مئتين نقطة بدون مساعدة، بابا راح يودينا البقالة ونشتري تاكيز!',
  'g/train': 'بالبداية دبدوب يعد ويانا. هذا تدريب، وما فيه نقاط.',
  'g/compete': 'بدت المنافسة! الحين نعد بروحنا. الطلب الصح بنقطتين، والغلط ينقص نقطتين.',
  'g/compete-more': 'وهالطلب بعد دخل المنافسة!',
  'g/back-to-train': 'نتدرب شوي مع دبدوب، وبعدين نرجع للمنافسة.',
  'g/points-yes': 'الطلب مضبوط، وهذي نقطتين!',
  'g/points-no': 'الطلب ما كان مضبوط، فنقصت نقطتين. نعد على مهلنا قبل لا ندق الجرس.',
  'g/day-down': 'اليوم راحت علينا نقاط. نعد على مهلنا قبل الجرس.',
  'g/near-1': 'كل يوم نقرب من التاكيز.',
  'g/near-2': 'النقاط تزيد، والتاكيز يقرب!',
  'g/near-3': 'شوي شوي ونوصل المئتين.',
  'g/goal-50': 'جمعنا خمسين نقطة! بدينا الطريق.',
  'g/goal-100': 'مئة نقطة! هذا نص الطريق يا ديما.',
  'g/goal-150': 'مئة وخمسين نقطة! باقي خمسين بس.',
  'g/goal-200': 'مئتين نقطة! وصلنا يا ديما! قولي حق بابا: يلا نروح البقالة!',
} as const

export type LineId = keyof typeof LINES

/** Lines joined to a number, before («أبي» + ٧) or after (٧ + «كاكاو»): no end mark. */
export const PREFIX_LINES: readonly LineId[] = ['c/want', 'c/may-i', 'ui/plus', 'ui/equal', 'c/p-choc', 'c/p-candy', 'c/p-takis', 'c/two-bags']

/** The only lines that say her name (and so may address a girl). */
export const NAMED_LINES: readonly LineId[] = ['g/goal', 'g/goal-100', 'g/goal-200', 'c/hi-dima', 'c/thanks-dima']

/** Recordings kept from the family's math quiz on purpose: the numbers, «زائد» and «يساوي». */
export const REUSED_LINES: readonly LineId[] = ['ui/plus', 'ui/equal']

const family = (prefix: string) => (Object.keys(LINES) as LineId[]).filter((id) => id.startsWith(prefix))
export const HI_IDS = family('c/hi-').filter((id) => !NAMED_LINES.includes(id))
export const THANKS_IDS = family('c/thanks-').filter((id) => !NAMED_LINES.includes(id))
export const NEAR_IDS = family('g/near-')
export const WAIT_IDS = family('c/wait-')
export const NOT_MY_HOUSE_IDS = family('c/not-my-house-')

export const clip = {
  num: (value: number) => `ar/n/${value}`,
  line: (id: LineId) => `ar/${id}`,
}

/** «خمسة زائد اثنان يساوي سبعة», as a run of clips. */
export function sentenceClips(a: number, b: number, sum = a + b): string[] {
  return [clip.num(a), clip.line('ui/plus'), clip.num(b), clip.line('ui/equal'), clip.num(sum)]
}

export interface AudioCue {
  id: string
  text: string
  /** `ar`: the Gulf narrator voice (re-recorded for «البقالة»). */
  voice: 'ar'
}

/** Screen text carries no diacritics. */
export function bare(text: string): string {
  return text.replace(/[ً-ْٰ]/g, '')
}

export function audioCues(): AudioCue[] {
  const ar = (id: string, text: string): AudioCue => ({ id, text, voice: 'ar' })
  return [
    ...NUMBER_WORDS.map((word, value) => ar(clip.num(value), `${word}.`)),
    ...(Object.keys(LINES) as LineId[]).map((id) => ar(clip.line(id), LINES[id])),
  ]
}

/** The text of a clip id, for captions while a clip is not recorded yet. */
export function cueText(clipId: string): string | undefined {
  const match = /^ar\/n\/(\d+)$/.exec(clipId)
  if (match) return NUMBER_WORDS[Number(match[1])]
  const id = clipId.replace(/^ar\//, '') as LineId
  return id in LINES ? bare(LINES[id]) : undefined
}
