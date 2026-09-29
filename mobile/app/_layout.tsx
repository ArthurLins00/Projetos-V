import { Stack } from 'expo-router/stack';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

function InitialLayout() {
  const { user, isLoading } = useAuth();

  // Enquanto a sessão salva é restaurada (AuthContext), nenhuma tela é montada
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  // Rotas protegidas: sem usuário, as telas do app nem são montadas (evita chamadas
  // à API sem token); com usuário, login/registro ficam indisponíveis. O Expo Router
  // redireciona sozinho para o grupo liberado quando `user` muda (login/logout).
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <InitialLayout />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
