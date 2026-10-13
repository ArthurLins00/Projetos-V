import React from 'react';
import { Modal, View, Text, Pressable, Linking, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ResolvedAddress } from '../services/geocodingService';
import { Button } from './ui';
import { makeStyles, radius, useTheme } from '../theme';

interface Props {
  visible: boolean;
  latitude: number;
  longitude: number;
  address: ResolvedAddress | null;
  onClose: () => void;
}

function mapHtml(latitude: number, longitude: number, dark: boolean) {
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html, body, #map { height: 100%; margin: 0; background: ${dark ? '#0B1220' : '#F4F6FB'}; }</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: true }).setView([${latitude}, ${longitude}], 17);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/${dark ? 'dark_all' : 'rastertiles/voyager'}/{z}/{x}/{y}{r}.png', {
    maxZoom: 20,
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  }).addTo(map);
  L.marker([${latitude}, ${longitude}]).addTo(map);
</script>
</body>
</html>`;
}

export function LocationMapModal({ visible, latitude, longitude, address, onClose }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const openExternal = () => {
    const label = encodeURIComponent(address?.street ?? 'Local da demanda');
    const url =
      Platform.OS === 'ios'
        ? `maps://?q=${label}&ll=${latitude},${longitude}`
        : `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`)
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Local da demanda</Text>
          <Pressable testID="map-close" accessibilityRole="button" accessibilityLabel="Fechar mapa" hitSlop={10} onPress={onClose}>
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
        </View>

        <WebView testID="map-webview" style={styles.map} originWhitelist={['*']} source={{ html: mapHtml(latitude, longitude, isDark) }} />

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.addressRow}>
            <Ionicons name="location" size={22} color={colors.danger} />
            <View style={styles.addressText}>
              <Text style={styles.street}>{address?.street ?? 'Endereço não identificado'}</Text>
              {!!address?.area && <Text style={styles.area}>{address.area}</Text>}
              <Text style={styles.coords}>
                {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </Text>
            </View>
          </View>
          <Button testID="map-open-external" variant="secondary" icon="navigate-outline" title="Abrir no app de mapas" onPress={openExternal} />
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  map: { flex: 1 },
  footer: { padding: 16, gap: 14, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, marginTop: -16 },
  addressRow: { flexDirection: 'row', gap: 10 },
  addressText: { flex: 1 },
  street: { fontSize: 16, fontWeight: '700', color: colors.text },
  area: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  coords: { fontSize: 12, color: colors.textSubtle, marginTop: 4, fontVariant: ['tabular-nums'] },
}));
