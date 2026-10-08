/** Direction belongs to the view, never to inserted Unicode control characters. */
export function arabicDisplayProps(fontSize:number){return {writingDirection:'rtl' as const,textAlign:'right' as const,fontSize:Math.max(30,fontSize),lineHeight:Math.max(54,fontSize*1.9),includeFontPadding:true};}
export function displayedCanonicalText(text:string):string{return text;}
