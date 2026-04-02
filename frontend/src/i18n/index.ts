import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import it from './locales/it.json';
import en from './locales/en.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import es from './locales/es.json';
import pt from './locales/pt.json';

const LANGUAGE_KEY = 'marketmate_language';

export const LANGUAGES = [
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
];

const resources = {
  it: { translation: it },
  en: { translation: en },
  fr: { translation: fr },
  de: { translation: de },
  es: { translation: es },
  pt: { translation: pt },
};

i18n.use(initReactI18next).init({
  resources,
  lng: 'it',
  fallbackLng: 'it',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

// Load saved language
AsyncStorage.getItem(LANGUAGE_KEY).then((savedLng) => {
  if (savedLng && resources[savedLng as keyof typeof resources]) {
    i18n.changeLanguage(savedLng);
  }
});

export const changeLanguage = async (lng: string) => {
  await AsyncStorage.setItem(LANGUAGE_KEY, lng);
  await i18n.changeLanguage(lng);
};

// Format number according to locale
export const formatNumber = (num: number, lng?: string): string => {
  const lang = lng || i18n.language;
  const decSep = i18n.t('locale.decimalSeparator', { lng: lang });
  const thousSep = i18n.t('locale.thousandSeparator', { lng: lang });
  
  const parts = num.toFixed(2).split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousSep);
  return intPart + decSep + parts[1];
};

// Format currency according to locale
export const formatCurrency = (num: number, lng?: string): string => {
  const lang = lng || i18n.language;
  const symbol = i18n.t('locale.currencySymbol', { lng: lang });
  const formatted = formatNumber(num, lang);
  
  // In French, symbol comes after the number
  if (lang === 'fr') return `${formatted} ${symbol}`;
  return `${symbol}${formatted}`;
};

// Format date according to locale
export const formatDate = (date: Date, lng?: string): string => {
  const lang = lng || i18n.language;
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  
  const format = i18n.t('locale.dateFormat', { lng: lang });
  if (format === 'MM/DD/YYYY') return `${m}/${d}/${y}`;
  if (format === 'DD.MM.YYYY') return `${d}.${m}.${y}`;
  return `${d}/${m}/${y}`; // default DD/MM/YYYY
};

// Get month names for current language
export const getMonthNames = (lng?: string): string[] => {
  const lang = lng || i18n.language;
  const keys = ['january', 'february', 'march', 'april', 'may', 'june',
                'july', 'august', 'september', 'october', 'november', 'december'];
  return keys.map(k => i18n.t(`months.${k}`, { lng: lang }));
};

// Get day names for current language
export const getDayNames = (lng?: string): string[] => {
  const lang = lng || i18n.language;
  const keys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return keys.map(k => i18n.t(`days.${k}`, { lng: lang }));
};

// Get short day names
export const getShortDayNames = (lng?: string): string[] => {
  const lang = lng || i18n.language;
  const keys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  return keys.map(k => i18n.t(`days.${k}`, { lng: lang }));
};

export default i18n;
