// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const assert = require('assert')
const MemoryQueue = require('../../../providers/queueing/memoryQueue')

describe('memory queue operations', () => {
  let memQueue

  beforeEach(() => {
    memQueue = MemoryQueue()
  })

  it('queues messages', async () => {
    await memQueue.queue(JSON.stringify({ somekey: 1 }))
    await memQueue.queue(JSON.stringify({ somekey: 2 }))
    assert.equal(memQueue.data.length, 2)
  })

  it('dequeues messages', async () => {
    await memQueue.queue(JSON.stringify({ somekey: 1 }))
    await memQueue.queue(JSON.stringify({ somekey: 2 }))

    let message1 = await memQueue.dequeue()
    assert.equal(message1.data.somekey, 1)

    await memQueue.delete(message1)

    let message2 = await memQueue.dequeue()
    assert.equal(message2.data.somekey, 2)

    await memQueue.delete(message2)

    let message3 = await memQueue.dequeue()
    assert.equal(message3, null)
  })

  it('dequeue count increases to 5', async () => {
    await memQueue.queue(JSON.stringify({ somekey: 1 }))

    let message = await memQueue.dequeue()
    assert.equal(message.original.dequeueCount, 1)

    message = await memQueue.dequeue()
    assert.equal(message.original.dequeueCount, 2)

    message = await memQueue.dequeue()
    assert.equal(message.original.dequeueCount, 3)

    message = await memQueue.dequeue()
    assert.equal(message.original.dequeueCount, 4)

    message = await memQueue.dequeue()
    assert.equal(message.original.dequeueCount, 5)

    message = await memQueue.dequeue()
    assert.equal(message, null)
  })

  it('handles dequeueing multiple messages', async () => {
    await memQueue.queue(JSON.stringify({ somekey: 1 }))
    await memQueue.queue(JSON.stringify({ somekey: 2 }))

    let messages = await memQueue.dequeueMultiple()
    assert.equal(messages.length, 1)
    assert.equal(messages[0].data.somekey, 1)
    await memQueue.delete(messages[0])

    messages = await memQueue.dequeueMultiple()
    assert.equal(messages.length, 1)
    assert.equal(messages[0].data.somekey, 2)
  })

  it('handles dequeueing multiple messages of an empty queue', async () => {
    let messages = await memQueue.dequeueMultiple()
    assert.equal(messages.length, 0)
  })
})
