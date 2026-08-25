import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router";

/**
 * Aides de rendu pour les tests d'interface.
 *
 * Depuis l'introduction du routage, les écrans lisent leur état dans l'URL
 * (`useSearchParams`) et leur identifiant dans la route (`useParams`). Les
 * rendre suppose donc un routeur : `MemoryRouter` en fournit un sans
 * navigateur, et l'URL initiale devient une entrée du test — ce qui permet
 * justement de vérifier qu'un filtre passé dans l'URL est bien pris en compte.
 *
 * `renderToStaticMarkup` n'exécute pas les effets : ce qui est observé est le
 * premier rendu.
 */

/** Rend un composant sous un routeur, à l'URL donnée. */
export function renderAt(ui: React.ReactNode, initialPath = "/"): string {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>);
}

/**
 * Rend un composant **monté sur une route**, pour les écrans qui lisent un
 * paramètre de chemin (`/dossiers/:publicId`).
 */
export function renderRoute(routePath: string, element: React.ReactNode, initialPath: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path={routePath} element={element} />
      </Routes>
    </MemoryRouter>
  );
}

/**
 * Rend une coquille de mise en page (`<Outlet />`) avec un enfant, à l'URL
 * donnée — la forme sous laquelle `AppShell` est réellement utilisée.
 */
export function renderLayout(layout: React.ReactNode, child: React.ReactNode, initialPath: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={layout}>
          <Route path="*" element={child} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}
