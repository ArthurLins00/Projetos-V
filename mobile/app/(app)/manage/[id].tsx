import { useLocalSearchParams } from 'expo-router';
import { ManagedTicketView } from '../../../src/views/ManagedTicketView';

export default function ManagedTicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ManagedTicketView ticketId={id} />;
}
