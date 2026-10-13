import { Stack } from 'expo-router/stack';
import { useTheme } from '../../src/theme';
import { TermsGate } from '../../src/components/TermsGate';
import { usePushNotifications } from '../../src/hooks/usePushNotifications';

export default function AppLayout() {
  const { colors } = useTheme();
  usePushNotifications();

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700', fontSize: 18, color: colors.text },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="create-demand" options={{ title: 'Nova Demanda' }} />
        <Stack.Screen name="demand/[id]/index" options={{ title: 'Detalhes da Demanda' }} />
        <Stack.Screen name="demand/[id]/edit" options={{ title: 'Editar Demanda' }} />
        <Stack.Screen name="assistant" options={{ title: 'Assistente Fiscalize' }} />
        <Stack.Screen name="profile" options={{ title: 'Meu Perfil' }} />
        <Stack.Screen name="help" options={{ title: 'Ajuda' }} />
      </Stack>
      <TermsGate />
    </>
  );
}
