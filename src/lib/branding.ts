// Shared, browser-safe branding shape used by the login screen, the app shell
// and the branding preview. Only public-safe fields belong here.
export type Branding = {
  name: string
  nameAr: string
  logo: string | null
}

export const DEFAULT_BRANDING: Branding = {
  name: 'Nokhaba Tatweer for Trading',
  nameAr: 'مؤسسة نخبة التطوير للتجارة',
  logo: null,
}

/** Two-letter monogram used when no logo has been uploaded yet. */
export function brandInitials(name: string): string {
  const words = String(name || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return 'NP'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
