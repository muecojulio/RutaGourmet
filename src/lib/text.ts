/**
 * Case- and diacritic-insensitive text matching for search and filters
 * (Spanish-first: "jalapeño" ≟ "jalapeno" ≟ "JALAPEÑO").
 */

/** Fold a string for comparison: lowercase, trim, strip diacritics. */
export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** True when every whitespace-separated word of `needle` appears in `haystack`. */
export function matchesQuery(haystack: string, needle: string): boolean {
  const foldedHaystack = foldText(haystack);
  return foldText(needle)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => foldedHaystack.includes(word));
}
