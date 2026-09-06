import type { DrawnCard, SpreadId } from './tarot/types';

// ── Shared row shapes ─────────────────────────────────────────────────
// Field names mirror `supabase/migrations/0001_init.sql` exactly so guest
// localStorage records are a 1:1 insert on migration (plan: Data model).

export type ReflectionGoal = 'feelings' | 'decisions' | 'relationships' | 'growth' | 'exploring';
export type TarotFamiliarity = 'new' | 'some' | 'very';

export type Profile = {
  id: string;
  full_name: string | null;
  display_name: string | null;
  date_of_birth: string | null;
  reflection_goal: ReflectionGoal | null;
  tarot_familiarity: TarotFamiliarity | null;
  memory_enabled: boolean;
  created_at: string;
};

export type ReflectionSession = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type JournalEntryType =
  | 'freeform'
  | 'reflection'
  | 'tarot'
  | 'insight'
  | 'mood'
  | 'followup'
  | 'intention';

export type AiNoteType = 'unpack' | 'prompts' | 'insight' | 'summary' | 'tarot';

export type AiNote = {
  id: string;
  type: AiNoteType;
  content: string;
  createdAt: string;
};

export type Mood = 'Low' | 'Anxious' | 'Neutral' | 'Good' | 'Energized';

export type JournalEntry = {
  id: string;
  user_id: string;
  entry_type: JournalEntryType;
  title: string | null;
  body: string;
  mood: string | null;
  tags: string[];
  ai_notes: AiNote[];
  source_session_id: string | null;
  source_reading_id: string | null;
  parent_entry_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MemoryCategory =
  | 'preference'
  | 'goal'
  | 'recurring_situation'
  | 'context'
  | 'project'
  | 'relationship'
  | 'reflection_preference';

export type Memory = {
  id: string;
  user_id: string;
  category: MemoryCategory;
  content: string;
  source: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type FollowUpStatus = 'pending' | 'revisited' | 'dismissed';

export type FollowUp = {
  id: string;
  user_id: string;
  session_id: string | null;
  journal_entry_id: string | null;
  due_at: string;
  status: FollowUpStatus;
  created_at: string;
};

export type TarotReading = {
  id: string;
  session_id: string;
  user_id: string;
  spread_id: string;
  seed: number;
  cards: DrawnCard[];
  created_at: string;
};

// ── Message meta (tool events persisted into messages.meta) ───────────

export type ConfirmCard =
  | { kind: 'insight'; insightId: string; text: string; status: 'pending' | 'saved' | 'dismissed' }
  | {
      kind: 'memory';
      memoryId: string;
      content: string;
      category: MemoryCategory;
      status: 'pending' | 'saved' | 'dismissed';
    }
  | {
      kind: 'followup';
      followupId: string;
      when: 'tomorrow' | '3days' | '1week' | 'custom';
      dueAt: string;
      status: 'pending' | 'saved' | 'dismissed';
    };

export type ContextChip = {
  entryId: string;
  title: string;
};

export type MessageMeta = {
  systemNotice?: 'draw' | 'clarify';
  readingId?: string;
  approvedContext?: { entryId: string; title: string }[];
  clarify?: { readingId: string; targetCardId: string; clarifierCardId: string };
  confirm?: ConfirmCard;
  contextChips?: ContextChip[];
  drawFailed?: boolean;
  // Set only when the safety classifier flagged the user message that prompted
  // this reply (plan: Safety classifier).
  crisis?: boolean;
  readingRecommendation?: { recommendedSpreadId: SpreadId; context: string };
  // Serialized static tool parts (ask_user, recommend_reading, confirm
  // proposals, …) so tool UI cards survive hydration — without this a
  // returned-to session loses every question chip and "Begin reading" card.
  tools?: PersistedToolPart[];
  // Propose-then-confirm state persisted on the assistant message that owns
  // the parts, so acted/declined cards stay resolved across remounts —
  // including account messages (audit A31; keyed by toolCallId).
  actedToolCallIds?: string[];
  declinedToolCallIds?: string[];
  // Pre-A31 guests persisted decline per whole message; still read on
  // hydration.
  declined?: boolean;
  // Readings whose draw bar the user explicitly closed (persisted on the
  // guest transcript's last message), so hydration never resurrects a draw
  // the user walked away from (PRD §25–§26).
  dismissedReadingIds?: string[];
  [key: string]: unknown;
};

export type PersistedToolPart = {
  type: string;
  toolCallId: string;
  state: string;
  input?: unknown;
  output?: unknown;
 };

export type ChatMessageRole = 'user' | 'assistant';

export type StoredMessage = {
  id: string;
  session_id: string;
  user_id: string;
  role: ChatMessageRole;
  content: string;
  meta: MessageMeta;
  created_at: string;
};

// Re-exports keep a single import surface for app code.
export type { DrawnCard, SpreadId };
