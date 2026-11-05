// ADR-0013 / spec 008: native modules that come only as optional peers of
// expo-router and that the app does not use. Linking them would compile their
// C++ (CMake/Ninja) for nothing, and on Windows their deep paths exceed what the
// Android NDK's Ninja handles. Remove an entry here before using the library.
const notLinked = { platforms: { android: null, ios: null } };

module.exports = {
  dependencies: {
    'react-native-reanimated': notLinked,
    'react-native-worklets': notLinked,
  },
};
