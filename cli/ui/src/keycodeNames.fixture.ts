/**
 * Every keycode name GET /api/state can report, dumped from the installed
 * `zmk_studio_api.Keycode` enum (the same table zmk_runtime_cli/ui/state.py's
 * keycode_table() builds) so fullKeyboard.ts can be checked without a device:
 *
 *   cli/.venv/bin/python -c "from zmk_runtime_cli.ui.state import keycode_table; \
 *     print(sorted(keycode_table()))"
 *
 * Test fixture only — the UI always uses the live `state.keycodes`.
 */
export const KEYCODE_NAMES: string[] = [
  "A", "ALT_ERASE", "AMPS", "APOSTROPHE", "ASTRK", "ATSN", "B", "BSLH", "BSPC", "C", "CLCK",
  "CLEAR", "CLEAR2", "CLEAR_AGAIN", "CMMA", "COLN", "COPY", "CRRT", "CRSEL", "CUT", "C_AC_BACK",
  "C_AC_CANCEL", "C_AC_CLOSE", "C_AC_COPY", "C_AC_CUT", "C_AC_DEL",
  "C_AC_DESKTOP_SHOW_ALL_APPLICATIONS", "C_AC_DESKTOP_SHOW_ALL_WINDOWS", "C_AC_EDIT",
  "C_AC_EXIT", "C_AC_FAVORITES", "C_AC_FIND", "C_AC_FORWARD", "C_AC_FORWARD_MAIL", "C_AC_GOTO",
  "C_AC_HOME", "C_AC_INS", "C_AC_NEW", "C_AC_OPEN", "C_AC_PASTE", "C_AC_PRINT", "C_AC_PROPS",
  "C_AC_REDO", "C_AC_REFRESH", "C_AC_REPLY", "C_AC_SAVE", "C_AC_SCROLL_DOWN", "C_AC_SCROLL_UP",
  "C_AC_SEARCH", "C_AC_SEND", "C_AC_STOP", "C_AC_UNDO", "C_AC_VIEW_TOGGLE", "C_AC_ZOOM",
  "C_AC_ZOOM_IN", "C_AC_ZOOM_OUT", "C_ALT_AUDIO_INC", "C_AL_ADDRESS_BOOK",
  "C_AL_AV_CAPTURE_PLAYBACK", "C_AL_CAL", "C_AL_CALC", "C_AL_CCC", "C_AL_CHAT", "C_AL_COFFEE",
  "C_AL_CONTROL_PANEL", "C_AL_DB", "C_AL_DOCS", "C_AL_FILES", "C_AL_FINANCE",
  "C_AL_GRAPHICS_EDITOR", "C_AL_HELP", "C_AL_IM", "C_AL_IMAGES", "C_AL_JOURNAL",
  "C_AL_KEYBOARD_LAYOUT", "C_AL_LOGOFF", "C_AL_MAIL", "C_AL_MOVIES", "C_AL_MUSIC",
  "C_AL_MY_COMPUTER", "C_AL_NEWS", "C_AL_NEXT_TASK", "C_AL_PRESENTATION", "C_AL_PREV_TASK",
  "C_AL_SCREEN_SAVER", "C_AL_SELECT_TASK", "C_AL_SHEET", "C_AL_SPELL", "C_AL_TASK_MANAGER",
  "C_AL_TEXT_EDITOR", "C_AL_TUTORIAL", "C_AL_VOICEMAIL", "C_AL_WORD", "C_AL_WWW", "C_ASPECT",
  "C_BASS_BOOST", "C_BKLT_TOG", "C_BLUE", "C_BRI_AUTO", "C_BRI_DEC", "C_BRI_INC", "C_BRI_MAX",
  "C_BRI_MIN", "C_CAPTIONS", "C_CHAN_DEC", "C_CHAN_INC", "C_CHAN_LAST", "C_DATA_ON_SCREEN",
  "C_FF", "C_GREEN", "C_HELP", "C_KBIA_ACCEPT", "C_KBIA_CANCEL", "C_KBIA_NEXT",
  "C_KBIA_NEXT_GRP", "C_KBIA_PREV", "C_KBIA_PREV_GRP", "C_MEDIA_CABLE", "C_MEDIA_CD",
  "C_MEDIA_COMPUTER", "C_MEDIA_DVD", "C_MEDIA_GAMES", "C_MEDIA_GUIDE", "C_MEDIA_HOME",
  "C_MEDIA_MESSAGES", "C_MEDIA_PHONE", "C_MEDIA_SATELLITE", "C_MEDIA_TAPE", "C_MEDIA_TUNER",
  "C_MEDIA_TV", "C_MEDIA_VCR", "C_MEDIA_VCR_PLUS", "C_MEDIA_VIDEOPHONE", "C_MEDIA_WWW",
  "C_MENU", "C_MENU_DEC", "C_MENU_DOWN", "C_MENU_ESC", "C_MENU_INC", "C_MENU_LEFT",
  "C_MENU_PICK", "C_MENU_RIGHT", "C_MENU_UP", "C_MODE_STEP", "C_PAUSE", "C_PIP", "C_PLAY",
  "C_PWR", "C_QUIT", "C_REC", "C_RED", "C_REPEAT", "C_RESET", "C_RW", "C_SHUFFLE", "C_SLEEP",
  "C_SLEEP_MODE", "C_SLOW", "C_SLOW2", "C_SNAPSHOT", "C_STOP_EJECT", "C_VOICE_COMMAND",
  "C_VOL_DN", "C_VOL_UP", "C_YELLOW", "D", "DEL", "DLLR", "DOT", "DOWN", "DQT", "E", "END",
  "ENTER", "EQL", "ESC", "EXCL", "EXSEL", "F", "F1", "F10", "F11", "F12", "F13", "F14", "F15",
  "F16", "F17", "F18", "F19", "F2", "F20", "F21", "F22", "F23", "F24", "F3", "F4", "F5", "F6",
  "F7", "F8", "F9", "FSLH", "G", "GLOBE", "GRAV", "GT", "H", "HASH", "HOME", "I", "INS", "INT7",
  "INT8", "INT9", "INTERNATIONAL_2", "INT_HENKAN", "INT_KPJPCOMMA", "INT_MUHENKAN", "INT_RO",
  "INT_YEN", "J", "K", "KPLS", "KP_CLEAR", "KP_COMMA", "KP_DOT", "KP_ENTER", "KP_EQUAL",
  "KP_EQUAL_AS400", "KP_LPAR", "KP_MINUS", "KP_MULTIPLY", "KP_N0", "KP_N1", "KP_N2", "KP_N3",
  "KP_N4", "KP_N5", "KP_N6", "KP_N7", "KP_N8", "KP_N9", "KP_NLCK", "KP_RPAR", "KP_SLASH",
  "K_APPLICATION", "K_BACK", "K_CALC", "K_CANCEL", "K_COFFEE", "K_EDIT", "K_EJECT", "K_EXEC",
  "K_FIND", "K_FIND2", "K_FORWARD", "K_HELP", "K_MENU", "K_MUTE", "K_MUTE2", "K_NEXT", "K_PP",
  "K_PREV", "K_PWR", "K_REDO", "K_REFRESH", "K_SCROLL_DOWN", "K_SCROLL_UP", "K_SELECT",
  "K_SLEEP", "K_STOP", "K_STOP2", "K_STOP3", "K_VOL_DN", "K_VOL_DN2", "K_VOL_UP", "K_VOL_UP2",
  "K_WWW", "L", "LABT", "LALT", "LANG6", "LANG7", "LANG8", "LANG9", "LANGUAGE_1", "LANGUAGE_2",
  "LANGUAGE_3", "LANGUAGE_4", "LANGUAGE_5", "LBKT", "LBRC", "LCAPS", "LCTRL", "LEFT",
  "LEFT_META", "LNLCK", "LPAR", "LSHIFT", "LSLCK", "M", "MINUS", "M_EJCT", "M_MUTE", "M_NEXT",
  "M_PLAY", "M_PREV", "M_STOP", "N", "NON_US_BSLH", "NUHS", "NUM_0", "NUM_1", "NUM_2", "NUM_3",
  "NUM_4", "NUM_5", "NUM_6", "NUM_7", "NUM_8", "NUM_9", "O", "OPER", "OUT", "P", "PAUS",
  "PG_DN", "PG_UP", "PIPE", "PIPE2", "PLUS", "PRCNT", "PRIOR", "PSCRN", "PSTE", "Q", "QMARK",
  "R", "RALT", "RBKT", "RBRC", "RCTRL", "RET2", "RIGHT", "RIGHT_META", "RPAR", "RSHIFT", "S",
  "SEMI", "SEPARATOR", "SLCK", "SPC", "SYSREQ", "SYS_PWR", "SYS_SLEEP", "SYS_WAKE", "T", "TAB",
  "TILD", "TILDE2", "U", "UARW", "UNDER", "UNDO", "V", "W", "X", "Y", "Z",
];
