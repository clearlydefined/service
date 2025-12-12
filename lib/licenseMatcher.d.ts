// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

export interface DefType {
  definition: any,
  harvest: any
}

export interface MatchType {
  policy: string,
  file?: string,
  propPath: string,
  value: any,
}

export interface MismatchType {
  policy: string,
  file?: string,
  propPath: string,
  source: any,
  target: any
}

export interface MatchResults {
  match: MatchType[],
  mismatch: MismatchType[]
}

export interface IMatchPolicy {
  compare(source: DefType, target: DefType): MatchResults
}

export type ProcessResult = {isMatching: true, match: MatchType[]}|{isMatching: false, mismatch: MismatchType[] }

export declare class LicenseMatcher {
  _policies: IMatchPolicy[]
  constructor(policies: IMatchPolicy[])
  process(source: DefType, target: DefType): ProcessResult
}

export declare class DefinitionLicenseMatchPolicy implements IMatchPolicy
{
  constructor()
}

export declare class HarvestLicenseMatchPolicy implements IMatchPolicy
{
}

export declare class BaseHarvestLicenseMatchStrategy implements IMatchPolicy
{
  name: 'harvest'
  type: string
  propPaths: string[]
  constructor(type: string, propPaths: string[])
}

export declare class NugetHarvestLicenseMatchStrategy extends BaseHarvestLicenseMatchStrategy
{
  constructor()
}
