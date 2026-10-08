import { Text,View,Pressable,StyleSheet } from 'react-native';
import { Screen,Body,Button,colors } from '../../components/Common/ui';
import { useAppStore,type ModuleName } from '../../state/appStore';
export default function HomeScreen({open,parent}:{open:(module:ModuleName|'progress')=>void;parent:()=>void}) {
  const {children,selectedChildId,settings}=useAppStore();const child=children.find(c=>c.id===selectedChildId);
  const cards:[ModuleName|'progress',string,string,string][]=[['quran','📖','Qur’an','#dce9d4'],['arabic','ا ب ت','Arabic','#f4e5c7'],['hadith','📚','Hadith','#e4def1'],['islam','🕌','Learn Islam','#d5e7e6'],['duas','🤲','Duas','#f4dfd1'],['progress','⭐','My Progress','#f0e9bd']];
  return <Screen title="Assalamu Alaikum"><Body>{child?`${child.avatar} ${child.nickname}, what would you like to learn today?`:'What would you like to learn today?'}</Body><View style={styles.grid}>{cards.filter(([id])=>id==='progress'||settings.modules[id]).map(([id,icon,title,bg])=><Pressable accessibilityRole="button" accessibilityLabel={title} key={id} onPress={()=>open(id)} style={[styles.tile,{backgroundColor:bg}]}><Text style={styles.icon}>{icon}</Text><Text style={styles.name}>{title}</Text></Pressable>)}</View>{settings.developmentContent&&<Body>Parent-enabled review content is available. Explanations are awaiting review.</Body>}<Body>Today’s learning goal: {settings.dailyGoal} minutes. Learn at your own pace.</Body><Button label="Parent mode" secondary onPress={parent}/></Screen>;
}
const styles=StyleSheet.create({grid:{flexDirection:'row',flexWrap:'wrap',gap:14,marginVertical:18},tile:{width:'47%',minHeight:158,padding:20,borderRadius:22,justifyContent:'space-between'},icon:{fontSize:34,color:colors.ink},name:{fontSize:20,fontWeight:'700',color:colors.ink}});
