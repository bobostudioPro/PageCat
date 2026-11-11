import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowUp,
  BookOpen,
  Bot,
  Copy,
  Cpu,
  Loader2,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { Annotation, Book, Note, OutlineItem } from '../../types';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useChat } from '../../state/chat';
import { useSettings } from '../../state/settings';
import { buildMessages, streamChat } from '../../lib/ai/provider';
import { localAnswer } from '../../lib/ai/local';
import { getPageText } from '../../lib/pdf';
import type { AiContext } from '../../lib/ai/types';
import { useToast } from '../../state/toast';
import { clamp } from '../../lib/utils';

type Props = {
  book: Book;
  doc: PDFDocumentProxy;
  page: number;
  pageCount: number;
  annotations: Annotation[];
  notes: Note[];
  toc: OutlineItem[];
  selection?: string;
  onClearSelection: () => void;
  onJump: (page: number) => void;
  onOpenSettings: () => void;
};

export function AIPanel({
  book,
  doc,
  page,
  pageCount,
  annotations,
  notes,
  toc,
  selection,
  onClearSelection,
  onJump,
  onOpenSettings,
}: Props) {
  const chat = useChat();
  const settings = useSettings();
  const push = useToast((s) => s.push);
  const messages = chat.byBook[book.id]?.messages ?? [];
  const [scope, setScope] = useState<'page' | 'book'>('page');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageCache = useRef(new Map<number, string>());
  const digestCache = useRef<{ page: number; text: string }[] | null>(null);
  const lastSelection = useRef<string | undefined>(undefined);

  const online = Boolean(settings.aiApiKey.trim());
  const modeLabel = online ? settings.aiModel || '在线模型' : '本地速读';

  useEffect(() => {
    if (!chat.byBook[book.id]) void chat.load(book.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id]);

  useEffect(() => {
    if (selection && selection !== lastSelection.current) {
      lastSelection.current = selection;
      setInput('解释这段文字，并联系这一页的上下文。');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

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

  const buildContext = async (nextScope: 'page' | 'book' = scope): Promise<AiContext> => {
    const currentPageText = await getText(page);
    const contextPages: { page: number; text: string }[] = [];
    if (nextScope === 'page') {
      for (const p of [page - 1, page, page + 1]) {
        if (p < 1 || p > pageCount) continue;
        const text = await getText(p);
        if (text) contextPages.push({ page: p, text });
      }
    } else {
      contextPages.push({ page, text: currentPageText });
    }
    const digest = nextScope === 'book' ? await buildBookDigest() : [];
    return {
      book,
      page,
      pageCount,
      currentPageText,
      contextPages,
      digest,
      selection: selection?.trim() || undefined,
      annotations,
      notes,
      toc,
      scope: nextScope,
    };
  };

  const send = async (questionOverride?: string, scopeOverride?: 'page' | 'book') => {
    const question = (questionOverride ?? input).trim();
    if (!question || sending) return;
    const nextScope = scopeOverride ?? scope;
    setScope(nextScope);
    setInput('');
    setConfirmClear(false);
    setSending(true);
    setTyping(true);
    const history = (chat.byBook[book.id]?.messages ?? [])
      .filter((m) => !m.error && m.content)
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content })) as { role: 'user' | 'assistant'; content: string }[];
    chat.append(book.id, { role: 'user', content: question, mode: online ? 'online' : 'local' });
    const assistant = chat.append(book.id, {
      role: 'assistant',
      content: '',
      mode: online ? 'online' : 'local',
    });
    onClearSelection();
    try {
      const context = await buildContext(nextScope);
      if (!online) {
        await new Promise((resolve) => window.setTimeout(resolve, 420));
        const answer = localAnswer(question, context);
        chat.update(book.id, assistant.id, { content: answer });
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
      const current = useChat.getState().byBook[book.id]?.messages.find((m) => m.id === assistant.id)?.content ?? '';
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

  const suggestions = useMemo(() => {
    const base = [
      { label: '总结这一页', question: '请总结这一页的内容，提炼 3 个要点，并引用原文。' },
      { label: '这本书在讲什么', question: '这本书在讲什么？用一段话概括它的核心主题，并指出你在抽样页面里看到的线索。', scope: 'book' as const },
      { label: '生成思考题', question: '根据这一页的内容，生成 3 个值得停下来想一想的思考题。' },
      { label: '找一句值得划线的句子', question: '在这一页里找一句最值得划线的句子，并解释为什么。' },
    ];
    if (selection) {
      base.unshift({ label: '解释选中内容', question: '解释我选中的这段文字，并联系这一页的上下文。' });
    }
    return base;
  }, [selection]);

  const handleSuggestion = (item: { question: string; scope?: 'book' }) => {
    void send(item.question, item.scope);
  };

  const copy = async (content: string) => {
    await navigator.clipboard.writeText(content);
    push('已复制回答', 'success');
  };

  return (
    <div className="ai-panel">
      <div className="ai-head">
        <div className="ai-identity">
          <span className="ai-avatar">
            <Bot size={16} />
          </span>
          <div>
            <strong>AI 阅读助手</strong>
            <button className="ai-mode" onClick={onOpenSettings} title="打开设置">
              {online ? <span className="online-dot" /> : <Cpu size={10} />}
              {modeLabel}
              <Settings2 size={10} />
            </button>
          </div>
        </div>
        <div className="ai-head-actions">
          {messages.length > 0 &&
            (confirmClear ? (
              <span className="clear-chat-confirm">
                <button
                  onClick={() => {
                    void chat.clear(book.id);
                    setConfirmClear(false);
                    pageCache.current.clear();
                    digestCache.current = null;
                  }}
                >
                  清空
                </button>
                <button onClick={() => setConfirmClear(false)}>取消</button>
              </span>
            ) : (
              <button className="ai-icon" onClick={() => setConfirmClear(true)} title="清空对话">
                <Trash2 size={14} />
              </button>
            ))}
        </div>
      </div>

      <div className="ai-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="ai-welcome">
            <span className="ai-welcome-mark">
              <Sparkles size={20} />
            </span>
            <h3>和这本书聊一聊</h3>
            <p>
              {online
                ? '我会读当前页、相邻页、目录，以及你的划线和笔记。引用原文时会标出页码。'
                : '现在用的是本地速读：抽取摘要、找关键词、搜索原文、生成思考题。填入 API Key 后可以进行真正的 AI 对话。'}
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
          </div>
        ) : (
          <div className="ai-messages">
            {messages.map((message) => (
              <div key={message.id} className={`ai-msg ${message.role} ${message.error ? 'error' : ''}`}>
                <span className="ai-msg-avatar">
                  {message.role === 'user' ? <User size={13} /> : <Bot size={13} />}
                </span>
                <div className="ai-msg-body">
                  {message.role === 'assistant' ? (
                    <div className="ai-markdown">
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
                        {message.content.replace(/\[第\s*(\d+)\s*页\](?!\()/g, '[第 $1 页](#page-$1)').replace(/【第\s*(\d+)\s*页】/g, '[第 $1 页](#page-$1)')}
                      </ReactMarkdown>
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
        {selection && (
          <div className="ai-selection-chip">
            <Sparkles size={11} />
            <span>已带入选中文字：{selection.slice(0, 46)}{selection.length > 46 ? '…' : ''}</span>
            <button onClick={onClearSelection} aria-label="移除选中文字">
              <X size={11} />
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
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={online ? '问这本书一个问题…' : '问这一页一个问题，或直接选总结…'}
            rows={1}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(132, el.scrollHeight)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
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
            <button className="ai-send" onClick={() => void send()} disabled={!input.trim()} title="发送">
              <ArrowUp size={16} />
            </button>
          )}
        </div>
        <div className="ai-disclaimer">
          {online ? (
            <span>
              回答由 <button onClick={onOpenSettings}>{modeLabel}</button> 生成，可能有误，请回原文核对。
            </span>
          ) : (
            <span>
              离线速读不调用大模型 ·{' '}
              <button onClick={onOpenSettings}>接入 AI</button>
            </span>
          )}
          <span className="ai-keys">Enter 发送 · Shift + Enter 换行</span>
        </div>
      </div>
    </div>
  );
}
