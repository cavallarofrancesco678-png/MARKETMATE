import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../theme/colors';

interface NeuBoxProps {
  children: React.ReactNode;
  style?: ViewStyle;
  pressed?: boolean;
  color?: string;
  borderRadius?: number;
  padding?: number;
}

export const NeuBox: React.FC<NeuBoxProps> = ({
  children,
  style,
  pressed = false,
  color,
  borderRadius = 15,
  padding = 12,
}) => {
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: pressed ? Colors.bgDark : (color || Colors.bg),
          borderRadius,
          padding,
          shadowColor: pressed ? Colors.shadowDark : Colors.shadowDark,
          shadowOffset: pressed ? { width: 2, height: 2 } : { width: 4, height: 4 },
          shadowOpacity: pressed ? 0.3 : 0.4,
          shadowRadius: pressed ? 4 : 8,
          elevation: pressed ? 2 : 5,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

export const NeuInset: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children,
  style,
}) => {
  return (
    <View style={[styles.inset, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bg,
  },
  inset: {
    backgroundColor: Colors.bgDark,
    borderRadius: 12,
    padding: 8,
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
});
