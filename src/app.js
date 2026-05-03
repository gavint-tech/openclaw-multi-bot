/**
 * app.js — main application controller
 * จัดการ UI interactions, clock, config-backed agents, tasks, and run state
 */

var modalMode = 'create';
var editingAgentId = null;

/** ช่องทางที่ UI ยังผูกจริงกับ gateway ไม่ได้ — ไม่แสดง LIVE หลอก */
function channelUiStatus(channelName) {
  var n = String(channelName || '');
  if (n === 'Telegram' || n === 'WhatsApp' || n === 'LINE') {
    return { label: 'CLI', cls: 'ch-cli', title: 'ผูกจริงผ่าน openclaw CLI (agents bind) — UI ยังไม่ส่ง token' };
  }
  if (n === 'Slack' || n === 'Discord') {
    return { label: 'CONFIG', cls: 'ch-config', title: 'ตั้งค่าที่ gateway / ไฟล์ config' };
  }
  if (n === 'Web UI' || n === 'Internal') {
    return { label: 'LOCAL', cls: 'ch-local', title: 'สถานะในเบราว์เซอร์' };
  }
  return { label: 'UI', cls: 'ch-ui', title: 'แสดงจาก team config' };
}

/* ─── Clock ─── */
function updateClock() {
  var n = new Date();
  var h = n.getHours() % 12 || 12;
  var m = String(n.getMinutes()).padStart(2, '0');
  var ap = n.getHours() >= 12 ? 'PM' : 'AM';
  var el = document.getElementById('clock');
  if (el) el.textContent = 'TIME: ' + h + ':' + m + ' ' + ap;
}

function getSelectedAgent() {
  return OfficeRuntimeStore.getAgent(OfficeRuntimeStore.getSelectedAgentId());
}

function defaultApiKeyEnv(provider) {
  return provider === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'GEMINI_API_KEY';
}

/* ─── Render agent list (left panel) ─── */
function renderAgentList() {
  var list = document.getElementById('agent-list');
  var agents = OfficeRuntimeStore.getAgents();
  var selectedAgentId = OfficeRuntimeStore.getSelectedAgentId();
  list.innerHTML = '';

  Object.keys(agents).forEach(function (id) {
    var ag = agents[id];
    var row = document.createElement('div');
    row.className = 'ag-row' + (id === selectedAgentId ? ' sel' : '');
    row.dataset.id = id;

    var canvasEl = document.createElement('canvas');
    canvasEl.className = 'px-av';
    canvasEl.width = 28; canvasEl.height = 28;
    canvasEl.id = 'av-' + id;

    var info = document.createElement('div');
    info.className = 'ag-info';
    info.innerHTML =
      '<div class="ag-name">' + ag.name + '</div>' +
      '<div class="ag-status ' + ag.stClass + '">' + ag.status + '</div>';

    var gear = document.createElement('div');
    gear.className = 'gear-btn';
    gear.title = 'Config';
    gear.innerHTML = '<svg viewBox="0 0 12 12"><path d="M6 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0-3l.5 1.5a3.5 3.5 0 0 1 .8.35l1.5-.5.7.7-.5 1.5a3.5 3.5 0 0 1 .35.8L11 5.5v1l-1.5.5a3.5 3.5 0 0 1-.35.8l.5 1.5-.7.7-1.5-.5a3.5 3.5 0 0 1-.8.35L6.5 11h-1l-.5-1.5a3.5 3.5 0 0 1-.8-.35l-1.5.5-.7-.7.5-1.5A3.5 3.5 0 0 1 2.15 7L.5 6.5v-1l1.5-.5a3.5 3.5 0 0 1 .35-.8l-.5-1.5.7-.7 1.5.5a3.5 3.5 0 0 1 .8-.35L5.5 1z"/></svg>';
    gear.addEventListener('click', function (e) {
      e.stopPropagation();
      openEditModal(id);
    });

    row.appendChild(canvasEl);
    row.appendChild(info);
    row.appendChild(gear);
    row.addEventListener('click', function () { selectAgent(id); });
    list.appendChild(row);

    setTimeout(function () {
      drawChar(document.getElementById('av-' + id), ag.sprite);
    }, 0);
  });
}

