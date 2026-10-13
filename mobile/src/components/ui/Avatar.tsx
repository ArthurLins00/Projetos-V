import React, { useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';
import { makeStyles } from '../../theme';
import { getPhotoUri } from '../../services/api';

interface Props {
  name?: string | null;
  photoUrl?: string | null;
  size?: number;
}

export function getInitials(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : '';
  return (first + last).toUpperCase();
}

export function Avatar({ name, photoUrl, size = 44 }: Props) {
  const styles = useStyles();
  const uri = getPhotoUri(photoUrl);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [uri]);

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri && !failed ? (
        <Image testID="avatar-photo" source={{ uri }} style={{ width: size, height: size }} onError={() => setFailed(true)} />
      ) : (
        <Text style={[styles.text, { fontSize: size * 0.38 }]}>{getInitials(name)}</Text>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  avatar: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  text: { color: colors.onPrimary, fontWeight: '800' },
}));
