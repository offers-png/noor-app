/** Reading practice guidance only; these prompts add no religious claims. */
export function agePracticeGuidance(age?: number | null): string {
  if (age == null) return 'Choose a short lesson. Read it, listen, and practise.';
  if (age <= 7) return 'Try one small step. Look, listen, and repeat.';
  if (age <= 11) return 'Read a small section, practise it, then say what you learned in your own words.';
  return 'Read carefully, then explain what you learned in your own words.';
}
