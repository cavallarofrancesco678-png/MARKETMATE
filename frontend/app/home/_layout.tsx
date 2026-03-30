import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Rect } from 'react-native-svg';

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
  const TabIcon = ({
    name,
    focused,
    custom,
    label,
  }: {
    name?: string;
    focused: boolean;
    custom?: boolean;
    label: string;
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
      <Text style={[st.label, focused && st.labelActive]}>{label}</Text>
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: st.bar,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="home" focused={focused} label="HOME" />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="settings" focused={focused} label="SETTING" />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="bar-chart" focused={focused} label="STATISTICHE" />
          ),
        }}
      />
      <Tabs.Screen
        name="gas"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon custom focused={focused} label="CARBURANTE" />
          ),
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="calendar" focused={focused} label="AGENDA" />
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
    width: 46,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(26,58,58,0.8)',
    // @ts-ignore
    boxShadow:
      'inset 1px 1px 4px rgba(0,0,0,0.35), 2px 2px 6px rgba(0,0,0,0.2)',
  },
  ovalActive: {
    backgroundColor: 'rgba(30,127,133,0.9)',
    // @ts-ignore
    boxShadow:
      '0px 0px 14px rgba(30,127,133,0.5), 0px 2px 8px rgba(0,0,0,0.3)',
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
