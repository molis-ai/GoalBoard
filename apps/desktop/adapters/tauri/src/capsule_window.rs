use std::time::{Duration, Instant};

pub const CAPSULE_FOCUS_LOSS_GRACE: Duration = Duration::from_millis(400);

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct AppKitRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl AppKitRect {
    pub fn contains(self, x: f64, y: f64) -> bool {
        x >= self.x && x < self.x + self.width && y >= self.y && y < self.y + self.height
    }

    pub fn top(self) -> f64 {
        self.y + self.height
    }
}

/// Place the popover in AppKit coordinates: origin is the bottom-left of the
/// main display, y grows up. `visible` is that screen's `visibleFrame`.
pub fn capsule_frame_in_appkit(
    anchor_x: f64,
    visible: AppKitRect,
    window_width: f64,
    window_height: f64,
    gap: f64,
    edge: f64,
) -> AppKitRect {
    let max_width = (visible.width - edge * 2.0).max(1.0);
    let max_height = (visible.height - edge * 2.0).max(1.0);
    let width = window_width.clamp(1.0, max_width);
    let height = window_height.clamp(1.0, max_height);
    let min_x = visible.x + edge;
    let max_x = (visible.x + visible.width - width - edge).max(min_x);
    let x = (anchor_x - width / 2.0).clamp(min_x, max_x);
    let min_y = visible.y + edge;
    let max_y = (visible.top() - height).max(min_y);
    let y = (visible.top() - gap - height).clamp(min_y, max_y);
    AppKitRect {
        x,
        y,
        width,
        height,
    }
}

pub fn capsule_anchor_x(anchor_x: f64, frame: AppKitRect, min_inset: f64) -> f64 {
    let max_inset = (frame.width - min_inset).max(min_inset);
    (anchor_x - frame.x).clamp(min_inset, max_inset)
}

pub fn should_ignore_capsule_focus_loss(until: Option<Instant>, now: Instant) -> bool {
    until.is_some_and(|deadline| now < deadline)
}

pub fn choose_screen_for_point(screens: &[AppKitRect], x: f64, y: f64) -> Option<AppKitRect> {
    screens
        .iter()
        .copied()
        .find(|screen| screen.contains(x, y))
        .or_else(|| screens.first().copied())
}

#[cfg(target_os = "macos")]
pub mod macos {
    use super::{capsule_anchor_x, capsule_frame_in_appkit, choose_screen_for_point, AppKitRect};
    use objc2::runtime::AnyObject;
    use objc2_app_kit::{NSEvent, NSScreen, NSWindow, NSWindowCollectionBehavior};
    use objc2_foundation::{MainThreadMarker, NSRect};
    use tauri::WebviewWindow;

    pub fn prepare_capsule_native_window(window: &WebviewWindow) -> Result<(), String> {
        let ns_window = ns_window(window)?;
        ns_window.setCollectionBehavior(
            NSWindowCollectionBehavior::MoveToActiveSpace
                | NSWindowCollectionBehavior::FullScreenAuxiliary
                | NSWindowCollectionBehavior::Transient
                | NSWindowCollectionBehavior::IgnoresCycle,
        );
        let _ = window.set_ignore_cursor_events(true);
        Ok(())
    }

    pub fn clicked_screen_anchor() -> Result<(f64, AppKitRect), String> {
        let mtm = MainThreadMarker::new().ok_or_else(|| "必须在主线程定位工作胶囊".to_string())?;
        let mouse = NSEvent::mouseLocation();
        let screens = NSScreen::screens(mtm);
        let frames: Vec<AppKitRect> = screens
            .iter()
            .map(|screen| ns_rect_to_appkit(screen.frame()))
            .collect();
        let matched = choose_screen_for_point(&frames, mouse.x, mouse.y)
            .ok_or_else(|| "没有可用显示器，无法定位工作胶囊".to_string())?;
        let visible = screens
            .iter()
            .find_map(|candidate| {
                let frame = ns_rect_to_appkit(candidate.frame());
                (frame == matched).then(|| ns_rect_to_appkit(candidate.visibleFrame()))
            })
            .unwrap_or(matched);
        Ok((mouse.x, visible))
    }

    pub fn position_capsule_on_screen(
        window: &WebviewWindow,
        anchor_x: f64,
        visible: AppKitRect,
        width: f64,
        height: f64,
        gap: f64,
        edge: f64,
    ) -> Result<f64, String> {
        let frame = capsule_frame_in_appkit(anchor_x, visible, width, height, gap, edge);
        let ns_window = ns_window(window)?;
        ns_window.setFrame_display(appkit_to_ns_rect(frame), true);
        ns_window.orderFrontRegardless();
        Ok(capsule_anchor_x(anchor_x, frame, 24.0))
    }

    pub fn reveal_capsule_native_window(window: &WebviewWindow) -> Result<(), String> {
        let ns_window = ns_window(window)?;
        ns_window.makeKeyAndOrderFront(None::<&AnyObject>);
        ns_window.orderFrontRegardless();
        Ok(())
    }

