/**
 * Derives a clean, human-readable business display name from a spreadsheet filename.
 *
 * Logic:
 * 1. If the filename contains "gaurav" (case-insensitive), return "Hotel Gaurav" (known business).
 * 2. Strip file extension and common spreadsheet noise words.
 * 3. Convert underscores/hyphens to spaces, title-case the result.
 * 4. Fall back to "Hotel Gaurav" if nothing meaningful remains.
 *
 * This is the single source of truth for business name derivation — import this instead
 * of duplicating the logic in components.
 */
export function deriveBusinessName(fileName?: string): string {
  if (!fileName) return 'Hotel Gaurav';

  // Known business name shortcut
  if (/gaurav/i.test(fileName)) return 'Hotel Gaurav';

  // Strip extension
  let name = fileName.replace(/\.[^/.]+$/, '');

  // Remove common spreadsheet noise words
  name = name
    .replace(/(daily\s*sales?\s*register|debitors?\s*list|debitors?|sales?|ledger|list|register|summary|report)/gi, '')
    .trim();

  // Normalize separators to spaces
  name = name.replace(/[_-]+/g, ' ').trim();

  // Collapse multiple spaces
  name = name.replace(/\s{2,}/g, ' ').trim();

  // Title-case each word if the result is meaningful
  if (name.length > 2) {
    return name
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  return 'Hotel Gaurav';
}
