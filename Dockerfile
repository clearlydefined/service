FROM node:8-alpine
ENV APPDIR=/opt/service

COPY package.json /tmp/package.json
RUN cd /tmp && npm install --production
RUN mkdir -p "${APPDIR}" && cp -a /tmp/node_modules "${APPDIR}"

WORKDIR "${APPDIR}"
COPY . "${APPDIR}"

ENV PORT 3000
EXPOSE 3000
ENTRYPOINT ["npm", "start"]