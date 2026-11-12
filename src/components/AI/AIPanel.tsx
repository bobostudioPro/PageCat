import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft,
  ArrowUp,
  AtSign,
  BookOpen,
  Bot,
  Copy,
  Cpu,
  FileText,
  Highlighter,
  History,
  Loader2,
  NotebookPen,
  Plus,
  Settings2,
  Sparkles,
  Square,
  SquarePen,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { AiReference, Annotation, Book, Note, OutlineItem } from '../../types';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useChat } from '../../state/chat';
import { useSettings } from '../../state/settings';
import { buildMessages, streamChat } from '../../lib/ai/provider';
import { localAnswer } from '../../lib/ai/local';
import { getPageParagraphs, getPageText, type PageParagraph } from '../../lib/pdf';
import { looksLikeKnowledgeQuestion, lookupWikipedia } from '../../lib/ai/wiki';
import type { AiContext } from '../../lib/ai/types';
import { useToast } from '../../state/toast';
import { clamp, formatDate, uid } from '../../lib/utils';

export type ExternalReference = {
  kind: 'selection' | 'highlight' | 'note';
  page: number;
  text: string;
  refId?: string;
  quote?: string;
  nonce: number;
};

type RefDraft =
  | { type: 'page'; page: number }
  | { type: 'book' }
  | { type: 'highlight'; refId: string; page: number; text: string }
  | { type: 'note'; refId: string; page: number; text: string; quote?: string }
  | { type: 'paragraph'; page: number; text: string; index: number }
  | { type: 'selection'; page: number; text: string };

type Props = {
  book: Book;
  doc: PDFDocumentProxy;
  page: number;
  pageCount: number;
  annotations: Annotation[];
  notes: Note[];
  toc: OutlineItem[];
  externalReference?: ExternalReference | null;
  onConsumeExternal?: () => void;
  onJump: (page: number) => void;
  onOpenSettings: () => void;
};

function referenceKey(ref: RefDraft): string {
  if (ref.type === 'book') return 'book';
  if (ref.type === 'page') return `page:${ref.page}`;
  if (ref.type === 'highlight') return `highlight:${ref.refId}`;
  if (ref.type === 'note') return `note:${ref.refId}`;
  if (ref.type === 'paragraph') return `paragraph:${ref.page}:${ref.index}`;
  return `selection:${ref.page}:${ref.text.slice(0, 24)}`;
}

function refLabel(ref: AiReference) {
  if (ref.type === 'book') return '整本书';
  if (ref.type === 'page') return `第 ${ref.page} 页`;
  if (ref.type === 'highlight') return `划线 · 第 ${ref.page} 页`;
  if (ref.type === 'note') return `笔记 · 第 ${ref.page} 页`;
  if (ref.type === 'paragraph') return `段落 ${ref.index + 1} · 第 ${ref.page} 页`;
  return `选中原文 · 第 ${ref.page} 页`;
}

function RefIcon({ type }: { type: AiReference['type'] }) {
  const props = { size: 11 } as const;
  if (type === 'highlight') return <Highlighter {...props} />;
  if (type === 'note') return <NotebookPen {...props} />;
  if (type === 'paragraph') return <FileText {...props} />;
  if (type === 'book') return <BookOpen {...props} />;
  if (type === 'page') return <BookOpen {...props} />;
  return <Sparkles {...props} />;
}

function promptFor(kind: ExternalReference['kind']) {
  if (kind === 'highlight') return '请围绕我引用的这条划线继续分析。';
  if (kind === 'note') return '请结合我引用的这条笔记和原文继续分析。';
  return '请分析这段文字：它的含义、结构和写作手法，并联系这一页的上下文。';
}

