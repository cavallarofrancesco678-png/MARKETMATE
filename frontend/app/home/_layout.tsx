import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';

export default function TabLayout() {
  const TabItem = ({ name, label, focused }: { name: string; label: string; focused: boolean }) => (
    <View style={styles.tabItem}>
      <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
        <Ionicons
          name={name as any}
          size={22}
          color={focused ? '#F0D080' : 'rgba(200,220,210,0.7)'}
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
          tabBarIcon: ({ focused }) => <TabItem name="home" label="HOME" focused={focused} />,
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
          tabBarIcon: ({ focused }) => <TabItem name="stats-chart" label="STATISTICHE" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="gas"
        options={{
          tabBarIcon: ({ focused }) => <TabItem name="car" label="CARBURANTE" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          tabBarIcon: ({ focused }) => <TabItem name="calendar" label="AGENDA" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#1A3A3A',
    borderTopWidth: 0,
    height: 78,
    paddingTop: 6,
    paddingBottom: 8,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    // @ts-ignore
    boxShadow: '0px -4px 16px rgba(0,0,0,0.3)',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(40,80,80,0.6)',
    // @ts-ignore
    boxShadow: '2px 3px 8px rgba(0,0,0,0.4), -1px -1px 4px rgba(60,100,100,0.3)',
  },
  iconContainerActive: {
    backgroundColor: 'rgba(60,120,110,0.8)',
    // @ts-ignore
    boxShadow: '0px 0px 12px rgba(240,208,128,0.4), 2px 3px 8px rgba(0,0,0,0.4)',
  },
  tabLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: 'rgba(200,220,210,0.5)',
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: '#F0D080',
    fontWeight: '800',
  },
});
