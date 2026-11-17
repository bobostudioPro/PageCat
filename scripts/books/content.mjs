// Public-domain excerpts + the PageCat reading manual.
// Texts are fetched from Project Gutenberg and trimmed into short sample books.

export const MANUAL = {
  title: '如何在 PageCat 读一本书',
  author: 'PageCat 书房',
  year: '2026',
  genre: '使用手册',
  accent: '#a4613a',
  dark: '#6e3c21',
  description:
    '一本关于这间数字书房的小册子：怎么取书、划线、收藏、记笔记，以及怎样和 AI 助手一起把一本书读深。',
  paragraphs: [
    {
      heading: '欢迎来到书房',
      kicker: '第一章',
      drop: '这',
      body: [
        '是一间只属于你的数字书房。它不售卖书，也不催你读完；它只做一件事——把你放进来的 PDF，安安静静地变成一本书。',
        '点击右上角的「放入新书」，或者把 PDF 直接拖进窗口。文件不会被上传到任何服务器，它被保存在浏览器的本地数据库里。换一台电脑，书架会是空的；清空浏览器数据，书也会消失。这是代价，也是承诺。',
        '书架上的每一本书都有自己的颜色、厚度和位置。把鼠标放上去，书会微微抬起；点一下，它会被从架子上抽出来，翻开封面前往阅读页。右键或长按一本书，可以查看详情、继续阅读或把它从书架上取下。取下意味着删除：PDF、划线和笔记都会一起消失。',
      ],
    },
    {
      heading: '在纸上划线',
      kicker: '第二章',
      body: [
        '在阅读页选中一段文字，会浮出一小条工具：四种颜色的荧光笔、下划线、收藏、笔记，以及「问 AI」。',
        '荧光笔适合标记让你停下来的句子；下划线适合标记论证与事实；收藏是给那些你确定会回来看的段落。划线会跟着文字走，缩放、换页、重新打开都不会错位。',
        '笔记可以附在划线上，也可以独立存在于某一页。在「划线」和「笔记」两个面板之间，你来去自由：从笔记跳到原文，从原文回到笔记。删除划线时，附在它上面的笔记会一起删除。',
      ],
      quote: '划线不是为了记住所有事，而是为了在未来的某一页，重新遇见当时的自己。',
    },
    {
      heading: '和 AI 读书',
      kicker: '第三章',
      body: [
        'AI 助手在右侧的对话面板里。没有填写 API Key 时，它使用「本地速读」：抽取这一页的摘要、找出关键词、按关键词搜索原文、生成思考题。它不联网，也不会假装自己读懂了隐喻。',
        '在「书房设置」里填入任意 OpenAI 兼容接口的地址、模型和 Key，就可以进行真正的对话。助手会拿到当前页、相邻页、目录、你的划线和笔记；回答里提到原文时，会标注页码，点一下就能跳回去。',
        '密钥只保存在你的浏览器里。请求由你的浏览器直接发送给你填写的接口，不经过 PageCat 的服务器。请只在私人设备上使用。',
      ],
      quote: '好的阅读助手不是替你读完，而是把你想问的问题还给你。',
    },
    {
      heading: '一点阅读方法',
      kicker: '第四章',
      body: [
        '不要急着读完。读到一个好句子，划线；有想法，写下来；读不懂，问 AI；然后合上书，去过日子。',
        '过几天回来，从书架上把书抽出来，先看划线，再看笔记。那些你当时觉得重要的话，会在新的处境里长出新的意思。',
        '一本书不必读完，才算读过。',
      ],
    },
    {
      heading: '把这间书房带走',
      kicker: '第五章',
      body: [
        'PageCat 是一个完全运行在浏览器里的阅读空间。它没有账号，没有云端，没有推荐算法。你上传的 PDF、写下的笔记、和 AI 的对话，默认都只属于这台设备。',
        '愿你在里面留出一点安静的时间。读完一本，或者只读一页，都好。',
      ],
      quote: '一间书房最好的装饰，是读到一半的书。',
    },
  ],
  colophon:
    '《如何在 PageCat 读一本书》由 PageCat 书房编写与排版，作为示例藏书放在书架上。封面与内文由 PageCat 设计。',
};

