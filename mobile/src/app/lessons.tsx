import { useLocalSearchParams } from 'expo-router';
import { LessonsScreen } from '../features/lessons/LessonsScreen';
import { useAppStore } from '../state/appStore';
import { Body,Screen } from '../components/Common/ui';
export default function Lessons(){const {category}=useLocalSearchParams<{category:string}>();const {selectedChildId,settings,saveProgress}=useAppStore();const valid=category==='hadith'||category==='duas'||category==='islam';if(!valid||!selectedChildId||!settings.modules[category])return <Screen title="Learning"><Body>Ask a parent to enable this module and choose a profile.</Body></Screen>;return <LessonsScreen key={`${selectedChildId}:${category}`} category={category} fontSize={settings.fontSize} developmentContent={settings.developmentContent} onComplete={(id,score)=>saveProgress(id,score,selectedChildId)} narrationEnabled={settings.audioEnabled}/>;}
