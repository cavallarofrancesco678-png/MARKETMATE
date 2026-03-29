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
          borderWidth: pressed ? 0 : 1,
          borderColor: pressed ? 'transparent' : Colors.lightGrey,
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
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  pressedShadow: {
    shadowColor: Colors.shadowDark,
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  inset: {
    backgroundColor: Colors.bg,
    borderRadius: 15,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.lightGrey,
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
