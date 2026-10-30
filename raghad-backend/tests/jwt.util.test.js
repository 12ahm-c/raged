const {
  decodeToken,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = require('../dist/utils/jwt.util');

describe('jwt utilities', () => {
  const payload = {
    userId: '507f1f77bcf86cd799439011',
    email: 'owner@example.com',
    jti: 'refresh-token-id',
  };

  it('signs and verifies access tokens', () => {
    const token = generateAccessToken(payload);
    const verified = verifyAccessToken(token);

    expect(verified.userId).toBe(payload.userId);
    expect(verified.email).toBe(payload.email);
    expect(verified.type).toBe('access');
    expect(verified.jti).toBe(payload.jti);
  });

  it('signs, verifies, and decodes refresh tokens', () => {
    const token = generateRefreshToken(payload);
    const verified = verifyRefreshToken(token);
    const decoded = decodeToken(token);

    expect(verified.type).toBe('refresh');
    expect(verified.jti).toBe(payload.jti);
    expect(decoded).toMatchObject({
      userId: payload.userId,
      email: payload.email,
      type: 'refresh',
      jti: payload.jti,
    });
  });
});
