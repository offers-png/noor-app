/** Decides whether Kids Mode should hold the screen. Parent Mode can suspend it until Kids Mode is entered again. */
export function shouldHoldScreen(input: { enabled: boolean; childSelected: boolean; suspendedByParent: boolean }): boolean {
  return input.enabled && input.childSelected && !input.suspendedByParent;
}
