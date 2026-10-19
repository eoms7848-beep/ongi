import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import type {
  ChatMessage,
  ChatSession,
  CounselorRole,
  MindPrescription,
  ModelMode,
  StorageInfo,
} from './src/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'conversations.json');

// Initialize server-side Gemini SDK
function getGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Role-specific System Instructions for the Parenting Comfort Chatbot
const ROLE_SYSTEM_INSTRUCTIONS: Record<CounselorRole, string> = {
  empathy: `당신은 '온기(Ongi)'라는 이름의 다정하고 깊이 있는 육아 심리·마음 위로 상담가입니다.
부모가 육아 중에 겪는 죄책감, 번아웃, 외로움, 불안, 분노를 판단하거나 가르치려 들지 않고 온전히 수용하고 공감해 주세요.

[대화 원칙]
1. 조언보다 먼저 부모의 감정을 있는 그대로 읽어주고 다독여 주세요. ("그 상황에서 화가 나고 지치셨던 건 너무나 자연스러운 마음이에요.")
2. '좋은 부모가 되어야 한다'는 압박감을 덜어주고, 완벽하지 않아도 충분히 사랑하고 있음을 일깨워 주세요.
3. 답변은 읽기 편안한 2~4개의 단락으로 구성하고, 마지막에는 부모의 마음을 가볍게 해주는 작은 질문이나 따뜻한 다독임 문장을 남겨주세요.
4. 한국어로 자연스럽고 온화한 경어체(~해요, ~하셨군요, ~랍니다)를 사용하세요.`,

  night: `당신은 '온기(Ongi)'의 '새벽 수유·야간 육아 당직 말벗'입니다.
모두가 잠든 고요한 밤이나 새벽에 깨어 아이를 돌보며 지쳐 있는 양육자에게 고요하고 따뜻한 등불 같은 말벗이 되어 주세요.

[대화 원칙]
1. 피곤하고 눈이 감기는 새벽 시간임을 배려하여, 너무 길거나 복잡한 설명 대신 시적이고 포근하며 다정한 호흡으로 이야기해 주세요.
2. "지금 이 시각에도 깨어 있는 부모님은 혼자가 아니에요"라는 연대감과 안도감을 전해 주세요.
3. 수유, 밤수 끊기, 통잠 못 자는 아기 때문에 막막해하는 마음을 어루만지고, 지금 당장 긴장을 풀 수 있는 가벼운 심호흡이나 어깨 이완을 권유해 주세요.`,

  development: `당신은 '온기(Ongi)'의 '아이 마음 & 발달 통역 멘토'입니다.
아이의 떼쓰기, 분리불안, 미운 네 살 행동, 수면 퇴행 등으로 지친 부모에게 "아이의 문제 행동 이면에 담긴 발달적 이유"를 따뜻하게 통역해 주세요.

[대화 원칙]
1. 먼저 부모가 겪은 고단함을 깊이 위로한 뒤, 아이의 행동을 발달심리학적 관점에서 알기 쉽게 설명해 주세요.
2. 부모가 죄책감을 느끼지 않도록 "부모님이 잘못 키워서가 아니라 아이의 뇌와 마음이 자라나는 자연스러운 과정"임을 강조하세요.
3. 당장 내일 시도해 볼 수 있는 현실적이고 부담 없는 대화법이나 대처법을 1~2가지만 부드럽게 제안하세요.`,

  partner: `당신은 '온기(Ongi)'의 '부부·양육 동반자 소통 코치'입니다.
육아 분담, 양육관 차이, 배우자의 무심함이나 말투 때문에 서운하고 외로운 양육자의 마음을 위로하고, 부부가 서로를 적으로 돌리지 않도록 돕는 역할을 합니다.

[대화 원칙]
1. 먼저 사용자의 서운함과 고립감을 충분히 공감하고 편이 되어 들어주세요.
2. 감정이 조금 가라앉을 수 있도록 도운 뒤, 배우자에게 비난 대신 나의 지침과 필요를 전달할 수 있는 '부드러운 나-전달법(I-message)' 대화 예시를 함께 만들어 주세요.`,
};

