import React from 'react';
import { Text, View } from 'react-native';
import { tva } from '@gluestack-ui/utils/nativewind-utils';

// Selo no padrão dos componentes do GlueStack UI v3: variantes declaradas com `tva` e estilizadas com classes
// do NativeWind. Usado na tela de ajuda para mostrar quantas perguntas cada seção tem.

const badge = tva({
  base: 'min-w-[22px] items-center justify-center rounded-full px-2 py-0.5',
  variants: {
    action: {
      info: 'bg-blue-500/15',
      muted: 'bg-gray-500/15',
    },
  },
});

const badgeText = tva({
  base: 'text-xs font-bold',
  variants: {
    action: {
      info: 'text-blue-500',
      muted: 'text-gray-500',
    },
  },
});

interface Props {
  value: number | string;
  action?: 'info' | 'muted';
  testID?: string;
}

export function CountBadge({ value, action = 'info', testID }: Props) {
  return (
    <View testID={testID} className={badge({ action })} accessibilityLabel={`${value} itens`}>
      <Text className={badgeText({ action })}>{value}</Text>
    </View>
  );
}
