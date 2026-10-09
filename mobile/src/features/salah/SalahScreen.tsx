import { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Body, Button, Card, Screen } from '../../components/Common/ui';
import { QuizEngine } from '../../components/Quiz/QuizEngine';
import { LessonIllustration } from '../lessons/LessonIllustration';
import { NarrationButton } from '../../services/audio/NarrationButton';
import { PRAYERS, PREPARATION_STEPS, rakahDifferences, rakahPlan, SALAH_REFERENCE_NOTE, SCHOOL_DIFFERENCES, type Prayer } from '../../content/salah/salahGuide';
import { SALAH_APPROACHES } from '../../services/rewards/RewardsRepository';
import { useAppStore } from '../../state/appStore';
import { GuideHidden, PreviewBanner, RecitationCard, Row, styles } from './GuideParts';
import { useGuide } from './useGuide';

type View = { name: 'home' } | { name: 'prepare'; step: number } | { name: 'prayer'; prayer: Prayer; rakah: number; step: number } | { name: 'quiz'; prayer: Prayer };

export default function SalahScreen() {
  const router = useRouter();
  const { settings, children, selectedChildId, saveProgress } = useAppStore();
  const child = children.find(item => item.id === selectedChildId);
  const guide = useGuide('guide-salah', settings.developmentContent, child?.age);
  const [view, setView] = useState<View>({ name: 'home' });
  const [message, setMessage] = useState('');
  const audio = settings.audioEnabled;
  const back = view.name === 'home' ? undefined : () => { setMessage(''); setView({ name: 'home' }); };
  if (guide.status === 'loading') return <Screen title="Salah — Learn to Pray"><Body>Opening the guide…</Body></Screen>;
  if (guide.status === 'error') return <Screen title="Salah — Learn to Pray"><Body>The guide could not open. Please try again.</Body></Screen>;
  if (guide.status === 'hidden') return <Screen title="Salah — Learn to Pray"><GuideHidden name="Salah" onParent={() => router.push('/parent')} /></Screen>;

  if (view.name === 'prepare') {
    const step = PREPARATION_STEPS[view.step];
    return <Screen title="Getting ready" back={back}>
      <Text style={styles.caption}>Step {view.step + 1} of {PREPARATION_STEPS.length}</Text>
      <Card>{step.illustration && <LessonIllustration kind={step.illustration} />}<Text style={styles.heading}>{step.title}</Text><Text style={styles.body}>{step.action}</Text>{step.note && <Text style={styles.caption}>Reference: {step.note}</Text>}{audio && <NarrationButton text={`${step.title}. ${step.action}`} label="▶ Hear this step" />}</Card>
      <Row><Button label="Previous" secondary disabled={view.step === 0} onPress={() => setView({ name: 'prepare', step: view.step - 1 })} />{view.step < PREPARATION_STEPS.length - 1 ? <Button label="Next" onPress={() => setView({ name: 'prepare', step: view.step + 1 })} /> : <Button label="Choose a prayer" onPress={() => setView({ name: 'home' })} />}</Row>
    </Screen>;
  }
  if (view.name === 'prayer') {
    const plan = rakahPlan(view.prayer);
    const rakah = plan[view.rakah - 1];
    const step = rakah.steps[view.step];
    const lastStep = view.step === rakah.steps.length - 1;
    const lastRakah = view.rakah === plan.length;
    const next = () => lastStep ? (lastRakah ? setView({ name: 'quiz', prayer: view.prayer }) : setView({ ...view, rakah: view.rakah + 1, step: 0 })) : setView({ ...view, step: view.step + 1 });
    const previous = () => view.step > 0 ? setView({ ...view, step: view.step - 1 }) : view.rakah > 1 ? setView({ ...view, rakah: view.rakah - 1, step: plan[view.rakah - 2].steps.length - 1 }) : undefined;
    return <Screen title={`${view.prayer.name} · ${view.prayer.rakahs} rak‘ahs`} back={back}>
      <Row>{plan.map(item => <Button key={item.number} label={`${item.number === view.rakah ? '✓ ' : ''}Rak‘ah ${item.number}`} secondary={item.number !== view.rakah} onPress={() => setView({ ...view, rakah: item.number, step: 0 })} />)}</Row>
      <Text style={styles.caption}>Rak‘ah {view.rakah} of {plan.length} · step {view.step + 1} of {rakah.steps.length}</Text>
      <Card>{step.illustration && <LessonIllustration kind={step.illustration} />}<Text style={styles.heading}>{step.title}</Text><Text style={styles.body}>{step.action}</Text>{audio && <NarrationButton text={`${step.title}. ${step.action}`} label="▶ Hear this step" />}</Card>
      {step.recitation && <RecitationCard recitation={step.recitation} fontSize={settings.fontSize} audioEnabled={audio} networkAllowed={settings.networkEnabled} />}
      <Row><Button label="Previous" secondary disabled={view.step === 0 && view.rakah === 1} onPress={previous} /><Button label={lastStep && lastRakah ? 'Check what I learned' : 'Next'} onPress={next} /></Row>
    </Screen>;
  }
  if (view.name === 'quiz') {
    return <Screen title={`${view.prayer.name} quiz`} back={back}>
      <QuizEngine questions={guide.lesson.quiz} audioEnabled={audio} networkAllowed={settings.networkEnabled} title="Check what you learned" onComplete={async score => {
        try { await saveProgress(`salah:${view.prayer.id}`, score); setMessage(score >= 80 ? 'MashaAllah! Your Salah lesson is saved.' : 'Practise once more with your adult and try again.'); }
        catch { setMessage('Your practice could not be saved. Ask a parent for help.'); }
      }} />
      {!!message && <Body>{message}</Body>}
      <Button label="Record my Salah practice" secondary onPress={() => router.push({ pathname: '/record', params: { kind: 'salah_demonstration', itemRef: view.prayer.id, title: `${view.prayer.name} prayer` } })} />
    </Screen>;
  }
  return <Screen title="Salah — Learn to Pray">
    {guide.status === 'preview' && <PreviewBanner />}
    <Body>Learn each prayer step by step, one rak‘ah at a time.</Body>
    <Button label="Getting ready to pray" onPress={() => setView({ name: 'prepare', step: 0 })} />
    {PRAYERS.map(prayer => <Card key={prayer.id}>
      <Text style={styles.heading}>{prayer.name} · {prayer.arabicName}</Text>
      <Text style={styles.body}>{prayer.rakahs} rak‘ahs · {prayer.time}</Text>
      {rakahDifferences(prayer).map(note => <Text key={note} style={styles.caption}>• {note}</Text>)}
      <Button label={`Learn ${prayer.name}`} onPress={() => setView({ name: 'prayer', prayer, rakah: 1, step: 0 })} />
    </Card>)}
    <Card>
      <Text style={styles.heading}>Different ways to pray</Text>
      <Text style={styles.body}>Muslims follow recognised schools of Islamic law. They agree on the prayer’s main parts and differ on some details, such as:</Text>
      {SCHOOL_DIFFERENCES.map(item => <Text key={item} style={styles.caption}>• {item}</Text>)}
      <Text style={styles.body}>Your family’s choice: {SALAH_APPROACHES[guide.approach]}. Your teacher will show you these details.</Text>
      <Text style={styles.caption}>{SALAH_REFERENCE_NOTE}</Text>
    </Card>
  </Screen>;
}
