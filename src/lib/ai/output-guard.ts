const SAFETY_LABEL_PREFIX = /^(?:user\s+safety|safety|classification|risk)\s*(?::|-|=)/i;
const SAFETY_MARKER_ONLY = /^(?:safe|high[_ -]?stakes|crisis)$/i;

export function guardGeneratedOutput(raw: string, minimumLength = 1): string | null {
  const trimmed = raw.trim();
  if (trimmed.length < minimumLength) return null;
  if (SAFETY_LABEL_PREFIX.test(trimmed) || SAFETY_MARKER_ONLY.test(trimmed)) return null;
  return trimmed;
}
