FROM node:16-alpine

RUN mkdir -p /app

WORKDIR /app

COPY . .

RUN npm install

EXPOSE 3001

CMD [ "npm", "run", "start" ]