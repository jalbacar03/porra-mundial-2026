/**
 * Curated soccer-themed avatar library.
 * Each icon is a self-contained SVG with its own circular background, encoded
 * as a data URI so it can be used anywhere an image URL is expected.
 *
 * Avatar URLs in the DB:
 *  - Country flags from teams.flag_url (HTTP URLs)
 *  - Symbol icons from this file (data:image/svg+xml,... URIs)
 *  - Legacy: Supabase Storage uploads (still rendered if present)
 */

const SYMBOLS = [
  {
    id: 'ball',
    name: 'Balón',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="32" fill="#0e1014"/><circle cx="32" cy="32" r="22" fill="#fafafa"/><polygon points="32,17 42,24 38.5,35 25.5,35 22,24" fill="#0e1014"/><path d="M32 11 L32 17 M44 14 L42 24 M20 14 L22 24 M48 27 L42 24 M16 27 L22 24 M48 36 L38.5 35 M16 36 L25.5 35 M40 49 L38.5 35 M24 49 L25.5 35 M32 53 L32 35" stroke="#0e1014" stroke-width="1.4" fill="none" stroke-linecap="round"/></svg>`
  },
  {
    id: 'trophy',
    name: 'Trofeo',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="32" fill="#1a1d26"/><path d="M22 16 H42 V28 C42 35 38 40 32 40 C26 40 22 35 22 28 Z" fill="#ffcc00"/><path d="M22 18 H16 V24 C16 28 19 30 22 30" fill="none" stroke="#ffcc00" stroke-width="2.5"/><path d="M42 18 H48 V24 C48 28 45 30 42 30" fill="none" stroke="#ffcc00" stroke-width="2.5"/><rect x="28" y="40" width="8" height="6" fill="#b8860b"/><rect x="22" y="46" width="20" height="4" rx="1" fill="#ffcc00"/></svg>`
  },
  {
    id: 'jersey',
    name: 'Camiseta',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="32" fill="#007a45"/><path d="M22 16 L18 20 L12 26 L18 32 L22 28 V48 H42 V28 L46 32 L52 26 L46 20 L42 16 L38 18 C38 21 35 23 32 23 C29 23 26 21 26 18 Z" fill="#ffffff"/><text x="32" y="40" text-anchor="middle" font-family="-apple-system,sans-serif" font-weight="800" font-size="14" fill="#007a45">10</text></svg>`
  },
  {
    id: 'goal',
    name: 'Portería',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="32" fill="#0e1014"/><rect x="14" y="22" width="36" height="24" fill="none" stroke="#fafafa" stroke-width="2.5"/><line x1="14" y1="28" x2="50" y2="28" stroke="#fafafa" stroke-width="0.8" opacity="0.6"/><line x1="14" y1="34" x2="50" y2="34" stroke="#fafafa" stroke-width="0.8" opacity="0.6"/><line x1="14" y1="40" x2="50" y2="40" stroke="#fafafa" stroke-width="0.8" opacity="0.6"/><line x1="20" y1="22" x2="20" y2="46" stroke="#fafafa" stroke-width="0.8" opacity="0.6"/><line x1="26" y1="22" x2="26" y2="46" stroke="#fafafa" stroke-width="0.8" opacity="0.6"/><line x1="32" y1="22" x2="32" y2="46" stroke="#fafafa" stroke-width="0.8" opacity="0.6"/><line x1="38" y1="22" x2="38" y2="46" stroke="#fafafa" stroke-width="0.8" opacity="0.6"/><line x1="44" y1="22" x2="44" y2="46" stroke="#fafafa" stroke-width="0.8" opacity="0.6"/></svg>`
  },
  {
    id: 'whistle',
    name: 'Silbato',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="32" fill="#22252f"/><circle cx="26" cy="34" r="14" fill="#c0c0c0"/><rect x="36" y="28" width="20" height="12" rx="2" fill="#c0c0c0"/><circle cx="26" cy="34" r="4" fill="#1a1d26"/><path d="M40 22 L42 18 M46 24 L48 20" stroke="#fafafa" stroke-width="1.6" stroke-linecap="round"/></svg>`
  },
  {
    id: 'boot',
    name: 'Bota',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="32" fill="#1a1d26"/><path d="M14 38 L14 44 C14 47 16 49 19 49 H46 C49 49 51 47 51 44 V40 L36 36 V26 C36 23 33 21 30 21 C27 21 25 23 25 26 V32 Z" fill="#ffcc00"/><circle cx="22" cy="42" r="1.5" fill="#0e1014"/><circle cx="28" cy="42" r="1.5" fill="#0e1014"/><circle cx="34" cy="42" r="1.5" fill="#0e1014"/><circle cx="40" cy="42" r="1.5" fill="#0e1014"/></svg>`
  },
  {
    id: 'glove',
    name: 'Guante',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="32" fill="#22252f"/><path d="M22 18 C22 16 23.5 14.5 25.5 14.5 C27.5 14.5 29 16 29 18 V30 H31 V20 C31 18 32.5 16.5 34.5 16.5 C36.5 16.5 38 18 38 20 V32 H40 V22 C40 20 41.5 18.5 43.5 18.5 C45.5 18.5 47 20 47 22 V36 C47 44 41 50 33 50 C25 50 20 45 20 38 V24 C20 22 21 20 22 20 Z" fill="#fafafa"/></svg>`
  },
  {
    id: 'yellow',
    name: 'Amarilla',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="32" fill="#1a1d26"/><rect x="20" y="14" width="24" height="36" rx="2" fill="#ffcc00" transform="rotate(-8 32 32)"/></svg>`
  },
  {
    id: 'red',
    name: 'Roja',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="32" fill="#1a1d26"/><rect x="20" y="14" width="24" height="36" rx="2" fill="#e24b4a" transform="rotate(8 32 32)"/></svg>`
  },
  {
    id: 'corner',
    name: 'Córner',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="32" fill="#007a45"/><line x1="22" y1="16" x2="22" y2="50" stroke="#fafafa" stroke-width="2.5" stroke-linecap="round"/><path d="M22 16 L42 22 L22 28 Z" fill="#e24b4a"/></svg>`
  },
  {
    id: 'star',
    name: 'Estrella',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="32" fill="#0e1014"/><polygon points="32,12 38,26 53,28 42,38 45,53 32,46 19,53 22,38 11,28 26,26" fill="#ffcc00"/></svg>`
  },
  {
    id: 'medal',
    name: 'Medalla',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="32" fill="#1a1d26"/><path d="M22 14 L26 32 M42 14 L38 32" stroke="#e24b4a" stroke-width="3"/><circle cx="32" cy="40" r="14" fill="#ffcc00" stroke="#b8860b" stroke-width="1.5"/><text x="32" y="45" text-anchor="middle" font-family="-apple-system,sans-serif" font-weight="800" font-size="14" fill="#1a1d26">1</text></svg>`
  }
]

// Encode each SVG as a data URI so it works as an <img src>
function svgToDataUri(svg) {
  // encodeURIComponent to be safe with non-ASCII / special chars in paths
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export const SYMBOL_AVATARS = SYMBOLS.map(s => ({
  id: s.id,
  name: s.name,
  url: svgToDataUri(s.svg)
}))
