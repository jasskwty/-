package tv.shashati;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.Calendar;
import java.util.TimeZone;

/** The clock, dates and the day's prayers; shared by the home screen and the screensaver. */
final class InfoPanel extends LinearLayout {
    static final int GOLD = Color.parseColor("#E8B54A");

    private final TextView time, period, date, hijri, next;
    private final TextView[] prayers = new TextView[6];
    private final boolean large;

    InfoPanel(Context context, boolean large) {
        super(context);
        this.large = large;
        setOrientation(VERTICAL);
        setGravity(Gravity.CENTER_HORIZONTAL);

        LinearLayout clock = new LinearLayout(context);
        clock.setGravity(Gravity.BOTTOM);
        time = text(context, large ? 140 : 96, Color.WHITE, true);
        period = text(context, large ? 34 : 26, Color.parseColor("#B8C4D6"), false);
        period.setPadding(dp(12), 0, dp(12), dp(large ? 26 : 18));
        clock.addView(time);
        clock.addView(period);
        addView(clock);

        date = text(context, large ? 34 : 28, Color.WHITE, false);
        hijri = text(context, large ? 28 : 22, GOLD, false);
        addView(date);
        addView(hijri);

        next = text(context, large ? 30 : 24, Color.WHITE, true);
        next.setPadding(0, dp(large ? 36 : 24), 0, dp(12));
        addView(next);

        LinearLayout row = new LinearLayout(context);
        row.setGravity(Gravity.CENTER);
        for (int i = 0; i < 6; i++) {
            prayers[i] = text(context, large ? 24 : 20, Color.parseColor("#B8C4D6"), false);
            prayers[i].setPadding(dp(18), dp(10), dp(18), dp(10));
            row.addView(prayers[i]);
        }
        addView(row);
    }

    void refresh() {
        City city = City.current(getContext());
        TimeZone zone = TimeZone.getTimeZone(city.zone);
        long now = System.currentTimeMillis();
        time.setText(Clock.time(now, zone));
        period.setText(Clock.period(now, zone));
        date.setText(Clock.date(now, zone) + " · " + city.name);
        hijri.setText(Clock.hijri(now, zone));

        PrayerTimes today = new PrayerTimes(city, Calendar.getInstance());
        int n = today.next(now);
        long at;
        String name;
        if (n >= 0) {
            at = today.times[n];
            name = PrayerTimes.NAMES[n];
        } else {
            Calendar tomorrow = Calendar.getInstance();
            tomorrow.add(Calendar.DAY_OF_MONTH, 1);
            at = new PrayerTimes(city, tomorrow).times[0];
            name = PrayerTimes.NAMES[0];
        }
        next.setText("صلاة " + name + " " + Clock.countdown(at - now));

        for (int i = 0; i < 6; i++) {
            prayers[i].setText(PrayerTimes.NAMES[i] + "\n" + Clock.time(today.times[i], zone));
            boolean isNext = i == n;
            prayers[i].setTextColor(isNext ? GOLD : Color.parseColor("#B8C4D6"));
            prayers[i].setTypeface(null, isNext ? Typeface.BOLD : Typeface.NORMAL);
        }
    }

    private TextView text(Context context, int sp, int color, boolean bold) {
        TextView t = new TextView(context);
        t.setTextSize(sp);
        t.setTextColor(color);
        t.setGravity(Gravity.CENTER);
        t.setShadowLayer(8, 0, 2, Color.parseColor("#80000000"));
        if (bold) t.setTypeface(null, Typeface.BOLD);
        t.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_YES);
        return t;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }
}
