// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import type { Summarizer } from './clearlydefined'
import type { ScanCodeSummarizer } from './scancode'
import type { LicenseeSummarizer } from './licensee'
import type { ReuseSummarizer } from './reuse'
import type { FOSSologySummarizer } from './fossology'
import type { CdSourceSummarizer } from './cdsource'

/** Factory function that creates a summarizer instance */
export type SummarizerFactory<T> = (options?: SummarizerOptions) => T

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
  clearlydefined: SummarizerFactory<Summarizer>
  cdsource: SummarizerFactory<CdSourceSummarizer>
}

declare const summaryProviders: SummaryProviders

export = summaryProviders
