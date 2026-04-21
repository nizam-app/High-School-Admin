import { useQuery } from '@tanstack/react-query';
import { getUsers } from '../api/usersApi';

export const useUsers = (params) => {
  return useQuery({
    queryKey: ['admin-users', params],
    queryFn: () => getUsers(params),
    staleTime: 30 * 1000,
    retry: 1,
  });
};

