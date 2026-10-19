import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Check,
  Copy,
  Download,
  Edit3,
  Heart,
  MessageCircle,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ChatMessage,
  ChatSession,
  CounselorRole,
  MindPrescription,
  ModelMode,
  StorageInfo,
} from './types';

type ActiveTab = 'chat' | 'prescription' | 'bookmarks' | 'storage';

interface RoleOption {
  id: CounselorRole;
  name: string;
  subtitle: string;
  description: string;
  samplePrompts: string[];
}

const COUNSELOR_ROLES: RoleOption[] = [
  {
    id: 'empathy',
    name: '다정한 공감 상담가',
    subtitle: '자책감 · 번아웃 · 감정 수용',
    description:
      '좋은 부모가 되어야 한다는 무거운 압박감을 내려놓고, 지친 마음을 판단 없이 따뜻하게 안아드립니다.',
    samplePrompts: [
      '아이에게 또 큰소리를 내고 말았어요. 자는 얼굴을 보니 눈물이 나요.',
      '하루 종일 아이와 단둘이 있다 보니 제가 세상에서 지워진 기분이에요.',
      '다른 부모들은 다들 여유롭고 행복해 보이는데 왜 저만 이렇게 버거울까요?',
    ],
  },
  {
    id: 'night',
    name: '새벽 수유 · 야간 당직 말벗',
    subtitle: '새벽 고립감 · 수면 부족 위로',
    description:
      '모두가 잠든 밤 홀로 깨어 아이를 돌보는 시간, 조용하고 포근한 호흡으로 곁을 지키는 말벗이 되어드립니다.',
    samplePrompts: [
      '새벽 3시인데 아이가 깨서 도무지 다시 안 자요. 몸도 마음도 한계예요.',
      '캄캄한 방 안에서 수유하고 있으니 세상에 저 혼자만 남겨진 것 같아요.',
      '내일 아침이 오는 게 두려울 만큼 너무 피곤해요. 짧은 위로 한마디 해주세요.',
    ],
  },
  {
    id: 'development',
    name: '아이 마음 & 발달 통역 멘토',
    subtitle: '떼쓰기 · 분리불안 · 훈육 고민',
    description:
      '아이의 힘든 행동 이면에 숨어 있는 발달 과정을 알기 쉽게 통역하고, 현실적인 대처법을 함께 찾습니다.',
    samplePrompts: [
      '아이가 요즘 모든 일에 "싫어! 내가 할 거야!"라며 바닥에 드러누워 울어요.',
      '어린이집 등원할 때마다 떨어지지 않으려고 대성통곡해서 마음이 찢어져요.',
      '훈육을 하려고 하면 제가 먼저 감정이 격해져서 일관성을 지키기 어려워요.',
    ],
  },
  {
    id: 'partner',
    name: '부부 · 양육 동반자 소통 코치',
    subtitle: '육아 분담 · 양육관 갈등 조율',
    description:
      '배우자에게 쌓인 서운함을 먼저 다독이고, 서로 상처 주지 않으면서 내 필요를 전하는 대화법을 함께 만듭니다.',
    samplePrompts: [
      '배우자는 퇴근하고 와서 핸드폰만 보는데 서운해서 말도 꺼내기 싫어져요.',
      '아이 훈육 방식을 두고 배우자와 자꾸 의견이 부딪혀서 대화가 단절됐어요.',
      '"집에서 애 보면서 뭐가 힘들어?"라는 말에 가슴이 무너져 내렸어요.',
    ],
  },
];

const CHILD_STAGE_OPTIONS = [
  '신생아 ~ 100일',
  '4 ~ 12개월 영아기',
  '12 ~ 24개월 걸음마기',
  '24 ~ 36개월 두 돌 무렵',
  '4 ~ 7세 유아기',
  '초등 학령기',
  '다자녀 양육 중',
];

const PARENT_MOOD_OPTIONS = [
  '지침과 미안함',
  '번아웃과 무기력',
  '외로움과 고립감',
  '불안과 조급함',
  '서운함과 답답함',
  '조용한 위로가 필요함',
];

function formatKoreanTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

function formatKoreanDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [prescriptions, setPrescriptions] = useState<MindPrescription[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);

  // Chat compose states
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [modelMode, setModelMode] = useState<ModelMode>('deep');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Sidebar search & new session modal/inline state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);
  const [newRole, setNewRole] = useState<CounselorRole>('empathy');
  const [newChildStage, setNewChildStage] = useState<string>('24 ~ 36개월 두 돌 무렵');
  const [newParentMood, setNewParentMood] = useState<string>('지침과 미안함');
  const [newTitle, setNewTitle] = useState<string>('');

  // Editing session title inline
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState<string>('');

  // Prescription generator form state
  const [rxMood, setRxMood] = useState<string>('자책감과 피로');
  const [rxEnergy, setRxEnergy] = useState<number>(30);
  const [rxNote, setRxNote] = useState<string>('');
  const [isGeneratingRx, setIsGeneratingRx] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || sessions[0] || null,
    [sessions, activeSessionId]
  );

  const activeRoleMeta = useMemo(
    () =>
      COUNSELOR_ROLES.find((r) => r.id === (activeSession?.counselorRole || 'empathy')) ||
      COUNSELOR_ROLES[0],
    [activeSession]
  );

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.childStage.toLowerCase().includes(q) ||
        s.parentMood.toLowerCase().includes(q) ||
        s.messages.some((m) => m.text.toLowerCase().includes(q))
    );
  }, [sessions, searchQuery]);

  const bookmarkedItems = useMemo(() => {
    const items: Array<{
      sessionId: string;
      sessionTitle: string;
      counselorRole: CounselorRole;
      message: ChatMessage;
    }> = [];
    for (const s of sessions) {
      for (const m of s.messages) {
        if (m.bookmarked) {
          items.push({
            sessionId: s.id,
            sessionTitle: s.title,
            counselorRole: s.counselorRole,
            message: m,
          });
        }
      }
    }
    return items.sort(
      (a, b) =>
        new Date(b.message.createdAt).getTime() - new Date(a.message.createdAt).getTime()
    );
  }, [sessions]);

  // Fetch initial data from Express backend
  useEffect(() => {
    async function loadInitialData() {
      try {
        setIsLoadingInitial(true);
        const res = await fetch('/api/sessions');
        if (!res.ok) throw new Error('서버에서 대화 목록을 불러오지 못했습니다.');
        const data = await res.json();
        setSessions(data.sessions || []);
        setPrescriptions(data.prescriptions || []);
        setStorageInfo(data.storage || null);
        if (data.sessions?.length > 0) {
          setActiveSessionId(data.sessions[0].id);
        }
      } catch (err: any) {
        setErrorBanner(err.message || '데이터 로드 중 오류가 발생했습니다.');
      } finally {
        setIsLoadingInitial(false);
      }
    }
    loadInitialData();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeSession?.messages.length, isSending, activeTab]);

  async function handleCreateSession(e?: React.FormEvent) {
    if (e) e.preventDefault();
    try {
      setErrorBanner(null);
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim() || '오늘의 육아 마음 기록',
          counselorRole: newRole,
          childStage: newChildStage,
          parentMood: newParentMood,
        }),
      });
      if (!res.ok) throw new Error('새 대화방을 만들지 못했습니다.');
      const data = await res.json();
      setSessions((prev) => [data.session, ...prev]);
      setStorageInfo(data.storage);
      setActiveSessionId(data.session.id);
      setIsCreatingSession(false);
      setNewTitle('');
      setActiveTab('chat');
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  }

  async function handleUpdateSessionContext(
    sessionId: string,
    updates: Partial<Pick<ChatSession, 'title' | 'counselorRole' | 'childStage' | 'parentMood'>>
  ) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('대화 설정을 변경하지 못했습니다.');
      const data = await res.json();
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? data.session : s)));
      setStorageInfo(data.storage);
      setEditingTitleId(null);
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  }

  async function handleDeleteSession(sessionId: string) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('대화 삭제에 실패했습니다.');
      const data = await res.json();
      setSessions(data.sessions);
      setStorageInfo(data.storage);
      if (activeSessionId === sessionId && data.sessions.length > 0) {
        setActiveSessionId(data.sessions[0].id);
      }
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  }

  async function handleSendMessage(customPrompt?: string) {
    if (!activeSession || isSending) return;
    const textToSend = (customPrompt !== undefined ? customPrompt : inputMessage).trim();
    if (!textToSend) return;

    setErrorBanner(null);
    setIsSending(true);
    if (customPrompt === undefined) {
      setInputMessage('');
    }

    // Optimistic user message display
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      text: textToSend,
      createdAt: new Date().toISOString(),
    };

    const targetSessionId = activeSession.id;
    setSessions((prev) =>
      prev.map((s) =>
        s.id === targetSessionId ? { ...s, messages: [...s.messages, tempUserMsg] } : s
      )
    );

    try {
      const res = await fetch(`/api/sessions/${targetSessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToSend,
          modelMode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '답변을 받아오는 중 문제가 발생했습니다.');
      }

      setSessions((prev) => {
        const others = prev.filter((s) => s.id !== targetSessionId);
        return [data.session, ...others];
      });
      setStorageInfo(data.storage);
    } catch (err: any) {
      setErrorBanner(err.message || '서버 통신 오류가 발생했습니다.');
      // Revert optimistic message if failed
      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? { ...s, messages: s.messages.filter((m) => m.id !== tempUserMsg.id) }
            : s
        )
      );
    } finally {
      setIsSending(false);
    }
  }

  async function handleToggleBookmark(sessionId: string, messageId: string) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/messages/${messageId}/bookmark`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('책갈피 상태를 변경하지 못했습니다.');
      const data = await res.json();
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                messages: s.messages.map((m) => (m.id === messageId ? data.message : m)),
              }
            : s
        )
      );
      setStorageInfo(data.storage);
    } catch (err: any) {
      setErrorBanner(err.message);
    }
  }

  async function handleGeneratePrescription(e: React.FormEvent) {
    e.preventDefault();
    if (isGeneratingRx) return;
    setIsGeneratingRx(true);
    setErrorBanner(null);

    try {
      const res = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentMood: rxMood,
          energyLevel: rxEnergy,
          situationNote: rxNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '처방전 생성에 실패했습니다.');
      setPrescriptions((prev) => [data.prescription, ...prev]);
      setStorageInfo(data.storage);
      setRxNote('');
    } catch (err: any) {
      setErrorBanner(err.message);
    } finally {
      setIsGeneratingRx(false);
    }
  }

  function handleCopyText(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => {
      setCopiedMessageId((prev) => (prev === id ? null : prev));
    }, 1800);
  }

  function handleExportJSON() {
    const payload = {
      exportedAt: new Date().toISOString(),
      storage: storageInfo,
      sessions,
      prescriptions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ongi-parenting-conversations-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] text-[#1C1917]">
      {/* Top Bar Contract: Zone 1 (Single Brand Wordmark) — Zone 2 (Clean Text Nav Links) — Zone 3 (Primary Action) */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-[#FBF9F5]/95 backdrop-blur-sm border-b border-[#E7E5E4]">
        <a
          href="#chat"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('chat');
          }}
          className="text-xl font-bold tracking-tight text-[#1C1917] font-serif-kr whitespace-nowrap"
        >
          온기 · 육아 마음 쉼터
        </a>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#57534E]">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
              activeTab === 'chat'
                ? 'border-[#2F5D50] text-[#1C1917] font-semibold'
                : 'border-transparent hover:text-[#1C1917]'
            }`}
          >
            마음 대화실
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('prescription')}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
              activeTab === 'prescription'
                ? 'border-[#2F5D50] text-[#1C1917] font-semibold'
                : 'border-transparent hover:text-[#1C1917]'
            }`}
          >
            오늘의 마음 처방
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bookmarks')}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
              activeTab === 'bookmarks'
                ? 'border-[#2F5D50] text-[#1C1917] font-semibold'
                : 'border-transparent hover:text-[#1C1917]'
            }`}
          >
            위로 책갈피 ({bookmarkedItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('storage')}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
              activeTab === 'storage'
                ? 'border-[#2F5D50] text-[#1C1917] font-semibold'
                : 'border-transparent hover:text-[#1C1917]'
            }`}
          >
            저장소 관리
          </button>
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setActiveTab('chat');
              setIsCreatingSession(true);
            }}
            className="px-4 py-2 text-xs font-medium text-white bg-[#2F5D50] rounded-lg hover:bg-[#24493E] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            새 마음 대화
          </button>
        </div>
      </header>

      {/* Mobile Tab Switcher */}
      <div className="flex md:hidden items-center justify-around border-b border-[#E7E5E4] bg-[#F5F2EB] px-2 py-2 text-xs font-medium text-[#57534E]">
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`px-3 py-1.5 rounded-md whitespace-nowrap ${
            activeTab === 'chat' ? 'bg-white text-[#1C1917] shadow-xs font-semibold' : ''
          }`}
        >
          마음 대화실
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('prescription')}
          className={`px-3 py-1.5 rounded-md whitespace-nowrap ${
            activeTab === 'prescription'
              ? 'bg-white text-[#1C1917] shadow-xs font-semibold'
              : ''
          }`}
        >
          마음 처방
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bookmarks')}
          className={`px-3 py-1.5 rounded-md whitespace-nowrap ${
            activeTab === 'bookmarks'
              ? 'bg-white text-[#1C1917] shadow-xs font-semibold'
              : ''
          }`}
        >
          책갈피 ({bookmarkedItems.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('storage')}
          className={`px-3 py-1.5 rounded-md whitespace-nowrap ${
            activeTab === 'storage' ? 'bg-white text-[#1C1917] shadow-xs font-semibold' : ''
          }`}
        >
          저장소
        </button>
      </div>

      {/* Global Error Notice */}
      {errorBanner && (
        <div className="bg-[#FEF2F2] border-b border-[#FECACA] px-6 py-3 flex items-center justify-between text-xs text-[#991B1B]">
          <span>오류 안내: {errorBanner}</span>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-[#991B1B] hover:underline font-medium ml-4 whitespace-nowrap"
          >
            닫기
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col lg:flex-row max-w-[1440px] w-full mx-auto">
          {/* Left Sidebar: Saved Conversation Threads & Role Info */}
          <aside className="w-full lg:w-[320px] shrink-0 border-b lg:border-b-0 lg:border-r border-[#E7E5E4] bg-[#F5F2EB]/60 flex flex-col">
            <div className="p-5 border-b border-[#E7E5E4]">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-[#1C1917]">보관된 마음 대화</h2>
                <span className="text-xs text-[#78716C] tabular-nums">
                  총 {sessions.length}건 · 자동 저장
                </span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="대화 제목이나 감정 검색..."
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-[#E7E5E4] rounded-lg text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#2F5D50]"
                />
              </div>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#E7E5E4] max-h-[260px] lg:max-h-[calc(100vh-220px)]">
              {isLoadingInitial ? (
                <div className="p-5 space-y-3">
                  <div className="h-14 bg-[#E7E5E4]/50 rounded-lg animate-pulse" />
                  <div className="h-14 bg-[#E7E5E4]/50 rounded-lg animate-pulse" />
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#78716C]">
                  검색어와 일치하는 대화가 없습니다.
                </div>
              ) : (
                filteredSessions.map((session) => {
                  const isSelected = session.id === activeSession?.id;
                  const roleName =
                    COUNSELOR_ROLES.find((r) => r.id === session.counselorRole)?.name ||
                    '공감 상담가';
                  const lastMsg = session.messages[session.messages.length - 1];

                  return (
                    <div
                      key={session.id}
                      onClick={() => setActiveSessionId(session.id)}
                      className={`p-4 cursor-pointer transition-colors group ${
                        isSelected
                          ? 'bg-white border-l-4 border-l-[#2F5D50]'
                          : 'hover:bg-white/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {editingTitleId === session.id ? (
                          <div
                            className="flex items-center gap-1 flex-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={editingTitleValue}
                              onChange={(e) => setEditingTitleValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateSessionContext(session.id, {
                                    title: editingTitleValue,
                                  });
                                } else if (e.key === 'Escape') {
                                  setEditingTitleId(null);
                                }
                              }}
                              className="w-full px-2 py-1 text-xs border border-[#2F5D50] rounded bg-white"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateSessionContext(session.id, {
                                  title: editingTitleValue,
                                })
                              }
                              className="p-1 text-[#2F5D50] hover:bg-[#F5F2EB] rounded"
                              title="제목 저장"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <h3 className="text-sm font-semibold text-[#1C1917] line-clamp-1">
                            {session.title}
                          </h3>
                        )}

                        <div
                          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTitleId(session.id);
                              setEditingTitleValue(session.title);
                            }}
                            className="p-1 text-[#78716C] hover:text-[#1C1917] rounded"
                            title="제목 수정"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSession(session.id)}
                            className="p-1 text-[#78716C] hover:text-[#B91C1C] rounded"
                            title="대화 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Zero-Pill Metadata Discipline: Unboxed text with typographic separators */}
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-[#78716C] truncate">
                        <span>{roleName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{session.childStage}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{session.messages.length}개의 대화</span>
                      </div>

                      {lastMsg && (
                        <p className="mt-2 text-xs text-[#57534E] line-clamp-2 leading-relaxed">
                          {lastMsg.text}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Storage Assurance */}
            {storageInfo && (
              <div className="p-4 border-t border-[#E7E5E4] bg-[#F5F2EB] text-xs text-[#57534E]">
                <div className="flex items-center justify-between">
                  <span>백엔드 보관소</span>
                  <span className="font-mono text-[11px] text-[#2F5D50] tabular-nums">
                    {storageInfo.filePath}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#78716C]">
                  <span>
                    {storageInfo.mode === 'local-file-and-memory'
                      ? '로컬 파일 + 메모리 이중 저장'
                      : '서버 메모리 안전 저장'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    최근 {formatKoreanTime(storageInfo.lastSavedAt)}
                  </span>
                </div>
              </div>
            )}
          </aside>

          {/* Main Multi-Turn Chat Viewport */}
          <main className="flex-1 flex flex-col min-w-0 bg-[#FBF9F5]">
            {/* New Session Drawer / Panel when triggered */}
            {isCreatingSession && (
              <div className="border-b border-[#E7E5E4] bg-white p-6">
                <div className="max-w-3xl mx-auto">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-[#1C1917] font-serif-kr">
                        새로운 마음 대화 시작하기
                      </h2>
                      <p className="text-xs text-[#57534E] mt-0.5">
                        지금 나의 상황과 가장 잘 맞는 상담가 역할과 아이 연령대를 선택해 주세요.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCreatingSession(false)}
                      className="p-1.5 text-[#78716C] hover:text-[#1C1917] rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleCreateSession} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {COUNSELOR_ROLES.map((role) => {
                        const selected = newRole === role.id;
                        return (
                          <button
                            key={role.id}
                            type="button"
                            onClick={() => setNewRole(role.id)}
                            className={`text-left p-4 rounded-xl border transition-all ${
                              selected
                                ? 'border-[#2F5D50] bg-[#2F5D50]/5'
                                : 'border-[#E7E5E4] bg-[#FBF9F5] hover:border-[#A8A29E]'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-[#1C1917]">
                                {role.name}
                              </span>
                              {selected && (
                                <span className="text-xs font-medium text-[#2F5D50]">
                                  선택됨
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#78716C] mt-0.5">{role.subtitle}</p>
                            <p className="text-xs text-[#57534E] mt-2 leading-relaxed">
                              {role.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div>
                        <label className="block text-xs font-medium text-[#57534E] mb-1">
                          아이 연령 / 발달 단계
                        </label>
                        <select
                          value={newChildStage}
                          onChange={(e) => setNewChildStage(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-[#E7E5E4] rounded-lg text-[#1C1917] focus:outline-none focus:border-[#2F5D50]"
                        >
                          {CHILD_STAGE_OPTIONS.map((stage) => (
                            <option key={stage} value={stage}>
                              {stage}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#57534E] mb-1">
                          지금 나의 주된 감정
                        </label>
                        <select
                          value={newParentMood}
                          onChange={(e) => setNewParentMood(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-[#E7E5E4] rounded-lg text-[#1C1917] focus:outline-none focus:border-[#2F5D50]"
                        >
                          {PARENT_MOOD_OPTIONS.map((mood) => (
                            <option key={mood} value={mood}>
                              {mood}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#57534E] mb-1">
                          대화방 이름 (선택)
                        </label>
                        <input
                          type="text"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="예: 오늘 저녁 아이에게 미안했던 일"
                          className="w-full px-3 py-2 text-xs bg-white border border-[#E7E5E4] rounded-lg text-[#1C1917] focus:outline-none focus:border-[#2F5D50]"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsCreatingSession(false)}
                        className="px-4 py-2 text-xs font-medium text-[#57534E] hover:text-[#1C1917]"
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 text-xs font-medium text-white bg-[#2F5D50] rounded-lg hover:bg-[#24493E] transition-colors"
                      >
                        이 상담가와 대화 시작하기
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Active Session Header & Context Controls */}
            {activeSession && (
              <div className="px-6 py-4 border-b border-[#E7E5E4] bg-white/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-lg font-bold text-[#1C1917] font-serif-kr text-balance">
                    {activeSession.title}
                  </h1>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#57534E]">
                    <span className="font-medium text-[#2F5D50]">{activeRoleMeta.name}</span>
                    <span aria-hidden="true">·</span>
                    <span>{activeRoleMeta.subtitle}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      대화 {activeSession.messages.length}턴 진행 중
                    </span>
                  </div>
                </div>

                {/* Live Context Selectors (Counselor Role, Child Stage, Parent Mood) */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="상담가 역할 변경"
                    value={activeSession.counselorRole}
                    onChange={(e) =>
                      handleUpdateSessionContext(activeSession.id, {
                        counselorRole: e.target.value as CounselorRole,
                      })
                    }
                    className="px-3 py-1.5 text-xs bg-white border border-[#E7E5E4] rounded-lg text-[#1C1917] focus:outline-none focus:border-[#2F5D50]"
                  >
                    {COUNSELOR_ROLES.map((r) => (
                      <option key={r.id} value={r.id}>
                        역할: {r.name}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="아이 연령대 변경"
                    value={activeSession.childStage}
                    onChange={(e) =>
                      handleUpdateSessionContext(activeSession.id, {
                        childStage: e.target.value,
                      })
                    }
                    className="px-3 py-1.5 text-xs bg-white border border-[#E7E5E4] rounded-lg text-[#1C1917] focus:outline-none focus:border-[#2F5D50]"
                  >
                    {CHILD_STAGE_OPTIONS.map((stage) => (
                      <option key={stage} value={stage}>
                        아이: {stage}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="부모 감정 상태 변경"
                    value={activeSession.parentMood}
                    onChange={(e) =>
                      handleUpdateSessionContext(activeSession.id, {
                        parentMood: e.target.value,
                      })
                    }
                    className="px-3 py-1.5 text-xs bg-white border border-[#E7E5E4] rounded-lg text-[#1C1917] focus:outline-none focus:border-[#2F5D50]"
                  >
                    {PARENT_MOOD_OPTIONS.map((mood) => (
                      <option key={mood} value={mood}>
                        마음: {mood}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Scrollable Multi-Turn Conversation Thread */}
            <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 max-h-[calc(100vh-310px)] min-h-[380px]">
              <div className="max-w-3xl mx-auto space-y-6">
                {/* Role Intro Banner */}
                <div className="p-4 rounded-xl bg-[#F5F2EB] border border-[#E7E5E4] text-xs text-[#57534E] leading-relaxed">
                  <div className="font-semibold text-[#1C1917] mb-1">
                    {activeRoleMeta.name}의 다짐
                  </div>
                  <p>{activeRoleMeta.description}</p>
                </div>

                {/* Messages */}
                {activeSession?.messages.map((msg) => {
                  const isModel = msg.role === 'model';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isModel ? 'items-start' : 'items-end'}`}
                    >
                      <div className="flex items-center gap-2 mb-1.5 px-1 text-xs text-[#78716C]">
                        <span className="font-medium text-[#57534E]">
                          {isModel ? activeRoleMeta.name : '나의 이야기'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{formatKoreanTime(msg.createdAt)}</span>
                        {isModel && msg.modelUsed && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono text-[11px] text-[#78716C]">
                              {msg.modelUsed === 'gemini-3.1-flash-lite'
                                ? '빠른 다독임'
                                : '깊은 공감'}
                            </span>
                          </>
                        )}
                      </div>

                      <div
                        className={`max-w-2xl rounded-2xl px-5 py-4 text-[15px] leading-[1.7] whitespace-pre-wrap ${
                          isModel
                            ? 'bg-white border border-[#E7E5E4] text-[#1C1917]'
                            : 'bg-[#2F5D50] text-white'
                        }`}
                      >
                        {msg.text}
                      </div>

                      {/* Actions on Counselor Message */}
                      {isModel && (
                        <div className="mt-1.5 px-1 flex items-center gap-4 text-xs text-[#78716C]">
                          <button
                            type="button"
                            onClick={() => handleToggleBookmark(activeSession.id, msg.id)}
                            className={`flex items-center gap-1 transition-colors ${
                              msg.bookmarked
                                ? 'text-[#2F5D50] font-semibold'
                                : 'hover:text-[#1C1917]'
                            }`}
                          >
                            <Bookmark
                              className={`w-3.5 h-3.5 ${
                                msg.bookmarked ? 'fill-[#2F5D50]' : ''
                              }`}
                            />
                            <span>{msg.bookmarked ? '책갈피에 보관됨' : '위로 책갈피에 담기'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyText(msg.id, msg.text)}
                            className="flex items-center gap-1 hover:text-[#1C1917] transition-colors"
                          >
                            {copiedMessageId === msg.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[#2F5D50]" />
                                <span className="text-[#2F5D50]">복사됨</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>문장 복사</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Pending response indicator */}
                {isSending && (
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-2 mb-1.5 px-1 text-xs text-[#78716C]">
                      <span className="font-medium text-[#57534E]">{activeRoleMeta.name}</span>
                      <span aria-hidden="true">·</span>
                      <span>마음을 담아 답장을 적고 있어요...</span>
                    </div>
                    <div className="max-w-xl w-full rounded-2xl px-5 py-4 bg-white border border-[#E7E5E4] space-y-2.5">
                      <div className="h-4 bg-[#E7E5E4]/70 rounded w-3/4 animate-pulse" />
                      <div className="h-4 bg-[#E7E5E4]/70 rounded w-full animate-pulse" />
                      <div className="h-4 bg-[#E7E5E4]/70 rounded w-2/3 animate-pulse" />
                    </div>
                  </div>
                )}

                {/* Sample Starter Prompts for Quick Multi-Turn Interaction */}
                {activeSession && activeSession.messages.length <= 2 && !isSending && (
                  <div className="pt-4 border-t border-[#E7E5E4]/80">
                    <p className="text-xs font-medium text-[#78716C] mb-2.5">
                      긴 글을 적기 힘들다면 아래 마음 문장을 눌러 대화를 시작해 보세요:
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      {activeRoleMeta.samplePrompts.map((prompt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendMessage(prompt)}
                          className="text-left px-4 py-3 rounded-xl bg-white border border-[#E7E5E4] hover:border-[#2F5D50] text-xs text-[#1C1917] transition-colors flex items-center justify-between group"
                        >
                          <span>"{prompt}"</span>
                          <span className="text-[#2F5D50] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ml-3 font-medium">
                            전송하기 →
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Bottom Compose Area */}
            <div className="p-4 sm:p-6 border-t border-[#E7E5E4] bg-white">
              <div className="max-w-3xl mx-auto">
                {/* Interactive Segmented Control for Gemini Model Depth */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1 p-1 bg-[#F5F2EB] rounded-lg">
                    <button
                      type="button"
                      onClick={() => setModelMode('deep')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        modelMode === 'deep'
                          ? 'bg-white text-[#1C1917] shadow-xs'
                          : 'text-[#57534E] hover:text-[#1C1917]'
                      }`}
                    >
                      깊은 공감 상담 (Gemini Flash)
                    </button>
                    <button
                      type="button"
                      onClick={() => setModelMode('fast')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        modelMode === 'fast'
                          ? 'bg-white text-[#1C1917] shadow-xs'
                          : 'text-[#57534E] hover:text-[#1C1917]'
                      }`}
                    >
                      빠른 한 줄 다독임 (Flash Lite)
                    </button>
                  </div>

                  <span className="text-xs text-[#78716C]">
                    모든 대화는 백엔드 서버를 통해 안전하게 기록됩니다
                  </span>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-end gap-3"
                >
                  <textarea
                    ref={textareaRef}
                    rows={2}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="오늘 아이와 있었던 일, 누구에게도 말 못 한 솔직한 감정을 편하게 적어주세요... (Enter로 전송, Shift+Enter 줄바꿈)"
                    className="flex-1 resize-none rounded-xl border border-[#E7E5E4] bg-[#FBF9F5] px-4 py-3 text-sm text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#2F5D50] focus:bg-white transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !inputMessage.trim()}
                    className="px-5 py-3.5 rounded-xl bg-[#2F5D50] text-white text-sm font-medium hover:bg-[#24493E] disabled:opacity-40 disabled:pointer-events-none transition-colors shrink-0 flex items-center gap-2 whitespace-nowrap"
                  >
                    <Send className="w-4 h-4" />
                    <span>마음 보내기</span>
                  </button>
                </form>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* Tab 2: Mind Prescription (오늘의 마음 처방) */}
      {activeTab === 'prescription' && (
        <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-10">
          <div className="max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1C1917] font-serif-kr text-balance">
              오늘의 육아 마음 처방전
            </h1>
            <p className="mt-2 text-sm text-[#57534E] leading-relaxed">
              긴 대화를 나눌 기력조차 남아 있지 않은 날에는, 지금의 감정과 남은 에너지만
              체크해 보세요. 1분 안에 읽고 숨을 돌릴 수 있는 맞춤형 마음 처방을 발행해 드립니다.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Form */}
            <form
              onSubmit={handleGeneratePrescription}
              className="lg:col-span-5 bg-white border border-[#E7E5E4] rounded-2xl p-6 space-y-5"
            >
              <h2 className="text-base font-bold text-[#1C1917] font-serif-kr">
                나의 마음 상태 기록하기
              </h2>

              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-2">
                  지금 가장 크게 느껴지는 감정
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    '자책감과 피로',
                    '번아웃과 무기력',
                    '홀로 남겨진 고립감',
                    '이유 모를 눈물',
                    '분노와 답답함',
                    '불안과 걱정',
                  ].map((mood) => (
                    <button
                      key={mood}
                      type="button"
                      onClick={() => setRxMood(mood)}
                      className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-colors whitespace-nowrap truncate ${
                        rxMood === mood
                          ? 'border-[#2F5D50] bg-[#2F5D50]/10 text-[#2F5D50]'
                          : 'border-[#E7E5E4] bg-[#FBF9F5] text-[#57534E] hover:text-[#1C1917]'
                      }`}
                    >
                      {mood}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-medium text-[#57534E] mb-2">
                  <span>현재 남아 있는 마음 배터리</span>
                  <span className="font-mono font-semibold text-[#2F5D50] tabular-nums">
                    {rxEnergy}%
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={rxEnergy}
                  onChange={(e) => setRxEnergy(Number(e.target.value))}
                  className="w-full accent-[#2F5D50]"
                />
                <div className="flex justify-between text-[11px] text-[#78716C] mt-1 tabular-nums">
                  <span>5% (방전 직전)</span>
                  <span>50% (그럭저럭 버팀)</span>
                  <span>100% (충분함)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#57534E] mb-1.5">
                  짧은 상황 메모 (선택)
                </label>
                <textarea
                  rows={3}
                  value={rxNote}
                  onChange={(e) => setRxNote(e.target.value)}
                  placeholder="예: 아기가 낮잠을 안 자서 종일 안고 있었더니 손목도 시큰거리고 마음도 지쳐요."
                  className="w-full rounded-xl border border-[#E7E5E4] bg-[#FBF9F5] px-3.5 py-2.5 text-xs text-[#1C1917] focus:outline-none focus:border-[#2F5D50]"
                />
              </div>

              <button
                type="submit"
                disabled={isGeneratingRx}
                className="w-full py-3 px-4 rounded-xl bg-[#2F5D50] text-white text-xs font-semibold hover:bg-[#24493E] disabled:opacity-50 transition-colors"
              >
                {isGeneratingRx
                  ? '따뜻한 마음 처방전을 조제하고 있어요...'
                  : '나를 위한 마음 처방전 받기'}
              </button>
            </form>

            {/* Right Prescription Cards List */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#1C1917] font-serif-kr">
                  발행된 마음 처방 보관함
                </h2>
                <span className="text-xs text-[#78716C] tabular-nums">
                  총 {prescriptions.length}건 보관됨
                </span>
              </div>

              {prescriptions.map((rx) => (
                <article
                  key={rx.id}
                  className="bg-white border border-[#E7E5E4] rounded-2xl p-6 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7E5E4] pb-3 text-xs text-[#78716C]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#1C1917]">{rx.parentMood}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">마음 배터리 {rx.energyLevel}%</span>
                    </div>
                    <span className="tabular-nums">{formatKoreanDate(rx.createdAt)}</span>
                  </div>

                  {rx.situationNote && (
                    <p className="text-xs text-[#57534E] italic">"{rx.situationNote}"</p>
                  )}

                  <div className="space-y-3 pt-1">
                    <div>
                      <div className="text-xs font-semibold text-[#2F5D50] mb-1">
                        01. 다정한 위로 편지
                      </div>
                      <p className="text-sm text-[#1C1917] leading-relaxed">{rx.warmLetter}</p>
                    </div>

                    <div className="pt-2 border-t border-[#F5F2EB]">
                      <div className="text-xs font-semibold text-[#2F5D50] mb-1">
                        02. 지금 당장 1분 마음 이완 처방
                      </div>
                      <p className="text-sm text-[#1C1917] leading-relaxed">{rx.microAction}</p>
                    </div>

                    <div className="pt-2 border-t border-[#F5F2EB]">
                      <div className="text-xs font-semibold text-[#2F5D50] mb-1">
                        03. 오늘의 자기 확언
                      </div>
                      <p className="text-sm font-serif-kr font-bold text-[#1C1917]">
                        “{rx.mantra}”
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Bookmarked Comfort Messages (위로 책갈피) */}
      {activeTab === 'bookmarks' && (
        <div className="flex-1 max-w-4xl w-full mx-auto px-6 py-10 space-y-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1C1917] font-serif-kr text-balance">
              나의 위로 책갈피
            </h1>
            <p className="mt-2 text-sm text-[#57534E]">
              상담가와 나눈 대화 중 마음에 울림을 주었던 문장들을 모아두고, 유난히 지치는 날
              다시 꺼내어 읽어보세요.
            </p>
          </div>

          {bookmarkedItems.length === 0 ? (
            <div className="bg-white border border-[#E7E5E4] rounded-2xl p-12 text-center space-y-4">
              <Heart className="w-8 h-8 text-[#2F5D50] mx-auto stroke-[1.5]" />
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-[#1C1917]">
                  아직 책갈피에 담긴 문장이 없습니다
                </h2>
                <p className="text-xs text-[#78716C]">
                  마음 대화실에서 상담가의 답변 아래에 있는 ‘위로 책갈피에 담기’를 누르면 이곳에
                  안전하게 보관됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className="px-4 py-2 text-xs font-medium text-white bg-[#2F5D50] rounded-lg hover:bg-[#24493E] transition-colors"
              >
                마음 대화실로 이동하기
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {bookmarkedItems.map(({ sessionId, sessionTitle, counselorRole, message }) => {
                const roleName =
                  COUNSELOR_ROLES.find((r) => r.id === counselorRole)?.name || '공감 상담가';
                return (
                  <article
                    key={message.id}
                    className="bg-white border border-[#E7E5E4] rounded-2xl p-6 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#78716C] border-b border-[#E7E5E4] pb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#2F5D50]">{roleName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{sessionTitle}</span>
                      </div>
                      <span className="tabular-nums">{formatKoreanDate(message.createdAt)}</span>
                    </div>

                    <p className="text-[15px] text-[#1C1917] leading-[1.75] whitespace-pre-wrap">
                      {message.text}
                    </p>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSessionId(sessionId);
                          setActiveTab('chat');
                        }}
                        className="text-xs font-medium text-[#2F5D50] hover:underline flex items-center gap-1"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />이 대화 이어서 보기 →
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleBookmark(sessionId, message.id)}
                        className="text-xs text-[#78716C] hover:text-[#B91C1C]"
                      >
                        책갈피 해제
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Backend Storage Inspector & Backup (저장소 관리) */}
      {activeTab === 'storage' && (
        <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#1C1917] font-serif-kr text-balance">
                백엔드 대화 저장소 관리
              </h1>
              <p className="mt-2 text-sm text-[#57534E]">
                Express 백엔드 서버가 모든 멀티턴 대화 내역과 마음 처방전을 로컬 파일 시스템(
                <code className="font-mono text-xs bg-[#F5F2EB] px-1.5 py-0.5 rounded">
                  data/conversations.json
                </code>
                )과 서버 메모리에 안전하게 이중 보관하고 있습니다.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportJSON}
              className="px-4 py-2.5 text-xs font-medium text-white bg-[#2F5D50] rounded-lg hover:bg-[#24493E] transition-colors flex items-center gap-2 whitespace-nowrap self-start sm:self-auto"
            >
              <Download className="w-4 h-4" />
              전체 대화 기록 JSON 백업 다운로드
            </button>
          </div>

          {/* Storage Metrics Grid */}
          {storageInfo && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white border border-[#E7E5E4] rounded-xl p-5">
                <div className="text-xs text-[#78716C]">저장소 동작 모드</div>
                <div className="mt-2 text-base font-bold text-[#1C1917]">
                  {storageInfo.mode === 'local-file-and-memory'
                    ? '로컬 파일 + 메모리 동기화'
                    : '인메모리 안전 보관'}
                </div>
                <div className="mt-1 font-mono text-xs text-[#2F5D50]">
                  {storageInfo.filePath}
                </div>
              </div>

              <div className="bg-white border border-[#E7E5E4] rounded-xl p-5">
                <div className="text-xs text-[#78716C]">보관된 대화 세션</div>
                <div className="mt-2 text-2xl font-bold text-[#1C1917] font-mono tabular-nums">
                  {storageInfo.totalSessions}건
                </div>
                <div className="mt-1 text-xs text-[#78716C]">멀티턴 문맥 유지 중</div>
              </div>

              <div className="bg-white border border-[#E7E5E4] rounded-xl p-5">
                <div className="text-xs text-[#78716C]">누적 대화 메시지</div>
                <div className="mt-2 text-2xl font-bold text-[#1C1917] font-mono tabular-nums">
                  {storageInfo.totalMessages}개
                </div>
                <div className="mt-1 text-xs text-[#78716C] tabular-nums">
                  책갈피 {bookmarkedItems.length}개 포함
                </div>
              </div>

              <div className="bg-white border border-[#E7E5E4] rounded-xl p-5">
                <div className="text-xs text-[#78716C]">로컬 파일 크기 · 최근 저장</div>
                <div className="mt-2 text-2xl font-bold text-[#1C1917] font-mono tabular-nums">
                  {(storageInfo.fileSizeBytes / 1024).toFixed(1)} KB
                </div>
                <div className="mt-1 text-xs text-[#78716C] tabular-nums">
                  {formatKoreanTime(storageInfo.lastSavedAt)} 동기화 완료
                </div>
              </div>
            </div>
          )}

          {/* Session Table */}
          <div className="bg-white border border-[#E7E5E4] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E7E5E4] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1C1917]">
                서버에 저장된 대화 세션 목록
              </h2>
              <span className="text-xs text-[#78716C]">
                클릭하여 대화를 이어가거나 불필요한 기록을 정리할 수 있습니다
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E7E5E4] bg-[#F5F2EB]/60 text-[#57534E]">
                    <th className="py-3 px-6 font-medium">대화 제목</th>
                    <th className="py-3 px-4 font-medium">상담가 역할</th>
                    <th className="py-3 px-4 font-medium">아이 연령 · 감정</th>
                    <th className="py-3 px-4 font-medium text-right">메시지 수</th>
                    <th className="py-3 px-4 font-medium text-right">최근 업데이트</th>
                    <th className="py-3 px-6 font-medium text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E5E4]">
                  {sessions.map((s) => {
                    const roleName =
                      COUNSELOR_ROLES.find((r) => r.id === s.counselorRole)?.name ||
                      '공감 상담가';
                    return (
                      <tr key={s.id} className="hover:bg-[#FBF9F5] transition-colors">
                        <td className="py-3.5 px-6 font-medium text-[#1C1917]">{s.title}</td>
                        <td className="py-3.5 px-4 text-[#57534E]">{roleName}</td>
                        <td className="py-3.5 px-4 text-[#57534E]">
                          {s.childStage} · {s.parentMood}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#1C1917]">
                          {s.messages.length}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-[#78716C]">
                          {formatKoreanDate(s.updatedAt)}
                        </td>
                        <td className="py-3.5 px-6 text-right space-x-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveSessionId(s.id);
                              setActiveTab('chat');
                            }}
                            className="font-medium text-[#2F5D50] hover:underline"
                          >
                            열기
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSession(s.id)}
                            className="text-[#78716C] hover:text-[#B91C1C]"
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
