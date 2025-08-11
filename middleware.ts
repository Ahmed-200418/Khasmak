
import {NextRequest, NextResponse} from 'next/server';

type UserRole = 'user' | 'admin';

const PROTECTED_ROUTES_BASE = ['/deductions', '/summary', '/history'];
const ADMIN_ROUTES = ['/admin'];
const PUBLIC_ROUTES = ['/'];

export function middleware(request: NextRequest) {
  const {pathname} = request.nextUrl;
  const authCookie = request.cookies.get('auth-storage')?.value;

  let isAuthenticated = false;
  let userRole: UserRole | null = null;

  if (authCookie) {
    try {
        const authState = JSON.parse(authCookie);
        isAuthenticated = authState?.state?.isAuthenticated || false;
        userRole = authState?.state?.role || null;
    } catch (e) {
        // Invalid cookie, treat as unauthenticated
    }
  }

  const isProtectedRoute = PROTECTED_ROUTES_BASE.some(route => pathname.startsWith(route));
  const isAdminRoute = ADMIN_ROUTES.some(route => pathname.startsWith(route));
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));

  // 1. If not authenticated and trying to access a protected route (user or admin)
  if (!isAuthenticated && (isProtectedRoute || isAdminRoute)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 2. If authenticated and on a public route (login page), redirect to the correct dashboard
  if (isAuthenticated && isPublicRoute) {
     if (userRole === 'admin') {
        return NextResponse.redirect(new URL('/admin', request.url));
     }
     if (userRole === 'user') {
        return NextResponse.redirect(new URL('/deductions', request.url));
     }
     // If role is somehow null, stay on the login page
  }
  
  // 3. If authenticated as 'user' and trying to access an admin route
  if (isAuthenticated && userRole === 'user' && isAdminRoute) {
     return NextResponse.redirect(new URL('/deductions', request.url));
  }
  
  // 4. If authenticated as 'admin' and trying to access a user-protected route
  if (isAuthenticated && userRole === 'admin' && isProtectedRoute) {
     return NextResponse.redirect(new URL('/admin', request.url));
  }


  return NextResponse.next();
}

export const config = {
  // Matcher to specify which routes the middleware should run on
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
