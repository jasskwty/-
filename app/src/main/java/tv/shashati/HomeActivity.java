package tv.shashati;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Color;
import android.graphics.drawable.Drawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** The home screen: clock and prayers on top, the TV's apps below, settings at the end. */
public class HomeActivity extends Activity {
    private static final int COLUMNS = 6;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private InfoPanel panel;
    private LinearLayout apps;

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
        root.setPadding(dp(56), dp(28), dp(56), 0);

        panel = new InfoPanel(this, false);
        root.addView(panel);

        TextView heading = new TextView(this);
        heading.setText("التطبيقات");
        heading.setTextSize(22);
        heading.setTextColor(InfoPanel.GOLD);
        heading.setPadding(dp(8), dp(28), dp(8), dp(4));
        root.addView(heading);

        ScrollView scroll = new ScrollView(this);
        scroll.setClipToPadding(false);
        scroll.setPadding(0, dp(12), 0, dp(32));
        scroll.setVerticalScrollBarEnabled(false);
        apps = new LinearLayout(this);
        apps.setOrientation(LinearLayout.VERTICAL);
        apps.setClipChildren(false);
        scroll.addView(apps);
        root.addView(scroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

        setContentView(root);
    }

    @Override
    protected void onResume() {
        super.onResume();
        showApps(loadApps());
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

    private void showApps(List<Tile> tiles) {
        apps.removeAllViews();
        LinearLayout row = null;
        for (int i = 0; i < tiles.size(); i++) {
            if (i % COLUMNS == 0) {
                row = new LinearLayout(this);
                row.setClipChildren(false);
                apps.addView(row);
            }
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(150), 1);
            lp.setMargins(dp(10), dp(10), dp(10), dp(10));
            row.addView(tileView(tiles.get(i)), lp);
        }
        // Keep the last row's tiles the same width as the rest.
        if (row != null) {
            for (int i = row.getChildCount(); i < COLUMNS; i++) {
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(150), 1);
                lp.setMargins(dp(10), dp(10), dp(10), dp(10));
                row.addView(new View(this), lp);
            }
        }
        if (apps.getChildCount() > 0) ((ViewGroup) apps.getChildAt(0)).getChildAt(0).requestFocus();
    }

    private View tileView(Tile tile) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setBackgroundResource(R.drawable.tile);
        box.setPadding(dp(10), dp(12), dp(10), dp(10));
        box.setFocusable(true);
        box.setClickable(true);
        box.setElevation(dp(2));

        if (tile.banner != null) {
            ImageView image = new ImageView(this);
            image.setScaleType(ImageView.ScaleType.FIT_CENTER);
            image.setImageDrawable(tile.banner);
            image.setClipToOutline(true);
            image.setBackgroundResource(R.drawable.icon_well);
            box.addView(image, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));
        } else {
            FrameLayout well = new FrameLayout(this);
            well.setBackgroundResource(R.drawable.icon_well);
            ImageView image = new ImageView(this);
            image.setScaleType(ImageView.ScaleType.FIT_CENTER);
            image.setImageDrawable(tile.icon);
            if (tile.tint) image.setColorFilter(InfoPanel.GOLD);
            int pad = dp(10);
            image.setPadding(pad, pad, pad, pad);
            well.addView(image, new FrameLayout.LayoutParams(dp(72), dp(72), Gravity.CENTER));
            box.addView(well, new LinearLayout.LayoutParams(dp(72), dp(72)));
        }

        TextView label = new TextView(this);
        label.setText(tile.label);
        label.setTextColor(Color.WHITE);
        label.setTextSize(16);
        label.setSingleLine(true);
        label.setEllipsize(TextUtils.TruncateAt.END);
        label.setGravity(Gravity.CENTER);
        label.setPadding(0, dp(8), 0, 0);
        box.addView(label);

        box.setOnFocusChangeListener((v, focused) -> {
            v.animate().scaleX(focused ? 1.08f : 1f).scaleY(focused ? 1.08f : 1f)
                    .translationZ(focused ? dp(12) : 0).setDuration(150).start();
            label.setTextColor(focused ? InfoPanel.GOLD : Color.WHITE);
        });
        box.setOnClickListener(v -> {
            try {
                startActivity(tile.intent);
            } catch (Exception ignored) {
                // The app was removed since the list was built.
            }
        });
        return box;
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
                tiles.add(new Tile(info.loadLabel(pm).toString(), banner, info.loadIcon(pm), false, launch));
            }
        }
        tiles.sort((a, b) -> a.label.compareToIgnoreCase(b.label));
        tiles.add(new Tile("إعدادات شاشتي", null, getDrawable(R.drawable.ic_settings), true,
                new Intent(this, SettingsActivity.class)));
        return tiles;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private static final class Tile {
        final String label;
        final Drawable banner, icon;
        final boolean tint;
        final Intent intent;

        Tile(String label, Drawable banner, Drawable icon, boolean tint, Intent intent) {
            this.label = label;
            this.banner = banner;
            this.icon = icon;
            this.tint = tint;
            this.intent = intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        }
    }
}
