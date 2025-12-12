// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { EntityCoordinates } from './entityCoordinates'

export declare class Curation {
  errors: any[]
  isValid: boolean
  path: string
  data: any
  shouldValidate: boolean
  constructor(content: string, path?: string, validate?: boolean)
  static apply(definition: any, curation: any): any
  static getAllCoordinates(curations: any[]): any[]
  load(content: string): string|object|undefined|void
  validate(): void
  getCoordinates(): EntityCoordinates[]
}