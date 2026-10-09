import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, colors } from '../../components/Common/ui';
import { SEEDED_AYAHS } from '../../services/quran/FixtureQuranProvider';
import { quranAudioAssets } from '../../content/fixtures/QuranAudioAssets';
import { AudioControls } from '../../services/audio/AudioControls';
import { arabicDisplayProps } from '../../services/quran/presentation';
import type { Recitation } from '../../content/salah/salahGuide';

/** Shown instead of the guide until a parent publishes it. */
export function GuideHidden({ name, onParent }: { name: string; onParent: () => void }) {
  return <Card><Text style={styles.heading}>Learn this with your parent</Text><Text style={styles.body}>{`Your parent checks the ${name} guide with your teacher before it opens here. Ask them to open Parent Mode → Review educational explanations.`}</Text><Button label="Parent mode" secondary onPress={onParent} /></Card>;
}
export function PreviewBanner() {
  return <Card><Text style={styles.review}>Preview · turned on by your parent</Text><Text style={styles.body}>This guide is still waiting for your parent’s review. Learn it together with your adult.</Text></Card>;
}
/** A phrase said in prayer. Qur’an text and audio come only from the bundled verified sources. */
export function RecitationCard({ recitation, fontSize, audioEnabled, networkAllowed }: { recitation: Recitation; fontSize: number; audioEnabled: boolean; networkAllowed: boolean }) {
  const ayahs = (recitation.quranKeys ?? []).map(key => SEEDED_AYAHS.find(ayah => ayah.key === key)).filter(ayah => !!ayah);
  return <Card>
    <Text style={styles.label}>What to say</Text>
    <Text style={styles.heading}>{recitation.name}</Text>
    {ayahs.map(ayah => <Text key={ayah.key} selectable style={[styles.arabic, arabicDisplayProps(fontSize)]}>{ayah.canonicalText}</Text>)}
    {recitation.transliteration && <Text style={styles.transliteration}>{recitation.transliteration}</Text>}
    <Text style={styles.body}>{recitation.meaning}</Text>
    {recitation.repeat && <Text style={styles.caption}>{recitation.repeat}</Text>}
    {!ayahs.length && <Text style={styles.caption}>Your teacher will help you say these words correctly.</Text>}
    {ayahs.length > 0 && audioEnabled && <AudioControls tracks={ayahs.map(ayah => ({ id: ayah.key, title: `Ayah ${ayah.key}`, asset: quranAudioAssets[ayah.key], sourceLabel: 'Mishary Alafasy · Islamic Network' }))} networkAllowed={networkAllowed} continuous />}
    <Text style={styles.caption}>Reference: {recitation.reference}{ayahs.length ? ' · Arabic: Tanzil Project' : ''}</Text>
  </Card>;
}
export const styles = StyleSheet.create({
  heading: { fontSize: 22, lineHeight: 30, fontWeight: '700', color: colors.ink },
  body: { fontSize: 17, lineHeight: 27, color: colors.ink },
  caption: { fontSize: 14, lineHeight: 21, color: colors.muted },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: colors.green },
  review: { color: '#71491b', fontSize: 15, fontWeight: '600' },
  arabic: { color: colors.ink },
  transliteration: { fontSize: 19, lineHeight: 28, color: colors.ink, fontStyle: 'italic' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  flex: { flex: 1 },
});
export const Row = ({ children }: { children: React.ReactNode }) => <View style={styles.row}>{children}</View>;
