import { theme, BioFlowBackground, BioText } from '../design-system';
import { useFonts } from 'expo-font';
import ManropeRegular from '../../assets/fonts/Manrope-Regular.ttf';
import ManropeMedium from '../../assets/fonts/Manrope-Medium.ttf';
import ManropeSemibold from '../../assets/fonts/Manrope-Semibold.ttf';
import ManropeBold from '../../assets/fonts/Manrope-Bold.ttf';
import { Stack, usePathname } from 'expo-router';
import { KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SessionProvider, ProfileHeader } from '../session';
export default function Layout() {
  const pathname = usePathname();
  const [fontsLoaded, fontError] = useFonts({
    ManropeRegular,
    ManropeMedium,
    ManropeSemibold,
    ManropeBold,
  });
  if (!fontsLoaded && !fontError)
    return (
      <SafeAreaView>
        <BioText>Opening BiovitAI…</BioText>
      </SafeAreaView>
    );
  return (
    <SessionProvider>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.color.white }}
        edges={['top', 'left', 'right']}
      >
        <BioFlowBackground />
        <StatusBar barStyle="dark-content" />
        {pathname !== '/auth' && <ProfileHeader />}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.color.canvas },
            }}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SessionProvider>
  );
}
