import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { FAQ_SECTIONS, FaqItem } from '../models/Faq';
import { EmergencyNotice } from '../components/EmergencyNotice';
import { TermsContent } from '../components/TermsContent';
import { makeStyles, radius, shadow, useTheme } from '../theme';

function Question({ item, testID }: { item: FaqItem; testID: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.question}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [styles.questionHeader, pressed && styles.pressed]}
      >
        <Text style={styles.questionText}>{item.question}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSubtle} />
      </Pressable>
      {open && <Text style={styles.answer}>{item.answer}</Text>}
    </View>
  );
}

export function HelpView() {
  const { colors } = useTheme();
  const styles = useStyles();
  const [termsOpen, setTermsOpen] = useState(false);

  return (
    <ScrollView testID="help-screen" style={styles.flex} contentContainerStyle={styles.container}>
      <View style={styles.intro}>
        <View style={styles.introIcon}>
          <Ionicons name="help-buoy" size={28} color={colors.primary} />
        </View>
        <Text style={styles.introTitle}>Como podemos ajudar?</Text>
        <Text style={styles.introText}>Toque em uma pergunta para ver a resposta.</Text>
      </View>

      {FAQ_SECTIONS.map((section, sectionIndex) => (
        <View key={section.title} style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name={section.icon} size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>{section.title}</Text>
          </View>
          {section.items.map((item, itemIndex) => (
            <Question key={item.question} item={item} testID={`faq-${sectionIndex}-${itemIndex}`} />
          ))}
        </View>
      ))}

      <Text style={styles.sectionLabel}>Em caso de emergência</Text>
      <EmergencyNotice style={styles.notice} />

      <View style={styles.card}>
        <Pressable
          testID="help-terms"
          accessibilityRole="button"
          accessibilityState={{ expanded: termsOpen }}
          onPress={() => setTermsOpen((value) => !value)}
          style={({ pressed }) => [styles.cardHeader, styles.termsHeader, pressed && styles.pressed]}
        >
          <Ionicons name="document-text-outline" size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, styles.flexText]}>Termos de Uso</Text>
          <Ionicons name={termsOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSubtle} />
        </Pressable>
        {termsOpen && (
          <View style={styles.terms}>
            <TermsContent />
          </View>
        )}
      </View>

      <Text style={styles.footer}>Fiscalize · versão {Constants.expoConfig?.version ?? '1.0.0'} · projeto acadêmico</Text>
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: 16, paddingBottom: 40 },
  intro: { alignItems: 'center', paddingVertical: 12, marginBottom: 6 },
  introIcon: { width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  introTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  introText: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 14, ...shadow(1) },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  flexText: { flex: 1 },
  termsHeader: { paddingVertical: 12 },
  terms: { paddingBottom: 6 },
  question: { borderTopWidth: 1, borderTopColor: colors.border },
  questionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  questionText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  answer: { fontSize: 14, color: colors.textMuted, lineHeight: 21, paddingBottom: 14 },
  pressed: { opacity: 0.6 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 8, marginLeft: 4 },
  notice: { marginBottom: 14 },
  footer: { textAlign: 'center', fontSize: 12, color: colors.textSubtle, marginTop: 6 },
}));
