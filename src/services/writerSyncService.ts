import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  AiChatbotSettingsStore,
  AiProviderType,
  DEFAULT_AI_SETTINGS,
  DEFAULT_BUILTIN_SKILLS,
  SkillDocument,
  WriterSession,
} from '../components/admin/writer/types';
import {
  normalizeHybridPipeline,
  queueLegacyAiKeysForServerMigration,
  sanitizeWriterSession,
  stripSecretsFromAiSettings,
  syncServerAiKeysStatus,
} from '../lib/aiWriterClient';

export type CloudSyncState = 'connecting' | 'synced' | 'permission_denied' | 'error';

const PROVIDER_KEYS: readonly AiProviderType[] = [
  'perplexity',
  'gemini',
  'openai',
  'anthropic',
  'custom_openai',
];

function isPermissionDeniedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code || '';
  const msg = (error as { message?: string }).message || '';
  return (
    code === 'permission-denied' ||
    msg.toLowerCase().includes('missing or insufficient permissions')
  );
}

export function normalizeAiSettings(
  parsed: Partial<AiChatbotSettingsStore> | null | undefined
): AiChatbotSettingsStore {
  if (!parsed || typeof parsed !== 'object') {
    return stripSecretsFromAiSettings(DEFAULT_AI_SETTINGS);
  }
  queueLegacyAiKeysForServerMigration(parsed.profiles);
  return stripSecretsFromAiSettings({
    activeProvider:
      parsed.activeProvider && PROVIDER_KEYS.includes(parsed.activeProvider)
        ? parsed.activeProvider
        : DEFAULT_AI_SETTINGS.activeProvider,
    hybridPipeline: normalizeHybridPipeline(parsed.hybridPipeline),
    profiles: {
      perplexity: {
        ...DEFAULT_AI_SETTINGS.profiles.perplexity,
        ...(parsed.profiles?.perplexity || {}),
        apiKey: '',
      },
      gemini: {
        ...DEFAULT_AI_SETTINGS.profiles.gemini,
        ...(parsed.profiles?.gemini || {}),
        apiKey: '',
      },
      openai: {
        ...DEFAULT_AI_SETTINGS.profiles.openai,
        ...(parsed.profiles?.openai || {}),
        apiKey: '',
      },
      anthropic: {
        ...DEFAULT_AI_SETTINGS.profiles.anthropic,
        ...(parsed.profiles?.anthropic || {}),
        apiKey: '',
      },
      custom_openai: {
        ...DEFAULT_AI_SETTINGS.profiles.custom_openai,
        ...(parsed.profiles?.custom_openai || {}),
        apiKey: '',
      },
    },
  });
}

export function mergeAiSettingsInitial(
  local: AiChatbotSettingsStore,
  cloud: AiChatbotSettingsStore
): { merged: AiChatbotSettingsStore; shouldPushBack: boolean } {
  queueLegacyAiKeysForServerMigration(local.profiles);
  queueLegacyAiKeysForServerMigration(cloud.profiles);
  return {
    merged: stripSecretsFromAiSettings(cloud),
    shouldPushBack: false,
  };
}

export function normalizeSkillList(parsed: unknown): SkillDocument[] {
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return DEFAULT_BUILTIN_SKILLS;
  }
  const sanitized: SkillDocument[] = parsed
    .filter((item): item is SkillDocument => Boolean(item && typeof item === 'object'))
    .map((item, idx) => ({
      id: typeof item.id === 'string' && item.id ? item.id : `skill_restored_${idx}`,
      name: typeof item.name === 'string' ? item.name : 'Untitled Skill',
      fileName: typeof item.fileName === 'string' ? item.fileName : 'skill.md',
      description: typeof item.description === 'string' ? item.description : '',
      content: typeof item.content === 'string' ? item.content : '',
      enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
      isBuiltIn: Boolean(item.isBuiltIn),
      updatedAt:
        typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
    }));

  if (sanitized.length === 0) return DEFAULT_BUILTIN_SKILLS;
  const existingIds = new Set(sanitized.map((s) => s.id));
  const missingBuiltIns = DEFAULT_BUILTIN_SKILLS.filter((b) => !existingIds.has(b.id));
  return [...sanitized, ...missingBuiltIns];
}

/**
 * First-time merge for skills:
 * Combines custom skills from local browser (e.g., created on Edge) with cloud skills,
 * picking the newer `updatedAt` when the same skill id exists on both sides.
 */
