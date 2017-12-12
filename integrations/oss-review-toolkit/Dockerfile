FROM openjdk:8

# Install the OSS Review Toolkit
ENV APPDIR=/opt/oss-review-toolkit
COPY . "${APPDIR}"
WORKDIR "${APPDIR}"
RUN ./gradlew installDist

# Install dependencies for NPM scanning
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -
RUN apt-get install -y apt-utils
RUN apt-get install -y nodejs
RUN apt-get install -y build-essential

RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
RUN apt-get update
RUN apt-get install -y yarn

# Add the tools to the path
ENV PATH="${APPDIR}/analyzer/build/install/analyzer/bin:${APPDIR}/graph/build/install/graph/bin:${APPDIR}/downloader/build/install/downloader/bin:${APPDIR}/scanner/build/install/scanner/bin:${PATH}"