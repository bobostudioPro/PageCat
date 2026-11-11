# PageCat · 一间安静的数字书房

![PageCat 书架](docs/screenshots/after-library.jpg)

![阅读页与划线](docs/screenshots/after-reader.jpg)

> 把 PDF 放上书架，划线、收藏、记笔记，再和 AI 助手一起把一本书读深。

PageCat 是一个**完全运行在浏览器里**的 PDF 阅读空间。它没有账号、没有云端、没有推荐算法：PDF、划线、笔记和阅读进度都只保存在本机的 IndexedDB 中。书架用 CSS 做了拟物化的木纹、书脊与取书动画，阅读页则尽量保留纸书的排版与温度。

## 功能

- **上传 PDF**：拖入窗口或点击「放入新书」；自动读取页数、元数据，并用第一页生成封面。
- **书架拟物交互**：不同颜色、厚度、高度的书脊；悬停抬起、右键/长按整理、点击取书并翻开封面的过场动画、阅读进度书签与猫。
- **在线阅读**：pdf.js 高清渲染、文本层选择、连续滚动、缩放、目录跳转、阅读进度、页内页码。
- **划线收藏**：选中文字后浮出工具条，支持四种高亮颜色、下划线、收藏；高亮按 PDF 坐标归一化保存，缩放/换页不会错位。
- **笔记**：可以给划线附笔记，也可以在任意页单独记笔记；两个面板互相跳转，删除划线会级联删除其笔记。
- **AI 阅读助手**：
  - **本地速读（无需密钥）**：抽取摘要、找关键词、按关键词找原文、生成思考题；不调用大模型，明确标注。
  - **在线对话（BYOK）**：填入任意 OpenAI 兼容接口的地址、模型和 API Key，即可流式对话。助手会带上当前页、相邻页、目录、你的划线和笔记；引用原文时标注页码，可点击跳转。
- **阅读灯光**：纸白 / 羊皮纸 / 夜读三种主题。
- **本地优先**：所有数据只存在浏览器；清空浏览器数据或换设备时需要重新放入 PDF。

## 预览

自动部署在 GitHub Pages：

**https://boboloveai.github.io/pagecat-preview/**

> 预览站点是静态站点。在线 AI 需要你在「书房设置」里填入自己的 API Key；不填也能使用本地速读。密钥只保存在你自己的浏览器 localStorage 中。

## 本地运行

要求 Node 22.13+ 或 24（项目在 Node 24 下开发）。

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # 产物在 dist/
pnpm preview    # 预览生产构建
```

首次打开会自动放入 6 本示例藏书（英文经典为 Project Gutenberg 公有领域节选，另有一本中文使用手册）。示例 PDF 与封面在首次打开时才按需下载，打开后会缓存在本机。

## AI 配置

1. 打开任意书 → 右上角设置（或在书架右上角打开设置）。
2. 选择 DeepSeek / OpenAI / 自定义，填写：
   - 接口地址：例如 `https://api.deepseek.com` 或 `https://api.openai.com/v1`
   - 模型：例如 `deepseek-chat` / `gpt-4o-mini`
   - API Key
3. 点击「测试连接」，保存后 AI 面板会显示当前模型。

接口必须是 OpenAI 兼容的 `POST {baseUrl}/chat/completions`，并允许浏览器跨域请求（CORS）。如果接口禁止浏览器直连，需要自建一个允许 CORS 的代理。密钥在浏览器 localStorage 中明文保存，请只在私人设备使用；PageCat 没有服务器，不会收到你的密钥或聊天内容。

## 快捷键

| 键 | 作用 |
| --- | --- |
| `←` / `→` | 上一页 / 下一页 |
| `+` / `-` / `0` | 放大 / 缩小 / 重置 |
| `N` | 打开笔记面板并聚焦输入框 |
| `A` | 打开 AI 助手 |
| `Esc` | 关闭浮层 / 移动端侧栏 |

## 技术栈与结构

- Vite 8 + React 19 + TypeScript
- pdf.js（pdfjs-dist）渲染 PDF 与文本层
- Zustand 管理书架、批注、对话、设置
- IndexedDB（idb）保存 PDF Blob、书籍元数据、划线、笔记、对话
- 无 UI 框架，全部使用手写 CSS 做书架 / 纸张 / 灯光质感
- AI 接口：浏览器内流式 SSE 解析

```
src/
  components/Shelf/    书架、书脊、取书动画、上传、详情
  components/Reader/   分页渲染、文本层、划线工具条、批注弹层、侧栏
  components/AI/       AI 对话面板
  lib/                 PDF、IndexedDB、选区几何、AI 本地速读 / 在线流式
  state/               Zustand stores
  pages/               书架页 / 阅读页
scripts/
  make-books.mjs       示例 PDF 与封面生成器（可复现）
  mock-ai.mjs          本地 OpenAI 兼容 mock，用于验证流式对话
  deploy-preview.sh    构建并部署到 GitHub Pages 预览仓库
```

## 示例藏书来源

示例书架中五本英文节选来自 [Project Gutenberg](https://www.gutenberg.org/) 的公有领域文本，排版、封面与中文使用手册由 PageCat 制作，仅用于阅读与功能演示：

- *The Great Gatsby* — F. Scott Fitzgerald（Project Gutenberg #64317 / Standard Ebooks）
- *Pride and Prejudice* — Jane Austen（#1342）
- *The Art of War* — Sun Tzu, Lionel Giles translation（#132）
- *Meditations* — Marcus Aurelius, George Long translation（#2680）
- *Alice’s Adventures in Wonderland* — Lewis Carroll（#11）

生成命令：

```bash
node scripts/make-books.mjs
```

> 需要 Playwright Chromium 与中文字体；生成文件已随仓库提交，日常开发无需重新生成。

## 部署

```bash
./scripts/deploy-preview.sh
# 或指定预览仓库
PREVIEW_REPO=your-name/your-preview ./scripts/deploy-preview.sh
```

脚本会构建、把 `dist/` 推送到预览仓库的 `gh-pages` 分支，并在需要时启用 GitHub Pages。

## 已知限制

- 在线 AI 依赖第三方接口与浏览器 CORS；无密钥时只有本地速读，不具备大模型的语义理解和生成能力。
- 书页按第一页比例占位；极少见的混合尺寸 PDF 在滚动到该页时会重新排版。
- 所有数据都是本地的，没有跨设备同步；清空浏览器站点数据会删除书架。
- 示例书为节选，用于展示功能；完整文本请前往 Project Gutenberg 阅读。
