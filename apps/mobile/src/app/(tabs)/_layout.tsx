import { theme } from '../../design-system';
import { Tabs } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { iconPaths as icons } from '../../../../../shared/design-tokens/src/index';
export default function Layout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.color.teal,
        tabBarStyle: {
          height: 68,
          paddingBottom: 10,
          backgroundColor: theme.color.white,
          borderTopColor: theme.color.border,
        },
        tabBarLabelStyle: { fontFamily: 'ManropeSemibold', fontSize: 11 },
        tabBarIcon: ({ color, size }) => (
          <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path
              d={icons[route.name]}
              stroke={color}
              strokeWidth={1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        ),
      })}
    >
      <Tabs.Screen name="health" options={{ title: 'My Health' }} />
      <Tabs.Screen name="wellness" options={{ title: 'My Wellness' }} />
      <Tabs.Screen name="community" options={{ title: 'Community & Trends' }} />
    </Tabs>
  );
}
