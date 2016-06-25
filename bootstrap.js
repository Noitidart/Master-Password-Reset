// Imports
const {interfaces: Ci, utils: Cu, classes:Cc, Constructor: CC} = Components;
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource:///modules/CustomizableUI.jsm');
Cu.import('resource://gre/modules/osfile.jsm');

// Globals
var core = {
	addon: {
		name: 'Master-Password-Reset',
		id: 'Master-Password-Reset@jetpack',
		path: {
			name: 'masterpasswordreset',
			//
			content: 'chrome://masterpasswordreset/content/',
			locale: 'chrome://masterpasswordreset/locale/',
			//
			modules: 'chrome://masterpasswordreset/content/modules/',
			workers: 'chrome://masterpasswordreset/content/modules/workers/',
			//
			resources: 'chrome://masterpasswordreset/content/resources/',
			images: 'chrome://masterpasswordreset/content/resources/images/',
			scripts: 'chrome://masterpasswordreset/content/resources/scripts/',
			styles: 'chrome://masterpasswordreset/content/resources/styles/',
			fonts: 'chrome://masterpasswordreset/content/resources/styles/fonts/',
			pages: 'chrome://masterpasswordreset/content/resources/pages/'
			// below are added by worker
			// storage: OS.Path.join(OS.Constants.Path.profileDir, 'jetpack', core.addon.id, 'simple-storage')
		},
		pref_branch: 'extensions.Master-Password-Reset@jetpack.',
		cache_key: Math.random() // set to version on release
	},
	os: {
		name: OS.Constants.Sys.Name.toLowerCase()
		// mname: added by worker
		// toolkit: Services.appinfo.widgetToolkit.toLowerCase(),
		// xpcomabi: Services.appinfo.XPCOMABI
	},
	firefox: {
		pid: Services.appinfo.processID,
		version: Services.appinfo.version
		// channel: Services.prefs.getCharPref('app.update.channel')
	}
};

var gCuiCssUri;
var gGenCssUri;

var gAndroidMenus = [];

function install() {}

function uninstall(aData, aReason) {
	if (aReason == ADDON_UNINSTALL) {}
}

function startup(aData, aReason) {
	if (core.os.name != 'android') {
		// determine gCuiCssFilename for windowListener.register
		gCuiCssUri = Services.io.newURI(core.addon.path.styles + 'cui.css', null, null);
		gGenCssUri = Services.io.newURI(core.addon.path.styles + 'chrome.css', null, null);

		// insert cui
		CustomizableUI.createWidget({
			id: 'cui_masterpasswordreset',
			defaultArea: CustomizableUI.AREA_NAVBAR,
			label: 'Toggle Lock', // TODO: l10n
			tooltiptext: 'Toggle Lock', // TODO: l10n
			onCommand: cuiClick
		});

		windowListener.register();
	} else {

	}

	gObserves.init();
}

function shutdown(aData, aReason) {

	if (aReason == APP_SHUTDOWN) { return }

	if (core.os.name != 'android') {
		CustomizableUI.destroyWidget('cui_masterpasswordreset');
		windowListener.unregister();
	} else {
		for (var entry of gAndroidMenus) {
			var domwin;
			try {
				domwin = entry.domwin.get();
			} catch(ex) {
				// its dead
				continue;
			}
			if (!domwin) {
				// its dead
				continue;
			}
			domwin.NativeWindow.menu.remove(entry.menuid);
		}
	}
	gObserves.uninit();

}

var windowListener = {
	//DO NOT EDIT HERE
	onOpenWindow: function (aXULWindow) {
		// Wait for the window to finish loading
		var aDOMWindow = aXULWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
		aDOMWindow.addEventListener('load', function () {
			aDOMWindow.removeEventListener('load', arguments.callee, false);
			windowListener.loadIntoWindow(aDOMWindow);
		}, false);
	},
	onCloseWindow: function (aXULWindow) {},
	onWindowTitleChange: function (aXULWindow, aNewTitle) {},
	register: function () {

		// Load into any existing windows
		let DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			let aDOMWindow = DOMWindows.getNext();
			if (aDOMWindow.document.readyState == 'complete') { //on startup `aDOMWindow.document.readyState` is `uninitialized`
				windowListener.loadIntoWindow(aDOMWindow);
			} else {
				aDOMWindow.addEventListener('load', function () {
					aDOMWindow.removeEventListener('load', arguments.callee, false);
					windowListener.loadIntoWindow(aDOMWindow);
				}, false);
			}
		}
		// Listen to new windows
		Services.wm.addListener(windowListener);
	},
	unregister: function () {
		// Unload from any existing windows
		let DOMWindows = Services.wm.getEnumerator(null);
		while (DOMWindows.hasMoreElements()) {
			let aDOMWindow = DOMWindows.getNext();
			windowListener.unloadFromWindow(aDOMWindow);
		}
		/*
		for (var u in unloaders) {
			unloaders[u]();
		}
		*/
		//Stop listening so future added windows dont get this attached
		Services.wm.removeListener(windowListener);
	},
	//END - DO NOT EDIT HERE
	loadIntoWindow: function (aDOMWindow) {
		if (!aDOMWindow) { return }

		if (aDOMWindow.gBrowser) {

			if (core.os.name != 'android') {
				var domWinUtils = aDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
				console.log('gCuiCssUri:', gCuiCssUri);
				domWinUtils.loadSheet(gCuiCssUri, domWinUtils.AUTHOR_SHEET);
				// domWinUtils.loadSheet(gGenCssUri, domWinUtils.AUTHOR_SHEET);
			} else {
				var menuid = aDOMWindow.NativeWindow.menu.add('Lock It', core.addon.path.images + 'icon-color16.png', cuiClick)
				gAndroidMenus.push({
					domwin: Cu.getWeakReference(aDOMWindow),
					menuid
				});
			}
		}
	},
	unloadFromWindow: function (aDOMWindow) {
		if (!aDOMWindow) { return }

		if (aDOMWindow.gBrowser) {
			var domWinUtils = aDOMWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
			domWinUtils.removeSheet(gCuiCssUri, domWinUtils.AUTHOR_SHEET);
			// domWinUtils.removeSheet(gGenCssUri, domWinUtils.AUTHOR_SHEET);
		}
	}
};

// functions
var gAndroidMenuIds = [];
function cuiClick(e) {
	var token_db = Cc['@mozilla.org/security/pk11tokendb;1'].getService(Ci.nsIPK11TokenDB).getInternalKeyToken();
	token_db.logoutAndDropAuthenticatedResources();
}

//start obs stuff
var gObserves = {
	observers: {
		'idle': function (aSubject, aTopic, aData) {
			console.log('idle!', aSubject, aTopic, aData);

			cuiClick();
		}
	},
	init: function() {
		console.log('this.observers:', this.observers);
		for (var o in this.observers) {
			console.log('initing o:', o);

			// register it
			// make it an object so i can addObserver and removeObserver to it
			this.observers[o] = {
				observe: this.observers[o]
			};
			Services.obs.addObserver(this.observers[o], o, false);
		}
	},
	uninit: function() {
		for (var o in this.observers) {
			// unregister it
			Services.obs.removeObserver(this.observers[o], o);

			// restore it as a function so it can be re-inited
			this.observers[o] = this.observers[o].observe;
		}
	}
}
//end obs stuff

// start - common helper functions
// end - common helper functions
