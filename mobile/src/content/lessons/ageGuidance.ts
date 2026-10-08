/** Reading practice guidance only; these prompts add no religious claims. */
export function agePracticeGuidance(age?: number | null): string {
  if (age == null) return 'Choose a short lesson with your adult. They can read it with you and help you practice.';
  if (age <= 7) return 'Try one small step with your adult. Look, listen, and repeat together.';
  if (age <= 11) return 'Read a small section, practice with your adult, then tell them what you learned.';
  return 'Read carefully. Explain what you learned and ask your teacher about questions.';
}