export function mergeSkillLibrariesInitial(
  local: SkillDocument[],
  cloud: SkillDocument[]
): { merged: SkillDocument[]; shouldPushBack: boolean } {
  const byId = new Map<string, SkillDocument>();
  for (const s of cloud) {
    byId.set(s.id, s);
  }

  let shouldPushBack = false;
  for (const localSkill of local) {
    const cloudSkill = byId.get(localSkill.id);
    if (!cloudSkill) {
      // Custom skill created locally on this browser
      if (!localSkill.isBuiltIn) {
        byId.set(localSkill.id, localSkill);
        shouldPushBack = true;
      }
      continue;
    }

    const localTime = Date.parse(localSkill.updatedAt || '') || 0;
    const cloudTime = Date.parse(cloudSkill.updatedAt || '') || 0;
    const isContentDifferent =
      localSkill.content !== cloudSkill.content ||
      localSkill.name !== cloudSkill.name ||
      localSkill.description !== cloudSkill.description;

    if (isContentDifferent && localTime > cloudTime) {
      byId.set(localSkill.id, localSkill);
      shouldPushBack = true;
    }
  }

  return {
    merged: normalizeSkillList(Array.from(byId.values())),
    shouldPushBack,
  };
}

export async function saveAiWriterSettingsToCloud(
  store: AiChatbotSettingsStore
): Promise<{ ok: boolean; permissionDenied?: boolean }> {
  queueLegacyAiKeysForServerMigration(store.profiles);
  const scrubbed = stripSecretsFromAiSettings(store);
  const ref = doc(db, 'settings', 'aiWriterSettings');
  // Embed hybridPipeline inside profilesJson to stay strictly within Firestore rules allowlist
  const profilesEnvelope = {
    ...scrubbed.profiles,
    __hybridPipeline: scrubbed.hybridPipeline,
  };
  const payload: Record<string, string> = {
    activeProvider: scrubbed.activeProvider,
    profilesJson: JSON.stringify(profilesEnvelope),
    updatedAt: new Date().toISOString(),
  };
  if (auth.currentUser?.uid) {
    payload.updatedByUid = auth.currentUser.uid;
  }

  try {
    await setDoc(ref, payload);
    return { ok: true };
  } catch (error) {
    return { ok: false, permissionDenied: isPermissionDeniedError(error) };
  }
}

export function subscribeAiWriterSettings(
  onData: (settings: AiChatbotSettingsStore | null) => void,
  onSyncState?: (state: CloudSyncState) => void
): () => void {
  const ref = doc(db, 'settings', 'aiWriterSettings');
  return onSnapshot(
    ref,
    (snap) => {
      onSyncState?.('synced');
      if (!snap.exists()) {
        onData(null);
        return;
      }
      try {
        const data = snap.data() as {
          activeProvider?: AiProviderType;
          profilesJson?: string;
        };
        const rawEnvelope = data.profilesJson ? JSON.parse(data.profilesJson) : {};
        const hybridPipeline =
          rawEnvelope && typeof rawEnvelope === 'object'
            ? rawEnvelope.__hybridPipeline
            : undefined;
        const hadCloudPlaintextKeys = queueLegacyAiKeysForServerMigration(rawEnvelope);
        const normalized = normalizeAiSettings({
          activeProvider: data.activeProvider,
          profiles: rawEnvelope,
          hybridPipeline,
        });
        if (hadCloudPlaintextKeys) {
          // Migrate any legacy plaintext keys to server vault and scrub from Firestore document
          void syncServerAiKeysStatus().then(() => {
            void saveAiWriterSettingsToCloud(normalized);
          });
        }
        onData(normalized);
      } catch {
        onData(null);
      }
    },
    (error) => {
      onSyncState?.(isPermissionDeniedError(error) ? 'permission_denied' : 'error');
    }
  );
}

export async function saveAiWriterSkillsToCloud(
  skills: SkillDocument[]
): Promise<{ ok: boolean; permissionDenied?: boolean }> {
  const ref = doc(db, 'settings', 'aiWriterSkills');
  const payload: Record<string, string> = {
    skillsJson: JSON.stringify(skills),
    updatedAt: new Date().toISOString(),
  };
  if (auth.currentUser?.uid) {
    payload.updatedByUid = auth.currentUser.uid;
  }

  try {
    await setDoc(ref, payload);
    return { ok: true };
  } catch (error) {
    console.warn('Could not sync AI skills to cloud:', error);
    return { ok: false, permissionDenied: isPermissionDeniedError(error) };
  }
}

