/**
 * Tea name cleaning utilities.
 *
 * Goal: strip text that is redundant with structured fields
 * (tea_category, harvest_year, origin_country).
 *
 * Applied BEFORE DB write, so the name column stays tidy.
 */

// ---------- tea-type suffixes (redundant with tea_category) ----------

// Strips redundant tea-type + optional format from the end of a name.
// Handles: "Raw Pu-erh Tea Cake", "Black Tea", "Oolong Tea Brick", "Pu-erh Tea Tuo", etc.
const TYPE_SUFFIX_RE = /\s+(?:Raw\s+|Ripe\s+)?(?:Pu-?erh|Pu\s*erh|Hei\s*Cha|Black|Green|Oolong|White|Yellow|Dark)\s+Tea(?:\s+(?:Cake|Brick|Tuo|Mushroom|Disc|Ball|Flake))?\s*$/i;

const HARVEST_SEASON_RE = /\s*\*\s*(?:Spring|Summer|Autumn|Winter|Fall)\s+\d{4}\s*$/i;

/**
 * Clean a tea product name by removing redundant suffixes.
 *
 * @param name   Raw product name from the source
 * @param opts   Cleaning options
 * @returns      Cleaned name (trimmed, never empty)
 */
export function cleanTeaName(
  name: string,
  opts: { stripYear?: boolean } = {},
): string {
  const { stripYear = true } = opts;
  let cleaned = name.trim();

  cleaned = cleaned.replace(TYPE_SUFFIX_RE, "").trim();
  if (stripYear) {
    cleaned = cleaned.replace(HARVEST_SEASON_RE, "").trim();
  }

  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned || name.trim();
}