    fn ns_window(window: &WebviewWindow) -> Result<&'static NSWindow, String> {
        let ptr = window.ns_window().map_err(|error| error.to_string())?;
        if ptr.is_null() {
            return Err("工作胶囊 NSWindow 不存在".into());
        }
        Ok(unsafe { &*(ptr as *const NSWindow) })
    }

    fn ns_rect_to_appkit(rect: NSRect) -> AppKitRect {
        AppKitRect {
            x: rect.origin.x,
            y: rect.origin.y,
            width: rect.size.width,
            height: rect.size.height,
        }
    }

    fn appkit_to_ns_rect(rect: AppKitRect) -> NSRect {
        NSRect::new(
            objc2_foundation::NSPoint::new(rect.x, rect.y),
            objc2_foundation::NSSize::new(rect.width, rect.height),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::{
        capsule_anchor_x, capsule_frame_in_appkit, choose_screen_for_point,
        should_ignore_capsule_focus_loss, AppKitRect, CAPSULE_FOCUS_LOSS_GRACE,
    };
    use std::time::{Duration, Instant};

    fn rect(x: f64, y: f64, width: f64, height: f64) -> AppKitRect {
        AppKitRect {
            x,
            y,
            width,
            height,
        }
    }

    #[test]
    fn capsule_sits_below_the_menu_bar_on_the_primary_display() {
        let visible = rect(0.0, 70.0, 1728.0, 1023.0);
        let frame = capsule_frame_in_appkit(1500.0, visible, 420.0, 476.0, 5.0, 8.0);
        assert_eq!(frame.x, 1290.0);
        assert_eq!(frame.y, 612.0);
        assert_eq!(frame.width, 420.0);
        assert_eq!(frame.height, 476.0);
        assert_eq!(capsule_anchor_x(1500.0, frame, 24.0), 210.0);
    }

    #[test]
    fn capsule_stays_on_a_secondary_display_to_the_right() {
        let primary = rect(0.0, 0.0, 1728.0, 1117.0);
        let secondary = rect(1728.0, 37.0, 1920.0, 1080.0);
        let chosen = choose_screen_for_point(&[primary, secondary], 3300.0, 1080.0);
        assert_eq!(chosen, Some(secondary));
        let visible = rect(1728.0, 37.0, 1920.0, 1056.0);
        let frame = capsule_frame_in_appkit(3300.0, visible, 420.0, 476.0, 5.0, 8.0);
        assert!(frame.x >= visible.x + 8.0);
        assert!(frame.x + frame.width <= visible.x + visible.width - 8.0);
        assert_eq!(frame.y, 612.0);
        assert!(
            frame.x >= 1728.0,
            "popover must not jump back to the primary display"
        );
    }

    #[test]
    fn capsule_stays_on_a_secondary_display_to_the_left() {
        let primary = rect(0.0, 0.0, 1728.0, 1117.0);
        let secondary = rect(-1920.0, 0.0, 1920.0, 1080.0);
        let chosen = choose_screen_for_point(&[primary, secondary], -120.0, 1060.0);
        assert_eq!(chosen, Some(secondary));
        let visible = rect(-1920.0, 0.0, 1920.0, 1056.0);
        let frame = capsule_frame_in_appkit(-80.0, visible, 420.0, 476.0, 5.0, 8.0);
        assert!(frame.x >= -1920.0 + 8.0);
        assert!(frame.x + frame.width <= -8.0);
        assert!(
            frame.x + frame.width <= 0.0,
            "popover must stay on the left-hand display"
        );
    }

    #[test]
    fn capsule_clamps_to_the_secondary_right_edge() {
        let visible = rect(1728.0, 0.0, 1920.0, 1056.0);
        let frame = capsule_frame_in_appkit(1728.0 + 1910.0, visible, 420.0, 476.0, 5.0, 8.0);
        assert_eq!(frame.x, 1728.0 + 1920.0 - 420.0 - 8.0);
    }

    #[test]
    fn unknown_point_falls_back_to_the_first_screen() {
        let primary = rect(0.0, 0.0, 1728.0, 1117.0);
        let secondary = rect(1728.0, 0.0, 1920.0, 1080.0);
        assert_eq!(
            choose_screen_for_point(&[primary, secondary], 9000.0, 10.0),
            Some(primary)
        );
        assert_eq!(choose_screen_for_point(&[], 10.0, 10.0), None);
    }

    #[test]
    fn opening_click_does_not_immediately_count_as_outside_click() {
        let now = Instant::now();
        assert!(should_ignore_capsule_focus_loss(
            Some(now + CAPSULE_FOCUS_LOSS_GRACE),
            now + Duration::from_millis(50)
        ));
        assert!(!should_ignore_capsule_focus_loss(
            Some(now + CAPSULE_FOCUS_LOSS_GRACE),
            now + Duration::from_millis(401)
        ));
        assert!(!should_ignore_capsule_focus_loss(None, now));
    }
}
