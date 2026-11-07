// Desktop: no notch or home indicator, so the safe area is just a plain view.
import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

export function SafeArea({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={style}>{children}</View>;
}

export function SafeAreaRoot({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}
