/**
 * ContentOS — Governance Authority & Control Plane Capability Boundary
 *
 * Implements SPEC01 §90, SPEC02 §18, SPEC07 §75, SPEC10 §68:
 * Non-forgeable server-side capability boundary for Control Plane revision activation.
 *
 * Lives strictly behind a trusted composition-root / control-plane-only boundary.
 * Runtime and application execution modules MUST NOT import or call this module.
 */
import { RegistryValidationError } from '../../domain/services/registry-validator.js';

const GOVERNANCE_INTERNAL_SECRET = Symbol('CONTENTOS_GOVERNANCE_INTERNAL_SECRET');

export class GovernanceActivationAuthority {
  readonly #secret: symbol;
  readonly issuedAt: Date;

  constructor(secret: symbol) {
    if (secret !== GOVERNANCE_INTERNAL_SECRET) {
      throw new RegistryValidationError(
        'FORGED_AUTHORITY_REJECTED',
        'GovernanceActivationAuthority cannot be constructed directly. A string or ad-hoc argument is strictly rejected.',
      );
    }
    this.#secret = secret;
    this.issuedAt = new Date();
  }

  isValid(): boolean {
    return this.#secret === GOVERNANCE_INTERNAL_SECRET;
  }

  static isAuthorized(authority: unknown): authority is GovernanceActivationAuthority {
    return (
      authority instanceof GovernanceActivationAuthority &&
      authority.isValid()
    );
  }
}

/**
 * Trusted production gateway for Control Plane / Governance authority.
 * Kept strictly inside the Control Plane composition root.
 * Runtime application code cannot import or invoke this gateway.
 */
export class GovernanceControlPlaneGateway {
  /**
   * Issues a non-forgeable GovernanceActivationAuthority capability token.
   */
  static issueGovernanceAuthority(): GovernanceActivationAuthority {
    return new GovernanceActivationAuthority(GOVERNANCE_INTERNAL_SECRET);
  }
}
