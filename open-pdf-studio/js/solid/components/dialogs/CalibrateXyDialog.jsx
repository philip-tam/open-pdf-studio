import { createSignal, onMount } from 'solid-js';
import Dialog from '../Dialog.jsx';
import { closeDialog } from '../../stores/dialogStore.js';
import { useTranslation } from '../../../i18n/useTranslation.js';
import { leesLengte } from '../../../annotations/schaal-xy.js';

const LABEL_STYLE = { width: '150px' };
const EENHEDEN = ['m', 'cm', 'mm', 'ft', 'in'];

/**
 * The real size of a traced dimension (calibrate per axis). One field that
 * understands units typed in it ("12.5 m", "350 cm", 5'6"), plus a unit for a
 * bare number. Windows-style dialog via Dialog.jsx: movable, does not close on
 * a click outside. Enter = OK, Esc = Cancel.
 */
export default function CalibrateXyDialog(props) {
  const { t } = useTranslation('dialogs');
  const { t: tCommon } = useTranslation('common');
  const data = props.data || {};
  const as = data.as === 'y' ? 'y' : 'x';

  const [tekst, setTekst] = createSignal('');
  const [eenheid, setEenheid] = createSignal('m');
  const [fout, setFout] = createSignal('');
  let invoer;

  onMount(() => requestAnimationFrame(() => invoer?.focus()));

  const klaar = (uitkomst) => {
    closeDialog('calibrate-xy');
    if (data.resolve) data.resolve(uitkomst);
  };

  const ok = () => {
    const maat = leesLengte(tekst(), eenheid());
    if (!maat) {
      setFout(t('calibrateXy.invalid'));
      return;
    }
    klaar(maat);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      ok();
    }
  };

  const footer = (
    <>
      <div></div>
      <div class="crop-margins-footer-right">
        <button class="pref-btn pref-btn-primary" id="calibrate-xy-ok" onClick={ok}>{tCommon('ok')}</button>
        <button class="pref-btn pref-btn-secondary" onClick={() => klaar(null)}>{tCommon('cancel')}</button>
      </div>
    </>
  );

  return (
    <Dialog
      title={t('calibrateXy.title')}
      overlayClass="crop-margins-overlay"
      dialogClass="crop-margins-dialog"
      headerClass="crop-margins-header"
      bodyClass="crop-margins-content"
      footerClass="crop-margins-footer"
      onClose={() => klaar(null)}
      footer={footer}
    >
      <div class="crop-margins-form">
        <div class="crop-margins-info">
          {t('calibrateXy.askSize', { axis: t(as === 'x' ? 'calibrateXy.axisX' : 'calibrateXy.axisY') })}
        </div>
        <div class="crop-margins-row">
          <label class="crop-margins-label" style={LABEL_STYLE}>{t('calibrateXy.actualSize')}</label>
          <input
            ref={invoer}
            type="text"
            class="crop-margins-input"
            value={tekst()}
            onInput={(e) => { setTekst(e.target.value); setFout(''); }}
            onKeyDown={onKeyDown}
          />
        </div>
        <div class="crop-margins-row">
          <label class="crop-margins-label" style={LABEL_STYLE}>{t('calibrateXy.unit')}</label>
          <select class="crop-margins-select" value={eenheid()} onChange={(e) => setEenheid(e.target.value)}>
            {EENHEDEN.map((u) => <option value={u}>{u}</option>)}
          </select>
        </div>
        <div class="pref-hint">{t('calibrateXy.hint')}</div>
        {fout() && <div class="crop-margins-info" style={{ color: '#e81123' }}>{fout()}</div>}
      </div>
    </Dialog>
  );
}
