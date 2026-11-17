// «للأهل»: plain Arabic for her parents: the idea, the challenge and its rule, her points, the order
// types with their step of help (training, light training for the ready box, competition; the
// parents can set it) and hidden level, her most-missed facts, the switches, the balance reset and a
// full reset.
import { useState } from 'react'
import { ar } from '../domain/digits'
import { ORDER_TYPES, stepsOf, type Mode, type OrderType } from '../domain/orders'
import { CHILD_NAME } from '../data/lines'
import { GOAL, POINTS_RIGHT, mostMissed, type ShopProgress } from '../domain/progress'

const IDEA = {
  why: 'أغلب أطفال الصف الأول يعدون كومة من واحد بدون مشكلة. الصعب هو إنهم يمسكون العدد الأول بروسهم ويكملون العد منه: قدام ٥ + ٣ يرجعون يعدون من واحد. في البقالة الزبون يطلب عدد، مثلاً «أبي سبعة تاكيز»، وعلى الكاونتر علبة جاهزة مسكرة مكتوب عليها عددها، مثلاً خمسة. هي تلمس التاكيز تحت وتنزل حبة حبة على الصينية جنب العلبة، والعد يكمل من عدد العلبة: «ستة، سبعة»، وبعدين تدق الجرس. ما في أسئلة، والزبون ما يقول «غلط»: إذا دقت الجرس والعدد مو مضبوط، الحبات نفسها توريها الجواب وهي تصلحه.',
  how: [
    'عشرة دقايق باليوم تكفي. اللعبة ما فيها أيام ولا جولات: الزباين يجون ورا بعض، وتقدرون توقفون متى ما بغيتوا.',
    'أول مرتين اقعدوا يمها، وخلوها هي اللي تلمس.',
    'خلوها تقول عدد العلبة بصوت عالي، وبعدين تكمل: «خمسة، ستة، سبعة».',
    'إذا دقت الجرس والعدد مو مضبوط، ما ينقص شي: العلبة تنفتح وتعد من عددها، والحبات الناقصة تطلع كأماكن فاضية عليها أرقامها، والزايدة يبهت لونها. وهي تصلحها وتدق مرة ثانية.',
    'المساعدة تخف بروحها لما تكون جاهزة، وترجع إذا احتاجتها. لا تستعجلونها.',
  ],
  home: 'كوب وخرز أو حبات تمر: نحط خمسة في الكوب ونغطيه بإيدنا، ونحط اثنين برا. نلمس الكوب ونقول «خمسة»، وبعدين نلمس كل حبة برا: «ستة، سبعة». وبعدها نفتح الكوب ونتأكد.',
}

const TEACHES: Record<OrderType, { name: string; teaches: string }> = {
  C: { name: 'علبة جاهزة', teaches: 'تكمل العد من علبة مسكرة مكتوب عليها عددها، وتنزل حبة حبة على الصينية لين يكمل الطلب، وتدق الجرس. هذا الطلب الأساسي.' },
  A: { name: 'طلب', teaches: 'تعد عدد معين من الكاكاو أو الحلاو أو التاكيز، وآخر عدد قالته هو كم في العلبة.' },
  D: { name: 'توصيل', teaches: 'تكمل العد على خط الأعداد (شارع البيوت ٠–١٠) مثل القفزات في الكتاب.' },
}

/** The name of each step of help, as the parents read it. */
const STEP_NAME: Record<Mode, string> = { help: 'تدريب', bridge: 'تدريب خفيف', compete: 'منافسة' }

