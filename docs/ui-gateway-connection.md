# คู่มือเชื่อมต่อ Office UI กับ OpenClaw Gateway

เอกสารนี้อธิบายการตั้งค่าให้หน้า **OpenClaw Office** (`src/`) เรียกใช้งาน gateway จริงผ่าน HTTP ที่ nginx proxy ไว้ รวมถึงการตรวจสอบว่าทำงานหรือไม่

## ภาพรวมเส้นทางในเบราว์เซอร์

เมื่อเปิด UI ที่พอร์ตของ nginx (เช่น `http://localhost:3000`) เบราว์เซอร์จะเรียก:

| Path | ไปที่ upstream | ใช้ทำอะไร |
|------|------------------|-----------|
| `/gateway/*` | OpenClaw gateway พอร์ต **18789** | `GET /health`, `POST /v1/responses` (ส่งคำสั่งไป AI), และ endpoint HTTP อื่นของ gateway |
| `/ws` | เดียวกับ 18789 | WebSocket ตามโปรโตคอล OpenClaw (ฝั่ง UI ยังไม่บังคับใช้สำหรับคำสั่งหลัก) |
| `/api/*` | Bridge พอร์ต **18790** | REST ของ bridge (ถ้ามีการใช้งานในอนาคต) |

ไฟล์อ้างอิง:

- [docker/nginx.conf](../docker/nginx.conf) — Docker Compose บนเครื่อง
- [docker/nginx.railway.conf.template](../docker/nginx.railway.conf.template) — Railway UI service
- [src/openclaw-api.js](../src/openclaw-api.js) — เรียก `fetch` ไปที่ `/gateway/...`

## สิ่งที่ต้องเปิดฝั่ง OpenClaw Gateway

### 1) HTTP OpenResponses (`POST /v1/responses`)

แผงคำสั่งใน UI (ปุ่ม **[ EXECUTE ]** และปุ่มลัด) ส่งข้อความไปที่:

`POST /gateway/v1/responses`

ดังนั้นต้องเปิดใช้งาน endpoint นี้ใน config ของ gateway ตามเอกสาร OpenClaw (OpenResponses / `gateway.http.endpoints.responses`) — ถ้ายังไม่เปิด จะได้ HTTP **404** และ UI จะแสดง log ว่าให้เปิด `/v1/responses` แล้วตกไปโหมดจำลองในเบราว์เซอร์

### 2) การยืนยันตัวตน (auth)

ถ้า gateway ตั้ง `gateway.auth.mode` เป็น **token** (หรือโหมดที่ต้องใช้ Bearer):

- **ต้องใส่ token ให้ตรงกัน** ระหว่าง client ที่เรียก `/gateway/` กับค่าที่ gateway คาดหวัง

### 3) Agent id ให้ตรงกัน

UI ส่ง header `x-openclaw-agent-id` เป็นค่า **`agents[].id` จาก team config** (เช่น `gm`, `w1`)

ฝั่ง gateway ต้องมี agent ที่ id ตรงกัน (สร้างด้วย CLI เช่น `agents add` / config ของ OpenClaw) — ถ้าไม่ตรง การรันอาจไปที่ default agent หรือ error ตามพฤติกรรมของ gateway

---

## กรณีที่ 1: Docker Compose บนเครื่อง (local)

### ขั้นตอน

1. รัน stack ตาม [README.md](../README.md) (`docker compose up -d`)
2. ตั้งค่า gateway ให้มี auth + เปิด `/v1/responses` ตามที่ต้องการ
3. ใส่ **token เดียวกับ gateway** ให้เบราว์เซอร์ส่งไปกับ request ไป `/gateway/`:

**วิธี A — meta ใน HTML (เหมาะกับ dev)**

แก้ใน [src/index.html](../src/index.html):

```html
<meta name="openclaw-gateway-token" content="YOUR_SAME_TOKEN_AS_GATEWAY" />
```

จากนั้น reload หน้า UI

**วิธี B — ตัวแปร global (เช่น inject ชั่วคราวจาก console)**

```js
window.__OPENCLAW_GATEWAY_TOKEN__ = 'YOUR_SAME_TOKEN_AS_GATEWAY';
```

**หมายเหตุ:** nginx ใน `docker/nginx.conf` ส่งต่อ header `Authorization` จากเบราว์เซอร์ (`$http_authorization`) ไปยัง gateway — token จาก meta ถูกอ่านใน JS แล้วใส่เป็น `Authorization: Bearer ...` ใน `fetch` (ดู `readGatewayToken()` ใน `openclaw-api.js`)

