const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, proto } = require('@whiskeysockets/baileys');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const crypto = require('crypto');
const fs = require('fs');
const mysql = require('mysql2/promise');
const qrcode = require('qrcode');
const path = require('path');
const geolib = require('geolib');
const dotenv = require('dotenv');
const os = require('os');

const homeDir = process.env.HOME || process.env.USERPROFILE || os.homedir();

function loadEnvFile(filePath, override = false) {
  if (!filePath) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('BOT_ENV_FILE is required in production.');
    }
    return;
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Bot env file not found: ${resolvedPath}`);
    }
    return;
  }

  dotenv.config({ path: resolvedPath, override });
}

loadEnvFile(process.env.BOT_ENV_FILE && process.env.BOT_ENV_FILE.trim());
if (!process.env.BOT_ENV_FILE) {
  loadEnvFile(path.join(homeDir, '.travaux', 'bot.env'));
}
// .env.local tem prioridade quando existir, inclusive em testes locais (nunca obrigatório).
const localEnvPath = path.join(__dirname, '.env.local');
if (fs.existsSync(localEnvPath)) loadEnvFile(localEnvPath, true);

// Opções de almoço/pausa disponíveis (em minutos)
const ALMOCO_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '60 min', value: 60 },
  { label: '90 min', value: 90 },
  { label: '120 min', value: 120 },
  { label: 'Sem almoço', value: 0 },
];

// Estados de sessão por contato
const estados = new Map();
let pool = null;
let suporteLocalizacaoCache = null;
let botPermiteCheckinForaRaioColumnExistsCache = null;
let tenantTimezoneCodeColumnExistsCache = null;
let botMensagensWhatsappMessageIdColumnExistsCache = null;
let lidMappingCache = null;

function normalizePhone(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function getPhoneMatchRegions() {
  const configuredRegions = String(process.env.PHONE_MATCH_DEFAULT_REGIONS || '')
    .split(',')
    .map((region) => region.trim().toUpperCase())
    .filter(Boolean);

  return [...new Set(['BR', 'BE', ...configuredRegions])];
}

function buildPhoneVariants(value) {
  const digits = normalizePhone(value);
  const variants = new Set();

  if (!digits) {
    return variants;
  }

  const addParsedVariants = (parsedPhone) => {
    if (!parsedPhone) {
      return;
    }

    variants.add(parsedPhone.number.replace(/\D/g, ''));
    variants.add(String(parsedPhone.countryCallingCode || '') + String(parsedPhone.nationalNumber || ''));
    variants.add(String(parsedPhone.nationalNumber || ''));

    const national = parsedPhone.formatNational();
    if (national) {
      variants.add(normalizePhone(national));
    }
  };

  variants.add(digits);

  if (digits.startsWith('00') && digits.length > 2) {
    variants.add(digits.slice(2));
  }

  if (digits.startsWith('55') && digits.length > 2) {
    variants.add(digits.slice(2));
  }

  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    variants.add('55' + digits);
  }

  addParsedVariants(parsePhoneNumberFromString(`+${digits}`));

  for (const region of getPhoneMatchRegions()) {
    addParsedVariants(parsePhoneNumberFromString(digits, region));
  }

  return variants;
}

function phonesMatch(left, right) {
  const leftVariants = buildPhoneVariants(left);
  const rightVariants = buildPhoneVariants(right);

  if (leftVariants.size === 0 || rightVariants.size === 0) {
    return false;
  }

  for (const variant of leftVariants) {
    if (rightVariants.has(variant)) {
      return true;
    }
  }

  return false;
}

function getLidMappingCache() {
  if (lidMappingCache) {
    return lidMappingCache;
  }

  lidMappingCache = new Map();

  const authDir = getAuthDir();
  if (!fs.existsSync(authDir)) {
    return lidMappingCache;
  }

  for (const fileName of fs.readdirSync(authDir)) {
    if (!fileName.startsWith('lid-mapping-') || fileName.endsWith('_reverse.json')) {
      continue;
    }

    const match = fileName.match(/^lid-mapping-(.+)\.json$/);
    if (!match) {
      continue;
    }

    try {
      const fileContent = fs.readFileSync(path.join(authDir, fileName), 'utf8').trim();
      const lid = normalizePhone(JSON.parse(fileContent));
      const phone = normalizePhone(match[1]);

      if (lid && phone) {
        lidMappingCache.set(lid, phone);
      }
    } catch {}
  }

  return lidMappingCache;
}

function getAuthDir() {
  const configuredAuthDir = process.env.BOT_AUTH_DIR && process.env.BOT_AUTH_DIR.trim();
  return configuredAuthDir ? path.resolve(configuredAuthDir) : path.join(homeDir, '.travaux', 'bot', 'auth_info_baileys');
}

function shouldForceNewQrOnStart() {
  const value = String(process.env.BOT_FORCE_NEW_QR || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(value);
}

function resolveSenderIdentifier(rawValue) {
  const raw = String(rawValue || '');
  const digits = normalizePhone(raw.split('@')[0]);

  if (!digits) {
    return '';
  }

  if (raw.endsWith('@lid')) {
    return getLidMappingCache().get(digits) || digits;
  }

  return digits;
}

function getSenderPhone(msg) {
  const remoteJid = String(msg?.key?.remoteJid || '');
  const remoteJidAlt = String(msg?.key?.remoteJidAlt || msg?.remoteJidAlt || '');
  const participantRaw = msg?.key?.participant || msg?.participant;
  const participantAltRaw = msg?.key?.participantAlt || msg?.participantAlt;
  const remoteDigits = resolveSenderIdentifier(remoteJid);
  const remoteAltDigits = resolveSenderIdentifier(remoteJidAlt);
  const participantDigits = resolveSenderIdentifier(participantRaw);
  const participantAltDigits = resolveSenderIdentifier(participantAltRaw);

  // If Baileys provides alternate PN mapping, prefer it for LID-origin messages.
  if (remoteJid.endsWith('@lid') && remoteAltDigits) {
    return remoteAltDigits;
  }

  if (participantRaw && String(participantRaw).endsWith('@lid') && participantAltDigits) {
    return participantAltDigits;
  }

  // For direct chats, remoteJid is the safest source. participant may come as @lid.
  if (remoteJid.endsWith('@s.whatsapp.net') && remoteDigits) {
    return remoteDigits;
  }

  return participantAltDigits || participantDigits || remoteAltDigits || remoteDigits;
}

function getSenderDebugInfo(msg) {
  return {
    remoteJid: msg?.key?.remoteJid || null,
    remoteJidAlt: msg?.key?.remoteJidAlt || msg?.remoteJidAlt || null,
    participant: msg?.key?.participant || msg?.participant || null,
    participantAlt: msg?.key?.participantAlt || msg?.participantAlt || null,
    remoteJidDigits: resolveSenderIdentifier(msg?.key?.remoteJid),
    remoteJidAltDigits: resolveSenderIdentifier(msg?.key?.remoteJidAlt || msg?.remoteJidAlt),
    participantDigits: resolveSenderIdentifier(msg?.key?.participant || msg?.participant),
    participantAltDigits: resolveSenderIdentifier(msg?.key?.participantAlt || msg?.participantAlt),
    extractedPhone: getSenderPhone(msg),
    pushName: msg?.pushName || null,
  };
}

function getDbConfig() {
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl) {
    try {
      const parsed = new URL(dbUrl);
      return {
        host: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port, 10) : 3306,
        database: parsed.pathname.replace(/^\//, '') || process.env.DB_NAME || 'obras_db',
        user: decodeURIComponent(parsed.username || process.env.DB_USER || 'root'),
        password: decodeURIComponent(parsed.password || process.env.DB_PASSWORD || ''),
        waitForConnections: true,
        connectionLimit: parseInt(process.env.DB_POOL_MAX || '10', 10),
        queueLimit: 0,
        charset: 'utf8mb4',
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      };
    } catch {}
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_NAME || 'obras_db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_MAX || '10', 10),
    queueLimit: 0,
    charset: 'utf8mb4',
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  };
}

async function getPool() {
  if (!pool) {
    pool = mysql.createPool(getDbConfig());
  }
  return pool;
}

async function query(sql, values = []) {
  const db = await getPool();
  const [rows] = await db.query(sql, values);
  return rows;
}

async function ensureBotLoggingSchema() {
  await query(
    `CREATE TABLE IF NOT EXISTS bot_jornada_sessoes (
      id CHAR(36) NOT NULL,
      tenant_id CHAR(36) NOT NULL,
      funcionario_id CHAR(36) NOT NULL,
      telefone VARCHAR(30) NOT NULL,
      mensagem_inicio_id VARCHAR(100) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'aberta',
      etapa_atual VARCHAR(40) NOT NULL DEFAULT 'aberta',
      obra_id CHAR(36) NULL,
      obra_label VARCHAR(255) NULL,
      checkin_at DATETIME NULL,
      checkout_at DATETIME NULL,
      duracao_minutos INT UNSIGNED NULL,
      almoco_minutos TINYINT UNSIGNED NULL,
      localizacao_json JSON NULL,
      ultima_mensagem_id VARCHAR(100) NULL,
      ultima_mensagem_texto TEXT NULL,
      ultimo_evento VARCHAR(60) NULL,
      finalizada_em TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_bot_jornada_sessoes_inicio (tenant_id, mensagem_inicio_id),
      KEY idx_bot_jornada_sessoes_tenant_func (tenant_id, funcionario_id),
      KEY idx_bot_jornada_sessoes_status (tenant_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  await query(
    `CREATE TABLE IF NOT EXISTS bot_jornada_eventos (
      id CHAR(36) NOT NULL,
      tenant_id CHAR(36) NOT NULL,
      funcionario_id CHAR(36) NOT NULL,
      sessao_id CHAR(36) NULL,
      message_id VARCHAR(100) NOT NULL,
      evento VARCHAR(60) NOT NULL,
      etapa_anterior VARCHAR(40) NULL,
      etapa_nova VARCHAR(40) NULL,
      payload JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_bot_jornada_eventos_message (tenant_id, message_id),
      KEY idx_bot_jornada_eventos_sessao (tenant_id, sessao_id, created_at),
      KEY idx_bot_jornada_eventos_funcionario (tenant_id, funcionario_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );

  try {
    await query(
      `ALTER TABLE bot_mensagens_pendentes
         ADD COLUMN whatsapp_message_id VARCHAR(100) NULL
           COMMENT 'Id da mensagem WhatsApp enviada para correlacionar resposta'`
    );
  } catch (error) {
    const isExpectedDuplicate =
      error?.code === 'ER_DUP_FIELDNAME' ||
      error?.errno === 1060;

    if (!isExpectedDuplicate) {
      console.error('[BOT_SCHEMA_WARN] Falha ao garantir coluna whatsapp_message_id:', error.message || error);
    }
  }

  try {
    await query(
      `ALTER TABLE horas_trabalhadas
         ADD COLUMN bot_sessao_id CHAR(36) NULL AFTER descricao,
         ADD KEY idx_horas_bot_sessao (bot_sessao_id)`
    );
  } catch (error) {
    const isExpectedDuplicate =
      error?.code === 'ER_DUP_FIELDNAME' ||
      error?.code === 'ER_DUP_KEYNAME' ||
      error?.errno === 1060 ||
      error?.errno === 1061;

    if (!isExpectedDuplicate) {
      console.error('[BOT_SCHEMA_WARN]', error.message || error);
    }
  }

  await query(
    `CREATE TABLE IF NOT EXISTS bot_checkin_divergencias (
      id CHAR(36) NOT NULL,
      tenant_id CHAR(36) NOT NULL,
      sessao_id CHAR(36) NULL,
      funcionario_id CHAR(36) NOT NULL,
      obra_id CHAR(36) NOT NULL,
      lat DECIMAL(10,8) NOT NULL,
      lng DECIMAL(11,8) NOT NULL,
      distancia_metros INT UNSIGNED NOT NULL,
      raio_metros INT UNSIGNED NOT NULL,
      desvio_metros INT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_bot_checkin_div_tenant_obra (tenant_id, obra_id),
      KEY idx_bot_checkin_div_tenant_func (tenant_id, funcionario_id),
      KEY idx_bot_checkin_div_sessao (sessao_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
}

function shouldRunSchemaBootstrap() {
  const explicit = process.env.BOT_SCHEMA_BOOTSTRAP;

  if (explicit !== undefined) {
    return ['1', 'true', 'yes', 'on'].includes(String(explicit).trim().toLowerCase());
  }

  return process.env.NODE_ENV !== 'production';
}

function formatMinutesAsClock(totalMinutes) {
  const safeMinutes = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseMaybeJson(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function buildObraLabel(obra) {
  return [obra?.nome, obra?.cliente, obra?.endereco].filter(Boolean).join(' - ');
}

function getMessageId(msg) {
  return String(msg?.key?.id || crypto.randomUUID());
}

function getQuotedMessageId(msg) {
  return String(
    msg?.message?.extendedTextMessage?.contextInfo?.stanzaId ||
    msg?.message?.imageMessage?.contextInfo?.stanzaId ||
    msg?.message?.videoMessage?.contextInfo?.stanzaId ||
    msg?.message?.documentMessage?.contextInfo?.stanzaId ||
    ''
  ).trim();
}

function getReplyDecision(texto) {
  if (texto === '1') return 1;
  if (texto === '2') return 2;
  return null;
}

async function processarRespostaNotificacao({ msg, texto, contexto = null }) {
  const decisaoResposta = getReplyDecision(texto);
  if (decisaoResposta === null) {
    return false;
  }

  try {
    const hasWhatsappMessageId = await detectarColunaWhatsappMessageId();
    const quotedMessageId = getQuotedMessageId(msg);
    let mensagemReferencia = null;

    if (quotedMessageId && hasWhatsappMessageId) {
      if (contexto) {
        const quotedRows = await query(
          `SELECT id, tenant_id, pagamento_id, funcionario_id, mensagem
             FROM bot_mensagens_pendentes
            WHERE tenant_id = ? AND funcionario_id = ? AND whatsapp_message_id = ?
            ORDER BY created_at DESC
            LIMIT 1`,
          [contexto.tenantId, contexto.funcionario.id, quotedMessageId]
        );
        mensagemReferencia = quotedRows[0] || null;
      } else {
        const quotedRows = await query(
          `SELECT m.id, m.tenant_id, m.pagamento_id, m.funcionario_id, m.mensagem
             FROM bot_mensagens_pendentes m
             INNER JOIN pagamentos p
                ON p.id = m.pagamento_id
               AND p.tenant_id = m.tenant_id
            WHERE m.whatsapp_message_id = ?
              AND m.status = 'enviado'
              AND COALESCE(p.flg_vld_funcionario, 0) = 0
            ORDER BY m.created_at DESC
            LIMIT 1`,
          [quotedMessageId]
        );
        mensagemReferencia = quotedRows[0] || null;
      }
    }

    if (!mensagemReferencia) {
      if (contexto) {
        const ultimasPendentes = await query(
          `SELECT m.id, m.tenant_id, m.pagamento_id, m.funcionario_id, m.mensagem
             FROM bot_mensagens_pendentes m
             INNER JOIN pagamentos p
                ON p.id = m.pagamento_id
               AND p.tenant_id = m.tenant_id
            WHERE m.tenant_id = ?
              AND m.funcionario_id = ?
              AND m.status = 'enviado'
              AND COALESCE(p.flg_vld_funcionario, 0) = 0
            ORDER BY m.created_at DESC
            LIMIT 1`,
          [contexto.tenantId, contexto.funcionario.id]
        );
        mensagemReferencia = ultimasPendentes[0] || null;
      } else {
        // LID fallback: infer employee by pushName when available.
        const pushName = String(msg?.pushName || '').trim();
        if (pushName) {
          const porNome = await query(
            `SELECT m.id, m.tenant_id, m.pagamento_id, m.funcionario_id, m.mensagem
               FROM bot_mensagens_pendentes m
               INNER JOIN pagamentos p
                  ON p.id = m.pagamento_id
                 AND p.tenant_id = m.tenant_id
               INNER JOIN funcionarios f
                  ON f.id = m.funcionario_id
                 AND f.tenant_id = m.tenant_id
              WHERE m.status = 'enviado'
                AND COALESCE(p.flg_vld_funcionario, 0) = 0
                AND (
                  LOWER(f.nome) = LOWER(?)
                  OR LOWER(f.nome) LIKE LOWER(?)
                )
              ORDER BY m.created_at DESC
              LIMIT 1`,
            [pushName, `%${pushName}%`]
          );
          mensagemReferencia = porNome[0] || null;
        }

        // Final fallback requested by product rule: assume latest unresolved notification.
        if (!mensagemReferencia) {
          const candidatas = await query(
            `SELECT m.id, m.tenant_id, m.pagamento_id, m.funcionario_id, m.mensagem
               FROM bot_mensagens_pendentes m
               INNER JOIN pagamentos p
                  ON p.id = m.pagamento_id
                 AND p.tenant_id = m.tenant_id
              WHERE m.status = 'enviado'
                AND COALESCE(p.flg_vld_funcionario, 0) = 0
              ORDER BY m.created_at DESC
              LIMIT 1`
          );

          if (candidatas.length > 0) {
            mensagemReferencia = candidatas[0];
          }
        }
      }
    }

    if (mensagemReferencia) {
      await query(
        'UPDATE pagamentos SET flg_vld_funcionario = ? WHERE id = ? AND tenant_id = ?',
        [decisaoResposta, mensagemReferencia.pagamento_id, mensagemReferencia.tenant_id]
      );
      await query(
        'UPDATE bot_mensagens_pendentes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [mensagemReferencia.id]
      );

      await sock.sendMessage(msg.key.remoteJid, {
        text: decisaoResposta === 1
          ? '✅ Aprovação registrada! Obrigado.'
          : '❌ Desaprovação registrada. O gestor será avisado.'
      });
      return true;
    }

    if (!contexto) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: 'Não consegui vincular sua resposta ao pagamento. Se possível, responda usando a função Responder na mensagem recebida.'
      });
      return true;
    }
  } catch (validError) {
    console.error('[BOT_NOTIF] Erro ao validar pagamento:', validError.message || validError);
  }

  return false;
}

async function registrarEventoRecebido({ tenantId, funcionarioId, messageId, evento, detalhes = {} }) {
  try {
    const resultado = await query(
      `INSERT IGNORE INTO bot_jornada_eventos
        (id, tenant_id, funcionario_id, message_id, evento, payload)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), tenantId, funcionarioId, messageId, evento, JSON.stringify(detalhes)]
    );

    return Boolean(resultado?.affectedRows);
  } catch (error) {
    console.error('[BOT_LOG_WARN] Falha ao registrar evento recebido:', error.message || error);
    return true;
  }
}

async function vincularEventoSessao({ tenantId, messageId, sessaoId, evento, etapaAnterior, etapaNova, detalhes = {} }) {
  try {
    await query(
      `UPDATE bot_jornada_eventos
          SET sessao_id = ?, evento = ?, etapa_anterior = ?, etapa_nova = ?, payload = ?
        WHERE tenant_id = ? AND message_id = ?`,
      [sessaoId, evento, etapaAnterior || null, etapaNova || null, JSON.stringify(detalhes), tenantId, messageId]
    );
  } catch (error) {
    console.error('[BOT_LOG_WARN] Falha ao vincular evento à sessão:', error.message || error);
  }
}

async function salvarSessaoBot(sessaoId, tenantId, atualizacoes = {}) {
  const campos = [];
  const valores = [];

  const adicionar = (coluna, valor) => {
    if (valor === undefined) {
      return;
    }

    campos.push(`${coluna} = ?`);
    valores.push(valor);
  };

  adicionar('status', atualizacoes.status);
  adicionar('etapa_atual', atualizacoes.etapaAtual);
  adicionar('obra_id', atualizacoes.obraId);
  adicionar('obra_label', atualizacoes.obraLabel);
  adicionar('checkin_at', atualizacoes.checkinAt);
  adicionar('checkout_at', atualizacoes.checkoutAt);
  adicionar('duracao_minutos', atualizacoes.duracaoMinutos);
  adicionar('almoco_minutos', atualizacoes.almocoMinutos);
  adicionar('localizacao_json', atualizacoes.localizacaoJson);
  adicionar('ultima_mensagem_id', atualizacoes.ultimaMensagemId);
  adicionar('ultima_mensagem_texto', atualizacoes.ultimaMensagemTexto);
  adicionar('ultimo_evento', atualizacoes.ultimoEvento);
  adicionar('finalizada_em', atualizacoes.finalizadaEm);

  if (atualizacoes.telefone !== undefined) {
    adicionar('telefone', atualizacoes.telefone);
  }

  if (campos.length === 0) {
    return;
  }

  valores.push(sessaoId, tenantId);

  try {
    await query(
      `UPDATE bot_jornada_sessoes
          SET ${campos.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND tenant_id = ?`,
      valores
    );
  } catch (error) {
    console.error('[BOT_LOG_WARN] Falha ao salvar sessão:', error.message || error);
  }
}

async function carregarSessaoAtiva(tenantId, funcionarioId) {
  try {
    const rows = await query(
      `SELECT *
         FROM bot_jornada_sessoes
        WHERE tenant_id = ?
          AND funcionario_id = ?
          AND finalizada_em IS NULL
        ORDER BY created_at DESC
        LIMIT 1`,
      [tenantId, funcionarioId]
    );

    return rows[0] || null;
  } catch (error) {
    console.error('[BOT_LOG_WARN] Falha ao carregar sessão ativa:', error.message || error);
    return null;
  }
}

async function criarSessaoBot({ contexto, from, msg, etapaAtual = 'aberta' }) {
  const sessaoId = crypto.randomUUID();
  const messageId = getMessageId(msg);

  try {
    await query(
      `INSERT INTO bot_jornada_sessoes
        (id, tenant_id, funcionario_id, telefone, mensagem_inicio_id, status, etapa_atual, ultima_mensagem_id, ultimo_evento, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        sessaoId,
        contexto.tenantId,
        contexto.funcionario.id,
        from,
        messageId,
        etapaAtual,
        etapaAtual,
        messageId,
        'received',
      ]
    );
  } catch (error) {
    console.error('[BOT_LOG_WARN] Falha ao criar sessão:', error.message || error);
  }

  return {
    id: sessaoId,
    tenant_id: contexto.tenantId,
    funcionario_id: contexto.funcionario.id,
    telefone: from,
    mensagem_inicio_id: messageId,
    status: etapaAtual,
    etapa_atual: etapaAtual,
    obra_id: null,
    obra_label: null,
    checkin_at: null,
    checkout_at: null,
    duracao_minutos: null,
    almoco_minutos: null,
    localizacao_json: null,
  };
}

function estadoFromSessao(sessao, contexto) {
  if (!sessao) {
    return {
      fase: 'inicio',
      contexto,
    };
  }

  return {
    fase: sessao.etapa_atual || sessao.status || 'inicio',
    contexto,
    sessaoId: sessao.id,
    tenantId: sessao.tenant_id,
    funcionarioId: sessao.funcionario_id,
    telefone: sessao.telefone,
    obraId: sessao.obra_id,
    obraLabel: sessao.obra_label,
    checkin: sessao.checkin_at ? new Date(sessao.checkin_at) : null,
    checkout: sessao.checkout_at ? new Date(sessao.checkout_at) : null,
    duracao: sessao.duracao_minutos ?? null,
    almocoMinutos: sessao.almoco_minutos ?? null,
    localizacao: (() => {
      const raw = parseMaybeJson(sessao.localizacao_json);
      if (!raw) return null;
      return raw.pendente ? null : raw;
    })(),
    localizacaoPendente: (() => {
      const raw = parseMaybeJson(sessao.localizacao_json);
      return raw?.pendente ?? null;
    })(),
    validacaoPendente: (() => {
      const raw = parseMaybeJson(sessao.localizacao_json);
      return raw?.validacao ?? null;
    })(),
  };
}

function buildHoraLiquidaFormatada(duracaoMinutos, almocoMinutos) {
  const totalMinutos = Math.max(0, Math.round(Number(duracaoMinutos) || 0));
  const pausaMinutos = Math.max(0, Math.round(Number(almocoMinutos) || 0));
  return formatMinutesAsClock(totalMinutos - pausaMinutos);
}

async function detectarSuporteLocalizacao() {
  if (suporteLocalizacaoCache) {
    return suporteLocalizacaoCache;
  }

  const rows = await query(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'obras'
       AND COLUMN_NAME IN ('lat', 'lng', 'raio', 'latitude', 'longitude', 'raio_metros')`
  );

  const colunas = new Set(rows.map((row) => row.COLUMN_NAME));
  const suporteLocalizacao = {
    hasCoordinates:
      (colunas.has('lat') && colunas.has('lng') && colunas.has('raio')) ||
      (colunas.has('latitude') && colunas.has('longitude') && (colunas.has('raio') || colunas.has('raio_metros'))),
    latField: colunas.has('lat') ? 'lat' : colunas.has('latitude') ? 'latitude' : null,
    lngField: colunas.has('lng') ? 'lng' : colunas.has('longitude') ? 'longitude' : null,
    raioField: colunas.has('raio') ? 'raio' : colunas.has('raio_metros') ? 'raio_metros' : null,
  };

  suporteLocalizacaoCache = suporteLocalizacao;
  return suporteLocalizacao;
}

async function detectarColunaPermiteCheckinForaRaio() {
  if (botPermiteCheckinForaRaioColumnExistsCache !== null) {
    return botPermiteCheckinForaRaioColumnExistsCache;
  }

  const rows = await query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tenants'
       AND COLUMN_NAME = 'bot_permite_checkin_fora_raio'
     LIMIT 1`
  );

  botPermiteCheckinForaRaioColumnExistsCache = rows.length > 0;
  return botPermiteCheckinForaRaioColumnExistsCache;
}

async function detectarColunaTimezoneCode() {
  if (tenantTimezoneCodeColumnExistsCache !== null) {
    return tenantTimezoneCodeColumnExistsCache;
  }

  const rows = await query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tenants'
       AND COLUMN_NAME = 'timezone_code'
     LIMIT 1`
  );

  tenantTimezoneCodeColumnExistsCache = rows.length > 0;
  return tenantTimezoneCodeColumnExistsCache;
}

async function detectarColunaWhatsappMessageId() {
  if (botMensagensWhatsappMessageIdColumnExistsCache !== null) {
    return botMensagensWhatsappMessageIdColumnExistsCache;
  }

  const rows = await query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'bot_mensagens_pendentes'
       AND COLUMN_NAME = 'whatsapp_message_id'
     LIMIT 1`
  );

  botMensagensWhatsappMessageIdColumnExistsCache = rows.length > 0;
  return botMensagensWhatsappMessageIdColumnExistsCache;
}

async function carregarContextoTelefone(telefone) {
  const telefoneNormalizado = normalizePhone(telefone);
  if (!telefoneNormalizado) return null;

  const funcionarios = await query(
    `SELECT id, tenant_id, nome, telefone, status, funcao
     FROM funcionarios
     WHERE telefone IS NOT NULL AND TRIM(telefone) <> ''`
  );

  const funcionario = funcionarios.find((row) => phonesMatch(row.telefone, telefoneNormalizado));
  if (!funcionario) {
    console.log(
      '[PHONE_LOOKUP_FAIL]',
      JSON.stringify({
        telefoneRecebido: telefone,
        telefoneNormalizado,
        totalFuncionarios: funcionarios.length,
        exemplos: funcionarios.slice(0, 5).map((row) => ({
          nome: row.nome,
          telefone: row.telefone,
        })),
      })
    );
    return null;
  }

  const suporteLocalizacao = await detectarSuporteLocalizacao();
  const hasPermiteCheckinForaRaio = await detectarColunaPermiteCheckinForaRaio();
  const hasTimezoneCode = await detectarColunaTimezoneCode();

  const obrasSql = suporteLocalizacao.hasCoordinates
    ? `SELECT o.id,
             o.tenant_id,
             o.nome,
             o.endereco,
             o.status,
             COALESCE(c.nome, '') AS cliente,
             o.${suporteLocalizacao.latField} AS lat,
             o.${suporteLocalizacao.lngField} AS lng,
             o.${suporteLocalizacao.raioField} AS raio
        FROM obras o
        LEFT JOIN clientes c ON c.id = o.cliente_id AND c.tenant_id = o.tenant_id
       WHERE o.tenant_id = ?
       ORDER BY o.nome`
    : `SELECT o.id,
             o.tenant_id,
             o.nome,
             o.endereco,
             o.status,
             COALESCE(c.nome, '') AS cliente
        FROM obras o
        LEFT JOIN clientes c ON c.id = o.cliente_id AND c.tenant_id = o.tenant_id
       WHERE o.tenant_id = ?
       ORDER BY o.nome`;

  const obras = await query(obrasSql, [funcionario.tenant_id]);

  let permiteCheckinForaRaio = false;
  let timezoneCode = 'America/Sao_Paulo';
  if (hasPermiteCheckinForaRaio || hasTimezoneCode) {
    const selectFields = [];
    if (hasPermiteCheckinForaRaio) {
      selectFields.push('COALESCE(bot_permite_checkin_fora_raio, 0) AS permite');
    }
    if (hasTimezoneCode) {
      selectFields.push("COALESCE(timezone_code, 'America/Sao_Paulo') AS timezone_code");
    }

    const tenantRows = await query(
      `SELECT ${selectFields.join(', ')}
         FROM tenants
        WHERE id = ?
        LIMIT 1`,
      [funcionario.tenant_id]
    );

    if (hasPermiteCheckinForaRaio) {
      permiteCheckinForaRaio = Boolean(Number(tenantRows[0]?.permite || 0));
    }

    if (hasTimezoneCode) {
      timezoneCode = String(tenantRows[0]?.timezone_code || '').trim() || 'America/Sao_Paulo';
    }
  }

  const funcionariosTenant = await query(
    `SELECT id, tenant_id, nome, telefone, status, funcao
     FROM funcionarios
     WHERE tenant_id = ?
     ORDER BY nome`,
    [funcionario.tenant_id]
  );

  return {
    tenantId: funcionario.tenant_id,
    funcionario,
    obras,
    funcionarios: funcionariosTenant,
    suporteLocalizacao,
    permiteCheckinForaRaio,
    timezoneCode,
  };
}

function calcularDistancia(lat1, lng1, lat2, lng2) {
  const distance = geolib.getDistance(
    { latitude: lat1, longitude: lng1 },
    { latitude: lat2, longitude: lng2 }
  );
  return distance;
}

function fmtMetros(metros) {
  if (metros >= 1000) {
    return `${(metros / 1000).toFixed(2).replace('.', ',')} km`;
  }
  return `${Math.round(metros)} m`;
}

function formatarDataHoraUsuario(value, timezoneCode) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const options = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  };

  try {
    return date.toLocaleString('pt-BR', {
      ...options,
      timeZone: timezoneCode || 'America/Sao_Paulo',
    });
  } catch {
    return date.toLocaleString('pt-BR', options);
  }
}

function validarLocalizacao(usuarioLat, usuarioLng, obraLat, obraLng, raio) {
  const distancia = calcularDistancia(usuarioLat, usuarioLng, obraLat, obraLng, raio);
  const desvio = Math.max(0, Math.round(distancia) - Math.round(raio));
  return {
    valido: distancia <= raio,
    distancia: Math.round(distancia),
    raio: raio,
    desvio,
  };
}

async function registrarCheckin({ from, msg, estado, obra, localizacao, validacao, messageId, divergencia = false }) {
  const checkin = new Date();
  const obraLabel = buildObraLabel(obra);

  estado.fase = 'trabalhando';
  estado.obraId = obra.id;
  estado.obraLabel = obraLabel;
  estado.checkin = checkin;
  estado.localizacao = localizacao || null;
  estado.funcionarioId = estado.contexto.funcionario.id;
  estado.tenantId = estado.contexto.tenantId;
  estado.sessaoId = estado.sessaoId || null;

  if (estado.sessaoId) {
    await salvarSessaoBot(estado.sessaoId, estado.contexto.tenantId, {
      status: 'trabalhando',
      etapaAtual: 'trabalhando',
      obraId: obra.id,
      obraLabel,
      checkinAt: checkin,
      localizacaoJson: localizacao ? JSON.stringify(localizacao) : null,
      ultimaMensagemId: messageId,
      ultimoEvento: 'checkin',
    });

    await vincularEventoSessao({
      tenantId: estado.contexto.tenantId,
      messageId,
      sessaoId: estado.sessaoId,
      evento: 'checkin',
      etapaAnterior: 'confirmando_localizacao',
      etapaNova: 'trabalhando',
      detalhes: {
        obraId: obra.id,
        obraLabel,
        localizacao,
        validacao,
      },
    });
  }

  if (divergencia && localizacao && validacao) {
    try {
      await query(
        `INSERT INTO bot_checkin_divergencias
           (id, tenant_id, sessao_id, funcionario_id, obra_id, lat, lng, distancia_metros, raio_metros, desvio_metros)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          estado.contexto.tenantId,
          estado.sessaoId || null,
          estado.contexto.funcionario.id,
          obra.id,
          localizacao.lat,
          localizacao.lng,
          validacao.distancia,
          validacao.raio,
          validacao.desvio,
        ]
      );
    } catch (error) {
      console.error('[BOT_LOG_WARN] Falha ao registrar divergência:', error.message || error);
    }
  }

  console.log(`CHECK-IN: ${from} entrou na obra ${obraLabel} às ${checkin.toISOString()}`);
  if (validacao) {
    console.log(`Localização: ${localizacao.lat.toFixed(4)}, ${localizacao.lng.toFixed(4)} - Distância da obra: ${validacao.distancia}m${divergencia ? ' [DIVERGÊNCIA]' : ''}`);
  }

  const horarioFormatado = formatarDataHoraUsuario(checkin, estado.contexto?.timezoneCode);

  const mensagem = divergencia
    ? `⚠️ Check-in registrado com divergência de localização.\n📍 Você estava a ${fmtMetros(validacao.distancia)} da obra (raio: ${fmtMetros(validacao.raio)})\n\n🏢 Obra: ${obraLabel}\n⏰ Horário: ${horarioFormatado}\n\nDigite *1* para fazer o checkout.`
    : validacao
      ? `✅ Check-in registrado com sucesso!\n📍 Localização confirmada (${fmtMetros(validacao.distancia)} da obra)\n\n🏢 Obra: ${obraLabel}\n⏰ Horário: ${horarioFormatado}\n\nDigite *1* para fazer o checkout.`
      : `✅ Check-in registrado com sucesso!\n\n🏢 Obra: ${obraLabel}\n⏰ Horário: ${horarioFormatado}\n\nDigite *1* para fazer o checkout.`;

  return sock.sendMessage(msg.key.remoteJid, { text: mensagem });
}

let sock = null;
let notifInterval = null;
let forceNewQrConsumed = false;

async function processarMensagensPendentes() {
  if (!sock) return;
  try {
    const hasWhatsappMessageId = await detectarColunaWhatsappMessageId();
    const pendentes = await query(
      `SELECT m.*, f.telefone, f.nome AS func_nome
         FROM bot_mensagens_pendentes m
         LEFT JOIN funcionarios f ON f.id = m.funcionario_id AND f.tenant_id = m.tenant_id
        WHERE m.status = 'pendente' AND m.tentativas < 3
        ORDER BY m.created_at ASC
        LIMIT 10`
    );
    for (const msg_p of pendentes) {
      if (!msg_p.telefone) {
        await query(
          "UPDATE bot_mensagens_pendentes SET status = 'erro', ultimo_erro = 'Funcionario sem telefone', tentativas = tentativas + 1 WHERE id = ?",
          [msg_p.id]
        );
        continue;
      }
      const phone = normalizePhone(msg_p.telefone);
      const jid = `${phone}@s.whatsapp.net`;
      try {
        const sent = await sock.sendMessage(jid, { text: msg_p.mensagem });
        const whatsappMessageId = String(sent?.key?.id || '').trim() || null;
        if (hasWhatsappMessageId) {
          await query(
            "UPDATE bot_mensagens_pendentes SET status = 'enviado', whatsapp_message_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [whatsappMessageId, msg_p.id]
          );
        } else {
          await query(
            "UPDATE bot_mensagens_pendentes SET status = 'enviado', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [msg_p.id]
          );
        }
        await query(
          'UPDATE pagamentos SET flg_envio_funcionario = 1 WHERE id = ? AND tenant_id = ?',
          [msg_p.pagamento_id, msg_p.tenant_id]
        );
        console.log(`[BOT_NOTIF] Mensagem enviada para ${phone} (pagamento ${msg_p.pagamento_id}, whatsappMessageId=${whatsappMessageId || 'n/a'})`);
      } catch (sendError) {
        await query(
          "UPDATE bot_mensagens_pendentes SET status = IF(tentativas + 1 >= 3, 'erro', 'pendente'), ultimo_erro = ?, tentativas = tentativas + 1 WHERE id = ?",
          [sendError.message || 'Erro desconhecido', msg_p.id]
        );
      }
    }
  } catch (error) {
    console.error('[BOT_NOTIF] Erro ao processar mensagens pendentes:', error.message || error);
  }
}

async function connectToWhatsApp() {
  if (shouldRunSchemaBootstrap()) {
    await ensureBotLoggingSchema();
  } else {
    console.log('[BOT_SCHEMA] Auto schema bootstrap desativado. Usando schema existente.');
  }

  const suporteLoc = await detectarSuporteLocalizacao();
  if (suporteLoc.hasCoordinates) {
    console.log(`[BOT_CONFIG] Validação de localização ATIVA (lat=${suporteLoc.latField}, lng=${suporteLoc.lngField}, raio=${suporteLoc.raioField})`);
  } else {
    console.log('[BOT_CONFIG] Validação de localização INATIVA — colunas lat/lng/raio não encontradas na tabela obras.');
  }

  const authDir = getAuthDir();
  if (!forceNewQrConsumed && shouldForceNewQrOnStart()) {
    try {
      fs.rmSync(authDir, { recursive: true, force: true });
      console.log('[BOT_AUTH] Sessão removida para forçar novo QR no start.');
    } catch (error) {
      console.error('[BOT_AUTH] Falha ao limpar auth dir:', error.message || error);
    }
    forceNewQrConsumed = true;
  }

  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('Gerando QR Code para autenticação...');
      try {
        const qrImagePath = path.join(authDir, 'whatsapp-qr.png');
        const qrCodeUrl = await qrcode.toDataURL(qr);
        await qrcode.toFile(qrImagePath, qr, { margin: 2, scale: 8 });
        console.log('Escaneie o QR code abaixo para conectar o bot:');
        console.log(`QR salvo em: ${qrImagePath}`);
        qrcode.toString(qr, { type: 'terminal', small: true }, (err, QRstring) => {
          if (!err) console.log(QRstring);
        });
      } catch (err) {
        console.log('QR Code:', qr);
      }
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Conexão fechada. Reconectando:', shouldReconnect);
      if (shouldReconnect) {
        setTimeout(() => connectToWhatsApp(), 3000);
      }
    } else if (connection === 'open') {
      console.log('✅ Bot WhatsApp conectado com sucesso!');
      if (!notifInterval) {
        notifInterval = setInterval(processarMensagensPendentes, 30000);
        console.log('[BOT_NOTIF] Polling de notificações ativo (30s).');
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    try {
      console.log('[MESSAGE_IN]', JSON.stringify(getSenderDebugInfo(msg)));

      const from = getSenderPhone(msg);
      if (!from) return;
      const messageId = getMessageId(msg);
      
      let texto = '';
      let localizacao = null;

      if (msg.message.conversation) {
        texto = msg.message.conversation.trim().toLowerCase();
      } else if (msg.message.extendedTextMessage?.text) {
        texto = msg.message.extendedTextMessage.text.trim().toLowerCase();
      } else if (msg.message.locationMessage) {
        localizacao = {
          lat: msg.message.locationMessage.degreesLatitude,
          lng: msg.message.locationMessage.degreesLongitude,
          accuracy: msg.message.locationMessage.accuracyInMeters || 0
        };
        texto = 'localizacao';
      }

      if (!texto && !localizacao) return;

      if (await processarRespostaNotificacao({ msg, texto, contexto: null })) {
        return;
      }

      const contexto = await carregarContextoTelefone(from);
      if (!contexto) {
        await sock.sendMessage(msg.key.remoteJid, {
          text: 'Este número não está cadastrado no Travaux. Procure o seu gestor para resolver.'
        });
        return;
      }

      const eventoGuardado = await registrarEventoRecebido({
        tenantId: contexto.tenantId,
        funcionarioId: contexto.funcionario.id,
        messageId,
        evento: localizacao ? 'location_received' : 'message_received',
        detalhes: {
          from,
          texto,
          localizacao,
        },
      });

      let estado = estados.get(from);

      if (!eventoGuardado) {
        if (localizacao) {
          // Localização duplicada ainda deve ser processada — segue o fluxo normalmente
        } else if (/^bom dia\b/.test(texto)) {
          const sessaoAtiva = await carregarSessaoAtiva(contexto.tenantId, contexto.funcionario.id);
          if (!sessaoAtiva) {
            estado = estadoFromSessao(await criarSessaoBot({ contexto, from, msg, etapaAtual: 'escolhendo_obra' }), contexto);
            estados.set(from, estado);
          } else {
            return;
          }
        } else {
          return;
        }
      }

      if (!estado || estado.contexto?.tenantId !== contexto.tenantId) {
        const sessaoAtiva = await carregarSessaoAtiva(contexto.tenantId, contexto.funcionario.id);
        estado = estadoFromSessao(sessaoAtiva, contexto);
      } else {
        estado.contexto = contexto;
      }

      estados.set(from, estado);

      // FASE: Localização
      if (localizacao && estado.fase === 'confirmando_localizacao' && estado.contexto.suporteLocalizacao.hasCoordinates) {
        const obra = estado.contexto.obras.find((o) => String(o.id) === String(estado.obraId));
        if (!obra) {
          await sock.sendMessage(msg.key.remoteJid, {
            text: 'Não encontrei a obra selecionada. Envie "Bom dia" para recomeçar.'
          });
          return;
        }

        const validacao = validarLocalizacao(localizacao.lat, localizacao.lng, obra.lat, obra.lng, obra.raio);

        if (validacao.valido) {
          await registrarCheckin({ from, msg, estado, obra, localizacao, validacao, messageId });
          estados.set(from, estado);
          return;
        } else {
          if (!estado.contexto.permiteCheckinForaRaio) {
            if (estado.sessaoId) {
              await salvarSessaoBot(estado.sessaoId, estado.contexto.tenantId, {
                status: 'confirmando_localizacao',
                etapaAtual: 'confirmando_localizacao',
                ultimaMensagemId: messageId,
                ultimoEvento: 'location_out_of_radius_blocked',
              });
              await vincularEventoSessao({
                tenantId: estado.contexto.tenantId,
                messageId,
                sessaoId: estado.sessaoId,
                evento: 'location_out_of_radius_blocked',
                etapaAnterior: 'confirmando_localizacao',
                etapaNova: 'confirmando_localizacao',
                detalhes: { localizacao, validacao, obraId: obra.id },
              });
            }

            await sock.sendMessage(msg.key.remoteJid, {
              text: `⚠️ Você está fora do raio da obra.\n\n📍 Sua distância: ${fmtMetros(validacao.distancia)}\n✅ Raio permitido: ${fmtMetros(validacao.raio)}\n↗️ Desvio: ${fmtMetros(validacao.desvio)} além do limite\n\nCompartilhe novamente sua localização atual.`
            });
            return;
          }

          estado.localizacaoPendente = localizacao;
          estado.validacaoPendente = validacao;
          estado.fase = 'confirmando_divergencia_localizacao';
          if (estado.sessaoId) {
            await salvarSessaoBot(estado.sessaoId, estado.contexto.tenantId, {
              status: 'confirmando_divergencia_localizacao',
              etapaAtual: 'confirmando_divergencia_localizacao',
              localizacaoJson: JSON.stringify({ pendente: localizacao, validacao }),
              ultimaMensagemId: messageId,
              ultimoEvento: 'location_divergencia',
            });
            await vincularEventoSessao({
              tenantId: estado.contexto.tenantId,
              messageId,
              sessaoId: estado.sessaoId,
              evento: 'location_divergencia',
              etapaAnterior: 'confirmando_localizacao',
              etapaNova: 'confirmando_divergencia_localizacao',
              detalhes: { localizacao, validacao, obraId: obra.id },
            });
          }
          estados.set(from, estado);
          await sock.sendMessage(msg.key.remoteJid, {
            text: `⚠️ Você está fora do raio da obra!\n\n📍 Sua distância: ${fmtMetros(validacao.distancia)}\n✅ Raio permitido: ${fmtMetros(validacao.raio)}\n↗️ Desvio: ${fmtMetros(validacao.desvio)} além do limite\n\n🏢 Obra: ${estado.obraLabel}\n\nEssa é a obra certa? Deseja confirmar o check-in mesmo assim?\n\n✅ *sim* - Confirmar mesmo distante\n❌ *não* - Escolher outra obra`
          });
          return;
        }
      }

      // FASE: Confirmando divergência de localização
      if (estado.fase === 'confirmando_divergencia_localizacao') {
        const obra = estado.contexto.obras.find((o) => String(o.id) === String(estado.obraId));
        if (texto === 'sim') {
          const localizacaoPendente = estado.localizacaoPendente;
          const validacaoPendente = estado.validacaoPendente;
          await registrarCheckin({ from, msg, estado, obra, localizacao: localizacaoPendente, validacao: validacaoPendente, messageId, divergencia: true });
          estados.set(from, estado);
          return;
        } else if (texto === 'não' || texto === 'nao') {
          estado.fase = 'escolhendo_obra';
          estado.localizacaoPendente = null;
          estado.validacaoPendente = null;
          if (estado.sessaoId) {
            await salvarSessaoBot(estado.sessaoId, estado.contexto.tenantId, {
              status: 'escolhendo_obra',
              etapaAtual: 'escolhendo_obra',
              localizacaoJson: null,
              ultimaMensagemId: messageId,
              ultimoEvento: 'divergencia_rejected',
            });
            await vincularEventoSessao({
              tenantId: estado.contexto.tenantId,
              messageId,
              sessaoId: estado.sessaoId,
              evento: 'divergencia_rejected',
              etapaAnterior: 'confirmando_divergencia_localizacao',
              etapaNova: 'escolhendo_obra',
              detalhes: { obraId: estado.obraId },
            });
          }
          estados.set(from, estado);
          const listaObras = estado.contexto.obras
            .map((o, i) => `*${i+1}* - ${o.nome}${o.cliente ? ` (${o.cliente})` : ''}`)
            .join('\n');
          await sock.sendMessage(msg.key.remoteJid, { text: `Em qual obra?\n\n${listaObras}` });
          return;
        } else {
          await sock.sendMessage(msg.key.remoteJid, {
            text: `Responda *sim* para confirmar o check-in ou *não* para escolher outra obra.`
          });
          return;
        }
      }

      // FASE: Bom dia (aceita em qualquer fase para reiniciar)
      if (/^bom dia\b/.test(texto)) {
        const contexto = estado.contexto;
        if (!contexto.obras || contexto.obras.length === 0) {
          await sock.sendMessage(msg.key.remoteJid, {
            text: 'Não encontrei obras cadastradas. Procure o seu gestor.'
          });
          return;
        }

        if (estado.fase === 'trabalhando' || estado.fase === 'selecionando_almoco') {
          await sock.sendMessage(msg.key.remoteJid, {
            text: 'Você já está com uma jornada aberta. Digite *1* para fazer o checkout.'
          });
          return;
        }

        if (!estado.sessaoId) {
          const sessao = await criarSessaoBot({ contexto, from, msg, etapaAtual: 'escolhendo_obra' });
          estado = estadoFromSessao(sessao, contexto);
        }

        estado.fase = 'escolhendo_obra';
        estado.contexto = contexto;
        await salvarSessaoBot(estado.sessaoId, contexto.tenantId, {
          status: 'escolhendo_obra',
          etapaAtual: 'escolhendo_obra',
          ultimaMensagemId: messageId,
          ultimaMensagemTexto: texto,
          ultimoEvento: 'start',
        });
        await vincularEventoSessao({
          tenantId: contexto.tenantId,
          messageId,
          sessaoId: estado.sessaoId,
          evento: 'start',
          etapaAnterior: 'inicio',
          etapaNova: 'escolhendo_obra',
          detalhes: {
            texto,
          },
        });
        estados.set(from, estado);

        const listaObras = contexto.obras
          .map((obra, i) => `*${i+1}* - ${obra.nome}${obra.cliente ? ` (${obra.cliente})` : ''}`)
          .join('\n');

        const msg_texto = `Bom dia ${contexto.funcionario.nome}! 👋\n\nEm qual obra você está hoje?\n\n${listaObras}`;
        await sock.sendMessage(msg.key.remoteJid, { text: msg_texto });
        return;
      }

      // FASE: Escolhendo obra
      if (estado.fase === 'escolhendo_obra') {
        const indice = parseInt(texto, 10);
        if (isNaN(indice) || indice < 1 || indice > estado.contexto.obras.length) {
          await sock.sendMessage(msg.key.remoteJid, {
            text: 'Número inválido. Digite o número da obra.'
          });
          return;
        }

        const obra = estado.contexto.obras[indice - 1];
        estado.obraId = obra.id;
        estado.obraLabel = buildObraLabel(obra);
        estado.fase = 'confirmando_obra';
        if (!estado.sessaoId) {
          const sessao = await criarSessaoBot({ contexto: estado.contexto, from, msg, etapaAtual: 'escolhendo_obra' });
          estado = estadoFromSessao(sessao, estado.contexto);
          estado.obraId = obra.id;
          estado.obraLabel = buildObraLabel(obra);
          estado.fase = 'confirmando_obra';
        }

        await salvarSessaoBot(estado.sessaoId, estado.contexto.tenantId, {
          status: 'confirmando_obra',
          etapaAtual: 'confirmando_obra',
          obraId: obra.id,
          obraLabel: estado.obraLabel,
          ultimaMensagemId: messageId,
          ultimaMensagemTexto: texto,
          ultimoEvento: 'obra_selected',
        });
        await vincularEventoSessao({
          tenantId: estado.contexto.tenantId,
          messageId,
          sessaoId: estado.sessaoId,
          evento: 'obra_selected',
          etapaAnterior: 'escolhendo_obra',
          etapaNova: 'confirmando_obra',
          detalhes: {
            obraId: obra.id,
            obraLabel: estado.obraLabel,
          },
        });
        estados.set(from, estado);

        const msg_confirmacao = `Confirmou que está em:\n\n🏢 *${estado.obraLabel}*\n\n*SIM* - Confirmar\n*OUTRO* - Escolher outra`;
        await sock.sendMessage(msg.key.remoteJid, { text: msg_confirmacao });
        return;
      }

      // FASE: Confirmando obra
      if (estado.fase === 'confirmando_obra') {
        if (texto === 'sim') {
          const obra = estado.contexto.obras.find((o) => String(o.id) === String(estado.obraId));
          
          if (!estado.contexto.suporteLocalizacao.hasCoordinates) {
            estado.fase = 'trabalhando';
            estado.funcionarioId = estado.contexto.funcionario.id;
            estado.tenantId = estado.contexto.tenantId;
            estado.checkin = new Date();
            estados.set(from, estado);

            await registrarCheckin({ from, msg, estado, obra, localizacao: null, validacao: null, messageId });
            return;
          }

          estado.fase = 'confirmando_localizacao';
          if (estado.sessaoId) {
            await salvarSessaoBot(estado.sessaoId, estado.contexto.tenantId, {
              status: 'confirmando_localizacao',
              etapaAtual: 'confirmando_localizacao',
              ultimaMensagemId: messageId,
              ultimaMensagemTexto: texto,
              ultimoEvento: 'location_requested',
            });
            await vincularEventoSessao({
              tenantId: estado.contexto.tenantId,
              messageId,
              sessaoId: estado.sessaoId,
              evento: 'location_requested',
              etapaAnterior: 'confirmando_obra',
              etapaNova: 'confirmando_localizacao',
              detalhes: {
                obraId: obra.id,
                obraLabel: estado.obraLabel,
              },
            });
          }
          estados.set(from, estado);

          await sock.sendMessage(msg.key.remoteJid, {
            text: `Compartilhe sua localização atual`
          });
          return;
        } else if (texto === 'outro') {
          estado.fase = 'escolhendo_obra';
          if (estado.sessaoId) {
            await salvarSessaoBot(estado.sessaoId, estado.contexto.tenantId, {
              status: 'escolhendo_obra',
              etapaAtual: 'escolhendo_obra',
              ultimaMensagemId: messageId,
              ultimaMensagemTexto: texto,
              ultimoEvento: 'choose_other',
            });
            await vincularEventoSessao({
              tenantId: estado.contexto.tenantId,
              messageId,
              sessaoId: estado.sessaoId,
              evento: 'choose_other',
              etapaAnterior: 'confirmando_obra',
              etapaNova: 'escolhendo_obra',
              detalhes: {
                obraId: estado.obraId,
              },
            });
          }
          estados.set(from, estado);

          const listaObras = estado.contexto.obras
            .map((obra, i) => `*${i+1}* - ${obra.nome}${obra.cliente ? ` (${obra.cliente})` : ''}`)
            .join('\n');

          await sock.sendMessage(msg.key.remoteJid, { text: `Em qual obra?\n\n${listaObras}` });
          return;
        } else {
          await sock.sendMessage(msg.key.remoteJid, {
            text: 'Digite *SIM* ou *OUTRO*'
          });
          return;
        }
      }

      // FASE: Checkout
      if (texto === '1' && estado.fase === 'trabalhando') {
        const checkout = new Date();
        const duracaoMinutos = Math.round((checkout - estado.checkin) / 60000);

        estado.fase = 'selecionando_almoco';
        estado.checkout = checkout;
        estado.duracao = duracaoMinutos;
        if (estado.sessaoId) {
          await salvarSessaoBot(estado.sessaoId, estado.contexto.tenantId, {
            status: 'selecionando_almoco',
            etapaAtual: 'selecionando_almoco',
            checkoutAt: checkout,
            duracaoMinutos,
            ultimaMensagemId: messageId,
            ultimaMensagemTexto: texto,
            ultimoEvento: 'checkout_started',
          });
          await vincularEventoSessao({
            tenantId: estado.contexto.tenantId,
            messageId,
            sessaoId: estado.sessaoId,
            evento: 'checkout_started',
            etapaAnterior: 'trabalhando',
            etapaNova: 'selecionando_almoco',
            detalhes: {
              duracaoMinutos,
              obraId: estado.obraId,
            },
          });
        }
        estados.set(from, estado);

        const opcoes = ALMOCO_OPTIONS
          .map((opt, i) => `*${i+1}* - ${opt.label}`)
          .join('\n');

        await sock.sendMessage(msg.key.remoteJid, { text: `Tempo de almoço?\n\n${opcoes}` });
        return;
      }

      // FASE: Almoço
      if (estado.fase === 'selecionando_almoco') {
        const indice = parseInt(texto, 10);
        if (isNaN(indice) || indice < 1 || indice > ALMOCO_OPTIONS.length) {
          await sock.sendMessage(msg.key.remoteJid, {
            text: 'Número inválido.'
          });
          return;
        }

        const almocoMinutos = ALMOCO_OPTIONS[indice - 1].value;
        
        try {
          const horaLiquidaMinutos = Math.max(0, (Number(estado.duracao) || 0) - almocoMinutos);
          const horaLiquida = horaLiquidaMinutos / 60;
          const horasFormatada = formatMinutesAsClock(horaLiquidaMinutos);
          
          await query(
            `INSERT INTO horas_trabalhadas 
             (id, tenant_id, obra_id, funcionario_id, entrada, saida, almoco_minutos, horas, bot_sessao_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               obra_id = VALUES(obra_id),
               funcionario_id = VALUES(funcionario_id),
               entrada = VALUES(entrada),
               saida = VALUES(saida),
               almoco_minutos = VALUES(almoco_minutos),
               horas = VALUES(horas)`,
            [
              estado.sessaoId || crypto.randomUUID(),
              estado.tenantId,
              estado.obraId,
              estado.funcionarioId,
              estado.checkin,
              estado.checkout,
              almocoMinutos,
              horaLiquida.toFixed(2),
              estado.sessaoId || null,
            ]
          );

          if (estado.sessaoId) {
            await salvarSessaoBot(estado.sessaoId, estado.contexto.tenantId, {
              status: 'finalizada',
              etapaAtual: 'finalizado',
              almocoMinutos,
              finalizadaEm: new Date(),
              ultimaMensagemId: messageId,
              ultimaMensagemTexto: texto,
              ultimoEvento: 'checkout_finalizado',
            });
            await vincularEventoSessao({
              tenantId: estado.contexto.tenantId,
              messageId,
              sessaoId: estado.sessaoId,
              evento: 'checkout_finalizado',
              etapaAnterior: 'selecionando_almoco',
              etapaNova: 'finalizado',
              detalhes: {
                almocoMinutos,
                horasLiquidasMinutos: horaLiquidaMinutos,
                obraId: estado.obraId,
              },
            });
          }

          console.log(`CHECKOUT: ${from} saiu de ${estado.obraLabel}`);
          console.log(`Duração: ${estado.duracao}min | Almoço: ${almocoMinutos}min | Líquido: ${horaLiquidaMinutos}min (${horasFormatada})`);

          const msg_fim = `✅ Registrado!\n\n🏢 ${estado.obraLabel}\n⏰ Entrada: ${formatarDataHoraUsuario(estado.checkin, estado.contexto?.timezoneCode)}\n⏰ Saída: ${formatarDataHoraUsuario(estado.checkout, estado.contexto?.timezoneCode)}\n🍽️ Almoço: ${almocoMinutos}min\n⏱️ Horas (hh:mm): ${horasFormatada}\n\nDigite *Bom dia* para novo check-in.`;

          await sock.sendMessage(msg.key.remoteJid, { text: msg_fim });
          
          estado.fase = 'finalizado';
          estados.set(from, estado);
          return;
        } catch (error) {
          console.error('Erro:', error);
          await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ Erro ao registrar. Procure o gestor.`
          });
          return;
        }
      }

      // Default
      if (estado.fase === 'trabalhando') {
        await sock.sendMessage(msg.key.remoteJid, {
          text: 'Digite *1* para fazer checkout.'
        });
        return;
      }

      if (await processarRespostaNotificacao({ msg, texto, contexto })) {
        return;
      }

      await sock.sendMessage(msg.key.remoteJid, {
        text: 'Digite *Bom dia* para iniciar.'
      });

    } catch (error) {
      console.error('Erro:', error);
    }
  });
}

connectToWhatsApp();
