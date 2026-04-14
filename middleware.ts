// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BLOCKED_COUNTRIES = [
  'CN', 'HK', 'MO', 'CU', 'UA', 'RU', 'BY', 'KP', 'SY', 'IR', 'VE', 'MY', 'ID', 'MM', 'NP', 'BO'
];

// 국가별 허용되는 시간대 매핑 (정밀 대조용)
const ALLOWED_TZ_MAP: Record<string, string[]> = {
  'KR': ['Asia/Seoul'],
  'JP': ['Asia/Tokyo'],
  'TW': ['Asia/Taipei'],
  'LT': ['Europe/Vilnius'],
  // 필요에 따라 허용 국가들의 시간대를 추가하세요.
};

export function middleware(request: NextRequest) {
  const country = request.geo?.country || 'UNKNOWN';
  const userTimezone = request.cookies.get('user_timezone')?.value;

  // [1단계] IP 기반 국가 차단 (기존 로직)
  if (BLOCKED_COUNTRIES.includes(country)) {
    return new NextResponse('Access Denied: Restricted Region', { status: 403 });
  }

  // [2단계] 시간대 대조를 통한 우회 접속 차단
  if (userTimezone) {
    const decodedTz = decodeURIComponent(userTimezone);

    // 사례 1: IP는 한국(KR)인데 시스템 시간대가 평양(Asia/Pyongyang)인 경우
    if (decodedTz === 'Asia/Pyongyang') {
      return new NextResponse('Access Denied: System security policy violation', { status: 403 });
    }

    // 사례 2: IP는 허용 국가인데 시간대 설정이 차단 대상 국가인 경우
    // 예: 중국(Asia/Shanghai)이나 러시아 시간대 설정 사용자가 우회 접속 시
    const suspiciousTimezones = ['Asia/Shanghai', 'Asia/Urumqi', 'Asia/Chongqing', 'Europe/Moscow'];
    if (suspiciousTimezones.includes(decodedTz)) {
      return new NextResponse('Access Denied: Suspicious configuration detected', { status: 403 });
    }
    
    // [선택 사항] 엄격한 매핑: IP 국가와 시간대 설정이 일치하지 않으면 차단
    if (ALLOWED_TZ_MAP[country] && !ALLOWED_TZ_MAP[country].includes(decodedTz)) {
      // VPN 우회가 강력히 의심되는 상황
      return new NextResponse('Access Denied: Location mismatch', { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};