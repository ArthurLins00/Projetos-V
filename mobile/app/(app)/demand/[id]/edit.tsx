import { useLocalSearchParams } from 'expo-router';
import { DemandFormView } from '../../../../src/views/DemandFormView';

export default function EditDemandScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DemandFormView demandId={id} />;
}
