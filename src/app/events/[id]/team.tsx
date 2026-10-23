import { useLocalSearchParams } from 'expo-router';
import { EventTeamWorkspace } from '../../../components/events/EventTeamWorkspace';
export default function EventTeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventTeamWorkspace eventId={id} />;
}
