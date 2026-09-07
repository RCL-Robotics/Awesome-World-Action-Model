const VENUE_LABELS = new Map([
  ['CoRL 2024（论文集出版于2025年）', 'CoRL 2024 (proceedings published in 2025)'],
  ['MIT Press（图书）', 'MIT Press (book)'],
  ['MIT Press（图书，第一版）', 'MIT Press (book, first edition)'],
]);

/** English display text without changing the recorded venue. */
export function venueLabel(value) {
  return value == null ? 'Not recorded' : VENUE_LABELS.get(value) ?? value;
}