/* ─── Select agent ─── */
function renderSelectedAgent() {
  var ag = getSelectedAgent();
  var chList;
  var stEl;

  if (!ag) return;

  document.getElementById('detail-name').textContent = ag.name;
  document.getElementById('detail-role').textContent = ag.role;
  stEl = document.getElementById('detail-status');
  stEl.textContent = ag.status;
  stEl.className = 'detail-status-val ' + ag.stClass;

  document.getElementById('s-tasks').textContent = ag.tasks;
  document.getElementById('s-up').textContent = ag.up;
  document.getElementById('s-msg').textContent = ag.msg;
  document.getElementById('s-err').textContent = ag.err;
  document.getElementById('ai-provider').textContent = ag.ai.provider;
  document.getElementById('ai-model').textContent = ag.ai.model;
  document.getElementById('ai-api-env').textContent = ag.ai.apiKeyEnv;

  chList = document.getElementById('ch-list');
  chList.innerHTML = ag.channels.map(function (c) {
    var st = channelUiStatus(c.name);
    return '<div class="ch-item">' +
      '<div class="ch-dot" style="background:' + c.color + '"></div>' +
      '<span class="ch-name">' + c.name + '</span>' +
      '<span class="ch-status ' + st.cls + '">' + st.label + '</span>' +
      '</div>';
  }).join('');

  drawChar(document.getElementById('detail-av'), ag.sprite);
}

function selectAgent(id) {
  OfficeRuntimeStore.setSelectedAgentId(id);
}

/* ─── Room selection ─── */
function initRooms() {
  document.querySelectorAll('.room').forEach(function (room) {
    room.addEventListener('click', function () {
      document.querySelectorAll('.room').forEach(function (r) { r.classList.remove('active'); });
      room.classList.add('active');
    });
  });
}

/* ─── Activity log / runs ─── */
function renderLogs() {
  var logs = OfficeRuntimeStore.getLogs();
  var strip = document.getElementById('log-strip-list');
  var recent = document.getElementById('recent-log');

  strip.innerHTML = logs.map(function (entry) {
    return '<div class="log-item">' +
      '<span class="log-ts">' + entry.ts + '</span>' +
      '<span class="log-msg"><b>' + entry.agent + '</b> ' + entry.msg + '</span>' +
      '</div>';
  }).join('');

  recent.innerHTML = logs.slice(0, 3).map(function (entry) {
    return '<div class="log-item">' +
      '<span class="log-ts" style="font-size:8px;color:#2e6b9e;white-space:nowrap;padding-top:1px">' + entry.ts + '</span>' +
      '<span class="log-msg"><b>' + entry.agent + '</b> ' + entry.msg.substring(0, 28) + (entry.msg.length > 28 ? '…' : '') + '</span>' +
      '</div>';
  }).join('');
}

/* ─── Terminal ─── */
function fillCmd(text) {
  document.getElementById('cmd-in').value = text;
  document.getElementById('cmd-in').focus();
}

function setCommandBusy(on) {
  var input = document.getElementById('cmd-in');
  var execBtn = document.querySelector('.term-send');
  document.querySelectorAll('.quick-list .qbtn').forEach(function (btn) {
    btn.disabled = !!on;
  });
  if (input) input.disabled = !!on;
  if (execBtn) execBtn.disabled = !!on;
}

function paintGatewayReply(bodyText, metaLine) {
  var body = document.getElementById('gateway-reply-body');
  var meta = document.getElementById('gateway-reply-meta');
  if (meta) meta.textContent = metaLine || '';
  if (body) body.textContent = bodyText != null ? String(bodyText) : '';
}

