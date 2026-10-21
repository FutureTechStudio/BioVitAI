import { BioText as Text, BioCard, theme } from '../../design-system';
import { ScrollView } from 'react-native';
import { useSession } from '../../session';
export default function Wellness() {
  const { context } = useSession();
  return (
    <ScrollView
      style={{ backgroundColor: theme.color.canvas }}
      contentContainerStyle={{ padding: 25, flexGrow: 1 }}
    >
      <BioCard>
        <Text style={{ fontSize: 28 }}>Make room for feeling well.</Text>
        <Text style={{ marginTop: 20 }}>
          {context.profile
            ? `For ${context.profile.displayName}`
            : 'Select a profile to continue.'}
        </Text>
        <Text style={{ marginTop: 20 }}>
          Wellness plans and check-ins are not available yet.
        </Text>
      </BioCard>
    </ScrollView>
  );
}
