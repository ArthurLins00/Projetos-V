import React, { useState } from 'react';
import { View, Text, Image, ScrollView, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { makeStyles, radius } from '../theme';

interface Props {
  uris: string[];
  height?: number;
}

export function PhotoCarousel({ uris, height = 220 }: Props) {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <View testID="detail-photos" style={[styles.container, { height }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll}>
          {uris.map((uri, i) => (
            <Image key={uri} testID={`detail-photo-${i}`} source={{ uri }} style={{ width, height }} resizeMode="cover" />
          ))}
        </ScrollView>
      )}
      {uris.length > 1 && (
        <>
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {index + 1}/{uris.length}
            </Text>
          </View>
          <View style={styles.dots}>
            {uris.map((uri, i) => (
              <View key={uri} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { borderRadius: radius.lg, overflow: 'hidden', marginBottom: 14, backgroundColor: colors.surfaceMuted },
  counter: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
  },
  counterText: { color: colors.onPrimary, fontSize: 12, fontWeight: '700' },
  dots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF80' },
  dotActive: { backgroundColor: '#FFFFFF' },
}));
