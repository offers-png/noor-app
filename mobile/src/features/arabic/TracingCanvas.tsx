import { useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import type { ArabicLetter } from './content';

export function TracingCanvas({ letter, onDone }: { letter: ArabicLetter; onDone: () => void }) {
  const [paths, setPaths] = useState<string[]>([]);
  const [width, setWidth] = useState(320);
  const panResponder = useMemo(() => {
    const coordinate = (x: number, y: number) => [Math.max(0, Math.min(320, x * 320 / width)), Math.max(0, Math.min(280, y * 320 / width))];
    return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event => {
      const [x, y] = coordinate(event.nativeEvent.locationX, event.nativeEvent.locationY);
      const path = `M ${x.toFixed(1)} ${y.toFixed(1)} L ${x.toFixed(1)} ${(y + 0.1).toFixed(1)}`;
      setPaths(previous => [...previous.slice(-99), path]);
    },
    onPanResponderMove: event => {
      const [x, y] = coordinate(event.nativeEvent.locationX, event.nativeEvent.locationY);
      setPaths(previous => {
        const last = previous.at(-1);
        if (!last || last.length > 30000) return previous;
        return [...previous.slice(0, -1), `${last} L ${x.toFixed(1)} ${y.toFixed(1)}`];
      });
    },
    onPanResponderTerminationRequest: () => false,
    });
  }, [width]);
  const clear = () => setPaths([]);
  return <View style={styles.container}>
    <Text style={styles.instruction}>{letter.hint}</Text>
    <View {...panResponder.panHandlers} onLayout={event => setWidth(event.nativeEvent.layout.width)}
      accessibilityLabel={`Tracing area for ${letter.name}`} style={styles.canvas}>
      <Svg width="100%" height="100%" viewBox="0 0 320 280" pointerEvents="none">
        <Line x1="25" y1="212" x2="295" y2="212" stroke="#d1dfcf" strokeDasharray="4 6" />
        {letter.tracePaths ? letter.tracePaths.map((path, index) => <Path key={index} d={path} stroke="#7a9775"
          strokeWidth={index === 0 ? 7 : 8} strokeDasharray="1 13" strokeLinecap="round" fill="none" />)
          : <SvgText x="160" y="210" textAnchor="middle" fontSize="200" fill="none" stroke="#7a9775" strokeWidth="1.7" strokeDasharray="2 5">{letter.arabic}</SvgText>}
        {paths.map((path, index) => <Path key={index} d={path} stroke="#246748" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
      </Svg>
    </View>
    <Text style={styles.caption}>Use your finger to trace the guide. This saves practice completion; it does not check handwriting accuracy.</Text>
    <View style={styles.row}>
      {[['Clear', clear], ['Try again', clear], ['Done', onDone]].map(([label, handler]) => <Pressable key={label as string}
        accessibilityRole="button" onPress={handler as () => void} style={[styles.button, label === 'Done' && styles.primary]}>
        <Text style={[styles.buttonText, label === 'Done' && styles.primaryText]}>{label as string}</Text>
      </Pressable>)}
    </View>
    <Text style={styles.caption}>If tracing is difficult, study the shape and tap Done when you have practiced.</Text>
  </View>;
}
const styles = StyleSheet.create({
  container: { gap: 14 },
  instruction: { fontSize: 18, lineHeight: 27, color: '#203d30' },
  canvas: { aspectRatio: 320 / 280, backgroundColor: '#fffdf8', borderWidth: 2, borderColor: '#c9d5c0', borderRadius: 20, overflow: 'hidden' },
  caption: { color: '#52634c', fontSize: 14, lineHeight: 21 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { minHeight: 48, borderWidth: 1, borderColor: '#6d8263', borderRadius: 14, padding: 14, flexGrow: 1, alignItems: 'center', backgroundColor: '#edf3e9' },
  buttonText: { color: '#203d30', fontSize: 17, fontWeight: '700' },
  primary: { backgroundColor: '#226345' },
  primaryText: { color: '#fff' },
});