/**
 * ส่งข้อความไปยัง agent ที่เลือก (gateway ถ้ามี OpenClawAPI มิฉะนั้นโหมดจำลอง)
 * @returns {Promise<void>}
 */
function runAgentCommand(text) {
  var val = String(text || '').trim();
  var agentId = OfficeRuntimeStore.getSelectedAgentId();
  var p;

  if (!val) {
    return Promise.resolve();
  }

  function afterGateway(res) {
    if (res.ok && res.text && String(res.text).trim()) {
      paintGatewayReply(res.text, 'Gateway — agent: ' + agentId);
    } else if (res.ok) {
      paintGatewayReply(
        '(ไม่มีข้อความใน body)',
        'Gateway OK — agent: ' + agentId + ' (ตรวจรูปแบบ /v1/responses)'
      );
    } else {
      paintGatewayReply(
        res.text || '',
        'Gateway ล้มเหลว — ' + (res.reason || 'error') + (res.status != null ? ' HTTP ' + res.status : '')
      );
    }
  }

  if (typeof OpenClawAPI !== 'undefined' && OpenClawAPI.sendAgentPrompt) {
    setCommandBusy(true);
    paintGatewayReply('…', 'กำลังเรียก gateway…');
    p = OpenClawAPI.sendAgentPrompt(agentId, val)
      .then(function (res) {
        afterGateway(res);
        if (res.ok) {
          OfficeRuntimeStore.submitTask({
            sourceType: 'web-ui',
            sourceLabel: 'OpenClaw gateway',
            command: val,
            requestedAgentId: agentId,
            metadata: {
              gatewaySummary: res.text && String(res.text).trim()
                ? res.text
                : '(Gateway ตอบกลับแล้วแต่ไม่มีข้อความ — ตรวจรูปแบบ /v1/responses)'
            }
          });
          return;
        }
        if (res.reason === 'responses_disabled') {
          OfficeRuntimeStore.addLog('SYSTEM', 'Gateway: ยังไม่เปิด HTTP /v1/responses — ใช้โหมดจำลองในเบราว์เซอร์');
        } else if (res.reason === 'auth_failed') {
          OfficeRuntimeStore.addLog('SYSTEM', 'Gateway: 401/403 — ตั้ง meta openclaw-gateway-token หรือ OPENCLAW_GATEWAY_TOKEN ที่ nginx');
        } else if (res.reason === 'network') {
          OfficeRuntimeStore.addLog('SYSTEM', 'Gateway: ต่อไม่ถึง — ตรวจ docker และ path /gateway/');
        } else if (!res.ok) {
          OfficeRuntimeStore.addLog('SYSTEM', 'Gateway: ' + (res.reason || 'error') + (res.text ? ' — ' + res.text : ''));
        }
        OfficeRuntimeStore.submitTask({
          sourceType: 'web-ui',
          sourceLabel: 'Command panel',
          command: val,
          requestedAgentId: agentId
        });
      })
      .catch(function (err) {
        paintGatewayReply(String(err && err.message ? err.message : err), 'ข้อผิดพลาด');
        OfficeRuntimeStore.addLog('SYSTEM', 'Gateway: ' + (err && err.message ? err.message : String(err)));
        try {
          OfficeRuntimeStore.submitTask({
            sourceType: 'web-ui',
            sourceLabel: 'Command panel',
            command: val,
            requestedAgentId: agentId
          });
        } catch (e2) { /* ignore */ }
      })
      .finally(function () {
        setCommandBusy(false);
      });
    return p;
  }

  paintGatewayReply('', 'โหมดจำลองในเบราว์เซอร์ (ไม่มี OpenClawAPI.sendAgentPrompt)');
  OfficeRuntimeStore.submitTask({
    sourceType: 'web-ui',
    sourceLabel: 'Command panel',
    command: val,
    requestedAgentId: agentId
  });
  return Promise.resolve();
}

function sendCommand() {
  var input = document.getElementById('cmd-in');
  var val = (input && input.value || '').trim();
  if (!val) return;
  input.value = '';
  runAgentCommand(val);
}

