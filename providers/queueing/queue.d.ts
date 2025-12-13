// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

export interface IQueueMessage
{
  original: any;
  data: any;
}

export interface IQueueObject
{
  messageText: string;
  dequeueCount: number;
  messageId: number;
}

export interface IQueue 
{
  initialize(): Promise<void>;
  queue(message: string): Promise<void>;
  dequeue(): Promise<IQueueMessage | null>;
  dequeueMultiple(): Promise<Array<IQueueMessage>>;
  delete(message: { original: any }): Promise<void>;
}
