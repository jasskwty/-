package tv.shashati;

import android.os.Handler;
import android.os.Looper;
import android.service.dreams.DreamService;
import android.widget.FrameLayout;

import java.util.Random;

/** The screensaver: the same clock and prayers, drifting each minute so nothing burns into the screen. */
public class ScreensaverService extends DreamService {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Random random = new Random();
    private InfoPanel panel;
    private FrameLayout root;

    private final Runnable tick = new Runnable() {
        @Override public void run() {
            panel.refresh();
            drift();
            handler.postDelayed(this, 60000 - System.currentTimeMillis() % 60000);
        }
    };

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        setInteractive(false);
        setFullscreen(true);
        setScreenBright(false);
        root = new FrameLayout(this);
        root.setBackgroundResource(R.drawable.bg);
        panel = new InfoPanel(this, true);
        root.addView(panel, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT));
        setContentView(root);
    }

    @Override
    public void onDreamingStarted() {
        super.onDreamingStarted();
        handler.post(tick);
    }

    @Override
    public void onDreamingStopped() {
        super.onDreamingStopped();
        handler.removeCallbacks(tick);
    }

    private void drift() {
        root.post(() -> {
            int maxX = Math.max(0, root.getWidth() - panel.getWidth());
            int maxY = Math.max(0, root.getHeight() - panel.getHeight());
            panel.animate()
                    .x(maxX == 0 ? 0 : random.nextInt(maxX + 1))
                    .y(maxY == 0 ? 0 : random.nextInt(maxY + 1))
                    .setDuration(4000)
                    .start();
        });
    }
}
