import { useMutation } from '@tanstack/react-query';
import { saveSession } from '../../../../lib/session';
import { login } from '../../../../services';

/** Login: guarda `bs-token` con `expiresAt`. */
export function useLogin() {
  return useMutation({ mutationFn: login, onSuccess: saveSession });
}
