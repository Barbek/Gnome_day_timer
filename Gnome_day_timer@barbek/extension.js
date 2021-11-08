const St = imports.gi.St;
const Main = imports.ui.main;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Gtk = imports.gi.Gtk;
const Clutter = imports.gi.Clutter;
const ExtensionUtils = imports.misc.extensionUtils;

const Local = ExtensionUtils.getCurrentExtension();
const INDICATORS_KEY = "indicators";
const FIRSTRUN_KEY = "first-run";
const TIME_OUT = 1;
let Settings = Local.imports.convenience.getSettings();

const GnomeDayTimerIndicator = new Lang.Class({
    Name: 'GnomeDayTimerIndicator',
    Extends: PanelMenu.Button,

    _init: function() {
        this.parent(0, "GnomeDayTimerIndicator", false);
        this._box = new St.BoxLayout();
        this.buttonText = new St.Label({
            text: ' Menu ',
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        this._box.add(this.buttonText);
        this._box.add(PopupMenu.arrowIcon(St.Side.BOTTOM));
        this._initLayout();
    },

    _initLayout: function() {
        //hover stuff
        this.actor.add_child(this._box);
        this.actor.connect("enter-event", (_widget) => {
            this._showAllTimers();
        });
        this.actor.connect("leave-event", (_widget) => {
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
    },

    _refresh: function() {
        this._removeTimeout();
        this._timeout = Mainloop.timeout_add_seconds(TIME_OUT, Lang.bind(this, this._refresh));
        this._refreshUI();
        return true;
    },

    _removeTimeout: function() {
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
    },

    _refreshUI: function() {
        this._timers = [];
        this._config = Settings.get_strv(INDICATORS_KEY);
        for (let key in this._config) {
            let json = JSON.parse(this._config[key]);
            this._timers.push(json);
        }
        let self = this;
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
        let [, width] = this.buttonText.get_preferred_width(this.buttonText.get_height());
        this._box.set_width(width + 20);
        if (this._desktopBox) {
            let strings = this._timers.map(t => self._stringifyTimer(t));
            this._desktopBox.remove_all_children();
            strings.forEach(s => {
                let text = new St.Label({ text: s });
                text.opacity = 255;
                self._desktopBox.add(text);
            });
        }
    },

    _updateMenu: function() {
        let self = this;
        let strings = this._timers.map(t => self._stringifyTimer(t));
        this.menu.removeAll();
        strings.forEach(s => {
            self.menu.addMenuItem(new PopupMenu.PopupMenuItem(s));
        });
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this._popupItemSettings);
    },

    _calculateDaysLeft: function(end) {
        let oneDay = 1000 * 60 * 60 * 24;
        let today = new Date();
        return Math.floor((end.getTime() - today.getTime()) / oneDay);
    },

    _calculateTimeLeft: function(end) {
        let now = new Date();
        let distance = end.getTime() - now.getTime();
        var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        var seconds = Math.floor((distance % (1000 * 60)) / 1000);
        var date = new Date(null);
        date.setHours(hours, minutes, seconds);
        var timeString = date.toLocaleTimeString();
        return timeString;
    },

    _showAllTimers: function() {
        let self = this;
        if (!this._desktopBox) {
            this._desktopBox = new St.BoxLayout({ style_class: 'timer-box' });
            this._desktopBox.vertical = true;
            //this._desktopBox.background_color = Clutter.Color.get_static(Clutter.StaticColor.BLACK);
            Main.uiGroup.add_actor(this._desktopBox);
            let strings = this._timers.map(t => self._stringifyTimer(t));
            strings.forEach(s => {
                let text = new St.Label({ text: s });
                text.opacity = 255;
                self._desktopBox.add(text);
            });
        }
        let monitor = Main.layoutManager.primaryMonitor;
        this._desktopBox.set_position(monitor.x + monitor.width / 2, monitor.y + Main.panel.actor.height);
    },

    _hideTimers: function() {
        if (this._desktopBox) {
            Main.uiGroup.remove_actor(this._desktopBox);
            this._desktopBox = null;
        }
    },

    _stringifyTimer: function(timer) {
        if (timer.daysLeft > 1) {
            return _(`${timer.daysLeft + 1} days left until ${timer.name}`);
        } else if (timer.daysLeft > 0) {
            return _(`${timer.daysLeft + 1} day left until ${timer.name}`);
        }
        let timeLeft = this._calculateTimeLeft(new Date(timer.date));
        return _(`${timeLeft} left until ${timer.name}`);
    },

    _removeEnded: function() {
        this._timers = this._timers.filter(t => {
            return t.daysLeft >= 0;
        });
    },

    stop: function() {
        if (this._timeout)
            Mainloop.source_remove(this._timeout);
        this._timeout = undefined;

        this.menu.removeAll();
    }
});

let gtMenu;

function init() {}

function enable() {
    gtMenu = new GnomeDayTimerIndicator();
    Main.panel.addToStatusArea('gnome-day-timer-indicator', gtMenu);
}

function disable() {
    gtMenu.stop();
    gtMenu.destroy();
}
