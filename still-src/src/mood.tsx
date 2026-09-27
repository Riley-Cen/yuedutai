import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Download,
  HeartHandshake,
  LockKeyhole,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "./tabs";
import {
  createVault,
  eraseVault,
  openAll,
  putEntry,
  readVault,
  removeEntry,
  unlock,
  type Entry,
  type Vault,
} from "./mood-vault";

const guides = [
  {
    title: "先感觉到脚下。",
    text: "不用急着改变心情。让脚轻轻接触地面，注意它被托住的感觉。如果这样不舒服，就看看身边一个熟悉的物件。",
  },
  {
    title: "把注意力放回这里。",
    text: "慢慢看一看，找出眼前的三样东西；再听一听，留意一个声音。你可以按自己的节奏呼吸，不用数拍，也不用闭眼。",
  },
  {
    title: "给自己留一句温和的话。",
    text: "可以试着说：“我注意到自己现在很难受。”不需要立刻说服自己好起来。接下来，喝口水、换个位置，或找一个信任的人，都可以。",
  },
];
const prompts = [
  { label: "发生了什么？", hint: "先写能观察到的事，不急着解释。" },
  { label: "当时有什么感受和想法？", hint: "它可以是混乱的，也可以有好几种。" },
  {
    label: "有哪些支持、或不支持这个想法的事实？",
    hint: "如果想不起来，空着也可以。",
  },
  {
    label: "有没有另一种可能？眼下需要什么？",
    hint: "不必强行积极，只试一个更完整、温和的说法。",
  },
];
const intentLabel: Record<string, string> = {
  express: "把话说完",
  breathe: "缓一缓",
  reflect: "理一理",
};
const saveFailed =
  "没能保存这条记录，文字还在输入框里，可以先复制留底。如果别的页面也开着余间，刷新后再保存。";
