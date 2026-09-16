import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { demandService } from '../services/demandService';
import { useAuth } from '../contexts/AuthContext';

export function Home({ navigation }: any) {
  const [demandas, setDemandas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { signOut } = useAuth();

  const fetchDemandas = async () => {
    try {
      const dados = await demandService.listarDemandas(); 
      setDemandas(dados);
    } catch (error) {
      console.error('Erro ao buscar demandas:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDemandas();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDemandas();
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <Text style={styles.headerTitle}>Minhas Demandas</Text>
         <TouchableOpacity testID="home-logout" onPress={signOut}>
            <Text style={styles.logoutText}>Sair</Text>
         </TouchableOpacity>
      </View>

      <FlatList
        data={demandas}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>Nenhuma demanda registrada ainda.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.category}>{item.category?.nome ?? 'Categoria não informada'}</Text>
              <Text style={styles.status}>{item.status || 'Pendente'}</Text>
            </View>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        )}
      />

      <TouchableOpacity testID="home-create-demand" style={styles.fab} onPress={() => navigation.navigate('CreateDemand')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', elevation: 2 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  logoutText: { color: 'red', fontWeight: 'bold' },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 15, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  category: { fontWeight: 'bold', fontSize: 16, color: '#333' },
  status: { color: '#E6A23C', fontWeight: 'bold', fontSize: 12 },
  description: { color: '#666' },
  fab: { position: 'absolute', right: 20, bottom: 20, backgroundColor: '#007BFF', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  fabText: { color: '#fff', fontSize: 30, fontWeight: 'bold', marginTop: -2 }
});