export function AIPanel({
  book,
  doc,
  page,
  pageCount,
  annotations,
  notes,
  toc,
  externalReference,
  onConsumeExternal,
  onJump,
  onOpenSettings,
}: Props) {
  const chat = useChat();
  const settings = useSettings();
  const push = useToast((s) => s.push);

  const sessions = chat.byBook[book.id] ?? [];
  const activeId = chat.activeByBook[book.id];
  const session = sessions.find((s) => s.id === activeId) ?? sessions[0];
  const messages = session?.messages ?? [];

  const [scope, setScope] = useState<'page' | 'book'>('page');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refPickerOpen, setRefPickerOpen] = useState(false);
  const [refs, setRefs] = useState<AiReference[]>([]);
  const [pageRefInput, setPageRefInput] = useState('');
  const [paragraphs, setParagraphs] = useState<PageParagraph[]>([]);
  const [paragraphsLoading, setParagraphsLoading] = useState(false);
  const [paragraphsError, setParagraphsError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageCache = useRef(new Map<number, string>());
  const digestCache = useRef<{ page: number; text: string }[] | null>(null);
  const paragraphCache = useRef(new Map<number, PageParagraph[]>());
  const lastExternal = useRef(0);

  const online = Boolean(settings.aiApiKey.trim());
  const modeLabel = online ? settings.aiModel || '在线模型' : '本地速读';
  const ready = Boolean(session);

  useEffect(() => {
    if (!chat.byBook[book.id]) void chat.load(book.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  useEffect(() => {
    if (!externalReference || externalReference.nonce === lastExternal.current) return;
    lastExternal.current = externalReference.nonce;
    const base: RefDraft =
      externalReference.kind === 'selection'
        ? ({ type: 'selection', page: externalReference.page, text: externalReference.text } as const)
        : externalReference.kind === 'highlight'
          ? ({
              type: 'highlight',
              page: externalReference.page,
              text: externalReference.text,
              refId: externalReference.refId ?? uid('hlref'),
            } as const)
          : ({
              type: 'note',
              page: externalReference.page,
              text: externalReference.text,
              refId: externalReference.refId ?? uid('noteref'),
              quote: externalReference.quote,
            } as const);
    const ref = { key: referenceKey(base), ...base } as AiReference;
    setRefs((current) => (current.some((r) => r.key === ref.key) ? current : [...current, ref]));
    setInput(promptFor(externalReference.kind));
    setRefPickerOpen(false);
    onConsumeExternal?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalReference]);

  useEffect(() => {
    if (!refPickerOpen) return;
    const load = async () => {
      const cached = paragraphCache.current.get(page);
      if (cached) {
        setParagraphs(cached);
        return;
      }
      setParagraphsLoading(true);
      setParagraphsError(null);
      try {
        const result = await getPageParagraphs(doc, page);
        paragraphCache.current.set(page, result);
        setParagraphs(result);
      } catch {
        setParagraphsError('这一页的段落暂时提取失败');
      } finally {
        setParagraphsLoading(false);
      }
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refPickerOpen, page, doc]);

  useEffect(() => {
    if (!refPickerOpen) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.ai-ref-picker, .ai-at-btn, .ai-ref-chip, .ai-ref-analyze')) return;
      setRefPickerOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [refPickerOpen]);

  useEffect(() => {
    if (!messages.length) return;
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 220;
    if (nearBottom || sending) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, messages[messages.length - 1]?.content, sending]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const getText = async (n: number) => {
    if (pageCache.current.has(n)) return pageCache.current.get(n)!;
    try {
      const text = await getPageText(doc, n);
      pageCache.current.set(n, text);
      return text;
    } catch {
      return '';
    }
  };

  const buildBookDigest = async () => {
    if (digestCache.current) return digestCache.current;
    const picks = new Set<number>([1, 2, 3, page]);
    toc.slice(0, 10).forEach((item) => picks.add(item.page));
    refs.forEach((ref) => {
      if (ref.type === 'page') picks.add(ref.page);
    });
    const step = Math.max(1, Math.floor(pageCount / 10));
    for (let p = 1; p <= pageCount; p += step) picks.add(p);
    const ordered = [...picks].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b).slice(0, 16);
    const out: { page: number; text: string }[] = [];
    let chars = 0;
    for (const p of ordered) {
      const text = await getText(p);
      if (!text) continue;
      if (chars > 13000) break;
      out.push({ page: p, text });
      chars += text.length;
    }
    digestCache.current = out;
    return out;
  };

  const buildContext = async (nextScope: 'page' | 'book', currentRefs: AiReference[]): Promise<AiContext> => {
    const currentPageText = await getText(page);
    const pages = new Set<number>([page]);
    if (nextScope === 'page') {
      for (const p of [page - 1, page, page + 1]) {
        if (p >= 1 && p <= pageCount) pages.add(p);
      }
    }
    currentRefs.forEach((ref) => {
      if (ref.type === 'page') pages.add(clamp(ref.page, 1, pageCount));
    });
    const contextPages: { page: number; text: string }[] = [];
    for (const p of [...pages].sort((a, b) => a - b).slice(0, 8)) {
      const text = await getText(p);
      if (text) contextPages.push({ page: p, text });
    }
    const wantsBook = nextScope === 'book' || currentRefs.some((ref) => ref.type === 'book');
    const digest = wantsBook ? await buildBookDigest() : [];
    const selection =
      currentRefs.find((r) => r.type === 'selection')?.text ??
      currentRefs.find((r) => r.type === 'paragraph')?.text ??
      currentRefs.find((r) => r.type === 'highlight')?.text ??
      currentRefs.find((r) => r.type === 'note')?.text;
    return {
      book,
      page,
      pageCount,
      currentPageText,
      contextPages,
      digest,
      selection,
      annotations,
      notes,
      toc,
      scope: wantsBook ? 'book' : 'page',
      references: currentRefs,
    };
  };

  const send = async (questionOverride?: string, scopeOverride?: 'page' | 'book') => {
    if (!ready) return;
    const question = (questionOverride ?? input).trim();
    if (!question || sending) return;
    const nextScope = scopeOverride ?? scope;
    const currentRefs = [...refs];
    setScope(nextScope);
    setInput('');
    setSending(true);
    setTyping(true);
    const history = (session?.messages ?? [])
      .filter((m) => !m.error && m.content)
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content })) as { role: 'user' | 'assistant'; content: string }[];
    chat.append(book.id, {
      role: 'user',
      content: question,
      mode: online ? 'online' : 'local',
      references: currentRefs,
    });
    const assistant = chat.append(book.id, {
      role: 'assistant',
      content: '',
      mode: online ? 'online' : 'local',
    });
    setRefs([]);
    setRefPickerOpen(false);
    try {
      const context = await buildContext(nextScope, currentRefs);
      if (!online) {
        const local = localAnswer(question, context);
        let content = local;
        if (looksLikeKnowledgeQuestion(question)) {
          const card = await lookupWikipedia(question).catch(() => null);
          if (card) {
            content = `**书外知识卡 · ${card.title}**\n\n${card.extract}\n\n> 来源：[维基百科](${card.url})。这是书外资料，不是书中原文；需要的话，我也可以回到书里找相关线索。`;
          } else {
            content += '\n\n> 这次没有查到可靠的百科条目。可以换一个更短的关键词，或在设置里接入大模型。';
          }
        }
        chat.update(book.id, assistant.id, { content });
      } else {
        const controller = new AbortController();
        abortRef.current = controller;
        const streamMessages = buildMessages(context, history, question);
        let full = '';
        await streamChat(
          {
            baseUrl: settings.aiBaseUrl,
            apiKey: settings.aiApiKey,
            model: settings.aiModel,
            temperature: settings.aiTemperature,
          },
          streamMessages,
          {
            signal: controller.signal,
            onDelta: (delta) => {
              full += delta;
              chat.update(book.id, assistant.id, { content: full });
            },
          },
        );
        if (!full.trim()) {
          chat.update(book.id, assistant.id, {
            content: '模型没有返回内容。可以换个问法，或在设置里检查接口与模型名称。',
            error: true,
          });
        }
      }
    } catch (err) {
      const e = err as Error;
      const aborted = e.name === 'AbortError';
      const current =
        useChat.getState().byBook[book.id]
          ?.find((s) => s.id === chat.activeByBook[book.id])
          ?.messages.find((m) => m.id === assistant.id)?.content ?? '';
      chat.update(book.id, assistant.id, {
        content: aborted
          ? `${current}\n\n*（已停止生成）*`
          : `${current ? `${current}\n\n` : ''}**没有连上 AI 接口。**\n\n${e.message}\n\n可以检查「书房设置」里的接口地址、模型与 Key，或者先改用本地速读。`,
        error: !aborted,
      });
    } finally {
      abortRef.current = null;
      setTyping(false);
      setSending(false);
      await chat.persist(book.id);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
  };

  const startNew = async () => {
    if (sending || !ready) return;
    if (session && session.messages.length === 0) {
      setHistoryOpen(false);
      setRefs([]);
      setInput('');
      return;
    }
    await chat.create(book.id);
    setHistoryOpen(false);
    setRefs([]);
    setInput('');
    setRefPickerOpen(false);
  };

  const selectSession = (id: string) => {
    if (sending) return;
    chat.select(book.id, id);
    setHistoryOpen(false);
    setRefs([]);
    setInput('');
    setRefPickerOpen(false);
  };

  const removeSession = async (id: string) => {
    if (sending) return;
    await chat.remove(book.id, id);
    setDeletingId(null);
    setRefs([]);
    setInput('');
  };

  const addRef = (ref: AiReference) => {
    setRefs((current) => (current.some((r) => r.key === ref.key) ? current : [...current, ref]));
  };

  const removeRef = (key: string) => setRefs((current) => current.filter((ref) => ref.key !== key));

  const toggleRef = (ref: AiReference) => {
    if (refs.some((r) => r.key === ref.key)) {
      removeRef(ref.key);
    } else {
      addRef(ref);
      if (ref.type === 'book') setScope('book');
    }
  };

  const addPageRef = () => {
    const n = Number(pageRefInput);
    if (!Number.isFinite(n) || n < 1 || n > pageCount) {
      push(`请输入 1–${pageCount} 之间的页码`, 'error');
      return;
    }
    addRef({ key: `page:${Math.round(n)}`, type: 'page', page: Math.round(n) });
    setPageRefInput('');
  };

  const suggestions = useMemo(() => {
    const base = [
      { label: '总结这一页', question: '请总结这一页的内容，提炼 3 个要点，并引用原文。' },
      {
        label: '这本书在讲什么',
        question: '这本书在讲什么？用一段话概括它的核心主题，并指出你在抽样页面里看到的线索。',
        scope: 'book' as const,
      },
      { label: '生成思考题', question: '根据这一页的内容，生成 3 个值得停下来想一想的思考题。' },
      { label: '查一个知识点', question: '什么是文艺复兴？', prefill: true },
    ];
    if (refs.length) {
      base.unshift({ label: '分析引用的内容', question: '请分析我引用的这些内容，并联系上下文。' });
    }
    return base;
  }, [refs.length]);

  const handleSuggestion = (item: { question: string; scope?: 'book'; prefill?: boolean }) => {
    if (item.prefill) {
      setInput(item.question);
      setRefPickerOpen(false);
      window.setTimeout(() => composerRef.current?.focus(), 30);
      return;
    }
    void send(item.question, item.scope);
  };

  const copy = async (content: string) => {
    await navigator.clipboard.writeText(content);
    push('已复制回答', 'success');
  };

  const renderMarkdown = (content: string) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => {
          if (href?.startsWith('#page-')) {
            const target = Number(href.replace('#page-', ''));
            return (
              <button className="citation" onClick={() => onJump(target)}>
                {children}
              </button>
            );
          }
          return (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          );
        },
      }}
    >
      {content
        .replace(/\[第\s*(\d+)\s*页\](?!\()/g, '[第 $1 页](#page-$1)')
        .replace(/【第\s*(\d+)\s*页】/g, '[第 $1 页](#page-$1)')}
    </ReactMarkdown>
  );

  return (
    <div className="ai-panel">
      <div className="ai-head">
        <div className="ai-identity">
          <span className="ai-avatar">
            <Bot size={16} />
          </span>
          <div className="ai-identity-copy">
            <div className="ai-identity-title">
              <strong>AI 阅读助手</strong>
            </div>
            <div className="ai-meta-line">
              <button className="ai-mode" onClick={onOpenSettings} title="打开设置">
                {online ? <span className="online-dot" /> : <Cpu size={10} />}
                {modeLabel}
                <Settings2 size={10} />
              </button>
              <span className="ai-session-sep">·</span>
              <span className="ai-session-title" title={session?.title}>
                {session?.title ?? '新的对话'}
              </span>
            </div>
          </div>
        </div>
        <div className="ai-head-actions">
          <span className="ai-session-count" title="历史会话数量">{sessions.length}</span>
          <button className={`ai-icon ${historyOpen ? 'active' : ''}`} onClick={() => setHistoryOpen((v) => !v)} title="历史会话" disabled={sending || !ready}>
            <History size={15} />
          </button>
          <button className="ai-icon" onClick={() => void startNew()} title="新会话" disabled={sending || !ready}>
            <SquarePen size={15} />
          </button>
        </div>
      </div>

      {historyOpen ? (
        <div className="ai-history">
          <div className="ai-history-head">
            <button className="ai-history-back" onClick={() => setHistoryOpen(false)}>
              <ArrowLeft size={13} /> 返回对话
            </button>
            <span>{sessions.length} 个会话</span>
          </div>
          <div className="ai-history-list">
            {sessions.map((s) => {
              const last = [...s.messages].reverse().find((m) => m.content);
              return (
                <div key={s.id} className={`ai-history-item ${s.id === session?.id ? 'active' : ''}`}>
                  <button className="ai-history-main" onClick={() => selectSession(s.id)} disabled={sending}>
                    <span className="hist-title">{s.title}</span>
                    <span className="hist-meta">
                      {formatDate(s.updatedAt)} · {s.messages.length} 条
                    </span>
                    <span className="hist-preview">
                      {last?.content
                        ? last.content.replace(/[#*_>`~]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90)
                        : '空白会话'}
                    </span>
                  </button>
                  {deletingId === s.id ? (
                    <span className="hist-confirm">
                      <button onClick={() => void removeSession(s.id)}>删除</button>
                      <button onClick={() => setDeletingId(null)}>取消</button>
                    </span>
                  ) : (
                    <button className="ai-icon hist-del" onClick={() => setDeletingId(s.id)} aria-label="删除会话">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="ai-history-foot">
            <button className="btn btn-brass" onClick={() => void startNew()} disabled={sending || !ready}>
              <Plus size={14} /> 新会话
            </button>
            <span>每个会话独立保存，随时可以回来继续。</span>
          </div>
        </div>
      ) : (
        <>
          <div className="ai-scroll" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="ai-welcome">
                <span className="ai-welcome-mark">
                  <Sparkles size={20} />
                </span>
                <h3>和这本书聊一聊</h3>
                <p>
                  {online
                    ? '我会结合当前页、引用、划线和笔记回答。'
                    : '本地速读：摘要、找原文、思考题；接入 API Key 后可对话。'}
                </p>
                <div className="ai-suggestions">
                  {suggestions.map((item) => (
                    <button key={item.label} onClick={() => handleSuggestion(item)}>
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="ai-context-note">
                  <BookOpen size={12} /> 第 {page} / {pageCount} 页 · 已带入 {annotations.length} 条划线 · {notes.length} 篇笔记
                </div>
                <div className="ai-context-note ai-at-hint">
                  <AtSign size={12} /> 按 @ 或点「引用上下文」可带入页码、整本书、划线、笔记或段落
                </div>
              </div>
            ) : (
              <div className="ai-messages">
                {messages.map((message) => (
                  <div key={message.id} className={`ai-msg ${message.role} ${message.error ? 'error' : ''}`}>
                    <span className="ai-msg-avatar">
                      {message.role === 'user' ? <User size={13} /> : <Bot size={13} />}
                    </span>
                    <div className="ai-msg-body">
                      {message.role === 'user' && message.references?.length ? (
                        <div className="ai-msg-refs">
                          {message.references.map((ref) => (
                            <span key={ref.key} className="ai-msg-ref">
                              <RefIcon type={ref.type} /> {refLabel(ref)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {message.role === 'assistant' ? (
                        <div className="ai-markdown">
                          {renderMarkdown(message.content)}
                          {message.content === '' && typing && (
                            <span className="typing-dots">
                              <i />
                              <i />
                              <i />
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="ai-user-text">{message.content}</p>
                      )}
                      {message.role === 'assistant' && message.content && (
                        <div className="ai-msg-foot">
                          <span>{message.mode === 'online' ? '在线模型' : '本地速读'}</span>
                          <button onClick={() => void copy(message.content)} title="复制回答">
                            <Copy size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>

          <div className="ai-composer">
            {refPickerOpen && (
              <div className="ai-ref-picker">
                <div className="ai-ref-picker-head">
                  <span>
                    <AtSign size={12} /> 引用上下文
                  </span>
                  <button onClick={() => setRefPickerOpen(false)} aria-label="关闭引用菜单">
                    <X size={13} />
                  </button>
                </div>
                <div className="ref-section">
                  <div className="ref-section-title">阅读位置</div>
                  <div className="ref-row">
                    <button
                      className={`ref-option ${refs.some((r) => r.type === 'page' && r.page === page) ? 'active' : ''}`}
                      onClick={() => toggleRef({ key: `page:${page}`, type: 'page', page })}
                    >
                      <BookOpen size={12} /> 当前页 · 第 {page} 页
                    </button>
                    <button
                      className={`ref-option ${refs.some((r) => r.type === 'book') ? 'active' : ''}`}
                      onClick={() => toggleRef({ key: 'book', type: 'book' })}
                    >
                      <BookOpen size={12} /> 整本书
                    </button>
                  </div>
                  <div className="ref-page-input">
                    <input
                      value={pageRefInput}
                      onChange={(e) => setPageRefInput(e.target.value.replace(/[^\d]/g, ''))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addPageRef();
                      }}
                      placeholder="引用某一页，输入页码"
                      inputMode="numeric"
                      aria-label="页码"
                    />
                    <button onClick={addPageRef}>引用</button>
                  </div>
                </div>

                <div className="ref-section">
                  <div className="ref-section-title">
                    本页段落 <span>点一段引入分析</span>
                  </div>
                  {paragraphsLoading ? (
                    <div className="ref-empty"><Loader2 size={12} className="spin" /> 正在拆段落…</div>
                  ) : paragraphsError ? (
                    <div className="ref-empty">{paragraphsError}</div>
                  ) : paragraphs.length === 0 ? (
                    <div className="ref-empty">这一页没有可提取的段落，试试直接选中文字。</div>
                  ) : (
                    paragraphs.map((p) => {
                      const ref: AiReference = {
                        key: `paragraph:${page}:${p.index}`,
                        type: 'paragraph',
                        page,
                        text: p.text,
                        index: p.index,
                      };
                      return (
                        <button
                          key={p.index}
                          className={`ref-paragraph ${refs.some((r) => r.key === ref.key) ? 'active' : ''}`}
                          onClick={() => toggleRef(ref)}
                        >
                          <span className="rp-index">第 {p.index + 1} 段</span>
                          <span className="rp-text">{p.text.slice(0, 100)}{p.text.length > 100 ? '…' : ''}</span>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="ref-section">
                  <div className="ref-section-title">
                    我的划线 <span>{annotations.length}</span>
                  </div>
                  {annotations.length === 0 ? (
                    <div className="ref-empty">还没有划线。</div>
                  ) : (
                    annotations.slice(0, 8).map((annotation) => {
                      const ref: AiReference = {
                        key: `highlight:${annotation.id}`,
                        type: 'highlight',
                        refId: annotation.id,
                        page: annotation.page,
                        text: annotation.text,
                      };
                      return (
                        <button
                          key={annotation.id}
                          className={`ref-option ref-option-wide ${refs.some((r) => r.key === ref.key) ? 'active' : ''}`}
                          onClick={() => toggleRef(ref)}
                        >
                          <Highlighter size={12} />
                          <span className="ref-opt-label">第 {annotation.page} 页 · {annotation.text.slice(0, 70)}</span>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="ref-section">
                  <div className="ref-section-title">
                    我的笔记 <span>{notes.length}</span>
                  </div>
                  {notes.length === 0 ? (
                    <div className="ref-empty">还没有笔记。</div>
                  ) : (
                    notes.slice(0, 8).map((note) => {
                      const ref: AiReference = {
                        key: `note:${note.id}`,
                        type: 'note',
                        refId: note.id,
                        page: note.page,
                        text: note.text,
                        quote: note.quote,
                      };
                      return (
                        <button
                          key={note.id}
                          className={`ref-option ref-option-wide ${refs.some((r) => r.key === ref.key) ? 'active' : ''}`}
                          onClick={() => toggleRef(ref)}
                        >
                          <NotebookPen size={12} />
                          <span className="ref-opt-label">第 {note.page} 页 · {note.text.slice(0, 70)}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {refs.length > 0 && (
              <div className="ai-ref-chips">
                {refs.map((ref) => (
                  <span key={ref.key} className="ai-ref-chip">
                    <RefIcon type={ref.type} />
                    {refLabel(ref)}
                    <button onClick={() => removeRef(ref.key)} aria-label="移除引用">
                      <X size={10} />
                    </button>
                  </span>
                ))}
                <button className="ai-ref-analyze" onClick={() => void send('请分析我引用的这些内容，并联系上下文。')} disabled={sending}>
                  分析引用
                </button>
              </div>
            )}

            <div className="ai-scope">
              <button className={scope === 'page' ? 'active' : ''} onClick={() => setScope('page')}>
                当前页
              </button>
              <button className={scope === 'book' ? 'active' : ''} onClick={() => setScope('book')}>
                <BookOpen size={10} /> 全书速览
              </button>
              <span className="ai-scope-hint">{scope === 'page' ? `第 ${page} 页及相邻页` : '抽样阅读全书页面'}</span>
            </div>
            <div className="ai-input-row">
              <button
                className={`ai-at-btn ${refPickerOpen ? 'active' : ''}`}
                onClick={() => setRefPickerOpen((v) => !v)}
                title="引用页码、整本书、划线、笔记或段落"
                aria-label="引用上下文"
                disabled={!ready}
              >
                <AtSign size={16} />
              </button>
              <textarea
                ref={composerRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={online ? '问这本书，或按 @ 引用页码、划线…' : '问这一页，或按 @ 引用内容…'}
                rows={1}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(132, el.scrollHeight)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === '@') {
                    e.preventDefault();
                    setRefPickerOpen(true);
                  } else if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              {sending ? (
                <button className="ai-send stop" onClick={stop} title="停止生成">
                  <Square size={13} />
                </button>
              ) : (
                <button className="ai-send" onClick={() => void send()} disabled={!input.trim() || !ready} title="发送">
                  <ArrowUp size={16} />
                </button>
              )}
            </div>
            <div className="ai-disclaimer">
              {online ? (
                <span>
                  回答由 <button onClick={onOpenSettings}>{modeLabel}</button> 生成，可能有误，请回原文核对。
                </span>
              ) : null}
              <span className="ai-keys">Enter 发送 · Shift + Enter 换行</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