const sequences = ["0123456789".repeat(4), "abcdefghijklmnopqrstuvwxyz".repeat(2)];
function passphraseProblem(passphrase: string, again: string) {
  const lower = passphrase.toLowerCase();
  if ([...passphrase].length < 15) return "口令至少要 15 个字。";
  if (
    /^(.+?)\1+$/su.test(passphrase) ||
    sequences.some(
      (s) => s.includes(lower) || [...s].reverse().join("").includes(lower),
    )
  )
    return "这个口令是重复或连续的字符，太容易猜，换一句吧。";
  if (passphrase !== again) return "两次输入的口令不一样。";
  return "";
}
function dateLabel(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MoodPage() {
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [intent, setIntent] = useState("express");
  const [content, setContent] = useState("");
  const [answers, setAnswers] = useState(["", "", "", ""]);
  const [step, setStep] = useState(0);
  const [guideOn, setGuideOn] = useState(true);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [change, setChange] = useState("");
  const [helpful, setHelpful] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [setup, setSetup] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [again, setAgain] = useState("");

  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => {
      if (content && !saved) event.preventDefault();
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [content, saved]);

  function startNew() {
    setEntry(null);
    setContent("");
    setAnswers(["", "", "", ""]);
    setChange("");
    setHelpful("");
    setSaved(false);
    setFeedback("");
    setError("");
    setStep(0);
    setGuideOn(intent !== "breathe");
    requestAnimationFrame(() => contentRef.current?.focus());
  }

  async function store(vault: Vault, next: Entry, message: string) {
    setBusy(true);
    setError("");
    try {
      await putEntry(vault, next, !!entry);
      setEntry(next);
      setSaved(true);
      setFeedback(message);
      return true;
    } catch {
      setError(saveFailed);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function draft(): Entry {
    return {
      id: entry?.id ?? crypto.randomUUID(),
      intent,
      content,
      reflection: answers
        .map((answer, index) =>
          answer ? `${prompts[index].label}\n${answer}` : "",
        )
        .filter(Boolean)
        .join("\n\n"),
      change: entry?.change ?? "",
      helpful: entry?.helpful ?? "",
      createdAt: entry?.createdAt ?? new Date().toISOString(),
    };
  }

  function save() {
    const vault = readVault();
    if (!vault) {
      setSetup(true);
      return;
    }
    void store(vault, draft(), "已加密保存在这台设备上。");
  }

  async function setupAndSave() {
    const problem = passphraseProblem(passphrase, again);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    let vault: Vault;
    try {
      vault = await createVault(passphrase);
    } catch {
      setBusy(false);
      setError(
        readVault()
          ? "别的页面已经在这台设备上设过口令。请刷新后再保存，文字可以先复制留底。"
          : saveFailed,
      );
      return;
    }
    if (await store(vault, draft(), "口令已设好，这条已加密保存在这台设备上。")) {
      setSetup(false);
      setPassphrase("");
      setAgain("");
    }
  }

  function saveChange() {
    const vault = readVault();
    if (!vault || !entry) {
      setError(saveFailed);
      return;
    }
    void store(vault, { ...entry, change, helpful }, "变化已保存。");
  }

  return (
    <>
      <div className="mood-intro">
        <img
          src="./still-paper-web.jpg"
          className="mood-thumb"
          alt="纸页间的橙色太阳"
          style={{ objectPosition: "70% center" }}
        />
        <div>
          <h1>这里，先留给你。</h1>
          <p className="subtitle">不用组织好语言，也不用立刻找到答案。</p>
        </div>
      </div>
      <Tabs
        value={intent}
        onValueChange={(value) => {
          setIntent(value);
          setGuideOn(true);
          setSaved(false);
        }}
      >
        <TabsList className="intents" aria-label="此刻想要的支持">
          <TabsTrigger disabled={busy} value="express">
            先让我说完
          </TabsTrigger>
          <TabsTrigger disabled={busy} value="breathe">
            带我缓一缓
          </TabsTrigger>
          <TabsTrigger disabled={busy} value="reflect">
            陪我理清楚
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {intent === "breathe" && guideOn && (
        <div className="guide">
          <div className="guide-top">
            <span className="eyebrow">落地练习</span>
            <span className="guide-step">0{step + 1}</span>
          </div>
          <h2>{guides[step].title}</h2>
          <p>{guides[step].text}</p>
          <button
            className="secondary"
            onClick={() => (step < 2 ? setStep(step + 1) : setGuideOn(false))}
          >
            {step < 2 ? "继续" : "结束练习"}
            <ArrowRight size={16} />
          </button>
          <button className="quiet-button" onClick={() => setGuideOn(false)}>
            随时停下
          </button>
        </div>
      )}
      <div className="writing-space">
        <div className="writing-title">
          <h2>
            {intent === "express"
              ? "想说的话，都可以放在这里。"
              : intent === "breathe"
                ? "缓下来之后，想留下什么？"
                : "先把这件事，放在面前。"}
          </h2>
        </div>
        <label className="sr-only" htmlFor="mood-content">
          我想说的话
        </label>
        <textarea
          ref={contentRef}
          disabled={busy}
          id="mood-content"
          value={content}
          maxLength={12000}
          onChange={(event) => {
            setContent(event.target.value);
            setSaved(false);
            setFeedback("");
          }}
          placeholder={"现在，我……\n\n也可以把你愿意留存的对话整理粘贴到这里。"}
        />
        <div className="writing-foot">
          <span>心情内容只加密存在这台设备的这个浏览器里，不上传。</span>
          <LockKeyhole size={14} />
        </div>
      </div>
      {intent === "reflect" && (
        <div className="reflection">
          <h2>愿意的话，一次理一小部分。</h2>
          <p>下面都是可跳过的提示。写下的解释只是此刻的版本，随时可以修改。</p>
          {prompts.map((prompt, index) => (
            <div key={prompt.label}>
              <label htmlFor={`reflect-${index}`}>{prompt.label}</label>
              <textarea
                disabled={busy}
                id={`reflect-${index}`}
                value={answers[index]}
                maxLength={1400}
                onChange={(event) => {
                  setAnswers(
                    answers.map((answer, answerIndex) =>
                      index === answerIndex ? event.target.value : answer,
                    ),
                  );
                  setSaved(false);
                }}
                placeholder={prompt.hint}
              />
            </div>
          ))}
        </div>
      )}
      {setup ? (
        <div className="reflection">
          <h2>第一次保存，先设一个口令。</h2>
          <p>
            以后写记录不用口令，回看时才要。忘记口令就再也打不开这些记录，没有人能帮你找回。
          </p>
          <label htmlFor="new-passphrase">口令（至少 15 个字）</label>
          <input
            disabled={busy}
            id="new-passphrase"
            type="password"
            autoComplete="new-password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="用一句只属于你、别处没用过的话，避开常见句子"
          />
          <label htmlFor="new-passphrase-again">再输一次</label>
          <input
            disabled={busy}
            id="new-passphrase-again"
            type="password"
            autoComplete="new-password"
            value={again}
            onChange={(event) => setAgain(event.target.value)}
          />
          <div className="mood-actions">
            <button
              className="primary warm"
              disabled={busy || !passphrase || !again}
              onClick={setupAndSave}
            >
              {busy ? "正在加密…" : "设好口令并保存"}
            </button>
            <button
              className="quiet-button"
              disabled={busy}
              onClick={() => {
                setSetup(false);
                setError("");
              }}
            >
              先不保存
            </button>
          </div>
        </div>
      ) : (
        <div className="mood-actions">
          <button
            className="primary warm"
            disabled={busy || !content.trim() || saved}
            onClick={save}
          >
            {saved ? (
              <>
                <Check size={17} />
                已保存
              </>
            ) : busy ? (
              "保存中…"
            ) : (
              "保存这条记录"
            )}
          </button>
          {saved && (
            <button className="secondary" disabled={busy} onClick={startNew}>
              写新的一条
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="error" style={{ marginTop: 14 }}>
          {error}
        </p>
      )}
      {feedback && (
        <p role="status" className="success">
          {feedback}
        </p>
      )}
      {saved && (
        <div className="after-save">
          <h2>现在，有什么变化吗？</h2>
          <p className="small muted">可以没有变化，也可以暂时不回答。</p>
          <label htmlFor="change">我感受到的变化</label>
          <input
            disabled={busy}
            id="change"
            value={change}
            onChange={(event) => setChange(event.target.value)}
            maxLength={1000}
            placeholder="例如：还是难受，但没刚才那么挤了"
          />
          <label htmlFor="helpful">刚才什么对我有帮助？</label>
          <input
            disabled={busy}
            id="helpful"
            value={helpful}
            onChange={(event) => setHelpful(event.target.value)}
            maxLength={2000}
            placeholder="一句话、一个动作，或者还不知道"
          />
          <button className="secondary" disabled={busy} onClick={saveChange}>
            记下这点变化
          </button>
          <a className="quiet-button" href="#/journal">
            查看回顾
            <ArrowRight size={15} />
          </a>
        </div>
      )}
      <div className="mood-secondary">
        <button onClick={() => setShowHelp(!showHelp)} aria-expanded={showHelp}>
          找一个可信赖的人
        </button>
      </div>
      {showHelp && (
        <div className="help-box">
          <h3 style={{ display: "flex", gap: 9, alignItems: "center" }}>
            <HeartHandshake size={19} />
            也可以让真人陪你一会儿
          </h3>
          <p>
            你可以打开常用的聊天工具，选一个信任的人，按自己的话告诉对方：“我现在有点难受，你方便听我说一会儿吗？”
            是否联系、说多少，都由你决定。这里不会替你发送消息。
          </p>
          <p>
            如果你担心自己会立刻受伤，先去有人在、相对安全的地方，并联系当地急救服务或身边可信赖的人。
          </p>
        </div>
      )}
      <div className="sources">
        练习参考{" "}
        <a
          href="https://www.who.int/publications/i/item/9789240003927"
          target="_blank"
          rel="noreferrer"
        >
          WHO 压力应对指南
        </a>{" "}
        与{" "}
        <a
          href="https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/self-help-cbt-techniques/thought-record/"
          target="_blank"
          rel="noreferrer"
        >
          NHS 想法记录
        </a>
        。<br />
        未保存的文字会在离开页面后丢失。
      </div>
    </>
  );
}

function entryText(entry: Entry) {
  return [
    `## ${dateLabel(entry.createdAt)} · ${intentLabel[entry.intent]}`,
    entry.content,
    entry.reflection ? `**我的梳理**\n\n${entry.reflection}` : "",
    entry.change ? `我感受到的变化：${entry.change}` : "",
    entry.helpful ? `对我有帮助：${entry.helpful}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function EntryCard({
  entry,
  onSave,
  onDelete,
}: {
  entry: Entry;
  onSave: (entry: Entry) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [edit, setEdit] = useState(false),
    [content, setContent] = useState(entry.content),
    [reflection, setReflection] = useState(entry.reflection),
    [change, setChange] = useState(entry.change),
    [helpful, setHelpful] = useState(entry.helpful),
    [busy, setBusy] = useState(false);
  return (
    <article className="entry">
      <div className="entry-head">
        <time dateTime={entry.createdAt}>{dateLabel(entry.createdAt)}</time>
        <span>{intentLabel[entry.intent]}</span>
      </div>
      {edit ? (
        <div className="reflection" style={{ padding: 15 }}>
          <label htmlFor={`content-${entry.id}`}>当时想说的话</label>
          <textarea
            disabled={busy}
            id={`content-${entry.id}`}
            value={content}
            maxLength={12000}
            onChange={(event) => setContent(event.target.value)}
          />
          <label htmlFor={`reflection-${entry.id}`}>我的梳理（随时可改）</label>
          <textarea
            disabled={busy}
            id={`reflection-${entry.id}`}
            value={reflection}
            maxLength={6000}
            onChange={(event) => setReflection(event.target.value)}
          />
          <label htmlFor={`change-${entry.id}`}>我感受到的变化</label>
          <textarea
            disabled={busy}
            id={`change-${entry.id}`}
            value={change}
            maxLength={1000}
            onChange={(event) => setChange(event.target.value)}
          />
          <label htmlFor={`helpful-${entry.id}`}>对我有帮助的</label>
          <textarea
            disabled={busy}
            id={`helpful-${entry.id}`}
            value={helpful}
            maxLength={2000}
            onChange={(event) => setHelpful(event.target.value)}
          />
          <button
            className="primary"
            disabled={busy || !content.trim()}
            onClick={async () => {
              setBusy(true);
              if (await onSave({ ...entry, content, reflection, change, helpful }))
                setEdit(false);
              setBusy(false);
            }}
          >
            保存修改
          </button>
          <button
            className="quiet-button"
            disabled={busy}
            onClick={() => {
              setEdit(false);
              setContent(entry.content);
              setReflection(entry.reflection);
              setChange(entry.change);
              setHelpful(entry.helpful);
            }}
          >
            取消
          </button>
        </div>
      ) : (
        <>
          <p className="entry-content">{entry.content}</p>
          {entry.reflection && (
            <details className="entry-summary">
              <summary style={{ cursor: "pointer" }}>当时的梳理 · 可以修改</summary>
              <p style={{ whiteSpace: "pre-wrap", marginTop: 14 }}>
                {entry.reflection}
              </p>
            </details>
          )}
          {(entry.change || entry.helpful) && (
            <div className="entry-summary">
              {entry.change && (
                <p style={{ marginBottom: 8 }}>我感受到的变化：{entry.change}</p>
              )}
              {entry.helpful && (
                <p style={{ marginBottom: 0 }}>对我有帮助：{entry.helpful}</p>
              )}
            </div>
          )}
          <div className="entry-actions">
            <button className="secondary" onClick={() => setEdit(true)}>
              补充或修改
            </button>
            <button
              className="quiet-button"
              onClick={() => {
                if (confirm("删除这条记录？删除后无法恢复。")) onDelete();
              }}
            >
              删除这条
            </button>
          </div>
        </>
      )}
    </article>
  );
}

export function JournalPage() {
  const [vault, setVault] = useState(readVault),
    [privateKey, setPrivateKey] = useState<CryptoKey | null>(null),
    [items, setItems] = useState<Entry[]>([]),
    [passphrase, setPassphrase] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const count = vault?.entries.length ?? 0;

  // 别的页面改了记录：同一个库就重新解开最新内容，库被删或换了口令就锁上并清掉明文。
  useEffect(() => {
    const sync = async () => {
      const stored = readVault();
      setVault(stored);
      if (stored?.wrappedKey !== vault?.wrappedKey) {
        setPrivateKey(null);
        setItems([]);
        return;
      }
      if (!stored || !privateKey) return;
      try {
        setItems(await openAll(stored, privateKey));
      } catch {
        setError("有记录没能解开，可能已经损坏。");
      }
    };
    const listener = () => void sync();
    addEventListener("storage", listener);
    return () => removeEventListener("storage", listener);
  }, [vault?.wrappedKey, privateKey]);

  async function open() {
    if (!vault) return;
    setBusy(true);
    setError("");
    let key: CryptoKey;
    try {
      key = await unlock(vault, passphrase);
    } catch {
      setBusy(false);
      setError("口令不对。");
      return;
    }
    try {
      setItems(await openAll(vault, key));
      setPrivateKey(key);
      setPassphrase("");
    } catch {
      setError("有记录没能解开，可能已经损坏。");
    } finally {
      setBusy(false);
    }
  }
  const writeFailed =
    "没能保存这次改动，记录仍是改动前的样子。如果别的页面也开着余间，刷新后再试。";
  async function saveEntry(next: Entry) {
    if (!vault) return false;
    try {
      setVault(await putEntry(vault, next, true));
    } catch {
      setError(writeFailed);
      return false;
    }
    setError("");
    setItems((list) => list.map((item) => (item.id === next.id ? next : item)));
    return true;
  }
  function deleteEntry(id: string) {
    if (!vault) return;
    try {
      setVault(removeEntry(vault, id));
    } catch {
      setError(writeFailed);
      return;
    }
    setError("");
    setItems((list) => list.filter((item) => item.id !== id));
  }
  function deleteAll() {
    if (
      !confirm(
        `删除这台设备上的全部 ${count} 条记录和口令？删除后无法恢复；已导出的文件不受影响。`,
      )
    )
      return;
    try {
      eraseVault();
      setVault(null);
      setPrivateKey(null);
      setItems([]);
      setError("");
    } catch {
      setError("浏览器没能删除记录。");
    }
  }
  function exportAll() {
    const url = URL.createObjectURL(
      new Blob(
        [`# 余间 · 心情记录\n\n${items.map(entryText).join("\n\n---\n\n")}\n`],
        { type: "text/markdown;charset=utf-8" },
      ),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `余间心情记录-${new Date().toISOString().slice(0, 10)}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="title-row">
        <div>
          <h1>回头，看见自己。</h1>
          <p className="subtitle">留住你说过的变化，和真正有帮助的小事。</p>
        </div>
        {privateKey && !!items.length && (
          <button className="secondary" onClick={exportAll}>
            <Download size={16} />
            导出全部
          </button>
        )}
      </div>
      <p className="private-note">
        <LockKeyhole size={14} />
        心情内容只加密存在这台设备的这个浏览器里，不上传。
      </p>
      {privateKey && !!items.length && (
        <p className="sources">导出的是明文文件，存到哪里由你决定。</p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!count ? (
        <div className="empty-state">
          <h2>还没有保存的记录。</h2>
          <p>你在心情空间保存的文字会出现在这里。</p>
          <a className="primary" href="#/mood">
            写一条记录
            <ArrowRight size={16} />
          </a>
        </div>
      ) : !privateKey ? (
        <form
          className="reflection"
          onSubmit={(event) => {
            event.preventDefault();
            void open();
          }}
        >
          <h2>这台设备上有 {count} 条加密记录。</h2>
          <label htmlFor="passphrase">输入口令打开</label>
          <input
            disabled={busy}
            id="passphrase"
            type="password"
            autoComplete="current-password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
          />
          <div className="mood-actions">
            <button className="primary" disabled={busy || !passphrase}>
              {busy ? "正在打开…" : "打开回顾"}
            </button>
          </div>
        </form>
      ) : (
        <div className="entries">
          {items.map((entry) => (
            <EntryCard
              entry={entry}
              key={entry.id}
              onSave={saveEntry}
              onDelete={() => deleteEntry(entry.id)}
            />
          ))}
        </div>
      )}
      <div className="sources">
        清除浏览器数据或换设备，记录会丢失。在 Safari 里，如果你用了 7
        天浏览器都没打开余间，记录可能被清掉；加到主屏幕的余间不受这条限制，但它和
        Safari 各存各的。固定从一个入口写，定期导出留底。
        {!!count && (
          <>
            <br />
            <button className="quiet-button" onClick={deleteAll}>
              全部删除（忘记口令时也用这个）
            </button>
          </>
        )}
      </div>
    </>
  );
}
