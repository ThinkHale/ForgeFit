// Forge Design System
// Inspired by iOS 26 Liquid Glass — light, layered, vibrant

export const colors = {
  brand: {
    primary:   '#FF6B35',
    secondary: '#FF9F1C',
    accent:    '#2EC4B6',
    electric:  '#7B61FF',
  },
  success: '#34C759',
  warning: '#FF9500',
  error:   '#FF3B30',
  info:    '#007AFF',
  background: {
    primary:   '#FFFFFF',
    secondary: '#F2F2F7',
    tertiary:  '#E5E5EA',
    elevated:  'rgba(255,255,255,0.85)',
  },
  glass: {
    white:     'rgba(255,255,255,0.72)',
    whiteSoft: 'rgba(255,255,255,0.55)',
    brand:     'rgba(255,107,53,0.12)',
    teal:      'rgba(46,196,182,0.12)',
    purple:    'rgba(123,97,255,0.12)',
    dark:      'rgba(0,0,0,0.06)',
  },
  text: {
    primary:   '#1C1C1E',
    secondary: '#636366',
    tertiary:  '#AEAEB2',
    inverse:   '#FFFFFF',
    brand:     '#FF6B35',
  },
  border: {
    light:  'rgba(0,0,0,0.08)',
    medium: 'rgba(0,0,0,0.14)',
    brand:  'rgba(255,107,53,0.3)',
  },
  gradients: {
    brand:     ['#FF6B35', '#FF9F1C'] as string[],
    brandSoft: ['#FFF0EB', '#FFF7EE'] as string[],
    teal:      ['#2EC4B6', '#0096C7'] as string[],
    purple:    ['#7B61FF', '#B478FF'] as string[],
    success:   ['#34C759', '#30D158'] as string[],
    sunrise:   ['#FF6B35', '#FF9F1C', '#FFD166'] as string[],
  },
};

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64,
};

export const radius = {
  sm: 8, md: 14, lg: 20, xl: 28, xxl: 36, full: 9999,
};

export const typography = {
  display:    { fontSize: 52, fontWeight: '800' as const, letterSpacing: -1.5, lineHeight: 56 },
  h1:         { fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.5, lineHeight: 40 },
  h2:         { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.3, lineHeight: 32 },
  h3:         { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.2, lineHeight: 26 },
  h4:         { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.1, lineHeight: 24 },
  body:       { fontSize: 16, fontWeight: '400' as const, letterSpacing: 0,    lineHeight: 24 },
  bodyMed:    { fontSize: 16, fontWeight: '500' as const, letterSpacing: 0,    lineHeight: 24 },
  small:      { fontSize: 14, fontWeight: '400' as const, letterSpacing: 0,    lineHeight: 20 },
  smallMed:   { fontSize: 14, fontWeight: '500' as const, letterSpacing: 0,    lineHeight: 20 },
  caption:    { fontSize: 12, fontWeight: '400' as const, letterSpacing: 0.1,  lineHeight: 18 },
  captionMed: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.2,  lineHeight: 18 },
  label:      { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.4,  lineHeight: 16 },
};

export const shadows = {
  sm:    { shadowColor: '#000', shadowOffset: { width: 0, height: 1 },  shadowOpacity: 0.06, shadowRadius: 4,  elevation: 2 },
  md:    { shadowColor: '#000', shadowOffset: { width: 0, height: 4 },  shadowOpacity: 0.08, shadowRadius: 12, elevation: 5 },
  lg:    { shadowColor: '#000', shadowOffset: { width: 0, height: 8 },  shadowOpacity: 0.10, shadowRadius: 24, elevation: 10 },
  brand: { shadowColor: '#FF6B35', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.30, shadowRadius: 16, elevation: 8 },
};
