import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Body, Button, Card, Field, Screen, colors } from '../../components/Common/ui';
import { LessonReviewRepository } from '../../content/lessons/reviewRepository';
import { getDb } from '../../services/database/database';
import { useAppStore } from '../../state/appStore';
import { hadithFixtures } from '../../content/fixtures/hadith';
import { duaFixtures } from '../../content/lessons/duas';
import { canParentPublishLesson, isPublishedForFamily, validAgeRange } from '../../content/lessons/approval';
import { quizReviewLines } from '../../content/lessons/quizReview';
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
    <Card><Body>Review the teaching, choose its ages, record your qualified reviewer’s review, then approve and publish it for your family. Nothing publishes automatically.</Body><Body>Source Arabic, translations, references, and licenses stay unchanged. Reviewer records are your attestations; the app does not verify identity or qualifications.</Body></Card>
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!ready && <><Body>{error ? 'Content could not be loaded.' : 'Opening local teaching content…'}</Body>{!!error && <Button label="Retry content loading" onPress={() => { void retry(); }} />}</>}
    {ready && !current && lessons.map(lesson => <Card key={lesson.id}><Text style={styles.heading}>{lesson.title}</Text><Body>{lesson.category} · {lesson.review.status.replace('_', ' ')} · version {lesson.review.version}</Body><Body>{lesson.ageRange ? `Ages ${lesson.ageRange.min}–${lesson.ageRange.max}` : 'Choose intended ages before review'}{isPublishedForFamily(lesson) ? ' · published for your family' : ' · awaiting family publication'}</Body><Button label={`Review ${lesson.title}`} secondary onPress={() => setSelected(lesson.id)} /></Card>)}
    {current && <><Button label="← All content" secondary onPress={() => setSelected(null)} /><LessonEditor key={`${current.id}:${current.review.version}`} lesson={current} onUpdated={onUpdated} /></>}
  </Screen>;
}

