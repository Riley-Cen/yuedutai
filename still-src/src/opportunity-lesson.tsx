"use client";

import { useId, useState } from "react";
import {Slider} from "./slider";
import "./opportunity-lesson.css";

const money = (amount: number) => amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 });

export default function OpportunityLesson() {
  const inputId = useId();
  const [wage, setWage] = useState(90);
  const [wageInput, setWageInput] = useState("90");
  const [answerOpen, setAnswerOpen] = useState(false);
  const alternative = Math.round(wage * 600) / 100;
  const advantage = Math.round((600 - alternative) * 100) / 100;

  function updateWage(value: string) {
    setWageInput(value);
    const next = Number(value);
    if (value.trim() !== "" && Number.isFinite(next) && next >= 0 && next <= 200) {
      setWage(Math.round(next * 100) / 100);
    }
  }

  return <div className="opportunity-lesson">
    <section>
      <h2>机会成本：把被放弃的选择也算进来</h2>
      <p>机会成本是选择一项行动时，放弃的最佳可行替代方案的净收益。它用来回答：把有限的时间或资源用在这里，相比另一条做得到的路，究竟多得到或少得到什么？没有付款记录的时间，也可能有机会成本。</p>
      <p>“最佳”意味着比较最好的一个替代方案，而不是把所有没选的收益相加；“可行”意味着这个方案在当前条件下真的能做到。选择去学习时，一份时间冲突、又根本没有录用你的工作，不能被当作确定可得的替代收入。</p>
      <p>这节采用 CORE 教材的口径，把直接支付的成本与被放弃的净收益分开列。先算选项各自从现在起的净收益，再比较，能避免把同一笔支出扣两遍。已经发生且无法收回的支出叫沉没成本，它不因这次选择而改变；稍后会用一个对照说明为什么要把它分开。</p>
      <p>先理解这个比较方法，再看下面的数字。我们暂时假定两项都可行、收入确定、非金钱后果相同；后两课会继续讨论增加一点投入，以及结果不确定时该怎样判断。</p>
    </section>
    <section>
      <h2>把概念写成一个比较式</h2>
      <p>设 F 是当前可行方案的集合，方案 i 从现在起的收入为 Rᵢ，新增直接支出为 Cᵢ，净现金为 Gᵢ = Rᵢ − Cᵢ。在至少有两个可行方案、其他后果相同的假设下，选 A 放弃的最好净现金就是 OCₐ = max（Gⱼ，其中 j ∈ F 且 j ≠ A）。</p>
      <p>因此 A 相对最好替代的现金优势为 Dₐ = Gₐ − OCₐ = Rₐ − Cₐ − OCₐ。Dₐ 为正，意味着在这个比较口径下 A 比所有替代都好；为零，意味着至少有一个替代与它打平。这里的减法并非把看不见的费用硬加进账本，而是把“做 A”和“做最好替代”两个未来相减。</p>
      <p>这个模型暂时以现金作为比较尺度。如果一项更有趣、另一项更疲惫，G 就不包含全部后果，不能继续声称 D 的符号决定了人的最佳选择。先写清比较尺度和被暂时固定的条件，公式才有经济含义。下面用确定收入的案例检查这个方法。</p>
    </section>

    <section>
      <h2>赚到了钱，就值得做吗？</h2>
      <p>周六早上，你有完整的 6 小时。一个选择是去摆摊：当天收入 900 元，还需要新付 300 元进货和交通费用。另一个选择是接一份同样做 6 小时的临时工作，时薪 90 元，没有额外支出。两个安排时间重叠，只能选一个。</p>
      <p>摆摊能留下 600 元，看起来不错。但决定是否摆摊，还要回答：如果不去，这 6 小时本来能换来什么？临时工作能留下 540 元。于是，摆摊相对打工的优势其实是 60 元。</p>
      <p>这里先把问题缩小：两项收入都确定，两种工作带来的劳累、兴趣等非金钱后果相同；你有足够的钱支付新增费用。我们只比较从现在起新增的净现金，暂不考虑其他选择。</p>
    </section>

    <section>
      <h2>机会成本，是被放弃的那个最好选择</h2>
      <p>资源有限，选择一条路就会放弃另一条路。机会成本衡量的，是<strong>最佳可行替代方案的净收益</strong>。本例中，选择摆摊放弃了 540 元打工收入；这笔钱不会出现在付款记录里，却是使用自己时间的隐含成本。</p>
      <p>要看净收益，是因为替代方案也可能需要付出。如果打工另需 40 元交通费，被放弃的净收入就只有 500 元。若还有其他可行选择，应找其中最好的一个，不能把所有没选的收益加起来。</p>
      <div className="opportunity-equation" aria-label="摆摊相对打工的新增净收益，等于900减300减540，等于60元">
        <span>摆摊相对打工多得</span>
        <strong>900 − 300 − 540 = 60 元</strong>
      </div>
      <p>按这里采用的 CORE 教材口径，300 元是直接成本，540 元是机会成本，合计 840 元是这次选择的经济成本。也可以先算净现金，再比较：600 − 540 = 60。两条算式说的是同一件事；算过净现金，就不要再扣一次 300 元。</p>
    </section>

    <section className="example">
      <h2>只改变工资，选择会在哪里翻转？</h2>
      <p>保持摆摊条件不变，试着把临时工作的时薪从 90 调到 110 元。你正在改变的是替代机会的价值。</p>
      <div className="opportunity-control">
        <label htmlFor={inputId}>临时工作时薪</label>
        <div><input id={inputId} type="number" min="0" max="200" step="0.01" inputMode="decimal" value={wageInput} onChange={event => updateWage(event.target.value)} onBlur={() => setWageInput(String(wage))} /><span>元 / 小时</span></div>
      </div>
      <Slider className="opportunity-range" min={0} max={200} step={1} value={[wage]} aria-label="调整临时工作时薪，0至200元" onValueChange={values => updateWage(String(values[0]))} />
      <div className="opportunity-presets" aria-label="试算常见时薪">
        {[90, 100, 110].map(value => <button className="secondary" key={value} type="button" aria-pressed={wage === value} onClick={() => updateWage(String(value))}>{value} 元 / 小时</button>)}
      </div>
      <div className="opportunity-comparison">
        <div><span>摆摊净现金</span><strong>600 元</strong></div>
        <div><span>打工净现金 · 6 × {money(wage)}</span><strong>{money(alternative)} 元</strong></div>
      </div>
      <div className="opportunity-result" role="status" aria-live="polite" aria-atomic="true">
        <strong>{advantage > 0 ? `摆摊多得 ${money(advantage)} 元` : advantage < 0 ? `打工多得 ${money(-advantage)} 元` : "两种选择打平"}</strong>
        <span>600 − 6 × {money(wage)} = {money(advantage)} 元</span>
      </div>
      <p>令 600 − 6w = 0，得到临界时薪 w = 100 元。低于它，摆摊净现金更多；高于它，打工更多；恰好相等时，这个简化模型不能替你选出唯一答案。</p>
    </section>

    <section>
      <h2>上周付过的 120 元，放在哪里？</h2>
      <p>现在补上一条信息：你上周已经付了 120 元报名费，不能退款、转让或抵扣其他费用。无论周六去不去摆摊，这笔钱都拿不回来。这就是当前决策中的<strong>沉没成本</strong>。</p>
      <p>“不去就白付了”很容易让人继续投入。但问题是今天还能改变什么。120 元在两种选择下都已损失，因此不会改变 600 与 540 的比较。它仍属于项目的历史支出，只是不再影响今天选哪一个更划算。</p>
      <p>这也解释了为什么这里把 60 元叫作“从周六早上起，相对打工多得的净收益”，而不把它当作整个摆摊项目的历史利润。如果费用可以退回，或取消要新付违约金，就必须重新计入两项选择。</p>
    </section>

    <section>
      <h2>先确认做得到，再问值不值得</h2>
      <p>假如你现在只有 200 元，而摆摊需要在取得收入前付清 300 元，又不能借款、赊账或收预付款，摆摊就不在可行选项里。预计能赚更多，不能消除眼前的资金限制。</p>
      <p>再假如你这周很累，休息能带来重要的恢复；或者你就是喜欢与客人聊天。只算现金就漏掉了你在意的后果。经济学允许把这些偏好放进比较，并不要求人永远选收入最高的一项。</p>
      <p>若 900 元只是销售预测，问题还会多出风险。此时不能把预测收入当作保证收入，需要考虑不同结果发生的可能性、亏损承受能力，以及你对风险的态度。这是模型需要扩展的地方。</p>
    </section>

    <section className="exercise">
      <h2>换个场景，自己算一次</h2>
      <p>你有 4 小时，可以接一份布展工作：收入保证为 640 元，还需新付 160 元材料与交通费。另一份代班工作同样占用 4 小时，净收入保证为 400 元。布展的 80 元不可退报名费已在上周支付，选哪项都无法收回。两项都可行，其他后果相同。</p>
      <ol className="opportunity-questions">
        <li>代班的净收入提高到多少时，两项打平？满足什么条件时，代班才严格更划算？</li>
        <li>如果代班给出保证净收入 500 元，应选哪项？两项差多少？</li>
      </ol>
      <button className="secondary" type="button" aria-expanded={answerOpen} aria-controls={`${inputId}-answer`} onClick={() => setAnswerOpen(!answerOpen)}>{answerOpen ? "收起推导" : "我想好了，看看推导"}</button>
      {answerOpen && <div className="answer" id={`${inputId}-answer`}>
        <p>布展净现金是 640 − 160 = 480 元，比原来的代班多 80 元。所以代班净收入为 480 元时打平，超过 480 元时才严格更划算。如果报价只允许整元，最小是 481 元。</p>
        <p>代班改为 500 元时，选择代班，多得 500 − 480 = 20 元。80 元报名费在两种选择下都不可收回，不应再从某一项单独扣除。</p>
        <p>检查自己的方法：先找可行替代方案，比较从现在起的净收益，再确认没有把已经扣过的支出重复计算。</p>
      </div>}
    </section>

    <section className="opportunity-sources">
      <h2>继续读原教材</h2>
      <p>这节使用原创场景与数字。概念依据以下公开教材与讲义，正文为独立讲解。</p>
      <ul>
        <li><a href="https://books.core-econ.org/the-economy/microeconomics/02-technology-incentives-02-economic-decisions.html" target="_blank" rel="noreferrer">CORE · The Economy 2.0，2.2：机会成本、经济成本与选择</a></li>
        <li><a href="https://books.core-econ.org/the-economy/microeconomics/03-scarcity-wellbeing-04-feasible-set.html" target="_blank" rel="noreferrer">CORE · 3.4：可行集与预算约束</a></li>
        <li><a href="https://books.core-econ.org/the-economy/microeconomics/03-scarcity-wellbeing-03-goods-and-preferences.html" target="_blank" rel="noreferrer">CORE · 3.3：商品与偏好，包括自由时间</a></li>
        <li><a href="https://ocw.mit.edu/courses/14-01-principles-of-microeconomics-fall-2023/mit14_01_f23_full.pdf#page=12" target="_blank" rel="noreferrer">MIT 14.01（2023 秋）· Lecture 6，讲义第 12–13 页：沉没成本与经济利润</a></li>
      </ul>
    </section>
  </div>;
}
