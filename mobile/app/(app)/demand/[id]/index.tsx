import { useLocalSearchParams } from 'expo-router';
import { DemandDetailView } from '../../../../src/views/DemandDetailView';

export default function DemandDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DemandDetailView demandId={id} />;
}
