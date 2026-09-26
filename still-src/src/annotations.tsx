import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ElementType,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  Copy,
  Highlighter,
  MessageSquareText,
  Trash2,
  Underline,
  X,
} from "lucide-react";

export type MarkKind = "underline" | "highlight";
type Segment = { p: string; start: number; end: number; text: string };
export type Annotation = {
  id: string;
  page: string;
  pageTitle: string;
  kind: MarkKind;
  note: string;
  segments: Segment[];
  createdAt: string;
  updatedAt: string;
};

// Annotations live only in this browser; every write reports failure instead of pretending to save.
const KEY = "still-annotations";
const SAVE_ERROR = "浏览器没能保存这条批注。可以先复制文字，稍后再试。";
let cache: Annotation[] | null = null;
const listeners = new Set<() => void>();

function isAnnotation(value: unknown): value is Annotation {
  const a = value as Annotation;
  return (
    !!a &&
    typeof a.id === "string" &&
    typeof a.page === "string" &&
    (a.kind === "underline" || a.kind === "highlight") &&
    typeof a.note === "string" &&
    Array.isArray(a.segments) &&
    a.segments.every(
      (s) =>
        typeof s?.p === "string" &&
        Number.isInteger(s.start) &&
        Number.isInteger(s.end) &&
        typeof s.text === "string",
    )
  );
}
function snapshot(): Annotation[] {
  if (!cache) {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "[]");
      cache = Array.isArray(value) ? value.filter(isAnnotation) : [];
    } catch {
      cache = [];
    }
  }
  return cache;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = null;
    listener();
  };
  addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    removeEventListener("storage", onStorage);
  };
}
function write(next: Annotation[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  cache = next;
  listeners.forEach((listener) => listener());
  return true;
}
function updateAnnotation(
  id: string,
  patch: Partial<Pick<Annotation, "kind" | "note">>,
) {
  const now = new Date().toISOString();
  return write(
    snapshot().map((a) => (a.id === id ? { ...a, ...patch, updatedAt: now } : a)),
  );
}
export function useAnnotations() {
  return useSyncExternalStore(subscribe, snapshot);
}

function newId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function localDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function kindLabel(a: Annotation) {
  return a.note ? "想法" : a.kind === "highlight" ? "马克笔" : "划线";
}
function quoteOf(a: Annotation) {
  return a.segments.map((s) => s.text).join("\n");
}
function groupByPage(list: Annotation[]) {
  const groups = new Map<string, { page: string; title: string; items: Annotation[] }>();
  for (const a of list) {
    const group = groups.get(a.page) || { page: a.page, title: a.pageTitle, items: [] };
    group.items.push(a);
    groups.set(a.page, group);
  }
  return [...groups.values()];
}
function toMarkdown(list: Annotation[]) {
  const base = `${location.origin}${location.pathname}`;
  const blocks = groupByPage(list).map((g) =>
    [
      `## ${g.title}`,
      `来源：${base}#/${g.page}`,
      ...g.items.map((a) =>
        [
          a.segments.map((s) => `> ${s.text}`).join("\n>\n"),
          a.note ? `想法：${a.note}` : "",
          `（${localDate(a.createdAt)} · ${kindLabel(a)}）`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      ),
    ].join("\n\n"),
  );
  return [`# 余间批注（导出于 ${localDate(new Date().toISOString())}）`, ...blocks].join("\n\n") + "\n";
}

// A saved segment is found again by its offsets, or by its text if the paragraph was edited later.
function locate(text: string, s: Segment): [number, number] | null {
  if (text.slice(s.start, s.end) === s.text) return [s.start, s.end];
  const at = s.text ? text.indexOf(s.text) : -1;
  return at >= 0 ? [at, at + s.text.length] : null;
}
function offsetIn(el: HTMLElement, node: Node, offset: number) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.setEnd(node, offset);
  return range.toString().length;
}
function segmentsOf(range: Range, root: HTMLElement): Segment[] {
  const out: Segment[] = [];
  root.querySelectorAll<HTMLElement>("[data-para]").forEach((el) => {
    if (!range.intersectsNode(el)) return;
    const text = el.textContent || "";
    let start = el.contains(range.startContainer)
      ? offsetIn(el, range.startContainer, range.startOffset)
      : 0;
    let end = el.contains(range.endContainer)
      ? offsetIn(el, range.endContainer, range.endOffset)
      : text.length;
    while (start < end && /\s/.test(text[start])) start++;
    while (end > start && /\s/.test(text[end - 1])) end--;
    if (end > start)
      out.push({ p: el.dataset.para!, start, end, text: text.slice(start, end) });
  });
  return out;
}

type Ctx = { marks: Annotation[]; open: (id: string) => void };
const AnnotationContext = createContext<Ctx | null>(null);

export function Para({
  id,
  text,
  as: Tag = "p",
}: {
  id: string;
  text: string;
  as?: ElementType;
}) {
  const ctx = useContext(AnnotationContext);
  if (!ctx) return <Tag>{text}</Tag>;
  const spans = ctx.marks.flatMap((m) =>
    m.segments.flatMap((s) => {
      if (s.p !== id) return [];
      const at = locate(text, s);
      if (!at) return [];
      const last = m.segments[m.segments.length - 1] === s;
      return [{ m, start: at[0], end: at[1], last }];
    }),
  );
  if (!spans.length) return <Tag data-para={id}>{text}</Tag>;
  const cuts = [
    ...new Set([0, text.length, ...spans.flatMap((s) => [s.start, s.end])]),
  ].sort((a, b) => a - b);
  const pieces: ReactNode[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i],
      b = cuts[i + 1];
    const cover = spans.filter((s) => s.start <= a && s.end >= b);
    if (!cover.length) {
      pieces.push(text.slice(a, b));
      continue;
    }
    const top = cover[cover.length - 1].m;
    const className = [
      "mark",
      cover.some((s) => s.m.kind === "underline") && "mark-underline",
      cover.some((s) => s.m.kind === "highlight") && "mark-highlight",
      cover.some((s) => s.m.note) && "mark-note",
      cover.some((s) => s.m.note && s.last && s.end === b) && "mark-note-end",
    ]
      .filter(Boolean)
      .join(" ");
    pieces.push(
      <span
        key={a}
        className={className}
        data-mark={top.id}
        role="button"
        tabIndex={0}
        onClick={() => {
          // A drag that ends on a mark is a new selection, not a tap.
          if (getSelection()?.isCollapsed !== false) ctx.open(top.id);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          ctx.open(top.id);
        }}
      >
        {text.slice(a, b)}
      </span>,
    );
  }
  return <Tag data-para={id}>{pieces}</Tag>;
}
export function Paragraphs({ id, text }: { id: string; text: string }) {
  return (
    <>
      {text
        .split("\n\n")
        .filter(Boolean)
        .map((p, i) => (
          <Para key={i} id={`${id}.${i}`} text={p} />
        ))}
    </>
  );
}

