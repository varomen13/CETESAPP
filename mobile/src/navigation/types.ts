import {NavigatorScreenParams} from '@react-navigation/native';

export type MainTabParamList = {
  Inicio: undefined;
  Radar: undefined;
  Calcular: undefined;
  Portafolio: undefined;
  Ajustes: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Education: undefined;
};
