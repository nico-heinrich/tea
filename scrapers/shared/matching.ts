import { supabase } from "./db.js";

export interface TypeEntry {
  id: number;
  key: string;
  label: string;
  tags: string[];
}

export interface StyleEntry {
  id: number;
  key: string;
  label: string;
  tags: string[];
  typeId: number | null;
}

export interface MatchResult {
  key: string;
  id: number;
}

let typeCache: TypeEntry[] | null = null;
let styleCache: StyleEntry[] | null = null;

export async function loadTypes(): Promise<TypeEntry[]> {
  if (typeCache) return typeCache;

  const { data, error } = await supabase
    .from("type")
    .select("id, key, label, tags");

  if (error) throw error;
  typeCache = (data || []).map((row: any) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    tags: row.tags,
  }));
  return typeCache;
}

export async function loadStyles(): Promise<StyleEntry[]> {
  if (styleCache) return styleCache;

  const { data, error } = await supabase
    .from("style")
    .select("id, key, label, tags, type_id");

  if (error) throw error;
  styleCache = (data || []).map((row: any) => ({
    id: row.id,
    key: row.key,
    label: row.label,
    tags: row.tags,
    typeId: row.type_id,
  }));
  return styleCache;
}

function matchesTag(text: string, tags: string[]): boolean {
  const lower = text.toLowerCase();
  return tags.some((tag) => lower.includes(tag.toLowerCase()));
}

export async function matchType(text: string): Promise<MatchResult | null> {
  const types = await loadTypes();

  for (const t of types) {
    if (matchesTag(text, t.tags)) {
      return { key: t.key, id: t.id };
    }
  }
  return null;
}

export async function matchStyle(text: string): Promise<MatchResult | null> {
  const styles = await loadStyles();

  for (const s of styles) {
    if (matchesTag(text, s.tags)) {
      return { key: s.key, id: s.id };
    }
  }
  return null;
}

export async function matchStyleForType(
  text: string,
  typeKey: string
): Promise<MatchResult | null> {
  const types = await loadTypes();
  const styles = await loadStyles();

  const typeEntry = types.find((t) => t.key === typeKey);
  if (!typeEntry) return null;

  for (const s of styles) {
    if (s.typeId === typeEntry.id && matchesTag(text, s.tags)) {
      return { key: s.key, id: s.id };
    }
  }

  for (const s of styles) {
    if (!s.typeId && matchesTag(text, s.tags)) {
      return { key: s.key, id: s.id };
    }
  }

  return null;
}

export async function resolveStyle(
  styleRaw: string | null,
  typeKey: string | null
): Promise<number | null> {
  if (!styleRaw) return null;
  const result = typeKey
    ? await matchStyleForType(styleRaw, typeKey)
    : await matchStyle(styleRaw);
  return result?.id ?? null;
}
