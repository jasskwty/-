package tv.shashati;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.GridView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** The home screen: clock and prayers on top, the TV's apps below, settings at the end. */
public class HomeActivity extends Activity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private InfoPanel panel;
    private GridView grid;

    private final Runnable tick = new Runnable() {
        @Override public void run() {
            panel.refresh();
            handler.postDelayed(this, 60000 - System.currentTimeMillis() % 60000);
        }
    };

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        root.setPadding(dp(48), dp(32), dp(48), dp(24));

        panel = new InfoPanel(this, false);
        root.addView(panel);

        grid = new GridView(this);
        grid.setNumColumns(6);
        grid.setHorizontalSpacing(dp(18));
        grid.setVerticalSpacing(dp(18));
        grid.setPadding(0, dp(28), 0, 0);
        grid.setClipToPadding(false);
        grid.setSelector(android.R.color.transparent);
        grid.setDrawSelectorOnTop(false);
        root.addView(grid, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

        setContentView(root);
    }

    @Override
    protected void onResume() {
        super.onResume();
        grid.setAdapter(new Apps(this, loadApps()));
        grid.setOnItemClickListener((parent, view, position, id) -> {
            Tile tile = (Tile) parent.getItemAtPosition(position);
            try {
                startActivity(tile.intent);
            } catch (Exception ignored) {
                // The app was removed since the list was built.
            }
        });
        grid.requestFocus();
        handler.post(tick);
    }

    @Override
    protected void onPause() {
        super.onPause();
        handler.removeCallbacks(tick);
    }

    @Override
    public void onBackPressed() {
        // The home screen has nowhere to go back to.
    }

    private List<Tile> loadApps() {
        PackageManager pm = getPackageManager();
        List<Tile> tiles = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        seen.add(getPackageName());
        for (String category : new String[]{Intent.CATEGORY_LEANBACK_LAUNCHER, Intent.CATEGORY_LAUNCHER}) {
            Intent query = new Intent(Intent.ACTION_MAIN).addCategory(category);
            for (ResolveInfo info : pm.queryIntentActivities(query, 0)) {
                String pkg = info.activityInfo.packageName;
                if (!seen.add(pkg)) continue;
                Intent launch = category.equals(Intent.CATEGORY_LEANBACK_LAUNCHER)
                        ? pm.getLeanbackLaunchIntentForPackage(pkg) : pm.getLaunchIntentForPackage(pkg);
                if (launch == null) continue;
                Drawable banner = info.activityInfo.loadBanner(pm);
                if (banner == null) banner = info.activityInfo.applicationInfo.loadBanner(pm);
                tiles.add(new Tile(info.loadLabel(pm).toString(), banner, info.loadIcon(pm), launch));
            }
        }
        tiles.sort((a, b) -> a.label.compareToIgnoreCase(b.label));
        tiles.add(new Tile("إعدادات شاشتي", null, getDrawable(R.drawable.icon),
                new Intent(this, SettingsActivity.class)));
        return tiles;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private static final class Tile {
        final String label;
        final Drawable banner, icon;
        final Intent intent;

        Tile(String label, Drawable banner, Drawable icon, Intent intent) {
            this.label = label;
            this.banner = banner;
            this.icon = icon;
            this.intent = intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        }
    }

    private static final class Apps extends BaseAdapter {
        private final Context context;
        private final List<Tile> tiles;

        Apps(Context context, List<Tile> tiles) {
            this.context = context;
            this.tiles = tiles;
        }

        @Override public int getCount() { return tiles.size(); }
        @Override public Object getItem(int i) { return tiles.get(i); }
        @Override public long getItemId(int i) { return i; }

        @Override
        public View getView(int i, View convert, ViewGroup parent) {
            Tile tile = tiles.get(i);
            float density = context.getResources().getDisplayMetrics().density;
            LinearLayout box = new LinearLayout(context);
            box.setOrientation(LinearLayout.VERTICAL);
            box.setGravity(Gravity.CENTER);
            box.setBackgroundResource(R.drawable.tile);
            box.setPadding((int) (8 * density), (int) (8 * density), (int) (8 * density), (int) (8 * density));
            box.setMinimumHeight((int) (120 * density));

            ImageView image = new ImageView(context);
            image.setScaleType(ImageView.ScaleType.FIT_CENTER);
            image.setImageDrawable(tile.banner != null ? tile.banner : tile.icon);
            int h = (int) ((tile.banner != null ? 80 : 56) * density);
            box.addView(image, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, h));

            TextView label = new TextView(context);
            label.setText(tile.label);
            label.setTextColor(Color.WHITE);
            label.setTextSize(16);
            label.setSingleLine(true);
            label.setGravity(Gravity.CENTER);
            box.addView(label);
            return box;
        }
    }
}
