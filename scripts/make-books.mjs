import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { BOOKS, MANUAL, MANUAL_BOOK } from './books/content.mjs';

const root = process.cwd();
const cacheDir = join(root, 'scripts/.cache');
const outBooks = join(root, 'public/books');
const outCovers = join(root, 'public/covers');
await mkdir(cacheDir, { recursive: true });
await mkdir(outBooks, { recursive: true });
await mkdir(outCovers, { recursive: true });

const fontFiles = {
  fraunces: join(root, 'node_modules/@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2'),
  frauncesItalic: join(root, 'node_modules/@fontsource-variable/fraunces/files/fraunces-latin-wght-italic.woff2'),
  newsreader: join(root, 'node_modules/@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2'),
  newsreaderItalic: join(root, 'node_modules/@fontsource-variable/newsreader/files/newsreader-latin-wght-italic.woff2'),
  mono: join(root, 'node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2'),
  mono500: join(root, 'node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2'),
};

const b64 = async (file) => (await readFile(file)).toString('base64');
const fontData = {};
for (const [key, file] of Object.entries(fontFiles)) fontData[key] = await b64(file);

async function getChineseFont(text) {
  const hash = createHash('sha1').update(text).digest('hex').slice(0, 12);
  const cache = join(cacheDir, `noto-serif-sc-${hash}.woff2`);
  if (existsSync(cache)) return (await readFile(cache)).toString('base64');
  const url =
    'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600&text=' + encodeURIComponent(text);
  const css = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  }).then((r) => r.text());
  const urls = [...css.matchAll(/src:\s*url\((https:[^)]+)\)/g)].map((m) => m[1]);
  if (!urls.length) throw new Error('Cannot get Noto Serif SC subset');
  const buffers = [];
  for (const fontUrl of urls) {
    const res = await fetch(fontUrl);
    if (!res.ok) throw new Error(`Font download failed: ${res.status}`);
    buffers.push(Buffer.from(await res.arrayBuffer()));
  }
  // Usually the same subset URL is returned for each weight; use the first.
  const buffer = buffers[0];
  await writeFile(cache, buffer);
  return buffer.toString('base64');
}

const manualAllText =
  MANUAL.title +
  MANUAL.author +
  MANUAL.paragraphs.map((p) => p.heading + p.kicker + p.body.join('') + (p.quote || '')).join('') +
  MANUAL.colophon +
  'PageCat 数字书房 示例藏书 目录 章节 阅读 划线 收藏 笔记 书架 打开 书页 墨水 光线 安静 未来 问题 回答 原文 页码 浏览器 设备 服务器 上传 删除 数据 快捷键 放大 缩小 关闭 浮层 上一页 下一页';
const notoFont = await getChineseFont(manualAllText);
console.log('Chinese font subset ready');

const fontCss = `
@font-face{font-family:'Fraunces';src:url(data:font/woff2;base64,${fontData.fraunces}) format('woff2');font-weight:100 900;font-style:normal;}
@font-face{font-family:'Fraunces';src:url(data:font/woff2;base64,${fontData.frauncesItalic}) format('woff2');font-weight:100 900;font-style:italic;}
@font-face{font-family:'Newsreader';src:url(data:font/woff2;base64,${fontData.newsreader}) format('woff2');font-weight:200 800;font-style:normal;}
@font-face{font-family:'Newsreader';src:url(data:font/woff2;base64,${fontData.newsreaderItalic}) format('woff2');font-weight:200 800;font-style:italic;}
@font-face{font-family:'Mono';src:url(data:font/woff2;base64,${fontData.mono}) format('woff2');font-weight:400;font-style:normal;}
@font-face{font-family:'Mono';src:url(data:font/woff2;base64,${fontData.mono500}) format('woff2');font-weight:500;font-style:normal;}
@font-face{font-family:'NotoSerifSC';src:url(data:font/woff2;base64,${notoFont}) format('woff2');font-weight:400;font-style:normal;}
`;

const CAT_SVG = `<svg viewBox="0 0 64 64" fill="none"><path d="M14 48V26.5C14 18.5 20.5 12 28.5 12h7C43.5 12 50 18.5 50 26.5V48" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M21.5 48V30.4c0-4.2 3.4-7.6 7.6-7.6h5.8c4.2 0 7.6 3.4 7.6 7.6V48" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".55"/><path d="M25.5 34.5h1.8M36.7 34.5h1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M29.5 39.4c1.4 1 3.6 1 5 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M14 48h36" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>`;

