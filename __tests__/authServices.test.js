import { authService } from '../src/services/authServices';

describe('authService', () => {
  it('should fail sign in with invalid credentials', async () => {
    const result = await authService.signIn('bad@email.com', 'wrongpassword');
    expect(result.success).toBe(false);
  });

  it('should fail sign up with invalid data', async () => {
    const result = await authService.signUp('', '', '');
    expect(result.success).toBe(false);
  });
});