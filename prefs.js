const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

let extension = imports.misc.extensionUtils.getCurrentExtension();
let convenience = extension.imports.convenience;

const DateListModel = extension.imports.DateListModel.DateListModel;

let Schema;

function init() {
    Schema = convenience.getSettings();
}

const App = new Lang.Class({
    Name: "GnomeDayTimer.GnomeDayTimerSettingsWidget",
    GTypeName: "GnomeDayTimerSettingsWidget",
    Extends: Gtk.Box,

    _init: function() {
        this.parent({
            orientation: Gtk.Orientation.HORIZONTAL
        });

        this._store = new DateListModel();

        /* sidebar (left) */

        let sidebar = new Gtk.Box({
            margin: 10,
            orientation: Gtk.Orientation.VERTICAL,
            width_request: 240
        });

        sidebar.add(this._getTreeView());
        sidebar.add(this._getToolbar());

        this.add(sidebar);

        /* config (right) */

        let configLayout = new Gtk.Box({
            margin: 10,
            orientation: Gtk.Orientation.VERTICAL,
            expand: true
        });

        this._inputField = new Gtk.Entry({
            "margin-bottom": 10,
            hexpand: true
        });

        this._inputField.connect('changed', this._onNameChanged.bind(this));

        this._dataWidget = new Gtk.Calendar({
            hexpand: false,
            vexpand: true
        });

        this._dataWidget.connect('day-selected', this._onDateChanged.bind(this));

        configLayout.add(this._inputField);
        configLayout.add(this._dataWidget);

        this.add(configLayout);

        this._selection = this._treeView.get_selection();
        this._selection.connect('changed', this._onSelectionChanged.bind(this));
    },

    _getTreeView: function() {
        this._treeView = new Gtk.TreeView({
            model: this._store,
            headers_visible: false,
            reorderable: true,
            hexpand: false,
            vexpand: true
        });

        let label = new Gtk.TreeViewColumn({ title: "Label" });
        let renderer = new Gtk.CellRendererText();
        label.pack_start(renderer, true);
        label.add_attribute(renderer, "text", 0);
        this._treeView.insert_column(label, 0);

        return this._treeView;
    },

    _getToolbar: function() {
        let toolbar = this._toolbar = new Gtk.Toolbar({
            icon_size: 1
        });

        toolbar.get_style_context().add_class(Gtk.STYLE_CLASS_INLINE_TOOLBAR);

        /* new widget button with menu */
        let newButton = new Gtk.ToolButton({ icon_name: "list-add-symbolic" });
        newButton.connect('clicked', this._addClicked.bind(this));
        toolbar.add(newButton);

        /* delete button */
        let delButton = this._delButton =
            new Gtk.ToolButton({ icon_name: "list-remove-symbolic" });
        delButton.connect('clicked', this._delClicked.bind(this));

        toolbar.add(delButton);

        return toolbar;
    },

    _onSelectionChanged: function() {
        this._selectionActive = true;
        let [isSelected, , iter] = this._selection.get_selected();

        if (isSelected) {
            let _conf = this._store.getConfig(iter);
            this._setDate(_conf.get("date"));
            this._inputField.set_text(_conf.get("name"));
        }
        this._selectionActive = false;
    },

    _addClicked: function() {
        this._store.append();
    },

    _delClicked: function() {
        let [isSelected, , iter] = this._selection.get_selected();

        if (isSelected) {
            this._store.remove(iter);
        }
    },

    _setDate: function(date) {
        let _d = new Date(date);
        if (_d) {
            this._dataWidget.day = _d.getDate();
            this._dataWidget.month = _d.getMonth();
            this._dataWidget.year = _d.getFullYear();
        }
    },

    _onDateChanged: function() {
        //lock this until selection completed
        if (!this._selectionActive) {
            let _date = new Date();
            _date.setFullYear(this._dataWidget.year);
            _date.setMonth(this._dataWidget.month);
            _date.setDate(this._dataWidget.day);
            _date.setHours(0, 0, 0);
            let [isSelected, , iter] = this._selection.get_selected();
            if (isSelected) {
                let _conf = this._store.getConfig(iter);
                this._store.getConfig(iter).set("date", _date);
            }
        }
    },

    _onNameChanged: function() {
        let [isSelected, , iter] = this._selection.get_selected();

        if (isSelected) {
            let _changedText = this._inputField.get_text();
            let _conf = this._store.getConfig(iter);
            _conf.set("name", _changedText);
        }
    }
});

function buildPrefsWidget() {
    let widget = new App();
    widget.show_all();
    return widget;
}