### ตรวจว่าเชื่อมได้

1. ดูป้าย **GATEWAY: OK** บนแถบบน — มาจาก `GET /gateway/health`
2. เลือก agent ซ้าย แล้วพิมพ์คำสั่งกด **[ EXECUTE ]** หรือกดปุ่มลัด
3. ดูกล่อง **Gateway reply** ใต้ปุ่ม execute — ควรมีข้อความตอบจาก gateway ถ้า `/v1/responses` เปิดและ auth ผ่าน

---

## กรณีที่ 2: Railway (UI + gateway แยก service)

สรุปสั้น ๆ อยู่แล้วใน [docs/deployment/railway.md](deployment/railway.md)

จุดสำคัญเพิ่มเติมสำหรับ **HTTP `/gateway/`**:

1. ตัวแปร `OPENCLAW_GATEWAY_TOKEN` ใน service **openclaw-ui** ต้อง**เหมือน**ค่าที่ gateway ใช้ (`gateway.auth.token` หรือเทียบเท่า)
2. nginx template ใส่ `Authorization: Bearer ${OPENCLAW_GATEWAY_TOKEN}` ให้ทั้ง `/ws`, `/api/`, และ **`/gateway/`** อัตโนมัติ — เบราว์เซอร์ไม่จำเป็นต้องใส่ meta token (และไม่ควร commit token ลง HTML)
3. เปิด `/v1/responses` บน gateway เช่นเดียวกับ local

ถ้าได้ **401/403** ให้ตรวจ token สองฝั่งให้ตรงกันและว่า gateway bind / network ถึงกันหรือไม่

---

## การใช้งานบนหน้า UI

- **เลือก agent** ในแผงซ้าย — คำสั่งจะส่งไปที่ agent id นั้น
- **ปุ่มลัด** — รันคำสั่งทันที (ไม่ต้องกด EXECUTE ซ้ำ)
- ระหว่างรอ gateway ปุ่มและช่องพิมพ์จะถูกปิดชั่วคราวเพื่อกันกดซ้ำ
- **Gateway reply** — แสดงข้อความล่าสุดจาก gateway (หรือข้อความ error สั้น ๆ)

ช่องทางอย่าง **Telegram** ใน modal เป็นเพียงป้ายใน config — การผูกบอทจริงทำผ่าน **OpenClaw CLI** (`agents bind ...`) ตาม README / railway doc ไม่ได้ทำจากหน้าเว็บนี้

---

## แก้ปัญหา (troubleshooting)

| อาการ | สาเหตุที่พบบ่อย | แนวทาง |
|--------|------------------|--------|
| GATEWAY: OFFLINE | UI ถึง nginx ไม่ได้ หรือ nginx ถึง container gateway ไม่ได้ | `docker compose ps`, ดู log nginx/gateway |
| GATEWAY: 401 / 403 | token ไม่ตรงหรือไม่ได้ส่ง | local: ใส่ meta / `__OPENCLAW_GATEWAY_TOKEN__`; Railway: ตรวจ env UI |
| Log ว่าไม่เปิด `/v1/responses` + ได้ 404 | ยังไม่ enable endpoint ใน gateway | เปิดตามเอกสาร OpenClaw สำหรับ OpenResponses |
| ตอบกลับว่าง | รูปแบบ JSON ของ response ไม่ตรงที่ parser คาด | ดู raw ใน devtools Network; ปรับ `extractResponsesOutputText` ใน `openclaw-api.js` ถ้าจำเป็น |
| โหมดจำลองเสมอ | ไม่มี `OpenClawAPI` หรือไม่โหลดสคริปต์ | ตรวจลำดับ `<script>` ใน `index.html` |

---

## ความปลอดภัย

- Token ที่ใช้กับ `/gateway/` เป็น **credential ระดับ operator** ตามแบบของ OpenClaw — ห้ามเปิด UI สาธารณะโดยไม่มีชั้น auth ด้านหน้า (ดูคำเตือนใน [railway.md](deployment/railway.md))
- อย่า commit token จริงลง git

---

## ลิงก์อ้างอิงภายนอก

- OpenClaw Gateway protocol / HTTP surfaces: [docs.openclaw.ai](https://docs.openclaw.ai/) (ค้นหา gateway, OpenResponses, tools invoke)
