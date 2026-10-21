import { View, Text } from 'react-native';
import { useSession } from '../../session';
export default function Wellness() {
  const { context } = useSession();
  return (
    <View style={{ padding: 25 }}>
      <Text style={{ fontSize: 28 }}>Make room for feeling well.</Text>
      <Text style={{ marginTop: 20 }}>
        {context.profile
          ? `For ${context.profile.displayName}`
          : 'Select a profile to continue.'}
      </Text>
      <Text style={{ marginTop: 20 }}>
        Wellness plans and check-ins belong to P6 and are not available yet.
      </Text>
    </View>
  );
}
