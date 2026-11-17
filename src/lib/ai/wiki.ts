export type KnowledgeCard = {
  title: string;
  extract: string;
  url: string;
  lang: 'zh' | 'en';
};

const knowledgePattern =
  /是什么|什么是|是谁|什么意思|含义|概念|背景|历史|原理|解释|介绍|what is|what are|who is|who was|explain|meaning of|meaning|background|define/i;

export function looksLikeKnowledgeQuestion(question: string) {
  if (!knowledgePattern.test(question)) return false;
  // Questions about the book's plot or the reader's own notes are handled by the book context.
  if (/这本书|这一页|这一段|本章|作者|主人公|这段话|我的划线|我的笔记|this book|this page|this passage|the author|the protagonist/i.test(question)) {
    return false;
  }
  return true;
}

function searchPhrase(question: string) {
  let q = question
    .replace(/请|帮我|我想知道|想问|请问|能不能|可以|一下|告诉我|查询|查一下|找一下/g, ' ')
    .replace(/是什么|什么是|是谁|什么意思|的含义|的意思|解释一下|解释|介绍一下|介绍|的背景|背景|的历史|历史|的概念|概念|的原理|原理|为什么|怎么理解|知道吗|知道/g, ' ')
    .replace(/[？?。！!，,；;：:"“”'‘’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/^(what|who|why|how|when|where|explain|define)\b/i.test(q)) {
    q = q.replace(/^(what|who|why|how|when|where)\s+(is|are|was|were)?\s*/i, '');
  }
  return q.slice(0, 80).trim();
}

async function fetchJson(url: string, signal: AbortSignal) {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  return res.json();
}

async function lookupInLanguage(query: string, lang: 'zh' | 'en', signal: AbortSignal): Promise<KnowledgeCard | null> {
  const host = lang === 'zh' ? 'zh.wikipedia.org' : 'en.wikipedia.org';
  const searchUrl = `https://${host}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query,
  )}&srlimit=3&format=json&origin=*`;
  const search = await fetchJson(searchUrl, signal);
  const hits = search?.query?.search ?? [];
  for (const hit of hits.slice(0, 2)) {
    const title = hit.title as string;
    if (!title) continue;
    const summaryUrl = `https://${host}/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`;
    const summary = await fetchJson(summaryUrl, signal).catch(() => null);
    const extract = (summary?.extract ?? '').replace(/\s+/g, ' ').trim();
    if (extract.length < 40) continue;
    return {
      title: summary?.title ?? title,
      extract: extract.length > 900 ? `${extract.slice(0, 900)}…` : extract,
      url: summary?.content_urls?.desktop?.page ?? `https://${host}/wiki/${encodeURIComponent(title)}`,
      lang,
    };
  }
  return null;
}

export async function lookupWikipedia(question: string): Promise<KnowledgeCard | null> {
  const query = searchPhrase(question);
  if (query.length < 2) return null;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 7000);
  try {
    const zh = await lookupInLanguage(query, 'zh', controller.signal).catch(() => null);
    if (zh) return zh;
    return await lookupInLanguage(query, 'en', controller.signal).catch(() => null);
  } finally {
    window.clearTimeout(timer);
  }
}
