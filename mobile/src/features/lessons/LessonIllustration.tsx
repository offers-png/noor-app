import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { View } from 'react-native';
import type { LessonSection } from '../../types/lessons';

/** Original schematic learning illustrations. Never representations of prophets. */
export function LessonIllustration({ kind }: { kind: NonNullable<LessonSection['illustration']> }) {
  const water = ['hands', 'mouth', 'face', 'arms', 'head', 'feet'].includes(kind);
  const bodyParts: Partial<Record<typeof kind, string>> = {
    hands: 'M60 143 L52 105 Q50 96 58 96 L65 115 L64 76 Q64 67 72 70 L76 110 L78 63 Q79 55 87 61 L88 109 L94 70 Q96 62 103 69 L99 113 L106 91 Q109 84 115 90 L110 126 Q108 149 90 151 Z',
    arms: 'M44 145 L44 122 L86 122 L89 64 Q91 54 103 57 Q110 60 108 68 L108 139 Q108 155 91 155 L44 155',
    feet: 'M69 48 L108 48 L108 123 Q117 133 138 136 Q147 143 137 153 L59 153 Q49 151 54 140 L69 119 Z',
    mouth: 'M67 114 Q96 140 125 114 Q98 153 67 114 M100 83 L102 99 L90 101',
    face: 'M99 49 Q62 49 60 86 L62 120 Q67 149 99 154 Q129 149 136 119 L138 86 Q134 49 99 49 Z',
    head: 'M57 108 Q50 39 99 35 Q147 36 142 108 M58 98 Q75 72 140 96 M57 61 Q98 36 135 61',
  };
  const poses: Partial<Record<typeof kind, string>> = {
    standing: 'M100 63 L100 124 M99 80 L67 95 M100 80 L132 95 M100 122 L78 165 M100 122 L120 165',
    bowing: 'M78 101 L124 101 M78 101 L66 161 M123 100 L135 140 M78 100 L115 131',
    prostration: 'M62 128 L96 107 L127 134 M60 128 L49 161 L92 162 M125 133 L140 160 L165 160',
    sitting: 'M100 62 L94 125 L126 148 L75 163 M98 80 L116 132 M97 124 L77 143',
  };
  return <View accessible accessibilityRole="image" accessibilityLabel={`${kind} learning diagram`} style={{ alignItems: 'center', backgroundColor: '#eef3e8', borderRadius: 20, padding: 12 }}>
    <Svg width={200} height={180} viewBox="0 0 200 180">
      <Circle cx={100} cy={91} r={80} fill="#e1edd7" />
      {bodyParts[kind] && <Path d={bodyParts[kind]} fill={['hands', 'arms', 'feet', 'face'].includes(kind) ? '#f6e1bd' : 'none'} stroke="#226345" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />}
      {water && <><Path d="M146 51 Q163 73 150 76 Q133 72 146 51 Z M154 90 Q168 109 155 113 Q144 109 154 90 Z M43 78 Q56 96 44 100 Q30 96 43 78 Z" fill="#438dab" /></>}
      {poses[kind] && <><Circle cx={kind === 'bowing' ? 143 : kind === 'prostration' ? 150 : 100} cy={kind === 'bowing' ? 101 : kind === 'prostration' ? 140 : 43} r={13} fill="#226345" /><Path d={poses[kind]} fill="none" stroke="#226345" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" /></>}
      {kind === 'mosque' && <><Path d="M48 144 L48 92 L72 92 Q72 60 101 46 Q130 60 130 92 L152 92 L152 144 Z" fill="#e1bc70" stroke="#226345" strokeWidth={4} /><Path d="M89 144 L89 114 Q101 96 114 114 L114 144" fill="#226345" /><Path d="M145 92 L145 47 L154 29 L163 47 L163 145" fill="none" stroke="#226345" strokeWidth={4} /></>}
      {(kind === 'boat' || kind === 'ocean') && <><Path d="M20 138 Q42 126 63 138 Q83 149 105 138 Q125 126 146 138 Q165 149 183 137 M20 156 Q42 144 63 156 Q83 167 105 156 Q125 144 146 156 Q165 167 183 155" fill="none" stroke="#438dab" strokeWidth={5} />{kind === 'boat' && <><Path d="M43 108 L157 108 L137 134 L64 134 Z" fill="#e1bc70" stroke="#226345" strokeWidth={4} /><Rect x={75} y={73} width={51} height={33} rx={6} fill="#f5e7c6" stroke="#226345" strokeWidth={4} /></>}</>}
    </Svg>
  </View>;
}
