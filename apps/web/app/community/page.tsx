import { Shell } from '../../src/shell';
export default function Page() {
  return (
    <Shell
      tab="community"
      communityEnabled={process.env.COMMUNITY_ENABLED !== 'false'}
    />
  );
}
