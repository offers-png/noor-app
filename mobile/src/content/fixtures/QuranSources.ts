import type {LessonSource} from '../../types/lessons';
import {AUDIO_SOURCE,CLEARQURAN_SOURCE,TANZIL_SOURCE} from '../../services/quran/FixtureQuranProvider';

export const QURAN_SOURCE_REGISTRY:readonly LessonSource[]=[
  {...convert(TANZIL_SOURCE),licenseUrl:'https://tanzil.net/docs/Text_License'},
  {...convert(CLEARQURAN_SOURCE),translationName:'ClearQuran (Allah Edition)',licenseUrl:'https://blog.clearquran.com/download'},
  {...convert(AUDIO_SOURCE),licenseUrl:'https://alquran.cloud/terms-and-conditions'},
  {sourceName:'Quran Foundation',sourceReference:'Optional provider downloads via Content Sync; sourced metadata and version retained per resource',sourceUrl:'https://quran.com/',translationName:null,translator:null,contentVersion:'Content API v4',verifiedAt:'2026-10-07',license:'Quran Foundation Developer Terms; permitted local copies maintained through Content Sync and refreshed every seven days when connectivity permits',licenseUrl:'https://api-docs.quran.com/legal/developer-terms/'},
];
function convert(source:{name:string;reference:string;url:string;translator?:string;version:string;verifiedAt:string;license:string}):Omit<LessonSource,'licenseUrl'>{return {sourceName:source.name,sourceReference:source.reference,sourceUrl:source.url,translationName:null,translator:source.translator??null,contentVersion:source.version,verifiedAt:source.verifiedAt,license:source.license};}
