# Copyright (c) Microsoft Corporation. All rights reserved.
# SPDX-License-Identifier: MIT
FROM node:8-alpine
ENV APPDIR=/opt/service

COPY package.json /tmp/package.json
RUN cd /tmp && npm install --production
RUN mkdir -p "${APPDIR}" && cp -a /tmp/node_modules "${APPDIR}"

WORKDIR "${APPDIR}"
COPY . "${APPDIR}"

# Enable SSH from Azure Portal
# Protecting this credential isn't necessary as the SSH endpoint is on a 
# private network only available to the portal
ENV SSH_PASSWD "root:Docker!"
RUN apk update \
  && apk add openssh \
  && echo "$SSH_PASSWD" | chpasswd 
COPY init.sh /usr/local/bin/
RUN chmod u+x /usr/local/bin/init.sh

ENV PORT 3000
EXPOSE 3000 2222
ENTRYPOINT ["npm", "start"]
