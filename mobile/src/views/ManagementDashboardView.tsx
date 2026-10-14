import React from 'react';
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useManagementDashboardViewModel } from '../viewmodels/useManagementDashboardViewModel';
import { ManagedTicketCard } from '../components/ManagedTicketCard';
import { Avatar, Chip, EmptyState, ScrollableRow } from '../components/ui';
import { MANAGEMENT_FILTERS, ManagementFilter } from '../models/Management';
import { PERFIL_LABELS } from '../models/User';
import { makeStyles, radius, shadow, useTheme } from '../theme';

interface StatTileProps {
  label: string;
  value?: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  selected: boolean;
  onPress: () => void;
}

function StatTile({ label, value, icon, color, selected, onPress }: StatTileProps) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value ?? 0}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, selected && { borderColor: color }, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.tileValue}>{value ?? '–'}</Text>
      <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const filterByLabel = (label: string) => MANAGEMENT_FILTERS.find((f) => f.label === label) as ManagementFilter;

export function ManagementDashboardView() {
  const { colors } = useTheme();
  const styles = useStyles();
  const vm = useManagementDashboardViewModel();
  const insets = useSafeAreaInsets();
  const stats = vm.dashboard?.chamados;

  const tiles = [
    { label: 'Atrasados', value: stats?.atrasados, icon: 'alarm-outline' as const, color: colors.danger },
    { label: 'Aberto', value: stats?.abertos, icon: 'mail-unread-outline' as const, color: colors.warning },
    { label: 'Em Andamento', value: stats?.emAndamento, icon: 'construct-outline' as const, color: colors.primary },
    { label: 'Meus', value: stats?.meus, icon: 'person-outline' as const, color: colors.success },
  ];

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
              <Avatar name={vm.user?.nome} photoUrl={vm.user?.fotourl} size={44} />
            </Pressable>
            <View style={styles.identityText}>
              <Text style={styles.greeting} numberOfLines={1}>
                {vm.user ? `${PERFIL_LABELS[vm.user.perfil]} · ${vm.user.nome}` : ''}
              </Text>
              <Text style={styles.title}>Gestão de Chamados</Text>
            </View>
          </View>
          <View style={styles.actions}>
            {vm.isAdmin && (
              <Pressable
                testID="admin-users-button"
                accessibilityRole="button"
                accessibilityLabel="Gerenciar usuários"
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                onPress={vm.openUsers}
              >
                <Ionicons name="people-outline" size={21} color={colors.textMuted} />
              </Pressable>
            )}
            <Pressable
              testID="assistant-button"
              accessibilityRole="button"
              accessibilityLabel="Abrir assistente de chamados"
              style={({ pressed }) => [styles.iconButton, styles.iconButtonPrimary, pressed && styles.pressed]}
              onPress={vm.openAssistant}
            >
              <Ionicons name="sparkles" size={20} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.tiles}>
          {tiles.map((tile) => (
            <StatTile
              key={tile.label}
              {...tile}
              selected={vm.filter.label === tile.label}
              onPress={() => vm.selectFilter(filterByLabel(tile.label))}
            />
          ))}
        </View>

        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.textSubtle} />
          <TextInput
            testID="ticket-search"
            style={styles.searchInput}
            placeholder="Buscar por protocolo, título, categoria ou endereço"
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

        <ScrollableRow testID="ticket-filters" contentContainerStyle={styles.chips}>
          {MANAGEMENT_FILTERS.map((filter) => (
            <Chip
              key={filter.label}
              testID={`ticket-filter-${filter.label}`}
              label={filter.label}
              selected={vm.filter.label === filter.label}
              onPress={() => vm.selectFilter(filter)}
            />
          ))}
        </ScrollableRow>
      </View>

      {vm.loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
      ) : (
        <FlatList
          testID="ticket-list"
          data={vm.tickets}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: 32 + insets.bottom }]}
          refreshControl={<RefreshControl refreshing={vm.refreshing} onRefresh={vm.refresh} tintColor={colors.primary} colors={[colors.primary]} />}
          onEndReached={vm.loadMore}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={
            vm.error || !vm.tickets.length ? null : (
              <Text style={styles.count}>
                {vm.total} {vm.total === 1 ? 'chamado' : 'chamados'}
              </Text>
            )
          }
          ListEmptyComponent={
            <EmptyState
              icon={vm.error ? 'cloud-offline-outline' : 'checkmark-done-outline'}
              title={vm.error ?? 'Nenhum chamado encontrado.'}
              description={vm.error ? 'Puxe para baixo para tentar novamente.' : 'Tente outra busca ou filtro.'}
            />
          }
          ListFooterComponent={vm.loadingMore ? <ActivityIndicator color={colors.primary} style={styles.loadingMore} /> : null}
          renderItem={({ item }) => <ManagedTicketCard ticket={item} onPress={() => vm.openTicket(item.id)} />}
        />
      )}
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
  tiles: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tile: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'flex-start',
    gap: 2,
  },
  tileValue: { fontSize: 20, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  tileLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
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
  list: { paddingHorizontal: 20, paddingTop: 16 },
  count: { fontSize: 13, fontWeight: '600', color: colors.textSubtle, marginBottom: 10 },
  loadingMore: { marginVertical: 16 },
}));
