import { useMutation } from '@tanstack/react-query';
import { saveSession } from '../../../lib/session';
import { login } from '../../../services';

export function useLogin() {
  return useMutation({ mutationFn: login, onSuccess: saveSession });
}
