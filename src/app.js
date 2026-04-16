/**
 * app.js — main application controller
 * จัดการ UI interactions, clock, config-backed agents, tasks, and run state
 */

var modalMode = 'create';
var editingAgentId = null;

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
    return '<div class="ch-item">' +
      '<div class="ch-dot" style="background:' + c.color + '"></div>' +
      '<span class="ch-name">' + c.name + '</span>' +
      '<span class="ch-status">LIVE</span>' +
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

function sendCommand() {
  var input = document.getElementById('cmd-in');
  var val = input.value.trim();
  if (!val) return;

  OfficeRuntimeStore.submitTask({
    sourceType: 'web-ui',
    sourceLabel: 'Command panel',
    command: val,
    requestedAgentId: OfficeRuntimeStore.getSelectedAgentId()
  });

  input.value = '';
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

function openCreateModal() {
  editingAgentId = null;
  setModalMode('create');
  resetModalFields();
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
  });

  document.getElementById('open-modal-btn').addEventListener('click', openCreateModal);
  document.getElementById('close-modal-btn').addEventListener('click', hideModal);
  document.getElementById('cancel-modal-btn').addEventListener('click', hideModal);
  document.getElementById('deploy-btn').addEventListener('click', saveAgent);
  document.getElementById('m-ai-provider').addEventListener('change', function () {
    document.getElementById('m-ai-api-env').value = defaultApiKeyEnv(this.value);
  });

  document.getElementById('overlay').addEventListener('click', function (e) {
    if (e.target === this) hideModal();
  });
});