type Pending = { segments: Segment[]; x: number; y: number; above: boolean };
export function Annotatable({
  page,
  title,
  root,
  children,
}: {
  page: string;
  title: string;
  root: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const all = useAnnotations();
  const marks = useMemo(() => all.filter((a) => a.page === page), [all, page]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Segment[] | null>(null);
  const [error, setError] = useState("");
  const pressingBar = useRef(false);

  useEffect(() => {
    let hideTimer = 0;
    const measure = (): Pending | null => {
      const selection = getSelection();
      const el = root.current;
      if (!el || !selection || selection.isCollapsed || !selection.rangeCount)
        return null;
      const range = selection.getRangeAt(0);
      const segments = segmentsOf(range, el);
      if (!segments.length) return null;
      const rect = range.getBoundingClientRect();
      // Sit below the selection so the phone's own copy menu above it stays usable.
      const above = rect.bottom + 70 > innerHeight;
      const x = Math.min(Math.max(rect.left + rect.width / 2, 130), innerWidth - 130);
      return { segments, x, y: above ? rect.top - 12 : rect.bottom + 12, above };
    };
    const onChange = () => {
      clearTimeout(hideTimer);
      const next = measure();
      if (next) {
        setPending(next);
        return;
      }
      if (pressingBar.current) return;
      hideTimer = window.setTimeout(() => setPending(null), 200);
    };
    const onScroll = () => {
      const next = measure();
      if (next) setPending(next);
    };
    document.addEventListener("selectionchange", onChange);
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(hideTimer);
      document.removeEventListener("selectionchange", onChange);
      removeEventListener("scroll", onScroll);
    };
  }, [root]);

  function create(kind: MarkKind, segments: Segment[], note = "") {
    const now = new Date().toISOString();
    const ok = write([
      ...snapshot(),
      { id: newId(), page, pageTitle: title, kind, note, segments, createdAt: now, updatedAt: now },
    ]);
    setError(ok ? "" : SAVE_ERROR);
    return ok;
  }
  function releaseBar() {
    // The click (if any) lands before this runs; a press that slid off the bar just closes it.
    setTimeout(() => {
      pressingBar.current = false;
      if (getSelection()?.isCollapsed !== false) setPending(null);
    }, 300);
  }
  function finishSelection() {
    pressingBar.current = false;
    getSelection()?.removeAllRanges();
    setPending(null);
  }
  const open = marks.find((m) => m.id === openId);

  return (
    <AnnotationContext.Provider value={{ marks, open: setOpenId }}>
      {children}
      {pending &&
        createPortal(
          <div
            className={`annot-bar${pending.above ? " above" : ""}`}
            style={{ left: pending.x, top: pending.y }}
            role="toolbar"
            aria-label="批注工具"
            onPointerDown={(e) => {
              pressingBar.current = true;
              e.preventDefault();
            }}
            onPointerUp={releaseBar}
            onPointerCancel={releaseBar}
          >
            <button
              type="button"
              onClick={() => {
                if (create("underline", pending.segments)) finishSelection();
              }}
            >
              <Underline size={16} />
              划线
            </button>
            <button
              type="button"
              onClick={() => {
                if (create("highlight", pending.segments)) finishSelection();
              }}
            >
              <Highlighter size={16} />
              马克笔
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(pending.segments);
                finishSelection();
              }}
            >
              <MessageSquareText size={16} />
              写想法
            </button>
          </div>,
          document.body,
        )}
      {draft && (
        <NoteSheet
          key="draft"
          quote={draft.map((s) => s.text).join("\n")}
          note=""
          error={error}
          onSave={(note) => {
            if (create("underline", draft, note)) setDraft(null);
          }}
          onClose={() => {
            setDraft(null);
            setError("");
          }}
        />
      )}
      {open && (
        <NoteSheet
          key={open.id}
          quote={quoteOf(open)}
          note={open.note}
          kind={open.kind}
          error={error}
          onKind={(kind) => setError(updateAnnotation(open.id, { kind }) ? "" : SAVE_ERROR)}
          onSave={(note) => {
            const ok = updateAnnotation(open.id, { note });
            setError(ok ? "" : SAVE_ERROR);
            if (ok) setOpenId(null);
          }}
          onDelete={() => {
            if (open.note && !confirm("删除这条批注和写下的想法？")) return;
            const ok = write(snapshot().filter((a) => a.id !== open.id));
            setError(ok ? "" : SAVE_ERROR);
            if (ok) setOpenId(null);
          }}
          onClose={() => {
            setOpenId(null);
            setError("");
          }}
        />
      )}
    </AnnotationContext.Provider>
  );
}

