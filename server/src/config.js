'use strict';

/**
 * Runtime configuration.
 *
 * Values are environment-driven so the same code artefact runs unchanged across
 * IQ environments (dev / test / production) — only configuration differs. This is
 * a GAMP 5 principle: qualify the installed configuration, not a rebuilt binary.
 *
 * The signature pepper and JWT secret MUST be supplied via environment in a real
 * deployment. The defaults below exist only so the automated OQ suite and local
 * dev can run deterministically; the IQ documents that they must be overridden.
 */
const DEFAULT_JWT_SECRET = 'dev-only-jwt-secret-change-me';
const DEFAULT_SIGNATURE_PEPPER = 'dev-only-signature-pepper-change-me';

const config = {
  // JWT signing secret for session tokens.
  jwtSecret: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,

  // Server-side pepper mixed into every electronic-signature content hash.
  // Kept server-side so a signature cannot be forged from record content alone.
  signaturePepper: process.env.SIGNATURE_PEPPER || DEFAULT_SIGNATURE_PEPPER,

  // Default policy seeded into the Config singleton on first run. The live values
  // are read from the Config collection at runtime so an Administrator can tune
  // them without a code change (Part 11 controls should be configurable).
  defaultPolicy: {
    passwordPolicy: {
      minLength: 12,
      // Number of distinct character classes required (lower/upper/digit/symbol).
      requiredClasses: 3,
      // How many previous passwords may not be reused.
      historyDepth: 5,
    },
    lockout: {
      // Failed login attempts before the account is locked.
      threshold: 5,
      // Rolling window (minutes) over which failures are counted.
      windowMinutes: 15,
      // How long the account stays locked once the threshold is hit.
      lockMinutes: 30,
    },
    session: {
      // Idle/session lifetime for a JWT.
      idleTimeoutMinutes: 15,
      // How long before expiry the client shows a "session expiring" warning.
      warnBeforeMinutes: 2,
    },
  },

  port: Number(process.env.PORT) || 4000,
};

/**
 * Fail closed: refuse to boot a production deployment that is still using the
 * well-known development secrets. Called from the production entrypoint (index.js).
 * The OQ harness runs with NODE_ENV=test and is unaffected.
 * @param {{nodeEnv?: string}} [opts]
 */
function assertSecretsConfigured({ nodeEnv = process.env.NODE_ENV } = {}) {
  if (nodeEnv !== 'production') return;
  const problems = [];
  if (config.jwtSecret === DEFAULT_JWT_SECRET) problems.push('JWT_SECRET');
  if (config.signaturePepper === DEFAULT_SIGNATURE_PEPPER) problems.push('SIGNATURE_PEPPER');
  if (problems.length) {
    throw new Error(`Refusing to start in production with default secret(s): ${problems.join(', ')}. Set them via environment.`);
  }
}

config.assertSecretsConfigured = assertSecretsConfigured;

module.exports = config;