const ORNAMENTS = {
  deco: `<svg viewBox="0 0 120 40" fill="none"><path d="M2 32h116M10 32l10-10 10 10 10-16 10 16 10-10 10 10 10-16 10 16 10-10 10 10" stroke="currentColor" stroke-width="1"/><circle cx="60" cy="8" r="2" fill="currentColor"/></svg>`,
  botanical: `<svg viewBox="0 0 120 40" fill="none"><path d="M60 34c0-10 0-18-1-26M60 18c-7-1-12-5-14-11 7 0 12 4 14 11Zm0 8c7-2 11-6 13-12-7 0-11 5-13 12Z" stroke="currentColor" stroke-width="1"/><path d="M18 34h30M72 34h30" stroke="currentColor" stroke-width=".8"/><circle cx="60" cy="5" r="1.6" fill="currentColor"/></svg>`,
  seal: `<svg viewBox="0 0 120 40" fill="none"><rect x="50" y="4" width="20" height="20" rx="2" stroke="currentColor" stroke-width="1.2"/><path d="M55 10h10M55 14h10M55 18h10M60 10v8" stroke="currentColor" stroke-width=".9"/><path d="M10 30h100" stroke="currentColor" stroke-width=".8"/></svg>`,
  column: `<svg viewBox="0 0 120 40" fill="none"><path d="M40 34V8h4v26M76 34V8h4v26M30 34h60M38 8h8M74 8h8" stroke="currentColor" stroke-width="1"/><path d="M44 11h32M44 30h32" stroke="currentColor" stroke-width=".6" opacity=".6"/></svg>`,
  moon: `<svg viewBox="0 0 120 40" fill="none"><path d="M62 27a13 13 0 1 1-13-16 11 11 0 0 0 13 16Z" stroke="currentColor" stroke-width="1.2"/><path d="M80 10l1.2 3.2L84 14l-2.8 1.2L80 18l-1.2-2.8L76 14l2.8-.8L80 10Z" fill="currentColor"/><circle cx="34" cy="16" r="1" fill="currentColor"/><circle cx="28" cy="28" r=".8" fill="currentColor"/></svg>`,
};

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function emphasize(s) {
  return esc(s).replace(/_([^_]{1,80})_/g, '<em>$1</em>');
}

const BASE_CSS = `
@page { size: 6in 9in; margin: 0.7in 0.66in 0.72in; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fbf7ee; }
body { color: #2b2118; font-family: 'Newsreader', Georgia, serif; font-size: 10.5pt; line-height: 1.55; text-rendering: geometricPrecision; }
p { margin: 0 0 0.34em; text-align: justify; text-indent: 1.3em; orphans: 3; widows: 3; hyphens: auto; }
p.first { text-indent: 0; }
em { font-style: italic; }
.title-page { height: 7.35in; display: flex; flex-direction: column; align-items: center; text-align: center; padding-top: 0.35in; }
.title-mark { width: 46px; height: 46px; color: #9a7440; margin-bottom: 0.34in; }
.title-kicker { font-family: 'Mono', monospace; font-size: 6.8pt; letter-spacing: .26em; color: #967a55; text-transform: uppercase; }
.title-page h1 { font-family: 'Fraunces', Georgia, serif; font-weight: 400; font-size: 37pt; line-height: 1.1; letter-spacing: -.02em; margin: 0.55in 0 0.12in; max-width: 4.3in; }
.title-rule { width: 46px; height: 1px; background: #b08a55; margin: 0.16in 0; }
.title-author { font-family: 'Fraunces', Georgia, serif; font-size: 13pt; font-style: italic; color: #5d4a35; }
.title-meta { margin-top: auto; font-family: 'Mono', monospace; font-size: 6.5pt; letter-spacing: .18em; color: #a08a6c; line-height: 2; text-transform: uppercase; }
.title-seal { margin-top: 0.3in; width: 30px; height: 30px; border: 1px solid #b08a55; color: #9a7440; display: grid; place-items: center; font-family: 'NotoSerifSC', serif; font-size: 10pt; }
.chapter { break-before: page; }
.chapter-head { padding-top: 0.18in; margin-bottom: 0.5in; break-after: avoid; }
.chapter-kicker { font-family: 'Mono', monospace; font-size: 7pt; letter-spacing: .25em; text-transform: uppercase; color: #9a7a52; }
.chapter-num { font-family: 'Fraunces', Georgia, serif; font-size: 64pt; font-weight: 300; line-height: .9; letter-spacing: -.04em; color: #2b2118; margin: 0.14in 0 0; }
.chapter-title { font-family: 'Fraunces', Georgia, serif; font-size: 22pt; font-style: italic; font-weight: 400; margin: 0.1in 0 0.2in; color: #382b1d; }
.chapter-ornament { width: 120px; height: 38px; color: #a98755; }
.dropcap::first-letter { float: left; font-family: 'Fraunces', Georgia, serif; font-size: 44pt; line-height: .78; padding: 0.06in 0.09in 0 0; color: #8f5a37; font-weight: 400; }
.chapter-note { margin-top: 0.4in; padding-top: 0.15in; border-top: 1px solid rgba(110, 80, 46, .25); font-family: 'Mono', monospace; font-size: 6.5pt; letter-spacing: .1em; color: #9c8567; text-align: center; }
.aphorism p { text-indent: 0; margin-bottom: 0.62em; }
.colophon { break-before: page; padding-top: 2.6in; text-align: center; }
.colophon .mark { width: 32px; height: 32px; color: #a98755; margin: 0 auto 0.3in; }
.colophon p { text-align: center; text-indent: 0; font-size: 9.5pt; line-height: 1.7; color: #6b5844; margin: 0 auto 0.12in; max-width: 3.6in; }
.colophon .small { font-family: 'Mono', monospace; font-size: 6.3pt; letter-spacing: .12em; color: #a08a6c; margin-top: 0.35in; }
.running-foot { position: fixed; bottom: 0.38in; left: 0; right: 0; text-align: center; font-family: 'Mono', monospace; font-size: 5.8pt; letter-spacing: .2em; color: rgba(120, 90, 55, .45); text-transform: uppercase; }
`;

