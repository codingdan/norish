/**
 * Local fallback normalization using regex patterns.
 * Applied when AI is unavailable or disabled.
 */
export function localNormalize(ingredientName: string): string {
  let name = ingredientName.trim();

  // 1. Strip parenthetical suffixes: "(diced)", "(to taste)", "(optional)"
  name = name.replace(/\s*\([^)]*\)\s*$/, "");

  // 2. Strip trailing comma phrases: ", minced", ", for garnish"
  name = name.replace(/,\s*[^,]+$/, "");

  // 3. Strip leading quantities: "2 cloves garlic" -> "garlic"
  // Matches: number (with optional fraction) + optional unit + optional "of "
  name = name.replace(
    /^[\d./]+\s*(oz|lb|lbs|g|kg|ml|l|cups?|tbsp|tsp|cloves?|pieces?|slices?|heads?|stalks?|sprigs?|cans?|bunch|bunches)?\s*(of\s+)?/i,
    ""
  );

  // 4. Trim and normalize whitespace
  name = name.replace(/\s+/g, " ").trim();

  // Return original if normalization emptied the string
  return name || ingredientName.trim();
}
