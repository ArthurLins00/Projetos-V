/** @jsxImportSource nativewind */
// O pragma acima liga o NativeWind só neste arquivo (ver babel.config.js). Não use Pressable com
// `style` em função aqui: o runtime do NativeWind descarta esse estilo.
import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tva } from '@gluestack-ui/utils/nativewind-utils';

// Aviso no padrão do Alert do GlueStack UI v3: variantes declaradas com `tva` e estilizadas com classes do
// NativeWind. Usado na tela de ajuda para indicar onde buscar mais ajuda depois do FAQ.

type Action = 'info' | 'success';

const callout = tva({
  base: 'flex-row items-start gap-3 rounded-2xl border p-4',
  variants: {
    action: {
      info: 'border-blue-500/30 bg-blue-500/10',
      success: 'border-emerald-500/30 bg-emerald-500/10',
    },
  },
});

const calloutTitle = tva({
  base: 'text-[15px] font-bold',
  variants: {
    action: {
      info: 'text-blue-500',
      success: 'text-emerald-500',
    },
  },
});

const iconColor: Record<Action, string> = { info: '#3B82F6', success: '#10B981' };

interface Props {
  title: string;
  children: React.ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
  action?: Action;
  testID?: string;
}

export function Callout({ title, children, icon = 'information-circle', action = 'info', testID }: Props) {
  return (
    <View testID={testID} className={callout({ action })} accessibilityRole="summary">
      <Ionicons name={icon} size={22} color={iconColor[action]} />
      <View className="flex-1 gap-1">
        <Text className={calloutTitle({ action })}>{title}</Text>
        <Text className="text-sm leading-5 text-gray-500">{children}</Text>
      </View>
    </View>
  );
}
