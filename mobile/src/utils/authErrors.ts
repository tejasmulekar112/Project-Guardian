const ERROR_MESSAGES: Record<string, string> = {
  'auth/user-not-found': 'No account found with this email',
  'auth/wrong-password': 'Incorrect password',
  'auth/invalid-credential': 'Invalid email or password',
  'auth/email-already-in-use': 'An account with this email already exists',
  'auth/weak-password': 'Password must be at least 6 characters',
  'auth/invalid-email': 'Please enter a valid email address',
  'auth/too-many-requests': 'Too many attempts. Please try again later',
  'auth/network-request-failed': 'Network error. Check your connection',
};

const DEFAULT_MESSAGE = 'Something went wrong. Please try again';

export const getAuthErrorMessage = (error: unknown): string => {
  if (
    error != null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  ) {
    return ERROR_MESSAGES[(error as { code: string }).code] ?? DEFAULT_MESSAGE;
  }
  return DEFAULT_MESSAGE;
};
