FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# nginx's docker entrypoint runs envsubst on /etc/nginx/templates/*.template,
# so BACKEND_URL is resolved at container start (no trailing slash).
ENV BACKEND_URL=http://backend:8001
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
