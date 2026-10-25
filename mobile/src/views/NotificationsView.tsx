import React from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationsViewModel } from '../viewmodels/useNotificationsViewModel';
import { AppNotification } from '../models/Notification';
import { EmptyState } from '../components/ui';
import { makeStyles, radius, shadow, useTheme } from '../theme';

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  chamado_concluido: 'checkmark-circle',
  equipe_designada: 'people',
  status_atualizado: 'sync-circle',
};

function formatWhen(iso: string) {
  const date = new Date(iso);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  if (hours < 48) return 'ontem';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function NotificationItem({ item, index, onPress }: { item: AppNotification; index: number; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const done = item.type === 'chamado_concluido';

  return (
    <Pressable
      testID={`notification-${index}`}
      accessibilityRole="button"
      accessibilityLabel={`${item.read ? '' : 'Não lida. '}${item.title}. ${item.message}`}
      onPress={onPress}
      style={({ pressed }) => [styles.item, !item.read && styles.itemUnread, pressed && styles.pressed]}
    >
      <View style={[styles.icon, done && styles.iconDone]}>
        <Ionicons name={TYPE_ICONS[item.type] ?? 'notifications'} size={22} color={done ? colors.success : colors.primary} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.when}>{formatWhen(item.createdAt)}</Text>
        </View>
        <Text style={styles.message}>{item.message}</Text>
        {!!item.protocolo && <Text style={styles.protocol}>{item.protocolo}</Text>}
      </View>
      {!item.read && <View testID={`notification-unread-${index}`} style={styles.dot} />}
    </Pressable>
  );
}

export function NotificationsView() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const vm = useNotificationsViewModel();

  if (vm.loading) {
    return (
      <View style={[styles.flex, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      testID="notifications-list"
      style={styles.flex}
      contentContainerStyle={[styles.container, { paddingBottom: 24 + insets.bottom }]}
      data={vm.notifications}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={vm.refreshing} onRefresh={vm.refresh} tintColor={colors.primary} colors={[colors.primary]} />}
      onEndReached={vm.loadMore}
      onEndReachedThreshold={0.3}
      ListHeaderComponent={
        vm.notifications.length > 0 ? (
          <View style={styles.header}>
            <Text testID="notifications-unread-count" style={styles.headerText}>
              {vm.unreadCount === 0 ? 'Tudo lido' : vm.unreadCount === 1 ? '1 não lida' : `${vm.unreadCount} não lidas`}
            </Text>
            {vm.unreadCount > 0 && (
              <Pressable testID="notifications-read-all" accessibilityRole="button" hitSlop={8} onPress={vm.markAllAsRead}>
                <Text style={styles.link}>Marcar todas como lidas</Text>
              </Pressable>
            )}
          </View>
        ) : undefined
      }
      ListEmptyComponent={
        <EmptyState
          icon={vm.error ? 'cloud-offline-outline' : 'notifications-off-outline'}
          title={vm.error ?? 'Nenhuma notificação ainda.'}
          description={
            vm.error
              ? 'Puxe para baixo para tentar novamente.'
              : 'Quando a equipe atualizar um dos seus chamados, o aviso aparece aqui.'
          }
        />
      }
      ListFooterComponent={vm.loadingMore ? <ActivityIndicator color={colors.primary} style={styles.loadingMore} /> : undefined}
      renderItem={({ item, index }) => <NotificationItem item={item} index={index} onPress={() => vm.open(item)} />}
    />
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  container: { padding: 16, flexGrow: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  headerText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    marginBottom: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow(1),
  },
  itemUnread: { backgroundColor: colors.primarySoft },
  pressed: { opacity: 0.75 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  iconDone: { backgroundColor: colors.successSoft },
  body: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  titleUnread: { fontWeight: '800' },
  when: { fontSize: 12, color: colors.textSubtle },
  message: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginTop: 2 },
  protocol: { fontSize: 12, fontWeight: '600', color: colors.textSubtle, marginTop: 6, fontVariant: ['tabular-nums'] },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 6 },
  loadingMore: { marginVertical: 16 },
}));
