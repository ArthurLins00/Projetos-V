import React from 'react';
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDemandListViewModel } from '../viewmodels/useDemandListViewModel';
import { DemandCard } from '../components/DemandCard';
import { Avatar, Chip, EmptyState } from '../components/ui';
import { STATUS_FILTERS } from '../models/Demand';
import { makeStyles, radius, shadow, useTheme } from '../theme';

export function DemandListView() {
  const { colors } = useTheme();
  const styles = useStyles();
  const vm = useDemandListViewModel();
  const insets = useSafeAreaInsets();
  const filtering = !!(vm.search || vm.status);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <View style={styles.identity}>
            <Pressable
              testID="profile-button"
              accessibilityRole="button"
              accessibilityLabel="Abrir perfil"
              hitSlop={6}
              style={({ pressed }) => pressed && styles.pressed}
              onPress={vm.openProfile}
            >
              <Avatar name={vm.user?.nome} size={44} />
            </Pressable>
            <View style={styles.identityText}>
              {vm.user && <Text style={styles.greeting} numberOfLines={1}>Olá, {vm.user.nome}</Text>}
              <Text style={styles.title}>Minhas Demandas</Text>
            </View>
          </View>
          <View style={styles.actions}>
            <Pressable
              testID="assistant-button"
              accessibilityRole="button"
              accessibilityLabel="Abrir assistente de chamados"
              style={({ pressed }) => [styles.iconButton, styles.iconButtonPrimary, pressed && styles.pressed]}
              onPress={vm.openAssistant}
            >
              <Ionicons name="sparkles" size={20} color={colors.primary} />
            </Pressable>
            <Pressable
              testID="logout-button"
              accessibilityRole="button"
              accessibilityLabel="Sair"
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              onPress={vm.signOut}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
        </View>

        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.textSubtle} />
          <TextInput
            testID="demand-search"
            style={styles.searchInput}
            placeholder="Buscar por título, endereço ou protocolo"
            placeholderTextColor={colors.textSubtle}
            value={vm.search}
            onChangeText={vm.setSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {!!vm.search && (
            <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" hitSlop={10} onPress={() => vm.setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {STATUS_FILTERS.map((filter) => (
            <Chip
              key={filter.label}
              testID={`status-filter-${filter.value ?? 'todos'}`}
              label={filter.label}
              selected={vm.status === filter.value}
              onPress={() => vm.selectStatus(filter.value)}
            />
          ))}
        </ScrollView>
      </View>

      {vm.loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
      ) : (
        <FlatList
          testID="demand-list"
          data={vm.demands}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.list, { paddingBottom: 110 + insets.bottom }]}
          refreshControl={<RefreshControl refreshing={vm.refreshing} onRefresh={vm.refresh} tintColor={colors.primary} colors={[colors.primary]} />}
          onEndReached={vm.loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <EmptyState
              icon={vm.error ? 'cloud-offline-outline' : filtering ? 'search-outline' : 'document-text-outline'}
              title={vm.error ?? (filtering ? 'Nenhuma demanda encontrada.' : 'Nenhuma demanda registrada ainda.')}
              description={vm.error ? 'Puxe para baixo para tentar novamente.' : filtering ? 'Tente outra busca ou filtro.' : 'Toque em "Nova demanda" para relatar um problema.'}
            />
          }
          ListFooterComponent={vm.loadingMore ? <ActivityIndicator color={colors.primary} style={styles.loadingMore} /> : null}
          renderItem={({ item }) => <DemandCard demand={item} onPress={() => vm.openDemand(item.id)} />}
        />
      )}

      <Pressable
        testID="new-demand-button"
        accessibilityRole="button"
        accessibilityLabel="Adicionar demanda"
        style={({ pressed }) => [styles.fab, { bottom: 24 + insets.bottom }, pressed && styles.fabPressed]}
        onPress={vm.createDemand}
      >
        <Ionicons name="add" size={24} color={colors.onPrimary} />
        <Text style={styles.fabText}>Nova demanda</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...shadow(1),
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  identityText: { flex: 1 },
  greeting: { fontSize: 13, color: colors.textMuted },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  actions: { flexDirection: 'row', gap: 8 },
  iconButton: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  iconButtonPrimary: { backgroundColor: colors.primarySoft },
  pressed: { opacity: 0.7 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  chips: { paddingVertical: 14, gap: 8 },
  loader: { marginTop: 48 },
  list: { paddingHorizontal: 20, paddingTop: 18 },
  loadingMore: { marginVertical: 16 },
  fab: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 56,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadow(3),
  },
  fabPressed: { backgroundColor: colors.primaryDark, transform: [{ scale: 0.97 }] },
  fabText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
}));
