import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE_URL = 'https://atlas-histolab.pages.dev';
const DEFAULT_DESCRIPTION = 'Atlas de Histología del Laboratorio de Histología de la UNAH: temario, microscopía y colección de placas histológicas para estudiantes.';

type SeoData = { title: string; description: string; index?: boolean };

const getSeoData = (pathname: string): SeoData => {
  if (pathname === '/temario') return {
    title: 'Temario de Histología | Histolab UNAH',
    description: 'Consulta el temario de histología de la UNAH, organizado por temas y subtemas con acceso a placas histológicas y recursos de microscopía.',
  };
  if (pathname === '/evaluaciones') return {
    title: 'Evaluaciones de Histología | Histolab UNAH',
    description: 'Evaluaciones educativas del Atlas de Histología del Laboratorio de Histología de la UNAH.',
  };
  if (pathname.startsWith('/subtemas/')) return {
    title: 'Subtemas de Histología | Histolab UNAH',
    description: 'Explora subtemas, contenidos y recursos educativos de histología del Laboratorio de Histología de la UNAH.',
  };
  if (pathname.startsWith('/ver-placas/')) return {
    title: 'Placas Histológicas | Histolab UNAH',
    description: 'Observa placas histológicas para el estudio de tejidos y microscopía en el Atlas de Histología de la UNAH.',
  };
  if (pathname !== '/') return {
    title: 'Atlas de Histología | Histolab UNAH',
    description: DEFAULT_DESCRIPTION,
    index: false,
  };
  return { title: 'Atlas de Histología | Histolab UNAH', description: DEFAULT_DESCRIPTION };
};

const setMeta = (selector: string, attribute: 'name' | 'property', key: string, content: string) => {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
};

const SeoManager = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const seo = getSeoData(pathname);
    const canonicalPath = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
    const canonicalUrl = `${SITE_URL}${canonicalPath}`;

    document.title = seo.title;
    setMeta('meta[name="description"]', 'name', 'description', seo.description);
    setMeta('meta[name="robots"]', 'name', 'robots', seo.index === false ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
    setMeta('meta[property="og:title"]', 'property', 'og:title', seo.title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', seo.description);
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', seo.title);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', seo.description);

    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    canonical?.setAttribute('href', canonicalUrl);
  }, [pathname]);

  return null;
};

export default SeoManager;
