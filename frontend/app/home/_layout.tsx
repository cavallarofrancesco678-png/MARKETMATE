import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

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
  const TabIcon = ({ name, focused, custom }: { name?: string; focused: boolean; custom?: boolean }) => (
    <View style={[st.oval, focused && st.ovalActive]}>
      {custom ? (
        <FuelPumpIcon color={focused ? '#E8D090' : '#B5D8D0'} size={20} />
      ) : (
        <Ionicons name={name as any} size={20} color={focused ? '#E8D090' : '#B5D8D0'} />
      )}
    </View>
  );

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarShowLabel: false, tabBarStyle: st.bar }}>
      <Tabs.Screen name="index" options={{ tabBarIcon: ({ focused }) => <TabIcon name="home-outline" focused={focused} /> }} />
      <Tabs.Screen name="settings" options={{ tabBarIcon: ({ focused }) => <TabIcon name="settings-outline" focused={focused} /> }} />
      <Tabs.Screen name="stats" options={{ tabBarIcon: ({ focused }) => <TabIcon name="bar-chart-outline" focused={focused} /> }} />
      <Tabs.Screen name="gas" options={{ tabBarIcon: ({ focused }) => <TabIcon custom focused={focused} /> }} />
      <Tabs.Screen name="agenda" options={{ tabBarIcon: ({ focused }) => <TabIcon name="calendar-outline" focused={focused} /> }} />
    </Tabs>
  );
}

const st = StyleSheet.create({
  bar: {
    backgroundColor: '#2B5F66',
    borderTopWidth: 0,
    height: 68,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    // @ts-ignore
    boxShadow: '0px -3px 14px rgba(0,0,0,0.25)',
  },
  oval: {
    width: 48, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(40,85,80,0.7)',
    // @ts-ignore
    boxShadow: '2px 3px 7px rgba(0,0,0,0.35), inset 0px 1px 3px rgba(100,170,160,0.2)',
  },
  ovalActive: {
    backgroundColor: 'rgba(50,110,100,0.9)',
    // @ts-ignore
    boxShadow: '0px 0px 10px rgba(232,208,144,0.35), 2px 3px 7px rgba(0,0,0,0.35)',
  },
});
