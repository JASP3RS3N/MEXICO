# ---- Build stage ----
FROM node:20-alpine AS build

WORKDIR /app

# Backend URL the browser will call (host-published backend port).
ARG REACT_APP_BACKEND_URL=http://localhost:8001
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV CI=false

COPY package.json ./
# The visual-edits dev tool is fetched from an Emergent-only host; it is optional
# (craco disables it gracefully when absent), so drop it for a reliable build.
RUN sed -i '/visual-edits/d' package.json \
    && yarn install --network-timeout 600000

COPY . .
RUN yarn build

# ---- Serve stage ----
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
