// (c) Copyright 2026, SAP SE and ClearlyDefined contributors. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import appInsights from 'applicationinsights'
import { expect } from 'chai'

const FAKE_CONNECTION_STRING =
  'InstrumentationKey=00000000-0000-0000-0000-000000000000;IngestionEndpoint=https://fake.invalid/'

describe('applicationinsights default import', () => {
  it('defaultClient is populated after setup().start()', () => {
    appInsights
      .setup(FAKE_CONNECTION_STRING)
      .setAutoCollectPerformance(false, false)
      .setAutoCollectDependencies(true)
      .start()

    expect(appInsights.defaultClient, 'defaultClient should be set after .start()').to.not.be.undefined
  })
})
