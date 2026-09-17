# Exam deployment

เอกสารนี้ใช้สำหรับ merge และ deploy ระบบ Exam แยกจากระบบหลักของ Saijai Phareab

## ข้อมูลของ Exam

- Branch: `exam-v1`
- Vercel project: `saijai-phareab-exam`
- Vercel project ID: `prj_IuVjREcsDSSGMm3Doo7vatxTSbFl`
- Vercel team/org ID: `team_AJsvdSgasMlJDGQFDCEzkSBo`
- Production domain: <https://exam.saijaiphareab.shop>
- Exam LIFF ID: `2011430155-SqmA5vMF`
- Main LIFF ID: `2008353043-Z6ED4BLd`

ห้ามใช้ Main LIFF ID, token, database หรือค่า environment ของระบบหลักกับ Exam

## ก่อน merge

ตรวจสอบสถานะ repository ก่อนเสมอ และเก็บงานที่ยังไม่ commit ให้เรียบร้อย:

```bash
git status --short --branch
git fetch origin main exam-v1
git switch exam-v1
```

## Merge `main` เข้า Exam

```bash
git merge main --no-edit
```

ถ้ามี conflict ในไฟล์ Rich Menu หรือ test ให้ตรวจสอบทุก action ที่เป็น LIFF URL ว่ายังใช้ Exam LIFF ID:

```bash
rg -n "liff\.line\.me|2008353043-Z6ED4BLd|2011430155-SqmA5vMF" richmenu tests
```

ก่อน commit ต้องยืนยันว่า:

- ไฟล์ `richmenu/json/*.json` ของ Exam ใช้ `2011430155-SqmA5vMF`
- ไม่มี Main LIFF ID อยู่ใน Rich Menu ของ Exam
- ไม่มี merge marker เช่น `<<<<<<<`, `=======`, `>>>>>>>`
- ไม่ได้ใส่ token หรือ secret ลงใน Git

จากนั้นตรวจสอบและ push branch:

```bash
pnpm test
pnpm exec nuxi typecheck
pnpm run build
git add <ไฟล์ที่เกี่ยวข้อง>
git commit -m "Merge main into exam"
git push origin exam-v1
```

## Environment ของ Vercel Exam

ค่า environment ต้องตั้งใน Vercel project `saijai-phareab-exam` โดยเลือก Environment ให้ถูกต้อง โดยเฉพาะ `Production`:

- Database URL ของ Exam
- Better Auth URL และ secret ของ Exam
- Exam LIFF ID และ LINE channel credentials ของ Exam
- Cloudinary credentials ของ Exam
- Resend และ integration credentials ที่ Exam ใช้งาน
- `CRON_SECRET` ของ Exam ถ้ามีการเรียก cron จากภายนอก

ห้ามคัดลอกค่า database, LINE token, LIFF ID, Cloudinary หรือ secret จาก Main มาปะปนกับ Exam

ตรวจสอบหรือดึง environment สำหรับใช้ build แบบ local ได้โดยไม่ commit ไฟล์ที่สร้างขึ้น:

```bash
pnpm dlx vercel pull \
  --yes \
  --environment=production \
  --project prj_IuVjREcsDSSGMm3Doo7vatxTSbFl \
  --scope team_AJsvdSgasMlJDGQFDCEzkSBo
```

อย่าแสดงค่าไฟล์ `.env*` ใน log และอย่า commit ไฟล์ environment กลับเข้า repository

## Deploy production ไปยัง Exam

รันจาก root ของ repository ขณะที่อยู่ branch `exam-v1`:

```bash
pnpm dlx vercel deploy \
  --prod \
  --yes \
  --force \
  --project prj_IuVjREcsDSSGMm3Doo7vatxTSbFl \
  --scope team_AJsvdSgasMlJDGQFDCEzkSBo
```

คำสั่งนี้ deploy ไปยัง Vercel project ของ Exam โดยตรงและบังคับสร้าง deployment ใหม่เพื่อไม่ใช้ build cache เดิม

ถ้าต้องการ preview ก่อน production ให้ใช้โดยไม่ใส่ `--prod`:

```bash
pnpm dlx vercel deploy \
  --yes \
  --project prj_IuVjREcsDSSGMm3Doo7vatxTSbFl \
  --scope team_AJsvdSgasMlJDGQFDCEzkSBo
```

## ตรวจสอบหลัง deploy

ตรวจสอบสถานะ deployment จาก URL ที่ Vercel CLI แสดง และทดสอบ production domain:

```bash
curl -I https://exam.saijaiphareab.shop
```

เช็กลิสต์หลัง deploy:

- Vercel deployment เป็น `READY` และ target เป็น `production`
- `https://exam.saijaiphareab.shop` ตอบกลับ HTTP 200
- Login ด้วย Exam LIFF ได้ และ callback ไม่พาไป Main
- Rich Menu ของ Exam ใช้ Exam LIFF ID
- ทดสอบ role อย่างน้อย `ADMIN`, `EMPLOYEE`, `USER` และสิทธิ์สมาชิกตาม entitlement
- ทดสอบ upload รูปผ่าน Cloudinary ของ Exam
- ทดสอบ LINE notification และปุ่มใน Flex Message ว่าเปิด URL ของ Exam
- ตรวจสอบว่า database และข้อมูลที่เห็นเป็นของ Exam ไม่ใช่ Main

## ตรวจสอบ deployment และ logs

```bash
pnpm dlx vercel ls \
  --project prj_IuVjREcsDSSGMm3Doo7vatxTSbFl \
  --scope team_AJsvdSgasMlJDGQFDCEzkSBo

pnpm dlx vercel inspect <deployment-url-or-id>
pnpm dlx vercel logs <deployment-url-or-id>
```

อย่าส่ง deployment logs ที่มี token, cookie, personal data หรือ secret ต่อสาธารณะ

## Rollback

หาก deployment ล่าสุดมีปัญหา ให้ตรวจสอบ deployment ที่ต้องการก่อน แล้ว rollback เฉพาะ Vercel project Exam:

```bash
pnpm dlx vercel rollback <deployment-url-or-id> \
  --project prj_IuVjREcsDSSGMm3Doo7vatxTSbFl \
  --scope team_AJsvdSgasMlJDGQFDCEzkSBo
```

ห้าม rollback หรือ deploy project Main จากขั้นตอนในเอกสารนี้

## สถานะ deployment ล่าสุดที่ยืนยันแล้ว

- Merge commit: `e868491`
- Deployment: `dpl_4HJReWpeFRdJBtqUiSfSXpdJ78wp`
- Production URL: <https://exam.saijaiphareab-hkn6c2260-almxndbls-projects.vercel.app>
- Alias: <https://exam.saijaiphareab.shop>
- ผลตรวจสอบ: HTTP 200, tests ผ่าน, typecheck ผ่าน และ production build ผ่าน