function LessonEditor({ lesson, onUpdated }: { lesson: EducationLesson; onUpdated: (lesson: EducationLesson) => void }) {
  const [sections, setSections] = useState(lesson.sections.map(section => ({ title: section.title, body: section.body })));
  const [discussion, setDiscussion] = useState(lesson.discussion);
  const [reviewer, setReviewer] = useState(lesson.review.reviewer ?? '');
  const [attested, setAttested] = useState(false);
  const [ageMin, setAgeMin] = useState(String(lesson.ageRange?.min ?? 5));
  const [ageMax, setAgeMax] = useState(String(lesson.ageRange?.max ?? 15));
  const [parentApproved, setParentApproved] = useState(false);
  const [permissionConfirmed, setPermissionConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const ageRange = { min: Number(ageMin), max: Number(ageMax) };
  const ageValid = validAgeRange(ageRange);
  const dirty = !lesson.ageRange || ageRange.min !== lesson.ageRange.min || ageRange.max !== lesson.ageRange.max || discussion !== lesson.discussion || sections.some((section, index) => section.title !== lesson.sections[index].title || section.body !== lesson.sections[index].body);
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
    <Card><Body>Status: {lesson.review.status.replace('_', ' ')} · teaching version {lesson.review.version}</Body><Body>Source: {lesson.source.sourceReference}</Body><Body>{lesson.source.sourceUrl}</Body><Body>{lesson.source.license}</Body><Body>{canParentPublishLesson(lesson) ? 'This lesson can be published for your family after review and parent approval.' : 'This restricted source pack is available for preview only.'}</Body>{lesson.review.reviewer && <Body>Reviewer named by parent: {lesson.review.reviewer} · approved version {lesson.review.approvedVersion}</Body>}{lesson.review.publication && <Body>Family publication recorded: {new Date(lesson.review.publication.publishedAt).toLocaleDateString()}</Body>}</Card>
    {(hadith || dua) && <Card><Text style={styles.heading}>Immutable source selection</Text><Text accessibilityLanguage="ar" style={styles.arabic}>{hadith?.canonicalText ?? dua?.canonicalText}</Text><Body>{hadith?.translation ?? dua?.translation}</Body>{dua && <><Body>Original pronunciation aid to include in review:</Body><Body>{dua.transliteration}</Body></>}</Card>}
    <Card><Text style={styles.heading}>Intended ages</Text><Body>Choose the ages this teaching version suits. Your reviewer should check the language, activities, pronunciation aids, and quiz for this range.</Body><View style={styles.ageRow}>{[[5, 7], [8, 11], [12, 15]].map(([min, max]) => <View key={min} style={styles.ageChoice}><Button label={`${min}–${max}`} secondary disabled={busy} onPress={() => { setAgeMin(String(min)); setAgeMax(String(max)); }} /></View>)}</View><Field label="Youngest age (5–15)" value={ageMin} keyboardType="number-pad" maxLength={2} editable={!busy} onChangeText={setAgeMin} /><Field label="Oldest age (5–15)" value={ageMax} keyboardType="number-pad" maxLength={2} editable={!busy} onChangeText={setAgeMax} />{!ageValid && <Body>Use whole ages from 5 to 15, with the youngest age first.</Body>}</Card>
    {sections.map((section, index) => <Card key={index}><Text style={styles.heading}>Original teaching section {index + 1}</Text><Body>{lesson.sections[index].kind === 'source_fact' ? 'Original summary of a cited source. Recheck the cited facts when editing.' : 'Original explanation or learning activity.'}</Body><Field label={`Section ${index + 1} title`} value={section.title} editable={!busy} maxLength={120} onChangeText={title => setSections(items => items.map((item, i) => i === index ? { ...item, title } : item))} /><Field label={`Section ${index + 1} teaching text`} value={section.body} editable={!busy} multiline maxLength={5000} textAlignVertical="top" onChangeText={body => setSections(items => items.map((item, i) => i === index ? { ...item, body } : item))} />{lesson.sections[index].sourceReference && <Body>Immutable reference: {lesson.sections[index].sourceReference}</Body>}</Card>)}
    <Card><Field label="Original discussion text" value={discussion} onChangeText={setDiscussion} editable={!busy} multiline textAlignVertical="top" maxLength={2000} /><Body>Saving teaching or age changes creates a new version and withdraws approval and publication.</Body><Button label="Save teaching and ages" disabled={busy || !dirty || !ageValid} onPress={() => { void run(repo => repo.edit(lesson.id, lesson.review.version, { sections, discussion, ageRange }), 'New teaching version saved. Review and publication were withdrawn.'); }} /></Card>
    {!!lesson.quiz.length && <Card><Text style={styles.heading}>Quiz and answer key for review</Text>{lesson.quiz.map(question => <View key={question.id}><Body>{question.prompt}</Body>{quizReviewLines(question).map((line, index) => <Body key={index}>{line}</Body>)}{question.explanation && <Body>{question.explanation}</Body>}{question.sourceReference && <Body>Reference: {question.sourceReference}</Body>}</View>)}<Body>Quiz questions are read-only here. Ask a content editor to correct the question and answer key before approving if needed.</Body></Card>}
    <Card><Text style={styles.heading}>Review and publication</Text><Button label="Request review / withdraw publication" secondary disabled={busy || dirty} onPress={() => { void run(repo => repo.requestReview(lesson.id, lesson.review.version), 'Review requested. Any approval and family publication were withdrawn.'); }} /><Field label="Qualified reviewer’s name" value={reviewer} editable={!busy} maxLength={120} onChangeText={setReviewer} /><View style={styles.attestation}><View style={styles.ageChoice}><Body>I confirm the named qualified reviewer checked this exact version, its intended ages, pronunciation aids, and quiz. This is my attestation; the app has not verified the reviewer.</Body></View><Switch accessibilityLabel="Confirm named qualified reviewer reviewed this version and ages" value={attested} disabled={busy || dirty} onValueChange={setAttested} /></View><Button label="Record reviewer approval" disabled={busy || dirty || !ageValid || !reviewer.trim() || !attested || lesson.review.status !== 'needs_review'} onPress={() => { void run(repo => repo.approve(lesson.id, lesson.review.version, reviewer, attested), 'Reviewer attestation recorded. Parent publication is still required.'); }} /><View style={styles.attestation}><View style={styles.ageChoice}><Body>I approve version {lesson.review.version} for ages {ageMin}–{ageMax} in my family, with adult guidance.</Body></View><Switch accessibilityLabel="Approve this lesson and age range for my family" value={parentApproved} disabled={busy || dirty || lesson.review.status !== 'approved'} onValueChange={setParentApproved} /></View><View style={styles.attestation}><View style={styles.ageChoice}><Body>I checked the cited source permissions and confirm they allow this family teaching use. Review does not grant new source rights.</Body></View><Switch accessibilityLabel="Confirm permission for the cited source use" value={permissionConfirmed} disabled={busy || dirty || lesson.review.status !== 'approved'} onValueChange={setPermissionConfirmed} /></View><Button label="Publish reviewed lesson for my family" disabled={busy || dirty || !ageValid || !canParentPublishLesson(lesson) || !parentApproved || !permissionConfirmed || lesson.review.status !== 'approved'} onPress={() => { void run(repo => repo.publish(lesson.id, lesson.review.version, { parentSuitabilityConfirmed: parentApproved, sourcePermissionConfirmed: permissionConfirmed }), 'Reviewed lesson published for your family.'); }} />{dirty && <Body>Save or undo your edits before changing review status.</Body>}</Card>
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
  </View>;
}

const styles = StyleSheet.create({ stack: { gap: 14 }, ageRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, ageChoice: { flex: 1 }, heading: { fontSize: 22, lineHeight: 31, color: colors.ink, fontWeight: '700' }, error: { color: '#823b29', fontSize: 16 }, message: { color: colors.ink, fontSize: 17, lineHeight: 26 }, arabic: { fontSize: 36, lineHeight: 62, writingDirection: 'rtl', textAlign: 'right', color: colors.ink }, attestation: { flexDirection: 'row', gap: 10, alignItems: 'center' } });
export default ContentReviewScreen;
