import React from 'react';
import {StatusBar} from 'react-native';
import {NavigationContainer, DefaultTheme} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {enableScreens} from 'react-native-screens';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  Activity,
  BriefcaseBusiness,
  Calculator,
  Home,
  Settings,
} from 'lucide-react-native';
import {CetesProvider} from './src/context/CetesContext';
import {HomeScreen} from './src/screens/HomeScreen';
import {RadarScreen} from './src/screens/RadarScreen';
import {SimulatorScreen} from './src/screens/SimulatorScreen';
import {PortfolioScreen} from './src/screens/PortfolioScreen';
import {SettingsScreen} from './src/screens/SettingsScreen';
import {EducationScreen} from './src/screens/EducationScreen';
import {colors} from './src/components/ui';
import {MainTabParamList, RootStackParamList} from './src/navigation/types';

enableScreens();

const Tabs = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();
type TabIconProps = {color: string; size: number};
const TAB_BAR_ICONS: Record<
  keyof MainTabParamList,
  (props: TabIconProps) => React.ReactNode
> = {
  Inicio: ({color, size}) => <Home size={size} color={color} />,
  Radar: ({color, size}) => <Activity size={size} color={color} />,
  Calcular: ({color, size}) => <Calculator size={size} color={color} />,
  Portafolio: ({color, size}) => <BriefcaseBusiness size={size} color={color} />,
  Ajustes: ({color, size}) => <Settings size={size} color={color} />,
};
const navigationTheme = {
  ...DefaultTheme,
  colors: {...DefaultTheme.colors, background: colors.background, primary: colors.navy},
};

function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {fontSize: 10, fontWeight: '700'},
        tabBarStyle: {
          height: 58 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
        },
        tabBarIcon: TAB_BAR_ICONS[route.name],
      })}>
      <Tabs.Screen name="Inicio" component={HomeScreen} />
      <Tabs.Screen name="Radar" component={RadarScreen} />
      <Tabs.Screen name="Calcular" component={SimulatorScreen} />
      <Tabs.Screen name="Portafolio" component={PortfolioScreen} />
      <Tabs.Screen name="Ajustes" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <CetesProvider>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <NavigationContainer theme={navigationTheme}>
          <Stack.Navigator screenOptions={{headerShown: false}}>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen
              name="Education"
              component={EducationScreen}
              options={{animation: 'slide_from_right'}}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </CetesProvider>
    </SafeAreaProvider>
  );
}

export default App;
