const St = imports.gi.St;
const Main = imports.ui.main;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Gtk = imports.gi.Gtk;
const Clutter = imports.gi.Clutter;
const Tweener = imports.ui.tweener;

const Local = imports.misc.extensionUtils.getCurrentExtension();
const INDICATORS_KEY = "indicators";
const FIRSTRUN_KEY = "first-run";
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
        this.actor.add_child(this._box);
        this._initLayout();
    },

    _initLayout: function() {
        //show all
        this._popupItemShowAll = new PopupMenu.PopupMenuItem(_('Show All'));
        this.menu.addMenuItem(this._popupItemShowAll);
        this._popupItemShowAll.connect('activate', this._showAllTimers.bind(this));
        //separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        //settings
        this._popupItemSettings = new PopupMenu.PopupMenuItem(_('Settings'));
        this.menu.addMenuItem(this._popupItemSettings);
        this._popupItemSettings.connect('activate', () => {
            let _appSys = Shell.AppSystem.get_default();
            let _gsmPrefs = _appSys.lookup_app('gnome-shell-extension-prefs.desktop');
            if (_gsmPrefs.get_state() === _gsmPrefs.SHELL_APP_STATE_RUNNING) {
                _gsmPrefs.activate();
            } else {
                let info = _gsmPrefs.get_app_info();
                let timestamp = global.display.get_current_time_roundtrip();
                info.launch_uris([Local.metadata.uuid], global.create_app_launch_context(timestamp, -1));
            }
        });
        this._refresh();
    },

    _refresh: function() {
        this._removeTimeout();
        this._timeout = Mainloop.timeout_add_seconds(10, Lang.bind(this, this._refresh));
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
        this._timers.sort((t1, t2) => t1.daysLeft - t2.daysLeft);
        let txt;
        if (this._timers.length > 0) {
            let shortest = this._timers[0];
            txt = `${shortest.daysLeft} days left until ${shortest.name}`;
        } else {
            txt = "Nothing set";
        }
        this.buttonText.set_text(txt);
        let [, width] = this.buttonText.get_preferred_width(this.buttonText.get_height());
        this._box.set_width(width + 20);
    },

    _updateMenu: function() {
        let self = this;
        let strings = this._timers.map(t => `${t.daysLeft} days left until ${t.name}`);
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
        return Math.ceil((end.getTime() - today.getTime()) / oneDay);
    },

    _showAllTimers: function() {
        let self = this;
        if (!this._desktopBox) {
            this._desktopBox = new St.BoxLayout({ style_class: 'timer-box' });
            this._desktopBox.vertical = true;
            //this._desktopBox.background_color = Clutter.Color.get_static(Clutter.StaticColor.BLACK);
            Main.uiGroup.add_actor(this._desktopBox);
            let strings = this._timers.map(t => `${t.daysLeft} days left until ${t.name}`);
            strings.forEach(s => {
                let text = new St.Label({ text: s });
                text.opacity = 255;
                self._desktopBox.add(text);
            });
        }
        let monitor = Main.layoutManager.primaryMonitor;
        this._desktopBox.set_position(monitor.x + monitor.width / 2, monitor.y + monitor.height / 2);
        Tweener.addTween(this._desktopBox, {
            opacity: 0,
            time: 7,
            transition: 'easeOutQuad',
            onComplete: self._hideTimers
        });
    },

    _hideTimers: function() {
        if (this._desktopBox) {
            Main.uiGroup.remove_actor(this._desktopBox);
            this._desktopBox = null;
        }
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
