/* global jest */
// Reanimated en las pruebas. No hay hilo de interfaz ni módulo nativo: se usan los mocks oficiales de worklets y de
// Reanimated (las animaciones terminan al instante), más lo que ese mock no trae y la app usa.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  return {
    ...mock,
    __esModule: true,
    // Sin «reducir animaciones»: las pruebas que lo necesitan lo cambian con `jest.mocked(useReducedMotion)`.
    useReducedMotion: jest.fn(() => false),
    cubicBezier: () => 'cubic-bezier-de-prueba',
  };
});
