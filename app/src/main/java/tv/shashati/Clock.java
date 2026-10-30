package tv.shashati;

import android.icu.text.DateFormat;
import android.icu.util.ULocale;

import java.util.Calendar;
import java.util.Date;
import java.util.TimeZone;

/** Time, date and Hijri date as Arabic text. */
final class Clock {
    private static final ULocale ARABIC = new ULocale("ar");
    private static final ULocale HIJRI = new ULocale("ar@calendar=islamic-umalqura");

    static String time(long millis, TimeZone zone) {
        return format("h:mm", ARABIC, millis, zone);
    }

    static String period(long millis, TimeZone zone) {
        Calendar c = Calendar.getInstance(zone);
        c.setTimeInMillis(millis);
        return c.get(Calendar.AM_PM) == Calendar.AM ? "صباحًا" : "مساءً";
    }

    static String date(long millis, TimeZone zone) {
        return format("EEEE، d MMMM y", ARABIC, millis, zone);
    }

    static String hijri(long millis, TimeZone zone) {
        return format("d MMMM y", HIJRI, millis, zone) + " هـ";
    }

    static String countdown(long millis) {
        long minutes = Math.max(0, millis / 60000);
        long h = minutes / 60, m = minutes % 60;
        if (h == 0) return "بعد " + m + " دقيقة";
        return "بعد " + h + " س و" + m + " د";
    }

    private static String format(String pattern, ULocale locale, long millis, TimeZone zone) {
        android.icu.text.SimpleDateFormat f = new android.icu.text.SimpleDateFormat(pattern, locale);
        f.setTimeZone(android.icu.util.TimeZone.getTimeZone(zone.getID()));
        return f.format(new Date(millis));
    }

    private Clock() {}
}
