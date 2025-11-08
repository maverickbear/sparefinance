22:35:39.004 Running build in Washington, D.C., USA (East) – iad1
22:35:39.004 Build machine configuration: 2 cores, 8 GB
22:35:39.172 Cloning github.com/naortartarotti/spare-finance (Branch: main, Commit: 5a486f8)
22:35:39.777 Cloning completed: 605.000ms
22:35:40.337 Restored build cache from previous deployment (5fWKoDaEXr8aDAkQT8riuxmHDqgk)
22:35:41.062 Running "vercel build"
22:35:41.462 Vercel CLI 48.9.0
22:35:41.824 Installing dependencies...
22:35:43.679 
22:35:43.680 added 3 packages in 2s
22:35:43.680 
22:35:43.681 163 packages are looking for funding
22:35:43.681   run `npm fund` for details
22:35:43.715 Detected Next.js version: 16.0.1
22:35:43.720 Running "npm run build"
22:35:44.454 
22:35:44.455 > spare-finance@0.1.0 build
22:35:44.456 > next build
22:35:44.456 
22:35:45.507    ▲ Next.js 16.0.1 (Turbopack)
22:35:45.509 
22:35:45.539  ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
22:35:45.581    Creating an optimized production build ...
22:36:11.707  ✓ Compiled successfully in 25.5s
22:36:11.739    Running TypeScript ...
22:36:28.555    Collecting page data ...
22:36:29.250    Generating static pages (0/49) ...
22:36:29.646 [LAYOUT-WRAPPER] Render: {
22:36:29.647   pathname: '/_not-found',
22:36:29.647   isAuthPage: false,
22:36:29.647   isAcceptPage: false,
22:36:29.648   isSelectPlanPage: false,
22:36:29.648   isWelcomePage: false,
22:36:29.648   checking: true,
22:36:29.649   hasSubscription: true,
22:36:29.649   subscriptionChecked: false
22:36:29.649 }
22:36:29.649 [LAYOUT-WRAPPER] Render decision: {
22:36:29.650   shouldShowNav: true,
22:36:29.650   checking: true,
22:36:29.650   hasSubscription: true,
22:36:29.650   isAuthPage: false,
22:36:29.651   isAcceptPage: false,
22:36:29.651   isSelectPlanPage: false,
22:36:29.651   isWelcomePage: false,
22:36:29.651   isApiRoute: false,
22:36:29.652   isDashboardRoute: true
22:36:29.652 }
22:36:29.652 [LAYOUT-WRAPPER] Rendering normal layout with nav {
22:36:29.652   showNav: true,
22:36:29.653   hasSubscription: true,
22:36:29.653   isDashboardRoute: true,
22:36:29.653   checking: true
22:36:29.653 }
22:36:29.654 [NAV] Render: { hasSubscription: true, pathname: '/_not-found' }
22:36:29.654 [NAV] Rendering nav component
22:36:29.658 [BOTTOM-NAV] Render: { hasSubscription: true, pathname: '/_not-found' }
22:36:29.659 [BOTTOM-NAV] Rendering bottom nav component
22:36:29.683 [AUTH-REQUIRED-LAYOUT] Executing
22:36:29.695 [LAYOUT-WRAPPER] Render: {
22:36:29.696   pathname: '/select-plan',
22:36:29.697   isAuthPage: false,
22:36:29.697   isAcceptPage: false,
22:36:29.698   isSelectPlanPage: true,
22:36:29.698   isWelcomePage: false,
22:36:29.699   checking: true,
22:36:29.707   hasSubscription: false,
22:36:29.708   subscriptionChecked: false
22:36:29.708 }
22:36:29.708 [LAYOUT-WRAPPER] Render decision: {
22:36:29.709   shouldShowNav: false,
22:36:29.709   checking: true,
22:36:29.710   hasSubscription: false,
22:36:29.710   isAuthPage: false,
22:36:29.710   isAcceptPage: false,
22:36:29.711   isSelectPlanPage: true,
22:36:29.711   isWelcomePage: false,
22:36:29.712   isApiRoute: false,
22:36:29.712   isDashboardRoute: false
22:36:29.712 }
22:36:29.712 [LAYOUT-WRAPPER] Rendering select-plan/welcome page
22:36:29.713 [NAV] Render: { hasSubscription: false, pathname: '/select-plan' }
22:36:29.713 [NAV] Returning null (no subscription)
22:36:29.714 [BOTTOM-NAV] Render: { hasSubscription: false, pathname: '/select-plan' }
22:36:29.714 [BOTTOM-NAV] Returning null (no subscription)
22:36:29.716 [AUTH-REQUIRED-LAYOUT] Executing
22:36:29.717 [LAYOUT-WRAPPER] Render: {
22:36:29.717   pathname: '/welcome',
22:36:29.717   isAuthPage: false,
22:36:29.718   isAcceptPage: false,
22:36:29.718   isSelectPlanPage: false,
22:36:29.718   isWelcomePage: true,
22:36:29.720   checking: true,
22:36:29.730   hasSubscription: false,
22:36:29.731   subscriptionChecked: false
22:36:29.731 }
22:36:29.731 [LAYOUT-WRAPPER] Render decision: {
22:36:29.732   shouldShowNav: false,
22:36:29.732   checking: true,
22:36:29.732   hasSubscription: false,
22:36:29.733   isAuthPage: false,
22:36:29.734   isAcceptPage: false,
22:36:29.734   isSelectPlanPage: false,
22:36:29.734   isWelcomePage: true,
22:36:29.735   isApiRoute: false,
22:36:29.735   isDashboardRoute: false
22:36:29.735 }
22:36:29.736 [LAYOUT-WRAPPER] Rendering select-plan/welcome page
22:36:29.736 [NAV] Render: { hasSubscription: false, pathname: '/welcome' }
22:36:29.736 [NAV] Returning null (no subscription)
22:36:29.737 [BOTTOM-NAV] Render: { hasSubscription: false, pathname: '/welcome' }
22:36:29.737 [BOTTOM-NAV] Returning null (no subscription)
22:36:29.740 [PROTECTED-LAYOUT] Executing
22:36:29.762 [LAYOUT-WRAPPER] Render: {
22:36:29.763   pathname: '/accounts',
22:36:29.764   isAuthPage: false,
22:36:29.764   isAcceptPage: false,
22:36:29.765   isSelectPlanPage: false,
22:36:29.765   isWelcomePage: false,
22:36:29.765   checking: true,
22:36:29.766   hasSubscription: true,
22:36:29.766   subscriptionChecked: false
22:36:29.766 }
22:36:29.767 [LAYOUT-WRAPPER] Render decision: {
22:36:29.767   shouldShowNav: true,
22:36:29.767   checking: true,
22:36:29.768   hasSubscription: true,
22:36:29.768   isAuthPage: false,
22:36:29.768   isAcceptPage: false,
22:36:29.769   isSelectPlanPage: false,
22:36:29.769   isWelcomePage: false,
22:36:29.770   isApiRoute: false,
22:36:29.770   isDashboardRoute: true
22:36:29.770 }
22:36:29.771 [LAYOUT-WRAPPER] Rendering normal layout with nav {
22:36:29.771   showNav: true,
22:36:29.771   hasSubscription: true,
22:36:29.772   isDashboardRoute: true,
22:36:29.772   checking: true
22:36:29.772 }
22:36:29.772 [NAV] Render: { hasSubscription: true, pathname: '/accounts' }
22:36:29.773 [NAV] Rendering nav component
22:36:29.773 [BOTTOM-NAV] Render: { hasSubscription: true, pathname: '/accounts' }
22:36:29.773 [BOTTOM-NAV] Rendering bottom nav component
22:36:29.777 [PROTECTED-LAYOUT] Executing
22:36:29.786 [LAYOUT-WRAPPER] Render: {
22:36:29.787   pathname: '/billing',
22:36:29.787   isAuthPage: false,
22:36:29.788   isAcceptPage: false,
22:36:29.788   isSelectPlanPage: false,
22:36:29.789   isWelcomePage: false,
22:36:29.789   checking: true,
22:36:29.789   hasSubscription: true,
22:36:29.790   subscriptionChecked: false
22:36:29.790 }
22:36:29.790 [LAYOUT-WRAPPER] Render decision: {
22:36:29.791   shouldShowNav: true,
22:36:29.791   checking: true,
22:36:29.791   hasSubscription: true,
22:36:29.792   isAuthPage: false,
22:36:29.792   isAcceptPage: false,
22:36:29.792   isSelectPlanPage: false,
22:36:29.793   isWelcomePage: false,
22:36:29.793   isApiRoute: false,
22:36:29.793   isDashboardRoute: true
22:36:29.794 }
22:36:29.794 [LAYOUT-WRAPPER] Rendering normal layout with nav {
22:36:29.794   showNav: true,
22:36:29.795   hasSubscription: true,
22:36:29.795   isDashboardRoute: true,
22:36:29.795   checking: true
22:36:29.796 }
22:36:29.796 [NAV] Render: { hasSubscription: true, pathname: '/billing' }
22:36:29.796 [NAV] Rendering nav component
22:36:29.799 [BOTTOM-NAV] Render: { hasSubscription: true, pathname: '/billing' }
22:36:29.799 [BOTTOM-NAV] Rendering bottom nav component
22:36:29.800 [PROTECTED-LAYOUT] Executing
22:36:29.809 [LAYOUT-WRAPPER] Render: {
22:36:29.809   pathname: '/budgets',
22:36:29.809   isAuthPage: false,
22:36:29.809   isAcceptPage: false,
22:36:29.809   isSelectPlanPage: false,
22:36:29.809   isWelcomePage: false,
22:36:29.809   checking: true,
22:36:29.809   hasSubscription: true,
22:36:29.809   subscriptionChecked: false
22:36:29.809 }
22:36:29.809 [LAYOUT-WRAPPER] Render decision: {
22:36:29.810   shouldShowNav: true,
22:36:29.810   checking: true,
22:36:29.810   hasSubscription: true,
22:36:29.810   isAuthPage: false,
22:36:29.810   isAcceptPage: false,
22:36:29.810   isSelectPlanPage: false,
22:36:29.810   isWelcomePage: false,
22:36:29.810   isApiRoute: false,
22:36:29.810   isDashboardRoute: true
22:36:29.810 }
22:36:29.810 [LAYOUT-WRAPPER] Rendering normal layout with nav {
22:36:29.810   showNav: true,
22:36:29.810   hasSubscription: true,
22:36:29.810   isDashboardRoute: true,
22:36:29.810   checking: true
22:36:29.810 }
22:36:29.810 [NAV] Render: { hasSubscription: true, pathname: '/budgets' }
22:36:29.810 [NAV] Rendering nav component
22:36:29.816 [BOTTOM-NAV] Render: { hasSubscription: true, pathname: '/budgets' }
22:36:29.816 [BOTTOM-NAV] Rendering bottom nav component
22:36:29.818 [PROTECTED-LAYOUT] Executing
22:36:29.850 [LAYOUT-WRAPPER] Render: {
22:36:29.850   pathname: '/categories',
22:36:29.850   isAuthPage: false,
22:36:29.850   isAcceptPage: false,
22:36:29.851   isSelectPlanPage: false,
22:36:29.851   isWelcomePage: false,
22:36:29.851   checking: true,
22:36:29.851   hasSubscription: true,
22:36:29.851   subscriptionChecked: false
22:36:29.851 }
22:36:29.851 [LAYOUT-WRAPPER] Render decision: {
22:36:29.851   shouldShowNav: true,
22:36:29.851   checking: true,
22:36:29.851   hasSubscription: true,
22:36:29.851   isAuthPage: false,
22:36:29.851   isAcceptPage: false,
22:36:29.851   isSelectPlanPage: false,
22:36:29.851   isWelcomePage: false,
22:36:29.853   isApiRoute: false,
22:36:29.854   isDashboardRoute: true
22:36:29.854 }
22:36:29.854 [LAYOUT-WRAPPER] Rendering normal layout with nav {
22:36:29.854   showNav: true,
22:36:29.854   hasSubscription: true,
22:36:29.854   isDashboardRoute: true,
22:36:29.854   checking: true
22:36:29.854 }
22:36:29.854 [NAV] Render: { hasSubscription: true, pathname: '/categories' }
22:36:29.854 [NAV] Rendering nav component
22:36:29.854 [BOTTOM-NAV] Render: { hasSubscription: true, pathname: '/categories' }
22:36:29.854 [BOTTOM-NAV] Rendering bottom nav component
22:36:29.933 [PROTECTED-LAYOUT] Executing
22:36:29.937 [LAYOUT-WRAPPER] Render: {
22:36:29.938   pathname: '/dashboard',
22:36:29.938   isAuthPage: false,
22:36:29.940   isAcceptPage: false,
22:36:29.941   isSelectPlanPage: false,
22:36:29.941   isWelcomePage: false,
22:36:29.941   checking: true,
22:36:29.942   hasSubscription: true,
22:36:29.942   subscriptionChecked: false
22:36:29.942 }
22:36:29.943 [LAYOUT-WRAPPER] Render decision: {
22:36:29.943   shouldShowNav: true,
22:36:29.943   checking: true,
22:36:29.944   hasSubscription: true,
22:36:29.944   isAuthPage: false,
22:36:29.944   isAcceptPage: false,
22:36:29.944   isSelectPlanPage: false,
22:36:29.945   isWelcomePage: false,
22:36:29.945   isApiRoute: false,
22:36:29.946   isDashboardRoute: true
22:36:29.946 }
22:36:29.946 [LAYOUT-WRAPPER] Rendering normal layout with nav {
22:36:29.946   showNav: true,
22:36:29.949   hasSubscription: true,
22:36:29.949   isDashboardRoute: true,
22:36:29.950   checking: true
22:36:29.950 }
22:36:29.950 [NAV] Render: { hasSubscription: true, pathname: '/dashboard' }
22:36:29.951 [NAV] Rendering nav component
22:36:29.953 [BOTTOM-NAV] Render: { hasSubscription: true, pathname: '/dashboard' }
22:36:29.953 [BOTTOM-NAV] Rendering bottom nav component
22:36:29.954 [PROTECTED-LAYOUT] Executing
22:36:29.960 [LAYOUT-WRAPPER] Render: {
22:36:29.961   pathname: '/debts',
22:36:29.961   isAuthPage: false,
22:36:29.962   isAcceptPage: false,
22:36:29.962   isSelectPlanPage: false,
22:36:29.962   isWelcomePage: false,
22:36:29.963   checking: true,
22:36:29.963   hasSubscription: true,
22:36:29.963   subscriptionChecked: false
22:36:29.964 }
22:36:29.964 [LAYOUT-WRAPPER] Render decision: {
22:36:29.964   shouldShowNav: true,
22:36:29.965   checking: true,
22:36:29.965   hasSubscription: true,
22:36:29.965   isAuthPage: false,
22:36:29.966   isAcceptPage: false,
22:36:29.966   isSelectPlanPage: false,
22:36:29.966   isWelcomePage: false,
22:36:29.967   isApiRoute: false,
22:36:29.967   isDashboardRoute: true
22:36:29.967 }
22:36:29.968 [LAYOUT-WRAPPER] Rendering normal layout with nav {
22:36:29.968   showNav: true,
22:36:29.968   hasSubscription: true,
22:36:29.969   isDashboardRoute: true,
22:36:29.969   checking: true
22:36:29.969 }
22:36:29.970 [NAV] Render: { hasSubscription: true, pathname: '/debts' }
22:36:29.970 [NAV] Rendering nav component
22:36:29.972 [BOTTOM-NAV] Render: { hasSubscription: true, pathname: '/debts' }
22:36:29.973 [BOTTOM-NAV] Rendering bottom nav component
22:36:29.973 [PROTECTED-LAYOUT] Executing
22:36:29.975 [LAYOUT-WRAPPER] Render: {
22:36:29.976   pathname: '/goals',
22:36:29.976   isAuthPage: false,
22:36:29.976   isAcceptPage: false,
22:36:29.977   isSelectPlanPage: false,
22:36:29.977   isWelcomePage: false,
22:36:29.977   checking: true,
22:36:29.977   hasSubscription: true,
22:36:29.978   subscriptionChecked: false
22:36:29.978 }
22:36:29.978 [LAYOUT-WRAPPER] Render decision: {
22:36:29.979   shouldShowNav: true,
22:36:29.979   checking: true,
22:36:29.979   hasSubscription: true,
22:36:29.979   isAuthPage: false,
22:36:29.980   isAcceptPage: false,
22:36:29.980   isSelectPlanPage: false,
22:36:29.980   isWelcomePage: false,
22:36:29.981   isApiRoute: false,
22:36:29.981   isDashboardRoute: true
22:36:29.981 }
22:36:29.982 [LAYOUT-WRAPPER] Rendering normal layout with nav {
22:36:29.982   showNav: true,
22:36:29.982   hasSubscription: true,
22:36:29.982   isDashboardRoute: true,
22:36:29.983   checking: true
22:36:29.983 }
22:36:29.983 [NAV] Render: { hasSubscription: true, pathname: '/goals' }
22:36:29.984 [NAV] Rendering nav component
22:36:29.986 [BOTTOM-NAV] Render: { hasSubscription: true, pathname: '/goals' }
22:36:29.987 [BOTTOM-NAV] Rendering bottom nav component
22:36:29.991 [PROTECTED-LAYOUT] Executing
22:36:30.006 [LAYOUT-WRAPPER] Render: {
22:36:30.006   pathname: '/help-support',
22:36:30.006   isAuthPage: false,
22:36:30.006   isAcceptPage: false,
22:36:30.006   isSelectPlanPage: false,
22:36:30.006   isWelcomePage: false,
22:36:30.006   checking: true,
22:36:30.006   hasSubscription: true,
22:36:30.006   subscriptionChecked: false
22:36:30.006 }
22:36:30.006 [LAYOUT-WRAPPER] Render decision: {
22:36:30.006   shouldShowNav: true,
22:36:30.006   checking: true,
22:36:30.006   hasSubscription: true,
22:36:30.006   isAuthPage: false,
22:36:30.006   isAcceptPage: false,
22:36:30.007   isSelectPlanPage: false,
22:36:30.007   isWelcomePage: false,
22:36:30.007   isApiRoute: false,
22:36:30.007   isDashboardRoute: true
22:36:30.007 }
22:36:30.007 [LAYOUT-WRAPPER] Rendering normal layout with nav {
22:36:30.007   showNav: true,
22:36:30.007   hasSubscription: true,
22:36:30.007   isDashboardRoute: true,
22:36:30.007   checking: true
22:36:30.007 }
22:36:30.007 [NAV] Render: { hasSubscription: true, pathname: '/help-support' }
22:36:30.007 [NAV] Rendering nav component
22:36:30.007 [BOTTOM-NAV] Render: { hasSubscription: true, pathname: '/help-support' }
22:36:30.007 [BOTTOM-NAV] Rendering bottom nav component
22:36:30.008    Generating static pages (12/49) 
22:36:30.008 [PROTECTED-LAYOUT] Executing
22:36:30.016 [LAYOUT-WRAPPER] Render: {
22:36:30.016   pathname: '/investments',
22:36:30.016   isAuthPage: false,
22:36:30.016   isAcceptPage: false,
22:36:30.016   isSelectPlanPage: false,
22:36:30.016   isWelcomePage: false,
22:36:30.016   checking: true,
22:36:30.016   hasSubscription: true,
22:36:30.016   subscriptionChecked: false
22:36:30.017 }
22:36:30.017 [LAYOUT-WRAPPER] Render decision: {
22:36:30.017   shouldShowNav: true,
22:36:30.017   checking: true,
22:36:30.017   hasSubscription: true,
22:36:30.017   isAuthPage: false,
22:36:30.017   isAcceptPage: false,
22:36:30.017   isSelectPlanPage: false,
22:36:30.017   isWelcomePage: false,
22:36:30.017   isApiRoute: false,
22:36:30.017   isDashboardRoute: true
22:36:30.017 }
22:36:30.018 [LAYOUT-WRAPPER] Rendering normal layout with nav {
22:36:30.018   showNav: true,
22:36:30.018   hasSubscription: true,
22:36:30.018   isDashboardRoute: true,
22:36:30.018   checking: true
22:36:30.018 }
22:36:30.018 [NAV] Render: { hasSubscription: true, pathname: '/investments' }
22:36:30.018 [NAV] Rendering nav component
22:36:30.021 [BOTTOM-NAV] Render: { hasSubscription: true, pathname: '/investments' }
22:36:30.021 [BOTTOM-NAV] Rendering bottom nav component
22:36:30.025 [PROTECTED-LAYOUT] Executing
22:36:30.032 [LAYOUT-WRAPPER] Render: {
22:36:30.032   pathname: '/members',
22:36:30.032   isAuthPage: false,
22:36:30.032   isAcceptPage: false,
22:36:30.032   isSelectPlanPage: false,
22:36:30.033   isWelcomePage: false,
22:36:30.033   checking: true,
22:36:30.033   hasSubscription: true,
22:36:30.033   subscriptionChecked: false
22:36:30.034 }
22:36:30.034 [LAYOUT-WRAPPER] Render decision: {
22:36:30.034   shouldShowNav: true,
22:36:30.034   checking: true,
22:36:30.035   hasSubscription: true,
22:36:30.035   isAuthPage: false,
22:36:30.035   isAcceptPage: false,
22:36:30.035   isSelectPlanPage: false,
22:36:30.035   isWelcomePage: false,
22:36:30.036   isApiRoute: false,
22:36:30.036   isDashboardRoute: true
22:36:30.036 }
22:36:30.036 [LAYOUT-WRAPPER] Rendering normal layout with nav {
22:36:30.037   showNav: true,
22:36:30.037   hasSubscription: true,
22:36:30.037   isDashboardRoute: true,
22:36:30.037   checking: true
22:36:30.038 }
22:36:30.038 [NAV] Render: { hasSubscription: true, pathname: '/members' }
22:36:30.038 [NAV] Rendering nav component
22:36:30.042 [BOTTOM-NAV] Render: { hasSubscription: true, pathname: '/members' }
22:36:30.044 [BOTTOM-NAV] Rendering bottom nav component
22:36:30.056 [LAYOUT-WRAPPER] Render: {
22:36:30.056   pathname: '/',
22:36:30.057   isAuthPage: false,
22:36:30.057   isAcceptPage: false,
22:36:30.057   isSelectPlanPage: false,
22:36:30.057   isWelcomePage: false,
22:36:30.058   checking: true,
22:36:30.058   hasSubscription: false,
22:36:30.058   subscriptionChecked: false
22:36:30.058 }
22:36:30.059 [LAYOUT-WRAPPER] Render decision: {
22:36:30.060   shouldShowNav: false,
22:36:30.060   checking: true,
22:36:30.060   hasSubscription: false,
22:36:30.060   isAuthPage: false,
22:36:30.061   isAcceptPage: false,
22:36:30.061   isSelectPlanPage: false,
22:36:30.061   isWelcomePage: false,
22:36:30.061   isApiRoute: false,
22:36:30.062   isDashboardRoute: false
22:36:30.062 }
22:36:30.063 [LAYOUT-WRAPPER] Rendering public page or API route
22:36:30.086 [PROTECTED-LAYOUT] Executing
22:36:30.100 [LAYOUT-WRAPPER] Render: {
22:36:30.100   pathname: '/privacy-policy',
22:36:30.100   isAuthPage: false,
22:36:30.100   isAcceptPage: false,
22:36:30.100   isSelectPlanPage: false,
22:36:30.100   isWelcomePage: false,
22:36:30.100   checking: true,
22:36:30.100   hasSubscription: true,
22:36:30.100   subscriptionChecked: false
22:36:30.100 }
22:36:30.100 [LAYOUT-WRAPPER] Render decision: {
22:36:30.100   shouldShowNav: true,
22:36:30.100   checking: true,
22:36:30.100   hasSubscription: true,
22:36:30.100   isAuthPage: false,
22:36:30.100   isAcceptPage: false,
22:36:30.100   isSelectPlanPage: false,
22:36:30.100   isWelcomePage: false,
22:36:30.101   isApiRoute: false,
22:36:30.101   isDashboardRoute: true
22:36:30.101 }
22:36:30.101 [LAYOUT-WRAPPER] Rendering normal layout with nav {
22:36:30.101   showNav: true,
22:36:30.101   hasSubscription: true,
22:36:30.101   isDashboardRoute: true,
22:36:30.101   checking: true
22:36:30.101 }
22:36:30.101 [NAV] Render: { hasSubscription: true, pathname: '/privacy-policy' }
22:36:30.101 [NAV] Rendering nav component
22:36:30.104 [BOTTOM-NAV] Render: { hasSubscription: true, pathname: '/privacy-policy' }
22:36:30.104 [BOTTOM-NAV] Rendering bottom nav component
22:36:30.216 [PROTECTED-LAYOUT] Executing
22:36:30.219 [LAYOUT-WRAPPER] Render: {
22:36:30.221   pathname: '/profile',
22:36:30.221   isAuthPage: false,
22:36:30.221   isAcceptPage: false,
22:36:30.222   isSelectPlanPage: false,
22:36:30.222   isWelcomePage: false,
22:36:30.222   checking: true,
22:36:30.223   hasSubscription: true,
22:36:30.223   subscriptionChecked: false
22:36:30.223 }
22:36:30.223 [LAYOUT-WRAPPER] Render decision: {
22:36:30.224   shouldShowNav: true,
22:36:30.224   checking: true,
22:36:30.224   hasSubscription: true,
22:36:30.224   isAuthPage: false,
22:36:30.225   isAcceptPage: false,
22:36:30.225   isSelectPlanPage: false,
22:36:30.225   isWelcomePage: false,
22:36:30.226   isApiRoute: false,
22:36:30.226   isDashboardRoute: true
22:36:30.226 }
22:36:30.226 [LAYOUT-WRAPPER] Rendering normal layout with nav {
22:36:30.227   showNav: true,
22:36:30.227   hasSubscription: true,
22:36:30.227   isDashboardRoute: true,
22:36:30.227   checking: true
22:36:30.228 }
22:36:30.228 [NAV] Render: { hasSubscription: true, pathname: '/profile' }
22:36:30.228 [NAV] Rendering nav component
22:36:30.230 [BOTTOM-NAV] Render: { hasSubscription: true, pathname: '/profile' }
22:36:30.231 [BOTTOM-NAV] Rendering bottom nav component
22:36:30.231 [PROTECTED-LAYOUT] Executing
22:36:30.233 Error in getCurrentUserLimits: Error: Dynamic server usage: Route /reports couldn't be rendered statically because it used `cookies`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error
22:36:30.233     at x (.next/server/chunks/ssr/_6118859c._.js:1:8970)
22:36:30.234     at n (.next/server/chunks/ssr/_6118859c._.js:4:9863)
22:36:30.234     at cm (.next/server/chunks/ssr/_6118859c._.js:41:6164)
22:36:30.234     at k (.next/server/chunks/ssr/_42fbffa0._.js:51:10208)
22:36:30.234     at i (.next/server/chunks/ssr/[root-of-the-server]__2920ffe8._.js:1:2051)
22:36:30.235     at stringify (<anonymous>) {
22:36:30.235   description: "Route /reports couldn't be rendered statically because it used `cookies`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error",
22:36:30.235   digest: 'DYNAMIC_SERVER_USAGE'
22:36:30.236 }
22:36:30.236 ⚠️ [getBudgets] Could not get tokens: Dynamic server usage: Route /reports couldn't be rendered statically because it used `cookies`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error
22:36:30.239 [PROTECTED-LAYOUT] Executing
22:36:30.243 [LAYOUT-WRAPPER] Render: {
22:36:30.243   pathname: '/terms-of-use',
22:36:30.245   isAuthPage: false,
22:36:30.245   isAcceptPage: false,
22:36:30.246   isSelectPlanPage: false,
22:36:30.246   isWelcomePage: false,
22:36:30.246   checking: true,
22:36:30.246   hasSubscription: true,
22:36:30.247   subscriptionChecked: false
22:36:30.247 }
22:36:30.247 [LAYOUT-WRAPPER] Render decision: {
22:36:30.247   shouldShowNav: true,
22:36:30.248   checking: true,
22:36:30.248   hasSubscription: true,
22:36:30.249   isAuthPage: false,
22:36:30.249   isAcceptPage: false,
22:36:30.249   isSelectPlanPage: false,
22:36:30.249   isWelcomePage: false,
22:36:30.250   isApiRoute: false,
22:36:30.250   isDashboardRoute: true
22:36:30.250 }
22:36:30.250 [LAYOUT-WRAPPER] Rendering normal layout with nav {
22:36:30.250   showNav: true,
22:36:30.251   hasSubscription: true,
22:36:30.251   isDashboardRoute: true,
22:36:30.251   checking: true
22:36:30.251 }
22:36:30.251 [NAV] Render: { hasSubscription: true, pathname: '/terms-of-use' }
22:36:30.251 [NAV] Rendering nav component
22:36:30.253 [BOTTOM-NAV] Render: { hasSubscription: true, pathname: '/terms-of-use' }
22:36:30.253 [BOTTOM-NAV] Rendering bottom nav component
22:36:30.254 [PROTECTED-LAYOUT] Executing
22:36:30.257 [LAYOUT-WRAPPER] Render: {
22:36:30.258   pathname: '/settings',
22:36:30.258   isAuthPage: false,
22:36:30.258   isAcceptPage: false,
22:36:30.258   isSelectPlanPage: false,
22:36:30.259   isWelcomePage: false,
22:36:30.259   checking: true,
22:36:30.259   hasSubscription: true,
22:36:30.259   subscriptionChecked: false
22:36:30.260 }
22:36:30.260 [LAYOUT-WRAPPER] Render decision: {
22:36:30.260   shouldShowNav: true,
22:36:30.260   checking: true,
22:36:30.260   hasSubscription: true,
22:36:30.260   isAuthPage: false,
22:36:30.261   isAcceptPage: false,
22:36:30.261   isSelectPlanPage: false,
22:36:30.261   isWelcomePage: false,
22:36:30.261   isApiRoute: false,
22:36:30.261   isDashboardRoute: true
22:36:30.261 }
22:36:30.261 [LAYOUT-WRAPPER] Rendering normal layout with nav {
22:36:30.261   showNav: true,
22:36:30.261   hasSubscription: true,
22:36:30.262   isDashboardRoute: true,
22:36:30.262   checking: true
22:36:30.262 }
22:36:30.263 [NAV] Render: { hasSubscription: true, pathname: '/settings' }
22:36:30.263 [NAV] Rendering nav component
22:36:30.265 [BOTTOM-NAV] Render: { hasSubscription: true, pathname: '/settings' }
22:36:30.265 [BOTTOM-NAV] Rendering bottom nav component
22:36:30.269 [PROTECTED-LAYOUT] Executing
22:36:30.277 [LAYOUT-WRAPPER] Render: {
22:36:30.277   pathname: '/transactions',
22:36:30.283   isAuthPage: false,
22:36:30.284   isAcceptPage: false,
22:36:30.285   isSelectPlanPage: false,
22:36:30.285   isWelcomePage: false,
22:36:30.285   checking: true,
22:36:30.285   hasSubscription: true,
22:36:30.286   subscriptionChecked: false
22:36:30.286 }
22:36:30.286 [LAYOUT-WRAPPER] Render decision: {
22:36:30.286   shouldShowNav: true,
22:36:30.287   checking: true,
22:36:30.287   hasSubscription: true,
22:36:30.287   isAuthPage: false,
22:36:30.287   isAcceptPage: false,
22:36:30.288   isSelectPlanPage: false,
22:36:30.288   isWelcomePage: false,
22:36:30.288   isApiRoute: false,
22:36:30.288   isDashboardRoute: true
22:36:30.289 }
22:36:30.289 [LAYOUT-WRAPPER] Rendering normal layout with nav {
22:36:30.289   showNav: true,
22:36:30.289   hasSubscription: true,
22:36:30.290   isDashboardRoute: true,
22:36:30.290   checking: true
22:36:30.290 }
22:36:30.290 [NAV] Render: { hasSubscription: true, pathname: '/transactions' }
22:36:30.291 [NAV] Rendering nav component
22:36:30.293 [BOTTOM-NAV] Render: { hasSubscription: true, pathname: '/transactions' }
22:36:30.293 [BOTTOM-NAV] Rendering bottom nav component
22:36:30.751 ⚠️ [getTransactions] Could not get tokens: Dynamic server usage: Route /reports couldn't be rendered statically because it used `cookies`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error
22:36:30.754 🔍 [getTransactionsInternal] Applying date filters: {
22:36:30.755   startDate: {
22:36:30.755     original: '2025-11-01T00:00:00.000Z',
22:36:30.755     formatted: '2025-11-01 00:00:00'
22:36:30.756   },
22:36:30.756   endDate: {
22:36:30.757     original: '2025-11-30T23:59:59.999Z',
22:36:30.757     formatted: '2025-11-30 23:59:59'
22:36:30.757   }
22:36:30.758 }
22:36:30.758 🔍 [getTransactionsInternal] Executing query with filters: {
22:36:30.759   hasStartDate: true,
22:36:30.759   hasEndDate: true,
22:36:30.759   type: undefined,
22:36:30.760   categoryId: undefined,
22:36:30.760   accountId: undefined
22:36:30.760 }
22:36:30.761 🔍 [getTransactionsInternal] User not authenticated: { authError: 'Auth session missing!', hasUser: false }
22:36:30.763 [LAYOUT-WRAPPER] Render: {
22:36:30.764   pathname: '/reports',
22:36:30.764   isAuthPage: false,
22:36:30.765   isAcceptPage: false,
22:36:30.765   isSelectPlanPage: false,
22:36:30.765   isWelcomePage: false,
22:36:30.766   checking: true,
22:36:30.766   hasSubscription: true,
22:36:30.766   subscriptionChecked: false
22:36:30.767 }
22:36:30.767 [LAYOUT-WRAPPER] Render decision: {
22:36:30.768   shouldShowNav: true,
22:36:30.768   checking: true,
22:36:30.768   hasSubscription: true,
22:36:30.769   isAuthPage: false,
22:36:30.769   isAcceptPage: false,
22:36:30.770   isSelectPlanPage: false,
22:36:30.770   isWelcomePage: false,
22:36:30.771   isApiRoute: false,
22:36:30.771   isDashboardRoute: true
22:36:30.771 }
22:36:30.772 [LAYOUT-WRAPPER] Rendering normal layout with nav {
22:36:30.772   showNav: true,
22:36:30.773   hasSubscription: true,
22:36:30.773   isDashboardRoute: true,
22:36:30.773   checking: true
22:36:30.774 }
22:36:30.774 [NAV] Render: { hasSubscription: true, pathname: '/reports' }
22:36:30.774 [NAV] Rendering nav component
22:36:30.777 [BOTTOM-NAV] Render: { hasSubscription: true, pathname: '/reports' }
22:36:30.778 [BOTTOM-NAV] Rendering bottom nav component
22:36:30.778    Generating static pages (24/49) 
22:36:30.860    Generating static pages (36/49) 
22:36:30.905 [LAYOUT-WRAPPER] Render: {
22:36:30.906   pathname: '/auth/login',
22:36:30.906   isAuthPage: true,
22:36:30.906   isAcceptPage: false,
22:36:30.906   isSelectPlanPage: false,
22:36:30.906   isWelcomePage: false,
22:36:30.906   checking: true,
22:36:30.906   hasSubscription: false,
22:36:30.906   subscriptionChecked: false
22:36:30.906 }
22:36:30.907 [LAYOUT-WRAPPER] Render decision: {
22:36:30.907   shouldShowNav: false,
22:36:30.907   checking: true,
22:36:30.907   hasSubscription: false,
22:36:30.907   isAuthPage: true,
22:36:30.907   isAcceptPage: false,
22:36:30.907   isSelectPlanPage: false,
22:36:30.907   isWelcomePage: false,
22:36:30.907   isApiRoute: false,
22:36:30.907   isDashboardRoute: false
22:36:30.907 }
22:36:30.907 [LAYOUT-WRAPPER] Rendering public page or API route
22:36:30.918 [LAYOUT-WRAPPER] Render: {
22:36:30.918   pathname: '/auth/signup',
22:36:30.919   isAuthPage: true,
22:36:30.919   isAcceptPage: false,
22:36:30.920   isSelectPlanPage: false,
22:36:30.920   isWelcomePage: false,
22:36:30.920   checking: true,
22:36:30.923   hasSubscription: false,
22:36:30.924   subscriptionChecked: false
22:36:30.924 }
22:36:30.925 [LAYOUT-WRAPPER] Render decision: {
22:36:30.925   shouldShowNav: false,
22:36:30.925   checking: true,
22:36:30.926   hasSubscription: false,
22:36:30.926   isAuthPage: true,
22:36:30.926   isAcceptPage: false,
22:36:30.927   isSelectPlanPage: false,
22:36:30.927   isWelcomePage: false,
22:36:30.928   isApiRoute: false,
22:36:30.928   isDashboardRoute: false
22:36:30.928 }
22:36:30.936 [LAYOUT-WRAPPER] Rendering public page or API route
22:36:30.941 [LAYOUT-WRAPPER] Render: {
22:36:30.942   pathname: '/members/accept',
22:36:30.942   isAuthPage: false,
22:36:30.943   isAcceptPage: true,
22:36:30.943   isSelectPlanPage: false,
22:36:30.943   isWelcomePage: false,
22:36:30.944   checking: true,
22:36:30.944   hasSubscription: false,
22:36:30.944   subscriptionChecked: false
22:36:30.944 }
22:36:30.945 [LAYOUT-WRAPPER] Render decision: {
22:36:30.945   shouldShowNav: false,
22:36:30.945   checking: true,
22:36:30.946   hasSubscription: false,
22:36:30.946   isAuthPage: false,
22:36:30.946   isAcceptPage: true,
22:36:30.947   isSelectPlanPage: false,
22:36:30.947   isWelcomePage: false,
22:36:30.947   isApiRoute: false,
22:36:30.948   isDashboardRoute: false
22:36:30.948 }
22:36:30.948 [LAYOUT-WRAPPER] Rendering public page or API route
22:36:30.973 [LAYOUT-WRAPPER] Render: {
22:36:30.974   pathname: '/pricing',
22:36:30.974   isAuthPage: false,
22:36:30.974   isAcceptPage: false,
22:36:30.974   isSelectPlanPage: false,
22:36:30.974   isWelcomePage: false,
22:36:30.974   checking: true,
22:36:30.974   hasSubscription: false,
22:36:30.974   subscriptionChecked: false
22:36:30.974 }
22:36:30.974 [LAYOUT-WRAPPER] Render decision: {
22:36:30.974   shouldShowNav: false,
22:36:30.974   checking: true,
22:36:30.974   hasSubscription: false,
22:36:30.974   isAuthPage: false,
22:36:30.974   isAcceptPage: false,
22:36:30.978   isSelectPlanPage: false,
22:36:30.978   isWelcomePage: false,
22:36:30.978   isApiRoute: false,
22:36:30.978   isDashboardRoute: false
22:36:30.978 }
22:36:30.978 [LAYOUT-WRAPPER] Rendering public page or API route
22:36:30.979  ⨯ useSearchParams() should be wrapped in a suspense boundary at page "/pricing". Read more: https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
22:36:30.979     at S (/vercel/path0/.next/server/chunks/ssr/node_modules_next_9c24ba8d._.js:2:2111)
22:36:30.979     at p (/vercel/path0/.next/server/chunks/ssr/node_modules_next_9c24ba8d._.js:4:4847)
22:36:30.979     at f (/vercel/path0/.next/server/chunks/ssr/app_pricing_page_tsx_b3828a56._.js:1:156)
22:36:30.979     at ir (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page-turbo.runtime.prod.js:2:84433)
22:36:30.979     at ia (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page-turbo.runtime.prod.js:2:86252)
22:36:30.979     at il (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page-turbo.runtime.prod.js:2:107981)
22:36:30.979     at is (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page-turbo.runtime.prod.js:2:105399)
22:36:30.979     at ii (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page-turbo.runtime.prod.js:2:84785)
22:36:30.979     at ia (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page-turbo.runtime.prod.js:2:86301)
22:36:30.979     at ia (/vercel/path0/node_modules/next/dist/compiled/next-server/app-page-turbo.runtime.prod.js:2:104739)
22:36:30.979 Error occurred prerendering page "/pricing". Read more: https://nextjs.org/docs/messages/prerender-error
22:36:30.979 Export encountered an error on /pricing/page: /pricing, exiting the build.
22:36:30.999  ⨯ Next.js build worker exited with code: 1 and signal: null
22:36:31.054 Error: Command "npm run build" exited with 1