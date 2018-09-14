// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

class AttachmentCoordinates {
  constructor(id) {
    this.id = id
  }

  static fromString(path) {
    if (!path) return null
    path = path.startsWith('/') ? path.slice(1) : path
    const [, id] = path.split('/')
    return new AttachmentCoordinates(id)
  }

  static fromUrn(urn) {
    if (!urn) return null
    const [, , id] = urn.split(':')
    return new AttachmentCoordinates(id)
  }

  toString() {
    return `attachment/${this.id}`
  }
}

module.exports = AttachmentCoordinates
