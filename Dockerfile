# Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
# SPDX-License-Identifier: MIT

# FROM node:8-alpine
FROM node:12
ENV APPDIR=/opt/service
# RUN apk update && apk upgrade && \
#    apk add --no-cache bash git openssh

## get SSH server running
# RUN apt-get update \
#     && apt-get install -y --no-install-recommends openssh-server \
#     && echo "root:Docker!" | chpasswd
# COPY sshd_config /etc/ssh/
# COPY init_container.sh /bin/
# RUN chmod 755 /bin/init_container.sh
# CMD ["/bin/init_container.sh"]
ARG BUILD_NUMBER=0
ENV BUILD_NUMBER=$BUILD_NUMBER

COPY package*.json /tmp/
RUN cd /tmp && npm install --production
RUN mkdir -p "${APPDIR}" && cp -a /tmp/node_modules "${APPDIR}"

WORKDIR "${APPDIR}"
COPY . "${APPDIR}"

ENV PORT 4000
EXPOSE 4000 2222
ENTRYPOINT ["npm", "start"]
