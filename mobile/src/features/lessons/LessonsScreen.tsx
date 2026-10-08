import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Screen, colors } from '../../components/Common/ui';
import { QuizEngine } from '../../components/Quiz/QuizEngine';
import { duaFixtures } from '../../content/lessons/duas';
import { isPublishedForFamily, visibleLessons } from '../../content/lessons/approval';
import { loadStoredLessons, seedReviewLessons } from '../../content/lessons/storage';
import { hadithFixtures } from '../../content/fixtures/hadith';
import { getDb } from '../../services/database/database';
import { HadithRepository } from '../../services/hadith/HadithRepository';
import { DevelopmentHadithProvider } from '../../services/hadith/DevelopmentHadithProvider';
import { AudioControls } from '../../services/audio/AudioControls';
import { NarrationButton } from '../../services/audio/NarrationButton';
import { useAppStore } from '../../state/appStore';
import type { EducationLesson } from '../../types/lessons';
import { LessonIllustration } from './LessonIllustration';
import { SourceReadingLibrary } from './SourceReadingLibrary';
import { hasAvailableEditorialLessons } from './sourceReadingRepository';
import { agePracticeGuidance } from '../../content/lessons/ageGuidance';

export interface LessonsScreenProps {
  category: 'hadith' | 'islam' | 'duas';
  onComplete: (id: string, score?: number) => Promise<void>;
  developmentContent: boolean;
  fontSize: number;
  childId?: number;
  narrationEnabled?: boolean;
  childAge?: number | null;
  onOpenParent?: () => void;
}

export function LessonsScreen(props: LessonsScreenProps) {
  const router = useRouter();
  const selectedChildId = useAppStore(state => state.selectedChildId);
  const networkAllowed = useAppStore(state => state.settings.networkEnabled);
  const audioEnabled = useAppStore(state => state.settings.audioEnabled);
  const childId = props.childId ?? selectedChildId ?? undefined;
  const storedAge = useAppStore(state => state.children.find(child => child.id === childId)?.age);
  const childAge = props.childAge ?? storedAge;
  const title = props.category === 'hadith' ? 'Hadith' : props.category === 'duas' ? 'Duas' : 'Learn Islam';
  return <Screen title={title}><LessonEntry key={`${props.category}:${childId}:${childAge}:${props.developmentContent}`} {...props} childId={childId} childAge={childAge} onOpenParent={props.onOpenParent ?? (() => router.push('/parent'))} networkAllowed={networkAllowed} narrationEnabled={audioEnabled && (props.narrationEnabled ?? true)} /></Screen>;
}

function LessonEntry(props: LessonsScreenProps & { networkAllowed: boolean }) {
  const [education, setEducation] = useState(false);
  const [hasEducation, setHasEducation] = useState(false);
  useFocusEffect(useCallback(() => {
    if (props.category === 'islam') return;
    let mounted = true;
    setHasEducation(false);
    const category = props.category;
    void getDb().then(db => hasAvailableEditorialLessons(db, category, props.developmentContent, props.childAge)).then(available => {
      if (mounted) setHasEducation(available);
    }).catch(() => { if (mounted) setHasEducation(false); });
    return () => { mounted = false; };
  }, [props.category, props.developmentContent, props.childAge]));
  if (props.category === 'islam') return <LessonContent {...props} />;
  if (!education) return <SourceReadingLibrary category={props.category} childId={props.childId} fontSize={props.fontSize} networkAllowed={props.networkAllowed} audioEnabled={props.narrationEnabled ?? false} onComplete={props.onComplete} onLessons={hasEducation ? () => setEducation(true) : undefined} />;
  return <View style={styles.stack}><Button label="← Sourced readings" secondary onPress={() => setEducation(false)} /><LessonContent {...props} /></View>;
}

