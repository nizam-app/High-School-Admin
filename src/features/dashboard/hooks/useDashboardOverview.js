import { useQuery } from '@tanstack/react-query';
import { getDashboardOverview } from '../api/dashboardApi';

export const useDashboardOverview = () => {
  return useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: getDashboardOverview,
    staleTime: 60 * 1000,
    retry: 1,
  });
};

