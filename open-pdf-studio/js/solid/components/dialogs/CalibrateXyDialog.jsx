import { createSignal, onMount, Show } from 'solid-js';
import Dialog from '../Dialog.jsx';
import { closeDialog } from '../../stores/dialogStore.js';
import { useTranslation } from '../../../i18n/useTranslation.js';
import { leesGetal } from '../../../core/getal-invoer.js';
import { leesOpslag, schrijfOpslag } from '../../../core/opslag.js';
import { leesInch, voetInchNaarVoet } from '../../../annotations/schaal-xy.js';

const LABEL_STYLE = { width: '150px' };
const EENHEDEN = ['m', 'cm', 'mm', 'ft', 'in'];
const OPSLAG_EENHEID = 'calibrateXyUnit';

function laatsteEenheid() {
  try {
    const e = leesOpslag(OPSLAG_EENHEID);
    return EENHEDEN.includes(e) ? e : 'm';
  } catch {
    return 'm';
  }
}

/**
 * The real size of a traced dimension (calibrate per axis). Pick the unit,
 * then type the size: one field for m, cm, mm and inches, two separate fields
 * (feet and inches) for ft; the inches field takes fractions (2 1/2, 2\u00BD).
 * Windows-style dialog via Dialog.jsx: movable, does not close on a click
 * outside. Enter = OK.
 */
export default function CalibrateXyDialog(props) {
  const { t } = useTranslation('dialogs');
  const { t: tCommon } = useTranslation('common');
  const data = props.data || {};
  const as = data.as === 'y' ? 'y' : 'x';

  const [tekst, setTekst] = createSignal('');
  const [voet, setVoet] = createSignal('');
  const [inch, setInch] = createSignal('');
  const [eenheid, setEenheid] = createSignal(laatsteEenheid());
  const [fout, setFout] = createSignal('');
  let invoer;

  onMount(() => requestAnimationFrame(() => invoer?.focus()));

  // Feet and inches are one size in feet; the other units are one number.
  const lees = () => {
    if (eenheid() === 'ft') {
      const v = voet().trim() === '' ? 0 : leesGetal(voet());
      const i = leesInch(inch());
      if (!(v >= 0) || !(i >= 0)) return null;
      const waarde = voetInchNaarVoet(v, i);
      return waarde > 0 ? { waarde, eenheid: 'ft' } : null;
    }
    const waarde = leesGetal(tekst());
    return waarde > 0 ? { waarde, eenheid: eenheid() } : null;
  };

  const klaar = (uitkomst) => {
    closeDialog('calibrate-xy');
    if (data.resolve) data.resolve(uitkomst);
  };

  const ok = () => {
    const maat = lees();
    if (!maat) {
      setFout(t('calibrateXy.invalid'));
      return;
    }
    try { schrijfOpslag(OPSLAG_EENHEID, eenheid()); } catch { /* remembering the unit is a convenience */ }
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
          <label class="crop-margins-label" style={LABEL_STYLE}>{t('calibrateXy.unit')}</label>
          <select class="crop-margins-select" value={eenheid()} onChange={(e) => { setEenheid(e.target.value); setFout(''); requestAnimationFrame(() => invoer?.focus()); }}>
            {EENHEDEN.map((u) => <option value={u}>{u === 'ft' ? t('calibrateXy.feetInches') : u}</option>)}
          </select>
        </div>
        <Show when={eenheid() === 'ft'} fallback={
          <div class="crop-margins-row">
            <label class="crop-margins-label" style={LABEL_STYLE}>{t('calibrateXy.actualSize')}</label>
            <input
              ref={invoer}
              type="text" inputmode="decimal"
              class="crop-margins-input"
              value={tekst()}
              onInput={(e) => { setTekst(e.target.value); setFout(''); }}
              onKeyDown={onKeyDown}
            />
          </div>
        }>
          <div class="crop-margins-row">
            <label class="crop-margins-label" style={LABEL_STYLE}>{t('calibrateXy.feet')}</label>
            <input
              ref={invoer}
              type="text" inputmode="decimal"
              class="crop-margins-input"
              value={voet()}
              onInput={(e) => { setVoet(e.target.value); setFout(''); }}
              onKeyDown={onKeyDown}
            />
          </div>
          <div class="crop-margins-row">
            <label class="crop-margins-label" style={LABEL_STYLE}>{t('calibrateXy.inches')}</label>
            <input
              type="text" inputmode="decimal"
              class="crop-margins-input"
              value={inch()}
              onInput={(e) => { setInch(e.target.value); setFout(''); }}
              onKeyDown={onKeyDown}
            />
          </div>
        </Show>
        <div class="pref-hint">{t(eenheid() === 'ft' ? 'calibrateXy.hintFeet' : 'calibrateXy.hint')}</div>
        {fout() && <div class="crop-margins-info" style={{ color: '#e81123' }}>{fout()}</div>}
      </div>
    </Dialog>
  );
}
