import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home } from '../screens/Home';
import { CreateDemand } from '../screens/CreatDemand';

const { Navigator, Screen } = createNativeStackNavigator();

export function AppRoutes() {
  return (
    <Navigator>
      <Screen name="Home" component={Home} options={{ title: 'Minhas Demandas' }} />
      <Screen name="CreateDemand" component={CreateDemand} options={{ title: 'Nova Demanda' }} />
    </Navigator>
  );
}