import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  const TabIcon = ({ name, label, focused }: { name: string; label: string; focused: boolean }) => (
    <View style={st.item}>
      <View style={[st.oval, focused && st.ovalActive]}>
        <View style={st.ovalShine} />
        <Ionicons
          name={name as any}
          size={20}
          color={focused ? '#E8D088' : '#B0D8D0'}
        />
      </View>
      <Text style={[st.label, focused && st.labelActive]}>{label}</Text>
    </View>
  );

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarShowLabel: false, tabBarStyle: st.bar }}>
      <Tabs.Screen name="index" options={{ tabBarIcon: ({ focused }) => <TabIcon name="home-outline" label="HOME" focused={focused} /> }} />
      <Tabs.Screen name="settings" options={{ tabBarIcon: ({ focused }) => <TabIcon name="settings-outline" label="SETTING" focused={focused} /> }} />
      <Tabs.Screen name="stats" options={{ tabBarIcon: ({ focused }) => <TabIcon name="bar-chart-outline" label="STATISTICHE" focused={focused} /> }} />
      <Tabs.Screen name="gas" options={{ tabBarIcon: ({ focused }) => <TabIcon name="document-text-outline" label="CARBURANTE" focused={focused} /> }} />
      <Tabs.Screen name="agenda" options={{ tabBarIcon: ({ focused }) => <TabIcon name="calendar-outline" label="AGENDA" focused={focused} /> }} />
    </Tabs>
  );
}

const st = StyleSheet.create({
  bar: {
    backgroundColor: '#2A4050',
    borderTopWidth: 0,
    height: 78,
    paddingTop: 6,
    paddingBottom: 8,
    paddingHorizontal: 6,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    // @ts-ignore
    boxShadow: '0px -4px 16px rgba(0,0,0,0.3)',
  },
  item: { alignItems: 'center', justifyContent: 'center', gap: 3 },
  oval: {
    width: 52, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(50,85,80,0.75)', overflow: 'hidden',
    // @ts-ignore
    boxShadow: '3px 3px 8px rgba(0,0,0,0.45), inset 0px 2px 4px rgba(110,170,160,0.25)',
  },
  ovalActive: {
    backgroundColor: 'rgba(55,110,100,0.9)',
    // @ts-ignore
    boxShadow: '0px 0px 12px rgba(232,208,136,0.4), 3px 3px 8px rgba(0,0,0,0.45), inset 0px 2px 4px rgba(110,170,160,0.25)',
  },
  ovalShine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
    backgroundColor: 'rgba(130,190,180,0.2)', borderTopLeftRadius: 22, borderTopRightRadius: 22,
  },
  label: { fontSize: 7, fontWeight: '700', color: 'rgba(180,210,200,0.6)', textAlign: 'center' },
  labelActive: { color: '#E8D088', fontWeight: '800' },
});
