/**
 * Identifies the deployed build. Pages embed it in a meta tag and compare it
 * against /version.json to notice that a newer deploy has landed.
 *
 * The value is fixed once by astro.config.mjs (which runs before anything is
 * rendered) so the meta tag and version.json can never disagree — deriving it
 * independently in both places would mismatch on every local build and put the
 * page into a reload loop.
 */
export const BUILD_ID = process.env.PUBLIC_BUILD_ID ?? 'dev';
