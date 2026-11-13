import { createServer } from 'node:http';

const chunks = [
  '这是来自 **模拟 AI 接口** 的流式回答。\n\n',
  '你正在读的这一页，把「评判」与「希望」放在了一起：',
  '克制评判，并不是冷漠，而是给理解留出空间 [第 2 页]。\n\n',
  '可以从三个层次继续想：\n\n',
  '1. 叙述者为什么强调父亲的忠告？\n',
  '2. 「无限希望」与全书结尾的「逆流而上」如何呼应？\n',
  '3. 如果叙述者一开始就下判断，这个故事会失去什么？\n\n',
  '—— 这条回答由本地 mock 服务生成，用于验证流式对话与页码引用。',
];

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type, authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    });
    res.end();
    return;
  }
  if (req.method === 'POST' && req.url?.includes('/chat/completions')) {
    let body = '';
    for await (const chunk of req) body += chunk;
    const parsed = JSON.parse(body || '{}');
    if (!parsed.stream) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }));
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    for (const chunk of chunks) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
      await new Promise((r) => setTimeout(r, 120));
    }
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }
  res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
  res.end('not found');
});
server.listen(8787, '127.0.0.1', () => console.log('mock AI on http://127.0.0.1:8787'));
