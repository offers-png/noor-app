/** Direction belongs to the view, never to inserted Unicode control characters. */
export function arabicDisplayProps(fontSize:number){return {writingDirection:'rtl' as const,textAlign:'right' as const,fontSize:Math.max(30,fontSize),lineHeight:Math.max(54,fontSize*1.9),includeFontPadding:true};}
export function displayedCanonicalText(text:string):string{return text;}

export interface SourceTextRun { text: string; bold: boolean; underline: boolean }

/** Only the publisher's known b/u presentation tags are interpreted; no HTML or URL is executed. */
export function sourceTextRuns(text: string): SourceTextRun[] {
  const runs: SourceTextRun[] = [];
  let bold = 0;
  let underline = 0;
  for (const part of text.split(/(<\/?(?:b|u)>)/i)) {
    const tag = /^<(\/)?(b|u)>$/i.exec(part);
    if (tag) {
      const change = tag[1] ? -1 : 1;
      if (tag[2].toLowerCase() === 'b') bold = Math.max(0, bold + change);
      else underline = Math.max(0, underline + change);
    } else if (part) runs.push({ text: part, bold: bold > 0, underline: underline > 0 });
  }
  return runs;
}
