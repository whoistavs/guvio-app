// Usa o app.json e, só no build da versão web, define o caminho base
// (no GitHub Pages o site fica em /guvio-app/).
module.exports = ({ config }) => ({
  ...config,
  // IPA sem assinatura (Sideloadly com Apple ID grátis): sem o plugin de notificações,
  // que colocaria a permissão de push (aps-environment) que contas grátis não podem ter
  ...(process.env.GUVIO_IOS_UNSIGNED
    ? {
        plugins: (config.plugins || []).filter(
          p => (Array.isArray(p) ? p[0] : p) !== "expo-notifications"
        )
      }
    : {}),
  // no build do APK, o número da versão vem do GitHub (sempre maior que o anterior)
  ...(process.env.ANDROID_VERSION_CODE
    ? { android: { ...config.android, versionCode: 100 + Number(process.env.ANDROID_VERSION_CODE) } }
    : {}),
  experiments: {
    ...(config.experiments || {}),
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {})
  }
});
