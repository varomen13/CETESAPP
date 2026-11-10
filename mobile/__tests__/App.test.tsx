import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text as NativeText} from 'react-native';
import App from '../App';

jest.mock('lucide-react-native', () => {
  const ReactRuntime = require('react');
  const {Text} = require('react-native');
  const Icon = () => ReactRuntime.createElement(Text, null, 'icon');
  return {
    Activity: Icon,
    BriefcaseBusiness: Icon,
    Calculator: Icon,
    House: Icon,
    Settings: Icon,
  };
});

jest.mock('@react-navigation/native', () => {
  const ReactRuntime = require('react');
  const {View} = require('react-native');
  return {
    DefaultTheme: {colors: {background: 'white', primary: 'blue'}},
    NavigationContainer: ({children}: {children: React.ReactNode}) =>
      ReactRuntime.createElement(View, null, children),
  };
});

jest.mock('@react-navigation/bottom-tabs', () => {
  const ReactRuntime = require('react');
  const {Text, View} = require('react-native');
  return {
    createBottomTabNavigator: () => ({
      Navigator: ({children}: {children: React.ReactNode}) =>
        ReactRuntime.createElement(View, null, children),
      Screen: ({
        name,
        component: ScreenComponent,
      }: {
        name: string;
        component: React.ComponentType;
      }) =>
        ReactRuntime.createElement(
          View,
          null,
          ReactRuntime.createElement(Text, {testID: `tab-${name}`}, name),
          ReactRuntime.createElement(ScreenComponent),
        ),
    }),
  };
});

jest.mock('@react-navigation/native-stack', () => {
  const ReactRuntime = require('react');
  const {Text, View} = require('react-native');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({children}: {children: React.ReactNode}) =>
        ReactRuntime.createElement(View, null, children),
      Screen: ({
        name,
        component: ScreenComponent,
      }: {
        name: string;
        component: React.ComponentType;
      }) =>
        ReactRuntime.createElement(
          View,
          null,
          ReactRuntime.createElement(Text, {testID: `stack-${name}`}, name),
          ReactRuntime.createElement(ScreenComponent),
        ),
    }),
  };
});

jest.mock('react-native-screens', () => ({enableScreens: jest.fn()}));
jest.mock('react-native-safe-area-context', () => {
  const ReactRuntime = require('react');
  return {
    SafeAreaProvider: ({children}: {children: React.ReactNode}) =>
      ReactRuntime.createElement(ReactRuntime.Fragment, null, children),
    useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
  };
});
jest.mock('../src/context/CetesContext', () => ({
  CetesProvider: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('../src/screens/HomeScreen', () => ({HomeScreen: () => null}));
jest.mock('../src/screens/RadarScreen', () => ({RadarScreen: () => null}));
jest.mock('../src/screens/SimulatorScreen', () => ({SimulatorScreen: () => null}));
jest.mock('../src/screens/PortfolioScreen', () => ({PortfolioScreen: () => null}));
jest.mock('../src/screens/SettingsScreen', () => ({SettingsScreen: () => null}));
jest.mock('../src/screens/EducationScreen', () => ({EducationScreen: () => null}));

test('renders exactly five primary tabs and keeps education in the secondary stack', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });

  for (const name of ['Inicio', 'Radar', 'Calcular', 'Portafolio', 'Ajustes']) {
    expect(renderer!.root.findByProps({testID: `tab-${name}`})).toBeTruthy();
  }
  expect(
    renderer!.root
      .findAllByType(NativeText)
      .filter(node => String(node.props.testID ?? '').startsWith('tab-')),
  ).toHaveLength(5);
  expect(renderer!.root.findByProps({testID: 'stack-Education'})).toBeTruthy();
});
