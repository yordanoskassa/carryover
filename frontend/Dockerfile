FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# nginx's docker entrypoint runs envsubst on /etc/nginx/templates/*.template,
# so BACKEND_URL is resolved at container start (no trailing slash). Override
# with http://<service>:8001 to keep traffic inside the EasyPanel project.
ENV BACKEND_URL=https://anton-carryover.hrvnvm.easypanel.host
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
