import { useEffect,useState } from 'react';
import { View,Text } from 'react-native';
import { Screen,Card,Body,colors } from '../../components/Common/ui';
import { useAppStore } from '../../state/appStore';
import { getDb } from '../../services/database/database';
import { sourcePracticeId, sourceReadingCatalog } from '../../content/lessons/sourceReadings';
const readingTitles = new Map(sourceReadingCatalog.map(record => [sourcePracticeId(record), (record.category === 'duas' ? 'Dua reading: ' : 'Hadith reading: ') + record.title]));
function localDay(value:Date){return `${value.getFullYear()}-${value.getMonth()+1}-${value.getDate()}`;}
export default function ProgressScreen({back}:{back:()=>void}) {
  const {children,selectedChildId,progress}=useAppStore();
  const [history,setHistory]=useState<{practiced_at:string}[]>([]),[memorized,setMemorized]=useState(0),[error,setError]=useState('');
  useEffect(()=>{let active=true;if(selectedChildId)void getDb().then(async db=>{const activity=await db.getAllAsync<{practiced_at:string}>('SELECT practiced_at FROM learning_activity WHERE child_id=?',selectedChildId);const count=await db.getFirstAsync<{total:number}>("SELECT COUNT(*) AS total FROM memorization_progress WHERE child_id=? AND verse_key LIKE 'dua-%' AND lower(level)='complete'",selectedChildId);if(active){setHistory(activity);setMemorized(count?.total??0);}}).catch(()=>{if(active)setError('Practice history could not be loaded.');});return()=>{active=false;};},[selectedChildId,progress]);
  const child=children.find(c=>c.id===selectedChildId);
  const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return {label:d.toLocaleDateString('en',{weekday:'short'}),count:history.filter(p=>localDay(new Date(p.practiced_at))===localDay(d)).length};});
  return <Screen title={`${child?.nickname||'My'} progress`} back={back}><Body>Small steps count. Keep practicing!</Body>{error&&<Body>{error}</Body>}{[['Arabic','arabic'],['Quran','quran'],['Hadith','hadith'],['Learn Islam','islam'],['Duas','dua']].map(([label,prefix])=><Card key={prefix}><Text style={{fontSize:19,fontWeight:'600',color:colors.ink}}>{label}</Text><Body>{progress.filter(p=>p.lesson_id.startsWith(prefix)).length} activities completed{prefix==='dua'?` · ${memorized} self-marked from memory`:''}</Body></Card>)}<Card><Text accessibilityRole="header" style={{fontSize:19,color:colors.ink}}>Last seven days</Text><View style={{flexDirection:'row',justifyContent:'space-between'}}>{days.map(d=><View key={d.label} accessibilityLabel={`${d.label}: ${d.count} activities`} style={{alignItems:'center',justifyContent:'flex-end',minHeight:100}}><View style={{width:24,height:Math.max(5,d.count*15),maxHeight:70,backgroundColor:colors.green,borderRadius:6}}/><Text style={{color:colors.muted,fontSize:12,marginTop:6}}>{d.label} · {d.count}</Text></View>)}</View></Card>{progress.map(p=><Body key={p.lesson_id}>{readingTitles.get(p.lesson_id) ?? p.lesson_id} · {p.attempts} practice{p.attempts===1?'':'s'}{p.score!==null?` · ${p.score}%`:''}</Body>)}</Screen>;
}
