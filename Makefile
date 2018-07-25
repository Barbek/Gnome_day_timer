DEST_DIR := ~/.local/share/gnome-shell/extensions
EXT_FOLDER := Gnome_day_timer@barbek

DEST_FOLDER := $(DEST_DIR)/$(EXT_FOLDER)

$(DEST_FOLDER) : $(EXT_FOLDER)
	@echo "Copy files"
	cp -r $^ $(DEST_DIR)
