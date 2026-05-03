/**
 * openclaw-api.js — OpenClaw Gateway (HTTP) + optional WebSocket stub
 *
 * คำสั่งจาก UI ส่งต่อ AI จริงผ่าน POST /v1/responses (ต้องเปิดใน gateway config ก่อน)
 *
 * nginx proxy ที่ /gateway/ → openclaw-gateway:18789
 * Railway ใส่ Bearer ให้อัตโนมัติ; local ใส่ token ได้ที่ meta[name="openclaw-gateway-token"]
 */

function resolveOpenClawWsUrl() {
  if (typeof window === 'undefined' || !window.location) {
    return 'ws://127.0.0.1:18789';
  }

  var protocol = window.location.protocol;
  var hostname = window.location.hostname;
  var isLocalhost = hostname === '127.0.0.1' || hostname === 'localhost';

  if (protocol !== 'http:' && protocol !== 'https:') {
    return 'ws://127.0.0.1:18789';
  }

  if (isLocalhost) {
    return 'ws://127.0.0.1:18789';
  }

  return (protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws';
}

var OPENCLAW_WS_URL = (
  typeof window !== 'undefined' && window.OPENCLAW_WS_URL
) || resolveOpenClawWsUrl();

function gatewayHttpPrefix() {
  if (typeof window !== 'undefined' && window.OPENCLAW_GATEWAY_HTTP_PREFIX) {
    return String(window.OPENCLAW_GATEWAY_HTTP_PREFIX).replace(/\/$/, '');
  }
  return '/gateway';
}

function readGatewayToken() {
  var meta;
  if (typeof window === 'undefined' || !window.document) return '';
  meta = window.document.querySelector('meta[name="openclaw-gateway-token"]');
  if (meta && meta.getAttribute('content')) {
    return String(meta.getAttribute('content')).trim();
  }
  if (window.__OPENCLAW_GATEWAY_TOKEN__) {
    return String(window.__OPENCLAW_GATEWAY_TOKEN__).trim();
  }
  return '';
}

function buildAuthHeaders() {
  var token = readGatewayToken();
  var headers = { Accept: 'application/json' };
  if (token) {
    headers.Authorization = 'Bearer ' + token;
  }
  return headers;
}

function extractResponsesOutputText(body) {
  var out;
  var parts;
  if (!body || typeof body !== 'object') return '';
  if (typeof body.output_text === 'string') return body.output_text;
  out = body.output;
  if (!Array.isArray(out)) {
    try {
      return JSON.stringify(body).slice(0, 4000);
    } catch (e) {
      return '';
    }
  }
  parts = [];
  out.forEach(function (item) {
    var content = item && item.content;
    if (!Array.isArray(content)) return;
    content.forEach(function (c) {
      if (c && c.type === 'output_text' && typeof c.text === 'string') {
        parts.push(c.text);
      }
      if (c && c.type === 'text' && typeof c.text === 'string') {
        parts.push(c.text);
      }
    });
  });
  return parts.join('\n').trim() || JSON.stringify(body).slice(0, 4000);
}

var OpenClawAPI = (function () {
  var _ws = null;
  var _handlers = {};
  var _runtimeStore = null;
  var _lastHealth = { ok: false, at: 0, status: null };

  function setRuntimeStore(runtimeStore) {
    _runtimeStore = runtimeStore;
  }

  function getLastGatewayHealth() {
    return _lastHealth;
  }

  function refreshGatewayHealth() {
    var url = gatewayHttpPrefix() + '/health';
    return fetch(url, {
      method: 'GET',
      headers: buildAuthHeaders(),
      credentials: 'same-origin'
    }).then(function (r) {
      _lastHealth = { ok: r.ok, at: Date.now(), status: r.status };
      return _lastHealth;
    }).catch(function () {
      _lastHealth = { ok: false, at: Date.now(), status: 0 };
      return _lastHealth;
    });
  }

  /**
   * ส่งข้อความไปยัง agent บน gateway ผ่าน OpenResponses HTTP (ถ้าเปิดใช้งาน)
   * @returns {Promise<{ok:boolean,text?:string,reason?:string,status?:number}>}
   */
  function sendAgentPrompt(agentId, text) {
    var url = gatewayHttpPrefix() + '/v1/responses';
    var headers = buildAuthHeaders();
    headers['Content-Type'] = 'application/json';
    if (agentId) {
      headers['x-openclaw-agent-id'] = String(agentId);
    }

    return fetch(url, {
      method: 'POST',
      headers: headers,
      credentials: 'same-origin',
      body: JSON.stringify({
        model: 'openclaw',
        input: String(text || '')
      })
    }).then(function (r) {
      return r.text().then(function (raw) {
        var body;
        if (r.status === 404) {
          return { ok: false, reason: 'responses_disabled', status: 404 };
        }
        if (r.status === 401 || r.status === 403) {
          return { ok: false, reason: 'auth_failed', status: r.status };
        }
        if (!r.ok) {
          return { ok: false, reason: 'http_error', status: r.status, text: raw.slice(0, 500) };
        }
        try {
          body = JSON.parse(raw);
        } catch (e) {
          return { ok: true, text: raw };
        }
        return { ok: true, text: extractResponsesOutputText(body) || raw };
      });
    }).catch(function (err) {
      return { ok: false, reason: 'network', text: err && err.message };
    });
  }

  function connect() {
    try {
      _ws = new WebSocket(OPENCLAW_WS_URL);
      _ws.onopen = function () {
        console.log('[OpenClaw] WebSocket opened (ต้องใช้โปรโตคอล connect ฝั่ง gateway — ใช้ HTTP /gateway/v1/responses สำหรับคำสั่งจริง)');
        _emit('connect');
      };
      _ws.onmessage = function (ev) {
        try {
          var data = JSON.parse(ev.data);
          _emit('message', data);
          if (_runtimeStore && data.agent && _runtimeStore.getAgent(data.agent)) {
            if (data.status) {
              _runtimeStore.updateAgent(data.agent, {
                status: data.status.toUpperCase()
              });
            }
            if (data.log) {
              _runtimeStore.addLog(_runtimeStore.getAgent(data.agent).name, data.log);
            }
          }
        } catch (e) {
          console.warn('[OpenClaw] Unrecognised message', ev.data);
        }
      };
      _ws.onerror = function () { console.warn('[OpenClaw] WebSocket error'); };
      _ws.onclose = function () {
        console.log('[OpenClaw] WebSocket closed');
      };
    } catch (e) {
      console.warn('[OpenClaw] Cannot open WebSocket:', e.message);
    }
  }

  function send(agentId, command) {
    if (!_ws || _ws.readyState !== WebSocket.OPEN) {
      console.warn('[OpenClaw] Not connected — command dropped:', command);
      return false;
    }
    _ws.send(JSON.stringify({ agent: agentId, command: command }));
    return true;
  }

  function on(event, handler) { _handlers[event] = handler; }

  function _emit(event, data) {
    if (_handlers[event]) _handlers[event](data);
  }

  function initGatewayUi() {
    var pill = typeof document !== 'undefined' ? document.getElementById('gateway-pill') : null;
    function paint() {
      var h = _lastHealth;
      if (!pill) return;
      if (h.ok) {
        pill.textContent = 'GATEWAY: OK';
        pill.className = 'gateway-pill gateway-pill-ok';
      } else if (h.status === 0) {
        pill.textContent = 'GATEWAY: OFFLINE';
        pill.className = 'gateway-pill gateway-pill-off';
      } else {
        pill.textContent = 'GATEWAY: ' + (h.status || '?');
        pill.className = 'gateway-pill gateway-pill-warn';
      }
    }
    refreshGatewayHealth().then(paint);
    setInterval(function () {
      refreshGatewayHealth().then(paint);
    }, 12000);
  }

  return {
    connect: connect,
    send: send,
    on: on,
    setRuntimeStore: setRuntimeStore,
    gatewayHttpPrefix: gatewayHttpPrefix,
    readGatewayToken: readGatewayToken,
    refreshGatewayHealth: refreshGatewayHealth,
    getLastGatewayHealth: getLastGatewayHealth,
    sendAgentPrompt: sendAgentPrompt,
    initGatewayUi: initGatewayUi
  };
})();

if (typeof window !== 'undefined') {
  window.OpenClawAPI = OpenClawAPI;
}
