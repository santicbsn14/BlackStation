import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { clearSession } from '../../../lib/session';

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return () => {
    clearSession();
    queryClient.clear();
    void navigate('/admin/login', { replace: true });
  };
}
