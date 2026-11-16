// «للأهل»: plain Arabic for her parents: the idea, the challenge and its rule, her points, the order
// types with their mode (training / competition, with a switch) and hidden level, her most-missed
// facts, the switches, a new challenge and a reset.
import { useState } from 'react'
import { ar } from '../domain/digits'
import { ORDER_TYPES, type Mode, type OrderType } from '../domain/orders'
import { CHILD_NAME } from '../data/lines'
import { GOAL, POINTS_FULL_HOUSE, POINTS_NEW_SPLIT, POINTS_RIGHT, mostMissed, type ShopProgress } from '../domain/progress'

const IDEA = {
  why: 'طريقة «احفظي العدد الأول وعدي على أصابعج» تطلب من الطفل ثلاث أشياء مرة وحدة: يمسك العدد الأول كمجموعة، ويكمل العد من نصه، ويحسب كم زاد. أغلب أطفال الصف الأول ما يقدرون عليها قبل ما يشوفون العدد بعيونهم ويلمسونه بإيدهم. في البقالة ما في أسئلة: الزبون يبي طلب، وهي تعبيه حبة حبة وتسمع العد، وتدق الجرس. الجمع هو اللي تسويه إيدها عشان يطلع الطلب صح.',
  how: [
    'عشر دقايق باليوم تكفي: يوم واحد في البقالة (خمس زباين).',
    'أول مرتين اقعدوا يمها، وخلوها هي اللي تلمس.',
    'خلوها تعد بصوت عالي مع الراوية.',
    'إذا الطلب ناقص أو زايد، الزبون يعد معها وهي تصلحه. ما في «غلط».',
    'الأشياء الجديدة تجي بروحها لما تكون جاهزة. لا تستعجلونها.',
  ],
  home: 'كوب وخرز أو حبات تمر: نحط خمسة في الكوب ونغطيه بإيدنا، ونحط اثنين برا. نلمس الكوب ونقول «خمسة»، وبعدين نلمس كل حبة برا: «ستة، سبعة». وبعدها نفتح الكوب ونتأكد.',
}

const TEACHES: Partial<Record<OrderType, { name: string; teaches: string }>> = {
  A: { name: 'طلب', teaches: 'تعد عدد معين من الكاكاو أو الحلاو أو التاكيز، وآخر عدد قالته هو كم في العلبة.' },
  C: { name: 'علبة جاهزة', teaches: 'تكمل العد من علبة مسكرة مكتوب عليها عددها: قلب الجمع.' },
  B: { name: 'كيسين', teaches: 'توزع عدد واحد من نفس النوع على كيسين مثل ما تبي: كل مرة توزيعة جديدة، وبيت العدد يتعبى مثل درس «تكوين ٤ و ٥ و ٩».' },
  D: { name: 'توصيل', teaches: 'تكمل العد على خط الأعداد (شارع البيوت ٠–١٠) مثل القفزات في الكتاب.' },
  E: { name: 'كيس واحد', teaches: 'تلقى ناتج الجمع وتختار ستيكر العدد. بالتدريب الحبات برا الكيس تعدها، وبالمنافسة تجي في كيس مسكر عليه عدده.' },
}

