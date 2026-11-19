import React from 'react';
import { Link } from 'react-router-dom';
import { EDITOR2_HOME_PATH, sectionPath, workspacePath } from '../services/pageIndex';

interface PageBreadcrumbProps {
  section?: string;
  parentTitle?: string;
  parentPageKey?: string;
  pageTitle?: string;
}

export const PageBreadcrumb: React.FC<PageBreadcrumbProps> = ({
  section,
  parentTitle,
  parentPageKey,
  pageTitle,
}) => (
  <nav className="e2-breadcrumb" aria-label="Ruta de navegación">
    <Link to={EDITOR2_HOME_PATH}>Páginas</Link>
    {section && (
      <>
        <span aria-hidden="true">/</span>
        <Link to={sectionPath(section)}>{section}</Link>
      </>
    )}
    {parentTitle && (
      <>
        <span aria-hidden="true">/</span>
        {parentPageKey
          ? <Link to={workspacePath(parentPageKey)}>{parentTitle}</Link>
          : <span>{parentTitle}</span>}
      </>
    )}
    {pageTitle && (
      <>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{pageTitle}</span>
      </>
    )}
  </nav>
);

export default PageBreadcrumb;