const MANUAL_CSS = `
body { font-family: 'NotoSerifSC', 'Newsreader', serif; font-size: 11.8pt; line-height: 1.95; letter-spacing: .02em; color: #2b2118; }
p { text-indent: 0; margin-bottom: 0.5em; letter-spacing: .02em; }
.title-page { height: 7.3in; align-items: stretch; text-align: left; padding-top: 0.2in; }
.manual-title-wrap { display: flex; gap: 0.3in; align-items: flex-start; height: 4.6in; }
.manual-vertical { writing-mode: vertical-rl; font-family: 'NotoSerifSC', serif; font-size: 31pt; font-weight: 600; letter-spacing: .18em; line-height: 1.5; color: #382418; border-right: 1px solid rgba(120, 85, 50, .3); padding-right: 0.18in; }
.manual-side { display: flex; flex-direction: column; justify-content: flex-end; height: 100%; padding-bottom: 0.2in; gap: 0.06in; }
.manual-side .sub { font-family: 'Fraunces', serif; font-size: 9pt; letter-spacing: .22em; color: #9a7440; text-transform: uppercase; }
.manual-side .cat { width: 42px; height: 42px; color: #a4613a; margin-bottom: 0.22in; }
.manual-side .author { font-size: 10.5pt; color: #6c523c; }
.manual-side .year { font-family: 'Mono', monospace; font-size: 7pt; letter-spacing: .16em; color: #a08a6c; }
.manual-title-meta { margin-top: auto; border-top: 1px solid rgba(120, 85, 50, .25); padding-top: 0.16in; font-family: 'Mono', monospace; font-size: 6.4pt; letter-spacing: .18em; color: #a08a6c; display: flex; justify-content: space-between; }
.manual-chapter .chapter-head { margin-bottom: 0.45in; padding-top: 0.1in; }
.manual-kicker { font-family: 'Mono', monospace; font-size: 7pt; letter-spacing: .22em; color: #a4613a; }
.manual-chapter h2 { font-family: 'NotoSerifSC', serif; font-size: 24pt; font-weight: 600; letter-spacing: .08em; margin: 0.14in 0 0.12in; }
.manual-chapter .chapter-ornament { width: 90px; height: 20px; color: #a4613a; }
.manual-quote { margin: 0.38in 0 0.2in; padding: 0.16in 0; border-top: 1px solid rgba(140, 95, 55, .28); border-bottom: 1px solid rgba(140, 95, 55, .28); font-size: 13pt; line-height: 1.9; letter-spacing: .06em; color: #7a4b2c; text-align: center; }
.manual-chapter p { text-align: justify; }
.manual-chapter p:first-of-type { font-size: 12.5pt; }
.colophon p { font-family: 'NotoSerifSC', serif; letter-spacing: .04em; }
`;

function paragraphsToHtml(paragraphs) {
  return paragraphs
    .map((text, i) => `<p class="${i === 0 ? 'first' : ''}">${emphasize(text)}</p>`)
    .join('\n');
}

function chapterHtml(chapter, index, style) {
  const ornament = ORNAMENTS[style] ?? ORNAMENTS.botanical;
  return `<section class="chapter ${index === 0 ? 'first' : ''}">
    <header class="chapter-head">
      <div class="chapter-kicker">${esc(chapter.kicker ?? '')}</div>
      <div class="chapter-num">${esc(chapter.number ?? String(index + 1))}</div>
      <h2 class="chapter-title">${esc(chapter.title ?? '')}</h2>
      <div class="chapter-ornament">${ornament}</div>
    </header>
    ${paragraphsToHtml(chapter.paragraphs ?? [])}
    ${chapter.note ? `<div class="chapter-note">${esc(chapter.note)}</div>` : ''}
  </section>`;
}

