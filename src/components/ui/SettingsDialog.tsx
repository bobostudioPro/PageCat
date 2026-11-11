import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, Lamp, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { useSettings } from '../../state/settings';
import { PROVIDER_PRESETS, testConnection } from '../../lib/ai/provider';
import type { AiProvider, Settings } from '../../types';
import { useToast } from '../../state/toast';
import { clearEverything } from '../../lib/db';

type Props = { open: boolean; onClose: () => void };

const themes: { key: Settings['readerTheme']; label: string; desc: string }[] = [
  { key: 'paper', label: '纸白', desc: '像刚裁开的书页' },
  { key: 'sepia', label: '羊皮纸', desc: '一盏暖黄的灯' },
  { key: 'night', label: '夜读', desc: '把房间调暗一点' },
];

export function SettingsDialog({ open, onClose }: Props) {
  const settings = useSettings();
  const push = useToast((s) => s.push);
  const [draft, setDraft] = useState<Settings>(settings);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft({ ...useSettings.getState() });
      setTestResult(null);
      setConfirmClear(false);
      setShowKey(false);
    }
  }, [open]);

  const setField = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const chooseProvider = (provider: AiProvider) => {
    const preset = PROVIDER_PRESETS[provider];
    setDraft((d) => ({
      ...d,
      aiProvider: provider,
      aiBaseUrl: preset.baseUrl || (provider === 'custom' ? d.aiBaseUrl : ''),
      aiModel: preset.model || (provider === 'custom' ? d.aiModel : ''),
    }));
    setTestResult(null);
  };

  const save = () => {
    settings.update({
      aiProvider: draft.aiProvider,
      aiBaseUrl: draft.aiBaseUrl.trim(),
      aiModel: draft.aiModel.trim(),
      aiApiKey: draft.aiApiKey.trim(),
      aiTemperature: draft.aiTemperature,
      readerTheme: draft.readerTheme,
      pageTurnSound: draft.pageTurnSound,
    });
    push(draft.aiApiKey ? '设置已保存，AI 助手已上线' : '设置已保存，AI 助手使用本地速读', 'success');
    onClose();
  };

  const runTest = async () => {
    if (!draft.aiApiKey) {
      setTestResult({ ok: false, text: '先填入 API Key 才能测试。' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      await testConnection({
        baseUrl: draft.aiBaseUrl,
        apiKey: draft.aiApiKey,
        model: draft.aiModel,
      });
      setTestResult({ ok: true, text: '连接成功，接口可以使用。' });
    } catch (err) {
      setTestResult({ ok: false, text: (err as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const clear = async () => {
    await clearEverything();
    window.location.hash = '#/';
    window.location.reload();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="书房设置"
      subtitle="钥匙与灯光都放在这里，只保存在你自己的浏览器。"
      wide
    >
      <div className="settings">
        <section className="settings-section">
          <div className="settings-heading">
            <span className="settings-icon">
              <Sparkles size={16} />
            </span>
            <div>
              <h3>AI 阅读助手</h3>
              <p>不填密钥也能用：本地速读会抽取摘要、找原文、生成思考题。填入兼容接口后，就能真正对话分析。</p>
            </div>
          </div>

          <div className="provider-tabs" role="tablist" aria-label="AI 服务商">
            {(Object.keys(PROVIDER_PRESETS) as AiProvider[]).map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={draft.aiProvider === key}
                className={`provider-tab ${draft.aiProvider === key ? 'active' : ''}`}
                onClick={() => chooseProvider(key)}
              >
                {PROVIDER_PRESETS[key].label}
              </button>
            ))}
          </div>

          <div className="settings-grid">
            <div className="field">
              <label htmlFor="base-url">接口地址</label>
              <input
                id="base-url"
                className="input"
                value={draft.aiBaseUrl}
                placeholder="https://api.deepseek.com"
                onChange={(e) => setField('aiBaseUrl', e.target.value)}
              />
              <span className="field-hint">{PROVIDER_PRESETS[draft.aiProvider].note}</span>
            </div>
            <div className="field">
              <label htmlFor="model">模型</label>
              <input
                id="model"
                className="input"
                value={draft.aiModel}
                placeholder="deepseek-chat"
                onChange={(e) => setField('aiModel', e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="api-key">API Key</label>
            <div className="input-with-action">
              <input
                id="api-key"
                className="input"
                type={showKey ? 'text' : 'password'}
                value={draft.aiApiKey}
                placeholder="sk-…（只保存在本机，不会发送给 PageCat）"
                autoComplete="off"
                onChange={(e) => setField('aiApiKey', e.target.value)}
              />
              <button className="input-action" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? '隐藏密钥' : '显示密钥'}>
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="settings-actions">
            <button className="btn btn-quiet test-btn" onClick={runTest} disabled={testing}>
              {testing ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
              测试连接
            </button>
            {testResult && (
              <span className={`test-result ${testResult.ok ? 'ok' : 'fail'}`}>{testResult.text}</span>
            )}
          </div>

          <div className="privacy-note">
            密钥存放在浏览器的 localStorage，请求由你的浏览器直接发往所填接口。请只在私人设备上使用。
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-heading">
            <span className="settings-icon"><Lamp size={15} /></span>
            <div>
              <h3>阅读灯光</h3>
              <p>同一个房间，三种光。</p>
            </div>
          </div>
          <div className="theme-grid">
            {themes.map((theme) => (
              <button
                key={theme.key}
                className={`theme-card ${draft.readerTheme === theme.key ? 'active' : ''}`}
                onClick={() => setField('readerTheme', theme.key)}
              >
                <span className={`theme-swatch ${theme.key}`} />
                <span className="theme-label">{theme.label}</span>
                <span className="theme-desc">{theme.desc}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section danger">
          <div className="settings-heading">
            <span className="settings-icon danger">
              <Trash2 size={15} />
            </span>
            <div>
              <h3>书房整理</h3>
              <p>清空后，书架、划线、笔记和对话都会被删除，无法恢复。</p>
            </div>
          </div>
          {confirmClear ? (
            <div className="clear-confirm">
              <span>确定要清空整间书房吗？</span>
              <button className="btn btn-quiet" onClick={() => setConfirmClear(false)}>
                再想想
              </button>
              <button className="btn btn-danger" onClick={clear}>
                确认清空
              </button>
            </div>
          ) : (
            <button className="btn btn-quiet clear-link" onClick={() => setConfirmClear(true)}>
              清空所有本地数据
            </button>
          )}
        </section>
      </div>

      <div className="modal-foot settings-foot">
        <button className="btn btn-quiet" onClick={onClose}>
          取消
        </button>
        <button className="btn btn-brass" onClick={save}>
          保存设置
        </button>
      </div>
    </Modal>
  );
}
