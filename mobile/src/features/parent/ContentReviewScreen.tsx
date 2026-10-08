import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Body, Button, Card, Field, Screen, colors } from '../../components/Common/ui';
import { LessonReviewRepository } from '../../content/lessons/reviewRepository';
import { getDb } from '../../services/database/database';
import { useAppStore } from '../../state/appStore';
import { hadithFixtures } from '../../content/fixtures/hadith';
import { duaFixtures } from '../../content/lessons/duas';
import type { EducationLesson } from '../../types/lessons';

export function ContentReviewScreen({ onBack }: { onBack: () => void }) {
  const parentUnlocked = useAppStore(state => state.parentUnlocked);
  const [lessons, setLessons] = useState<EducationLesson[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const load = useCallback(async () => new LessonReviewRepository(await getDb(), () => useAppStore.getState().parentUnlocked).list(), []);
  useEffect(() => {
    let mounted = true;
    void load().then(items => { if (mounted) { setLessons(items); setReady(true); } })
      .catch(e => { if (mounted) setError(e instanceof Error ? e.message : 'Could not load content for review.'); });
    return () => { mounted = false; };
  }, [load]);
  const retry = async () => { setError(''); try { setLessons(await load()); setReady(true); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load content.'); } };
  const onUpdated = (updated: EducationLesson) => { setLessons(items => items.map(item => item.id === updated.id ? updated : item)); };
  const current = lessons.find(item => item.id === selected);
  if (!parentUnlocked) return <Screen title="Content review" back={onBack}><Body>Unlock Parent Mode to review and edit teaching content.</Body></Screen>;
  return <Screen title="Content review" back={onBack}>
    <Card><Body>Only original teaching summaries, learning instructions, and discussion text can be edited here. Source Arabic, translations, references, and licenses stay unchanged.</Body><Body>Approval records a parent-entered reviewer attestation. The app does not verify a reviewer’s identity or qualifications. Development packs remain restricted to parent-enabled review mode after approval.</Body></Card>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!ready && <><Body>{error ? 'Content could not be loaded.' : 'Opening local teaching content…'}</Body>{!!error && <Button label="Retry content loading" onPress={() => { void retry(); }} />}</>}
    {ready && !current && lessons.map(lesson => <Card key={lesson.id}><Text style={styles.heading}>{lesson.title}</Text><Body>{lesson.category} · {lesson.review.status.replace('_', ' ')} · version {lesson.review.version}</Body><Body>{lesson.review.developmentOnly ? 'Development / review pack' : 'Production content pack'}</Body><Button label={`Review ${lesson.title}`} secondary onPress={() => setSelected(lesson.id)} /></Card>)}
    {current && <><Button label="← All content" secondary onPress={() => setSelected(null)} /><LessonEditor key={`${current.id}:${current.review.version}`} lesson={current} onUpdated={onUpdated} /></>}
  </Screen>;
}

function LessonEditor({ lesson, onUpdated }: { lesson: EducationLesson; onUpdated: (lesson: EducationLesson) => void }) {
  const [sections, setSections] = useState(lesson.sections.map(section => ({ title: section.title, body: section.body })));
  const [discussion, setDiscussion] = useState(lesson.discussion);
  const [reviewer, setReviewer] = useState(lesson.review.reviewer ?? '');
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const dirty = discussion !== lesson.discussion || sections.some((section, index) => section.title !== lesson.sections[index].title || section.body !== lesson.sections[index].body);
  const run = async (work: (repository: LessonReviewRepository) => Promise<EducationLesson>, success: string) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try {
      const repository = new LessonReviewRepository(await getDb(), () => useAppStore.getState().parentUnlocked);
      const updated = await work(repository);
      onUpdated(updated); setMessage(success);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Content could not be updated. Please retry.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const hadith = hadithFixtures.find(record => record.id === lesson.hadithId);
  const dua = duaFixtures.find(record => record.id === lesson.duaId);
  return <View style={styles.stack}>
    <Text accessibilityRole="header" style={styles.heading}>{lesson.title}</Text>
    <Card><Body>Status: {lesson.review.status.replace('_', ' ')} · teaching version {lesson.review.version}</Body><Body>Source: {lesson.source.sourceReference}</Body><Body>{lesson.source.sourceUrl}</Body><Body>{lesson.source.license}</Body><Body>{lesson.review.developmentOnly ? 'This pack cannot be published for production child mode.' : 'Publishing requires approved teaching content and unchanged source permissions.'}</Body>{lesson.review.reviewer && <Body>Entered reviewer: {lesson.review.reviewer} · approved version {lesson.review.approvedVersion}</Body>}</Card>
    {(hadith || dua) && <Card><Text style={styles.heading}>Immutable source selection</Text><Text accessibilityLanguage="ar" style={styles.arabic}>{hadith?.canonicalText ?? dua?.canonicalText}</Text><Body>{hadith?.translation ?? dua?.translation}</Body></Card>}
    {sections.map((section, index) => <Card key={index}><Text style={styles.heading}>Original teaching section {index + 1}</Text><Body>{lesson.sections[index].kind === 'source_fact' ? 'Original summary of a cited source. Recheck the cited facts when editing.' : 'Original explanation or learning activity.'}</Body><Field label={`Section ${index + 1} title`} value={section.title} editable={!busy} maxLength={120} onChangeText={title => setSections(items => items.map((item, i) => i === index ? { ...item, title } : item))} /><Field label={`Section ${index + 1} teaching text`} value={section.body} editable={!busy} multiline maxLength={5000} textAlignVertical="top" onChangeText={body => setSections(items => items.map((item, i) => i === index ? { ...item, body } : item))} />{lesson.sections[index].sourceReference && <Body>Immutable reference: {lesson.sections[index].sourceReference}</Body>}</Card>)}
    <Card><Field label="Original discussion text" value={discussion} onChangeText={setDiscussion} editable={!busy} multiline textAlignVertical="top" maxLength={2000} /><Body>Saving changes increases the teaching version, returns it to draft, and removes existing approval.</Body><Button label="Save teaching edits" disabled={busy || !dirty} onPress={() => { void run(repo => repo.edit(lesson.id, lesson.review.version, { sections, discussion }), 'Teaching edits saved. Approval has been removed.'); }} /></Card>
    {!!lesson.quiz.length && <Card><Text style={styles.heading}>Quiz preview for review</Text>{lesson.quiz.map(question => <View key={question.id}><Body>{question.prompt}</Body><Body>{question.explanation ?? 'Review the answer key in the content pack.'}</Body></View>)}<Body>Quiz questions are read-only here. A content-pack editor must update their source-backed answer keys if needed.</Body></Card>}
    <Card><Text style={styles.heading}>Review and publication</Text><Button label="Request review / withdraw approval" secondary disabled={busy || dirty} onPress={() => { void run(repo => repo.requestReview(lesson.id, lesson.review.version), 'Review requested. Any earlier approval has been removed.'); }} /><Field label="Qualified reviewer’s name" value={reviewer} editable={!busy} maxLength={120} onChangeText={setReviewer} /><View style={styles.attestation}><View style={{ flex: 1 }}><Body>I confirm that the named qualified reviewer reviewed this exact teaching version and its quiz. This is my attestation; the app has not verified the reviewer.</Body></View><Switch accessibilityLabel="Confirm named qualified reviewer reviewed this version" value={attested} disabled={busy} onValueChange={setAttested} /></View><Button label="Record reviewer approval" disabled={busy || dirty || !reviewer.trim() || !attested || lesson.review.status !== 'needs_review'} onPress={() => { void run(repo => repo.approve(lesson.id, lesson.review.version, reviewer, attested), 'Reviewer attestation recorded.'); }} /><Button label="Publish approved production lesson" disabled={busy || dirty || lesson.review.developmentOnly || lesson.review.status !== 'approved'} onPress={() => { void run(repo => repo.publish(lesson.id, lesson.review.version), 'Approved production lesson published.'); }} />{lesson.review.developmentOnly && <Body>Approval does not remove this pack’s development restriction. Parent-enabled review mode is still required.</Body>}{dirty && <Body>Save or undo your edits before changing review status.</Body>}</Card>
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
  </View>;
}

const styles = StyleSheet.create({ stack: { gap: 14 }, heading: { fontSize: 22, lineHeight: 31, color: colors.ink, fontWeight: '700' }, error: { color: '#823b29', fontSize: 16 }, message: { color: colors.ink, fontSize: 17, lineHeight: 26 }, arabic: { fontSize: 36, lineHeight: 62, writingDirection: 'rtl', textAlign: 'right', color: colors.ink }, attestation: { flexDirection: 'row', gap: 10, alignItems: 'center' } });
export default ContentReviewScreen;
