import React from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDemandListViewModel } from '../viewmodels/useDemandListViewModel';
import { DemandCard } from '../components/DemandCard';
import { STATUS_FILTERS } from '../models/Demand';

export function DemandListView() {
  const vm = useDemandListViewModel();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Minhas Demandas</Text>
          {vm.user && <Text style={styles.headerSubtitle}>Olá, {vm.user.nome}</Text>}
        </View>
        <TouchableOpacity testID="logout-button" accessibilityRole="button" onPress={vm.signOut}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        <TextInput
          testID="demand-search"
          style={styles.search}
          placeholder="Pesquisar por título, descrição, endereço ou protocolo"
          value={vm.search}
          onChangeText={vm.setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {STATUS_FILTERS.map((filter) => {
            const selected = vm.status === filter.value;
            return (
              <TouchableOpacity
                key={filter.label}
                testID={`status-filter-${filter.value ?? 'todos'}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => vm.selectStatus(filter.value)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{filter.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {vm.loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#007BFF" />
      ) : (
        <FlatList
          testID="demand-list"
          data={vm.demands}
          // Com o teclado aberto (após pesquisar), o primeiro toque já abre o card
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={vm.refreshing} onRefresh={vm.refresh} />}
          onEndReached={vm.loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {vm.error ?? (vm.search || vm.status ? 'Nenhuma demanda encontrada.' : 'Nenhuma demanda registrada ainda.')}
            </Text>
          }
          ListFooterComponent={vm.loadingMore ? <ActivityIndicator color="#007BFF" /> : null}
          renderItem={({ item }) => <DemandCard demand={item} onPress={() => vm.openDemand(item.id)} />}
        />
      )}

      {/* Assistente de IA: consulta o status dos chamados (só nesta tela inicial) */}
      <TouchableOpacity
        testID="assistant-button"
        accessibilityRole="button"
        accessibilityLabel="Abrir assistente de chamados"
        style={[styles.fab, styles.assistantFab, { bottom: 20 + insets.bottom }]}
        onPress={vm.openAssistant}
      >
        <Text style={styles.assistantFabText}>💬</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="new-demand-button"
        accessibilityRole="button"
        accessibilityLabel="Adicionar demanda"
        style={[styles.fab, { bottom: 20 + insets.bottom }]}
        onPress={vm.createDemand}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', elevation: 2 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  headerSubtitle: { color: '#666', marginTop: 2 },
  logoutText: { color: 'red', fontWeight: 'bold' },
  filters: { paddingHorizontal: 20, paddingTop: 15 },
  search: { backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  chips: { paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' },
  chipSelected: { backgroundColor: '#007BFF', borderColor: '#007BFF' },
  chipText: { color: '#333' },
  chipTextSelected: { color: '#fff', fontWeight: 'bold' },
  loader: { marginTop: 40 },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  empty: { textAlign: 'center', marginTop: 20, color: '#666' },
  fab: { position: 'absolute', right: 20, backgroundColor: '#007BFF', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  fabText: { color: '#fff', fontSize: 30, fontWeight: 'bold', marginTop: -2 },
  assistantFab: { right: undefined, left: 20, backgroundColor: '#fff', borderWidth: 2, borderColor: '#007BFF' },
  assistantFabText: { fontSize: 26 }
});
