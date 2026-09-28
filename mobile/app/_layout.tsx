import { Slot, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

function InitialLayout() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // Verifica se a URL atual pertence ao grupo de autenticação (login/register)
    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Se não tem usuário e não está na tela de login, joga para o login
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Se tem usuário e está tentando acessar o login, joga para a Home
      router.replace('/(app)');
    }
  }, [user, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  // O Slot renderiza as telas (Home, Login, etc) baseadas na URL
  return <Slot />;
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