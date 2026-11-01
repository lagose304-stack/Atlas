import React, { useEffect, useState } from 'react';
import { Code2, FlaskConical, Heart, Microscope, PawPrint, type LucideIcon } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import '../styles/credits.css';
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
    pendingLabel: 'Elam Lagos / Instructor desde el 2024 - Actualidad / Creador y programador del Atlas',
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
    pendingLabel: 'Carolina Ardón / Instructora desde 2024 - Actualidad / Coordinadora de microscopía del 2025 - 2027',
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
  const [profiles, setProfiles] = useState<CreditProfile[]>([]);
  const [contributors, setContributors] = useState<CreditContributor[]>([]);
  const [failedProfiles, setFailedProfiles] = useState<Record<string, boolean>>({});
  const [failedContributors, setFailedContributors] = useState<Record<number, boolean>>({});

  useEffect(() => {
    void loadCredits()
      .then((data) => {
        setProfiles(data.profiles);
        setContributors(data.contributors);
      })
      .catch(() => undefined);
  }, []);

  const isSnoopy = (person: CreditContributor) => person.name.trim().toLocaleLowerCase('es') === 'snoopy';
  const snoopy = contributors.find(isSnoopy);
  const instructors = contributors.filter(person => !isSnoopy(person));

  const photoFor = (key: CreditProfileKey) =>
    profiles.find((profile) => profile.profile_key === key)?.photo_url ?? null;

  return (
    <div className="credits-lab">
      <Header />
      <main className="credits-lab__main" aria-labelledby="creditos-title">
        <section className="credits-lab__intro">
          <div>
            <h1 id="creditos-title">Un trabajo construido <em>en equipo.</em></h1>
            <p className="credits-lab__intro-text">
              Reconocemos a quienes contribuyeron desde la docencia, la microscopía, la creación de
              contenido, el diseño y la tecnología. Cada aporte forma parte de esta herramienta educativa.
            </p>
          </div>
          {snoopy && (
              <aside className="credits-lab__snoopy" aria-label="Snoopy">
                <div className="credits-lab__snoopy-image">
                  {snoopy.photo_url && !failedContributors[snoopy.id] ? (
                    <img src={getCloudinaryImageUrl(snoopy.photo_url, 'thumb')} alt={snoopy.name}
                      onError={() => setFailedContributors(prev => ({ ...prev, [snoopy.id]: true }))} />
                  ) : <Heart size={28} strokeWidth={1.4} aria-hidden="true" />}
                </div>
                <div className="credits-lab__snoopy-body">
                  <h2>{snoopy.name}<PawPrint size={15} strokeWidth={1.5} aria-hidden="true" /></h2>
                  <p>Por la inspiración y su apoyo emocional.</p>
                </div>
              </aside>
          )}
        </section>

        <section aria-label="Equipos colaboradores" className="credits-lab__groups">
          {CREDIT_GROUPS.map((group, index) => {
            const Icon = group.icon;
            const photoUrl = photoFor(group.profileKey);
            const hasValidPhoto = Boolean(photoUrl && !failedProfiles[group.profileKey]);
            return (
              <article key={group.id} className="credits-lab__group" style={{ '--credit-accent': group.accent } as React.CSSProperties}>
                <div className="credits-lab__slide">
                  <div className="credits-lab__slide-label" aria-hidden="true">
                    <span>ATLAS</span><strong>{String(index + 1).padStart(2, '0')}</strong><span>HISTOLOGÍA</span>
                  </div>
                  <div className="credits-lab__specimen">
                    {hasValidPhoto && photoUrl ? (
                      <img src={getCloudinaryImageUrl(photoUrl, 'thumb')} alt={`Placa histológica asociada a ${group.pendingLabel.split('/')[0].trim()}`} loading="lazy"
                        onError={() => setFailedProfiles(prev => ({ ...prev, [group.profileKey]: true }))} />
                    ) : (
                      <div className="credits-lab__placeholder"><Microscope size={42} strokeWidth={1.2} aria-hidden="true" /><span>Atlas de Histología</span></div>
                    )}
                    <span className="credits-lab__coverslip" aria-hidden="true" />
                  </div>
                </div>
                <div className="credits-lab__group-body">
                  <header>
                    <span className="credits-lab__group-category"><Icon size={15} aria-hidden="true" /> {group.title}</span>
                    <p className="credits-lab__group-description">{group.description}</p>
                  </header>
                  {group.people.length > 0 ? (
                    <div className="credits-lab__people">
                      {group.people.map(person => (
                        <div key={`${group.id}-${person.name}`} className="credits-lab__person">
                          <span className="credits-lab__initials">{initialsFor(person)}</span>
                          <div><h2>{person.name}</h2><p>{person.role}</p>{person.description && <p>{person.description}</p>}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="credits-lab__identity">
                      <h2>{group.pendingLabel.split('/')[0].trim()}</h2>
                      <div className="credits-lab__roles">
                        {group.pendingLabel.split('/').slice(1).map(role => <span key={role}>{role.trim()}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        {instructors.length > 0 && (
          <section className="credits-lab__contributors" aria-labelledby="instructores-title">
            <header className="credits-lab__section-heading">
              <div><span className="credits-lab__eyebrow">Nuestro reconocimiento</span><h2 id="instructores-title">Instructores que han formado parte del atlas</h2></div>
              <p>Agradecemos el tiempo, conocimiento y dedicación aportados durante cada período.</p>
            </header>
            <div className="credits-lab__contributors-grid">
              {instructors.map((person, index) => {
                const hasPhoto = Boolean(person.photo_url && !failedContributors[person.id]);
                return (
                  <article key={person.id} className="credits-lab__contributor">
                    <div className="credits-lab__contributor-specimen">
                      {hasPhoto && person.photo_url ? (
                        <img src={getCloudinaryImageUrl(person.photo_url, 'thumb')} alt={`Imagen asociada a ${person.name}`} loading="lazy"
                          onError={() => setFailedContributors(prev => ({ ...prev, [person.id]: true }))} />
                      ) : <Microscope size={34} strokeWidth={1.1} aria-hidden="true" />}
                      <span className="credits-lab__specimen-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <div className="credits-lab__contributor-body">
                      <span className="credits-lab__period">{person.start_year} — {person.is_current ? 'Actualidad' : person.end_year}</span>
                      <h3>{person.name}</h3>
                      {person.contribution && <p>{person.contribution}</p>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section className="credits-lab__closing">
          <Heart size={23} strokeWidth={1.4} aria-hidden="true" />
          <p>Gracias por hacer posible este atlas.</p>
          {instructors.length === 0 && <span>Esta sección se actualizará con los nombres y aportes de cada integrante del proyecto.</span>}
          <span className="credits-lab__closing-signature" aria-hidden="true">ATLAS · HISTOLOGÍA</span>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Creditos;
