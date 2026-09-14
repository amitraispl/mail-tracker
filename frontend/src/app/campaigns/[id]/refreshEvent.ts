/** Fired by RefreshButton so client components with their own fetched state
 *  (recipients list, activity feed) reload alongside the server component's
 *  router.refresh(), which never remounts them on its own. */
export const CAMPAIGN_REFRESH_EVENT = "mailtracker:campaign-refresh";
