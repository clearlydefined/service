// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Definition, UpgradeHandler } from '../../business/definitionService'

/** Policy that treats any existing definition as valid. */
export declare class ExistingDefinitionPolicy implements UpgradeHandler {
  currentSchema?: string

  validate(definition: Definition | null): Promise<Definition | undefined>
}

export declare function factory(): ExistingDefinitionPolicy
