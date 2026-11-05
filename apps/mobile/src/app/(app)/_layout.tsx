import { Tabs } from 'expo-router/js-tabs';

import { ClipboardIcon, UserIcon } from '../../ui/components/icons';
import { t } from '../../ui/i18n';
import { colors, fonts } from '../../ui/theme';

export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.sidebar.background },
        headerTintColor: colors.sidebar.foreground,
        headerTitleStyle: { fontFamily: fonts.extrabold, fontSize: 20 },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 12 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          minHeight: 60,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.surveys.title,
          tabBarIcon: ({ color }) => <ClipboardIcon color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="conta"
        options={{
          title: t.account.title,
          tabBarIcon: ({ color }) => <UserIcon color={String(color)} />,
        }}
      />
    </Tabs>
  );
}
