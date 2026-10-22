import type { Product } from '../types';

const img = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;
const T = 'TIMEPIECE' as const;
// VERIFY with owner: carried over verbatim from the MVP; applies a material claim to every timepiece.
const COPY = 'Designed with precision and crafted from aerospace-grade stainless steel with sapphire crystal glass. Part of the limited ++watchflex collection.';

// Unsplash placeholders, as in the approved MVP. IDs, names, prices, subtitles and order are unchanged.
export const products: Product[] = [
  { id: 1, name: 'Chronoflex Royal', price: 185, tag: T, image: img('1523275335684-37898b6baf30'), subtitle: '; time* (off)', description: COPY },
  { id: 2, name: 'Gold Apex 01', price: 210, tag: T, image: img('1524805444758-089113d48a6d'), subtitle: '++', description: COPY },
  { id: 3, name: 'Specimen No. W01', price: 250, tag: T, image: img('1533139502658-0198f920d8e8'), subtitle: 'COLLECTION 01', description: COPY },
  { id: 4, name: 'Aero Grid Steel', price: 195, tag: T, image: img('1509042239860-f550ce710b93'), subtitle: 'WATERPROOF 50M', description: COPY },
  { id: 5, name: 'Neutral Minimal', price: 160, tag: T, image: img('1522335789203-aabd1fc54bc9'), subtitle: 'SI Hello', description: COPY },
  { id: 6, name: 'Obsidian Edition', price: 280, tag: T, image: img('1547996160-81dfa63595aa'), subtitle: 'SPECIAL EDITION', description: COPY },
  { id: 7, name: 'Gridlocked Chrono', price: 220, tag: T, image: img('1434030216411-0b793f4b4173'), subtitle: 'CONTRAST DIAL', description: COPY },
  { id: 8, name: 'Flex Series 01', price: 175, tag: T, image: img('1539874754764-5a96559165b0'), subtitle: 'WEEK SERIES', description: COPY },
  { id: 9, name: 'Flex Series 02', price: 190, tag: T, image: img('1512753904511-22e3994fcf1e'), subtitle: 'WEEK SERIES', description: COPY },
  { id: 10, name: 'Automatic Manifest', price: 310, tag: T, image: img('1508685096489-7aacd43bd3b1'), subtitle: 'MANIFESTO', description: COPY },
  { id: 11, name: 'Whitespace Master', price: 240, tag: T, image: img('1542496658-e33a6d0d50f6'), subtitle: 'TYPOGRAPHY', description: COPY },
  // No description: the timepiece material copy does not apply to an accessory.
  { id: 12, name: 'Flex Watch Tool', price: 45, tag: 'ACCESSORIES', image: img('1522335789203-aabd1fc54bc9'), subtitle: 'HARDWARE' },
];
