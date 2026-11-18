import type { IncomingMessage, ServerResponse } from 'http';

interface AiRequestBody {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  systemPrompt?: string;
  userPrompt?: string;
  temperature?: number;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(
  req: IncomingMessage & { body?: unknown }
): Promise<AiRequestBody> {
  if (req.body && typeof req.body === 'object') {
    return req.body as AiRequestBody;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body) as AiRequestBody;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as AiRequestBody;
}

function resolveNvidiaModel(model: string): string {
  if (model.includes('/')) return model;
  if (/^deepseek/i.test(model)) return `deepseek-ai/${model}`;
  if (/^llama/i.test(model)) return `meta/${model}`;
  if (/^qwen/i.test(model)) return `qwen/${model}`;
  if (/^mistral/i.test(model)) return `mistralai/${model}`;
  if (/^gemma/i.test(model)) return `google/${model}`;
  if (/^glm/i.test(model)) return `z-ai/${model}`;
  if (/^kimi/i.test(model)) return `moonshotai/${model}`;
  if (/^minimax/i.test(model)) return `minimaxai/${model}`;
  if (/^nemotron/i.test(model)) return `nvidia/${model}`;
  return model;
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed. Use POST.' });
    return;
  }

  let body: AiRequestBody;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: 'Dữ liệu JSON gửi lên không hợp lệ.' });
    return;
  }

  const provider =
    typeof body.provider === 'string' ? body.provider.trim() : 'gemini';
  const rawApiKey =
    typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  const apiKey =
    rawApiKey ||
    (provider === 'gemini' ? (process.env.GEMINI_API_KEY || '').trim() : '');
  const model =
    typeof body.model === 'string' && body.model.trim()
      ? body.model.trim()
      : provider === 'openai'
      ? 'gpt-4.1'
      : provider === 'anthropic'
      ? 'claude-3-7-sonnet-latest'
      : provider === 'perplexity'
      ? 'sonar-reasoning-pro'
      : 'gemini-2.5-flash';
  const baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.trim() : '';
  const systemPrompt =
    typeof body.systemPrompt === 'string' ? body.systemPrompt : '';
  const userPrompt = typeof body.userPrompt === 'string' ? body.userPrompt : '';
  const temperature =
    typeof body.temperature === 'number'
      ? Math.max(0, Math.min(1.5, body.temperature))
      : 0.4;

  if (!apiKey) {
    sendJson(res, 400, {
      error:
        'Vui lòng nhập API Key của Chatbot trong phần Cài đặt AI trước khi chạy.',
    });
    return;
  }

  if (!userPrompt.trim()) {
    sendJson(res, 400, {
      error: 'Nội dung yêu cầu (prompt) không được để trống.',
    });
    return;
  }

  try {
    if (provider === 'gemini') {
      const cleanBase = (
        baseUrl || 'https://generativelanguage.googleapis.com/v1beta'
      ).replace(/\/+$/, '');
      const url = `${cleanBase}/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const payload: Record<string, unknown> = {
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature },
      };
      if (systemPrompt.trim()) {
        payload.systemInstruction = { parts: [{ text: systemPrompt }] };
      }

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!resp.ok) {
        const errObj = data.error as { message?: string } | undefined;
        sendJson(res, resp.status, {
          error:
            errObj?.message ||
            `Gemini API trả về lỗi HTTP ${resp.status}. Vui lòng kiểm tra API Key hoặc tên Model.`,
        });
        return;
      }
      const candidates = Array.isArray(data.candidates) ? data.candidates : [];
      const firstCandidate = candidates[0] as
        | { content?: { parts?: { text?: string }[] } }
        | undefined;
      const text = (firstCandidate?.content?.parts || [])
        .map((p) => p.text || '')
        .join('')
        .trim();

      sendJson(res, 200, { text, model, provider });
      return;
    }

    if (provider === 'anthropic') {
      const cleanBase = (baseUrl || 'https://api.anthropic.com/v1').replace(
        /\/+$/,
        ''
      );
      const url = cleanBase.endsWith('/messages')
        ? cleanBase
        : `${cleanBase}/messages`;

      const payload: Record<string, unknown> = {
        model,
        max_tokens: 8192,
        temperature,
        messages: [{ role: 'user', content: userPrompt }],
      };
      if (systemPrompt.trim()) {
        payload.system = systemPrompt;
      }

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!resp.ok) {
        const errObj = data.error as { message?: string } | undefined;
        sendJson(res, resp.status, {
          error:
            errObj?.message ||
            `Anthropic Claude API lỗi HTTP ${resp.status}. Vui lòng kiểm tra API Key hoặc Model.`,
        });
        return;
      }
      const contentArr = Array.isArray(data.content) ? data.content : [];
      const text = contentArr
        .map((block: { type?: string; text?: string }) =>
          block?.type === 'text' ? block.text || '' : ''
        )
        .join('')
        .trim();

      sendJson(res, 200, { text, model, provider });
      return;
    }

    // Perplexity, OpenAI, NVIDIA NIM, or Custom OpenAI-Compatible
    const defaultBaseByProvider =
      provider === 'perplexity'
        ? 'https://api.perplexity.ai'
        : 'https://api.openai.com/v1';
    const cleanBase = (baseUrl || defaultBaseByProvider)
      .replace(/\/+$/, '')
      .replace(/\/chat\/completions$/i, '');
    const url =
      provider === 'perplexity'
        ? `${cleanBase.replace(/\/v1$/i, '')}/chat/completions`
        : cleanBase.endsWith('/v1')
        ? `${cleanBase}/chat/completions`
        : `${cleanBase}/v1/chat/completions`;

    const isNvidiaNim = /integrate\.api\.nvidia\.com/i.test(cleanBase);
    const resolvedModel = isNvidiaNim ? resolveNvidiaModel(model) : model;

    const messages: { role: string; content: string }[] = [];
    if (systemPrompt.trim()) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userPrompt });

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages,
        temperature,
      }),
    });

    const rawText = await resp.text().catch(() => '');
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      // non-json
    }

    if (!resp.ok) {
      const errObj = data.error as { message?: string } | undefined;
      const detailMsg =
        errObj?.message ||
        (typeof data.detail === 'string' ? data.detail : '') ||
        (typeof data.title === 'string' ? data.title : '') ||
        rawText.trim().slice(0, 180);

      if (isNvidiaNim && (resp.status === 401 || resp.status === 403)) {
        sendJson(res, resp.status, {
          error: `NVIDIA NIM từ chối xác thực API Key (HTTP ${resp.status}: ${detailMsg}). Key hiện tại dài ${apiKey.length} ký tự (chuẩn NVIDIA NIM là 70 ký tự).`,
        });
        return;
      }

      if (isNvidiaNim && (resp.status === 404 || resp.status === 410)) {
        sendJson(res, resp.status, {
          error: `NVIDIA NIM báo Model "${resolvedModel}" không tồn tại hoặc đã ngừng hỗ trợ (HTTP ${resp.status}: ${detailMsg}). Hãy chọn nvidia/nemotron-3-ultra-550b-a55b.`,
        });
        return;
      }

      sendJson(res, resp.status, {
        error:
          detailMsg ||
          `API Chatbot (${provider}) trả về lỗi HTTP ${resp.status}.`,
      });
      return;
    }

    const choices = Array.isArray(data.choices) ? data.choices : [];
    const firstChoice = choices[0] as
      | {
          message?: {
            content?: string | Array<{ text?: string }>;
            reasoning_content?: string;
          };
          text?: string;
          finish_reason?: string;
        }
      | undefined;

    const rawContent = firstChoice?.message?.content;
    let text = (
      typeof rawContent === 'string'
        ? rawContent
        : Array.isArray(rawContent)
        ? rawContent.map((p) => p?.text || '').join('')
        : firstChoice?.text || ''
    ).trim();

    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    if (!text) {
      sendJson(res, 502, {
        error: `Model "${resolvedModel}" trả về nội dung rỗng (finish_reason: ${
          firstChoice?.finish_reason || 'không rõ'
        }). Hãy thử lại hoặc chọn nvidia/nemotron-3-ultra-550b-a55b.`,
      });
      return;
    }

    sendJson(res, 200, { text, model: resolvedModel, provider });
  } catch (err) {
    sendJson(res, 502, {
      error:
        err instanceof Error
          ? `Lỗi kết nối tới API Chatbot: ${err.message}`
          : 'Không thể kết nối tới máy chủ AI Chatbot.',
    });
  }
}