function NoteSheet({
  quote,
  note,
  kind,
  error,
  onSave,
  onKind,
  onDelete,
  onClose,
}: {
  quote: string;
  note: string;
  kind?: MarkKind;
  error: string;
  onSave: (note: string) => void;
  onKind?: (kind: MarkKind) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(note);
  const isNew = !onDelete;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="annot-backdrop" onClick={onClose}>
      <div
        className="annot-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? "写想法" : "这条批注"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="annot-sheet-head">
          <span>{isNew ? "写想法" : "这条批注"}</span>
          <button type="button" className="annot-icon" aria-label="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <blockquote>{quote}</blockquote>
        {kind && onKind && (
          <div className="annot-kinds" role="group" aria-label="批注样式">
            <button type="button" aria-pressed={kind === "underline"} onClick={() => onKind("underline")}>
              <Underline size={15} />
              划线
            </button>
            <button type="button" aria-pressed={kind === "highlight"} onClick={() => onKind("highlight")}>
              <Highlighter size={15} />
              马克笔
            </button>
          </div>
        )}
        <label htmlFor="annot-note">我的想法</label>
        <textarea
          id="annot-note"
          value={value}
          maxLength={2000}
          autoFocus={isNew}
          placeholder="这句话让我想到……"
          onChange={(e) => setValue(e.target.value)}
        />
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="annot-actions">
          {onDelete && (
            <button type="button" className="quiet-button" onClick={onDelete}>
              <Trash2 size={15} />
              删除批注
            </button>
          )}
          <button
            type="button"
            className="primary"
            disabled={isNew ? !value.trim() : value === note}
            onClick={() => onSave(value.trim())}
          >
            {isNew ? "保存想法" : "保存修改"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function AnnotationHint() {
  return <p className="annot-hint">选中文字，可以划线、用马克笔或写想法。</p>;
}

function AnnotationItems({ items, onOpen }: { items: Annotation[]; onOpen?: (a: Annotation) => void }) {
  return (
    <ul className="annot-items">
      {items.map((a) => {
        const body = (
          <>
            <blockquote className={a.kind === "highlight" ? "is-highlight" : ""}>{quoteOf(a)}</blockquote>
            {a.note && <p className="annot-note">{a.note}</p>}
            <span className="annot-meta">
              {kindLabel(a)} · {localDate(a.createdAt)}
            </span>
          </>
        );
        return (
          <li key={a.id}>
            {onOpen ? (
              <button type="button" className="annot-item" onClick={() => onOpen(a)}>
                {body}
              </button>
            ) : (
              <div className="annot-item">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function CopyMarkdown({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "done" | "manual">("idle");
  return (
    <div className="annot-copy">
      <button
        type="button"
        className="secondary"
        onClick={() =>
          navigator.clipboard
            .writeText(text)
            .then(() => setState("done"), () => setState("manual"))
        }
      >
        <Copy size={15} />
        {label}
      </button>
      {state === "done" && (
        <span role="status" className="small muted">
          已复制，可以粘贴到笔记或发给 Codex 存进 LifeWiki。
        </span>
      )}
      {state === "manual" && (
        <>
          <p role="status" className="small">
            没能自动复制，请长按下面的文字全选复制。
          </p>
          <textarea readOnly value={text} onFocus={(e) => e.target.select()} />
        </>
      )}
    </div>
  );
}

export function AnnotationList() {
  const ctx = useContext(AnnotationContext);
  if (!ctx || !ctx.marks.length) return null;
  return (
    <section className="annot-list" aria-label="本篇批注">
      <h2>本篇批注 · {ctx.marks.length}</h2>
      <AnnotationItems
        items={ctx.marks}
        onOpen={(a) => {
          document
            .querySelector(`[data-mark="${a.id}"]`)
            ?.scrollIntoView({ block: "center", behavior: "smooth" });
          ctx.open(a.id);
        }}
      />
      <CopyMarkdown text={toMarkdown(ctx.marks)} label="复制本篇批注" />
    </section>
  );
}

export function NotesPage({ home }: { home: string }) {
  const all = useAnnotations();
  const groups = groupByPage([...all].reverse());
  return (
    <article className="reader notes-page">
      <h1>我的批注</h1>
      <p className="dek">
        {all.length
          ? `共 ${all.length} 条，只保存在这台设备的浏览器里。重要的想法，记得复制出去存好。`
          : "还没有批注。读课程或文章时，选中文字就能划线、用马克笔或写想法。"}
      </p>
      {all.length > 0 && <CopyMarkdown text={toMarkdown(all)} label="复制全部批注" />}
      {groups.map((g) => (
        <section key={g.page}>
          <h2>
            <a href={`#/${g.page}`}>{g.title}</a>
          </h2>
          <AnnotationItems items={g.items} />
        </section>
      ))}
      {!all.length && (
        <a className="primary" href={home}>
          去读一点
        </a>
      )}
    </article>
  );
}
