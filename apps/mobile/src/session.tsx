import { Action as Pressable } from './action';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import type { ReactNode } from 'react';
import {
  AppState,
  View,
  Text,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import {
  CurrentAccountSchema,
  ProfileContextSchema,
  ProfileListSchema,
} from '../../../shared/contracts/src/web';
import type {
  PublicProfile,
  PublicProfileContext,
} from '../../../shared/contracts/src/web';
import { createProfileView } from '../../../shared/profile-context/src/index';
import { auth, nativeApi } from './api';
type Session = {
  account: { id: string; email: string } | null;
  context: PublicProfileContext;
  profiles: PublicProfile[];
  busy: boolean;
  error: string;
  guard: ReturnType<typeof createProfileView>;
  refresh: () => Promise<void>;
  select: (id: string) => Promise<void>;
  logout: () => Promise<void>;
  externalPicker: <T>(work: () => Promise<T>) => Promise<T>;
};
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Session['account']>(null),
    [context, setContext] = useState<PublicProfileContext>({
      profile: null,
      revision: 0,
    }),
    [profiles, setProfiles] = useState<PublicProfile[]>([]),
    [busy, setBusy] = useState(true),
    [error, setError] = useState('');
  const [guard] = useState(() =>
    createProfileView(() => setContext({ profile: null, revision: 0 })),
  );
  const pickerOpen = useRef(false);
  async function externalPicker<T>(work: () => Promise<T>) {
    const expected = context;
    pickerOpen.current = true;
    try {
      const result = await work();
      await nativeApi('/v1/me');
      const selected = ProfileContextSchema.parse(
        await nativeApi('/v1/profile-context'),
      );
      if (
        !selected.profile ||
        selected.profile.id !== expected.profile?.id ||
        selected.revision !== expected.revision
      ) {
        guard.clear();
        throw new Error(
          'Profile context changed while choosing a file. Select the profile again.',
        );
      }
      return result;
    } catch (error) {
      guard.clear();
      throw error;
    } finally {
      pickerOpen.current = false;
    }
  }
  const refresh = useCallback(async () => {
    const attempt = guard.beginSelection();
    setBusy(true);
    try {
      const me = CurrentAccountSchema.parse(await nativeApi('/v1/me')),
        list = ProfileListSchema.parse(await nativeApi('/v1/profiles')),
        selected = ProfileContextSchema.parse(
          await nativeApi('/v1/profile-context'),
        );
      if (
        guard.applySelection(
          attempt,
          selected.profile
            ? { profileId: selected.profile.id, revision: selected.revision }
            : null,
        )
      ) {
        setAccount(me.actor);
        setProfiles(list.profiles);
        setContext(selected);
        setError('');
        setBusy(false);
      }
    } catch {
      if (guard.applySelection(attempt, null)) {
        setAccount(null);
        setProfiles([]);
        setBusy(false);
        router.replace('/auth');
      }
    }
  }, [guard]);
  useEffect(() => {
    void refresh();
    const listener = AppState.addEventListener('change', (state) => {
      if (pickerOpen.current) return;
      guard.clear();
      setBusy(true);
      if (state === 'active') void refresh();
    });
    return () => {
      listener.remove();
      guard.clear();
    };
  }, [refresh, guard]);
  async function select(id: string) {
    const revision = context.revision,
      attempt = guard.beginSelection();
    setBusy(true);
    setError('');
    try {
      const selected = ProfileContextSchema.parse(
        await nativeApi('/v1/profile-context', {
          profileId: id,
          expectedRevision: revision,
        }),
      );
      if (
        guard.applySelection(
          attempt,
          selected.profile
            ? { profileId: selected.profile.id, revision: selected.revision }
            : null,
        )
      ) {
        setContext(selected);
        setBusy(false);
      }
    } catch {
      if (guard.applySelection(attempt, null)) {
        setBusy(false);
        setError(
          'Profile selection changed or access is unavailable. Refresh and select again.',
        );
      }
    }
  }
  async function logout() {
    guard.clear();
    setAccount(null);
    setProfiles([]);
    await auth.signOut();
    router.replace('/auth');
  }
  return (
    <Context.Provider
      value={{
        account,
        context,
        profiles,
        busy,
        error,
        guard,
        refresh,
        select,
        logout,
        externalPicker,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error('Session unavailable');
  return value;
}
export function ProfileHeader() {
  const session = useSession(),
    [open, setOpen] = useState(false);
  if (!session.account) return null;
  return (
    <View style={s.header}>
      {router.canGoBack() && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
        >
          <Text>‹ Back</Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose profile"
        accessibilityValue={{
          text: session.context.profile?.displayName ?? 'No profile selected',
        }}
        style={{ flex: 1, minWidth: 0, marginHorizontal: 10 }}
        onPress={() => setOpen(true)}
        disabled={session.busy}
      >
        <Text style={s.caption}>VIEWING PROFILE</Text>
        <Text style={s.name} numberOfLines={2}>
          {session.busy
            ? 'Loading…'
            : (session.context.profile?.displayName ?? 'Select a profile')}{' '}
          ▾
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => void session.logout()}
      >
        <Text>Sign out</Text>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={s.overlay}>
          <View style={s.dialog}>
            <Text style={s.name}>Choose a profile</Text>
            <Text>Signed in as {session.account.email}</Text>
            <ScrollView>
              {session.profiles.map((p) => (
                <Pressable
                  key={p.id}
                  style={s.option}
                  accessibilityRole="button"
                  onPress={() => {
                    setOpen(false);
                    void session.select(p.id);
                  }}
                >
                  <Text>
                    {p.displayName} · {p.kind === 'self' ? 'Me' : 'Family'}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              style={s.option}
              onPress={() => {
                setOpen(false);
                router.push('/profiles');
              }}
            >
              <Text>Add or manage family profiles →</Text>
            </Pressable>
            <Pressable onPress={() => setOpen(false)}>
              <Text>Close</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setOpen(false);
                void session.refresh();
              }}
            >
              <Text>Refresh profile access</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  header: {
    padding: 18,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#dfe7dc',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  caption: { fontSize: 10, color: '#6b7e71' },
  name: {
    fontSize: 18,
    color: '#254e3e',
    fontWeight: '600',
    marginVertical: 6,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#0006',
    padding: 25,
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 25,
    maxHeight: '80%',
  },
  option: { paddingVertical: 18, borderBottomWidth: 1, borderColor: '#e2e8df' },
});
