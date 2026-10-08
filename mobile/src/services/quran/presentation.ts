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

export interface SourceParagraphRun extends SourceTextRun { italic: boolean }
export interface SourceTextParagraph { runs: SourceParagraphRun[]; heading: boolean }

const publisherEntities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…' };
function decodePublisherEntities(text: string): string {
  return text.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi, (original, entity: string) => {
    if (!entity.startsWith('#')) return publisherEntities[entity.toLowerCase()] ?? original;
    const hexadecimal = entity[1]?.toLowerCase() === 'x';
    const point = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : original;
  });
}

/** Native text runs only: publisher HTML is never a WebView, executable script, image or link. */
export function sourceTextParagraphs(text: string): SourceTextParagraph[] {
  const paragraphs: SourceTextParagraph[] = [];
  let current: SourceTextParagraph = { runs: [], heading: false };
  let bold = 0; let underline = 0; let italic = 0;
  const flush = () => { if (current.runs.some(run => run.text.length)) paragraphs.push(current); current = { runs: [], heading: false }; };
  for (const part of text.split(/(<[^>]*>)/g)) {
    const tag = /^<(\/)?\s*([a-z][a-z0-9]*)(?:\s[^>]*)?\s*\/?>$/i.exec(part);
    if (tag) {
      const name = tag[2].toLowerCase(); const change = tag[1] ? -1 : 1;
      if (['p', 'div', 'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(name)) { flush(); if (!tag[1] && /^h[1-6]$/.test(name)) current.heading = true; }
      else if (name === 'br') current.runs.push({ text: '\n', bold: bold > 0, underline: underline > 0, italic: italic > 0 });
      else if (name === 'b' || name === 'strong') bold = Math.max(0, bold + change);
      else if (name === 'u') underline = Math.max(0, underline + change);
      else if (name === 'i' || name === 'em') italic = Math.max(0, italic + change);
      // Other tags/attributes are inert presentation; their enclosed publisher text is retained.
      continue;
    }
    if (part) current.runs.push({ text: decodePublisherEntities(part), bold: bold > 0, underline: underline > 0, italic: italic > 0 });
  }
  flush();
  return paragraphs;
}
