import { getAuthErrorMessage } from '../authErrors';

describe('getAuthErrorMessage', () => {
  it('returns friendly message for auth/user-not-found', () => {
    const error = { code: 'auth/user-not-found' };
    expect(getAuthErrorMessage(error)).toBe('No account found with this email');
  });

  it('returns friendly message for auth/wrong-password', () => {
    const error = { code: 'auth/wrong-password' };
    expect(getAuthErrorMessage(error)).toBe('Incorrect password');
  });

  it('returns friendly message for auth/invalid-credential', () => {
    const error = { code: 'auth/invalid-credential' };
    expect(getAuthErrorMessage(error)).toBe('Invalid email or password');
  });

  it('returns friendly message for auth/email-already-in-use', () => {
    const error = { code: 'auth/email-already-in-use' };
    expect(getAuthErrorMessage(error)).toBe('An account with this email already exists');
  });

  it('returns friendly message for auth/weak-password', () => {
    const error = { code: 'auth/weak-password' };
    expect(getAuthErrorMessage(error)).toBe('Password must be at least 6 characters');
  });

  it('returns friendly message for auth/invalid-email', () => {
    const error = { code: 'auth/invalid-email' };
    expect(getAuthErrorMessage(error)).toBe('Please enter a valid email address');
  });

  it('returns friendly message for auth/too-many-requests', () => {
    const error = { code: 'auth/too-many-requests' };
    expect(getAuthErrorMessage(error)).toBe('Too many attempts. Please try again later');
  });

  it('returns friendly message for auth/network-request-failed', () => {
    const error = { code: 'auth/network-request-failed' };
    expect(getAuthErrorMessage(error)).toBe('Network error. Check your connection');
  });

  it('returns default message for unknown error code', () => {
    const error = { code: 'auth/unknown-code' };
    expect(getAuthErrorMessage(error)).toBe('Something went wrong. Please try again');
  });

  it('returns default message for non-Firebase error', () => {
    expect(getAuthErrorMessage(new Error('random'))).toBe('Something went wrong. Please try again');
  });

  it('returns default message for null/undefined', () => {
    expect(getAuthErrorMessage(null)).toBe('Something went wrong. Please try again');
    expect(getAuthErrorMessage(undefined)).toBe('Something went wrong. Please try again');
  });
});
