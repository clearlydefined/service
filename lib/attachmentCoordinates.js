// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

class AttachmentCoordinates {
  constructor(token) {
    this.token = token
  }

  static fromString(path) {
    if (!path) return null
    path = path.startsWith('/') ? path.slice(1) : path
    const [attachmentToken, token] = path.split('/')
    return new AttachmentCoordinates(token)
  }

  static fromUrn(urn) {
    if (!urn) return null
    const [scheme, attachmentToken, token] = urn.split(':')
    return new AttachmentCoordinates(token)
  }

  toString() {
    return ['attachment', this.token].join('/')
  }
}

module.exports = AttachmentCoordinates
