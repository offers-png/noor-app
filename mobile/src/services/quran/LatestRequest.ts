/** Prevent delayed chapter responses from replacing a newer reader selection. */
export class LatestRequest {
  private generation = 0;
  begin(): number { return ++this.generation; }
  isCurrent(request: number): boolean { return request === this.generation; }
  cancel(): void { this.generation++; }
}
