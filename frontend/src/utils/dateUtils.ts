const GIORNI = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const GIORNI_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const GIORNI_UPPER = ['DOMENICA', 'LUNEDÌ', 'MARTEDÌ', 'MERCOLEDÌ', 'GIOVEDÌ', 'VENERDÌ', 'SABATO'];
const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

export const formattaDataIta = (d: Date): string => {
  const date = new Date(d);
  return `${GIORNI[date.getDay()]} ${date.getDate()} ${MESI[date.getMonth()]} ${date.getFullYear()}`;
};

export const formattaDataBreve = (d: Date): string => {
  const date = new Date(d);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
};

export const getGiornoSettimana = (d: Date): string => {
  return GIORNI_UPPER[new Date(d).getDay()];
};

export const getGiornoIndex = (d: Date): number => {
  // Convert Sunday=0 to Monday=0 system
  const day = new Date(d).getDay();
  return day === 0 ? 6 : day - 1;
};

export const isSameDay = (d1: Date, d2: Date): boolean => {
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear();
};

export const isToday = (d: Date): boolean => {
  return isSameDay(d, new Date());
};

export const isTomorrow = (d: Date): boolean => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isSameDay(d, tomorrow);
};

export const getMesiArray = () => MESI;
export const getGiorniArray = () => GIORNI;
export const getGiorniShortArray = () => GIORNI_SHORT;
