import { useQuery } from '@tanstack/react-query';
import { getLiveSessions, getLiveSessionsStats, getSessionAttendance, getSessionById } from '../api/liveSessionsApi';

export const useLiveSessionsStats = () => {
  return useQuery({
    queryKey: ['live-sessions-stats'],
    queryFn: getLiveSessionsStats,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    retry: 1,
  });
};

export const useLiveSessions = ({ tab, page, limit }) => {
  return useQuery({
    queryKey: ['live-sessions', tab, page, limit],
    queryFn: () => getLiveSessions({ tab, page, limit }),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    retry: 1,
    placeholderData: (previousData) => previousData,
  });
};

export const useSessionAttendance = (sessionId) => {
  return useQuery({
    queryKey: ['live-sessions-attendance', sessionId],
    queryFn: () => getSessionAttendance(sessionId),
    enabled: Boolean(sessionId),
    staleTime: 15 * 1000,
    refetchInterval: 15 * 1000,
    retry: 1,
  });
};

export const useSessionDetails = (sessionId) => {
  return useQuery({
    queryKey: ['live-session-details', sessionId],
    queryFn: () => getSessionById(sessionId),
    enabled: Boolean(sessionId),
    staleTime: 60 * 1000,
    retry: 1,
  });
};
