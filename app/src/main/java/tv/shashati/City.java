package tv.shashati;

import android.content.Context;

/** A city with what prayer times need: position, time zone and the local calculation method. */
final class City {
    final String id;
    final String name;
    final double lat;
    final double lng;
    final String zone;
    final double fajrAngle;
    /** Isha as an angle below the horizon, or 0 to use ishaMinutes after Maghrib. */
    final double ishaAngle;
    final int ishaMinutes;

    private City(String id, String name, double lat, double lng, String zone,
                 double fajrAngle, double ishaAngle, int ishaMinutes) {
        this.id = id;
        this.name = name;
        this.lat = lat;
        this.lng = lng;
        this.zone = zone;
        this.fajrAngle = fajrAngle;
        this.ishaAngle = ishaAngle;
        this.ishaMinutes = ishaMinutes;
    }

    private static City ummAlQura(String id, String name, double lat, double lng, String zone) {
        return new City(id, name, lat, lng, zone, 18.5, 0, 90);
    }

    static final City[] ALL = {
            ummAlQura("riyadh", "الرياض", 24.7136, 46.6753, "Asia/Riyadh"),
            ummAlQura("jeddah", "جدة", 21.4858, 39.1925, "Asia/Riyadh"),
            ummAlQura("makkah", "مكة المكرمة", 21.3891, 39.8579, "Asia/Riyadh"),
            ummAlQura("madinah", "المدينة المنورة", 24.5247, 39.5692, "Asia/Riyadh"),
            ummAlQura("dammam", "الدمام", 26.4207, 50.0888, "Asia/Riyadh"),
            new City("kuwait", "الكويت", 29.3759, 47.9774, "Asia/Kuwait", 18, 17.5, 0),
            new City("dubai", "دبي", 25.2048, 55.2708, "Asia/Dubai", 18.2, 18.2, 0),
            new City("abudhabi", "أبوظبي", 24.4539, 54.3773, "Asia/Dubai", 18.2, 18.2, 0),
            ummAlQura("doha", "الدوحة", 25.2854, 51.5310, "Asia/Qatar"),
            new City("manama", "المنامة", 26.2285, 50.5860, "Asia/Bahrain", 18.5, 0, 90),
            new City("muscat", "مسقط", 23.5880, 58.3829, "Asia/Muscat", 18, 18, 0),
            new City("baghdad", "بغداد", 33.3152, 44.3661, "Asia/Baghdad", 18, 17, 0),
    };

    static City current(Context context) {
        String id = context.getSharedPreferences("shashati", Context.MODE_PRIVATE).getString("city", "riyadh");
        for (City c : ALL) if (c.id.equals(id)) return c;
        return ALL[0];
    }

    static void save(Context context, City city) {
        context.getSharedPreferences("shashati", Context.MODE_PRIVATE).edit().putString("city", city.id).apply();
    }
}
