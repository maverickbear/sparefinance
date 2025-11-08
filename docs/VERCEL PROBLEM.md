23:42:24.834 Running build in Washington, D.C., USA (East) – iad1
23:42:24.835 Build machine configuration: 2 cores, 8 GB
23:42:24.955 Cloning github.com/naortartarotti/spare-finance (Branch: main, Commit: 4b3405c)
23:42:25.749 Cloning completed: 794.000ms
23:42:25.969 Restored build cache from previous deployment (6xM3behTU3moFzg2iRd5y4erB8Ci)
23:42:26.716 Running "vercel build"
23:42:27.108 Vercel CLI 48.9.0
23:42:27.461 Installing dependencies...
23:42:28.907 
23:42:28.907 added 1 package in 1s
23:42:28.908 
23:42:28.908 163 packages are looking for funding
23:42:28.908   run `npm fund` for details
23:42:28.936 Detected Next.js version: 16.0.1
23:42:28.941 Running "npm run build"
23:42:29.047 
23:42:29.048 > spare-finance@0.1.0 build
23:42:29.048 > next build
23:42:29.048 
23:42:30.096    ▲ Next.js 16.0.1 (Turbopack)
23:42:30.096 
23:42:30.126  ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead. Learn more: https://nextjs.org/docs/messages/middleware-to-proxy
23:42:30.167    Creating an optimized production build ...
23:42:56.558  ✓ Compiled successfully in 25.8s
23:42:56.592    Running TypeScript ...
23:43:13.226 Failed to compile.
23:43:13.227 
23:43:13.227 Type error: Type 'typeof import("/vercel/path0/app/api/members/[id]/resend/route")' does not satisfy the constraint 'RouteHandlerConfig<"/api/members/[id]/resend">'.
23:43:13.228   Types of property 'POST' are incompatible.
23:43:13.228     Type '(request: NextRequest, { params }: { params: { id: string; }; }) => Promise<NextResponse<{ error: string; }> | NextResponse<{ success: boolean; }>>' is not assignable to type '(request: NextRequest, context: { params: Promise<{ id: string; }>; }) => void | Response | Promise<void | Response>'.
23:43:13.228       Types of parameters '__1' and 'context' are incompatible.
23:43:13.229         Type '{ params: Promise<{ id: string; }>; }' is not assignable to type '{ params: { id: string; }; }'.
23:43:13.229           Types of property 'params' are incompatible.
23:43:13.229             Property 'id' is missing in type 'Promise<{ id: string; }>' but required in type '{ id: string; }'.
23:43:13.230 
23:43:13.283 Next.js build worker exited with code: 1 and signal: null
23:43:13.316 Error: Command "npm run build" exited with 1