import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';

export default function TabLayout() {
  // Round icons like weather - same size (48px), no labels
  const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => (
    <View style={[
      styles.iconCircle,
      focused ? styles.iconPressed : styles.iconNormal
    ]}>
      <Ionicons
        name={name as any}
        size={24}
        color={focused ? Colors.white : Colors.grey}
      />
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false, // NO LABELS
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="settings" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="stats-chart" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="gas"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="car" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.bgCard,
    borderTopWidth: 0,
    height: 75,
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  // Same size as weather icons (48x48)
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Normal state - raised
  iconNormal: {
    backgroundColor: Colors.bg,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.lightGrey,
  },
  // Pressed/Active state
  iconPressed: {
    backgroundColor: Colors.caramello,
    shadowOffset: { width: -1, height: -1 },
    shadowOpacity: 0.1,
    transform: [{ scale: 0.95 }],
    borderWidth: 2,
    borderColor: Colors.terracotta,
  },
});
