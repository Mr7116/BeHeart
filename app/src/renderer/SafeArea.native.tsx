// iPhone: keep content clear of the notch / Dynamic Island and the home indicator.
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

export function SafeArea({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <SafeAreaView style={style} edges={['top', 'bottom', 'left', 'right']}>
      {children}
    </SafeAreaView>
  );
}

export function SafeAreaRoot({ children }: { children?: React.ReactNode }) {
  return <SafeAreaProvider>{children}</SafeAreaProvider>;
}
