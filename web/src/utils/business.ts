/**
 * Derives a clean, human-readable business display name from a spreadsheet filename.
 *
 * Logic:
 * 1. If the filename contains the configured business name slug (case-insensitive), return the configured name.
 * 2. Strip file extension and common spreadsheet noise words.
 * 3. Convert underscores/hyphens to spaces, title-case the result.
 * 4. Fall back to VITE_BUSINESS_NAME (or 'Hotel Gaurav' if not set) if nothing meaningful remains.
 *
 * This is the single source of truth for business name derivation — import this instead
 * of duplicating the logic in components.
 */

/** The canonical business name from the build-time environment variable. Falls back to 'Hotel Gaurav'. */
export const BUSINESS_NAME: string =
  (import.meta.env.VITE_BUSINESS_NAME as string | undefined) || 'Hotel Gaurav';

/** A lowercase slug of the business name for filename matching (e.g. 'hotel gaurav') */
const BUSINESS_NAME_SLUG = BUSINESS_NAME.toLowerCase();

export function deriveBusinessName(fileName?: string): string {
  if (!fileName) return BUSINESS_NAME;

  // Known business name shortcut
  if (new RegExp(BUSINESS_NAME_SLUG.replace(/\s+/g, '.+'), 'i').test(fileName)) return BUSINESS_NAME;

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

  return BUSINESS_NAME;
}
