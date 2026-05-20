import React from 'react';
import { Text, View, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { colors, typography, spacing } from '../theme';

interface Props {
  text: string;
  textStyle?: StyleProp<TextStyle>;
}

function InlineText({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<Text key={key++} style={style}>{text.slice(last, match.index)}</Text>);
    }
    if (match[0].startsWith('**')) {
      parts.push(<Text key={key++} style={[style, s.bold]}>{match[1]}</Text>);
    } else {
      parts.push(<Text key={key++} style={[style, s.italic]}>{match[2]}</Text>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(<Text key={key++} style={style}>{text.slice(last)}</Text>);
  }

  return <Text style={style}>{parts}</Text>;
}

export function MarkdownText({ text, textStyle }: Props) {
  const baseStyle: StyleProp<TextStyle> = [s.para, textStyle];
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let key = 0;
  let prevWasEmpty = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (!prevWasEmpty) {
        blocks.push(<View key={key++} style={s.gap} />);
      }
      prevWasEmpty = true;
      continue;
    }
    prevWasEmpty = false;

    // Headings
    if (trimmed.startsWith('### ')) {
      blocks.push(
        <InlineText key={key++} text={trimmed.slice(4)} style={[baseStyle, s.h3]} />
      );
    } else if (trimmed.startsWith('## ')) {
      blocks.push(
        <InlineText key={key++} text={trimmed.slice(3)} style={[baseStyle, s.h2]} />
      );
    } else if (trimmed.startsWith('# ')) {
      blocks.push(
        <InlineText key={key++} text={trimmed.slice(2)} style={[baseStyle, s.h1]} />
      );
    }
    // Bullet list
    else if (/^[-•*] /.test(trimmed)) {
      blocks.push(
        <View key={key++} style={s.listRow}>
          <Text style={[baseStyle, s.bullet]}>•</Text>
          <View style={{ flex: 1 }}>
            <InlineText text={trimmed.slice(2)} style={baseStyle} />
          </View>
        </View>
      );
    }
    // Numbered list
    else if (/^\d+\. /.test(trimmed)) {
      const dotIdx = trimmed.indexOf('. ');
      const num = trimmed.slice(0, dotIdx);
      const rest = trimmed.slice(dotIdx + 2);
      blocks.push(
        <View key={key++} style={s.listRow}>
          <Text style={[baseStyle, s.bullet]}>{num}.</Text>
          <View style={{ flex: 1 }}>
            <InlineText text={rest} style={baseStyle} />
          </View>
        </View>
      );
    }
    // Regular paragraph
    else {
      blocks.push(
        <InlineText key={key++} text={trimmed} style={baseStyle} />
      );
    }
  }

  return <View>{blocks}</View>;
}

const s = StyleSheet.create({
  para:    { ...typography.body, color: colors.text.primary, lineHeight: 22 },
  bold:    { fontWeight: '700' },
  italic:  { fontStyle: 'italic' },
  h1:      { ...typography.h3, color: colors.text.primary, marginTop: spacing.sm, marginBottom: 2 },
  h2:      { ...typography.h4, color: colors.text.primary, marginTop: spacing.sm, marginBottom: 2 },
  h3:      { ...typography.bodyMed, color: colors.text.primary, marginTop: spacing.xs, marginBottom: 2 },
  listRow: { flexDirection: 'row', gap: 8, marginBottom: 3, alignItems: 'flex-start' },
  bullet:  { width: 18, lineHeight: 22 },
  gap:     { height: 6 },
});