export function subscribeAiWriterSkills(
  onData: (skills: SkillDocument[] | null) => void,
  onSyncState?: (state: CloudSyncState) => void
): () => void {
  const ref = doc(db, 'settings', 'aiWriterSkills');
  return onSnapshot(
    ref,
    (snap) => {
      onSyncState?.('synced');
      if (!snap.exists()) {
        onData(null);
        return;
      }
      try {
        const data = snap.data() as { skillsJson?: string };
        const parsed = data.skillsJson ? JSON.parse(data.skillsJson) : null;
        onData(normalizeSkillList(parsed));
      } catch {
        onData(null);
      }
    },
    (error) => {
      console.warn('AI skills cloud subscription error:', error);
      onSyncState?.(isPermissionDeniedError(error) ? 'permission_denied' : 'error');
    }
  );
}

function sanitizeSessionForCloud(session: WriterSession): WriterSession {
  // Strip volatile generating states & cap undo stack so documents stay lean (< 800KB)
  return {
    ...session,
    batchStatus:
      session.batchStatus === 'outlining' ||
      session.batchStatus === 'writing_sections' ||
      session.batchStatus === 'queued'
        ? 'idle'
        : session.batchStatus,
    outline: session.outline.map((sec) => ({
      ...sec,
      status: sec.status === 'generating' ? 'idle' : sec.status,
    })),
    historyStack: (session.historyStack || []).slice(-5),
    historyIndex: Math.min(
      session.historyIndex,
      Math.max(-1, Math.min(5, (session.historyStack || []).length) - 1)
    ),
  };
}

export async function saveWriterSessionToCloud(
  session: WriterSession
): Promise<{ ok: boolean; permissionDenied?: boolean }> {
  if (!session.id || !/^[a-zA-Z0-9_-]{1,128}$/.test(session.id)) {
    return { ok: false };
  }
  const clean = sanitizeSessionForCloud(session);
  const payloadJson = JSON.stringify(clean);
  if (payloadJson.length > 790_000) {
    // Fallback: strip historyStack completely if document is very large
    clean.historyStack = [];
    clean.historyIndex = -1;
  }

  const finalJson = JSON.stringify(clean);
  if (finalJson.length > 795_000) {
    return { ok: false };
  }

  const ref = doc(db, 'aiWriterSessions', session.id);
  const payload: Record<string, string> = {
    id: session.id,
    payloadJson: finalJson,
    updatedAt: session.updatedAt || new Date().toISOString(),
  };
  if (auth.currentUser?.uid) {
    payload.updatedByUid = auth.currentUser.uid;
  }

  try {
    await setDoc(ref, payload);
    return { ok: true };
  } catch (error) {
    console.warn(`Could not sync writer session ${session.id}:`, error);
    return { ok: false, permissionDenied: isPermissionDeniedError(error) };
  }
}

export async function deleteWriterSessionFromCloud(sessionId: string): Promise<void> {
  if (!sessionId || !/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId)) return;
  try {
    await deleteDoc(doc(db, 'aiWriterSessions', sessionId));
  } catch (error) {
    console.warn(`Could not delete writer session ${sessionId} from cloud:`, error);
  }
}

export function subscribeWriterSessions(
  onData: (sessions: WriterSession[]) => void,
  onSyncState?: (state: CloudSyncState) => void
): () => void {
  const colRef = collection(db, 'aiWriterSessions');
  return onSnapshot(
    colRef,
    (snap) => {
      onSyncState?.('synced');
      const list: WriterSession[] = [];
      for (const docSnap of snap.docs) {
        try {
          const data = docSnap.data() as { payloadJson?: string };
          if (!data.payloadJson) continue;
          const parsed = JSON.parse(data.payloadJson) as WriterSession;
          if (parsed && typeof parsed === 'object' && parsed.id) {
            list.push(sanitizeWriterSession(parsed));
          }
        } catch {
          // ignore malformed doc
        }
      }
      list.sort(
        (a, b) =>
          (Date.parse(b.updatedAt || '') || 0) - (Date.parse(a.updatedAt || '') || 0)
      );
      onData(list);
    },
    (error) => {
      console.warn('Writer sessions cloud subscription error:', error);
      onSyncState?.(isPermissionDeniedError(error) ? 'permission_denied' : 'error');
    }
  );
}
