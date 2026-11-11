export type AnnotationColor = 'amber' | 'rose' | 'sage' | 'sky';

export type Rect = { x: number; y: number; w: number; h: number };

export type Book = {
  id: string;
  title: string;
  author: string;
  titleZh?: string;
  authorZh?: string;
  year?: string;
  genre?: string;
  description?: string;
  fileName: string;
  size: number;
  pageCount: number;
  cover?: string;
  accent: string;
  spineColor?: string;
  createdAt: number;
  lastOpenedAt?: number;
  lastPage?: number;
  percent?: number;
  isSample?: boolean;
  samplePdf?: string;
  sampleCover?: string;
  hasFile?: boolean;
  seedVersion?: number;
  seedAnnotations?: SeedAnnotation[];
  seedProgress?: number;
  toc?: OutlineItem[];
};

export type SeedAnnotation = {
  page: number;
  quote: string;
  color: AnnotationColor;
  style?: 'highlight' | 'underline';
  favorite?: boolean;
  note?: string;
};

export type Annotation = {
  id: string;
  bookId: string;
  page: number;
  color: AnnotationColor;
  style: 'highlight' | 'underline';
  text: string;
  quote: string;
  rects: Rect[];
  favorite: boolean;
  noteId?: string;
  createdAt: number;
  updatedAt: number;
  seed?: boolean;
};

export type Note = {
  id: string;
  bookId: string;
  page: number;
  text: string;
  quote?: string;
  annotationId?: string;
  createdAt: number;
  updatedAt: number;
};

export type OutlineItem = {
  title: string;
  page: number;
  level: number;
};

export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  mode?: 'local' | 'online';
  error?: boolean;
};

export type BookChat = {
  bookId: string;
  messages: ChatMessage[];
  updatedAt: number;
};

export type AiProvider = 'deepseek' | 'openai' | 'custom';

export type Settings = {
  aiProvider: AiProvider;
  aiBaseUrl: string;
  aiModel: string;
  aiApiKey: string;
  aiTemperature: number;
  readerTheme: 'paper' | 'sepia' | 'night';
  pageTurnSound: boolean;
};

export type SeedBookMeta = Omit<Book, 'id' | 'createdAt' | 'fileName' | 'size'> & {
  id: string;
  fileName: string;
  size: number;
};

export type SeedManifest = {
  version: number;
  books: Book[];
};
