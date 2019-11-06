FROM node:12-alpine

WORKDIR /app
COPY package*.json /app/
RUN npm i --production
COPY openapi.yaml /app
COPY src /app/src

USER node
CMD node src
