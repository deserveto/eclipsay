import { z } from 'zod';

// Structural + budget validation for chat payloads (audit A06). The old
// `z.custom<UIMessage>()` accepted any value, so `{ "messages": [null] }`
// crashed the route with an unstructured 500 before the provider boundary.
// This validates the shape the app actually sends (role/id/parts/metadata)
// and bounds message count, part count, text volume, and metadata size.

export const CHAT_BUDGETS = {
  maxBodyChars: 400_000,
  maxMessages: 80,
  maxPartsPerMessage: 64,
  maxTextPerPart: 16_000,
  maxTotalText: 120_000,
  maxMetadataChars: 8_000,
  maxIdChars: 128,
  maxPartTypeChars: 64,
} as const;

export type ValidationFailure = { ok: false; reason: string };

export type ValidationSuccess = { ok: true };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateUIMessages(messages: unknown): ValidationSuccess | ValidationFailure {
  if (!Array.isArray(messages)) return { ok: false, reason: 'messages_not_array' };
  if (messages.length === 0) return { ok: false, reason: 'messages_empty' };
  if (messages.length > CHAT_BUDGETS.maxMessages) return { ok: false, reason: 'too_many_messages' };

  let totalText = 0;
  for (const message of messages) {
    if (!isPlainObject(message)) return { ok: false, reason: 'message_not_object' };
    const { id, role, parts, metadata } = message as Record<string, unknown>;
    if (id !== undefined && (typeof id !== 'string' || id.length === 0 || id.length > CHAT_BUDGETS.maxIdChars)) {
      return { ok: false, reason: 'invalid_message_id' };
    }
    if (role !== 'user' && role !== 'assistant' && role !== 'system') {
      return { ok: false, reason: 'invalid_role' };
    }
    if (!Array.isArray(parts)) return { ok: false, reason: 'parts_not_array' };
    if (parts.length > CHAT_BUDGETS.maxPartsPerMessage) return { ok: false, reason: 'too_many_parts' };
    if (metadata !== undefined) {
      if (!isPlainObject(metadata)) return { ok: false, reason: 'invalid_metadata' };
      if (JSON.stringify(metadata).length > CHAT_BUDGETS.maxMetadataChars) {
        return { ok: false, reason: 'metadata_too_large' };
      }
    }
    for (const part of parts) {
      if (!isPlainObject(part)) return { ok: false, reason: 'part_not_object' };
      const type = (part as Record<string, unknown>).type;
      if (typeof type !== 'string' || type.length === 0 || type.length > CHAT_BUDGETS.maxPartTypeChars) {
        return { ok: false, reason: 'invalid_part_type' };
      }
      if (type === 'text') {
        const text = (part as Record<string, unknown>).text;
        if (typeof text !== 'string') return { ok: false, reason: 'invalid_text_part' };
        if (text.length > CHAT_BUDGETS.maxTextPerPart) return { ok: false, reason: 'text_part_too_large' };
        totalText += text.length;
        if (totalText > CHAT_BUDGETS.maxTotalText) return { ok: false, reason: 'transcript_too_large' };
      }
    }
  }
  return { ok: true };
}

export const guestMemorySchema = z.object({
  enabled: z.boolean(),
  items: z.array(z.object({ category: z.string().min(1).max(64), content: z.string().max(2000) })).max(20),
});

export const chatBodySchema = z.object({
  sessionId: z.string().uuid().optional(),
  messages: z.array(z.unknown()).min(1),
  // Guest memories (PRD §13, §41): the client vouches with an explicit
  // snapshot per request; the server sanitizes before any prompt use.
  guestMemory: guestMemorySchema.optional(),
  // Audit A36: guests have no profile row, so the 13–17 conservative policy
  // applies unless this browser explicitly completed the age step as adult.
  guestAdultConfirmed: z.boolean().optional(),
});
