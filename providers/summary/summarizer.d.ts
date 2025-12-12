// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { EntityCoordinatesSpec } from "../../lib/entityCoordinates";

export interface ISummarizer
{
  summarize(coordinates: EntityCoordinatesSpec, harvested: any): any;
}