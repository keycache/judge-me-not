import { Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppTheme } from '@/constants/app-theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: AppTheme.colors.accent,
        tabBarInactiveTintColor: AppTheme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: AppTheme.colors.surfacePrimary,
          borderTopColor: AppTheme.colors.borderSubtle,
          borderTopWidth: 1,
          borderRadius: 0,
          paddingBottom: Math.max(insets.bottom, AppTheme.spacing.sm),
          paddingTop: AppTheme.spacing.xs,
          position: 'relative',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        },
        tabBarItemStyle: {
          borderRadius: 0,
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Prepare',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: 'Practice',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="mic.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
