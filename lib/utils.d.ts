// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { Request } from 'express'
import { ResultCoordinates } from './resultCoordinates'
import { EntityCoordinates } from './entityCoordinates'
import { ParamsDictionary } from 'express-serve-static-core'
import { DateTime } from 'luxon'

export function toResultCoordinatesFromRequest(request: Request): Promise<ResultCoordinates>
export function toEntityCoordinatesFromRequest(request: Request): Promise<EntityCoordinates>
export function toNormalizedEntityCoordinates(spec: EntityCoordinates | ParamsDictionary): Promise<EntityCoordinates>
export function toEntityCoordinatesFromArgs(args: any): EntityCoordinates
export function reEncodeSlashes(namespace: string): string
export function parseNamespaceNameRevision(request: Request): string
export function getLatestVersion(versions: string[]|string): string|null
export function simplifyAttributions(entries: string[]): string[]|null
export function utcDateTime(dateAndTime: string): DateTime|null
export function extractDate(dateAndTime: string): string|null
export function compareDates(dateA: string|null, dateB: string|null): number
export function setIfValue(target: any, path: string, value: any): boolean
export function setToArray<T>(values: Iterable<T>): T[]|null
export function addArrayToSet<T>(array: T[], set: Set<T>, valueExtractor: (item: T) => T|null): Set<T>
export function extractLicenseFromLicenseUrl(licenseUrl: string): string|null
export function mergeDefinitions(base: any, proposed: any, override: boolean): any
export function buildSourceUrl(spec: EntityCoordinates): string|null
export function deCodeSlashes(namespace: string): string
export function updateSourceLocation(spec: any): void
export function isLicenseFile(filePath: string, coordinates: EntityCoordinates, packages?: any[]): boolean
export function isDeclaredLicense(identifier: string): boolean
export function getLicenseLocations(coordinates: EntityCoordinates, packages: any[]): string[]
export function goLicenseLocation(coordinates: EntityCoordinates): string
export function debsrcLicenseLocations(packages: any[]): string[]
export function joinExpressions(expressions: Iterable<any>): string|null
export function normalizeLicenseExpression(rawLicenseExpression: string, logger: any, licenseRefLookup: (licenseRef: string) => string | null) : string|null
export function parseUrn(urn: string): {schema: string, type: string, provider: string, namespace: string, name: string, revToken: string, revision: string, toolToken: string, tool: string, toolRevision: string}|null
