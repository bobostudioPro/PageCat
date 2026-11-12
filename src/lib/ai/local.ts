import type { AiContext } from './types';
import { bestSentences, queryTerms, splitSentences, tokenize, topTerms } from './text';

type Sentence = { text: string; page: number };

function corpusFor(context: AiContext): Sentence[] {
  const byPage = new Map<number, string>();
  if (context.scope === 'page') {
    // Stay on the page the reader is looking at; use neighbours only if the page is mostly image.
    if (context.currentPageText.length > 60) byPage.set(context.page, context.currentPageText);
    else for (const p of context.contextPages) byPage.set(p.page, p.text);
  } else {
    for (const p of context.digest) byPage.set(p.page, p.text);
    if (context.currentPageText) byPage.set(context.page, context.currentPageText);
  }
  for (const ref of context.references) {
    if (!('text' in ref) || !ref.text) continue;
    byPage.set(ref.page, `${byPage.get(ref.page) ?? ''} ${ref.text}`);
  }
  const out: Sentence[] = [];
  for (const [page, text] of byPage) {
    for (const sentence of splitSentences(text)) out.push({ text: sentence, page });
  }
  return out;
}

function cite(page: number) {
  return `[第 ${page} 页](#page-${page})`;
}

function clip(text: string, max = 240) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function detectIntent(question: string) {
  if (/总结|概括|讲了什么|讲什么|大意|摘要|summary|summarize|about/i.test(question)) return 'summary';
  if (/关键词|主题|核心概念|keywords?|themes?/i.test(question)) return 'keywords';
  if (/思考题|问题|提问|测验|quiz|question/i.test(question)) return 'questions';
  if (/解释|什么意思|含义|怎么理解|为何|explain|meaning/i.test(question)) return 'explain';
  if (/找|原文|哪里|哪一页|引用|quote|where|passage/i.test(question)) return 'find';
  return 'general';
}

function keywordLine(context: AiContext) {
  const source = [context.currentPageText, ...context.digest.map((d) => d.text)].join(' ');
  const terms = topTerms(source, 7).map((t) => `「${t.term}」`);
  return terms.length ? terms.join('　') : '这一页的词汇比较平实，没有特别高频的主题词。';
}

function summaryAnswer(context: AiContext, sentences: Sentence[]) {
  const scopeLabel = context.scope === 'book' ? '全书速览' : '本页速读';
  const pool = sentences.slice(0, 80);
  const top = bestSentences(pool.map((s) => s.text), context.scope === 'book' ? 5 : 4);
  const bullets = top
    .map((text) => {
      const found = pool.find((s) => s.text === text);
      return `- ${clip(text, 260)} ${found ? cite(found.page) : ''}`;
    })
    .join('\n');
  const marked = context.annotations
    .filter((a) => context.scope === 'book' || a.page === context.page)
    .slice(0, 2)
    .map((a) => `> ${clip(a.quote, 220)}\n>\n> 你的划线 · ${cite(a.page)}`)
    .join('\n\n');
  return `**${scopeLabel}**

${bullets || '- 这一页几乎没有可提取的正文，可能是一张插图或扫描页。'}

${marked ? `**你划过的句子**\n\n${marked}\n\n` : ''}**高频词**
${keywordLine(context)}

${context.scope === 'book' ? '> 全书速览是对抽取页面的抽样速读。' : '> 想读得更深，可以选中一段问 AI，或接入大模型后继续对话。'}`;
}

function keywordsAnswer(context: AiContext) {
  const text = [context.currentPageText, ...context.digest.map((d) => d.text)].join(' ');
  const terms = topTerms(text, 10);
  const rows = terms
    .map((t) => `- 「${t.term}」 · 出现 ${t.count} 次`)
    .join('\n');
  return `**关键词与主题**

${rows || '- 没有提取到明显的高频词。'}

> 速读模式按词频与分布提取，不等同于大模型的主题归纳。`;
}

function questionsAnswer(context: AiContext, sentences: Sentence[]) {
  const terms = topTerms(context.currentPageText || context.digest.map((d) => d.text).join(' '), 4);
  const picks = bestSentences(sentences.map((s) => s.text), 3);
  const questions = [
    terms[0] ? `作者为什么反复提到「${terms[0].term}」？它和全书的主旨有什么关系？` : '这一页的核心论点是什么？证据在哪里？',
    picks[0] ? `「${clip(picks[0], 70)}」这句话在本页中承担了什么作用？` : '这一页的论述是怎样一步步展开的？',
    terms[1] ? `如果把「${terms[1].term}」换成相反的概念，这一页的结论还成立吗？` : '如果换一个立场，作者会如何反驳自己？',
    '这一页留下的最大疑问是什么？你同意作者的判断吗？',
  ];
  return `**可以带走的思考题**

${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

> 这些问题由原文关键词与句子结构生成，用来启动你自己的阅读，而不是替你下结论。`;
}

function explainAnswer(context: AiContext) {
  const quote = context.selection?.trim();
  const pageSentences = splitSentences(context.currentPageText);
  const around = context.selection
    ? bestSentences(pageSentences.filter((s) => s.length > 24), 3)
    : bestSentences(pageSentences, 3);
  const terms = topTerms([context.selection, context.currentPageText].filter(Boolean).join(' '), 5);
  return `${quote ? `你选中了：「${clip(quote, 260)}」\n\n` : ''}**这一段的上下文**

${around.map((s) => `- ${clip(s)} ${cite(context.page)}`).join('\n') || '- 这一页可读的正文不多。'}

**可能需要注意的概念**
${terms.map((t) => `「${t.term}」`).join('　') || '没有特别突出的概念。'}

> 离线速读只能做文本层面的梳理。接入大模型后，我可以结合上下文解释隐喻、论证与写作意图。`;
}

