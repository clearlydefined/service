// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { CdSourceSummarizer } from './cdsource.ts'
import cdsource from './cdsource.ts'
import type { ClearlyDescribedSummarizer } from './clearlydefined.ts'
import clearlydefined from './clearlydefined.ts'
import type { FOSSologySummarizer } from './fossology.ts'
import fossology from './fossology.ts'
import type { LicenseeSummarizer } from './licensee.ts'
import licensee from './licensee.ts'
import type { ReuseSummarizer } from './reuse.ts'
import reuse from './reuse.ts'
import type { ScanCodeSummarizer } from './scancode.ts'
import scancode from './scancode.ts'

/** Base interface for all summarizers */
export interface BaseSummarizer {
  summarize(coordinates: unknown, data: unknown): unknown
}

/** Factory function that creates a summarizer instance */
export type SummarizerFactory<T extends BaseSummarizer = BaseSummarizer> = (options?: SummarizerOptions) => T

/** Options passed to summarizer constructors */
export interface SummarizerOptions {
  [key: string]: unknown
}

/** Summary provider configuration */
export interface SummaryProviders {
  reuse: SummarizerFactory<ReuseSummarizer>
  licensee: SummarizerFactory<LicenseeSummarizer>
  scancode: SummarizerFactory<ScanCodeSummarizer>
  fossology: SummarizerFactory<FOSSologySummarizer>
  clearlydefined: SummarizerFactory<ClearlyDescribedSummarizer>
  cdsource: SummarizerFactory<CdSourceSummarizer>
  [key: string]: SummarizerFactory | undefined
}

const summaryProviders: SummaryProviders = {
  reuse,
  licensee,
  scancode,
  fossology,
  clearlydefined,
  cdsource
}

export default summaryProviders
