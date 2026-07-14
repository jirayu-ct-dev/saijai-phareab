# ============================================================
# Stage 1: BUILD — ติดตั้ง dependencies ทั้งหมด + build โปรเจกต์
# ============================================================
FROM node:22-slim AS build

# ติดตั้ง OpenSSL (จำเป็นสำหรับ Prisma engines)
RUN apt-get update -y && apt-get install -y openssl libssl3 && rm -rf /var/lib/apt/lists/*

# เปิดใช้ corepack สำหรับจัดการ pnpm (มากับ Node 22 อยู่แล้ว)
RUN corepack enable

WORKDIR /app

# คัดลอกไฟล์ lock ก่อน — Docker จะ cache layer นี้ถ้า deps ไม่เปลี่ยน
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# ติดตั้ง dependencies ทั้งหมด (dev + prod) แบบ frozen-lockfile
# เพื่อให้แน่ใจว่าใช้เวอร์ชันตรงกับ lockfile
RUN pnpm install --frozen-lockfile

# คัดลอก source code ทั้งหมด
COPY . .

# สร้าง Prisma Client (ต้องมี schema.prisma ก่อน)
RUN npx prisma generate

# Build Nuxt → ผลลัพธ์อยู่ใน .output/
# NODE_OPTIONS เพิ่ม heap memory ป้องกัน OOM ใน Docker
RUN NODE_OPTIONS="--max-old-space-size=4096" pnpm run build

# ============================================================
# Stage 2: PRODUCTION — เอาแค่ของที่จำเป็นสำหรับรัน
# ============================================================
FROM node:22-slim

# ติดตั้ง OpenSSL (จำเป็นสำหรับ Prisma engines ตอน runtime)
RUN apt-get update -y && apt-get install -y openssl libssl3 && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app

# คัดลอกเฉพาะไฟล์ที่จำเป็นจาก stage build:
#   .output/          = Nuxt/Nitro server ที่ build แล้ว
#   node_modules/     = runtime dependencies (รวม native modules เช่น sharp, prisma engines)
#   prisma/           = schema + migrations (เผื่อต้องรัน migration ใน container)
#   prisma.config.ts  = Prisma 7 config
#   package.json      = metadata
COPY --from=build /app/.output   ./.output
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma     ./prisma
COPY --from=build /app/prisma.config.ts ./
COPY --from=build /app/package.json ./

# ตั้งค่า environment
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

# รัน Nitro server จาก build output
CMD ["node", ".output/server/index.mjs"]
