declare const __APP_VERSION__: string | undefined
declare const __DEPLOY_DATE__: string | undefined

export const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__
    ? __APP_VERSION__
    : '9e660dc'

export const DEPLOY_DATE =
  typeof __DEPLOY_DATE__ !== 'undefined' && __DEPLOY_DATE__
    ? __DEPLOY_DATE__
    : '10/10/2026'

export const BUILD_INFO_STRING = `${APP_VERSION} · ${DEPLOY_DATE}`
