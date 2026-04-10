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
  borderRadius = 20,
  padding = 15,
}) => {
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: pressed ? Colors.bgDark : (color || Colors.bgCard),
          borderRadius,
          padding,
        },
        pressed ? styles.pressedShadow : styles.normalShadow,
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

// Warm gradient-style button component
export const WarmButton: React.FC<{
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'primary' | 'secondary' | 'success';
}> = ({ children, style, variant = 'primary' }) => {
  const getColors = () => {
    switch (variant) {
      case 'success':
        return { bg: Colors.verde, border: '#6B8E6B' };
      case 'secondary':
        return { bg: Colors.caramello, border: '#A06835' };
      default:
        return { bg: Colors.arancio, border: Colors.terracotta };
    }
  };
  
  const colors = getColors();
  
  return (
    <View
      style={[
        styles.warmButton,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgCard,
  },
  normalShadow: {
    // @ts-ignore
    boxShadow: '6px 6px 14px rgba(160,150,130,0.5), -5px -5px 12px rgba(255,255,250,0.95)',
  },
  pressedShadow: {
    // @ts-ignore
    boxShadow: 'inset 3px 3px 8px rgba(10,40,45,0.35), inset -3px -3px 7px rgba(45,120,125,0.25)',
  },
  inset: {
    backgroundColor: Colors.bg,
    borderRadius: 15,
    padding: 12,
    // @ts-ignore
    boxShadow: 'inset 2px 2px 6px rgba(130,150,140,0.3), inset -2px -2px 5px rgba(255,255,250,0.5)',
  },
  warmButton: {
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
});
