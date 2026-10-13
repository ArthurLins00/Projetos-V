import React from 'react';
import { View, Text } from 'react-native';
import { TERMS_SECTIONS, TERMS_UPDATED_AT } from '../models/Terms';
import { makeStyles } from '../theme';

export function TermsContent() {
  const styles = useStyles();

  return (
    <View>
      <Text style={styles.updated}>Última atualização: {TERMS_UPDATED_AT}</Text>
      {TERMS_SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.title}>{section.title}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  updated: { fontSize: 12, color: colors.textSubtle, marginBottom: 12 },
  section: { marginBottom: 16 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 4 },
  body: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
}));
