import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../client';
import type { LoginRequest, LoginResponse, UserResponse } from '@shared/types';

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LoginRequest) => api.post<LoginResponse>('/auth/login', data),
    onSuccess: (response) => {
      localStorage.setItem('token', response.data.token);
      queryClient.setQueryData(['user'], response.data.user);
    },
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['user'],
    queryFn: () => api.get<UserResponse>('/auth/me').then((res) => res.data),
    enabled: !!localStorage.getItem('token'),
    retry: false,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => Promise.resolve(),
    onSuccess: () => {
      localStorage.removeItem('token');
      queryClient.clear();
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; name: string; password: string }) =>
      api.post<LoginResponse>('/auth/register', data),
    onSuccess: (response) => {
      localStorage.setItem('token', response.data.token);
      queryClient.setQueryData(['user'], response.data.user);
    },
  });
}