import { createSignal, onMount, Show, For } from 'solid-js';
import Dialog from '../Dialog.jsx';
import { closeDialog } from '../../stores/dialogStore.js';
import { useTranslation } from '../../../i18n/useTranslation.js';
import { updateStatusMessage } from '../../../ui/chrome/status-bar.js';

const PREVIEW_MAX_WIDTH = 460;
const MM_TO_POINTS = 72 / 25.4;

export default function DewarpDialog(props) {
  const { t } = useTranslation('dialogs');
  const { t: tCommon } = useTranslation('common');

  const { curves } = props.data || {};

  let previewCanvasRef;
  const [previewReady, setPreviewReady] = createSignal(false);
  const [previewFailed, setPreviewFailed] = createSignal(false);
  const [applying, setApplying] = createSignal(false);
  const [sagsMm, setSagsMm] = createSignal([]);

  const close = () => closeDialog('dewarp-page');

  onMount(async () => {
    try {
      const { renderDewarpPreview, computeMaxSag } = await import('../../../pdf/dewarp.js');
      setSagsMm((curves || []).map((pts) => computeMaxSag(pts) / MM_TO_POINTS));

      const warped = await renderDewarpPreview(curves);
      if (!warped || !previewCanvasRef) {
        setPreviewFailed(true);
        return;
      }
      const scale = Math.min(1, PREVIEW_MAX_WIDTH / warped.width);
      previewCanvasRef.width = Math.round(warped.width * scale);
      previewCanvasRef.height = Math.round(warped.height * scale);
      const ctx = previewCanvasRef.getContext('2d');
      ctx.drawImage(warped, 0, 0, previewCanvasRef.width, previewCanvasRef.height);
      setPreviewReady(true);
    } catch (e) {
      console.warn('Dewarp preview failed:', e?.message || e);
      setPreviewFailed(true);
    }
  });

  const handleApply = async () => {
    if (applying()) return;
    // Close BEFORE awaiting the apply, matching StraightenDialog — the
    // page reload dewarpPage triggers can otherwise leave this dialog's
    // own overlay orphaned in the DOM, silently intercepting later clicks.
    close();
    setApplying(true);
    try {
      const { dewarpPage } = await import('../../../pdf/dewarp.js');
      const result = await dewarpPage(curves);
      updateStatusMessage(
        result.warped ? t('dewarp.done') : t('dewarp.failed')
      );
    } finally {
      setApplying(false);
    }
  };

  const footer = (
    <>
      <div></div>
      <div class="crop-margins-footer-right">
        <button class="pref-btn pref-btn-primary" onClick={handleApply} disabled={applying()}>
          {applying() ? t('dewarp.applying') : t('dewarp.apply')}
        </button>
        <button class="pref-btn pref-btn-secondary" onClick={close} disabled={applying()}>{tCommon('cancel')}</button>
      </div>
    </>
  );

  return (
    <Dialog
      title={t('dewarp.title')}
      overlayClass="crop-margins-overlay"
      dialogClass="crop-margins-dialog"
      headerClass="crop-margins-header"
      bodyClass="crop-margins-content"
      footerClass="crop-margins-footer"
      onClose={close}
      footer={footer}
    >
      <div class="crop-margins-form">
        <div class="crop-margins-info">{t('dewarp.info')}</div>
        <div class="crop-margins-info">
          <For each={sagsMm()}>
            {(mm, i) => (
              <div>{t('dewarp.curveCorrection', { index: i() + 1, mm: mm.toFixed(1) })}</div>
            )}
          </For>
        </div>
        <div style={{
          display: 'flex',
          'justify-content': 'center',
          border: '1px solid #d4d4d4',
          background: '#f5f5f5',
          padding: '8px',
          'min-height': '160px',
          'align-items': 'center',
        }}>
          <Show when={!previewFailed()} fallback={<span>{t('dewarp.previewFailed')}</span>}>
            <canvas ref={previewCanvasRef} style={{ 'max-width': '100%', display: previewReady() ? 'block' : 'none' }} />
            <Show when={!previewReady()}>
              <span>{t('dewarp.previewLoading')}</span>
            </Show>
          </Show>
        </div>
      </div>
    </Dialog>
  );
}
