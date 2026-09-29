import { useQuery } from '@tanstack/react-query';
import api from '../client';
import type { TeamRole } from '@shared/types';

export interface TeamResponse {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMemberResponse {
  id: string;
  userId: string;
  teamId: string;
  role: TeamRole;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: () => api.get<TeamResponse[]>('/teams').then((res) => res.data),
  });
}

export function useTeam(teamId: string | undefined) {
  return useQuery({
    queryKey: ['team', teamId],
    queryFn: () => api.get<TeamResponse>(`/teams/${teamId}`).then((res) => res.data),
    enabled: !!teamId,
  });
}

export function useTeamMembers(teamId: string | undefined) {
  return useQuery({
    queryKey: ['teamMembers', teamId],
    queryFn: () => api.get<TeamMemberResponse[]>(`/teams/${teamId}/members`).then((res) => res.data),
    enabled: !!teamId,
  });
}