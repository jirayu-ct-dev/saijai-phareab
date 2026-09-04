# ============================================================
# Stage 1: BUILD — ติดตั้ง dependencies ทั้งหมด + build โปรเจกต์
# ============================================================
FROM node:24-slim AS build

# Public printing values affect the generated CSP. They are not secrets and
# must be present while Nuxt builds the production header.
ARG NUXT_PUBLIC_PRINT_GATEWAY_ENABLED=false
ARG NUXT_PUBLIC_PRINT_GATEWAY_URL=
ENV NUXT_PUBLIC_PRINT_GATEWAY_ENABLED=$NUXT_PUBLIC_PRINT_GATEWAY_ENABLED
ENV NUXT_PUBLIC_PRINT_GATEWAY_URL=$NUXT_PUBLIC_PRINT_GATEWAY_URL

# ติดตั้ง OpenSSL (จำเป็นสำหรับ Prisma engines)
RUN apt-get update -y && apt-get install -y openssl libssl3 && rm -rf /var/lib/apt/lists/*

# เปิดใช้ corepack สำหรับจัดการ pnpm (มากับ Node 24 อยู่แล้ว)
RUN corepack enable

WORKDIR /app

# คัดลอกไฟล์ lock ก่อน — Docker จะ cache layer นี้ถ้า deps ไม่เปลี่ยน
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# ติดตั้ง dependencies ทั้งหมด (dev + prod) แบบ frozen-lockfile
# เพื่อให้แน่ใจว่าใช้เวอร์ชันตรงกับ lockfile
RUN pnpm install --frozen-lockfile

# คัดลอก source code ทั้งหมด
COPY . .

# สร้าง Prisma Client และ Build Nuxt → ผลลัพธ์อยู่ใน .output/
# package.json กำหนดให้ build เรียก prisma generate ก่อน nuxt build
# NODE_OPTIONS เพิ่ม heap memory ป้องกัน OOM ใน Docker
RUN NODE_OPTIONS="--max-old-space-size=4096" pnpm run build

# ============================================================
# Stage 2: PRODUCTION — เอาแค่ของที่จำเป็นสำหรับรัน
# ============================================================
FROM node:24-slim

# ติดตั้ง OpenSSL (จำเป็นสำหรับ Prisma engines ตอน runtime)
RUN apt-get update -y && apt-get install -y openssl libssl3 && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app

# คัดลอกเฉพาะไฟล์ที่จำเป็นจาก stage build:
#   .output/          = Nuxt/Nitro server ที่ build แล้ว
#   node_modules/     = runtime dependencies (รวม native modules เช่น sharp, prisma engines)
#   prisma/           = schema + migrations (เผื่อต้องรัน migration ใน container)
#   app/generated/    = generated Prisma Client สำหรับ seed scripts
#   shared/           = mock storefront data ที่ full seed ใช้งาน
#   prisma.config.ts  = Prisma 7 config
#   package.json      = metadata
# --chown ให้ user node เป็นเจ้าของไฟล์ เพื่อรัน container แบบ non-root
COPY --chown=node:node --from=build /app/.output   ./.output
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/prisma     ./prisma
COPY --chown=node:node --from=build /app/app/generated ./app/generated
COPY --chown=node:node --from=build /app/shared     ./shared
COPY --chown=node:node --from=build /app/prisma.config.ts ./
COPY --chown=node:node --from=build /app/package.json ./

# ตั้งค่า environment
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

# รันด้วย non-root user เพื่อลดความเสียหายหาก process ถูก exploit
USER node

# รัน Nitro server จาก build output
CMD ["node", ".output/server/index.mjs"]
