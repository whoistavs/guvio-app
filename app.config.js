// Usa o app.json e, só no build da versão web, define o caminho base
// (no GitHub Pages o site fica em /guvio-app/).
module.exports = ({ config }) => ({
  ...config,
  // no build do APK, o número da versão vem do GitHub (sempre maior que o anterior)
  ...(process.env.ANDROID_VERSION_CODE
    ? { android: { ...config.android, versionCode: 100 + Number(process.env.ANDROID_VERSION_CODE) } }
    : {}),
  experiments: {
    ...(config.experiments || {}),
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {})
  }
});
