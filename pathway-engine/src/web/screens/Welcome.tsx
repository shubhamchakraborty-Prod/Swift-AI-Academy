/** L01 Welcome: what the assessment is, how long it takes, privacy. Offers Continue for returning learners. Fits one screen. */
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, Lock, Route, Save } from 'lucide-react';
import { ActionBar, BrandBar } from '../components/ui';
import { useLearner } from '../state';
import { pathForStep, stepKey } from '../journey';
import { useI18n } from '../i18n';

export default function Welcome() {
  const { progress, hasSession, loading, signOut } = useLearner();
  const { t } = useI18n();
  const nav = useNavigate();
  const resume = hasSession && progress;
  const parts = [t('part_about'), t('part_profile'), t('part_skills'), t('part_goals')];
  return (
    <>
      <BrandBar />
      <main className="content enter">
        <div className="stack" style={{ gap: 8 }}>
          <p className="eyebrow">{t('w_eyebrow')}</p>
          <h1>{t('w_title')}</h1>
          <p className="lede">{t('w_lede')}</p>
        </div>
        <ol className="card soft tight" style={{ listStyle: 'none', margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }} aria-label={t('w_plan')}>
          {parts.map((s, i) => (
            <li key={s} className="row" style={{ gap: 8 }}>
              <span className="term-dot planned" style={{ position: 'static', flex: 'none' }} aria-hidden="true">{i + 1}</span>
              <span style={{ fontWeight: 700, fontSize: 14.5 }}>{s}</span>
            </li>
          ))}
          <li className="row" style={{ gap: 8, gridColumn: '1 / -1' }}>
            <span className="term-dot" style={{ position: 'static', flex: 'none' }} aria-hidden="true"><Route size={13} strokeWidth={2.5} /></span>
            <span style={{ fontWeight: 800, fontSize: 14.5 }}>{t('w_plan')}</span>
          </li>
        </ol>
        <ul className="rows">
          <li><span className="tile"><Clock size={20} strokeWidth={1.75} /></span><span className="grow"><span className="title">{t('w_k1t')}</span> <span className="sub">{t('w_k1')}</span></span></li>
          <li><span className="tile"><Save size={20} strokeWidth={1.75} /></span><span className="grow"><span className="title">{t('w_k2t')}</span> <span className="sub">{t('w_k2')}</span></span></li>
          <li><span className="tile"><Lock size={20} strokeWidth={1.75} /></span><span className="grow"><span className="title">{t('w_k3t')}</span> <span className="sub">{t('w_k3')}</span></span></li>
        </ul>
      </main>
      <ActionBar hint={resume
        ? <>{t('w_notYou')} <button className="link-btn" onClick={() => { signOut(); nav('/start'); }}>{t('w_other')}</button></>
        : <>{t('w_staff')} <Link to="/staff">{t('w_staffLink')}</Link></>}>
        {resume ? (
          <button className="btn btn-primary btn-block" onClick={() => nav(pathForStep(progress.step))}>
            {progress.step === 'dashboard' ? t('w_open') : t('w_continue', { step: t(stepKey(progress.step)) })} <ArrowRight size={18} />
          </button>
        ) : (
          <button className="btn btn-primary btn-block" disabled={loading} onClick={() => nav('/start')}>{t('w_start')} <ArrowRight size={18} /></button>
        )}
      </ActionBar>
    </>
  );
}