function findAnswer(context: AiContext, question: string, sentences: Sentence[]) {
  const terms = queryTerms(question);
  if (!terms.length) return generalAnswer(context, question, sentences);
  const hits = sentences
    .map((s) => {
      const tokens = tokenize(s.text).map((t) => t.term);
      const score = terms.reduce((acc, term) => acc + (tokens.includes(term) ? 1 : 0), 0);
      return { ...s, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  if (!hits.length) {
    return `**没有找到直接相关的原文**

我按「${terms.join('、')}」在${context.scope === 'book' ? '抽样页面' : '当前页'}里找了一遍，没有匹配到句子。可以试试更短的关键词，或者接入大模型做语义检索。

${summaryAnswer(context, sentences)}`;
  }
  return `**书中相关的段落**

${hits.map((h) => `> ${clip(h.text, 300)}\n>\n> ${cite(h.page)}`).join('\n\n')}

> 这是按关键词匹配的原文摘录。`;
}

function generalAnswer(context: AiContext, question: string, sentences: Sentence[]) {
  const terms = queryTerms(question);
  const hits = sentences.filter((s) => {
    const tokens = tokenize(s.text).map((t) => t.term);
    return terms.some((term) => tokens.includes(term));
  });
  const quoteSource = hits.length ? hits : sentences;
  const picks = bestSentences(quoteSource.map((s) => s.text), 3);
  return `**从原文里找到的线索**

${picks.map((p) => {
  const found = sentences.find((s) => s.text === p);
  return `> ${clip(p, 260)}\n>\n> ${found ? cite(found.page) : ''}`;
}).join('\n\n') || '当前页没有提取到足够的正文。'}

**这一页的关键词**
${keywordLine(context)}

> 离线速读适合快速找原文、看关键词。要讨论观点、写作手法或章节脉络，请在设置里接入大模型。`;
}


function referencesAnswer(context: AiContext) {
  const lines: string[] = [];
  const texts: { page: number; text: string }[] = [];
  for (const ref of context.references) {
    if (ref.type === 'book') {
      lines.push('- 整本书（抽样阅读）');
    } else if (ref.type === 'page') {
      const pageText = context.contextPages.find((p) => p.page === ref.page)?.text ?? context.digest.find((p) => p.page === ref.page)?.text ?? '';
      lines.push(`- 第 ${ref.page} 页 ${cite(ref.page)}`);
      if (pageText) texts.push({ page: ref.page, text: pageText });
    } else if (ref.type === 'highlight') {
      lines.push(`> ${clip(ref.text, 260)}\n>\n> 你的划线 ${cite(ref.page)}`);
      texts.push({ page: ref.page, text: ref.text });
    } else if (ref.type === 'note') {
      lines.push(`- 你的笔记 ${cite(ref.page)}：${clip(ref.text, 260)}${ref.quote ? `\n  > 原文：「${clip(ref.quote, 180)}」` : ''}`);
      texts.push({ page: ref.page, text: `${ref.text} ${ref.quote ?? ''}` });
    } else if (ref.type === 'paragraph') {
      lines.push(`> ${clip(ref.text, 360)}\n>\n> 第 ${ref.page} 页 · 第 ${ref.index + 1} 段 ${cite(ref.page)}`);
      texts.push({ page: ref.page, text: ref.text });
    } else {
      lines.push(`> ${clip(ref.text, 360)}\n>\n> 选中原文 ${cite(ref.page)}`);
      texts.push({ page: ref.page, text: ref.text });
    }
  }
  if (context.scope === 'book' && !texts.length) {
    for (const page of context.digest.slice(0, 3)) texts.push(page);
  }
  const body = texts.map((t) => t.text).join(' ');
  const terms = topTerms(body, 7);
  const quotes = bestSentences(splitSentences(body), 3);
  return `**你引用的内容**

${lines.join('\n\n')}

**可以怎样读**

${quotes.map((q) => `- ${clip(q, 240)}`).join('\n') || '- 这段内容较短，先注意它的措辞与语气。'}

**关键词**
${terms.map((t) => `「${t.term}」`).join('　') || '没有明显的高频词。'}

> 本地速读只做文本层面的梳理，不等同于大模型的语义分析。想讨论隐喻、论证与写作意图，可以接入大模型。`;
}

export function localAnswer(question: string, context: AiContext): string {
  const sentences = corpusFor(context);
  const intent = detectIntent(question);
  if (context.references.length && /引用|这些内容|这条划线|这条笔记|这段话|这段文字|分析/.test(question)) {
    return referencesAnswer(context);
  }
  switch (intent) {
    case 'summary':
      return summaryAnswer(context, sentences);
    case 'keywords':
      return keywordsAnswer(context);
    case 'questions':
      return questionsAnswer(context, sentences);
    case 'explain':
      return explainAnswer(context);
    case 'find':
      return findAnswer(context, question, sentences);
    default:
      return generalAnswer(context, question, sentences);
  }
}

export function localGreeting(context: AiContext) {
  const terms = topTerms(context.currentPageText, 4);
  return `我在第 ${context.page} 页读到了 ${context.currentPageText.length} 个字符${
    terms.length ? `，反复出现的是 ${terms.map((t) => `「${t.term}」`).join('、')}` : ''
  }。现在可以：总结这一页、找原文、生成思考题；如果选中一段文字，我会围绕它整理上下文。`;
}
