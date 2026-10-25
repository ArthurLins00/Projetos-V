import React, { useRef, useState } from 'react';
import { View, ScrollView, ScrollViewInstance, Pressable, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, shadow, useTheme } from '../../theme';

interface Props {
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

const EDGE_TOLERANCE = 4;

export function ScrollableRow({ children, contentContainerStyle, testID }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [offset, setOffset] = useState(0);
  const [viewWidth, setViewWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);

  const canScrollLeft = offset > EDGE_TOLERANCE;
  const canScrollRight = offset + viewWidth < contentWidth - EDGE_TOLERANCE;

  const scrollBy = (direction: 1 | -1) => {
    const max = Math.max(0, contentWidth - viewWidth);
    const next = Math.min(max, Math.max(0, offset + direction * viewWidth * 0.7));
    scrollRef.current?.scrollTo({ x: next, animated: true });
  };

  return (
    <View testID={testID} onLayout={(e) => setViewWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={contentContainerStyle}
        onContentSizeChange={(width) => setContentWidth(width)}
        onScroll={(e) => setOffset(e.nativeEvent.contentOffset.x)}
        scrollEventThrottle={32}
      >
        {children}
      </ScrollView>

      {canScrollLeft && (
        <Pressable
          testID={testID ? `${testID}-left` : undefined}
          accessibilityRole="button"
          accessibilityLabel="Rolar para a esquerda"
          hitSlop={8}
          onPress={() => scrollBy(-1)}
          style={({ pressed }) => [styles.arrow, styles.left, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
      )}
      {canScrollRight && (
        <Pressable
          testID={testID ? `${testID}-right` : undefined}
          accessibilityRole="button"
          accessibilityLabel="Rolar para a direita"
          hitSlop={8}
          onPress={() => scrollBy(1)}
          style={({ pressed }) => [styles.arrow, styles.right, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </Pressable>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow(2),
  },
  left: { left: -6 },
  right: { right: -6 },
  pressed: { opacity: 0.7 },
}));
