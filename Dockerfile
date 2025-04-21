# syntax=docker/dockerfile:1

FROM node:22-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --omit=dev

ADD . /app

COPY . .

EXPOSE 80

CMD [ "npm", "run run" ]