import { Stack, usePathname } from 'expo-router';
import { KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SessionProvider, ProfileHeader } from '../session';
export default function Layout() {
  const pathname = usePathname();
  return (
    <SessionProvider>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: '#fff' }}
        edges={['top', 'left', 'right']}
      >
        <StatusBar barStyle="dark-content" />
        {pathname !== '/auth' && <ProfileHeader />}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Stack screenOptions={{ headerShown: false }} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SessionProvider>
  );
}