export function ParentsScreen({
  progress,
  onBack,
  onToggleType,
  onMode,
  onResetBalance,
  onVoice,
  onReset,
}: {
  progress: ShopProgress
  onBack: () => void
  onToggleType: (type: OrderType, on: boolean) => void
  onMode: (type: OrderType, mode: Mode) => void
  onResetBalance: () => void
  onVoice: (value: boolean) => void
  onReset: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [confirmingBalance, setConfirmingBalance] = useState(false)
  const [balanceDone, setBalanceDone] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const missed = mostMissed(progress)
  return (
    <main className="screen parents">
      <header className="parents-top">
        <button type="button" className="round-button" onClick={onBack} aria-label="رجوع للبقالة">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <h1>للأهل</h1>
      </header>
      <div className="parents-body">
        <section className="p-card">
          <h2>الفكرة</h2>
          <h3>ليش هاللعبة؟</h3>
          <p>{IDEA.why}</p>
          <h3>شلون نستخدمها؟</h3>
          <ul>
            {IDEA.how.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3>نفس اللعبة بالبيت (بدون آيباد)</h3>
          <p>{IDEA.home}</p>
        </section>

        <section className="p-card" data-parent-challenge>
          <h2>التحدي</h2>
          <p>
            إذا جمعت {CHILD_NAME} {ar(GOAL)} نقطة بدون مساعدة، بابا ياخذها البقالة وتشتري تاكيز من صدق.
          </p>
          <ul className="p-rule" data-parent-rule>
            <li>«علبة جاهزة» تمر بثلاثة خطوات. «تدريب»: دبدوب يقول عدد العلبة أول، ومع كل حبة تنزل على الصينية يكمل العد، وعلى كل حبة رقمها. «تدريب خفيف»: دبدوب يقول عدد العلبة بس، وهي تكمل العد بروحها. «منافسة»: ما في أي مساعدة في العد.</li>
            <li>بالتدريب ما في نقاط، واللوحة ما تتحرك. بالمنافسة كل طلب صح من أول مرة ياخذ {ar(POINTS_RIGHT)} نقطة، والغلط ما ينقص شي.</li>
            <li>إذا ضبطت أربعة من آخر خمسة طلبات من أول مرة، تطلع خطوة. وإذا غلطت مرتين ورا بعض من أول مرة، ترجع خطوة عشان تاخذ المساعدة.</li>
            <li>تقدرون تحطون أي نوع على الخطوة اللي تبونها من «الطلبات» تحت.</li>
          </ul>
          <p className="p-points">
            نقاطها: <strong data-parent-points={progress.points}>{ar(progress.points)}</strong> من {ar(GOAL)}
            {progress.won ? ' · وصلت! الكوبون لها.' : ''}
          </p>
          <p className="p-meta">في نسخة الـ Hub الرصيد ينحفظ بحسابها، والأدمن يقدر يصفره من هناك.</p>
          {confirmingBalance ? (
            <div className="confirm" role="alertdialog" aria-label="تأكيد تصفير الرصيد">
              <p>النقاط ترجع صفر، والخطوات والمستويات تبقى مثل ما هي. متأكدين؟</p>
              <div className="confirm-buttons">
                <button
                  type="button"
                  className="p-button p-danger"
                  onClick={() => {
                    onResetBalance()
                    setConfirmingBalance(false)
                    setBalanceDone(true)
                  }}
                >
                  نعم، نصفر الرصيد
                </button>
                <button type="button" className="p-button" onClick={() => setConfirmingBalance(false)}>
                  لا، نرجع
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="p-button" onClick={() => setConfirmingBalance(true)}>
              تصفير الرصيد
            </button>
          )}
          {balanceDone ? <p className="p-done" role="status">الرصيد صار صفر.</p> : null}
        </section>

        <section className="p-card">
          <h2>الطلبات</h2>
          <ul className="p-stations">
            {ORDER_TYPES.map((t) => {
              const info = progress.types[t]
              const text = TEACHES[t]
              const on = !progress.disabled.includes(t)
              return (
                <li key={t} data-parent-order={t} data-parent-mode={info.mode}>
                  <span className="p-text">
                    <strong>{text.name}:</strong> {text.teaches}
                    <span className="p-meta">
                      {on ? '' : 'مسكر · '}
                      {STEP_NAME[info.mode]} · المستوى {ar(info.level)} · {ar(info.served)} زبون
                    </span>
                    <span className="p-steps" role="radiogroup" aria-label={`خطوة «${text.name}»`} data-mode-switch={t}>
                      {stepsOf(t).map((mode) => (
                        <label key={mode} className={`p-step ${info.mode === mode ? 'is-on' : ''}`} data-mode-choice={mode}>
                          <input type="radio" name={`step-${t}`} checked={info.mode === mode} onChange={() => onMode(t, mode)} />
                          <span>{STEP_NAME[mode]}</span>
                        </label>
                      ))}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="p-meta">خدمت {ar(progress.served)} زبون</p>
        </section>

        <section className="p-card">
          <h2>تحتاج تمرين</h2>
          {missed.length === 0 ? (
            <p className="p-empty">ما في شي للحين.</p>
          ) : (
            <ul className="p-facts">
              {missed.map(([a, b]) => (
                <li key={`${a}+${b}`} dir="rtl">
                  {ar(a)} + {ar(b)} = {ar(a + b)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="p-card">
          <h2>الإعدادات</h2>
          {ORDER_TYPES.map((t) => (
            <label key={t} className="switch" data-type-switch={t}>
              <input type="checkbox" role="switch" checked={!progress.disabled.includes(t)} onChange={(event) => onToggleType(t, event.target.checked)} />
              <span className="switch-track" aria-hidden="true" />
              <span>طلبات «{TEACHES[t].name}»</span>
            </label>
          ))}
          <label className="switch">
            <input type="checkbox" role="switch" checked={progress.voice} onChange={(event) => onVoice(event.target.checked)} />
            <span className="switch-track" aria-hidden="true" />
            <span>صوت الراوية</span>
          </label>
          {confirming ? (
            <div className="confirm" role="alertdialog" aria-label="تأكيد التصفير">
              <p>البقالة ترجع جديدة: النقاط والخطوات والمستويات تنمسح. متأكدين؟</p>
              <div className="confirm-buttons">
                <button
                  type="button"
                  className="p-button p-danger"
                  onClick={() => {
                    onReset()
                    setConfirming(false)
                    setResetDone(true)
                  }}
                >
                  نعم، نصفر
                </button>
                <button type="button" className="p-button" onClick={() => setConfirming(false)}>
                  لا، نرجع
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="p-button" onClick={() => setConfirming(true)}>
              تصفير التقدم
            </button>
          )}
          {resetDone ? <p className="p-done" role="status">تم التصفير.</p> : null}
        </section>
      </div>
    </main>
  )
}
