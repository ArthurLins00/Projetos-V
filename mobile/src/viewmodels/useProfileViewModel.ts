import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { getApiErrorMessage } from '../services/api';
import { UpdateProfilePayload, UserProfile } from '../models/User';
import { ThemePreference, useTheme } from '../theme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useProfileViewModel() {
  const router = useRouter();
  const { user, updateUser, signOut } = useAuth();
  const { preference, setPreference } = useTheme();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [nome, setNome] = useState(user?.nome ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [emailPassword, setEmailPassword] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [savingTwoFactor, setSavingTwoFactor] = useState(false);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    authService
      .me()
      .then((data) => {
        setProfile(data);
        setNome(data.nome);
        setEmail(data.email);
        if (data.fotourl !== user?.fotourl) updateUser(data);
      })
      .catch(() => {});
  }, []);

  const currentNome = profile?.nome ?? user?.nome ?? '';
  const currentEmail = profile?.email ?? user?.email ?? '';
  const emailChanged = email.trim() !== currentEmail;
  const infoChanged = nome.trim() !== currentNome || emailChanged;

  const applyUpdate = async (payload: UpdateProfilePayload) => {
    const updated = await authService.updateMe(payload);
    setProfile(updated);
    setNome(updated.nome);
    setEmail(updated.email);
    await updateUser(updated);
  };

  const saveInfo = async () => {
    if (!nome.trim()) return Alert.alert('Erro', 'Informe seu nome.');
    if (!EMAIL_REGEX.test(email.trim())) return Alert.alert('Erro', 'Informe um e-mail válido.');
    if (emailChanged && !emailPassword) return Alert.alert('Erro', 'Informe sua senha atual para alterar o e-mail.');

    try {
      setSavingInfo(true);
      const payload: UpdateProfilePayload = {};
      if (nome.trim() !== currentNome) payload.nome = nome.trim();
      if (emailChanged) {
        payload.email = email.trim();
        payload.senhaAtual = emailPassword;
      }
      await applyUpdate(payload);
      setEmailPassword('');
      Alert.alert('Sucesso', 'Seus dados foram atualizados.');
    } catch (error) {
      Alert.alert('Erro', getApiErrorMessage(error, 'Não foi possível atualizar seus dados.'));
    } finally {
      setSavingInfo(false);
    }
  };

  const savePassword = async () => {
    if (!senhaAtual || !novaSenha) return Alert.alert('Erro', 'Preencha a senha atual e a nova senha.');
    if (novaSenha.length < 6) return Alert.alert('Erro', 'A nova senha deve ter no mínimo 6 caracteres.');
    if (novaSenha !== confirmarSenha) return Alert.alert('Erro', 'A confirmação não confere com a nova senha.');

    try {
      setSavingPassword(true);
      await applyUpdate({ senhaAtual, novaSenha });
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
      Alert.alert('Sucesso', 'Sua senha foi alterada.');
    } catch (error) {
      Alert.alert('Erro', getApiErrorMessage(error, 'Não foi possível alterar a senha.'));
    } finally {
      setSavingPassword(false);
    }
  };

  const twoFactorEnabled = !!profile?.doisfatores;

  const toggleTwoFactor = async () => {
    if (!twoFactorPassword) return Alert.alert('Erro', 'Informe sua senha atual.');

    try {
      setSavingTwoFactor(true);
      const updated = await authService.setTwoFactor(!twoFactorEnabled, twoFactorPassword);
      setProfile(updated);
      setTwoFactorPassword('');
      Alert.alert(
        'Sucesso',
        updated.doisfatores
          ? 'Verificação em duas etapas ativada. Nos próximos logins enviaremos um código para o seu e-mail.'
          : 'Verificação em duas etapas desativada.'
      );
    } catch (error) {
      Alert.alert('Erro', getApiErrorMessage(error, 'Não foi possível alterar a verificação em duas etapas.'));
    } finally {
      setSavingTwoFactor(false);
    }
  };

  const pickPhoto = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return Alert.alert('Permissão negada', source === 'camera' ? 'Permita o acesso à câmera.' : 'Permita o acesso às fotos.');
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
      cameraType: ImagePicker.CameraType.front,
    };
    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const base64 = result.canceled ? null : result.assets[0]?.base64;
    if (!base64) return;

    try {
      setUploadingPhoto(true);
      const updated = await authService.uploadPhoto(base64);
      setProfile(updated);
      await updateUser(updated);
    } catch (error) {
      Alert.alert('Erro', getApiErrorMessage(error, 'Não foi possível atualizar a foto.'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = async () => {
    try {
      setUploadingPhoto(true);
      const updated = await authService.removePhoto();
      setProfile(updated);
      await updateUser(updated);
    } catch (error) {
      Alert.alert('Erro', getApiErrorMessage(error, 'Não foi possível remover a foto.'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const photoUrl = profile ? profile.fotourl : user?.fotourl;

  const changePhoto = () =>
    Alert.alert('Foto de perfil', undefined, [
      { text: 'Tirar foto', onPress: () => pickPhoto('camera') },
      { text: 'Escolher da galeria', onPress: () => pickPhoto('library') },
      ...(photoUrl ? [{ text: 'Remover foto', style: 'destructive' as const, onPress: removePhoto }] : []),
      { text: 'Cancelar', style: 'cancel' },
    ]);

  const confirmSignOut = () =>
    Alert.alert('Sair da conta', 'Deseja encerrar a sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);

  return {
    user,
    profile,
    nome,
    setNome,
    email,
    setEmail,
    emailChanged,
    emailPassword,
    setEmailPassword,
    infoChanged,
    savingInfo,
    saveInfo,
    senhaAtual,
    setSenhaAtual,
    novaSenha,
    setNovaSenha,
    confirmarSenha,
    setConfirmarSenha,
    savingPassword,
    savePassword,
    twoFactorEnabled,
    twoFactorPassword,
    setTwoFactorPassword,
    savingTwoFactor,
    toggleTwoFactor,
    photoUrl,
    uploadingPhoto,
    changePhoto,
    themePreference: preference,
    setThemePreference: (value: ThemePreference) => setPreference(value),
    confirmSignOut,
    openHelp: () => router.push('/(app)/help'),
  };
}
