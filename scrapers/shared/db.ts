import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_KEY env vars");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to upsert or get existing record
export async function upsertUnique<T extends { id?: number }>(
  table: string,
  record: T,
  uniqueField: keyof T
): Promise<number> {
  const value = record[uniqueField];

  // Try to get existing
  const { data: existing } = await supabase
    .from(table)
    .select("id")
    .eq(uniqueField as string, value)
    .single();

  if (existing) {
    return existing.id;
  }

  // Insert new
  const { data, error } = await supabase
    .from(table)
    .insert(record)
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}
