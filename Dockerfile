# Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
# SPDX-License-Identifier: MIT

FROM docker.io/library/node:18
ENV APPDIR=/opt/service

## get SSH server running
# RUN apt-get update \
#     && apt-get install -y --no-install-recommends openssh-server \
#     && echo "root:Docker!" | chpasswd
# COPY sshd_config /etc/ssh/
# COPY init_container.sh /bin/
# RUN chmod 755 /bin/init_container.sh
# CMD ["/bin/init_container.sh"]

# Set environment variables from build arguments
ARG APP_VERSION="UNKNOWN"
ENV APP_VERSION=$APP_VERSION
ARG BUILD_SHA="UNKNOWN"
ENV BUILD_SHA=$BUILD_SHA

COPY .npmrc package*.json /tmp/
RUN cd /tmp && npm install --production
RUN mkdir -p "${APPDIR}" && cp -a /tmp/node_modules "${APPDIR}"

WORKDIR "${APPDIR}"
COPY . "${APPDIR}"

ENV PORT 4000
EXPOSE 4000 2222
ENTRYPOINT ["npm", "start"]
