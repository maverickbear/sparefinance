18:23:27.146 Running build in Washington, D.C., USA (East) – iad1
18:23:27.147 Build machine configuration: 2 cores, 8 GB
18:23:27.281 Cloning github.com/naortartarotti/spare-finance (Branch: main, Commit: 244f396)
18:23:28.427 Cloning completed: 1.145s
18:23:28.798 Restored build cache from previous deployment (5fWKoDaEXr8aDAkQT8riuxmHDqgk)
18:23:29.503 Running "vercel build"
18:23:29.893 Vercel CLI 48.9.0
18:23:30.341 Installing dependencies...
18:23:31.950 
18:23:31.951 added 3 packages in 1s
18:23:31.952 
18:23:31.953 163 packages are looking for funding
18:23:31.953   run `npm fund` for details
18:23:31.982 Detected Next.js version: 16.0.1
18:23:31.987 Running "npm run build"
18:23:32.096 
18:23:32.096 > spare-finance@0.1.0 build
18:23:32.097 > next build
18:23:32.097 
18:23:33.144    ▲ Next.js 16.0.1 (Turbopack)
18:23:33.145 
18:23:33.176  ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
18:23:33.218    Creating an optimized production build ...
18:23:58.169  ✓ Compiled successfully in 24.4s
18:23:58.198    Running TypeScript ...
18:24:13.404    Collecting page data ...
18:24:14.061    Generating static pages (0/49) ...
18:24:14.426 [LAYOUT-WRAPPER] Render: {
18:24:14.427   pathname: '/_not-found',
18:24:14.428   isAuthPage: false,
18:24:14.428   isAcceptPage: false,
18:24:14.429   isSelectPlanPage: false,
18:24:14.429   isWelcomePage: false,
18:24:14.430   checking: true,
18:24:14.430   hasSubscription: true,
18:24:14.430   subscriptionChecked: false
18:24:14.431 }
18:24:14.431 [LAYOUT-WRAPPER] Render decision: {
18:24:14.431   shouldShowNav: true,
18:24:14.432   checking: true,
18:24:14.432   hasSubscription: true,
18:24:14.432   isAuthPage: false,
18:24:14.433   isAcceptPage: false,
18:24:14.433   isSelectPlanPage: false,
18:24:14.433   isWelcomePage: false,
18:24:14.433   isApiRoute: false,
18:24:14.434   isDashboardRoute: true
18:24:14.434 }
18:24:14.434 [LAYOUT-WRAPPER] Rendering normal layout with nav {
18:24:14.435   showNav: true,
18:24:14.435   hasSubscription: true,
18:24:14.435   isDashboardRoute: true,
18:24:14.436   checking: true
18:24:14.436 }
18:24:14.438 [NAV] Render: { hasSubscription: true, pathname: '/_not-found' }
18:24:14.439 [NAV] Rendering nav component
18:24:14.441 [BOTTOM-NAV] Render: { hasSubscription: true, pathname: '/_not-found' }
18:24:14.441 [BOTTOM-NAV] Rendering bottom nav component
18:24:14.447  ⨯ useSearchParams() should be wrapped in a suspense boundary at page "/404". Read more: https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
18:24:14.447     at S (/vercel/path0/.next/server/chunks/ssr/node_modules_next_9c24ba8d._.js:2:2111)
18:24:14.448     at p (/vercel/path0/.next/server/chunks/ssr/node_modules_next_9c24ba8d._.js:4:4847)
18:24:14.449     at j (/vercel/path0/.next/server/chunks/ssr/[root-of-the-server]__92146656._.js:1:4090)
18:24:14.449     at ir (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page-turbo.runtime.prod.js:2:84433)
18:24:14.449     at ia (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page-turbo.runtime.prod.js:2:86252)
18:24:14.449     at il (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page-turbo.runtime.prod.js:2:107981)
18:24:14.449     at is (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page-turbo.runtime.prod.js:2:105399)
18:24:14.449     at ig (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page-turbo.runtime.prod.js:2:112864)
18:24:14.449     at iu (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page-turbo.runtime.prod.js:2:110013)
18:24:14.449     at il (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page-turbo.runtime.prod.js:2:108259)
18:24:14.450 Error occurred prerendering page "/_not-found". Read more: https://nextjs.org/docs/messages/prerender-error
18:24:14.450 Export encountered an error on /_not-found/page: /_not-found, exiting the build.
18:24:14.466  ⨯ Next.js build worker exited with code: 1 and signal: null
18:24:14.512 Error: Command "npm run build" exited with 1