/**
 * Student areas that are actually built. Everything else in the navigation
 * renders an honest "coming later" page, and links to it are labelled "Soon".
 * Add a route here in the same change that ships it.
 */
export const BUILT_STUDENT_ROUTES = new Set(["/app", "/app/settings", "/app/subjects", "/app/tutor", "/app/progress"]);

export const isBuilt = (href: string) => BUILT_STUDENT_ROUTES.has(href.split(/[?#]/)[0]);
