import { useAuth } from '../../src/contexts/AuthContext';
import { isStaff } from '../../src/models/User';
import { DemandListView } from '../../src/views/DemandListView';
import { ManagementDashboardView } from '../../src/views/ManagementDashboardView';

export default function HomeScreen() {
  const { user } = useAuth();
  return isStaff(user?.perfil) ? <ManagementDashboardView /> : <DemandListView />;
}