function docHtml({ title, author, year, genre, classNames, chapters, extraCss, colophon, source, subtitle }) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${fontCss}${BASE_CSS}${extraCss ?? ''}</style></head>
  <body class="${classNames ?? ''}">
    <div class="running-foot">${esc(title)} · PAGECAT</div>
    <section class="title-page">
      <div class="title-mark">${CAT_SVG}</div>
      <div class="title-kicker">PAGECAT LIBRARY · 示例藏书</div>
      <h1>${esc(title)}</h1>
      <div class="title-rule"></div>
      <div class="title-author">${esc(author)}</div>
      ${subtitle ? `<div class="chapter-note" style="margin-top:.3in;border:0">${esc(subtitle)}</div>` : ''}
      <div class="title-meta">${esc(genre)} · ${esc(year)}<br/>${esc(source?.credit ?? '')}</div>
      <div class="title-seal">${genre === '使用手册' || genre === '兵法' ? '书' : 'P'}</div>
    </section>
    ${chapters.map((c, i) => chapterHtml(c, i, c.style ?? 'botanical')).join('\n')}
    <section class="colophon">
      <div class="mark">${CAT_SVG}</div>
      <p>${esc(colophon ?? '')}</p>
      <p class="small">PAGECAT · A QUIET ROOM FOR YOUR PDFS</p>
    </section>
  </body></html>`;
}

const getCache = async (url, name) => {
  const file = join(cacheDir, name);
  if (existsSync(file)) return readFile(file, 'utf8');
  const res = await fetch(url, { headers: { 'User-Agent': 'PageCat-sample-builder/1.0' } });
  if (!res.ok) throw new Error(`Fetch failed ${url}: ${res.status}`);
  const text = await res.text();
  await writeFile(file, text);
  return text;
};

function cleanGutenberg(text) {
  let t = text;
  const start = t.indexOf('*** START OF THE PROJECT GUTENBERG EBOOK');
  if (start >= 0) t = t.slice(t.indexOf('\n', start) + 1);
  const end = t.indexOf('*** END OF THE PROJECT GUTENBERG EBOOK');
  if (end >= 0) t = t.slice(0, end);
  t = t.replace(/\r/g, '');
  t = t.replace(/\[Illustration:[\s\S]*?\]/g, '');
  t = t.replace(/\[[^\]\n]{0,500}\]/g, '');
  t = t.replace(/[ \t]+\n/g, '\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t;
}

function toChapters(text, specs) {
  return specs.map((spec, i) => {
    let body = text.slice(spec.start, spec.end);
    body = body.replace(spec.headingPattern ?? /^.*$/m, '');
    const paras = body
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
      .filter((p) => p.length > 12 && !/^[-*_=~ ]+$/.test(p) && !/^CHAPTER\b/i.test(p))
      .map((p) => p.replace(/^[0-9]+\.\s+/, (m) => m));
    return {
      number: spec.number,
      title: spec.title,
      kicker: spec.kicker,
      paragraphs: paras,
      note: spec.note,
      style: spec.style,
    };
  });
}

function sliceByWords(text, maxWords) {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ').replace(/[^.!?”’"']+$/, '') + ' …';
}

async function buildTextBook(book) {
  const file = `${book.id}.txt`;
  const raw = await getCache(book.source.url, file);
  const text = cleanGutenberg(raw);
  const specs = [];

  if (book.id === 'sample-gatsby') {
    const start = text.indexOf('                                  I\n\nIn my younger');
    const end = text.indexOf('                                  II\n', start);
    specs.push({ start, end, number: 'I', title: 'Chapter One', kicker: 'A NOVEL · 1925', style: 'deco', removeHeading: true });
  } else if (book.id === 'sample-pride') {
    const s1 = text.indexOf('It is a truth universally acknowledged');
    const s2 = text.indexOf('CHAPTER II.', s1);
    const s3 = text.indexOf('CHAPTER III.', s2);
    const s4 = text.indexOf('CHAPTER IV.', s3);
    const s5 = text.indexOf('CHAPTER V.', s4);
    specs.push(
      { start: s1, end: s2, number: 'I', title: 'Chapter One', kicker: 'A NOVEL · 1813', style: 'botanical', removeHeading: false },
      { start: s2, end: s3, number: 'II', title: 'Chapter Two', kicker: 'PRIDE AND PREJUDICE', style: 'botanical', removeHeading: true },
      { start: s3, end: s4, number: 'III', title: 'Chapter Three', kicker: 'PRIDE AND PREJUDICE', style: 'botanical', removeHeading: true },
      { start: s4, end: s5, number: 'IV', title: 'Chapter Four', kicker: 'PRIDE AND PREJUDICE', style: 'botanical', removeHeading: true },
    );
  } else if (book.id === 'sample-artofwar') {
    const markers = [
      ['Chapter I. LAYING PLANS', 'I', 'Laying Plans'],
      ['Chapter II. WAGING WAR', 'II', 'Waging War'],
      ['Chapter III. ATTACK BY STRATAGEM', 'III', 'Attack by Stratagem'],
      ['Chapter IV. TACTICAL DISPOSITIONS', 'IV', 'Tactical Dispositions'],
      ['Chapter V. ENERGY', 'V', 'Energy'],
      ['Chapter VI. WEAK POINTS AND STRONG', 'VI', 'Weak Points and Strong'],
    ];
    const at = (m) => text.indexOf(m);
    markers.forEach(([marker, number, title], i) => {
      const start = at(marker);
      const end = i + 1 < markers.length ? at(markers[i + 1][0]) : text.indexOf('Chapter VII.', start);
      specs.push({ start, end, number, title, kicker: 'THE ART OF WAR · GILES TRANSLATION', style: 'seal', removeHeading: true });
    });
  } else if (book.id === 'sample-meditations') {
    const s1 = text.indexOf('THE SECOND BOOK');
    const s2 = text.indexOf('THE THIRD BOOK', s1);
    const s3 = text.indexOf('THE FOURTH BOOK', s2);
    specs.push(
      { start: s1, end: s2, number: 'II', title: 'The Second Book', kicker: 'MEDITATIONS · GEORGE LONG', style: 'column', removeHeading: true },
      { start: s2, end: s3, number: 'III', title: 'The Third Book', kicker: 'MEDITATIONS · GEORGE LONG', style: 'column', removeHeading: true },
    );
  } else if (book.id === 'sample-alice') {
    const s1 = text.indexOf('Alice was beginning to get very tired');
    const s2 = text.indexOf('CHAPTER II.', s1);
    const s3 = text.indexOf('“Curiouser and curiouser!”', s2);
    const s4 = text.indexOf('CHAPTER III.', s3);
    specs.push(
      { start: s1, end: s2, number: 'I', title: 'Down the Rabbit-Hole', kicker: "ALICE'S ADVENTURES · 1865", style: 'moon', removeHeading: false },
      { start: s3, end: s4, number: 'II', title: 'The Pool of Tears', kicker: "ALICE'S ADVENTURES · 1865", style: 'moon', removeHeading: false },
    );
  }

  const chapters = specs
    .map((spec) => {
      if (spec.start < 0 || spec.end <= spec.start) return null;
      let body = text.slice(spec.start, spec.end);
      if (spec.removeHeading) body = body.replace(/^[^\n]*\n?/, '');
      let paragraphs = body
        .split(/\n\s*\n/)
        .map((p) => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
        .filter(
          (p) =>
            p.length > 12 &&
            !/^[-*_=~ ]+$/.test(p) &&
            !/^CHAPTER\b/i.test(p) &&
            !/^(THE (SECOND|THIRD) BOOK)$/i.test(p),
        );
      if (book.id === 'sample-artofwar') {
        paragraphs = paragraphs
          .map((p) => p.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim())
          .filter((p) => /^\d+[.,]/.test(p))
          .map((p) => p.replace(/\]$/, '').trim());
      }
      return {
        number: spec.number,
        title: spec.title,
        kicker: spec.kicker,
        paragraphs,
        style: spec.style,
      };
    })
    .filter((c) => c && c.paragraphs.length);

  if (!chapters.length) throw new Error(`No content extracted for ${book.id}`);
  const totalWords = chapters.reduce((n, c) => n + c.paragraphs.reduce((m, p) => m + p.split(/\s+/).length, 0), 0);
  if (totalWords > 7000) {
    let budget = 6800;
    for (const chapter of chapters) {
      const kept = [];
      for (const p of chapter.paragraphs) {
        budget -= p.split(/\s+/).length;
        if (budget < 0) break;
        kept.push(p);
      }
      chapter.paragraphs = kept;
      if (budget < 0) {
        chapter.note = '本章节选至此。';
        break;
      }
    }
  }
  return chapters;
}

async function buildManual() {
  return MANUAL.paragraphs.map((p) => ({
    number: p.kicker.replace('第', '').replace('章', ''),
    kicker: p.kicker,
    title: p.heading,
    paragraphs: p.drop ? [p.drop + p.body[0], ...p.body.slice(1)] : p.body,
    quote: p.quote,
    style: 'manual',
  }));
}

// -------- covers --------
function coverOrnament(style) {
  if (style === 'deco') {
    return `<svg viewBox="0 0 200 120" fill="none"><path d="M20 100h160M30 100L60 50l30 50 20-72 20 72 30-50 30 50" stroke="currentColor" stroke-width="1"/><circle cx="100" cy="24" r="3" fill="currentColor"/><path d="M40 108h120" stroke="currentColor" stroke-width=".6" opacity=".5"/></svg>`;
  }
  if (style === 'botanical') {
    return `<svg viewBox="0 0 200 120" fill="none"><path d="M100 110V34M100 62c-16-3-27-13-30-28 16 1 27 11 30 28Zm0 22c16-4 26-14 29-29-16 1-26 12-29 29Z" stroke="currentColor" stroke-width="1"/><path d="M60 110h30M110 110h30" stroke="currentColor" stroke-width=".7"/><circle cx="100" cy="26" r="2" fill="currentColor"/></svg>`;
  }
  if (style === 'seal') {
    return `<svg viewBox="0 0 200 120" fill="none"><rect x="82" y="20" width="36" height="36" stroke="currentColor" stroke-width="1.4"/><path d="M92 30h16M92 38h16M92 46h16M100 30v16" stroke="currentColor" stroke-width="1"/><path d="M50 86h100M60 96h80" stroke="currentColor" stroke-width=".7"/></svg>`;
  }
  if (style === 'column') {
    return `<svg viewBox="0 0 200 120" fill="none"><path d="M70 104V28h6v76M124 104V28h6v76M56 104h88M64 28h18M118 28h18" stroke="currentColor" stroke-width="1"/><path d="M76 36h48M76 96h48" stroke="currentColor" stroke-width=".6" opacity=".6"/></svg>`;
  }
  if (style === 'moon') {
    return `<svg viewBox="0 0 200 120" fill="none"><path d="M110 84a30 30 0 1 1-30-38 26 26 0 0 0 30 38Z" stroke="currentColor" stroke-width="1.2"/><path d="M145 30l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" fill="currentColor"/><circle cx="55" cy="42" r="1.5" fill="currentColor"/><circle cx="70" cy="24" r="1" fill="currentColor"/></svg>`;
  }
  return '';
}

const COVER_LINES = {
  'sample-gatsby': ['THE', 'GREAT', 'GATSBY'],
  'sample-pride': ['PRIDE', 'AND', 'PREJUDICE'],
  'sample-artofwar': ['THE ART', 'OF WAR'],
  'sample-meditations': ['MEDITATIONS'],
  'sample-alice': ['ALICE’S', 'ADVENTURES', 'IN WONDERLAND'],
  'sample-manual': ['如何在 PageCat', '读一本书'],
};

function coverHtml(book, style) {
  const title = book.title;
  const lines = COVER_LINES[book.id] ?? [title];
  const titleHtml = `<div class="cov-title ${style === 'manual' ? 'manual-cov-title' : ''}">${lines
    .map((w, i) => `<span style="--i:${i}">${esc(w)}</span>`)
    .join('')}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  ${fontCss}
  @page { size: 600px 900px; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 600px; height: 900px; overflow: hidden; }
  body { font-family: 'Fraunces', serif; }
  .cover { position: relative; width: 600px; height: 900px; background: ${book.dark}; color: #eddbb8; overflow: hidden; }
  .cover::before { content: ''; position: absolute; inset: 0; background:
      radial-gradient(circle at 30% 15%, rgba(255, 244, 220, .18), transparent 44%),
      radial-gradient(circle at 70% 85%, rgba(0, 0, 0, .38), transparent 55%),
      repeating-linear-gradient(45deg, rgba(255,255,255,.018) 0 1px, transparent 1px 3px),
      linear-gradient(180deg, ${book.accent}, ${book.dark});
      opacity: 1; }
  .cover::after { content: ''; position: absolute; inset: 0; opacity: .5; mix-blend-mode: soft-light;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.4'/%3E%3C/svg%3E"); }
  .spine { position: absolute; left: 0; top: 0; bottom: 0; width: 30px; background: linear-gradient(90deg, rgba(0,0,0,.55), rgba(255,255,255,.08) 55%, rgba(0,0,0,.3)); z-index: 3; }
  .frame { position: absolute; inset: 42px; border: 1px solid rgba(231, 203, 153, .55); z-index: 2; }
  .frame::before { content: ''; position: absolute; inset: 8px; border: 1px solid rgba(231, 203, 153, .22); }
  .corner { position: absolute; width: 22px; height: 22px; border: 1px solid rgba(238, 213, 166, .8); z-index: 4; }
  .corner.tl { top: 34px; left: 34px; border-right: 0; border-bottom: 0; }
  .corner.tr { top: 34px; right: 34px; border-left: 0; border-bottom: 0; }
  .corner.bl { bottom: 34px; left: 34px; border-right: 0; border-top: 0; }
  .corner.br { bottom: 34px; right: 34px; border-left: 0; border-top: 0; }
  .top { position: absolute; top: 66px; left: 0; right: 0; text-align: center; font-family: 'Mono', monospace; font-size: 8px; letter-spacing: .34em; z-index: 4; opacity: .68; }
  .ornament { position: absolute; top: 158px; left: 0; right: 0; height: 120px; display: flex; justify-content: center; z-index: 4; color: rgba(236, 208, 158, .75); }
  .ornament svg { width: 200px; height: 120px; }
  .cov-title { position: absolute; top: 300px; left: 70px; right: 70px; z-index: 4; text-align: center; font-weight: 420; font-size: 48px; line-height: 1.12; letter-spacing: -.01em; text-transform: ${style === 'deco' ? 'uppercase' : 'none'}; color: #f2dfb9; text-shadow: 0 2px 0 rgba(0,0,0,.25); }
  .cov-title span { display: block; }
  .cov-title span:nth-child(2n) { font-style: italic; }
  .manual-cov-title { top: 296px; left: 90px; right: 90px; font-family: 'NotoSerifSC', serif; font-size: 33px; line-height: 1.55; letter-spacing: .04em; font-weight: 600; }
  .manual-cov-title span:nth-child(2) { font-size: 31px; }
  .rule { position: absolute; top: ${style === 'manual' ? '700px' : '572px'}; left: 50%; transform: translateX(-50%); width: 58px; height: 1px; background: rgba(236, 208, 158, .6); z-index: 4; }
  .author { position: absolute; top: ${style === 'manual' ? '724px' : '598px'}; left: 60px; right: 60px; text-align: center; font-size: 15px; font-style: italic; letter-spacing: .06em; color: rgba(239, 218, 179, .8); z-index: 4; }
  .genre { position: absolute; top: ${style === 'manual' ? '762px' : '638px'}; left: 0; right: 0; text-align: center; font-family: 'Mono', monospace; font-size: 8px; letter-spacing: .3em; color: rgba(236, 208, 158, .55); text-transform: uppercase; z-index: 4; }
  .bottom { position: absolute; bottom: 68px; left: 0; right: 0; text-align: center; font-family: 'Mono', monospace; font-size: 7px; letter-spacing: .28em; color: rgba(236, 208, 158, .55); z-index: 4; }
  .catmark { position: absolute; bottom: ${style === 'manual' ? '100px' : '104px'}; left: 50%; transform: translateX(-50%); width: 34px; height: 34px; color: rgba(236, 208, 158, .6); z-index: 4; }
  .manual-label { position: absolute; top: 240px; left: 50%; transform: translateX(-50%); width: 330px; height: 430px; border: 1px solid rgba(236, 208, 158, .5); background: rgba(248, 235, 210, .07); z-index: 3; }
  .manual-sub { position: absolute; top: 610px; left: 0; right: 0; text-align: center; z-index: 5; font-family: 'Mono', monospace; font-size: 8px; letter-spacing: .22em; color: rgba(236, 208, 158, .6); }
  </style></head><body>
  <div class="cover">
    <div class="spine"></div>
    <div class="frame"></div>
    <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
    <div class="top">PAGECAT LIBRARY</div>
    <div class="ornament">${coverOrnament(style)}</div>
    ${style === 'manual' ? '<div class="manual-label"></div><div class="manual-sub">PAGECAT 数字书房 · 使用手册</div>' : ''}
    ${titleHtml}
    <div class="rule"></div>
    <div class="author">${esc(book.author)}</div>
    <div class="genre">${esc(book.genre)} · ${esc(book.year)}</div>
    <div class="catmark">${CAT_SVG}</div>
    <div class="bottom">A QUIET ROOM FOR YOUR PDFS</div>
  </div></body></html>`;
}

// -------- main --------
const browser = await chromium.launch({
  env: {
    ...process.env,
    FONTCONFIG_FILE: '/tmp/fonts.conf',
    FONTCONFIG_PATH: '/tmp',
  },
});
const page = await browser.newPage({ viewport: { width: 800, height: 1200 }, deviceScaleFactor: 1 });

const manifests = [];
const allBooks = [...BOOKS, MANUAL_BOOK];

for (const [index, book] of allBooks.entries()) {
  console.log(`Building ${book.title}`);
  const isManual = book.id === 'sample-manual';
  const chapters = isManual ? await buildManual() : await buildTextBook(book);
  const pdfChapters = isManual
    ? chapters.map((c, i) => ({ ...c, note: c.quote ? undefined : undefined }))
    : chapters;
  let html;
  if (isManual) {
    html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(MANUAL.title)}</title><style>${fontCss}${BASE_CSS}${MANUAL_CSS}</style></head><body class="manual">
      <section class="title-page manual-title-page">
        <div class="title-kicker">PAGECAT LIBRARY · 使用手册</div>
        <div class="manual-title-wrap">
          <div class="manual-vertical">如何在 PageCat 读一本书</div>
          <div class="manual-side">
            <div class="cat">${CAT_SVG}</div>
            <div class="sub">A QUIET ROOM FOR YOUR PDFS</div>
            <div class="author">PageCat 书房</div>
            <div class="year">2026 · 第一版</div>
          </div>
        </div>
        <div class="manual-title-meta"><span>数字书房系列</span><span>NO. 001</span></div>
      </section>
      ${MANUAL.paragraphs
        .map(
          (p) => `<section class="chapter manual-chapter">
        <header class="chapter-head">
          <div class="manual-kicker">${esc(p.kicker)}</div>
          <h2>${esc(p.heading)}</h2>
          <div class="chapter-ornament">${ORNAMENTS.seal}</div>
        </header>
        ${paragraphsToHtml(p.drop ? [p.drop + p.body[0], ...p.body.slice(1)] : p.body)}
        ${p.quote ? `<div class="manual-quote">${esc(p.quote)}</div>` : ''}
      </section>`,
        )
        .join('')}
      <section class="colophon">
        <div class="mark">${CAT_SVG}</div>
        <p>${esc(MANUAL.colophon)}</p>
        <p class="small">PAGECAT · A QUIET ROOM FOR YOUR PDFS</p>
      </section>
    </body></html>`;
  } else {
    html = docHtml({
      title: book.title,
      author: book.author,
      year: book.year,
      genre: book.genre,
      chapters: pdfChapters,
      extraCss: book.id === 'sample-meditations' ? '.aphorism' : '',
      colophon:
        `本电子书为 PageCat 示例藏书，仅用于阅读与功能演示。原文 ${book.source.credit}，属公有领域。` +
        '排版与封面由 PageCat 书房制作。',
      source: book.source,
      subtitle: '节选 · 示例藏书',
    });
    html = html.replace('<body class="">', '<body>');
  }
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  const pdfPath = join(outBooks, `${book.id}.pdf`);
  await page.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });

  // Cover
  await page.setContent(coverHtml(book, isManual ? 'manual' : book.coverStyle), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(120);
  const coverPath = join(outCovers, `${book.id}.jpg`);
  await page.screenshot({ path: coverPath, type: 'jpeg', quality: 91, clip: { x: 0, y: 0, width: 600, height: 900 } });

  // Extract page texts for seeds / TOC.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(await readFile(pdfPath));
  const task = pdfjs.getDocument({ data, useSystemFonts: true });
  const doc = await task.promise;
  const pageTexts = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const p = await doc.getPage(n);
    const content = await p.getTextContent();
    pageTexts.push(content.items.map((it) => (it.str ?? '')).join(' ').replace(/\s+/g, ' ').trim());
    p.cleanup();
  }
  const pageCount = doc.numPages;
  await task.destroy();

  const squeeze = (s) => s.replace(/\s+/g, '').replace(/[’‘"]/g, "'");
  const findPage = (needle) => {
    const target = squeeze(needle);
    if (!target) return null;
    const exact = pageTexts.findIndex((t) => squeeze(t).includes(target));
    if (exact >= 0) return exact + 1;
    const looseTarget = target.slice(0, Math.min(80, target.length));
    const loose = pageTexts.findIndex((t) => squeeze(t).includes(looseTarget));
    return loose >= 0 ? loose + 1 : null;
  };

  const seedAnnotations = [];
  for (const seed of book.seeds ?? []) {
    const p = findPage(seed.quote);
    if (p) {
      seedAnnotations.push({
        page: p,
        quote: seed.quote,
        color: seed.color,
        style: seed.style ?? 'highlight',
        favorite: !!seed.favorite,
        note: seed.note || undefined,
      });
    } else {
      console.log(`  ! seed quote not found: ${seed.quote.slice(0, 60)}`);
    }
  }
  const toc = [];
  if (isManual) {
    for (const p of MANUAL.paragraphs) {
      const page = findPage(p.heading);
      if (page) toc.push({ title: p.heading, page, level: 0 });
    }
  } else {
    for (const chapter of chapters) {
      const page = findPage(chapter.title);
      if (page) toc.push({ title: chapter.title, page, level: 0 });
    }
  }

  const pdfStat = await stat(pdfPath);
  manifests.push({
    id: book.id,
    title: book.title,
    titleZh: book.titleZh,
    author: book.author,
    authorZh: book.authorZh,
    year: book.year,
    genre: book.genre,
    description: book.description,
    fileName: `${book.title}.pdf`,
    size: pdfStat.size,
    pageCount,
    cover: `./covers/${book.id}.jpg`,
    accent: book.accent,
    spineColor: book.accent,
    samplePdf: `./books/${book.id}.pdf`,
    isSample: true,
    seedProgress: book.seedProgress ?? 0,
    seedAnnotations,
    toc,
  });
  console.log(`  pages=${pageCount}, seeds=${seedAnnotations.length}, toc=${toc.length}, size=${(pdfStat.size / 1024).toFixed(0)}KB`);
}

await browser.close();

const manifest = { version: 2, books: manifests };
await writeFile(join(outBooks, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('manifest written with', manifests.length, 'books');