function LessonContent({ category, onComplete, developmentContent, fontSize, childId, childAge, onOpenParent, narrationEnabled = false, networkAllowed }: LessonsScreenProps & { networkAllowed: boolean }) {
  const activeChild = childId;
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState<'lessons' | 'collections' | 'saved'>('lessons');
  const [search, setSearch] = useState('');
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [storedLessons, setStoredLessons] = useState<EducationLesson[]>([]);
  const [step, setStep] = useState(0);
  const [quizzing, setQuizzing] = useState(false);
  const [memorizing, setMemorizing] = useState(false);
  const [hideDua, setHideDua] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const lock = useRef(false);
  const approved = useMemo(() => visibleLessons(storedLessons, developmentContent, childAge).filter(item => item.category === category), [storedLessons, category, developmentContent, childAge]);
  const lesson = approved.find(item => item.id === selected);
  const hadith = hadithFixtures.find(item => item.id === lesson?.hadithId);
  const dua = duaFixtures.find(item => item.id === lesson?.duaId);
  const loadLessons = useCallback(async () => {
    const db = await getDb();
    if (developmentContent) await seedReviewLessons(db);
    const lessons = await loadStoredLessons(db);
    const ids = activeChild ? await new HadithRepository(db, new DevelopmentHadithProvider()).savedIds(activeChild) : [];
    return { lessons, ids };
  }, [activeChild, developmentContent]);
  useFocusEffect(useCallback(() => {
    let mounted = true;
    void loadLessons().then(({ lessons, ids }) => { if (mounted) { setStoredLessons(lessons); setSavedIds(ids); setReady(true); } })
      .catch(() => { if (mounted) setMessage('Local lessons could not be loaded. Please retry.'); });
    return () => { mounted = false; setReady(false); };
  }, [loadLessons]));
  const initialize = async () => {
    setMessage('');
    try { const { lessons, ids } = await loadLessons(); setStoredLessons(lessons); setSavedIds(ids); setReady(true); }
    catch { setMessage('Local lessons could not be loaded. Please retry.'); }
  };
  const selectLesson = (item: EducationLesson) => { setSelected(item.id); setStep(0); setQuizzing(false); setMemorizing(false); setHideDua(false); setMessage(''); };
  const text = [styles.body, { fontSize: Math.max(16, fontSize * 0.55), lineHeight: Math.max(26, fontSize * 0.85) }];
  const complete = async (id: string, score?: number) => {
    await onComplete(id, score);
    setMessage('MashaAllah! Your practice is saved.');
  };
  const finish = async () => {
    if (!lesson || lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try { await complete(lesson.id); }
    catch { setMessage('Your practice could not be saved. Please try again.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const toggleSaved = async () => {
    if (!hadith || !activeChild || lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try {
      const repo = new HadithRepository(await getDb(), new DevelopmentHadithProvider());
      await repo.get(hadith.collection, hadith.hadithNumber);
      if (savedIds.includes(hadith.id)) await repo.unsave(activeChild, hadith.id); else await repo.save(activeChild, hadith.id);
      setSavedIds(await repo.savedIds(activeChild));
    } catch { setMessage('Could not update saved Hadith. Please try again.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const memorize = async () => {
    if (!dua || !activeChild || lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try {
      const db = await getDb();
      await db.runAsync('INSERT INTO memorization_progress(child_id,verse_key,level,rating,last_practiced) VALUES(?,?,?,?,?) ON CONFLICT(child_id,verse_key) DO UPDATE SET level=excluded.level,rating=excluded.rating,last_practiced=excluded.last_practiced', activeChild, dua.id, 'COMPLETE', 'self-marked', new Date().toISOString());
      await complete(dua.id);
    } catch { setMessage('Your memorization practice could not be saved. Please try again.'); }
    finally { lock.current = false; setBusy(false); }
  };
  if (!ready) return <Card><Text style={text}>{message || 'Opening your local lessons…'}</Text>{!!message && <Button label="Retry" onPress={() => { void initialize(); }} />}</Card>;
  if (!lesson) {
    const listed = approved.filter(item => (!search || `${item.title} ${item.topic} ${item.source.sourceReference} ${hadithFixtures.find(h => h.id === item.hadithId)?.canonicalText ?? ''} ${duaFixtures.find(d => d.id === item.duaId)?.canonicalText ?? ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())) && (panel !== 'saved' || (!!item.hadithId && savedIds.includes(item.hadithId))));
    return <View style={styles.stack}>
      {developmentContent && <Card><Text style={styles.review}>Review pack • enabled by your parent</Text><Text style={text}>These learning ideas are awaiting qualified review. Learn together with your adult.</Text></Card>}
      {category === 'hadith' && <View style={styles.stack}><Button label="Hadith lessons" secondary={panel !== 'lessons'} onPress={() => setPanel('lessons')} /><Button label="Collections" secondary={panel !== 'collections'} onPress={() => setPanel('collections')} /><Button label={`Saved Hadith (${savedIds.length})`} secondary={panel !== 'saved'} onPress={() => setPanel('saved')} /></View>}
      <TextInput accessibilityLabel="Search lessons in Arabic or English" placeholder="Search a topic, source, or Arabic phrase" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={styles.search} />
      {!approved.length && <Card><Text style={styles.heading}>Let’s get your next lesson ready</Text><Text style={text}>Ask your adult to open Content review in Parent Mode, choose the right ages, and publish a lesson after their qualified reviewer checks it. Your source readings and Arabic practice are ready while you wait.</Text>{onOpenParent && <Button label="Open Parent Mode" secondary onPress={onOpenParent} />}</Card>}
      {panel === 'collections' && approved.length > 0 && <Card><Text style={styles.heading}>Sahih al-Bukhari</Text><Text style={text}>Three selected teaching excerpts. Each lesson identifies its narrator and reference. Source text and our learning ideas are stored separately.</Text><Button label="Explore the three excerpts" onPress={() => setPanel('lessons')} /></Card>}
      {panel !== 'collections' && listed.map(item => <Card key={item.id}><Text style={styles.heading}>{item.title}</Text><Text style={text}>{item.subtitle}</Text><Text style={styles.caption}>{item.topic}{item.ageRange ? ` · Ages ${item.ageRange.min}–${item.ageRange.max}` : ''}</Text><Button label={`Open ${item.title}`} onPress={() => selectLesson(item)} /></Card>)}
      {approved.length > 0 && panel !== 'collections' && !listed.length && <Card><Text style={text}>{panel === 'saved' ? 'Save a Hadith from a lesson to find it here.' : 'No lessons match your search.'}</Text></Card>}
    </View>;
  }
  const displayedSections = lesson.stepByStep ? [lesson.sections[step]] : lesson.sections;
  return <View style={styles.stack}>
    <Button label="← All lessons" secondary onPress={() => { setSelected(null); setMessage(''); }} />
    <Text accessibilityRole="header" style={styles.heading}>{lesson.title}</Text>
    {isPublishedForFamily(lesson) ? <Text style={styles.caption}>Published for your family · {lesson.ageRange && `Ages ${lesson.ageRange.min}–${lesson.ageRange.max}`}</Text> : lesson.review.developmentOnly && <Text style={styles.review}>Parent-enabled review lesson · awaiting publication</Text>}
    <Text style={text}>{agePracticeGuidance(childAge)}</Text>
    <Card><Text style={styles.caption}>{lesson.source.sourceReference}</Text><Text style={styles.caption}>{lesson.source.translationName ?? 'Source reference with original learning summary'}</Text></Card>
    {hadith && <Card><Text style={styles.heading}>Sourced Hadith excerpt</Text><Text style={styles.caption}>A selected phrase from the full narration</Text><Text accessibilityLanguage="ar" style={[styles.arabic, { fontSize: Math.max(32, fontSize), lineHeight: Math.max(55, fontSize * 1.7) }]}>{hadith.canonicalText}</Text><Text style={text}>{hadith.translation}</Text><Text style={styles.caption}>Narrator: {hadith.narrator}</Text><Text style={styles.caption}>Source: {hadith.source.sourceReference}</Text><Text style={styles.caption}>Grade: {hadith.grades.length ? hadith.grades.map(g => `${g.grade} (${g.gradedBy})`).join(', ') : 'No separate grade field supplied in this excerpt.'}</Text><Button label={savedIds.includes(hadith.id) ? 'Remove from Saved Hadith' : '★ Save this Hadith'} secondary disabled={busy || !activeChild} onPress={() => { void toggleSaved(); }} /></Card>}
    {dua && <Card><Text style={styles.heading}>{dua.textScope === 'excerpt' ? 'Sourced dua excerpt' : 'Sourced supplication'}</Text><Text accessibilityLanguage="ar" style={[styles.arabic, { fontSize: Math.max(32, fontSize), lineHeight: Math.max(55, fontSize * 1.7) }]}>{hideDua ? '•••' : dua.canonicalText}</Text><Text style={text}>{dua.transliteration}</Text><Text style={text}>{dua.translation}</Text>{dua.audioUri ? <AudioControls key={dua.id} tracks={[{ id: `${dua.id}:recording`, title: dua.title, uri: dua.audioUri, sourceLabel: `Recording for ${dua.source.sourceReference}` }]} networkAllowed={networkAllowed} audioEnabled={narrationEnabled} /> : <Text style={styles.caption}>Source audio is not supplied for this teaching selection. Practice pronunciation with your adult.</Text>}<Button label={memorizing ? 'Return to reading' : 'Memorize this dua'} secondary onPress={() => { setMemorizing(!memorizing); setHideDua(false); }} />{memorizing && <><Text style={text}>Read together → repeat → hide the Arabic → try from memory.</Text><Button label={hideDua ? 'Show Arabic' : 'Hide Arabic for practice'} secondary onPress={() => setHideDua(!hideDua)} /><Button label="😊 I practiced from memory" disabled={busy || !activeChild} onPress={() => { void memorize(); }} /><Text style={styles.caption}>You mark your own practice; the app does not judge pronunciation.</Text></>}</Card>}
    {!quizzing && displayedSections.map((section, index) => <Card key={`${lesson.id}-${step}-${index}`}>
      {lesson.stepByStep && <Text style={styles.caption}>Step {step + 1} of {lesson.sections.length}</Text>}
      {section.illustration && <LessonIllustration kind={section.illustration} />}
      <Text style={styles.heading}>{section.title}</Text><Text style={styles.caption}>{section.kind === 'source_fact' ? 'Source-based fact • original summary' : section.kind === 'explanation' ? 'Our original learning idea' : 'Practice together'}</Text><Text style={text}>{section.body}</Text>
      {section.sourceReference && <Text style={styles.caption}>Reference: {section.sourceReference}</Text>}
      {section.audioUri ? <AudioControls key={`${lesson.id}-${step}-${index}:recording`} tracks={[{ id: `${lesson.id}-${step}-${index}`, title: section.title, uri: section.audioUri, sourceLabel: `Recording for ${section.sourceReference ?? lesson.source.sourceReference}` }]} networkAllowed={networkAllowed} audioEnabled={narrationEnabled} /> : narrationEnabled && <NarrationButton key={`${lesson.id}-${step}-${index}`} text={section.body} label="▶ Hear the learning instruction" enabled={narrationEnabled} />}
    </Card>)}
    {!quizzing && lesson.stepByStep && <View style={styles.row}><View style={styles.flex}><Button label="Previous" secondary disabled={step === 0} onPress={() => setStep(step - 1)} /></View><View style={styles.flex}><Button label="Next" disabled={step === lesson.sections.length - 1} onPress={() => setStep(step + 1)} /></View></View>}
    {!quizzing && (!lesson.stepByStep || step === lesson.sections.length - 1) && <><Card><Text style={styles.heading}>Discussion corner</Text><Text style={text}>{lesson.discussion}</Text></Card><Button label={lesson.quiz.length ? 'Take the lesson quiz' : 'Complete this lesson'} disabled={busy} onPress={() => { if (lesson.quiz.length) setQuizzing(true); else void finish(); }} /></>}
    {quizzing && <QuizEngine key={lesson.id} questions={lesson.quiz} networkAllowed={networkAllowed} audioEnabled={narrationEnabled} onComplete={score => complete(lesson.id, score)} />}
    {!!message && <Text accessibilityLiveRegion="polite" style={text}>{message}</Text>}
  </View>;
}

const styles = StyleSheet.create({ stack: { gap: 14 }, row: { flexDirection: 'row', gap: 12 }, flex: { flex: 1 }, heading: { color: colors.ink, fontSize: 23, lineHeight: 31, fontWeight: '700' }, body: { color: colors.ink, writingDirection: 'ltr' }, caption: { color: '#52634c', fontSize: 14, lineHeight: 21 }, review: { color: '#71491b', fontSize: 15, fontWeight: '600', lineHeight: 23 }, arabic: { writingDirection: 'rtl', textAlign: 'right', color: colors.ink }, search: { borderWidth: 1, borderColor: '#94a58b', minHeight: 54, padding: 14, borderRadius: 15, fontSize: 17, color: colors.ink, backgroundColor: '#fffdf6' } });

export default LessonsScreen;
