import { withAuth } from "next-auth/middleware"

export default withAuth(
  function middleware() {
    // Add any additional middleware logic here if needed
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token
    },
  }
)

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/api/tasks/:path*',
    '/api/rewards/:path*',
    '/api/family/:path*',
    '/api/user/:path*'
  ]
}