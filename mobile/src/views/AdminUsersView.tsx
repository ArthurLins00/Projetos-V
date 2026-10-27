import React from 'react';
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ROLE_FILTERS, useAdminUsersViewModel } from '../viewmodels/useAdminUsersViewModel';
import { Avatar, Chip, EmptyState, ScrollableRow } from '../components/ui';
import { AdminUser, PERFIL_LABELS } from '../models/User';
import { makeStyles, radius, shadow, useTheme } from '../theme';

function UserRow({
  user,
  canChange,
  updating,
  onChangeRole,
}: {
  user: AdminUser;
  canChange: boolean;
  updating: boolean;
  onChangeRole: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const isGestor = user.perfil === 'Gestor';

  return (
    <View testID="admin-user-row" style={styles.row}>
      <Avatar name={user.nome} size={42} />
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>{user.nome}</Text>
        <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
        <View style={styles.tags}>
          <View style={[styles.tag, user.perfil !== 'Cidadao' && styles.tagStaff]}>
            <Text style={[styles.tagText, user.perfil !== 'Cidadao' && styles.tagTextStaff]}>{PERFIL_LABELS[user.perfil]}</Text>
          </View>
          {user.status === 'Inativo' && (
            <View style={[styles.tag, styles.tagInactive]}>
              <Text style={[styles.tagText, styles.tagTextInactive]}>Inativo</Text>
            </View>
          )}
        </View>
      </View>
      {canChange &&
        (updating ? (
          <ActivityIndicator color={colors.primary} style={styles.action} />
        ) : (
          <Pressable
            testID={`admin-user-role-${user.id}`}
            accessibilityRole="button"
            accessibilityLabel={isGestor ? `Tornar ${user.nome} cidadão` : `Tornar ${user.nome} gestor`}
            onPress={onChangeRole}
            style={({ pressed }) => [styles.action, styles.actionButton, pressed && styles.pressed]}
          >
            <Ionicons name={isGestor ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'} size={16} color={colors.primary} />
            <Text style={styles.actionText}>{isGestor ? 'Cidadão' : 'Gestor'}</Text>
          </Pressable>
        ))}
    </View>
  );
}

export function AdminUsersView() {
  const { colors } = useTheme();
  const styles = useStyles();
  const vm = useAdminUsersViewModel();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.textSubtle} />
          <TextInput
            testID="admin-user-search"
            style={styles.searchInput}
            placeholder="Buscar por nome ou e-mail"
            placeholderTextColor={colors.textSubtle}
            value={vm.search}
            onChangeText={vm.setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {!!vm.search && (
            <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" hitSlop={10} onPress={() => vm.setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
            </Pressable>
          )}
        </View>
        <ScrollableRow contentContainerStyle={styles.chips}>
          {ROLE_FILTERS.map((filter) => (
            <Chip
              key={filter.label}
              testID={`admin-role-filter-${filter.value ?? 'todos'}`}
              label={filter.label}
              selected={vm.role === filter.value}
              onPress={() => vm.selectRole(filter.value)}
            />
          ))}
        </ScrollableRow>
      </View>

      {vm.loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
      ) : (
        <FlatList
          testID="admin-user-list"
          data={vm.users}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: 24 + insets.bottom }]}
          refreshControl={<RefreshControl refreshing={vm.refreshing} onRefresh={vm.refresh} tintColor={colors.primary} colors={[colors.primary]} />}
          onEndReached={vm.loadMore}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={
            vm.error || !vm.users.length ? undefined : (
              <Text style={styles.count}>
                {vm.total} {vm.total === 1 ? 'usuário' : 'usuários'}
              </Text>
            )
          }
          ListEmptyComponent={
            <EmptyState
              icon={vm.error ? 'cloud-offline-outline' : 'people-outline'}
              title={vm.error ?? 'Nenhum usuário encontrado.'}
              description={vm.error ? 'Puxe para baixo para tentar novamente.' : 'Tente outra busca ou filtro.'}
            />
          }
          ListFooterComponent={vm.loadingMore ? <ActivityIndicator color={colors.primary} style={styles.loadingMore} /> : undefined}
          renderItem={({ item }) => (
            <UserRow
              user={item}
              canChange={vm.canChangeRole(item)}
              updating={vm.updatingId === item.id}
              onChangeRole={() => vm.confirmRoleChange(item)}
            />
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 4, backgroundColor: colors.background },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  chips: { paddingVertical: 12, gap: 8 },
  loader: { marginTop: 48 },
  list: { paddingHorizontal: 16 },
  count: { fontSize: 13, fontWeight: '600', color: colors.textSubtle, marginBottom: 10 },
  loadingMore: { marginVertical: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow(1),
  },
  rowText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  email: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  tags: { flexDirection: 'row', gap: 6, marginTop: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  tagStaff: { backgroundColor: colors.primarySoft },
  tagInactive: { backgroundColor: colors.dangerSoft },
  tagText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  tagTextStaff: { color: colors.primary },
  tagTextInactive: { color: colors.danger },
  action: { minWidth: 86 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  pressed: { opacity: 0.7 },
}));
