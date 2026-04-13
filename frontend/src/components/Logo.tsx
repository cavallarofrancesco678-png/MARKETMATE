import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors } from '../theme/colors';

interface LogoProps {
  size?: number;
  color?: string;
}

export const MarketMateLogo: React.FC<LogoProps> = ({ size = 100, color = Colors.marrone }) => {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Arc */}
        <Path
          d="M20 70 A35 35 0 1 1 80 70"
          stroke={color}
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
        {/* M letter */}
        <Path
          d="M25 80 L25 40 L50 60 L75 40 L75 80"
          stroke={color}
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
