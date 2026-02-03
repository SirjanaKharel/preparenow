import { AppRegistry } from 'react-native';
import App from './App';

// Explicitly register the root component under the name 'main' so native iOS
// (which expects the entry point named "main") finds it at runtime.
AppRegistry.registerComponent('main', () => App);
