import { Action as Pressable, Field as TextInput } from '../action';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useSession } from '../session';
import { nativeApi } from '../api';
export default function Profiles() {
  const session = useSession(),
    [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [message, setMessage] = useState('');
  async function create() {
    try {
      await nativeApi('/v1/profiles', {
        displayName: name,
        kind: 'family',
        ...(email.trim() ? { contactEmail: email.trim() } : {}),
      });
      setName('');
      setEmail('');
      await session.refresh();
      setMessage('Family profile created. Select it using the profile picker.');
    } catch {
      setMessage('Unable to create profile. Check the details and retry.');
    }
  }
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 25, gap: 20 }}
    >
      <Text style={{ fontSize: 28 }}>Family profiles</Text>
      <Text>
        Email is optional. Adding a contact email does not grant access or link
        an account.
      </Text>
      <TextInput
        accessibilityLabel="Family member name"
        placeholder="Family member name"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        accessibilityLabel="Optional contact email"
        placeholder="Contact email (optional)"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Pressable disabled={!name.trim()} onPress={() => void create()}>
        <Text>Add family member</Text>
      </Pressable>
      {!!message && <Text accessibilityRole="alert">{message}</Text>}
      {session.profiles.map((p) => (
        <Contact key={p.id} id={p.id} name={p.displayName} />
      ))}
    </ScrollView>
  );
}
function Contact({ id, name }: { id: string; name: string }) {
  const [email, setEmail] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const session = useSession();
  async function save() {
    const ticket = session.guard.request();
    setBusy(true);
    try {
      await nativeApi(
        `/v1/profiles/${id}/contact`,
        { email: email.trim() || null },
        ticket.context,
        ticket.signal,
      );
      session.guard.publish(ticket, () =>
        setMessage(
          'Contact email saved. Account access still requires a verified invitation.',
        ),
      );
    } catch {
      session.guard.publish(ticket, () =>
        setMessage(
          'Only the owner can update this contact. Check the email and retry.',
        ),
      );
    } finally {
      session.guard.publish(ticket, () => setBusy(false));
    }
  }
  return (
    <>
      <Text>{name}</Text>
      <TextInput
        accessibilityLabel={`New contact email for ${name}`}
        placeholder="New contact email (blank removes it)"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        editable={!busy}
      />
      <Pressable
        disabled={busy || !session.context.profile}
        onPress={() => void save()}
      >
        <Text>Save contact email for {name}</Text>
      </Pressable>
      {!!message && <Text accessibilityRole="alert">{message}</Text>}
    </>
  );
}
