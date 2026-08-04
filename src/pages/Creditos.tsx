import React, { useEffect, useState } from 'react';
import { BookOpenCheck, Code2, FlaskConical, Heart, Sparkles, UserRound, type LucideIcon } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import BackButton from '../components/BackButton';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { loadCredits, type CreditContributor, type CreditProfile, type CreditProfileKey } from '../services/credits';

interface CreditPerson {
  name: string;
  role: string;
  description?: string;
  initials?: string;
}

interface CreditGroup {
  id: string;
  title: string;
  description: string;
  accent: string;
  soft: string;
  icon: LucideIcon;
  pendingLabel: string;
  profileKey: CreditProfileKey;
  people: CreditPerson[];
}

// Agrega aquí a cada integrante cuando se confirmen sus datos.
const CREDIT_GROUPS: CreditGroup[] = [
  {
    id: 'desarrollo',
    title: 'Programación y diseño del sitio',
    description: 'Conceptualización, diseño de experiencia, programación, infraestructura y desarrollo integral del Atlas de Histología.',
    accent: '#8b5cf6',
    soft: '#f5f3ff',
    icon: Code2,
    pendingLabel: 'Elam Elisama Lagos Matamoros / Instructor del 2024 - 2025',
    profileKey: 'developer',
    people: [],
  },
  {
    id: 'microscopia',
    title: 'Coordinadora de microscopía',
    description: 'Coordinación general del Atlas y del comité de microscopía del laboratorio, acompañamiento académico y orientación del contenido microscópico presentado en el Atlas.',
    accent: '#0ea5e9',
    soft: '#f0f9ff',
    icon: FlaskConical,
    pendingLabel: 'Carolina Ardón / Instructora del 2024 - Actualidad / Coordinadora de microscopía del 2025 - 2026',
    profileKey: 'microscopy_coordinator',
    people: [],
  },
];

const initialsFor = (person: CreditPerson) => person.initials ?? person.name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0]?.toUpperCase())
  .join('');

