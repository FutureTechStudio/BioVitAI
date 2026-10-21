import { Tabs } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
const icons: Record<string, string> = {
  health: 'M12 21S3 15 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6-9 12-9 12Z',
  wellness: 'M20 4C8 3 3 9 5 16c5 4 13 1 15-12ZM5 20l10-10',
  community:
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-3c0-6 14-6 14 0v3M17 5a3 3 0 0 1 0 6M18 14c3 0 4 2 4 4v3',
};
export default function Layout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#27614e',
        tabBarStyle: { height: 68, paddingBottom: 10 },
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
