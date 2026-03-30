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
          color={focused ? Colors.white : Colors.tealLight}
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
    backgroundColor: Colors.teal,
    borderTopWidth: 0,
    height: 70,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  iconContainerActive: {
    backgroundColor: Colors.tealLight,
  },
  tabLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: Colors.tealLight,
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: Colors.white,
    fontWeight: 'bold',
  },
});