interface PersistedStore {
  sessions: ChatSession[];
  prescriptions: MindPrescription[];
  lastSavedAt: string;
}

// In-memory store backed by ./data/conversations.json
let memoryStore: PersistedStore = {
  sessions: [],
  prescriptions: [],
  lastSavedAt: new Date().toISOString(),
};

let storageMode: 'local-file-and-memory' | 'memory-only' = 'local-file-and-memory';
let lastFileSizeBytes = 0;
let writeQueue: Promise<void> = Promise.resolve();

function createInitialSeedData(): PersistedStore {
  const now = new Date().toISOString();
  const initialSession: ChatSession = {
    id: 'session-welcome',
    title: '아이에게 화를 내고 난 뒤 밀려오는 자책감',
    counselorRole: 'empathy',
    childStage: '24개월 · 두 돌 무렵',
    parentMood: '지침과 미안함',
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: 'msg-welcome-1',
        role: 'model',
        text: `오늘 하루도 아이의 작은 세상을 지키느라 정말 고생 많으셨어요.\n\n혹시 아이가 잠든 얼굴을 보며 '아까 조금만 더 참을걸' 하고 혼자 마음 졸이고 계신가요? 아니면 끝이 보이지 않는 육아 일상 속에서 내 자신이 지워지는 것 같아 막막하신가요?\n\n이곳에서는 좋은 부모가 되려고 애쓰지 않아도 괜찮아요. 지금 마음속에 있는 솔직한 이야기를 편하게 내려놓아 주세요.`,
        createdAt: now,
        bookmarked: true,
        modelUsed: 'gemini-3.8-flash',
      },
    ],
  };

  const initialPrescription: MindPrescription = {
    id: 'rx-welcome-1',
    parentMood: '자책감과 피로',
    energyLevel: 35,
    situationNote: '하루 종일 아이 뒤치다꺼리를 하다 저녁에 결국 큰소리를 냈어요.',
    warmLetter:
      '오늘 큰소리가 나왔던 건 사랑이 부족해서가 아니라, 당신의 마음 그릇에 담긴 에너지가 바닥까지 닳도록 최선을 다해 버텼다는 신호예요. 사과하고 다시 안아주는 것만으로도 아이는 부모의 사랑을 충분히 배웁니다.',
    microAction: '아이 방 문을 닫고 나온 뒤, 따뜻한 물 한 컵을 천천히 마시며 굳어 있는 승모근을 세 번 툭 내려놓으세요.',
    mantra: '나는 완벽한 부모가 아니라, 매일 다시 안아주는 충분히 따뜻한 부모입니다.',
    createdAt: now,
  };

  return {
    sessions: [initialSession],
    prescriptions: [initialPrescription],
    lastSavedAt: now,
  };
}

async function initStore(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      const raw = await fs.readFile(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as PersistedStore;
      if (parsed && Array.isArray(parsed.sessions)) {
        memoryStore = {
          sessions: parsed.sessions,
          prescriptions: Array.isArray(parsed.prescriptions) ? parsed.prescriptions : [],
          lastSavedAt: parsed.lastSavedAt || new Date().toISOString(),
        };
        const stat = await fs.stat(DATA_FILE);
        lastFileSizeBytes = stat.size;
        storageMode = 'local-file-and-memory';
        return;
      }
    } catch {
      // File doesn't exist yet or invalid JSON; initialize with seed data
    }

    memoryStore = createInitialSeedData();
    await persistStore();
  } catch (err) {
    console.warn('Could not write to local disk, falling back to memory-only store:', err);
    storageMode = 'memory-only';
    memoryStore = createInitialSeedData();
  }
}

