import React from 'react';
import { View, Text, Pressable, Image, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDemandFormViewModel } from '../viewmodels/useDemandFormViewModel';
import { CameraCapture } from '../components/CameraCapture';
import { Button, Chip, SelectField, TextField } from '../components/ui';
import { ZONES } from '../models/Region';
import { MAX_DEMAND_PHOTOS } from '../models/Demand';
import { makeStyles, radius, shadow, useTheme } from '../theme';

interface Props {
  demandId?: string;
}

interface TileProps {
  testID: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  done: boolean;
  loading?: boolean;
  onPress: () => void;
}

function ActionTile({ testID, icon, title, subtitle, done, loading, onPress }: TileProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [styles.tile, done && styles.tileDone, pressed && styles.pressed]}
    >
      <View style={[styles.tileIcon, done && styles.tileIconDone]}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Ionicons name={done ? 'checkmark' : icon} size={22} color={done ? colors.onPrimary : colors.primary} />
        )}
      </View>
      <Text style={[styles.tileTitle, done && styles.tileTitleDone]}>{title}</Text>
      <Text style={styles.tileSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

function Section({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={18} color={colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export function DemandFormView({ demandId }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const vm = useDemandFormViewModel(demandId);

  if (vm.loadingData) {
    return (
      <View style={[styles.flex, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Section title="O problema" icon="alert-circle-outline">
        <TextField testID="form-title" label="Título" icon="create-outline" placeholder="Ex: Poste apagado" value={vm.title} onChangeText={vm.setTitle} />

        <Text style={styles.label}>Categoria</Text>
        <View style={styles.chips}>
          {vm.categories.map((category) => (
            <Chip
              key={category.id}
              testID={`form-category-${category.id}`}
              accessibilityRole="radio"
              label={category.nome}
              selected={vm.categoryId === category.id}
              onPress={() => vm.setCategoryId(category.id)}
            />
          ))}
        </View>

        <TextField testID="form-address" label="Endereço" icon="map-outline" placeholder="Ex: Rua das Flores, 123" value={vm.locationText} onChangeText={vm.setLocationText} />

        <TextField
          testID="form-description"
          label="Descrição"
          icon="document-text-outline"
          placeholder="Detalhe o problema..."
          value={vm.description}
          onChangeText={vm.setDescription}
          multiline
        />
      </Section>

      <Section title="Região" icon="earth-outline">
        <SelectField
          testID="form-state"
          label="Estado"
          icon="flag-outline"
          placeholder="Selecione o estado"
          searchPlaceholder="Buscar estado"
          value={vm.stateUf}
          options={vm.stateOptions}
          onSelect={vm.selectState}
        />

        {vm.citiesFailed ? (
          <TextField
            testID="form-city-text"
            label="Cidade"
            icon="business-outline"
            placeholder="Digite a cidade"
            value={vm.city ?? ''}
            onChangeText={vm.setCity}
          />
        ) : (
          <SelectField
            testID="form-city"
            label="Cidade"
            icon="business-outline"
            placeholder={vm.stateUf ? 'Selecione a cidade' : 'Escolha o estado primeiro'}
            searchPlaceholder="Buscar cidade"
            value={vm.city}
            options={vm.cityOptions}
            onSelect={vm.setCity}
            loading={vm.loadingCities}
            disabled={!vm.stateUf}
          />
        )}

        <Text style={styles.label}>Zona</Text>
        <View style={styles.chips}>
          {ZONES.map((option) => (
            <Chip
              key={option.value}
              testID={`form-zone-${option.value}`}
              accessibilityRole="radio"
              label={option.label}
              selected={vm.zone === option.value}
              onPress={() => vm.setZone(option.value)}
            />
          ))}
        </View>
        <Text style={styles.hint}>Dica: ao usar o GPS, o estado e a cidade são preenchidos automaticamente.</Text>
      </Section>

      <Section title="Localização" icon="location-outline">
        <View style={styles.tiles}>
          <ActionTile
            testID="form-gps"
            icon="navigate-outline"
            title={vm.coords ? 'GPS OK' : 'Usar GPS'}
            subtitle={vm.coords ? `${vm.coords.latitude.toFixed(5)}, ${vm.coords.longitude.toFixed(5)}` : 'Capturar localização'}
            done={!!vm.coords}
            loading={vm.locating}
            onPress={vm.captureLocation}
          />
        </View>
      </Section>

      <Section title={`Fotos (${vm.photos.length}/${MAX_DEMAND_PHOTOS})`} icon="images-outline">
        <View style={styles.tiles}>
          <ActionTile
            testID="form-photo"
            icon="camera-outline"
            title="Câmera"
            subtitle="Tirar uma foto"
            done={false}
            onPress={vm.openCamera}
          />
          <ActionTile
            testID="form-gallery"
            icon="images-outline"
            title="Galeria"
            subtitle="Escolher fotos"
            done={false}
            onPress={vm.pickFromGallery}
          />
        </View>

        {vm.photos.length > 0 ? (
          <View style={styles.thumbs}>
            {vm.photos.map((photo, index) => (
              <View key={photo.key} testID={`form-photo-thumb-${index}`} style={styles.thumbWrap}>
                <Image source={{ uri: photo.uri }} style={styles.thumb} />
                <Pressable
                  testID={`form-photo-remove-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Remover foto ${index + 1}`}
                  hitSlop={8}
                  style={styles.thumbRemove}
                  onPress={() => vm.removePhoto(photo.key)}
                >
                  <Ionicons name="close" size={14} color={colors.onPrimary} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.hint}>Opcional. Você pode anexar até {MAX_DEMAND_PHOTOS} fotos.</Text>
        )}
      </Section>

      <Button
        testID="form-submit"
        icon={vm.isEditing ? 'save-outline' : 'send'}
        title={vm.isEditing ? 'Salvar Alterações' : 'Registrar Demanda'}
        onPress={vm.submit}
        loading={vm.submitting}
        style={styles.submit}
      />

      <CameraCapture visible={vm.cameraVisible} onCapture={vm.onPhotoTaken} onClose={vm.closeCamera} />
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => ({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  container: { padding: 16, paddingBottom: 40 },
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, paddingBottom: 4, marginBottom: 14, ...shadow(1) },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 8, marginLeft: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  hint: { fontSize: 12, color: colors.textSubtle, marginTop: -6, marginBottom: 14, marginLeft: 2 },
  tiles: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  tile: {
    flex: 1,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tileDone: { borderStyle: 'solid', borderColor: colors.success, backgroundColor: colors.successSoft },
  tileIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  tileIconDone: { backgroundColor: colors.success },
  tileTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  tileTitleDone: { color: colors.success },
  tileSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  pressed: { opacity: 0.8 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  thumbWrap: { width: 92, height: 92, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceMuted },
  thumb: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
  },
  submit: { marginTop: 6 },
}));
