import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Flame, Gamepad2, Layers } from 'lucide-react-native';
import { COLORS } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.hot,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        sceneStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Вайби',
          tabBarIcon: ({ color }) => <Flame color={color} size={20} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="games"
        options={{
          title: 'Ігри',
          tabBarIcon: ({ color }) => <Gamepad2 color={color} size={20} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="decks"
        options={{
          title: 'Колоди',
          tabBarIcon: ({ color }) => <Layers color={color} size={20} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#0A0A12',
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 26 : 10,
    elevation: 0,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: 2,
  },
});
