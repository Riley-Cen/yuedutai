import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ElementType,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
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

const KEY = "still-annotations";
let cache: Annotation[] | null = null;
const listeners = new Set<() => void>();

function snapshot(): Annotation[] {
  return cache ??= JSON.parse(localStorage.getItem(KEY) || "[]");
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function write(next: Annotation[]) {
  localStorage.setItem(KEY, JSON.stringify(next));
  cache = next;
  listeners.forEach((listener) => listener());
}
function useAnnotations() {
  return useSyncExternalStore(subscribe, snapshot);
}
function quoteOf(a: Annotation) {
  return a.segments.map((s) => s.text).join("\n");
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
    const start = el.contains(range.startContainer)
      ? offsetIn(el, range.startContainer, range.startOffset)
      : 0;
    const end = el.contains(range.endContainer)
      ? offsetIn(el, range.endContainer, range.endOffset)
      : text.length;
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
      return [{ m, start: s.start, end: s.end }];
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
    ]
      .filter(Boolean)
      .join(" ");
    pieces.push(
      <span
        key={a}
        className={className}
        data-mark={top.id}
        onClick={() => {
          // A drag that ends on a mark is a new selection, not a tap.
          if (getSelection()?.isCollapsed !== false) ctx.open(top.id);
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

type Pending = { segments: Segment[]; x: number; y: number };
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
  useEffect(() => {
    const onChange = () => {
      const selection = getSelection();
      const el = root.current;
      if (!el || !selection || selection.isCollapsed || !selection.rangeCount) {
        setPending(null);
        return;
      }
      const range = selection.getRangeAt(0);
      const segments = segmentsOf(range, el);
      const rect = range.getBoundingClientRect();
      const x = Math.min(Math.max(rect.left + rect.width / 2, 130), innerWidth - 130);
      setPending(segments.length ? { segments, x, y: rect.bottom + 12 } : null);
    };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, [root]);

  function create(kind: MarkKind, segments: Segment[], note = "") {
    const now = new Date().toISOString();
    write([
      ...snapshot(),
      { id: crypto.randomUUID(), page, pageTitle: title, kind, note, segments, createdAt: now, updatedAt: now },
    ]);
  }
  function finishSelection() {
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
            className="annot-bar"
            style={{ left: pending.x, top: pending.y }}
            role="toolbar"
            aria-label="批注工具"
            onPointerDown={(e) => e.preventDefault()}
          >
            <button
              type="button"
              onClick={() => {
                create("underline", pending.segments);
                finishSelection();
              }}
            >
              <Underline size={16} />
              划线
            </button>
            <button
              type="button"
              onClick={() => {
                create("highlight", pending.segments);
                finishSelection();
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
          onSave={(note) => {
            create("underline", draft, note);
            setDraft(null);
          }}
          onClose={() => {
            setDraft(null);
          }}
        />
      )}
      {open && (
        <NoteSheet
          key={open.id}
          quote={quoteOf(open)}
          note={open.note}
          onSave={(note) => {
            write(snapshot().map((a) => a.id === open.id
              ? { ...a, note, updatedAt: new Date().toISOString() } : a));
            setOpenId(null);
          }}
          onDelete={() => {
            write(snapshot().filter((a) => a.id !== open.id));
            setOpenId(null);
          }}
          onClose={() => {
            setOpenId(null);
          }}
        />
      )}
    </AnnotationContext.Provider>
  );
}

function NoteSheet({
  quote,
  note,
  onSave,
  onDelete,
  onClose,
}: {
  quote: string;
  note: string;
  onSave: (note: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(note);
  const isNew = !onDelete;
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
        <label htmlFor="annot-note">我的想法</label>
        <textarea
          id="annot-note"
          value={value}
          maxLength={2000}
          autoFocus={isNew}
          placeholder="这句话让我想到……"
          onChange={(e) => setValue(e.target.value)}
        />
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