export const BOOKS = [
  {
    id: 'sample-gatsby',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    year: '1925',
    genre: '小说',
    accent: '#7e2f2b',
    dark: '#431413',
    coverStyle: 'deco',
    description:
      '纽约长岛的夏天，绿灯、派对与旧梦。用第一人称的克制口吻，写尽美国梦的华丽与虚空。此处收录第一章。',
    source: { url: 'https://www.gutenberg.org/cache/epub/64317/pg64317.txt', credit: 'Project Gutenberg · Standard Ebooks' },
    seedProgress: 0.24,
    seeds: [
      {
        quote:
          'In my younger and more vulnerable years my father gave me some advice that I’ve been turning over in my mind ever since.',
        color: 'amber',
        favorite: true,
        note: '父亲的忠告像一枚小小的钉子，把整本书钉在了“评判”与“希望”之间。',
      },
      {
        quote: 'Reserving judgements is a matter of infinite hope.',
        color: 'sage',
        favorite: false,
        note: '',
      },
    ],
    chapterTitle: 'Chapter One',
    chapterNumber: 'I',
  },
  {
    id: 'sample-pride',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    year: '1813',
    genre: '小说',
    accent: '#335548',
    dark: '#182e26',
    coverStyle: 'botanical',
    description:
      '班纳特家五个女儿，与一场关于婚姻、阶层与自尊的漫长舞蹈。此处收录第一至第四章。',
    source: { url: 'https://www.gutenberg.org/cache/epub/1342/pg1342.txt', credit: 'Project Gutenberg' },
    seedProgress: 0.08,
    seeds: [
      {
        quote:
          'It is a truth universally acknowledged, that a single man in possession of a good fortune must be in want of a wife.',
        color: 'rose',
        favorite: true,
        note: '一句被引用到几乎失去锋芒的开场，放在整本书里却是一次漂亮的讽刺。',
      },
    ],
    chapterTitle: 'Chapter One',
    chapterNumber: 'I',
  },
  {
    id: 'sample-artofwar',
    title: 'The Art of War',
    author: 'Sun Tzu · Lionel Giles',
    year: '5th c. BC',
    genre: '兵法',
    accent: '#4a4034',
    dark: '#26211b',
    coverStyle: 'seal',
    description:
      '十三篇兵法，谈谋略、地形与人心。这一版是 Lionel Giles 1910 年英译本，此处收录前六篇。',
    source: { url: 'https://www.gutenberg.org/cache/epub/132/pg132.txt', credit: 'Project Gutenberg · Lionel Giles translation' },
    seedProgress: 0,
    seeds: [
      {
        quote: 'All warfare is based on deception.',
        color: 'sky',
        favorite: false,
        note: '',
      },
    ],
    chapterTitle: 'Laying Plans',
    chapterNumber: 'I',
  },
  {
    id: 'sample-meditations',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    year: 'c. 180 AD',
    genre: '哲思',
    accent: '#735b37',
    dark: '#3f301c',
    coverStyle: 'column',
    description:
      '罗马皇帝写给自己看的札记，关于自持、无常与如何度过今天。此处收录第二、三卷。',
    source: { url: 'https://www.gutenberg.org/cache/epub/2680/pg2680.txt', credit: 'Project Gutenberg · George Long translation' },
    seedProgress: 0,
    seeds: [
      {
        quote: "Every man's happiness depends from himself, but behold thy life is almost at an end",
        color: 'amber',
        favorite: true,
        note: '',
      },
    ],
    chapterTitle: 'The Second Book',
    chapterNumber: 'II',
  },
  {
    id: 'sample-alice',
    title: 'Alice’s Adventures in Wonderland',
    author: 'Lewis Carroll',
    year: '1865',
    genre: '童话',
    accent: '#5f4b76',
    dark: '#322644',
    coverStyle: 'moon',
    description:
      '掉进兔子洞之后，逻辑与荒诞一起失效。此处收录第一、二章。',
    source: { url: 'https://www.gutenberg.org/cache/epub/11/pg11.txt', credit: 'Project Gutenberg' },
    seedProgress: 0.41,
    seeds: [
      {
        quote: '“and what is the use of a book,” thought Alice “without pictures or conversations?”',
        color: 'rose',
        favorite: false,
        note: '整本书的第一句疑问，也是它给自己的阅读说明。',
      },
    ],
    chapterTitle: 'Down the Rabbit-Hole',
    chapterNumber: 'I',
  },
];

export const MANUAL_BOOK = {
  id: 'sample-manual',
  title: '如何在 PageCat 读一本书',
  titleZh: '如何在 PageCat 读一本书',
  author: 'PageCat 书房',
  authorZh: 'PageCat 书房',
  year: '2026',
  genre: '使用手册',
  accent: '#a4613a',
  dark: '#6e3c21',
  description: MANUAL.description,
  seedProgress: 0.62,
  seeds: [
    {
      quote: '一本书不必读完，才算读过。',
      color: 'amber',
      favorite: true,
      note: '把这句放在书架上，当作这间书房的门牌。',
    },
    {
      quote: '这是代价，也是承诺。',
      color: 'sage',
      favorite: false,
      note: '本地优先不是营销词，是取舍。',
    },
    {
      quote: '划线不是为了记住所有事，而是为了在未来的某一页，重新遇见当时的自己。',
      color: 'rose',
      favorite: true,
      note: '',
    },
  ],
};
