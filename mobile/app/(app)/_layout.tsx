import { Stack } from 'expo-router/stack';

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="create-demand" options={{ title: 'Nova Demanda' }} />
      <Stack.Screen name="demand/[id]/index" options={{ title: 'Detalhes da Demanda' }} />
      <Stack.Screen name="demand/[id]/edit" options={{ title: 'Editar Demanda' }} />
      <Stack.Screen name="assistant" options={{ title: 'Assistente Fiscalize' }} />
    </Stack>
  );
}
