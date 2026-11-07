// Configuração do Metro (empacotador do app).
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// No iPhone/Android o app acabava com DUAS cópias do three.js:
// o nosso código pegava three.module.js e o React Three Fiber pegava three.cjs.
// Objetos de uma cópia não eram desenhados pela outra (globo vazio).
// Aqui forçamos "three" a ser sempre o mesmo arquivo no celular.
const THREE_CJS = path.resolve(__dirname, "node_modules/three/build/three.cjs");
const defaultResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "three" && platform !== "web") {
    return { type: "sourceFile", filePath: THREE_CJS };
  }
  return defaultResolve
    ? defaultResolve(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
