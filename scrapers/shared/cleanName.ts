// German prefix: "Pu Erh Tee - Sheng BANGWEI GUCHA 2017 Cake" → "BANGWEI GUCHA 2017 Cake"
const GERMAN_PREFIX_RE = /^(?:Pu\s*Erh\s*Tee\s*-\s*(?:Sheng|Shou)\s+|Gr[üu]ner\s+Tee\s+|Schwarzer\s+Tee\s+|Weißer\s+Tee\s+|Gelber\s+Tee\s+)/i;

const QUOTED_NAME_RE = /["\u201C]([^"\u201C\u201D]+)["\u201D]/;

const HARVEST_SEASON_RE = /\s*\*\s*(?:Spring|Summer|Autumn|Winter|Fall)\s+\d{4}\s*$/i;

const PEST_FREE_RE = /\s*Pest\.?\s*(?:Free|frei|Frei|freilich|Freilich)\s*/gi;
const P_FREE_RE = /\s*P\.?\s*FREE\b/gi;
const PESTIZIDFREI_RE = /\s*Pestizidfrei\s*/gi;
const BIO_RE = /\s*Bio\b/gi;
const GERMAN_TEE_RE = /\s+Tee\b/gi;

export function cleanTeaName(
  name: string,
  opts: { stripYear?: boolean } = {},
): string {
  const { stripYear = true } = opts;
  let cleaned = name.trim();

  cleaned = cleaned.replace(GERMAN_PREFIX_RE, "").trim();

  const quotedMatch = cleaned.match(QUOTED_NAME_RE);
  if (quotedMatch) return quotedMatch[1].trim();
  if (stripYear) {
    cleaned = cleaned.replace(HARVEST_SEASON_RE, "").trim();
  }

  cleaned = cleaned.replace(PEST_FREE_RE, " ").trim();
  cleaned = cleaned.replace(P_FREE_RE, " ").trim();
  cleaned = cleaned.replace(PESTIZIDFREI_RE, " ").trim();
  cleaned = cleaned.replace(BIO_RE, " ").trim();
  cleaned = cleaned.replace(GERMAN_TEE_RE, " ").trim();
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned || name.trim();
}
