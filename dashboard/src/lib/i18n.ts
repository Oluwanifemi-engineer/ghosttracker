/**
 * Magneetar Internationalization (i18n)
 *
 * Supports:
 * - English (default)
 * - Yoruba (Yorùbá)
 * - Igbo (Igbo)
 * - Hausa (Hausa)
 * - Pidgin English (Nigerian Pidgin)
 *
 * Usage:
 *   import { t, setLocale } from '@/lib/i18n';
 *   const text = t('home.security_score');
 */

export type Locale = 'en' | 'yo' | 'ig' | 'ha' | 'pcm';

const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.map': 'Map',
    'nav.devices': 'Devices',
    'nav.alerts': 'Alerts',
    'nav.security': 'Security',

    // Home
    'home.security_score': 'Security Score',
    'home.protected': 'PROTECTED',
    'home.at_risk': 'AT RISK',
    'home.system_active': 'SYS ACTIVE',
    'home.system_inactive': 'SYS INACTIVE',
    'home.tracking_active': 'Tracking Active',
    'home.tracking_inactive': 'Tracking Inactive',
    'home.quick_actions': 'Quick Actions',
    'home.lock_device': 'Lock Device',
    'home.sound_alarm': 'Sound Alarm',
    'home.share_location': 'Share Location',
    'home.sos': 'SOS',
    'home.family_circle': 'Family Circle',
    'home.devices_online': 'devices online',
    'home.activity': 'Activity',

    // Devices
    'devices.title': 'MY DEVICES',
    'devices.online': 'Online',
    'devices.offline': 'Offline',
    'devices.secured': 'Secured',
    'devices.locate': 'Locate',
    'devices.lock': 'Lock',
    'devices.wipe': 'Wipe',
    'devices.battery': 'Battery',
    'devices.last_seen': 'Last seen',

    // Alerts
    'alerts.title': 'ALERTS',
    'alerts.critical': 'CRITICAL',
    'alerts.warning': 'WARNING',
    'alerts.info': 'INFO',
    'alerts.no_alerts': 'No alerts yet',
    'alerts.mark_read': 'Mark as read',

    // Security
    'security.title': 'SECURITY',
    'security.device_admin': 'Device Admin',
    'security.active': 'Active',
    'security.inactive': 'Inactive',
    'security.imei_vault': 'IMEI VAULT',
    'security.copy': 'COPY',
    'security.emergency_actions': 'EMERGENCY ACTIONS',
    'security.panic_alert': 'PANIC ALERT',
    'security.police_report': 'POLICE REPORT',
    'security.emergency_wipe': 'EMERGENCY WIPE',
    'security.encryption': 'Encryption',
    'security.aes_enabled': 'AES-256 Enabled',
    'security.auth': 'Authentication',
    'security.biometric': 'Biometric + PIN',

    // Auth
    'auth.sign_in': 'SIGN IN',
    'auth.sign_up': 'SIGN UP',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.forgot_password': 'Forgot password?',
    'auth.no_account': "Don't have an account?",
    'auth.has_account': 'Already have an account?',
    'auth.create_account': 'CREATE ACCOUNT',

    // Permissions
    'permissions.title': 'Set Up Magneetar',
    'permissions.subtitle': 'Grant permissions to protect your device',
    'permissions.location': 'Location Access',
    'permissions.location_desc': 'Track your device location for recovery',
    'permissions.notifications': 'Notifications',
    'permissions.notifications_desc': 'Get alerts about device status',
    'permissions.camera': 'Camera',
    'permissions.camera_desc': 'Capture evidence during theft',
    'permissions.microphone': 'Microphone',
    'permissions.microphone_desc': 'Record audio during theft events',
    'permissions.device_admin': 'Device Admin',
    'permissions.device_admin_desc': 'Prevent unauthorized app removal',
    'permissions.background': 'Background Activity',
    'permissions.background_desc': 'Keep tracking active when app is closed',
    'permissions.grant': 'Grant Permission',
    'permissions.skip': 'Skip',
    'permissions.continue': 'Continue',

    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.retry': 'Retry',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.search': 'Search',
    'common.no_data': 'No data available',
    'common.offline': 'Offline',
    'common.online': 'Online',
  },

  yo: {
    // Navigation
    'nav.home': 'Ile',
    'nav.map': 'Mápò',
    'nav.devices': 'Àwọn ẹ̀rọ',
    'nav.alerts': 'Ìkìlọ̀',
    'nav.security': 'Ààbò',

    // Home
    'home.security_score': 'Ìpinnu Ààbò',
    'home.protected': 'A DÁÀBÒ BO',
    'home.at_risk': 'NÍ ÌKÒRÍRÁ',
    'home.system_active': 'Ẹ̀RỌ Ò N TAN',
    'home.system_inactive': 'Ẹ̀RỌ Ò TAN',
    'home.tracking_active': 'Ìtẹ̀lé N Lọ',
    'home.tracking_inactive': 'Ìtẹ̀lé Kò Lọ',
    'home.quick_actions': 'Ìwàṣẹ̀ Igbohunsófẹ̀',
    'home.lock_device': 'Di Ẹ̀rọ',
    'home.sound_alarm': 'Kó Ẹ̀rọ Ohùn Lọ',
    'home.share_location': 'Pín Ipò',
    'home.sos': 'Ìrànwọ́',
    'home.family_circle': ' Èbi Ìdánilójú',
    'home.devices_online': 'ẹ̀rọ wà nípasẹ̀',
    'home.activity': 'Ìṣẹ̀lẹ̀',

    // Auth
    'auth.sign_in': 'WỌLE',
    'auth.sign_up': 'FÒ SILI',
    'auth.email': 'Email',
    'auth.password': 'Ọ̀rọ̀ àṣìwẹ̀',
    'auth.forgot_password': 'Gbàgbọ́ ọ̀rọ̀ àṣìwẹ̀ rẹ?',
    'auth.no_account': 'Kò ní àkọ́ǹtì?',
    'auth.has_account': 'Ó ti ní àkọ́ǹtì?',
    'auth.create_account': 'ṢÈDÁ ÀKỌ́ǸTÌ',

    // Common
    'common.loading': 'Ó N SÍLẹ̀...',
    'common.error': 'Ìṣì̀kúrò',
    'common.retry': 'Tún Gbé',
    'common.cancel': 'Fagile',
    'common.confirm': 'Jẹ́rì',
    'common.save': 'Fipamọ́',
    'common.delete': 'Parẹ́',
    'common.edit': 'Ṣe Àtúnṣe',
    'common.search': 'Wá',
    'common.no_data': 'Kò sí dátà',
    'common.offline': 'Kò sí pasẹ̀',
    'common.online': 'Wà nípasẹ̀',
  },

  ig: {
    // Navigation
    'nav.home': 'Ụlọ',
    'nav.map': 'Mepụ',
    'nav.devices': 'Ngwaọrụ',
    'nav.alerts': 'Ọkwa',
    'nav.security': 'Nchezọ',

    // Home
    'home.security_score': 'Uru Nchezọ',
    'home.protected': 'ECHẸCHERE',
    'home.at_risk': 'NDA NDU',
    'home.system_active': 'NGWAỌRỤ NA-ARỤ ỌRỤ',
    'home.system_inactive': 'NGWAỌRỤ GHỊỊ NA-ARỤ ỌRỤ',
    'home.tracking_active': 'Nlegharị anya na-arụ ọrụ',
    'home.tracking_inactive': 'Nlegharị anya ghịị na-arụ ọrụ',

    // Auth
    'auth.sign_in': 'BULIE',
    'auth.sign_up': 'DEE',
    'auth.email': 'Email',
    'auth.password': 'Okwuntụghị',
    'auth.forgot_password': 'Chefuru okwuntụghị gị?',
    'auth.no_account': 'Ị nweghị akwụkwọ?',
    'auth.has_account': 'Ị nwere akwụkwọ?',
    'auth.create_account': 'MEPỤTA AKWỤKWỌ',

    // Common
    'common.loading': 'Na-adọwn...',
    'common.error': 'Njehie',
    'common.retry': 'Nwaa ọzọ',
    'common.cancel': 'Kagbuo',
    'common.confirm': 'Nyochaa',
    'common.save': 'Chekwaa',
    'common.delete': 'Hichapụ',
    'common.edit': 'Dezlee',
    'common.search': 'Chọọ',
    'common.no_data': 'Ọ dịghị data',
    'common.offline': 'Ọ dịghị na-intanetị',
    'common.online': 'Dị na-intanetị',
  },

  ha: {
    // Navigation
    'nav.home': 'Gida',
    'nav.map': 'Taswira',
    'nav.devices': 'Na\'urar',
    'nav.alerts': 'Sanarwa',
    'nav.security': 'Tsaro',

    // Home
    'home.security_score': 'Makin Tsaro',
    'home.protected': 'AN KARE',
    'home.at_risk': 'CIKE CIKIN HAURI',
    'home.system_active': "NA'URA TANA AIKI",
    'home.system_inactive': 'NA\'URA BA TANA AIKI BA',
    'home.tracking_active': 'Biyan yana aiki',
    'home.tracking_inactive': 'Biyan ba yana aiki ba',

    // Auth
    'auth.sign_in': 'SHIGA',
    'auth.sign_up': 'YI RA\'AYI',
    'auth.email': 'Email',
    'auth.password': 'Kalmar sirri',
    'auth.forgot_password': 'An manta kalmar sirrinka?',
    'auth.no_account': 'Ba ka da asusu?',
    'auth.has_account': 'Kana da asusu?',
    'auth.create_account': 'YI ASUSU',

    // Common
    'common.loading': 'Ana lodawa...',
    'common.error': 'Kuskure',
    'common.retry': 'Sake gwadawa',
    'common.cancel': 'Soke',
    'common.confirm': 'Tabbatar',
    'common.save': 'Ajiye',
    'common.delete': 'Share',
    'common.edit': 'Gyara',
    'common.search': 'Bincika',
    'common.no_data': 'Babu bayani',
    'common.offline': 'Ba a haɗa ba',
    'common.online': 'An haɗa',
  },

  pcm: {
    // Navigation
    'nav.home': 'House',
    'nav.map': 'Map',
    'nav.devices': 'Phone',
    'nav.alerts': 'Alert',
    'nav.security': 'Security',

    // Home
    'home.security_score': 'Security Level',
    'home.protected': 'DEY PROTECT',
    'home.at_risk': 'DEY DANGER',
    'home.system_active': 'SYSTEM DEY WORK',
    'home.system_inactive': 'SYSTEM NO DEY WORK',
    'home.tracking_active': 'Tracking Dey Work',
    'home.tracking_inactive': 'Tracking No Dey Work',

    // Auth
    'auth.sign_in': 'ENTER',
    'auth.sign_up': 'CREATE',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.forgot_password': 'You forget password?',
    'auth.no_account': 'You no get account?',
    'auth.has_account': 'You get account?',
    'auth.create_account': 'CREATE ACCOUNT',

    // Common
    'common.loading': 'E dey load...',
    'common.error': 'Something no correct',
    'common.retry': 'Try Again',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.search': 'Find',
    'common.no_data': 'Nothing dey here',
    'common.offline': 'No Network',
    'common.online': 'Network Dey',
  },
};

