"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  History,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  PlugZap,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { TutorOrb } from "@/components/brand/tutor-orb";
import { SaveError } from "@/components/onboarding/save-error";
import { useSave } from "@/components/onboarding/use-save";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { PERSONALITIES, TEACHING_STYLES, optionFor, type TutorSettings } from "@/lib/tutor/options";
import { MAX_TOPIC, MAX_USER_MESSAGE } from "@/lib/tutor/schemas";
import { suggestedQuestions } from "@/lib/tutor/suggestions";
import { cn } from "@/lib/utils/cn";
import { deleteConversation, loadEarlierMessages, renameConversation } from "@/server/tutor/actions";
import type { ConversationSummary, StoredMessage, TutorSubject } from "@/server/tutor/data";
import { TutorMarkdown } from "./tutor-markdown";
import { useTutorChat, type ChatError, type ChatMessage } from "./use-tutor-chat";

export type TutorWorkspaceProps = {
  firstName: string | null;
  tutor: TutorSettings;
  tutorCustomised: boolean;
  subjects: TutorSubject[];
  conversations: ConversationSummary[];
  active: { conversation: ConversationSummary; messages: StoredMessage[]; hasEarlier: boolean } | null;
  ready: boolean;
  missing: string[];
  consentRequired: boolean;
  remainingMessages: number;
  initialSubjectId: string | null;
  initialTopic?: string;
};

