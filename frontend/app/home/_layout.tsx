import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  const TabItem = ({ name, label, focused }: { name: string; label: string; focused: boolean }) => (
    <View style={styles.tabItem}>
      <View style={[styles.iconOval, focused && styles.iconOvalActive]}>
        <View style={styles.ovalShine} />
        <Ionicons
          name={name as any}
          size={18}
          color={focused ? '#E8D090' : 'rgba(170,210,200,0.8)'}
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
    backgroundColor: '#2D4252',
    borderTopWidth: 0,
    height: 80,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 4,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    // @ts-ignore
    boxShadow: '0px -4px 16px rgba(0,0,0,0.3)',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  iconOval: {
    width: 50,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(45,80,75,0.75)',
    overflow: 'hidden',
    // @ts-ignore
    boxShadow: '2px 3px 8px rgba(0,0,0,0.4), inset 0px 1px 4px rgba(100,170,160,0.25)',
  },
  iconOvalActive: {
    backgroundColor: 'rgba(50,105,100,0.9)',
    // @ts-ignore
    boxShadow: '0px 0px 12px rgba(232,208,144,0.35), 2px 3px 8px rgba(0,0,0,0.4), inset 0px 1px 4px rgba(100,170,160,0.25)',
  },
  ovalShine: {
    position: 'absolute',
    top: 2,
    left: 8,
    right: 8,
    height: 10,
    backgroundColor: 'rgba(130,185,175,0.2)',
    borderRadius: 8,
  },
  tabLabel: {
    fontSize: 7,
    fontWeight: '700',
    color: 'rgba(195,220,210,0.55)',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#E8D090',
    fontWeight: '800',
  },
});
