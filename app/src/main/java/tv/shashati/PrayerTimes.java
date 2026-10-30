package tv.shashati;

import java.util.Calendar;
import java.util.TimeZone;

/** Prayer times for one day, worked out from the sun's position (no network needed). */
final class PrayerTimes {
    static final String[] NAMES = {"الفجر", "الشروق", "الظهر", "العصر", "المغرب", "العشاء"};

    /** Each prayer as milliseconds since the epoch, in the order of NAMES. */
    final long[] times = new long[6];

    PrayerTimes(City city, Calendar day) {
        TimeZone zone = TimeZone.getTimeZone(city.zone);
        Calendar local = Calendar.getInstance(zone);
        local.setTimeInMillis(day.getTimeInMillis());
        int y = local.get(Calendar.YEAR), m = local.get(Calendar.MONTH) + 1, d = local.get(Calendar.DAY_OF_MONTH);

        Calendar midnight = Calendar.getInstance(zone);
        midnight.clear();
        midnight.set(y, m - 1, d, 0, 0, 0);
        double offset = zone.getOffset(midnight.getTimeInMillis()) / 3600000.0;

        double jd = julianDay(y, m, d) - city.lng / 360.0;
        double[] sun = sun(jd);
        double decl = sun[0], eqt = sun[1];

        double dhuhr = 12 + offset - city.lng / 15 - eqt;
        double rise = hourAngle(city.lat, decl, -0.833);
        double fajr = dhuhr - hourAngle(city.lat, decl, -city.fajrAngle);
        double asrElev = Math.toDegrees(Math.atan(1 / (1 + Math.tan(Math.toRadians(Math.abs(city.lat - decl))))));
        double asr = dhuhr + hourAngle(city.lat, decl, asrElev);
        double maghrib = dhuhr + rise;
        double isha = city.ishaAngle > 0
                ? dhuhr + hourAngle(city.lat, decl, -city.ishaAngle)
                : maghrib + city.ishaMinutes / 60.0;

        double[] hours = {fajr, dhuhr - rise, dhuhr, asr, maghrib, isha};
        for (int i = 0; i < 6; i++) {
            times[i] = midnight.getTimeInMillis() + Math.round(hours[i] * 3600000);
        }
    }

    /** The index of the next prayer after now (sunrise excluded), or -1 when Isha has passed. */
    int next(long now) {
        for (int i = 0; i < 6; i++) {
            if (i != 1 && times[i] > now) return i;
        }
        return -1;
    }

    private static double julianDay(int y, int m, int d) {
        if (m <= 2) { y -= 1; m += 12; }
        int a = y / 100;
        int b = 2 - a + a / 4;
        return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5;
    }

    /** The sun's declination (degrees) and the equation of time (hours) at noon of that Julian day. */
    private static double[] sun(double jd) {
        double n = jd - 2451545.0 + 0.5;
        double g = fix(357.529 + 0.98560028 * n, 360);
        double q = fix(280.459 + 0.98564736 * n, 360);
        double l = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360);
        double e = 23.439 - 0.00000036 * n;
        double ra = fix(Math.toDegrees(Math.atan2(cos(e) * sin(l), cos(l))) / 15, 24);
        double decl = Math.toDegrees(Math.asin(sin(e) * sin(l)));
        double eqt = q / 15 - ra;
        if (eqt > 12) eqt -= 24;
        if (eqt < -12) eqt += 24;
        return new double[]{decl, eqt};
    }

    /** Hours between noon and the moment the sun stands at that elevation. */
    private static double hourAngle(double lat, double decl, double elevation) {
        double c = (sin(elevation) - sin(lat) * sin(decl)) / (cos(lat) * cos(decl));
        return Math.toDegrees(Math.acos(Math.max(-1, Math.min(1, c)))) / 15;
    }

    private static double sin(double deg) { return Math.sin(Math.toRadians(deg)); }
    private static double cos(double deg) { return Math.cos(Math.toRadians(deg)); }
    private static double fix(double a, double b) { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; }
}
