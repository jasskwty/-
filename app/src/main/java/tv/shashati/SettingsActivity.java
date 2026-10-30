package tv.shashati;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;

/** Choose the city, and shortcuts to the TV's own screensaver and system settings. */
public class SettingsActivity extends Activity {
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        int pad = Math.round(48 * getResources().getDisplayMetrics().density);
        root.setPadding(pad, pad / 2, pad, pad / 2);

        TextView title = new TextView(this);
        title.setText("إعدادات شاشتي");
        title.setTextSize(36);
        title.setTextColor(InfoPanel.GOLD);
        root.addView(title);

        List<String> rows = new ArrayList<>();
        rows.add("⚙ إعدادات التلفزيون");
        rows.add("🌙 اختيار شاشة التوقف");
        String current = City.current(this).id;
        for (City c : City.ALL) rows.add((c.id.equals(current) ? "✔ " : "    ") + c.name);

        ListView list = new ListView(this);
        list.setAdapter(new ArrayAdapter<String>(this, android.R.layout.simple_list_item_1, rows) {
            @Override
            public View getView(int position, View convert, android.view.ViewGroup parent) {
                TextView v = (TextView) super.getView(position, convert, parent);
                v.setTextColor(Color.WHITE);
                v.setTextSize(24);
                return v;
            }
        });
        list.setOnItemClickListener((parent, view, position, id) -> {
            if (position == 0) {
                open(new Intent(Settings.ACTION_SETTINGS));
            } else if (position == 1) {
                open(new Intent(Settings.ACTION_DREAM_SETTINGS));
            } else {
                City city = City.ALL[position - 2];
                City.save(this, city);
                Toast.makeText(this, "تم اختيار " + city.name, Toast.LENGTH_SHORT).show();
                finish();
            }
        });
        root.addView(list);
        setContentView(root);
        list.requestFocus();
    }

    private void open(Intent intent) {
        try {
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "هذا التلفزيون ما يدعم هالصفحة", Toast.LENGTH_SHORT).show();
        }
    }
}