/** ปุ่มลัด — รันคำสั่งทันที */
function runQuickCommand(text) {
  return runAgentCommand(text);
}

/* ─── Modal ─── */
function showModal()  { document.getElementById('overlay').classList.add('show'); }
function hideModal()  {
  document.getElementById('overlay').classList.remove('show');
  editingAgentId = null;
}

function resetModalFields() {
  document.getElementById('m-name').value = '';
  document.getElementById('m-role').value = '';
  document.getElementById('m-ws').value = '';
  document.getElementById('m-ch').value = 'Telegram';
  document.getElementById('m-ai-provider').value = 'gemini';
  document.getElementById('m-ai-model').value = 'gemini-2.5-flash';
  document.getElementById('m-ai-api-env').value = 'GEMINI_API_KEY';
}

function setModalMode(mode) {
  modalMode = mode;
  document.getElementById('modal-title').textContent = mode === 'edit' ? '[ EDIT AGENT ]' : '[ NEW AGENT ]';
  document.getElementById('deploy-btn').textContent = mode === 'edit' ? 'SAVE CHANGES' : 'DEPLOY AGENT';
}

function syncTelegramHint(channelValue) {
  var el = document.getElementById('m-telegram-hint');
  if (!el) return;
  if (channelValue === 'Telegram') {
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

function openCreateModal() {
  editingAgentId = null;
  setModalMode('create');
  resetModalFields();
  syncTelegramHint(document.getElementById('m-ch').value);
  showModal();
}

function openEditModal(agentId) {
  var agent = OfficeRuntimeStore.getAgent(agentId);
  if (!agent) return;

  editingAgentId = agentId;
  setModalMode('edit');
  document.getElementById('m-name').value = agent.name;
  document.getElementById('m-role').value = agent.role;
  document.getElementById('m-ws').value = agent.workspace;
  document.getElementById('m-ch').value = agent.channels[0] ? agent.channels[0].name : 'Telegram';
  document.getElementById('m-ai-provider').value = agent.ai.provider;
  document.getElementById('m-ai-model').value = agent.ai.model;
  document.getElementById('m-ai-api-env').value = agent.ai.apiKeyEnv;
  OfficeRuntimeStore.addLog('CONFIG', 'Editing AI config for ' + agent.name);
  syncTelegramHint(document.getElementById('m-ch').value);
  showModal();
}

function validateAgentAiInput(provider, model, apiKeyEnv) {
  if (provider !== 'gemini' && provider !== 'deepseek') {
    throw new Error('AI provider must be Gemini or DeepSeek.');
  }
  if (!model) {
    throw new Error('AI model is required.');
  }
  if (!apiKeyEnv) {
    throw new Error('API key env is required.');
  }
}

function saveAgent() {
  var name = (document.getElementById('m-name').value || 'AGENT').toUpperCase().replace(/\s+/g, '_');
  var role = document.getElementById('m-role').value || 'Custom agent';
  var ws = document.getElementById('m-ws').value || '~/.openclaw/workspace-' + name.toLowerCase();
  var ch = document.getElementById('m-ch').value;
  var provider = document.getElementById('m-ai-provider').value;
  var model = document.getElementById('m-ai-model').value.trim();
  var apiKeyEnv = document.getElementById('m-ai-api-env').value.trim();
  var selectedAgent;
  var configAgent;

  try {
    validateAgentAiInput(provider, model, apiKeyEnv);
  } catch (error) {
    window.alert(error.message);
    return;
  }

  if (modalMode === 'edit' && editingAgentId) {
    selectedAgent = OfficeRuntimeStore.getAgent(editingAgentId);
    OfficeRuntimeStore.updateAgent(editingAgentId, {
      name: name,
      role: role,
      workspace: ws,
      channels: [{ name: ch, color: selectedAgent.channels[0] ? selectedAgent.channels[0].color : '#4fc3f7' }],
      ai: {
        provider: provider,
        model: model,
        apiKeyEnv: apiKeyEnv
      }
    });
    OfficeRuntimeStore.addLog(name, 'AI config updated — ' + provider + '/' + model + ' via ' + apiKeyEnv);
  } else {
    configAgent = TeamConfig.createAgentConfig({
      name: name,
      role: role,
      workspace: ws,
      channelName: ch,
      aiProvider: provider,
      aiModel: model,
      aiApiKeyEnv: apiKeyEnv
    }, nextSprite());

    OfficeRuntimeStore.addAgent(configAgent);
    OfficeRuntimeStore.addLog(configAgent.name, 'Agent deployed — ' + provider + '/' + model + ' via ' + apiKeyEnv);
  }

  hideModal();
  resetModalFields();
}

/* ─── Docker health (simulated poll) ─── */
function pollDocker() {
  var cpu = Math.round(30 + Math.random() * 20);
  var ram = Math.round(50 + Math.random() * 20);
  var cpuEl = document.getElementById('d-cpu');
  var cpuBar = document.getElementById('cpu-bar');
  var ramEl = document.getElementById('d-ram');
  var ramBar = document.getElementById('ram-bar');
  if (cpuEl) cpuEl.textContent = cpu + '%';
  if (cpuBar) cpuBar.style.width = cpu + '%';
  if (ramEl) ramEl.textContent = (ram / 100 * 2).toFixed(1) + ' GB';
  if (ramBar) ramBar.style.width = ram + '%';
}

function syncUIFromState() {
  var ids = OfficeRuntimeStore.getAgentIds();
  var selectedAgentId = OfficeRuntimeStore.getSelectedAgentId();
  var title = document.getElementById('team-name');

  if (!selectedAgentId && ids.length > 0) {
    OfficeRuntimeStore.setSelectedAgentId(ids[0]);
    return;
  }

  if (selectedAgentId && !OfficeRuntimeStore.getAgent(selectedAgentId) && ids.length > 0) {
    OfficeRuntimeStore.setSelectedAgentId(ids[0]);
    return;
  }

  renderAgentList();
  renderSelectedAgent();
  renderLogs();

  if (title) {
    title.textContent = OfficeRuntimeStore.getTeamConfig().title || 'OpenClaw Office';
  }
}

/* ─── Boot ─── */
window.addEventListener('DOMContentLoaded', function () {
  updateClock();
  setInterval(updateClock, 1000);
  setInterval(pollDocker, 5000);

  drawAllRooms();
  initRooms();
  pollDocker();

  OfficeRuntimeStore.subscribe(syncUIFromState);

  TeamConfig.loadConfig(window.fetch).then(function (teamConfig) {
    OfficeRuntimeStore.init(teamConfig, INITIAL_LOG);
    if (typeof OpenClawAPI !== 'undefined' && OpenClawAPI.setRuntimeStore) {
      OpenClawAPI.setRuntimeStore(OfficeRuntimeStore);
    }
    if (typeof OpenClawAPI !== 'undefined' && OpenClawAPI.initGatewayUi) {
      OpenClawAPI.initGatewayUi();
    }
  });

  document.getElementById('open-modal-btn').addEventListener('click', openCreateModal);
  document.getElementById('close-modal-btn').addEventListener('click', hideModal);
  document.getElementById('cancel-modal-btn').addEventListener('click', hideModal);
  document.getElementById('deploy-btn').addEventListener('click', saveAgent);
  document.getElementById('m-ai-provider').addEventListener('change', function () {
    document.getElementById('m-ai-api-env').value = defaultApiKeyEnv(this.value);
  });

  document.getElementById('m-ch').addEventListener('change', function () {
    syncTelegramHint(this.value);
  });
  syncTelegramHint(document.getElementById('m-ch').value);

  document.getElementById('overlay').addEventListener('click', function (e) {
    if (e.target === this) hideModal();
  });
});
