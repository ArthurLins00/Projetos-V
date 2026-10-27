import React from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProfileViewModel } from '../viewmodels/useProfileViewModel';
import { Avatar, Button, TextField } from '../components/ui';
import { PERFIL_LABELS } from '../models/User';
import { makeStyles, radius, shadow, ThemePreference, useTheme } from '../theme';


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
          <Pressable
            testID="profile-photo"
            accessibilityRole="button"
            accessibilityLabel="Alterar foto de perfil"
            onPress={vm.changePhoto}
            disabled={vm.uploadingPhoto}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Avatar name={vm.user?.nome} photoUrl={vm.photoUrl} size={96} />
            {vm.uploadingPhoto && (
              <View style={styles.photoOverlay}>
                <ActivityIndicator color={colors.onPrimary} />
              </View>
            )}
            <View style={styles.photoBadge}>
              <Ionicons name="camera" size={15} color={colors.onPrimary} />
            </View>
          </Pressable>
          <Text testID="profile-name" style={styles.name}>{vm.user?.nome}</Text>
          <Text style={styles.email}>{vm.user?.email}</Text>
          <View style={styles.tags}>
            <View style={styles.tag}>
              <Ionicons name="shield-checkmark-outline" size={13} color={colors.primary} />
              <Text style={styles.tagText}>{vm.user ? PERFIL_LABELS[vm.user.perfil] ?? vm.user.perfil : ''}</Text>
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

        <Card title="Verificação em duas etapas" icon="shield-checkmark-outline">
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status</Text>
            <View style={[styles.statusPill, vm.twoFactorEnabled && styles.statusPillOn]}>
              <Text testID="profile-two-factor-status" style={[styles.statusText, vm.twoFactorEnabled && styles.statusTextOn]}>
                {vm.twoFactorEnabled ? 'Ativada' : 'Desativada'}
              </Text>
            </View>
          </View>
          <Text style={styles.description}>
            Ao entrar, além da senha, pediremos um código de 6 dígitos enviado para o seu e-mail.
          </Text>
          <TextField
            testID="profile-input-two-factor-password"
            label="Senha atual (para confirmar)"
            icon="key-outline"
            value={vm.twoFactorPassword}
            onChangeText={vm.setTwoFactorPassword}
            secureTextEntry
          />
          <Button
            testID="profile-toggle-two-factor"
            variant={vm.twoFactorEnabled ? 'danger' : 'primary'}
            icon={vm.twoFactorEnabled ? 'close-circle-outline' : 'shield-checkmark-outline'}
            title={vm.twoFactorEnabled ? 'Desativar' : 'Ativar'}
            onPress={vm.toggleTwoFactor}
            loading={vm.savingTwoFactor}
            disabled={!vm.profile || !vm.twoFactorPassword}
            style={styles.cardButton}
          />
        </Card>

        <Button testID="profile-help" variant="secondary" icon="help-circle-outline" title="Ajuda e termos de uso" onPress={vm.openHelp} style={styles.helpButton} />
        <Button testID="profile-logout" variant="danger" icon="log-out-outline" title="Sair da conta" onPress={vm.confirmSignOut} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: 16, paddingBottom: 40 },
  hero: { alignItems: 'center', paddingTop: 8, paddingBottom: 22 },
  pressed: { opacity: 0.8 },
  photoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 48, backgroundColor: '#00000066', alignItems: 'center', justifyContent: 'center' },
  photoBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 14, letterSpacing: -0.3 },
  email: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  tagText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginBottom: 14, ...shadow(1) },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardButton: { marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  statusLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  statusPillOn: { backgroundColor: colors.successSoft },
  statusText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  statusTextOn: { color: colors.success },
  description: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: 14 },
  helpButton: { marginBottom: 12 },
  segmented: { flexDirection: 'row', gap: 8, padding: 4, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  segment: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: radius.sm },
  segmentSelected: { backgroundColor: colors.surface, ...shadow(1) },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  segmentTextSelected: { color: colors.primary },
  hint: { fontSize: 12, color: colors.textSubtle, marginTop: 10, textAlign: 'center' },
}));
