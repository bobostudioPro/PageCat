import { normalizeText } from '../utils';

const EN_STOP = new Set(
  `a an the and but or if then than that this these those of to in on at by for from with without into over under about as is are was were be been being am do does did doing have has had having i me my we our you your he him his she her it its they them their not no nor so such very can could should would may might will shall just also more most much many some any all each every other another there here when where why how what which who whom while because before after above below between during through again further once only own same too don should now ll m o re ve y ain aren couldn didn doesn hadn hasn haven isn ma mightn mustn needn shan shouldn wasn weren won wouldn`.split(
    /\s+/,
  ),
);

const ZH_STOP = new Set(
  `的 了 和 与 及 或 是 在 我 我们 你 你们 他 他们 她 她们 它 它们 这 那 这些 那些 一个 一种 一些 不 也 就 都 而 并 并且 但 但是 因为 所以 如果 虽然 然后 其中 对于 关于 可以 能够 已经 还 又 很 更 最 把 被 将 让 给 从 到 向 对 为 以 于 之 其 所 者 着 过 地 得 吗 呢 啊 吧 呀 哦 嗯 说 要 会 有 没有 这个 那个 什么 怎么 如何 为什么 这样 那样 自己 时候 现在 这里 那里 一点 一下`.split(
    /\s+/,
  ),
);

let segmenter: Intl.Segmenter | null = null;
try {
  segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
} catch {
  segmenter = null;
}

export type Token = { term: string; cjk: boolean };

export function tokenize(text: string): Token[] {
  const normalized = normalizeText(text);
  const tokens: Token[] = [];
  const latin = normalized.match(/[A-Za-z][A-Za-z'’-]{1,}/g) ?? [];
  for (const raw of latin) {
    const t = raw.toLowerCase().replace(/['’]s$/, '');
    if (t.length < 3 || EN_STOP.has(t)) continue;
    tokens.push({ term: t, cjk: false });
  }
  const cjkText = normalized.replace(/[^\u3400-\u9fff]/g, ' ');
  if (segmenter) {
    for (const part of segmenter.segment(cjkText)) {
      if (!part.isWordLike) continue;
      const t = part.segment;
      if (t.length < 2 || ZH_STOP.has(t)) continue;
      tokens.push({ term: t, cjk: true });
    }
  } else {
    for (const run of cjkText.split(/\s+/)) {
      for (let i = 0; i < run.length - 1; i++) {
        const t = run.slice(i, i + 2);
        if (!ZH_STOP.has(t)) tokens.push({ term: t, cjk: true });
      }
    }
  }
  return tokens;
}

export function splitSentences(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const raw = normalized
    .replace(/([.!?。！？；;])\s*/g, '$1\n')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 18);
  if (raw.length) return raw;
  return normalized.split(/(?<=[.!?。！？])\s*/).map((s) => s.trim()).filter((s) => s.length > 10);
}

export function topTerms(text: string, limit = 8) {
  const counts = new Map<string, number>();
  for (const { term } of tokenize(text)) counts.set(term, (counts.get(term) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([term, n]) => n > 1 || term.length >= 3)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

export function scoreSentences(sentences: string[]) {
  const df = new Map<string, number>();
  const tokenized = sentences.map((s) => tokenize(s));
  for (const tokens of tokenized) {
    const seen = new Set(tokens.map((t) => t.term));
    for (const term of seen) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const total = Math.max(1, sentences.length);
  return tokenized.map((tokens, i) => {
    let score = 0;
    for (const { term } of tokens) {
      const freq = df.get(term) ?? 1;
      score += Math.log(1 + total / freq) * (term.length > 3 ? 1.2 : 1);
    }
    const lenPenalty = sentences[i].length > 260 ? 0.7 : 1;
    const position = i === 0 ? 1.5 : i < 2 ? 1.18 : 1;
    return { index: i, score: (score / Math.sqrt(tokens.length + 4)) * lenPenalty * position };
  });
}

export function bestSentences(sentences: string[], limit = 4) {
  const scored = scoreSentences(sentences);
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
    .map((s) => sentences[s.index]);
}

export function queryTerms(question: string) {
  const terms = tokenize(question).map((t) => t.term);
  return [...new Set(terms)].slice(0, 8);
}