const Creditos: React.FC = () => {
  const goBack = useSmartBackNavigation('/');
  const [profiles, setProfiles] = useState<CreditProfile[]>([]);
  const [contributors, setContributors] = useState<CreditContributor[]>([]);
  useEffect(() => { void loadCredits().then(data => { setProfiles(data.profiles); setContributors(data.contributors); }).catch(() => undefined); }, []);
  const photoFor = (key: CreditProfileKey) => profiles.find(profile => profile.profile_key === key)?.photo_url ?? null;

  return (
    <div style={s.page}>
      <Header />
      <main style={s.main}>
        <BackButton onClick={goBack} />

        <section className="credits-hero" style={s.hero} aria-labelledby="creditos-title">
          <div style={s.heroGlowOne} aria-hidden="true" />
          <div style={s.heroGlowTwo} aria-hidden="true" />
          <div style={s.heroContent}>
            <span style={s.eyebrow}><Sparkles size={15} /> Las personas detrás del atlas</span>
            <h1 id="creditos-title" style={s.title}>Créditos</h1>
            <p style={s.heroText}>
              Este proyecto es el resultado del conocimiento, el tiempo y la dedicación de personas
              comprometidas con la enseñanza de la histología.
            </p>
            <div style={s.heroRule} />
          </div>
          <div className="credits-hero-mark" style={s.heroMark} aria-hidden="true"><BookOpenCheck size={54} strokeWidth={1.7} /></div>
        </section>

        <section style={s.intro}>
          <div style={s.introIcon}><Heart size={25} fill="currentColor" /></div>
          <div>
            <h2 style={s.introTitle}>Un trabajo construido en equipo</h2>
            <p style={s.introText}>
              Reconocemos a quienes contribuyeron desde la docencia, la microscopía, la creación de
              contenido, el diseño y la tecnología. Cada aporte forma parte de esta herramienta educativa.
            </p>
          </div>
        </section>

        <section aria-label="Equipos colaboradores" style={s.groups}>
          {CREDIT_GROUPS.map(group => {
            const Icon = group.icon;
            const photoUrl = photoFor(group.profileKey);
            return (
              <article key={group.id} style={{ ...s.groupCard, borderTopColor: group.accent }}>
                <span style={{ ...s.groupGlow, background: group.accent }} aria-hidden="true" />
                <header style={s.groupHeader}>
                  <span style={{ ...s.groupIcon, color: group.accent, background: group.soft }}><Icon size={24} /></span>
                  <div>
                    <h2 style={s.groupTitle}>{group.title}</h2>
                    <p style={s.groupDescription}>{group.description}</p>
                  </div>
                </header>

                {group.people.length > 0 ? (
                  <div style={s.peopleGrid}>
                    {group.people.map(person => (
                      <div key={`${group.id}-${person.name}`} style={s.personCard}>
                        <span style={{ ...s.avatar, background: `linear-gradient(135deg, ${group.accent}, #38bdf8)` }}>
                          {initialsFor(person)}
                        </span>
                        <div style={s.personInfo}>
                          <h3 style={s.personName}>{person.name}</h3>
                          <p style={{ ...s.personRole, color: group.accent }}>{person.role}</p>
                          {person.description && <p style={s.personDescription}>{person.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ ...s.creditIdentity, background: `linear-gradient(135deg,#ffffff,${group.soft})`, borderColor: `${group.accent}38` }}>
                    <div style={{ ...s.identityPhoto, background: group.soft, borderColor: `${group.accent}45` }}>
                      {photoUrl ? (
                        <img src={getCloudinaryImageUrl(photoUrl, 'thumb')} alt={group.pendingLabel.split('/')[0].trim()} style={s.identityPhotoImage} />
                      ) : (
                        <div style={{ ...s.identityPhotoPlaceholder, color: group.accent }}>
                          <UserRound size={31} strokeWidth={1.7} />
                          <span>Fotografía</span>
                        </div>
                      )}
                    </div>
                    <div style={s.identityContent}>
                      <span style={{ ...s.identityEyebrow, color: group.accent }}>Reconocimiento</span>
                      <h3 style={s.identityName}>{group.pendingLabel.split('/')[0].trim()}</h3>
                    </div>
                    <div style={s.identityRoles}>
                      {group.pendingLabel.split('/').slice(1).map(role => (
                        <span key={role} style={{ ...s.identityRole, color: group.accent, borderColor: `${group.accent}35`, background: group.soft }}>
                          {role.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <section style={s.closing}>
          <div style={s.closingGlowLeft} aria-hidden="true" />
          <div style={s.closingGlowRight} aria-hidden="true" />
          <div style={s.closingIcon}><Sparkles size={24} /></div>
          <p style={s.closingLead}>Gracias por hacer posible este atlas.</p>
          {contributors.length === 0 && <p style={s.closingText}>Esta sección se actualizará con los nombres y aportes de cada integrante del proyecto.</p>}
        </section>

        {contributors.length > 0 && <section style={s.contributorsSection} aria-labelledby="instructores-title">
          <div style={s.contributorsHeading}>
            <span style={s.contributorsEyebrow}>Nuestro reconocimiento</span>
            <h2 id="instructores-title" style={s.contributorsTitle}>Instructores que han formado parte del atlas</h2>
            <p style={s.contributorsIntro}>Agradecemos el tiempo, conocimiento y dedicación aportados durante cada período.</p>
          </div>
          <div className="credits-contributors-grid" style={s.contributorsGrid}>
            {contributors.map((person, index) => <article key={person.id} style={s.contributorCard}>
              <span style={s.contributorNumber}>{String(index + 1).padStart(2, '0')}</span>
              <div style={s.contributorBody}>
                <h3 style={s.contributorName}>{person.name}</h3>
                <span style={s.contributorPeriod}>{person.start_year} — {person.is_current ? 'Actualidad' : person.end_year}</span>
                {person.contribution && <p style={s.contributorContribution}>{person.contribution}</p>}
              </div>
            </article>)}
          </div>
        </section>}
      </main>
      <Footer />
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'clamp(8px,2vw,24px)', boxSizing: 'border-box', color: '#0f172a', fontFamily: '"Montserrat","Segoe UI",sans-serif' },
  main: { width: '100%', maxWidth: 1280, flex: 1, display: 'flex', flexDirection: 'column', gap: 'clamp(18px,3vw,30px)', paddingBottom: 40, boxSizing: 'border-box' },
  hero: { position: 'relative', isolation: 'isolate', overflow: 'hidden', minHeight: 210, display: 'flex', alignItems: 'center', padding: 'clamp(24px,4vw,42px) clamp(24px,5vw,58px)', borderRadius: 26, border: '1px solid rgba(186,230,253,.85)', background: 'linear-gradient(135deg,rgba(255,255,255,.98),rgba(239,246,255,.96) 52%,rgba(245,243,255,.96))', boxShadow: '0 18px 50px rgba(30,64,175,.10)', boxSizing: 'border-box' },
  heroGlowOne: { position: 'absolute', width: 330, height: 330, borderRadius: '50%', top: -190, right: -70, zIndex: -1, background: 'radial-gradient(circle,rgba(56,189,248,.28),transparent 70%)' },
  heroGlowTwo: { position: 'absolute', width: 280, height: 280, borderRadius: '50%', bottom: -210, left: '28%', zIndex: -1, background: 'radial-gradient(circle,rgba(139,92,246,.22),transparent 70%)' },
  heroContent: { maxWidth: 760 }, eyebrow: { width: 'fit-content', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 999, color: '#4338ca', background: '#eef2ff', border: '1px solid #c7d2fe', fontSize: '.76rem', fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase' },
  title: { margin: '13px 0 8px', fontSize: 'clamp(2rem,5vw,3.4rem)', lineHeight: 1, fontWeight: 900, letterSpacing: '-.055em', background: 'linear-gradient(120deg,#0f172a 20%,#1d4ed8 65%,#7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  heroText: { maxWidth: 680, margin: 0, color: '#475569', fontSize: 'clamp(.9rem,1.7vw,1.02rem)', lineHeight: 1.6 }, heroRule: { width: 68, height: 4, marginTop: 15, borderRadius: 9, background: 'linear-gradient(90deg,#38bdf8,#6366f1,#a855f7)' },
  heroMark: { position: 'absolute', right: 'clamp(24px,6vw,72px)', bottom: 'clamp(20px,4vw,38px)', width: 82, height: 82, display: 'grid', placeItems: 'center', borderRadius: 23, color: '#2563eb', background: 'rgba(255,255,255,.74)', border: '1px solid rgba(147,197,253,.65)', boxShadow: '0 12px 30px rgba(37,99,235,.15)', transform: 'rotate(5deg)' },
  intro: { display: 'flex', alignItems: 'flex-start', gap: 18, padding: 'clamp(20px,3vw,30px)', borderRadius: 20, background: 'rgba(255,255,255,.9)', border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(15,23,42,.06)' }, introIcon: { width: 48, height: 48, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 15, color: '#e11d48', background: '#fff1f2' }, introTitle: { margin: '0 0 7px', fontSize: 'clamp(1.1rem,2.5vw,1.4rem)', fontWeight: 850 }, introText: { margin: 0, maxWidth: 920, color: '#64748b', lineHeight: 1.7, fontSize: '.94rem' },
  groups: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,480px),1fr))', gap: 'clamp(16px,2.5vw,24px)', alignItems: 'stretch' }, groupCard: { position: 'relative', isolation: 'isolate', overflow: 'hidden', display: 'grid', gridTemplateRows: 'minmax(112px,auto) 1fr', gap: 22, minHeight: 286, padding: 'clamp(22px,3vw,30px)', borderRadius: 22, border: '1px solid rgba(203,213,225,.82)', borderTop: '4px solid', background: 'linear-gradient(145deg,rgba(255,255,255,.98),rgba(248,250,252,.94))', boxShadow: '0 14px 36px rgba(15,23,42,.08)', boxSizing: 'border-box' },
  groupGlow: { position: 'absolute', zIndex: -1, width: 190, height: 190, top: -125, right: -80, borderRadius: '50%', opacity: .09, filter: 'blur(2px)' },
  groupHeader: { display: 'flex', alignItems: 'flex-start', gap: 16, minHeight: 112 }, groupIcon: { width: 50, height: 50, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 15, border: '1px solid rgba(255,255,255,.8)', boxShadow: '0 7px 18px rgba(15,23,42,.07)' }, groupTitle: { margin: '1px 0 7px', minHeight: 29, display: 'flex', alignItems: 'center', fontSize: 'clamp(1.08rem,2vw,1.22rem)', fontWeight: 850, letterSpacing: '-.018em' }, groupDescription: { margin: 0, maxWidth: 500, color: '#64748b', fontSize: '.84rem', lineHeight: 1.62 },
  peopleGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }, personCard: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: 13, borderRadius: 14, background: '#fff', border: '1px solid #e2e8f0' }, avatar: { width: 43, height: 43, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 13, color: '#fff', fontWeight: 900, fontSize: '.83rem' }, personInfo: { minWidth: 0 }, personName: { margin: '1px 0 3px', fontSize: '.9rem', fontWeight: 850 }, personRole: { margin: 0, fontSize: '.73rem', fontWeight: 750 }, personDescription: { margin: '5px 0 0', color: '#64748b', fontSize: '.72rem', lineHeight: 1.45 },
  creditIdentity: { alignSelf: 'stretch', display: 'grid', gridTemplateColumns: '120px minmax(0,1fr)', gridTemplateRows: 'auto 1fr', alignItems: 'start', columnGap: 18, rowGap: 10, minHeight: 154, padding: '17px 18px', border: '1px solid', borderRadius: 16, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.85)', boxSizing: 'border-box' },
  identityPhoto: { gridRow: '1 / 3', width: 120, height: 120, aspectRatio: '1 / 1', overflow: 'hidden', display: 'grid', placeItems: 'center', borderRadius: 16, border: '1.5px dashed', boxShadow: '0 7px 18px rgba(15,23,42,.07)', boxSizing: 'border-box' },
  identityPhotoImage: { width: '100%', height: '100%', display: 'block', objectFit: 'cover', objectPosition: 'center' },
  identityPhotoPlaceholder: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: '.58rem', fontWeight: 800, letterSpacing: '.035em', textTransform: 'uppercase' },
  identityContent: { minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, paddingTop: 3 }, identityEyebrow: { fontSize: '.61rem', lineHeight: 1.2, fontWeight: 850, letterSpacing: '.075em', textTransform: 'uppercase' }, identityName: { margin: 0, color: '#1e293b', fontSize: '.92rem', fontWeight: 900, lineHeight: 1.3 }, identityRoles: { gridColumn: 2, alignSelf: 'stretch', minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', gap: 7, paddingTop: 12, borderTop: '1px solid rgba(148,163,184,.18)' }, identityRole: { display: 'inline-flex', alignItems: 'center', minHeight: 25, maxWidth: '100%', padding: '4px 10px', border: '1px solid', borderRadius: 999, fontSize: '.68rem', fontWeight: 750, lineHeight: 1.3, boxSizing: 'border-box' },
  closing: { position: 'relative', isolation: 'isolate', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 'clamp(28px,4vw,44px) 20px', borderRadius: 24, color: '#0f172a', background: 'linear-gradient(135deg,rgba(255,255,255,.98),rgba(240,249,255,.96) 48%,rgba(245,243,255,.96))', border: '1px solid rgba(186,230,253,.9)', boxShadow: '0 14px 36px rgba(30,64,175,.10)' },
  closingGlowLeft: { position: 'absolute', zIndex: -1, left: -100, bottom: -150, width: 270, height: 270, borderRadius: '50%', background: 'radial-gradient(circle,rgba(56,189,248,.22),transparent 70%)' },
  closingGlowRight: { position: 'absolute', zIndex: -1, right: -90, top: -155, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,.18),transparent 70%)' },
  closingIcon: { width: 52, height: 52, display: 'grid', placeItems: 'center', marginBottom: 14, borderRadius: 17, color: '#4f46e5', background: 'linear-gradient(135deg,#e0f2fe,#ede9fe)', border: '1px solid #c7d2fe', boxShadow: '0 8px 20px rgba(79,70,229,.13)', transform: 'rotate(-4deg)' },
  closingLead: { margin: '0 0 8px', fontSize: 'clamp(1.2rem,3vw,1.6rem)', fontWeight: 900, letterSpacing: '-.025em', background: 'linear-gradient(110deg,#0f172a,#1d4ed8 65%,#7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  closingText: { margin: 0, maxWidth: 680, color: '#64748b', fontSize: '.88rem', lineHeight: 1.65 },
  contributorsSection: { padding: 'clamp(24px,4vw,42px)', borderRadius: 24, border: '1px solid #e2e8f0', background: 'rgba(255,255,255,.9)', boxShadow: '0 12px 34px rgba(15,23,42,.07)' }, contributorsHeading: { maxWidth: 760, marginBottom: 24 }, contributorsEyebrow: { color: '#4f46e5', fontSize: '.68rem', fontWeight: 850, letterSpacing: '.08em', textTransform: 'uppercase' }, contributorsTitle: { margin: '7px 0 8px', fontSize: 'clamp(1.35rem,3vw,1.9rem)', letterSpacing: '-.03em' }, contributorsIntro: { margin: 0, color: '#64748b', fontSize: '.88rem', lineHeight: 1.6 }, contributorsGrid: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 13 }, contributorCard: { position: 'relative', display: 'flex', gap: 13, padding: 17, borderRadius: 15, border: '1px solid #dbeafe', background: 'linear-gradient(145deg,#fff,#f8fafc)' }, contributorNumber: { flexShrink: 0, width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 10, color: '#4f46e5', background: '#eef2ff', fontSize: '.72rem', fontWeight: 900 }, contributorBody: { minWidth: 0 }, contributorName: { margin: '1px 0 5px', color: '#1e293b', fontSize: '.94rem', fontWeight: 900 }, contributorPeriod: { display: 'inline-flex', padding: '4px 9px', borderRadius: 999, color: '#0369a1', background: '#e0f2fe', fontSize: '.68rem', fontWeight: 800 }, contributorContribution: { margin: '9px 0 0', color: '#64748b', fontSize: '.76rem', lineHeight: 1.55 },
};

export default Creditos;
