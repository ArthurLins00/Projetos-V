import React from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, radius, shadow, useTheme } from '../theme';

interface Props {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}

export function AuthLayout({ title, subtitle, icon, children }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={[styles.hero, { paddingTop: insets.top + 48 }]}>
          <View style={styles.circleLarge} />
          <View style={styles.circleSmall} />
          <View style={styles.logo}>
            <Ionicons name={icon} size={34} color={colors.primary} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={[styles.card, { marginBottom: insets.bottom + 24 }]}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  hero: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 72,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
  },
  circleLarge: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: '#FFFFFF14', top: -90, right: -80 },
  circleSmall: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: '#FFFFFF0F', bottom: -40, left: -50 },
  logo: { width: 68, height: 68, borderRadius: radius.lg, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 16, ...shadow(2) },
  title: { fontSize: 30, fontWeight: '800', color: colors.onPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: colors.heroText, textAlign: 'center', marginTop: 6, lineHeight: 21 },
  card: {
    marginTop: -44,
    marginHorizontal: 20,
    padding: 22,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    ...shadow(3),
  },
}));
