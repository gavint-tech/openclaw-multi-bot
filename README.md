# OpenClaw Office UI 🦞

Pixel-art office dashboard สำหรับจัดการ OpenClaw agents หลายตัวใน Docker เดียวกัน

```
┌──────────────────────────────────────────────┐
│  TEAM STATUS  │  OFFICE FLOOR PLAN  │ DETAIL │
│  ─ Personal   │  [Conf]  [Server]   │ Stats  │
│  ─ Work       │  [Work]  [Deploy]   │ Cmds   │
│  ─ Ops        │  ── Activity Log ── │ Log    │
│  + Add agent  │                     │        │
└──────────────────────────────────────────────┘
```

## โครงสร้างไฟล์

```
openclaw-office/
├── docker-compose.yml      ← รัน openclaw gateway + UI ด้วย command เดียว
├── .env.example            ← ตัวอย่าง environment variables
├── docker/
│   └── nginx.conf          ← serve UI + proxy WebSocket/REST ไปที่ gateway
└── src/
    ├── team-config.json    ← source of truth ของ team / agents / schedules
    ├── team-config.js      ← loader + validation ของ TeamConfig
    ├── index.html          ← หน้า UI หลัก
    ├── style.css           ← pixel-art dark theme
    ├── agents.js           ← seed log + sprite helpers ระหว่าง migration
    ├── runtime-store.js    ← canonical task/run state ของ UI
    ├── pixel.js            ← วาด pixel art ด้วย Canvas API
    ├── app.js              ← logic หลัก (clock, select, modal, log, runtime sync)
    └── openclaw-api.js     ← connector ไปที่ OpenClaw Gateway WebSocket
```

## วิธีติดตั้ง

### 1. Clone / copy โปรเจค

```bash
git clone <this-repo> openclaw-office
cd openclaw-office
```

### 2. ตั้งค่า environment

```bash
cp .env.example .env
# แก้ GEMINI_API_KEY / DEEPSEEK_API_KEY และ path ต่างๆ
nano .env
```

### 3. สร้าง workspace directories

```bash
mkdir -p ~/.openclaw ~/openclaw/workspace
```

### 4. รัน OpenClaw onboarding (ครั้งแรก)

```bash
docker compose run --rm openclaw-cli onboard
```

### 5. รัน stack ทั้งหมด

```bash
docker compose up -d
```

เปิด browser → **http://localhost:3000**

---

## เพิ่ม Agents ผ่าน CLI

```bash
# เพิ่ม Work agent
docker compose run --rm openclaw-cli agents add work \
  --workspace ~/.openclaw/workspace-work

# Bind กับ Telegram
docker compose run --rm openclaw-cli agents bind \
  --agent work --bind telegram:<TOKEN>

# ดู agents ทั้งหมด
docker compose run --rm openclaw-cli agents list
```

## เพิ่ม Agents ผ่าน UI

กด **[ + ADD AGENT ]** ในแผงซ้ายล่าง → กรอกชื่อ, role, workspace path, channel → **DEPLOY AGENT**

UI จะ generate agent ขึ้นมาพร้อม pixel sprite ทันที

## Config-driven Team

โครงสร้าง team และ agents หลักย้ายไปอยู่ที่ `src/team-config.json` แล้ว

- แก้รายชื่อ agents, role, channel, sprite, และ schedule จากไฟล์นี้
- แก้ AI ของแต่ละ agent ได้ที่ `agents[].ai.provider`, `agents[].ai.model`, `agents[].ai.apiKeyEnv`
- `src/team-config.js` จะ validate config ก่อนนำไปใช้
- `src/runtime-store.js` จะสร้าง canonical `Task` / `Run` state ให้ UI ใช้ร่วมกัน

First slice นี้ยังเป็น control plane ใน browser อยู่ ดังนั้นการแก้ `team-config.json` จะมีผลกับ UI ทันทีเมื่อ reload หน้า

## Per-Agent AI Settings

แต่ละ agent สามารถเลือก AI ของตัวเองได้แล้ว โดยรองรับ `gemini` และ `deepseek`

ตัวอย่างใน `src/team-config.json`:

```json
"ai": {
  "provider": "gemini",
  "model": "gemini-2.5-pro",
  "apiKeyEnv": "GEMINI_API_KEY"
}
```

แนวทางใช้งาน:

- secret จริงเก็บใน `.env`
- config เก็บแค่ชื่อ env var
- UI สามารถแก้ `provider`, `model`, `apiKeyEnv` ของแต่ละ agent ได้ใน runtime
- การแก้จาก UI มีผลกับ state ปัจจุบันจนกว่าจะ reload หน้า

---

## เชื่อม UI กับ OpenClaw Gateway จริง

เปิดไฟล์ `src/openclaw-api.js` แล้ว uncomment ส่วน WebSocket:

```js
window.addEventListener('DOMContentLoaded', function () {
  OpenClawAPI.connect();
});
```

nginx จะ proxy `/ws` → `openclaw-gateway:18789` ให้อัตโนมัติ

---

## Security

- Gateway bind เป็น `localhost` เท่านั้น (ค่า default)
- อย่า expose port 18789/18790 ออก internet โดยตรง
- ใช้ SSH tunnel หรือ Tailscale ถ้าต้องการเข้าจากภายนอก

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| UI        | Vanilla HTML / CSS / JS |
| Pixel art | Canvas API |
| Server    | nginx:alpine |
| Gateway   | OpenClaw (Node.js) |
| Container | Docker Compose v2 |
