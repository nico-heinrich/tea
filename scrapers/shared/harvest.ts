/**
 * Harvest season extraction from harvest_raw text
 */

const SEASON_PATTERNS: [RegExp, string][] = [
  // German terms (Yoshien, InfiniTea)
  [/1\.\s*ernte/i, 'spring'],
  [/2\.\s*ernte/i, 'summer'],
  [/3\.\s*ernte/i, 'autumn'],
  [/4\.\s*ernte/i, 'winter'],
  [/frühling/i, 'spring'],
  [/sommer/i, 'summer'],
  [/herbst/i, 'autumn'],
  [/winter/i, 'winter'],

  // English terms (What-Cha)
  [/1st\s*(?:flush|harvest)/i, 'spring'],
  [/2nd\s*(?:flush|harvest)/i, 'summer'],
  [/3rd\s*(?:flush|harvest)/i, 'autumn'],
  [/autumnal/i, 'autumn'],
  [/monsoon/i, 'summer'],
  [/spring/i, 'spring'],
  [/summer/i, 'summer'],
  [/autumn/i, 'autumn'],
  [/fall/i, 'autumn'],
  
  // Japanese terms
  [/ichibancha/i, 'spring'],
  [/nibancha/i, 'summer'],
  [/sanbancha/i, 'autumn'],
  [/shibancha/i, 'winter'],
  
  // Chinese terms
  [/春茶/i, 'spring'],
  [/夏茶/i, 'summer'],
  [/秋茶/i, 'autumn'],
  [/冬茶/i, 'winter'],
];

/**
 * Extract normalized season from harvest_raw text
 * Returns: 'spring', 'summer', 'autumn', 'winter', or null
 */
export function extractSeason(harvestRaw: string | null): string | null {
  if (!harvestRaw) return null;
  
  for (const [pattern, season] of SEASON_PATTERNS) {
    if (pattern.test(harvestRaw)) {
      return season;
    }
  }
  
  return null;
}
