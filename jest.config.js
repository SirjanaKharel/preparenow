module.exports = {
  preset: 'react-native',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  moduleFileExtensions: ['js', 'jsx', 'json', 'ts', 'tsx'],
  setupFiles: [
    './jest.setup.js',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-navigation|@react-navigation|expo|@expo|expo-location|expo-task-manager|expo-notifications|expo-modules-core|@unimodules|unimodules|@react-native-community|@react-native-picker|@react-native-async-storage)/)'
  ],
};
