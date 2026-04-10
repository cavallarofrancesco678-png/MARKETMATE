import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import '../../src/i18n';

// Custom Fuel Pump SVG
const FuelPumpIcon = ({ color, size }: { color: string; size: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="4" width="12" height="17" rx="2" stroke={color} strokeWidth="1.8" />
    <Rect x="5.5" y="7" width="7" height="4" rx="1" stroke={color} strokeWidth="1.5" />
    <Path d="M15 8h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M20 6l1.5 1.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M3 21h12" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </Svg>
);

export default function TabLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const TabIcon = ({
    name,
    focused,
    custom,
  }: {
    name?: string;
    focused: boolean;
    custom?: boolean;
  }) => (
    <View style={st.tabItem}>
      <View style={[st.oval, focused && st.ovalActive]}>
        {custom ? (
          <FuelPumpIcon color={focused ? '#FFFFFF' : '#8AB5AD'} size={20} />
        ) : (
          <Ionicons
            name={name as any}
            size={20}
            color={focused ? '#FFFFFF' : '#8AB5AD'}
          />
        )}
      </View>
    </View>
  );

  return (
    <Tabs
      sceneContainerStyle={{
        paddingTop: insets.top + 10,
        backgroundColor: '#F5F0E6',
      }}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          ...st.bar,
          paddingBottom: Math.max(insets.bottom, 10),
          height: 70 + Math.max(insets.bottom, 10),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="settings" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="bar-chart" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="gas"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon custom focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="calendar" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const st = StyleSheet.create({
  bar: {
    backgroundColor: '#1A3A3A',
    borderTopWidth: 0,
    height: 80,
    paddingTop: 6,
    paddingBottom: 10,
    paddingHorizontal: 8,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    // @ts-ignore
    boxShadow: '0px -4px 16px rgba(0,0,0,0.3)',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  oval: {
    width: 48,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(20,50,50,0.7)',
    // @ts-ignore
    boxShadow:
      '5px 5px 12px rgba(0,0,0,0.4), -4px -4px 10px rgba(40,70,70,0.35), inset 1px 1px 3px rgba(0,0,0,0.25)',
  },
  ovalActive: {
    backgroundColor: 'rgba(30,127,133,0.95)',
    // @ts-ignore
    boxShadow:
      '0px 0px 18px rgba(30,127,133,0.6), 5px 5px 14px rgba(0,0,0,0.35), -3px -3px 10px rgba(40,80,85,0.3)',
  },
  label: {
    fontSize: 7,
    fontWeight: '700',
    color: '#5A8A85',
    letterSpacing: 0.3,
  },
  labelActive: {
    color: '#C0E8E0',
    fontWeight: '800',
  },
});
