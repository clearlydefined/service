// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Definition, UpgradeHandler } from '../../business/definitionService'

/**
 * Upgrade policy for delayed compute queue processing.
 * Always treats the stored definition as valid, effectively skipping staleness checks.
 * Used by the delayed compute path to implement missing-only semantics.
 */
export declare class SkipUpgradePolicy implements UpgradeHandler {
  currentSchema?: string

  validate(definition: Definition | null): Promise<Definition | null>
}
