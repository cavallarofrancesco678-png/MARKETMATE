import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  const TabItem = ({ name, label, focused }: { name: string; label: string; focused: boolean }) => (
    <View style={styles.tabItem}>
      <View style={[styles.iconOval, focused && styles.iconOvalActive]}>
        <Ionicons
          name={name as any}
          size={20}
          color={focused ? '#F0D080' : 'rgba(160,200,190,0.85)'}
        />
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabItem name="home-outline" label="HOME" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => <TabItem name="settings-outline" label="SETTING" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          tabBarIcon: ({ focused }) => <TabItem name="bar-chart-outline" label="STATISTICHE" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="gas"
        options={{
          tabBarIcon: ({ focused }) => <TabItem name="document-text-outline" label="CARBURANTE" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          tabBarIcon: ({ focused }) => <TabItem name="calendar-outline" label="AGENDA" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#1A3535',
    borderTopWidth: 0,
    height: 75,
    paddingTop: 4,
    paddingBottom: 6,
    paddingHorizontal: 6,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    // @ts-ignore
    boxShadow: '0px -3px 14px rgba(0,0,0,0.3)',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    width: 62,
  },
  iconOval: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(40,80,75,0.7)',
    // @ts-ignore
    boxShadow: '2px 3px 8px rgba(0,0,0,0.4), inset 0px 1px 4px rgba(120,180,170,0.3)',
  },
  iconOvalActive: {
    backgroundColor: 'rgba(50,110,105,0.85)',
    // @ts-ignore
    boxShadow: '0px 0px 12px rgba(240,208,128,0.4), 2px 3px 8px rgba(0,0,0,0.4), inset 0px 1px 4px rgba(120,180,170,0.3)',
  },
  tabLabel: {
    fontSize: 7,
    fontWeight: '700',
    color: 'rgba(160,200,190,0.65)',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#F0D080',
    fontWeight: '800',
  },
});
