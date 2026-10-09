import { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Body, Button, Card, Screen } from '../../components/Common/ui';
import { QuizEngine } from '../../components/Quiz/QuizEngine';
import { LessonIllustration } from '../lessons/LessonIllustration';
import { NarrationButton } from '../../services/audio/NarrationButton';
import { WUDU_STEPS, WUDU_TOPICS } from '../../content/salah/salahGuide';
import { useAppStore } from '../../state/appStore';
import { GuideHidden, PreviewBanner, Row, styles } from './GuideParts';
import { useGuide } from './useGuide';

export default function WuduScreen() {
  const router = useRouter();
  const { settings, children, selectedChildId, saveProgress } = useAppStore();
  const child = children.find(item => item.id === selectedChildId);
  const guide = useGuide('guide-wudu', settings.developmentContent, child?.age);
  const [step, setStep] = useState<number | null>(null);
  const [quiz, setQuiz] = useState(false);
  const [message, setMessage] = useState('');
  if (guide.status === 'loading') return <Screen title="Wudu — Learn Purification"><Body>Opening the guide…</Body></Screen>;
  if (guide.status === 'error') return <Screen title="Wudu — Learn Purification"><Body>The guide could not open. Please try again.</Body></Screen>;
  if (guide.status === 'hidden') return <Screen title="Wudu — Learn Purification"><GuideHidden name="Wudu" onParent={() => router.push('/parent')} /></Screen>;
  const home = () => { setStep(null); setQuiz(false); setMessage(''); };
  if (quiz) return <Screen title="Wudu quiz" back={home}>
    <QuizEngine questions={guide.lesson.quiz} audioEnabled={settings.audioEnabled} networkAllowed={settings.networkEnabled} title="Check what you learned" onComplete={async score => {
      try { await saveProgress('wudu:guide', score); setMessage(score >= 80 ? 'MashaAllah! Your wudu lesson is saved.' : 'Practise once more and try again.'); }
      catch { setMessage('Your practice could not be saved. Ask a parent for help.'); }
    }} />
    {!!message && <Body>{message}</Body>}
  </Screen>;
  if (step !== null) {
    const current = WUDU_STEPS[step];
    return <Screen title="Wudu step by step" back={home}>
      <Text style={styles.caption}>Step {step + 1} of {WUDU_STEPS.length}</Text>
      <Card>{current.illustration && <LessonIllustration kind={current.illustration} />}<Text style={styles.heading}>{current.title}</Text><Text style={styles.body}>{current.action}</Text>{current.count && <Text style={styles.transliteration}>{current.count}</Text>}{current.reference && <Text style={styles.caption}>Reference: {current.reference}</Text>}{settings.audioEnabled && <NarrationButton text={`${current.title}. ${current.action}${current.count ? `. ${current.count}.` : ''}`} label="▶ Hear this step" />}</Card>
      <Row><Button label="Previous" secondary disabled={step === 0} onPress={() => setStep(step - 1)} />{step < WUDU_STEPS.length - 1 ? <Button label="Next" onPress={() => setStep(step + 1)} /> : <Button label="Check what I learned" onPress={() => setQuiz(true)} />}</Row>
    </Screen>;
  }
  return <Screen title="Wudu — Learn Purification">
    {guide.status === 'preview' && <PreviewBanner />}
    <Body>Wudu is the washing we do before prayer. Practise it with your adult at the sink.</Body>
    <Button label="Learn wudu step by step" onPress={() => setStep(0)} />
    <Card>{WUDU_STEPS.map(item => <Text key={item.id} style={styles.body}>{item.title}{item.count ? ` · ${item.count}` : ''}</Text>)}</Card>
    {WUDU_TOPICS.map(topic => <Card key={topic.title}><Text style={styles.heading}>{topic.title}</Text>{topic.points.map(point => <Text key={point} style={styles.body}>• {point}</Text>)}{topic.reference && <Text style={styles.caption}>Reference: {topic.reference}</Text>}</Card>)}
    <Button label="Take the wudu quiz" secondary onPress={() => setQuiz(true)} />
    <Button label="Record my wudu" secondary onPress={() => router.push({ pathname: '/record', params: { kind: 'wudu_demonstration', itemRef: 'wudu', title: 'Wudu demonstration' } })} />
  </Screen>;
}
