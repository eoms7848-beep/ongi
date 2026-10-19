export type CounselorRole = 'empathy' | 'night' | 'development' | 'partner';

export type ModelMode = 'deep' | 'fast';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  createdAt: string;
  bookmarked?: boolean;
  emotionSummary?: string;
  modelUsed?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  counselorRole: CounselorRole;
  childStage: string;
  parentMood: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface MindPrescription {
  id: string;
  parentMood: string;
  energyLevel: number;
  situationNote: string;
  warmLetter: string;
  microAction: string;
  mantra: string;
  createdAt: string;
}

export interface StorageInfo {
  mode: 'local-file-and-memory' | 'memory-only';
  filePath: string;
  lastSavedAt: string;
  totalSessions: number;
  totalMessages: number;
  fileSizeBytes: number;
}