export function ParentsScreen({
  progress,
  onBack,
  onAllOrders,
  onToggleType,
  onMode,
  onNewChallenge,
  onVoice,
  onReset,
}: {
  progress: ShopProgress
  onBack: () => void
  onAllOrders: (value: boolean) => void
  onToggleType: (type: OrderType, on: boolean) => void
  onMode: (type: OrderType, mode: Mode) => void
  onNewChallenge: () => void
  onVoice: (value: boolean) => void
  onReset: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [renewing, setRenewing] = useState(false)
  const [renewed, setRenewed] = useState(false)
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
            <li>كل نوع طلب يبدأ «تدريب»: دبدوب يعد معها، يقول العدد مع كل لمسة، وتطلع أرقام ونقاط تساعدها. بالتدريب ما في نقاط، واللوحة ما تتحرك.</li>
            <li>
              إذا ضبطت أربعة من آخر خمسة طلبات من أول مرة، يدخل هالنوع «المنافسة»: ما في أي مساعدة في العد. الطلب الصح من أول مرة ياخذ{' '}
              {ar(POINTS_RIGHT)} نقطة، والغلط ينقص {ar(POINTS_RIGHT)} (النقاط ما تنزل تحت الصفر)، وبعدها الزبون يعد معها وهي تصلحه.
            </li>
            <li>إذا ضبطت طلب واحد أو أقل من آخر خمسة في المنافسة، يرجع هالنوع تدريب لين تقوى فيه.</li>
            <li>
              في «كيسين» بالمنافسة: كل توزيعة جديدة {ar(POINTS_NEW_SPLIT)} نقطة زيادة، وبيت العدد إذا كمل {ar(POINTS_FULL_HOUSE)} نقاط زيادة.
            </li>
            <li>تقدرون تنقلون أي نوع بين التدريب والمنافسة بإيدكم من «الطلبات» تحت.</li>
          </ul>
          <p className="p-points">
            نقاطها: <strong data-parent-points={progress.points}>{ar(progress.points)}</strong> من {ar(GOAL)}
            {progress.won ? ' · وصلت! الكوبون لها.' : ''}
          </p>
          {renewing ? (
            <div className="confirm" role="alertdialog" aria-label="تأكيد التحدي الجديد">
              <p>النقاط ترجع صفر، والمستويات تبقى مثل ما هي. متأكدين؟</p>
              <div className="confirm-buttons">
                <button
                  type="button"
                  className="p-button p-danger"
                  onClick={() => {
                    onNewChallenge()
                    setRenewing(false)
                    setRenewed(true)
                  }}
                >
                  نعم، تحدي جديد
                </button>
                <button type="button" className="p-button" onClick={() => setRenewing(false)}>
                  لا، نرجع
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="p-button" onClick={() => setRenewing(true)}>
              تحدي جديد
            </button>
          )}
          {renewed ? <p className="p-done" role="status">بدأ تحدي جديد.</p> : null}
        </section>

        <section className="p-card">
          <h2>الطلبات</h2>
          <ul className="p-stations">
            {ORDER_TYPES.map((t) => {
              const info = progress.types[t]
              const text = TEACHES[t]
              if (!text) return null
              const arrived = progress.arrived.includes(t) || progress.allOrders
              const compete = info.mode === 'compete'
              return (
                <li key={t} data-parent-order={t} data-parent-mode={info.mode}>
                  <span className="p-text">
                    <strong>{text.name}:</strong> {text.teaches}
                    <span className="p-meta">
                      {arrived ? `${compete ? 'منافسة' : 'تدريب'} · المستوى ${ar(info.level)} · ${ar(info.served)} زبون` : 'ما وصل البقالة للحين'}
                    </span>
                    <label className="switch p-mode" data-mode-switch={t}>
                      <input type="checkbox" role="switch" checked={compete} onChange={(event) => onMode(t, event.target.checked ? 'compete' : 'help')} />
                      <span className="switch-track" aria-hidden="true" />
                      <span>«{text.name}» في المنافسة</span>
                    </label>
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="p-meta">اليوم {ar(progress.day)}</p>
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
              <span>طلبات «{TEACHES[t]?.name}»</span>
            </label>
          ))}
          <label className="switch">
            <input type="checkbox" role="switch" checked={progress.allOrders} onChange={(event) => onAllOrders(event.target.checked)} />
            <span className="switch-track" aria-hidden="true" />
            <span>كل الطلبات مفتوحة</span>
          </label>
          <label className="switch">
            <input type="checkbox" role="switch" checked={progress.voice} onChange={(event) => onVoice(event.target.checked)} />
            <span className="switch-track" aria-hidden="true" />
            <span>صوت الراوية</span>
          </label>
          {confirming ? (
            <div className="confirm" role="alertdialog" aria-label="تأكيد التصفير">
              <p>البقالة ترجع جديدة: النقاط والمستويات والطلبات تنمسح. متأكدين؟</p>
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
