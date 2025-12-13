// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

import { IQueue, IQueueMessage } from './queue'

export class MemoryQueue implements IQueue 
{
  constructor(options: any);
  initialize(): Promise<void>;
  queue(message: string): Promise<void>;
  dequeue(): Promise<IQueueMessage | null>;
  dequeueMultiple(): Promise<Array<IQueueMessage>>;
  delete(message: { original: any }): Promise<void>;
}