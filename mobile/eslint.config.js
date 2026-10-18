// Flat config for the React Native app.
//
// The repo root's Next config deliberately ignores `mobile/**` — its DOM and
// jsx-a11y rules misfire on React Native (alt-text on an <Image> that is not an
// <img>). eslint-config-expo is the React Native equivalent.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: ["node_modules/**", ".expo/**", "dist/**", "ios/**", "android/**"],
  },
]);
