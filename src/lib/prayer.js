import { CalculationMethod, Coordinates, Madhab, PrayerTimes } from 'adhan'

// القاهرة كمكان مبدئي لحد ما الموبايل يحدد المكان الحقيقي
export const DEFAULT_LOCATION = { lat: 30.0444, lng: 31.2357, label: 'القاهرة (مبدئي)', auto: false }

export const PRAYERS = [
  { id: 'fajr', name: 'الفجر' },
  { id: 'dhuhr', name: 'الظهر' },
  { id: 'asr', name: 'العصر' },
  { id: 'maghrib', name: 'المغرب' },
  { id: 'isha', name: 'العشاء' },
]

// مواقيت يوم معيّن بحساب الهيئة المصرية العامة للمساحة
export function prayerTimesFor(day, location = DEFAULT_LOCATION) {
  const params = CalculationMethod.Egyptian()
  params.madhab = Madhab.Shafi
  const date = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12)
  const t = new PrayerTimes(new Coordinates(location.lat, location.lng), date, params)
  return {
    fajr: t.fajr,
    sunrise: t.sunrise,
    dhuhr: t.dhuhr,
    asr: t.asr,
    maghrib: t.maghrib,
    isha: t.isha,
  }
}

export function getDeviceLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('الموبايل مش بيدعم تحديد المكان'))
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: Math.round(pos.coords.latitude * 1000) / 1000,
          lng: Math.round(pos.coords.longitude * 1000) / 1000,
          label: 'موقعك الحالي',
          auto: true,
        }),
      (err) =>
        reject(
          new Error(
            err.code === 1
              ? 'إذن المكان مقفول. افتحه من إعدادات الآيفون ← الخصوصية ← خدمات الموقع'
              : 'ما قدرناش نحدد المكان، جرّب تاني',
          ),
        ),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 24 * 60 * 60 * 1000 },
    )
  })
}
