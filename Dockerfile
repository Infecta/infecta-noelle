FROM node:20-alpine3.17
WORKDIR /app
COPY . .
RUN npm i
RUN cp /app/scripts/start.sh /start.sh
RUN chmod +x /start.sh
CMD ["sh", "/start.sh"]