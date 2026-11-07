// Usa o app.json e, só no build da versão web, define o caminho base
// (no GitHub Pages o site fica em /guvio-app/).
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...(config.experiments || {}),
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {})
  }
});
