import React from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProfileViewModel } from '../viewmodels/useProfileViewModel';
import { Avatar, Button, TextField } from '../components/ui';
import { makeStyles, radius, shadow, ThemePreference, useTheme } from '../theme';

const PERFIL_LABELS: Record<string, string> = { Cidadao: 'Cidadão', Gestor: 'Gestor', Admin: 'Administrador' };

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'light', label: 'Claro', icon: 'sunny-outline' },
  { value: 'dark', label: 'Escuro', icon: 'moon-outline' },
  { value: 'system', label: 'Sistema', icon: 'phone-portrait-outline' },
];

function Card({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Ionicons name={icon} size={18} color={colors.primary} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export function ProfileView() {
  const vm = useProfileViewModel();
  const { colors } = useTheme();
  const styles = useStyles();
  const memberSince = vm.profile?.criadoem
    ? new Date(vm.profile.criadoem).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : null;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Avatar name={vm.user?.nome} size={84} />
          <Text testID="profile-name" style={styles.name}>{vm.user?.nome}</Text>
          <Text style={styles.email}>{vm.user?.email}</Text>
          <View style={styles.tags}>
            <View style={styles.tag}>
              <Ionicons name="shield-checkmark-outline" size={13} color={colors.primary} />
              <Text style={styles.tagText}>{PERFIL_LABELS[vm.user?.perfil ?? ''] ?? vm.user?.perfil}</Text>
            </View>
            {memberSince && (
              <View style={styles.tag}>
                <Ionicons name="calendar-outline" size={13} color={colors.primary} />
                <Text style={styles.tagText}>Desde {memberSince}</Text>
              </View>
            )}
          </View>
        </View>

        <Card title="Aparência" icon="color-palette-outline">
          <View style={styles.segmented} accessibilityRole="radiogroup">
            {THEME_OPTIONS.map((option) => {
              const selected = vm.themePreference === option.value;
              return (
                <Pressable
                  key={option.value}
                  testID={`theme-${option.value}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[styles.segment, selected && styles.segmentSelected]}
                  onPress={() => vm.setThemePreference(option.value)}
                >
                  <Ionicons name={option.icon} size={20} color={selected ? colors.primary : colors.textMuted} />
                  <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>
            {vm.themePreference === 'system' ? 'Acompanha o tema configurado no aparelho.' : 'Tema fixo, independente do aparelho.'}
          </Text>
        </Card>

        <Card title="Informações pessoais" icon="person-outline">
          <TextField testID="profile-input-name" label="Nome completo" icon="person-outline" value={vm.nome} onChangeText={vm.setNome} />
          <TextField
            testID="profile-input-email"
            label="E-mail"
            icon="mail-outline"
            value={vm.email}
            onChangeText={vm.setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          {vm.emailChanged && (
            <TextField
              testID="profile-input-email-password"
              label="Senha atual (para confirmar o novo e-mail)"
              icon="key-outline"
              value={vm.emailPassword}
              onChangeText={vm.setEmailPassword}
              secureTextEntry
            />
          )}
          <Button
            testID="profile-save-info"
            icon="save-outline"
            title="Salvar alterações"
            onPress={vm.saveInfo}
            loading={vm.savingInfo}
            disabled={!vm.infoChanged}
            style={styles.cardButton}
          />
        </Card>

        <Card title="Segurança" icon="lock-closed-outline">
          <TextField testID="profile-input-current-password" label="Senha atual" icon="key-outline" value={vm.senhaAtual} onChangeText={vm.setSenhaAtual} secureTextEntry />
          <TextField testID="profile-input-new-password" label="Nova senha" icon="lock-closed-outline" placeholder="Mínimo de 6 caracteres" value={vm.novaSenha} onChangeText={vm.setNovaSenha} secureTextEntry />
          <TextField testID="profile-input-confirm-password" label="Confirmar nova senha" icon="lock-closed-outline" value={vm.confirmarSenha} onChangeText={vm.setConfirmarSenha} secureTextEntry />
          <Button
            testID="profile-save-password"
            variant="secondary"
            icon="refresh-outline"
            title="Alterar senha"
            onPress={vm.savePassword}
            loading={vm.savingPassword}
            disabled={!vm.senhaAtual || !vm.novaSenha}
            style={styles.cardButton}
          />
        </Card>

        <Button testID="profile-logout" variant="danger" icon="log-out-outline" title="Sair da conta" onPress={vm.confirmSignOut} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: 16, paddingBottom: 40 },
  hero: { alignItems: 'center', paddingTop: 8, paddingBottom: 22 },
  name: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 14, letterSpacing: -0.3 },
  email: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  tagText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginBottom: 14, ...shadow(1) },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardButton: { marginTop: 2 },
  segmented: { flexDirection: 'row', gap: 8, padding: 4, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  segment: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: radius.sm },
  segmentSelected: { backgroundColor: colors.surface, ...shadow(1) },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  segmentTextSelected: { color: colors.primary },
  hint: { fontSize: 12, color: colors.textSubtle, marginTop: 10, textAlign: 'center' },
}));
