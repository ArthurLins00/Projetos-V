// NativeWind v4 fica restrito aos arquivos que usam className: eles declaram `/** @jsxImportSource nativewind */`
// no topo (ver src/components/ui/CountBadge.tsx). Não ligue o jsxImportSource nem o preset 'nativewind/babel'
// para o app inteiro: o runtime do NativeWind troca todo Pressable pela versão dele, que descarta o
// `style={({ pressed }) => ...}` usado nos botões, chips e cards, e as telas perdem a formatação.
// O plugin do Reanimated/Worklets já é adicionado automaticamente pelo babel-preset-expo.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
