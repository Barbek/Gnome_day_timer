const St = imports.gi.St;
const Main = imports.ui.main;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const {GObject} = imports.gi;
const Gtk = imports.gi.Gtk;
const Clutter = imports.gi.Clutter;
const ExtensionUtils = imports.misc.extensionUtils;

const Local = ExtensionUtils.getCurrentExtension();
const Settings = Local.imports.convenience.getSettings();
const INDICATORS_KEY = "indicators";
const FIRSTRUN_KEY = "first-run";
const TIME_OUT = 1;

class GnomeDayTimerIndicator {

    constructor() {
        this._init();
    }

    _init() {
        // button for panel
        this.indicator = new PanelMenu.Button();
        // text for the panel button
        this.buttonText = new St.Label({
            text: ' Menu ',
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        // add text obj to panel button
        this.indicator.add_actor(this.buttonText);
        this.menu = this.indicator.menu
        this._initLayout();
    }

    _initLayout() {
        //hover stuff
        this.indicator.connect("enter-event", (_widget) => {
            this._showAllTimers();
        });
        this.indicator.connect("leave-event", (_widget) => {
            this._hideTimers();
        });
        //separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        //settings
        this._popupItemSettings = new PopupMenu.PopupMenuItem(_('Settings'));
        this.menu.addMenuItem(this._popupItemSettings);
        this._popupItemSettings.connect('activate', () => {
            if (typeof ExtensionUtils.openPrefs === 'function') {
                ExtensionUtils.openPrefs();
            } else if (_gsmPrefs.get_state() === _gsmPrefs.SHELL_APP_STATE_RUNNING) {
                _gsmPrefs.activate();
            } else {
                let info = _gsmPrefs.get_app_info();
                let timestamp = global.display.get_current_time_roundtrip();
                info.launch_uris([metadata.uuid], global.create_app_launch_context(timestamp, -1));
            }
        });
        this._refresh();
    }

    _refresh() {
        this._removeTimeout();
        this._timeout = Mainloop.timeout_add_seconds(TIME_OUT, Lang.bind(this, this._refresh));
        this._refreshUI();
        return true;
    }

    _removeTimeout() {
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
    }

    _refreshUI() {
        this._timers = [];
        this._config = Settings.get_strv(INDICATORS_KEY);
        for (let key in this._config) {
            let json = JSON.parse(this._config[key]);
            this._timers.push(json);
        }
        const self = this;
        this._timers.forEach(t => {
            t.daysLeft = self._calculateDaysLeft(new Date(t.date));
            // print(t.name, t.daysLeft);
        });
        this._removeEnded();
        this._timers.sort((t1, t2) => t1.daysLeft - t2.daysLeft);
        let txt;
        if (this._timers.length > 0) {
            let shortest = this._timers[0];
            txt = this._stringifyTimer(shortest);
        } else {
            txt = "Nothing set";
        }
        this.buttonText.set_text(txt);
        const [, width] = this.buttonText.get_preferred_width(this.buttonText.get_height());
        if (this._desktopBox) {
            let strings = this._timers.map(t => self._stringifyTimer(t));
            this._desktopBox.remove_all_children();
            strings.forEach(s => {
                let text = new St.Label({ text: s });
                text.opacity = 255;
                self._desktopBox.add(text);
            });
        }
    }

    _updateMenu() {
        let self = this;
        let strings = this._timers.map(t => self._stringifyTimer(t));
        this.menu.removeAll();
        strings.forEach(s => {
            self.menu.addMenuItem(new PopupMenu.PopupMenuItem(s));
        });
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this._popupItemSettings);
    }

    _calculateDaysLeft(end) {
        let oneDay = 1000 * 60 * 60 * 24;
        let today = new Date();
        return Math.floor((end.getTime() - today.getTime()) / oneDay);
    }

    _calculateTimeLeft(end) {
        let now = new Date();
        let distance = end.getTime() - now.getTime();
        var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        var seconds = Math.floor((distance % (1000 * 60)) / 1000);
        var date = new Date(null);
        date.setHours(hours, minutes, seconds);
        var timeString = date.toLocaleTimeString();
        return timeString;
    }

    _showAllTimers() {
        const self = this;
        if (!this._desktopBox) {
            this._desktopBox = new St.BoxLayout({ style_class: 'timer-box' });
            this._desktopBox.vertical = true;
            //this._desktopBox.background_color = Clutter.Color.get_static(Clutter.StaticColor.BLACK);
            Main.uiGroup.add_actor(this._desktopBox);
            const strings = this._timers.map(t => self._stringifyTimer(t));
            strings.forEach(s => {
                const text = new St.Label({ text: s });
                text.opacity = 255;
                self._desktopBox.add(text);
            });
        }
        const monitor = Main.layoutManager.primaryMonitor;
        this._desktopBox.set_position(monitor.x + monitor.width / 2, monitor.y + Main.panel.height);
    }

    _hideTimers() {
        if (this._desktopBox) {
            Main.uiGroup.remove_actor(this._desktopBox);
            this._desktopBox = null;
        }
    }

    _stringifyTimer(timer) {
        if (timer.daysLeft > 1) {
            return _(`${timer.daysLeft + 1} days left until ${timer.name}`);
        } else if (timer.daysLeft > 0) {
            return _(`${timer.daysLeft + 1} day left until ${timer.name}`);
        }
        let timeLeft = this._calculateTimeLeft(new Date(timer.date));
        return _(`${timeLeft} left until ${timer.name}`);
    }

    _removeEnded() {
        this._timers = this._timers.filter(t => {
            return t.daysLeft >= 0;
        });
    }

    stop() {
        if (this._timeout)
            Mainloop.source_remove(this._timeout);
        this._timeout = undefined;

        this.menu.removeAll();
        this.indicator.destroy();
    }
}

let gtMenu;

function init(meta) {
    log(`initializing ${meta.metadata.name}`);
}

function enable() {
    gtMenu = new GnomeDayTimerIndicator();
    Main.panel.addToStatusArea('gnome-day-timer-indicator', gtMenu.indicator);
}

function disable() {
    gtMenu.stop();
    gtMenu.destroy();
}
