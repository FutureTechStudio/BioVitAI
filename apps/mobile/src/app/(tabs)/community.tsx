import { BioText as Text, BioCard, theme } from '../../design-system';
import { ScrollView } from 'react-native';
export default function Community() {
  return (
    <ScrollView
      style={{ backgroundColor: theme.color.canvas }}
      contentContainerStyle={{ padding: 25, flexGrow: 1 }}
    >
      <BioCard>
        <Text style={{ fontSize: 28 }}>A wider perspective.</Text>
        <Text style={{ marginTop: 20 }}>
          Read-only pilot. Published community content is not available yet.
        </Text>
      </BioCard>
    </ScrollView>
  );
}
