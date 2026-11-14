// Configuração dinâmica por cima do app.json: só o que muda conforme o build fica aqui.
//
// HTTP sem TLS (usesCleartextTraffic) só fica liberado quando é necessário: builds de desenvolvimento e o APK de
// demonstração apontando para o backend local (http://IP:3000). Fica desligado no perfil production e em qualquer
// build cuja EXPO_PUBLIC_API_URL já seja HTTPS (MASVS NETWORK-1, controle SEC-08).
const PRODUCAO = process.env.EAS_BUILD_PROFILE === 'production' || process.env.APP_VARIANT === 'production';
const SO_HTTPS = PRODUCAO || (process.env.EXPO_PUBLIC_API_URL ?? '').startsWith('https://');

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    ['expo-build-properties', { android: { usesCleartextTraffic: !SO_HTTPS } }],
  ],
});