export function TutorWorkspace(props: TutorWorkspaceProps) {
  const { tutor, subjects, active } = props;
  const router = useRouter();
  const [conversations, setConversations] = useState(props.conversations);
  const [title, setTitle] = useState(active?.conversation.title ?? null);
  const [subjectId, setSubjectId] = useState<string | null>(active?.conversation.subjectId ?? props.initialSubjectId);
  const [topic, setTopic] = useState(active?.conversation.topic ?? props.initialTopic ?? "");
  const [draft, setDraft] = useState("");
  const [hasEarlier, setHasEarlier] = useState(active?.hasEarlier ?? false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [remaining, setRemaining] = useState(props.remainingMessages);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const chat = useTutorChat({
    initialMessages: (active?.messages ?? []).map((m) => ({ ...m })),
    conversationId: active?.conversation.id ?? null,
    onStarted: useCallback(
      ({ id, title: t, isNew }: { id: string; title: string; isNew: boolean }) => {
        setTitle(t);
        setRemaining((r) => Math.max(0, r - 1));
        setConversations((list) => {
          const existing = list.find((c) => c.id === id);
          const updated: ConversationSummary = existing
            ? { ...existing, lastMessageAt: new Date().toISOString() }
            : {
                id,
                title: t,
                subjectId,
                topic: topic || null,
                lastMessageAt: new Date().toISOString(),
                messageCount: 0,
              };
          return [updated, ...list.filter((c) => c.id !== id)];
        });
        // Give the new conversation its own address without reloading the page.
        if (isNew) window.history.replaceState(null, "", `/app/tutor/c/${id}`);
      },
      [subjectId, topic],
    ),
    onRestore: useCallback((content: string) => {
      setDraft((d) => d || content);
      setRemaining((r) => r); // unchanged — failed turns aren't counted
    }, []),
  });

  const busy = chat.phase !== "idle";
  const canChat = props.ready && !props.consentRequired;
  const subject = subjects.find((s) => s.id === subjectId) ?? null;
  const orbState = chat.phase === "waiting" ? "thinking" : chat.phase === "streaming" ? "speaking" : "idle";

  // Keep the latest message in view while the reply streams in.
  const lastLength = chat.messages.at(-1)?.content.length ?? 0;
  useLayoutEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [chat.messages.length, lastLength]);

  const submit = (text = draft) => {
    const content = text.trim();
    if (!content || busy || !canChat) return;
    setDraft("");
    void chat.send({ content, subjectId, topic: topic.trim() || null });
  };

  const earlier = useSave();
  const loadEarlier = () => {
    const first = chat.messages[0];
    if (!first || !chat.conversationId) return;
    const before = "createdAt" in first ? (first as unknown as StoredMessage).createdAt : null;
    if (!before) return;
    earlier.run(
      () => loadEarlierMessages(chat.conversationId, before),
      (data) => {
        chat.prepend(data.messages.map((m) => ({ ...m }) as ChatMessage & { createdAt: string }));
        setHasEarlier(data.hasEarlier);
      },
    );
  };

  const list = (
    <ConversationList
      conversations={conversations}
      activeId={chat.conversationId}
      subjects={subjects}
      onNavigate={() => setHistoryOpen(false)}
    />
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      {/* Conversation history — sidebar on desktop, sheet on phones */}
      <aside className="hidden lg:block">
        <div className="sticky top-10 flex max-h-[calc(100dvh-5rem)] flex-col">{list}</div>
      </aside>
      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} title="Your conversations">
        {list}
      </Dialog>

      <section aria-label="Tutor conversation" className="min-w-0">
        {/* Header */}
        <header className="surface relative isolate flex items-center gap-3 overflow-hidden rounded-stage px-4 py-3 sm:gap-4 sm:px-5">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_0%_50%,rgb(59_123_255/0.16),transparent_60%)]"
          />
          <TutorOrb state={orbState} size={44} label={`${tutor.name} is ${orbState === "idle" ? "ready" : orbState}`} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[1.0625rem] font-semibold tracking-tight">{tutor.name}</p>
            <p className="truncate text-[0.8125rem] text-fg-subtle">
              {chat.phase === "waiting"
                ? "Thinking…"
                : chat.phase === "streaming"
                  ? "Writing…"
                  : `${optionFor(PERSONALITIES, tutor.personality).label} · ${optionFor(TEACHING_STYLES, tutor.teachingStyle).label}`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setHistoryOpen(true)}
              icon={<History className="size-4" aria-hidden />}
              aria-label="Your conversations"
            />
            <ButtonLink
              href="/app/tutor"
              variant="ghost"
              size="sm"
              icon={<MessageSquarePlus className="size-4" aria-hidden />}
              aria-label="New conversation"
              className="lg:hidden"
            />
            <ButtonLink
              href="/app/tutor/settings"
              variant="ghost"
              size="sm"
              icon={<SlidersHorizontal className="size-4" aria-hidden />}
            >
              <span className="hidden sm:inline">Customise</span>
            </ButtonLink>
            {chat.conversationId && (
              <ConversationMenu onRename={() => setRenameOpen(true)} onDelete={() => setDeleteOpen(true)} />
            )}
          </div>
        </header>

        {!props.ready && (
          <div className="mt-4">
            <SetupNotice missing={props.missing} />
          </div>
        )}

        {title && (
          <h1 className="mt-5 truncate px-1 font-display text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        )}

        {/* Messages */}
        <div className="mt-4 min-h-[40dvh]">
          {hasEarlier && (
            <div className="mb-4 flex justify-center">
              <Button variant="ghost" size="sm" onClick={loadEarlier} loading={earlier.pending}>
                Show earlier messages
              </Button>
            </div>
          )}
          {chat.messages.length === 0 ? (
            <Welcome
              props={props}
              subject={subject}
              topic={topic}
              onPick={(q) => submit(q)}
              disabled={!canChat || busy}
            />
          ) : (
            <ol className="space-y-6" aria-live="polite" aria-busy={busy}>
              {chat.messages.map((m) => (
                <MessageRow key={m.id} message={m} tutorName={tutor.name} />
              ))}
            </ol>
          )}
          <div ref={endRef} />
        </div>

        {chat.error && <ErrorNotice error={chat.error} onDismiss={chat.dismissError} />}

        {/* Composer — floats above the phone tab bar (3.5rem + padding + safe area ≈ 4.625rem) */}
        {!props.ready ? null : props.consentRequired ? (
          <div className="mt-6">
            <ConsentNotice />
          </div>
        ) : (
          <div className="sticky bottom-[4.625rem] z-20 -mx-4 mt-4 bg-gradient-to-t from-ink-950 from-70% to-transparent px-4 pt-6 pb-3 sm:-mx-6 sm:px-6 md:bottom-0 md:mx-0 md:px-0 md:pb-6">
            <Composer
              ref={composerRef}
              draft={draft}
              setDraft={setDraft}
              onSubmit={() => submit()}
              onStop={chat.stop}
              busy={busy}
              subjects={subjects}
              subjectId={subjectId}
              setSubjectId={setSubjectId}
              topic={topic}
              setTopic={setTopic}
              remaining={remaining}
              tutorName={tutor.name}
            />
          </div>
        )}
      </section>

      {chat.conversationId && title && (
        <>
          <RenameDialog
            open={renameOpen}
            onClose={() => setRenameOpen(false)}
            conversationId={chat.conversationId}
            title={title}
            onRenamed={(t) => {
              setTitle(t);
              setConversations((l) => l.map((c) => (c.id === chat.conversationId ? { ...c, title: t } : c)));
            }}
          />
          <DeleteDialog
            open={deleteOpen}
            onClose={() => setDeleteOpen(false)}
            conversationId={chat.conversationId}
            title={title}
            onDeleted={() => router.push("/app/tutor")}
          />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function ConversationList({
  conversations,
  activeId,
  subjects,
  onNavigate,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  subjects: TutorSubject[];
  onNavigate: () => void;
}) {
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
  return (
    <nav aria-label="Conversation history" className="flex min-h-0 flex-col gap-3">
      <ButtonLink
        href="/app/tutor"
        variant="secondary"
        size="sm"
        icon={<MessageSquarePlus className="size-4" aria-hidden />}
        onClick={onNavigate}
        className="w-full"
      >
        New conversation
      </ButtonLink>
      {conversations.length === 0 ? (
        <p className="px-1 text-sm leading-relaxed text-fg-subtle">Your conversations are saved here.</p>
      ) : (
        <ul className="-mr-2 flex min-h-0 flex-col gap-0.5 overflow-y-auto pr-2">
          {conversations.map((c) => {
            const active = c.id === activeId;
            const subject = subjects.find((s) => s.id === c.subjectId);
            return (
              <li key={c.id}>
                <Link
                  href={`/app/tutor/c/${c.id}`}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block rounded-control px-3 py-2.5 transition-colors",
                    active ? "bg-white/[0.06] ring-1 ring-line-strong" : "hover:bg-white/[0.035]",
                  )}
                >
                  <span className={cn("block truncate text-sm", active ? "font-medium text-fg" : "text-fg-muted")}>
                    {c.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-fg-subtle">
                    {subject ? `${subject.name} · ` : ""}
                    {fmt.format(new Date(c.lastMessageAt))}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}

function ConversationMenu({ onRename, onDelete }: { onRename: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="sm"
        aria-label="Conversation options"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        icon={<MoreHorizontal className="size-4" aria-hidden />}
      />
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            role="menu"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="surface-raised absolute right-0 z-30 mt-1 w-44 rounded-panel p-1"
          >
            <button
              role="menuitem"
              type="button"
              onClick={() => (setOpen(false), onRename())}
              className="flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-left text-sm hover:bg-white/[0.06]"
            >
              <Pencil className="size-4 text-fg-subtle" aria-hidden /> Rename
            </button>
            <button
              role="menuitem"
              type="button"
              onClick={() => (setOpen(false), onDelete())}
              className="flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-left text-sm text-danger hover:bg-danger/10"
            >
              <Trash2 className="size-4" aria-hidden /> Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MessageRow({ message: m, tutorName }: { message: ChatMessage; tutorName: string }) {
  if (m.role === "user") {
    return (
      <li className="flex justify-end">
        <div className="max-w-[85%] rounded-[1.25rem] rounded-br-md bg-blue-500/[0.14] px-4 py-2.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-fg ring-1 ring-blue-400/20 ring-inset">
          <span className="sr-only">You: </span>
          {m.content}
        </div>
      </li>
    );
  }
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="mt-1 size-6 shrink-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#cfe0ff,#4d86ff_45%,#7a5cff_80%)] shadow-[0_0_14px_-2px_rgb(77_134_255/0.8)]"
      />
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[0.8125rem] font-medium text-fg-subtle">{tutorName}</p>
        {m.content ? (
          <TutorMarkdown content={m.content} />
        ) : (
          <span className="inline-flex items-center gap-1.5 py-2" role="status" aria-label={`${tutorName} is thinking`}>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="size-1.5 rounded-full bg-blue-400"
                animate={{ opacity: [0.25, 1, 0.25] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
              />
            ))}
          </span>
        )}
        {m.status === "interrupted" && <p className="mt-2 text-xs text-fg-subtle">Reply stopped before it finished.</p>}
      </div>
    </li>
  );
}

function Welcome({
  props,
  subject,
  topic,
  onPick,
  disabled,
}: {
  props: TutorWorkspaceProps;
  subject: TutorSubject | null;
  topic: string;
  onPick: (q: string) => void;
  disabled: boolean;
}) {
  const { tutor, firstName, subjects } = props;
  const questions = suggestedQuestions({
    subject: subject
      ? {
          name: subject.name,
          qualificationName: subject.qualificationName,
          nextExamDays: subject.nextExamDays,
          confidence: subject.confidence,
        }
      : null,
    topic: topic.trim() || null,
    firstSubjects: subjects,
  });
  const studying = subjects
    .slice(0, 3)
    .map((s) => `${s.qualificationName} ${s.name}${s.boardName ? ` (${s.boardName})` : ""}`);
  return (
    <div className="flex flex-col items-center px-2 py-6 text-center sm:py-10">
      <TutorOrb state="idle" size={96} label={tutor.name} />
      <h2 className="mt-6 font-display text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
        Hi{firstName ? ` ${firstName}` : ""} — I’m {tutor.name}.
      </h2>
      <p className="mt-3 max-w-lg text-[0.9375rem] leading-relaxed text-fg-muted">
        {studying.length
          ? `I know you’re studying ${studying.join(", ")}${subjects.length > 3 ? " and more" : ""}. Ask me anything — I’ll explain it at your level and check you’ve got it.`
          : "Ask me anything you’re studying — I’ll explain it at your level and check you’ve got it."}
      </p>
      {!props.tutorCustomised && (
        <p className="mt-2 text-sm text-fg-subtle">
          <Link href="/app/tutor/settings" className="text-blue-400 hover:text-blue-300">
            Choose how I teach
          </Link>{" "}
          — my name, personality, style and pace.
        </p>
      )}
      <ul className="mt-8 grid w-full max-w-2xl gap-2.5 sm:grid-cols-2" aria-label="Suggested questions">
        {questions.map((q) => (
          <li key={q}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(q)}
              className="h-full w-full rounded-panel border border-line bg-ink-900/40 px-4 py-3 text-left text-sm leading-snug text-fg-muted transition-colors hover:border-blue-400/40 hover:bg-blue-500/[0.06] hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const Composer = function Composer({
  ref,
  draft,
  setDraft,
  onSubmit,
  onStop,
  busy,
  subjects,
  subjectId,
  setSubjectId,
  topic,
  setTopic,
  remaining,
  tutorName,
}: {
  ref: React.RefObject<HTMLTextAreaElement | null>;
  draft: string;
  setDraft: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
  subjects: TutorSubject[];
  subjectId: string | null;
  setSubjectId: (v: string | null) => void;
  topic: string;
  setTopic: (v: string) => void;
  remaining: number;
  tutorName: string;
}) {
  const subjectLabel = useId();
  const topicLabel = useId();
  const counterId = useId();
  // Grow with the text, up to a limit.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [draft, ref]);
  const near = draft.length > MAX_USER_MESSAGE - 200;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="surface-raised rounded-stage p-2.5 shadow-[0_20px_50px_-20px_rgb(0_0_0/0.8)] backdrop-blur-xl"
    >
      <div className="flex flex-wrap items-center gap-2 px-1.5 pb-2">
        <label htmlFor={subjectLabel} className="sr-only">
          Subject
        </label>
        <select
          id={subjectLabel}
          value={subjectId ?? ""}
          onChange={(e) => setSubjectId(e.target.value || null)}
          className="h-8 max-w-[11rem] rounded-full border border-line-strong bg-ink-900/70 px-3 text-[0.8125rem] text-fg outline-none focus:border-blue-400/70"
        >
          <option value="">Any subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label htmlFor={topicLabel} className="sr-only">
          Topic (optional)
        </label>
        <input
          id={topicLabel}
          value={topic}
          onChange={(e) => setTopic(e.target.value.slice(0, MAX_TOPIC))}
          placeholder="Topic (optional)"
          className="h-8 min-w-[8rem] flex-1 rounded-full border border-line-strong bg-ink-900/70 px-3 text-[0.8125rem] text-fg outline-none placeholder:text-fg-subtle focus:border-blue-400/70 sm:max-w-[16rem]"
        />
        {remaining <= 20 && (
          <span className="basis-full text-right text-xs text-fg-subtle sm:ml-auto sm:basis-auto">
            {remaining} {remaining === 1 ? "message" : "messages"} left this month
          </span>
        )}
      </div>
      <div className="flex items-end gap-2">
        <label htmlFor="tutor-message" className="sr-only">
          Message {tutorName}
        </label>
        <textarea
          id="tutor-message"
          ref={ref}
          rows={1}
          value={draft}
          maxLength={MAX_USER_MESSAGE}
          aria-describedby={near ? counterId : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={`Ask ${tutorName} anything…`}
          className="max-h-[220px] min-h-11 flex-1 resize-none rounded-panel bg-transparent px-3 py-2.5 text-[0.9375rem] leading-relaxed text-fg outline-none placeholder:text-fg-subtle"
        />
        {busy ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onStop}
            aria-label="Stop the reply"
            className="size-11 shrink-0 rounded-full p-0"
          >
            <Square className="size-3.5 fill-current" aria-hidden />
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Send"
            className="size-11 shrink-0 rounded-full p-0"
          >
            <ArrowUp className="size-5" aria-hidden />
          </Button>
        )}
      </div>
      {near && (
        <p id={counterId} className="px-3 pt-1 text-right text-xs text-warning">
          {draft.length} / {MAX_USER_MESSAGE}
        </p>
      )}
    </form>
  );
};

function ErrorNotice({ error, onDismiss }: { error: ChatError; onDismiss: () => void }) {
  return (
    <div className="mt-6">
      <Notice tone="error">
        {error.message}{" "}
        {error.code === "unauthenticated" ? (
          <Link href="/sign-in?next=/app/tutor" className="font-medium text-blue-300 underline">
            Sign in
          </Link>
        ) : (
          <button type="button" onClick={onDismiss} className="font-medium text-blue-300 underline">
            Dismiss
          </button>
        )}
      </Notice>
    </div>
  );
}

export function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <div role="status" className="surface-raised rounded-stage p-5">
      <p className="flex items-center gap-2 font-medium">
        <PlugZap className="size-4 text-warning" aria-hidden />
        The tutor isn’t connected to an AI provider yet
      </p>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        No replies are faked — so until it’s connected, messages can’t be sent. Everything else in Lumio works normally.
        To switch it on, whoever runs this Lumio site needs to add these settings in Vercel (Project → Settings →
        Environment Variables) and redeploy:
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {missing.map((m) => (
          <li key={m}>
            <code className="rounded-md bg-white/[0.07] px-2 py-1 font-mono text-[0.8125rem] text-cyan-400">{m}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConsentNotice() {
  return (
    <div role="status" className="surface-raised rounded-stage p-5">
      <p className="flex items-center gap-2 font-medium">
        <ShieldCheck className="size-4 text-warning" aria-hidden />A parent or carer needs to link first
      </p>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        Because you’re under 13, your tutor starts once a parent or carer has linked their Lumio account to yours.
      </p>
      <ButtonLink href="/app/settings#family" variant="secondary" size="sm" className="mt-3">
        How linking works
      </ButtonLink>
    </div>
  );
}

function RenameDialog({
  open,
  onClose,
  conversationId,
  title,
  onRenamed,
}: {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  title: string;
  onRenamed: (t: string) => void;
}) {
  const [value, setValue] = useState(title);
  const save = useSave();
  return (
    <Dialog open={open} onClose={onClose} title="Rename conversation">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.run(
            () => renameConversation({ conversationId, title: value }),
            () => {
              onRenamed(value.trim());
              onClose();
            },
          );
        }}
      >
        <TextField
          label="Title"
          value={value}
          maxLength={80}
          onChange={(e) => setValue(e.target.value)}
          error={save.error?.fieldErrors?.title}
        />
        <SaveError error={save.error?.fieldErrors ? null : save.error} onRetry={save.retry} returnTo="/app/tutor" />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.pending}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function DeleteDialog({
  open,
  onClose,
  conversationId,
  title,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  title: string;
  onDeleted: () => void;
}) {
  const save = useSave();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Delete this conversation?"
      description={`“${title}” and all its messages will be permanently deleted. This can’t be undone.`}
    >
      <SaveError error={save.error} onRetry={save.retry} returnTo="/app/tutor" />
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Keep it
        </Button>
        <Button
          variant="danger"
          loading={save.pending}
          onClick={() => save.run(() => deleteConversation(conversationId), onDeleted)}
        >
          Delete
        </Button>
      </div>
    </Dialog>
  );
}
