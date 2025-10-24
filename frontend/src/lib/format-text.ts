/**
 * Capitalizes only the first letter of a string, leaving the rest as-is
 * @param text - The text to capitalize
 * @returns The text with only the first letter capitalized
 * @example
 * capitalizeFirst("consultation") => "Consultation"
 * capitalizeFirst("CONSULTATION") => "CONSULTATION"
 * capitalizeFirst("x-ray scan") => "X-ray scan"
 */
export function capitalizeFirst(text: string | undefined | null): string {
  if (!text) return '';
  if (text.length === 0) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