let currentLocale: Locale = 'en';

/**
 * Set the current locale
 */
export function setLocale(locale: Locale): void {
  currentLocale = locale;
  if (typeof window !== 'undefined') {
    localStorage.setItem('magneetar-locale', locale);
  }
}

/**
 * Get the current locale
 */
export function getLocale(): Locale {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('magneetar-locale') as Locale;
    if (saved && translations[saved]) {
      currentLocale = saved;
    }
  }
  return currentLocale;
}

/**
 * Translate a key to the current locale
 * Falls back to English if key not found
 */
export function t(key: string, params?: Record<string, string>): string {
  const locale = getLocale();
  let text = translations[locale]?.[key] || translations.en[key] || key;

  // Replace template parameters: {{name}} → value
  if (params) {
    Object.entries(params).forEach(([param, value]) => {
      text = text.replace(new RegExp(`\\{\\{${param}\\}\\}`, 'g'), value);
    });
  }

  return text;
}

/**
 * Get all available locales
 */
export function getAvailableLocales(): { code: Locale; name: string; nativeName: string }[] {
  return [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá' },
    { code: 'ig', name: 'Igbo', nativeName: 'Igbo' },
    { code: 'ha', name: 'Hausa', nativeName: 'Hausa' },
    { code: 'pcm', name: 'Pidgin', nativeName: 'Naijá' },
  ];
}
