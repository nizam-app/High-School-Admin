import { useQuery } from '@tanstack/react-query';
import { getUserStats } from '../api/userStatsApi';

export const useUserStats = () => {
  return useQuery({
    queryKey: ['admin-users-stats'],
    queryFn: getUserStats,
    staleTime: 60 * 1000,
    retry: 1,
  });
};