async function persistStore(): Promise<void> {
  memoryStore.lastSavedAt = new Date().toISOString();
  const payload = JSON.stringify(memoryStore, null, 2);

  writeQueue = writeQueue.then(async () => {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const tempFile = `${DATA_FILE}.tmp`;
      await fs.writeFile(tempFile, payload, 'utf-8');
      await fs.rename(tempFile, DATA_FILE);
      lastFileSizeBytes = Buffer.byteLength(payload, 'utf-8');
      storageMode = 'local-file-and-memory';
    } catch (err) {
      console.warn('Failed to persist to local file, keeping in memory:', err);
      storageMode = 'memory-only';
      lastFileSizeBytes = Buffer.byteLength(payload, 'utf-8');
    }
  });

  return writeQueue;
}

function getStorageInfo(): StorageInfo {
  const totalMessages = memoryStore.sessions.reduce(
    (sum, s) => sum + s.messages.length,
    0
  );
  return {
    mode: storageMode,
    filePath: 'data/conversations.json',
    lastSavedAt: memoryStore.lastSavedAt,
    totalSessions: memoryStore.sessions.length,
    totalMessages,
    fileSizeBytes: lastFileSizeBytes,
  };
}

async function startServer() {
  await initStore();

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // 1. Get all sessions, prescriptions, and storage status
  app.get('/api/sessions', (_req, res) => {
    res.json({
      sessions: memoryStore.sessions,
      prescriptions: memoryStore.prescriptions,
      storage: getStorageInfo(),
    });
  });

  // 2. Create a new conversation session
  app.post('/api/sessions', async (req, res) => {
    try {
      const {
        title,
        counselorRole = 'empathy',
        childStage = '영유아기',
        parentMood = '위로가 필요한 날',
      } = req.body as {
        title?: string;
        counselorRole?: CounselorRole;
        childStage?: string;
        parentMood?: string;
      };

      const now = new Date().toISOString();
      const roleGreetingMap: Record<CounselorRole, string> = {
        empathy:
          '안녕하세요. 오늘 육아하며 어떤 순간이 가장 마음을 무겁게 했나요? 사소한 투정이나 복잡한 감정 모두 괜찮으니 편하게 들려주세요.',
        night:
          '고요한 밤이네요. 모두 잠든 시간에도 아이 곁을 지키고 계신 당신에게 따뜻한 차 한 잔 같은 말벗이 되어드릴게요. 지금 몸과 마음은 어떠신가요?',
        development:
          '아이의 행동을 이해하고 싶지만 마음처럼 되지 않아 답답하셨죠. 오늘 아이와 있었던 장면이나 고민되는 발달 단계를 편하게 이야기해 주세요.',
        partner:
          '가장 가까운 사람에게 이해받지 못할 때 육아는 배로 외로워지곤 합니다. 배우자나 가족에게 서운했던 마음, 이곳에 먼저 편히 털어놓으세요.',
      };

      const newSession: ChatSession = {
        id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: title?.trim() || '오늘의 육아 마음 기록',
        counselorRole,
        childStage: childStage.trim() || '영유아기',
        parentMood: parentMood.trim() || '위로가 필요한 날',
        createdAt: now,
        updatedAt: now,
        messages: [
          {
            id: `msg-${Date.now()}-init`,
            role: 'model',
            text: roleGreetingMap[counselorRole] || roleGreetingMap.empathy,
            createdAt: now,
            modelUsed: 'gemini-3.8-flash',
          },
        ],
      };

      memoryStore.sessions.unshift(newSession);
      await persistStore();

      res.status(201).json({
        session: newSession,
        storage: getStorageInfo(),
      });
    } catch (error) {
      console.error('Error creating session:', error);
      res.status(500).json({ error: '새 대화 세션을 생성하는 중 오류가 발생했습니다.' });
    }
  });

  // 3. Update session metadata (title, childStage, parentMood, counselorRole)
  app.patch('/api/sessions/:id', async (req, res) => {
    const session = memoryStore.sessions.find((s) => s.id === req.params.id);
    if (!session) {
      res.status(404).json({ error: '대화 세션을 찾을 수 없습니다.' });
      return;
    }

    const { title, counselorRole, childStage, parentMood } = req.body;
    if (typeof title === 'string' && title.trim()) session.title = title.trim();
    if (counselorRole) session.counselorRole = counselorRole;
    if (typeof childStage === 'string') session.childStage = childStage.trim();
    if (typeof parentMood === 'string') session.parentMood = parentMood.trim();
    session.updatedAt = new Date().toISOString();

    await persistStore();
    res.json({ session, storage: getStorageInfo() });
  });

  // 4. Delete a session
  app.delete('/api/sessions/:id', async (req, res) => {
    const idx = memoryStore.sessions.findIndex((s) => s.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: '삭제할 대화 세션을 찾을 수 없습니다.' });
      return;
    }

    memoryStore.sessions.splice(idx, 1);

    if (memoryStore.sessions.length === 0) {
      const seed = createInitialSeedData();
      memoryStore.sessions = seed.sessions;
    }

    await persistStore();
    res.json({
      sessions: memoryStore.sessions,
      storage: getStorageInfo(),
    });
  });

  // 5. Multi-turn chat message endpoint (saves user & model message to local file + memory)
  app.post('/api/sessions/:id/messages', async (req, res) => {
    try {
      const session = memoryStore.sessions.find((s) => s.id === req.params.id);
      if (!session) {
        res.status(404).json({ error: '대화 세션을 찾을 수 없습니다.' });
        return;
      }

      const { text, modelMode = 'deep' } = req.body as {
        text?: string;
        modelMode?: ModelMode;
      };

      if (!text || !text.trim()) {
        res.status(400).json({ error: '메시지 내용을 입력해 주세요.' });
        return;
      }

      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: 'user',
        text: text.trim(),
        createdAt: new Date().toISOString(),
      };

      session.messages.push(userMessage);

      // Auto-title the session on the first user message if it has a default title
      const userMessagesCount = session.messages.filter((m) => m.role === 'user').length;
      if (
        userMessagesCount === 1 &&
        (session.title === '오늘의 육아 마음 기록' || session.title === '새 마음 대화')
      ) {
        session.title =
          text.trim().length > 26 ? `${text.trim().slice(0, 26)}...` : text.trim();
      }

      // Build multi-turn conversation history for Gemini
      const conversationContents = session.messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));

      // Choose model based on mode: gemini-3.8-flash for deep counseling, gemini-3.1-flash-lite for fast comfort
      const selectedModel =
        modelMode === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-3.8-flash';

      const baseInstruction =
        ROLE_SYSTEM_INSTRUCTIONS[session.counselorRole] ||
        ROLE_SYSTEM_INSTRUCTIONS.empathy;

      const contextualSystemInstruction = `${baseInstruction}

[현재 양육자 상황 컨텍스트]
- 아이 연령/발달 단계: ${session.childStage || '미지정'}
- 현재 부모 마음 상태: ${session.parentMood || '미지정'}
- 응답 스타일: ${
        modelMode === 'fast'
          ? '지친 부모가 한눈에 읽고 바로 숨을 돌릴 수 있도록 핵심 위로와 다독임을 3~5문장 내외로 간결하고 따뜻하게 전해 주세요.'
          : '부모의 감정을 세심하게 짚어주고, 자책감을 덜어주는 심층적인 공감과 현실적인 마음 돌봄 제안을 2~4단락으로 정성껏 작성해 주세요.'
      }`;

      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: conversationContents,
        config: {
          systemInstruction: contextualSystemInstruction,
          temperature: 0.8,
        },
      });

      const replyText =
        response.text?.trim() ||
        '당신의 이야기를 조용히 듣고 있어요. 오늘 하루 정말 애쓰셨습니다. 잠시 숨을 고르고 다시 이야기 나누어요.';

      const modelMessage: ChatMessage = {
        id: `msg-${Date.now()}-model`,
        role: 'model',
        text: replyText,
        createdAt: new Date().toISOString(),
        bookmarked: false,
        modelUsed: selectedModel,
      };

      session.messages.push(modelMessage);
      session.updatedAt = modelMessage.createdAt;

      // Move active session to top of list
      memoryStore.sessions = [
        session,
        ...memoryStore.sessions.filter((s) => s.id !== session.id),
      ];

      await persistStore();

      res.json({
        userMessage,
        modelMessage,
        session,
        storage: getStorageInfo(),
      });
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      await persistStore();
      const status = error?.status || 500;
      const errMsg =
        error?.message ||
        'AI 상담가와 연결하는 중 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
      res.status(status >= 400 && status < 600 ? status : 500).json({
        error: errMsg,
        storage: getStorageInfo(),
      });
    }
  });

  // 6. Toggle bookmark on a comforting message
  app.post('/api/sessions/:id/messages/:messageId/bookmark', async (req, res) => {
    const session = memoryStore.sessions.find((s) => s.id === req.params.id);
    if (!session) {
      res.status(404).json({ error: '대화 세션을 찾을 수 없습니다.' });
      return;
    }

    const message = session.messages.find((m) => m.id === req.params.messageId);
    if (!message) {
      res.status(404).json({ error: '메시지를 찾을 수 없습니다.' });
      return;
    }

    message.bookmarked = !message.bookmarked;
    await persistStore();

    res.json({
      message,
      storage: getStorageInfo(),
    });
  });

  // 7. Generate a quick "오늘의 마음 처방전" using gemini-3.1-flash-lite and persist it
  app.post('/api/prescriptions', async (req, res) => {
    try {
      const {
        parentMood = '지치고 막막함',
        energyLevel = 30,
        situationNote = '',
      } = req.body as {
        parentMood?: string;
        energyLevel?: number;
        situationNote?: string;
      };

      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `양육자의 현재 감정: "${parentMood}", 남은 에너지 잔량: ${energyLevel}%, 상황 메모: "${
          situationNote || '오늘 하루 육아로 많이 지친 상태입니다.'
        }".
이 양육자를 위해 따뜻한 위로 편지(warmLetter), 지금 당장 1분 안에 할 수 있는 몸과 마음 이완 행동(microAction), 그리고 스스로에게 건네는 다정한 확언 한 줄(mantra)을 한국어로 작성해 주세요.`,
        config: {
          systemInstruction:
            '당신은 다정한 육아 심리 상담가입니다. 지친 양육자에게 죄책감을 덜어주고 즉각적인 위안을 주는 마음 처방전을 JSON 형식으로 작성합니다.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              warmLetter: {
                type: Type.STRING,
                description: '양육자의 감정을 보듬어주는 2~3문장의 다정한 위로 편지',
              },
              microAction: {
                type: Type.STRING,
                description: '지금 당장 1분 안에 실천할 수 있는 아주 작고 구체적인 휴식/이완 행동',
              },
              mantra: {
                type: Type.STRING,
                description: '자책감을 내려놓게 돕는 따뜻한 한 줄 자기 확언',
              },
            },
            required: ['warmLetter', 'microAction', 'mantra'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const newPrescription: MindPrescription = {
        id: `rx-${Date.now()}`,
        parentMood,
        energyLevel: Number(energyLevel) || 30,
        situationNote: situationNote.trim() || '오늘도 묵묵히 버텨낸 육아의 하루',
        warmLetter:
          parsed.warmLetter ||
          '오늘 하루도 아이를 위해 당신의 에너지를 아낌없이 나누어 주셨네요. 잠시 멈추어 숨을 골라도 괜찮습니다.',
        microAction:
          parsed.microAction ||
          '두 눈을 감고 네 박자 동안 숨을 들이마신 뒤, 여섯 박자 동안 길게 내쉬어 보세요.',
        mantra:
          parsed.mantra ||
          '오늘 내가 건넨 서툰 사랑도 아이에게는 온전한 온기로 전해집니다.',
        createdAt: new Date().toISOString(),
      };

      memoryStore.prescriptions.unshift(newPrescription);
      await persistStore();

      res.status(201).json({
        prescription: newPrescription,
        storage: getStorageInfo(),
      });
    } catch (error: any) {
      console.error('Prescription generation error:', error);
      res.status(500).json({
        error: '마음 처방전을 작성하는 중 오류가 발생했습니다.',
      });
    }
  });

  // Vite middleware in development, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ongi Parenting Comfort Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
