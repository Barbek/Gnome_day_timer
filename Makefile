DEST_DIR := ~/.local/share/gnome-shell/extensions
EXT_FOLDER := Gnome_day_timer@barbek

DEST_FOLDER := $(DEST_DIR)/$(EXT_FOLDER)
FILES := $(shell find $(DEST_FOLDER) -type f)

install: $(FILES)
	@echo "Copy files"
	cp -r $(EXT_FOLDER) $(DEST_DIR)

all: install
