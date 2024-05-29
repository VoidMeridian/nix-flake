/**
 * @name Pluralchum
 * @version 2.2.0
 * @description PluralKit integration for BetterDiscord. Inexplicably Homestuck-themed.
 * @author Ash Taylor
 *
 */

'use strict';

var require$$0 = BdApi.React;

const React$b = BdApi.React;
class ValueCell {
  #val;
  #listeners = [];
  constructor(val) {
    this.#val = val;
  }
  get() {
    return this.#val;
  }
  set(x) {
    this.update(function () {
      return x;
    });
  }
  update(f) {
    let old = this.#val;
    let current = f(old);
    this.#val = current;
    if (old !== current) {
      this.#listeners.forEach(function (listener) {
        listener(current);
      });
    }
  }
  addListener(f) {
    this.#listeners.push(f);

    // removeListener function
    return function () {
      let index = this.#listeners.indexOf(f);
      this.#listeners.splice(index, 1);
    }.bind(this);
  }
}
class MapCell {
  #map;
  #listeners = [];
  constructor(map) {
    this.#map = map;
  }
  get(key) {
    if (Object.hasOwn(this.#map, key)) {
      return this.#map[key];
    } else {
      return null;
    }
  }
  set(key, value) {
    this.update(key, function () {
      return value;
    });
  }
  entries() {
    return Object.entries(this.#map);
  }
  update(key, f) {
    let old = this.get(key);
    let current = f(old);
    this.#map[key] = current;
    if (old !== current) {
      this.#listeners.forEach(function (listener) {
        listener(key, current);
      });
    }
  }
  addListener(f) {
    this.#listeners.push(f);

    // removeListener function
    return function () {
      let index = this.#listeners.indexOf(f);
      this.#listeners.splice(index, 1);
    }.bind(this);
  }
  delete(key) {
    delete this.#map[key];
    this.#listeners.forEach(function (listener) {
      listener(key, null);
    });
  }
  clear() {
    this.#map = {};
    this.#listeners.forEach(function (listener) {
      listener(null, null);
    });
  }
}
function hookupValueCell(cell) {
  const [value, setValue] = React$b.useState(cell.get());
  React$b.useEffect(function () {
    return cell.addListener(setValue);
  });
  return [value, setValue];
}
function isProxiedMessage(message) {
  return message.webhookId !== null;
}
async function sleep(timeout) {
  return new Promise(resolve => setTimeout(resolve, timeout));
}
function dummy() {
  return new Proxy(dummy, {
    apply: dummy,
    get: dummy
  });
}
const pluginName = 'Pluralchum';

const React$a = BdApi.React;
let warned = false;
const handler = {
  get: function (target, prop) {
    if (!global.ZLibrary) {
      if (!warned) {
        BdApi.UI.alert('Library Missing', ['A plugin library needed for Pluralchum is missing', /*#__PURE__*/React$a.createElement("br", null), /*#__PURE__*/React$a.createElement("br", null), /*#__PURE__*/React$a.createElement("a", {
          href: "https://betterdiscord.app/plugin/ZeresPluginLibrary",
          target: "_blank"
        }, "Click here to download the library!")]);
        BdApi.Plugins.disable('Pluralchum');
        warned = true;
      }
      return dummy();
    } else {
      return global.ZLibrary[prop];
    }
  }
};
var ZLibrary = new Proxy({}, handler);

var styles = ".plugin-inputs.collapsible {\n  overflow: visible;\n}\n\n.plugin-inputs.collapsible.collapsed {\n  overflow: hidden;\n}\n";

let css = document.createElement('style');
css.id = 'PluralchumCSS';
css.innerHTML = styles;
document.head.append(css);

const React$9 = BdApi.React;
const ProfileStatus = {
  Done: 'DONE',
  Updating: 'UPDATING',
  Requesting: 'REQUESTING',
  NotPK: 'NOT_PK',
  Stale: 'STALE'
};
const baseEndpoint = 'https://api.pluralkit.me/v2';
const userAgent = 'PLURALCHUM (github.com/estroBiologist/pluralchum)';
const delayPerRequest = 600;
let currentRequests = -1;
async function httpGetAsync(url) {
  currentRequests += 1;
  await sleep(currentRequests * delayPerRequest);
  let headers = new Headers({
    'User-Agent': userAgent
  });
  let response = await fetch(url, {
    headers
  });
  currentRequests -= 1;
  return response;
}
function pkDataToProfile(data) {
  let profile = {
    name: data.member.name,
    color: '#' + data.member.color,
    tag: data.system.tag,
    id: data.member.id,
    system: data.system.id,
    status: ProfileStatus.Done,
    system_color: '#' + data.system.color,
    sender: data.sender
  };
  if (data.member.color === null) profile.color = '';
  if (data.system.color === null) profile.system_color = '';
  if (data.member.display_name) {
    profile.name = data.member.display_name;
  }
  return profile;
}
async function pkResponseToProfile(response) {
  if (response.status == 200) {
    console.log('RESPONSE');
    let data = await response.json();
    console.log(data);
    return pkDataToProfile(data);
  } else if (response.status == 404) {
    return {
      status: ProfileStatus.NotPK
    };
  }
}
async function getFreshProfile(message) {
  let profileResponse = await httpGetAsync(`${baseEndpoint}/messages/${message.id}`);
  return await pkResponseToProfile(profileResponse);
}
async function updateFreshProfile(message, hash, profileMap) {
  profileMap.update(hash, function (profile) {
    if (profile !== null) {
      profile.status = ProfileStatus.Updating;
      return profile;
    } else {
      return {
        status: ProfileStatus.Requesting
      };
    }
  });
  let profile = await getFreshProfile(message);
  profileMap.set(hash, profile);
}
function hashCode(text) {
  var hash = 0;
  for (var i = 0; i < text.length; i++) {
    var char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}
function getUserHash(author) {
  let username = author.username;
  if (Object.hasOwn(author, 'username_real')) username = author.username_real;
  return hashCode(username + author.avatar);
}
function shouldUpdate(profile) {
  return !profile || profile.status === ProfileStatus.Stale;
}
async function updateProfile(message, profileMap) {
  if (!isProxiedMessage(message)) return null;
  let username = message.author.username;
  if (Object.hasOwn(message.author, 'username_real')) username = message.author.username_real;
  let userHash = getUserHash(message.author);
  let profile = profileMap.get(userHash);
  if (shouldUpdate(profile)) {
    console.log(`[PLURALCHUM] Requesting data for ${username} (${userHash})`);
    try {
      await updateFreshProfile(message, userHash, profileMap);
    } catch (e) {
      console.log(`[PLURALCHUM] Error while requesting data for ${username} (${userHash}): ${e}`);
    }
  }
}
function hookupProfile(profileMap, author) {
  let userHash = getUserHash(author);
  const [profile, setProfile] = React$9.useState(profileMap.get(userHash));
  React$9.useEffect(function () {
    return profileMap.addListener(function (key, value) {
      if (key === userHash) {
        setProfile(value);
      }
    });
  });
  return [profile, setProfile];
}

const ColourPreference = {
  Member: 0,
  System: 1,
  Theme: 2,
  // (do nothing)
  Role: 3
};
function defaultSettings() {
  return {
    eula: false,
    doColourText: true,
    contrastTestColour: '#000000',
    doContrastTest: true,
    contrastThreshold: 3,
    memberColourPref: ColourPreference.Member,
    tagColourPref: ColourPreference.System,
    useServerNames: true,
    version: null
  };
}
function loadSettings() {
  let settings = ZLibrary.Utilities.loadSettings(pluginName, defaultSettings());

  // Clear out old cache from previous versions
  delete settings.profileMap;
  delete settings.idMap;
  ZLibrary.Utilities.saveSettings(pluginName, settings);
  return settings;
}
function initializeSettings() {
  let settings = new ValueCell(loadSettings());
  settings.addListener(function (s) {
    ZLibrary.Utilities.saveSettings(pluginName, s);
  });
  return settings;
}
function filterDoneProfiles(entries) {
  const filtered = entries.filter(([_, profile]) => profile.status === ProfileStatus.Done);
  return Object.fromEntries(filtered);
}
function initializeProfileMap() {
  const key = 'profileMap';
  let map = new MapCell(BdApi.Data.load(pluginName, key) ?? {});
  map.addListener(function () {
    BdApi.Data.save(pluginName, key, filterDoneProfiles(map.entries()));
  });
  return map;
}
function tooOld(lastUsed) {
  const expirationTime = 1000 * 60 * 60 * 24 * 30;
  return Date.now() - lastUsed > expirationTime;
}
function purgeOldProfiles(profileMap) {
  if (!profileMap) return;
  for (const [id, profile] of profileMap.entries()) {
    if (Object.hasOwn(profile, 'lastUsed')) {
      if (tooOld(profile.lastUsed)) {
        profileMap.delete(id);
      }
    } else {
      profileMap.update(id, function () {
        return {
          ...profile,
          lastUsed: Date.now()
        };
      });
    }
  }
}

const React$8 = BdApi.React;
function headsUp(onConfirm, onCancel) {
  BdApi.UI.showConfirmationModal('Heads up!', /*#__PURE__*/React$8.createElement("div", {
    style: {
      color: 'var(--text-normal)',
      'text-align': 'center'
    }
  }, "This plugin uses the PluralKit API to fetch system and member data. ", /*#__PURE__*/React$8.createElement("br", null), /*#__PURE__*/React$8.createElement("br", null), "Because of technical limitations, this data is cached on your computer between sessions. None of this data is ever shared, collected or uploaded, but you still ought to know.", /*#__PURE__*/React$8.createElement("br", null), /*#__PURE__*/React$8.createElement("br", null), /*#__PURE__*/React$8.createElement("b", null, "You can clear this cache at any time in the plugin settings"), ", and unused cache data is automatically deleted after 30 days."), {
    confirmText: 'Gotcha',
    cancelText: 'No thanks',
    onConfirm,
    onCancel
  });
}
function requireEula(settings) {
  if (!settings.get().eula) {
    let onConfirm = function () {
      settings.update(function (s) {
        return {
          ...s,
          eula: true
        };
      });
    };
    let onCancel = function () {
      BdApi.Plugins.disable(pluginName);
    };
    headsUp(onConfirm, onCancel);
  }
}

function luminance(r, g, b) {
  var a = [r, g, b].map(function (v) {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}
function contrast(rgb1, rgb2) {
  var lum1 = luminance(rgb1.r, rgb1.g, rgb1.b);
  var lum2 = luminance(rgb2.r, rgb2.g, rgb2.b);
  var brightest = Math.max(lum1, lum2);
  var darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}
function hexToRgb(hex) {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF"	)
  var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function (m, r, g, b) {
    return r + r + g + g + b + b;
  });
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}
function acceptableContrast(colour, doContrastTest, contrastTestColour, contrastThreshold) {
  let textContrast = contrast(hexToRgb(colour), hexToRgb(contrastTestColour));
  return !doContrastTest || textContrast >= contrastThreshold;
}

// se: Each formatted element gets a separate entry in the array ret.props.children[0].
// Some of the new elements (specifically headers) have a .markup-XXXXXX h<x> class defined.
// These classes have a set color, and this overrides the element style on the top level message content element.
// So, we iterate over message elements that have their own props field, and add the color, item by item.
// But also plain text in a message *doesn't* have props, so we still have to set ret.props.style for that.
// Waugh.
// Making a list of the specific markup types that don't format correctly,
// Because if we just do this to all formatting, that overrides the URL color too.
function colorMarkupElements(originalMessageElements, color) {
  let messageElements = [];
  const MarkupTypes = ['h1', 'h2', 'h3'];
  for (const element of originalMessageElements) {
    if (MarkupTypes.includes(element.type)) {
      messageElements.push({
        ...element,
        props: {
          ...element.props,
          style: {
            color
          }
        }
      });
    } else {
      messageElements.push(element);
    }
  }
  return messageElements;
}
function ColorMessageContent({
  messageContent,
  color
}) {
  let elements = colorMarkupElements(messageContent.props.children[0], color);
  return {
    ...messageContent,
    props: {
      ...messageContent.props,
      style: {
        color
      },
      children: [elements]
    }
  };
}

const React$7 = BdApi.React;
function shouldColor(settings, profile) {
  let {
    doContrastTest,
    contrastTestColour,
    contrastThreshold
  } = settings;
  return settings.doColourText && profile && (profile.status === ProfileStatus.Done || profile.status === ProfileStatus.Updating) && profile.color && acceptableContrast(profile.color, doContrastTest, contrastTestColour, contrastThreshold);
}
function MessageContentProxy({
  settingsCell,
  profileMap,
  enabledCell,
  messageContent,
  message
}) {
  let [settings] = hookupValueCell(settingsCell);
  let [profile] = hookupProfile(profileMap, message.author);
  let [enabled] = hookupValueCell(enabledCell);
  if (!enabled || !isProxiedMessage(message)) {
    return messageContent;
  }
  updateProfile(message, profileMap);
  if (shouldColor(settings, profile)) {
    return /*#__PURE__*/React$7.createElement(ColorMessageContent, {
      color: profile.color,
      messageContent: messageContent
    });
  } else {
    return messageContent;
  }
}

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var graphemeSplitter = {exports: {}};

/*
Breaks a Javascript string into individual user-perceived "characters" 
called extended grapheme clusters by implementing the Unicode UAX-29 standard, version 10.0.0

Usage:
var splitter = new GraphemeSplitter();
//returns an array of strings, one string for each grapheme cluster
var graphemes = splitter.splitGraphemes(string); 

*/

(function (module) {
	function GraphemeSplitter() {
	  var CR = 0,
	    LF = 1,
	    Control = 2,
	    Extend = 3,
	    Regional_Indicator = 4,
	    SpacingMark = 5,
	    L = 6,
	    V = 7,
	    T = 8,
	    LV = 9,
	    LVT = 10,
	    Other = 11,
	    Prepend = 12,
	    E_Base = 13,
	    E_Modifier = 14,
	    ZWJ = 15,
	    Glue_After_Zwj = 16,
	    E_Base_GAZ = 17;

	  // BreakTypes
	  var NotBreak = 0,
	    BreakStart = 1,
	    Break = 2,
	    BreakLastRegional = 3,
	    BreakPenultimateRegional = 4;
	  function isSurrogate(str, pos) {
	    return 0xd800 <= str.charCodeAt(pos) && str.charCodeAt(pos) <= 0xdbff && 0xdc00 <= str.charCodeAt(pos + 1) && str.charCodeAt(pos + 1) <= 0xdfff;
	  }

	  // Private function, gets a Unicode code point from a JavaScript UTF-16 string
	  // handling surrogate pairs appropriately
	  function codePointAt(str, idx) {
	    if (idx === undefined) {
	      idx = 0;
	    }
	    var code = str.charCodeAt(idx);

	    // if a high surrogate
	    if (0xD800 <= code && code <= 0xDBFF && idx < str.length - 1) {
	      var hi = code;
	      var low = str.charCodeAt(idx + 1);
	      if (0xDC00 <= low && low <= 0xDFFF) {
	        return (hi - 0xD800) * 0x400 + (low - 0xDC00) + 0x10000;
	      }
	      return hi;
	    }

	    // if a low surrogate
	    if (0xDC00 <= code && code <= 0xDFFF && idx >= 1) {
	      var hi = str.charCodeAt(idx - 1);
	      var low = code;
	      if (0xD800 <= hi && hi <= 0xDBFF) {
	        return (hi - 0xD800) * 0x400 + (low - 0xDC00) + 0x10000;
	      }
	      return low;
	    }

	    //just return the char if an unmatched surrogate half or a 
	    //single-char codepoint
	    return code;
	  }

	  // Private function, returns whether a break is allowed between the 
	  // two given grapheme breaking classes
	  function shouldBreak(start, mid, end) {
	    var all = [start].concat(mid).concat([end]);
	    var previous = all[all.length - 2];
	    var next = end;

	    // Lookahead termintor for:
	    // GB10. (E_Base | EBG) Extend* ?	E_Modifier
	    var eModifierIndex = all.lastIndexOf(E_Modifier);
	    if (eModifierIndex > 1 && all.slice(1, eModifierIndex).every(function (c) {
	      return c == Extend;
	    }) && [Extend, E_Base, E_Base_GAZ].indexOf(start) == -1) {
	      return Break;
	    }

	    // Lookahead termintor for:
	    // GB12. ^ (RI RI)* RI	?	RI
	    // GB13. [^RI] (RI RI)* RI	?	RI
	    var rIIndex = all.lastIndexOf(Regional_Indicator);
	    if (rIIndex > 0 && all.slice(1, rIIndex).every(function (c) {
	      return c == Regional_Indicator;
	    }) && [Prepend, Regional_Indicator].indexOf(previous) == -1) {
	      if (all.filter(function (c) {
	        return c == Regional_Indicator;
	      }).length % 2 == 1) {
	        return BreakLastRegional;
	      } else {
	        return BreakPenultimateRegional;
	      }
	    }

	    // GB3. CR X LF
	    if (previous == CR && next == LF) {
	      return NotBreak;
	    }
	    // GB4. (Control|CR|LF) ÷
	    else if (previous == Control || previous == CR || previous == LF) {
	      if (next == E_Modifier && mid.every(function (c) {
	        return c == Extend;
	      })) {
	        return Break;
	      } else {
	        return BreakStart;
	      }
	    }
	    // GB5. ÷ (Control|CR|LF)
	    else if (next == Control || next == CR || next == LF) {
	      return BreakStart;
	    }
	    // GB6. L X (L|V|LV|LVT)
	    else if (previous == L && (next == L || next == V || next == LV || next == LVT)) {
	      return NotBreak;
	    }
	    // GB7. (LV|V) X (V|T)
	    else if ((previous == LV || previous == V) && (next == V || next == T)) {
	      return NotBreak;
	    }
	    // GB8. (LVT|T) X (T)
	    else if ((previous == LVT || previous == T) && next == T) {
	      return NotBreak;
	    }
	    // GB9. X (Extend|ZWJ)
	    else if (next == Extend || next == ZWJ) {
	      return NotBreak;
	    }
	    // GB9a. X SpacingMark
	    else if (next == SpacingMark) {
	      return NotBreak;
	    }
	    // GB9b. Prepend X
	    else if (previous == Prepend) {
	      return NotBreak;
	    }

	    // GB10. (E_Base | EBG) Extend* ?	E_Modifier
	    var previousNonExtendIndex = all.indexOf(Extend) != -1 ? all.lastIndexOf(Extend) - 1 : all.length - 2;
	    if ([E_Base, E_Base_GAZ].indexOf(all[previousNonExtendIndex]) != -1 && all.slice(previousNonExtendIndex + 1, -1).every(function (c) {
	      return c == Extend;
	    }) && next == E_Modifier) {
	      return NotBreak;
	    }

	    // GB11. ZWJ ? (Glue_After_Zwj | EBG)
	    if (previous == ZWJ && [Glue_After_Zwj, E_Base_GAZ].indexOf(next) != -1) {
	      return NotBreak;
	    }

	    // GB12. ^ (RI RI)* RI ? RI
	    // GB13. [^RI] (RI RI)* RI ? RI
	    if (mid.indexOf(Regional_Indicator) != -1) {
	      return Break;
	    }
	    if (previous == Regional_Indicator && next == Regional_Indicator) {
	      return NotBreak;
	    }

	    // GB999. Any ? Any
	    return BreakStart;
	  }

	  // Returns the next grapheme break in the string after the given index
	  this.nextBreak = function (string, index) {
	    if (index === undefined) {
	      index = 0;
	    }
	    if (index < 0) {
	      return 0;
	    }
	    if (index >= string.length - 1) {
	      return string.length;
	    }
	    var prev = getGraphemeBreakProperty(codePointAt(string, index));
	    var mid = [];
	    for (var i = index + 1; i < string.length; i++) {
	      // check for already processed low surrogates
	      if (isSurrogate(string, i - 1)) {
	        continue;
	      }
	      var next = getGraphemeBreakProperty(codePointAt(string, i));
	      if (shouldBreak(prev, mid, next)) {
	        return i;
	      }
	      mid.push(next);
	    }
	    return string.length;
	  };

	  // Breaks the given string into an array of grapheme cluster strings
	  this.splitGraphemes = function (str) {
	    var res = [];
	    var index = 0;
	    var brk;
	    while ((brk = this.nextBreak(str, index)) < str.length) {
	      res.push(str.slice(index, brk));
	      index = brk;
	    }
	    if (index < str.length) {
	      res.push(str.slice(index));
	    }
	    return res;
	  };

	  // Returns the iterator of grapheme clusters there are in the given string
	  this.iterateGraphemes = function (str) {
	    var index = 0;
	    var res = {
	      next: function () {
	        var value;
	        var brk;
	        if ((brk = this.nextBreak(str, index)) < str.length) {
	          value = str.slice(index, brk);
	          index = brk;
	          return {
	            value: value,
	            done: false
	          };
	        }
	        if (index < str.length) {
	          value = str.slice(index);
	          index = str.length;
	          return {
	            value: value,
	            done: false
	          };
	        }
	        return {
	          value: undefined,
	          done: true
	        };
	      }.bind(this)
	    };
	    // ES2015 @@iterator method (iterable) for spread syntax and for...of statement
	    if (typeof Symbol !== 'undefined' && Symbol.iterator) {
	      res[Symbol.iterator] = function () {
	        return res;
	      };
	    }
	    return res;
	  };

	  // Returns the number of grapheme clusters there are in the given string
	  this.countGraphemes = function (str) {
	    var count = 0;
	    var index = 0;
	    var brk;
	    while ((brk = this.nextBreak(str, index)) < str.length) {
	      index = brk;
	      count++;
	    }
	    if (index < str.length) {
	      count++;
	    }
	    return count;
	  };

	  //given a Unicode code point, determines this symbol's grapheme break property
	  function getGraphemeBreakProperty(code) {
	    //grapheme break property for Unicode 10.0.0, 
	    //taken from http://www.unicode.org/Public/10.0.0/ucd/auxiliary/GraphemeBreakProperty.txt
	    //and adapted to JavaScript rules

	    if (0x0600 <= code && code <= 0x0605 ||
	    // Cf   [6] ARABIC NUMBER SIGN..ARABIC NUMBER MARK ABOVE
	    0x06DD == code ||
	    // Cf       ARABIC END OF AYAH
	    0x070F == code ||
	    // Cf       SYRIAC ABBREVIATION MARK
	    0x08E2 == code ||
	    // Cf       ARABIC DISPUTED END OF AYAH
	    0x0D4E == code ||
	    // Lo       MALAYALAM LETTER DOT REPH
	    0x110BD == code ||
	    // Cf       KAITHI NUMBER SIGN
	    0x111C2 <= code && code <= 0x111C3 ||
	    // Lo   [2] SHARADA SIGN JIHVAMULIYA..SHARADA SIGN UPADHMANIYA
	    0x11A3A == code ||
	    // Lo       ZANABAZAR SQUARE CLUSTER-INITIAL LETTER RA
	    0x11A86 <= code && code <= 0x11A89 ||
	    // Lo   [4] SOYOMBO CLUSTER-INITIAL LETTER RA..SOYOMBO CLUSTER-INITIAL LETTER SA
	    0x11D46 == code // Lo       MASARAM GONDI REPHA
	    ) {
	      return Prepend;
	    }
	    if (0x000D == code // Cc       <control-000D>
	    ) {
	      return CR;
	    }
	    if (0x000A == code // Cc       <control-000A>
	    ) {
	      return LF;
	    }
	    if (0x0000 <= code && code <= 0x0009 ||
	    // Cc  [10] <control-0000>..<control-0009>
	    0x000B <= code && code <= 0x000C ||
	    // Cc   [2] <control-000B>..<control-000C>
	    0x000E <= code && code <= 0x001F ||
	    // Cc  [18] <control-000E>..<control-001F>
	    0x007F <= code && code <= 0x009F ||
	    // Cc  [33] <control-007F>..<control-009F>
	    0x00AD == code ||
	    // Cf       SOFT HYPHEN
	    0x061C == code ||
	    // Cf       ARABIC LETTER MARK

	    0x180E == code ||
	    // Cf       MONGOLIAN VOWEL SEPARATOR
	    0x200B == code ||
	    // Cf       ZERO WIDTH SPACE
	    0x200E <= code && code <= 0x200F ||
	    // Cf   [2] LEFT-TO-RIGHT MARK..RIGHT-TO-LEFT MARK
	    0x2028 == code ||
	    // Zl       LINE SEPARATOR
	    0x2029 == code ||
	    // Zp       PARAGRAPH SEPARATOR
	    0x202A <= code && code <= 0x202E ||
	    // Cf   [5] LEFT-TO-RIGHT EMBEDDING..RIGHT-TO-LEFT OVERRIDE
	    0x2060 <= code && code <= 0x2064 ||
	    // Cf   [5] WORD JOINER..INVISIBLE PLUS
	    0x2065 == code ||
	    // Cn       <reserved-2065>
	    0x2066 <= code && code <= 0x206F ||
	    // Cf  [10] LEFT-TO-RIGHT ISOLATE..NOMINAL DIGIT SHAPES
	    0xD800 <= code && code <= 0xDFFF ||
	    // Cs [2048] <surrogate-D800>..<surrogate-DFFF>
	    0xFEFF == code ||
	    // Cf       ZERO WIDTH NO-BREAK SPACE
	    0xFFF0 <= code && code <= 0xFFF8 ||
	    // Cn   [9] <reserved-FFF0>..<reserved-FFF8>
	    0xFFF9 <= code && code <= 0xFFFB ||
	    // Cf   [3] INTERLINEAR ANNOTATION ANCHOR..INTERLINEAR ANNOTATION TERMINATOR
	    0x1BCA0 <= code && code <= 0x1BCA3 ||
	    // Cf   [4] SHORTHAND FORMAT LETTER OVERLAP..SHORTHAND FORMAT UP STEP
	    0x1D173 <= code && code <= 0x1D17A ||
	    // Cf   [8] MUSICAL SYMBOL BEGIN BEAM..MUSICAL SYMBOL END PHRASE
	    0xE0000 == code ||
	    // Cn       <reserved-E0000>
	    0xE0001 == code ||
	    // Cf       LANGUAGE TAG
	    0xE0002 <= code && code <= 0xE001F ||
	    // Cn  [30] <reserved-E0002>..<reserved-E001F>
	    0xE0080 <= code && code <= 0xE00FF ||
	    // Cn [128] <reserved-E0080>..<reserved-E00FF>
	    0xE01F0 <= code && code <= 0xE0FFF // Cn [3600] <reserved-E01F0>..<reserved-E0FFF>
	    ) {
	      return Control;
	    }
	    if (0x0300 <= code && code <= 0x036F ||
	    // Mn [112] COMBINING GRAVE ACCENT..COMBINING LATIN SMALL LETTER X
	    0x0483 <= code && code <= 0x0487 ||
	    // Mn   [5] COMBINING CYRILLIC TITLO..COMBINING CYRILLIC POKRYTIE
	    0x0488 <= code && code <= 0x0489 ||
	    // Me   [2] COMBINING CYRILLIC HUNDRED THOUSANDS SIGN..COMBINING CYRILLIC MILLIONS SIGN
	    0x0591 <= code && code <= 0x05BD ||
	    // Mn  [45] HEBREW ACCENT ETNAHTA..HEBREW POINT METEG
	    0x05BF == code ||
	    // Mn       HEBREW POINT RAFE
	    0x05C1 <= code && code <= 0x05C2 ||
	    // Mn   [2] HEBREW POINT SHIN DOT..HEBREW POINT SIN DOT
	    0x05C4 <= code && code <= 0x05C5 ||
	    // Mn   [2] HEBREW MARK UPPER DOT..HEBREW MARK LOWER DOT
	    0x05C7 == code ||
	    // Mn       HEBREW POINT QAMATS QATAN
	    0x0610 <= code && code <= 0x061A ||
	    // Mn  [11] ARABIC SIGN SALLALLAHOU ALAYHE WASSALLAM..ARABIC SMALL KASRA
	    0x064B <= code && code <= 0x065F ||
	    // Mn  [21] ARABIC FATHATAN..ARABIC WAVY HAMZA BELOW
	    0x0670 == code ||
	    // Mn       ARABIC LETTER SUPERSCRIPT ALEF
	    0x06D6 <= code && code <= 0x06DC ||
	    // Mn   [7] ARABIC SMALL HIGH LIGATURE SAD WITH LAM WITH ALEF MAKSURA..ARABIC SMALL HIGH SEEN
	    0x06DF <= code && code <= 0x06E4 ||
	    // Mn   [6] ARABIC SMALL HIGH ROUNDED ZERO..ARABIC SMALL HIGH MADDA
	    0x06E7 <= code && code <= 0x06E8 ||
	    // Mn   [2] ARABIC SMALL HIGH YEH..ARABIC SMALL HIGH NOON
	    0x06EA <= code && code <= 0x06ED ||
	    // Mn   [4] ARABIC EMPTY CENTRE LOW STOP..ARABIC SMALL LOW MEEM
	    0x0711 == code ||
	    // Mn       SYRIAC LETTER SUPERSCRIPT ALAPH
	    0x0730 <= code && code <= 0x074A ||
	    // Mn  [27] SYRIAC PTHAHA ABOVE..SYRIAC BARREKH
	    0x07A6 <= code && code <= 0x07B0 ||
	    // Mn  [11] THAANA ABAFILI..THAANA SUKUN
	    0x07EB <= code && code <= 0x07F3 ||
	    // Mn   [9] NKO COMBINING SHORT HIGH TONE..NKO COMBINING DOUBLE DOT ABOVE
	    0x0816 <= code && code <= 0x0819 ||
	    // Mn   [4] SAMARITAN MARK IN..SAMARITAN MARK DAGESH
	    0x081B <= code && code <= 0x0823 ||
	    // Mn   [9] SAMARITAN MARK EPENTHETIC YUT..SAMARITAN VOWEL SIGN A
	    0x0825 <= code && code <= 0x0827 ||
	    // Mn   [3] SAMARITAN VOWEL SIGN SHORT A..SAMARITAN VOWEL SIGN U
	    0x0829 <= code && code <= 0x082D ||
	    // Mn   [5] SAMARITAN VOWEL SIGN LONG I..SAMARITAN MARK NEQUDAA
	    0x0859 <= code && code <= 0x085B ||
	    // Mn   [3] MANDAIC AFFRICATION MARK..MANDAIC GEMINATION MARK
	    0x08D4 <= code && code <= 0x08E1 ||
	    // Mn  [14] ARABIC SMALL HIGH WORD AR-RUB..ARABIC SMALL HIGH SIGN SAFHA
	    0x08E3 <= code && code <= 0x0902 ||
	    // Mn  [32] ARABIC TURNED DAMMA BELOW..DEVANAGARI SIGN ANUSVARA
	    0x093A == code ||
	    // Mn       DEVANAGARI VOWEL SIGN OE
	    0x093C == code ||
	    // Mn       DEVANAGARI SIGN NUKTA
	    0x0941 <= code && code <= 0x0948 ||
	    // Mn   [8] DEVANAGARI VOWEL SIGN U..DEVANAGARI VOWEL SIGN AI
	    0x094D == code ||
	    // Mn       DEVANAGARI SIGN VIRAMA
	    0x0951 <= code && code <= 0x0957 ||
	    // Mn   [7] DEVANAGARI STRESS SIGN UDATTA..DEVANAGARI VOWEL SIGN UUE
	    0x0962 <= code && code <= 0x0963 ||
	    // Mn   [2] DEVANAGARI VOWEL SIGN VOCALIC L..DEVANAGARI VOWEL SIGN VOCALIC LL
	    0x0981 == code ||
	    // Mn       BENGALI SIGN CANDRABINDU
	    0x09BC == code ||
	    // Mn       BENGALI SIGN NUKTA
	    0x09BE == code ||
	    // Mc       BENGALI VOWEL SIGN AA
	    0x09C1 <= code && code <= 0x09C4 ||
	    // Mn   [4] BENGALI VOWEL SIGN U..BENGALI VOWEL SIGN VOCALIC RR
	    0x09CD == code ||
	    // Mn       BENGALI SIGN VIRAMA
	    0x09D7 == code ||
	    // Mc       BENGALI AU LENGTH MARK
	    0x09E2 <= code && code <= 0x09E3 ||
	    // Mn   [2] BENGALI VOWEL SIGN VOCALIC L..BENGALI VOWEL SIGN VOCALIC LL
	    0x0A01 <= code && code <= 0x0A02 ||
	    // Mn   [2] GURMUKHI SIGN ADAK BINDI..GURMUKHI SIGN BINDI
	    0x0A3C == code ||
	    // Mn       GURMUKHI SIGN NUKTA
	    0x0A41 <= code && code <= 0x0A42 ||
	    // Mn   [2] GURMUKHI VOWEL SIGN U..GURMUKHI VOWEL SIGN UU
	    0x0A47 <= code && code <= 0x0A48 ||
	    // Mn   [2] GURMUKHI VOWEL SIGN EE..GURMUKHI VOWEL SIGN AI
	    0x0A4B <= code && code <= 0x0A4D ||
	    // Mn   [3] GURMUKHI VOWEL SIGN OO..GURMUKHI SIGN VIRAMA
	    0x0A51 == code ||
	    // Mn       GURMUKHI SIGN UDAAT
	    0x0A70 <= code && code <= 0x0A71 ||
	    // Mn   [2] GURMUKHI TIPPI..GURMUKHI ADDAK
	    0x0A75 == code ||
	    // Mn       GURMUKHI SIGN YAKASH
	    0x0A81 <= code && code <= 0x0A82 ||
	    // Mn   [2] GUJARATI SIGN CANDRABINDU..GUJARATI SIGN ANUSVARA
	    0x0ABC == code ||
	    // Mn       GUJARATI SIGN NUKTA
	    0x0AC1 <= code && code <= 0x0AC5 ||
	    // Mn   [5] GUJARATI VOWEL SIGN U..GUJARATI VOWEL SIGN CANDRA E
	    0x0AC7 <= code && code <= 0x0AC8 ||
	    // Mn   [2] GUJARATI VOWEL SIGN E..GUJARATI VOWEL SIGN AI
	    0x0ACD == code ||
	    // Mn       GUJARATI SIGN VIRAMA
	    0x0AE2 <= code && code <= 0x0AE3 ||
	    // Mn   [2] GUJARATI VOWEL SIGN VOCALIC L..GUJARATI VOWEL SIGN VOCALIC LL
	    0x0AFA <= code && code <= 0x0AFF ||
	    // Mn   [6] GUJARATI SIGN SUKUN..GUJARATI SIGN TWO-CIRCLE NUKTA ABOVE
	    0x0B01 == code ||
	    // Mn       ORIYA SIGN CANDRABINDU
	    0x0B3C == code ||
	    // Mn       ORIYA SIGN NUKTA
	    0x0B3E == code ||
	    // Mc       ORIYA VOWEL SIGN AA
	    0x0B3F == code ||
	    // Mn       ORIYA VOWEL SIGN I
	    0x0B41 <= code && code <= 0x0B44 ||
	    // Mn   [4] ORIYA VOWEL SIGN U..ORIYA VOWEL SIGN VOCALIC RR
	    0x0B4D == code ||
	    // Mn       ORIYA SIGN VIRAMA
	    0x0B56 == code ||
	    // Mn       ORIYA AI LENGTH MARK
	    0x0B57 == code ||
	    // Mc       ORIYA AU LENGTH MARK
	    0x0B62 <= code && code <= 0x0B63 ||
	    // Mn   [2] ORIYA VOWEL SIGN VOCALIC L..ORIYA VOWEL SIGN VOCALIC LL
	    0x0B82 == code ||
	    // Mn       TAMIL SIGN ANUSVARA
	    0x0BBE == code ||
	    // Mc       TAMIL VOWEL SIGN AA
	    0x0BC0 == code ||
	    // Mn       TAMIL VOWEL SIGN II
	    0x0BCD == code ||
	    // Mn       TAMIL SIGN VIRAMA
	    0x0BD7 == code ||
	    // Mc       TAMIL AU LENGTH MARK
	    0x0C00 == code ||
	    // Mn       TELUGU SIGN COMBINING CANDRABINDU ABOVE
	    0x0C3E <= code && code <= 0x0C40 ||
	    // Mn   [3] TELUGU VOWEL SIGN AA..TELUGU VOWEL SIGN II
	    0x0C46 <= code && code <= 0x0C48 ||
	    // Mn   [3] TELUGU VOWEL SIGN E..TELUGU VOWEL SIGN AI
	    0x0C4A <= code && code <= 0x0C4D ||
	    // Mn   [4] TELUGU VOWEL SIGN O..TELUGU SIGN VIRAMA
	    0x0C55 <= code && code <= 0x0C56 ||
	    // Mn   [2] TELUGU LENGTH MARK..TELUGU AI LENGTH MARK
	    0x0C62 <= code && code <= 0x0C63 ||
	    // Mn   [2] TELUGU VOWEL SIGN VOCALIC L..TELUGU VOWEL SIGN VOCALIC LL
	    0x0C81 == code ||
	    // Mn       KANNADA SIGN CANDRABINDU
	    0x0CBC == code ||
	    // Mn       KANNADA SIGN NUKTA
	    0x0CBF == code ||
	    // Mn       KANNADA VOWEL SIGN I
	    0x0CC2 == code ||
	    // Mc       KANNADA VOWEL SIGN UU
	    0x0CC6 == code ||
	    // Mn       KANNADA VOWEL SIGN E
	    0x0CCC <= code && code <= 0x0CCD ||
	    // Mn   [2] KANNADA VOWEL SIGN AU..KANNADA SIGN VIRAMA
	    0x0CD5 <= code && code <= 0x0CD6 ||
	    // Mc   [2] KANNADA LENGTH MARK..KANNADA AI LENGTH MARK
	    0x0CE2 <= code && code <= 0x0CE3 ||
	    // Mn   [2] KANNADA VOWEL SIGN VOCALIC L..KANNADA VOWEL SIGN VOCALIC LL
	    0x0D00 <= code && code <= 0x0D01 ||
	    // Mn   [2] MALAYALAM SIGN COMBINING ANUSVARA ABOVE..MALAYALAM SIGN CANDRABINDU
	    0x0D3B <= code && code <= 0x0D3C ||
	    // Mn   [2] MALAYALAM SIGN VERTICAL BAR VIRAMA..MALAYALAM SIGN CIRCULAR VIRAMA
	    0x0D3E == code ||
	    // Mc       MALAYALAM VOWEL SIGN AA
	    0x0D41 <= code && code <= 0x0D44 ||
	    // Mn   [4] MALAYALAM VOWEL SIGN U..MALAYALAM VOWEL SIGN VOCALIC RR
	    0x0D4D == code ||
	    // Mn       MALAYALAM SIGN VIRAMA
	    0x0D57 == code ||
	    // Mc       MALAYALAM AU LENGTH MARK
	    0x0D62 <= code && code <= 0x0D63 ||
	    // Mn   [2] MALAYALAM VOWEL SIGN VOCALIC L..MALAYALAM VOWEL SIGN VOCALIC LL
	    0x0DCA == code ||
	    // Mn       SINHALA SIGN AL-LAKUNA
	    0x0DCF == code ||
	    // Mc       SINHALA VOWEL SIGN AELA-PILLA
	    0x0DD2 <= code && code <= 0x0DD4 ||
	    // Mn   [3] SINHALA VOWEL SIGN KETTI IS-PILLA..SINHALA VOWEL SIGN KETTI PAA-PILLA
	    0x0DD6 == code ||
	    // Mn       SINHALA VOWEL SIGN DIGA PAA-PILLA
	    0x0DDF == code ||
	    // Mc       SINHALA VOWEL SIGN GAYANUKITTA
	    0x0E31 == code ||
	    // Mn       THAI CHARACTER MAI HAN-AKAT
	    0x0E34 <= code && code <= 0x0E3A ||
	    // Mn   [7] THAI CHARACTER SARA I..THAI CHARACTER PHINTHU
	    0x0E47 <= code && code <= 0x0E4E ||
	    // Mn   [8] THAI CHARACTER MAITAIKHU..THAI CHARACTER YAMAKKAN
	    0x0EB1 == code ||
	    // Mn       LAO VOWEL SIGN MAI KAN
	    0x0EB4 <= code && code <= 0x0EB9 ||
	    // Mn   [6] LAO VOWEL SIGN I..LAO VOWEL SIGN UU
	    0x0EBB <= code && code <= 0x0EBC ||
	    // Mn   [2] LAO VOWEL SIGN MAI KON..LAO SEMIVOWEL SIGN LO
	    0x0EC8 <= code && code <= 0x0ECD ||
	    // Mn   [6] LAO TONE MAI EK..LAO NIGGAHITA
	    0x0F18 <= code && code <= 0x0F19 ||
	    // Mn   [2] TIBETAN ASTROLOGICAL SIGN -KHYUD PA..TIBETAN ASTROLOGICAL SIGN SDONG TSHUGS
	    0x0F35 == code ||
	    // Mn       TIBETAN MARK NGAS BZUNG NYI ZLA
	    0x0F37 == code ||
	    // Mn       TIBETAN MARK NGAS BZUNG SGOR RTAGS
	    0x0F39 == code ||
	    // Mn       TIBETAN MARK TSA -PHRU
	    0x0F71 <= code && code <= 0x0F7E ||
	    // Mn  [14] TIBETAN VOWEL SIGN AA..TIBETAN SIGN RJES SU NGA RO
	    0x0F80 <= code && code <= 0x0F84 ||
	    // Mn   [5] TIBETAN VOWEL SIGN REVERSED I..TIBETAN MARK HALANTA
	    0x0F86 <= code && code <= 0x0F87 ||
	    // Mn   [2] TIBETAN SIGN LCI RTAGS..TIBETAN SIGN YANG RTAGS
	    0x0F8D <= code && code <= 0x0F97 ||
	    // Mn  [11] TIBETAN SUBJOINED SIGN LCE TSA CAN..TIBETAN SUBJOINED LETTER JA
	    0x0F99 <= code && code <= 0x0FBC ||
	    // Mn  [36] TIBETAN SUBJOINED LETTER NYA..TIBETAN SUBJOINED LETTER FIXED-FORM RA
	    0x0FC6 == code ||
	    // Mn       TIBETAN SYMBOL PADMA GDAN
	    0x102D <= code && code <= 0x1030 ||
	    // Mn   [4] MYANMAR VOWEL SIGN I..MYANMAR VOWEL SIGN UU
	    0x1032 <= code && code <= 0x1037 ||
	    // Mn   [6] MYANMAR VOWEL SIGN AI..MYANMAR SIGN DOT BELOW
	    0x1039 <= code && code <= 0x103A ||
	    // Mn   [2] MYANMAR SIGN VIRAMA..MYANMAR SIGN ASAT
	    0x103D <= code && code <= 0x103E ||
	    // Mn   [2] MYANMAR CONSONANT SIGN MEDIAL WA..MYANMAR CONSONANT SIGN MEDIAL HA
	    0x1058 <= code && code <= 0x1059 ||
	    // Mn   [2] MYANMAR VOWEL SIGN VOCALIC L..MYANMAR VOWEL SIGN VOCALIC LL
	    0x105E <= code && code <= 0x1060 ||
	    // Mn   [3] MYANMAR CONSONANT SIGN MON MEDIAL NA..MYANMAR CONSONANT SIGN MON MEDIAL LA
	    0x1071 <= code && code <= 0x1074 ||
	    // Mn   [4] MYANMAR VOWEL SIGN GEBA KAREN I..MYANMAR VOWEL SIGN KAYAH EE
	    0x1082 == code ||
	    // Mn       MYANMAR CONSONANT SIGN SHAN MEDIAL WA
	    0x1085 <= code && code <= 0x1086 ||
	    // Mn   [2] MYANMAR VOWEL SIGN SHAN E ABOVE..MYANMAR VOWEL SIGN SHAN FINAL Y
	    0x108D == code ||
	    // Mn       MYANMAR SIGN SHAN COUNCIL EMPHATIC TONE
	    0x109D == code ||
	    // Mn       MYANMAR VOWEL SIGN AITON AI
	    0x135D <= code && code <= 0x135F ||
	    // Mn   [3] ETHIOPIC COMBINING GEMINATION AND VOWEL LENGTH MARK..ETHIOPIC COMBINING GEMINATION MARK
	    0x1712 <= code && code <= 0x1714 ||
	    // Mn   [3] TAGALOG VOWEL SIGN I..TAGALOG SIGN VIRAMA
	    0x1732 <= code && code <= 0x1734 ||
	    // Mn   [3] HANUNOO VOWEL SIGN I..HANUNOO SIGN PAMUDPOD
	    0x1752 <= code && code <= 0x1753 ||
	    // Mn   [2] BUHID VOWEL SIGN I..BUHID VOWEL SIGN U
	    0x1772 <= code && code <= 0x1773 ||
	    // Mn   [2] TAGBANWA VOWEL SIGN I..TAGBANWA VOWEL SIGN U
	    0x17B4 <= code && code <= 0x17B5 ||
	    // Mn   [2] KHMER VOWEL INHERENT AQ..KHMER VOWEL INHERENT AA
	    0x17B7 <= code && code <= 0x17BD ||
	    // Mn   [7] KHMER VOWEL SIGN I..KHMER VOWEL SIGN UA
	    0x17C6 == code ||
	    // Mn       KHMER SIGN NIKAHIT
	    0x17C9 <= code && code <= 0x17D3 ||
	    // Mn  [11] KHMER SIGN MUUSIKATOAN..KHMER SIGN BATHAMASAT
	    0x17DD == code ||
	    // Mn       KHMER SIGN ATTHACAN
	    0x180B <= code && code <= 0x180D ||
	    // Mn   [3] MONGOLIAN FREE VARIATION SELECTOR ONE..MONGOLIAN FREE VARIATION SELECTOR THREE
	    0x1885 <= code && code <= 0x1886 ||
	    // Mn   [2] MONGOLIAN LETTER ALI GALI BALUDA..MONGOLIAN LETTER ALI GALI THREE BALUDA
	    0x18A9 == code ||
	    // Mn       MONGOLIAN LETTER ALI GALI DAGALGA
	    0x1920 <= code && code <= 0x1922 ||
	    // Mn   [3] LIMBU VOWEL SIGN A..LIMBU VOWEL SIGN U
	    0x1927 <= code && code <= 0x1928 ||
	    // Mn   [2] LIMBU VOWEL SIGN E..LIMBU VOWEL SIGN O
	    0x1932 == code ||
	    // Mn       LIMBU SMALL LETTER ANUSVARA
	    0x1939 <= code && code <= 0x193B ||
	    // Mn   [3] LIMBU SIGN MUKPHRENG..LIMBU SIGN SA-I
	    0x1A17 <= code && code <= 0x1A18 ||
	    // Mn   [2] BUGINESE VOWEL SIGN I..BUGINESE VOWEL SIGN U
	    0x1A1B == code ||
	    // Mn       BUGINESE VOWEL SIGN AE
	    0x1A56 == code ||
	    // Mn       TAI THAM CONSONANT SIGN MEDIAL LA
	    0x1A58 <= code && code <= 0x1A5E ||
	    // Mn   [7] TAI THAM SIGN MAI KANG LAI..TAI THAM CONSONANT SIGN SA
	    0x1A60 == code ||
	    // Mn       TAI THAM SIGN SAKOT
	    0x1A62 == code ||
	    // Mn       TAI THAM VOWEL SIGN MAI SAT
	    0x1A65 <= code && code <= 0x1A6C ||
	    // Mn   [8] TAI THAM VOWEL SIGN I..TAI THAM VOWEL SIGN OA BELOW
	    0x1A73 <= code && code <= 0x1A7C ||
	    // Mn  [10] TAI THAM VOWEL SIGN OA ABOVE..TAI THAM SIGN KHUEN-LUE KARAN
	    0x1A7F == code ||
	    // Mn       TAI THAM COMBINING CRYPTOGRAMMIC DOT
	    0x1AB0 <= code && code <= 0x1ABD ||
	    // Mn  [14] COMBINING DOUBLED CIRCUMFLEX ACCENT..COMBINING PARENTHESES BELOW
	    0x1ABE == code ||
	    // Me       COMBINING PARENTHESES OVERLAY
	    0x1B00 <= code && code <= 0x1B03 ||
	    // Mn   [4] BALINESE SIGN ULU RICEM..BALINESE SIGN SURANG
	    0x1B34 == code ||
	    // Mn       BALINESE SIGN REREKAN
	    0x1B36 <= code && code <= 0x1B3A ||
	    // Mn   [5] BALINESE VOWEL SIGN ULU..BALINESE VOWEL SIGN RA REPA
	    0x1B3C == code ||
	    // Mn       BALINESE VOWEL SIGN LA LENGA
	    0x1B42 == code ||
	    // Mn       BALINESE VOWEL SIGN PEPET
	    0x1B6B <= code && code <= 0x1B73 ||
	    // Mn   [9] BALINESE MUSICAL SYMBOL COMBINING TEGEH..BALINESE MUSICAL SYMBOL COMBINING GONG
	    0x1B80 <= code && code <= 0x1B81 ||
	    // Mn   [2] SUNDANESE SIGN PANYECEK..SUNDANESE SIGN PANGLAYAR
	    0x1BA2 <= code && code <= 0x1BA5 ||
	    // Mn   [4] SUNDANESE CONSONANT SIGN PANYAKRA..SUNDANESE VOWEL SIGN PANYUKU
	    0x1BA8 <= code && code <= 0x1BA9 ||
	    // Mn   [2] SUNDANESE VOWEL SIGN PAMEPET..SUNDANESE VOWEL SIGN PANEULEUNG
	    0x1BAB <= code && code <= 0x1BAD ||
	    // Mn   [3] SUNDANESE SIGN VIRAMA..SUNDANESE CONSONANT SIGN PASANGAN WA
	    0x1BE6 == code ||
	    // Mn       BATAK SIGN TOMPI
	    0x1BE8 <= code && code <= 0x1BE9 ||
	    // Mn   [2] BATAK VOWEL SIGN PAKPAK E..BATAK VOWEL SIGN EE
	    0x1BED == code ||
	    // Mn       BATAK VOWEL SIGN KARO O
	    0x1BEF <= code && code <= 0x1BF1 ||
	    // Mn   [3] BATAK VOWEL SIGN U FOR SIMALUNGUN SA..BATAK CONSONANT SIGN H
	    0x1C2C <= code && code <= 0x1C33 ||
	    // Mn   [8] LEPCHA VOWEL SIGN E..LEPCHA CONSONANT SIGN T
	    0x1C36 <= code && code <= 0x1C37 ||
	    // Mn   [2] LEPCHA SIGN RAN..LEPCHA SIGN NUKTA
	    0x1CD0 <= code && code <= 0x1CD2 ||
	    // Mn   [3] VEDIC TONE KARSHANA..VEDIC TONE PRENKHA
	    0x1CD4 <= code && code <= 0x1CE0 ||
	    // Mn  [13] VEDIC SIGN YAJURVEDIC MIDLINE SVARITA..VEDIC TONE RIGVEDIC KASHMIRI INDEPENDENT SVARITA
	    0x1CE2 <= code && code <= 0x1CE8 ||
	    // Mn   [7] VEDIC SIGN VISARGA SVARITA..VEDIC SIGN VISARGA ANUDATTA WITH TAIL
	    0x1CED == code ||
	    // Mn       VEDIC SIGN TIRYAK
	    0x1CF4 == code ||
	    // Mn       VEDIC TONE CANDRA ABOVE
	    0x1CF8 <= code && code <= 0x1CF9 ||
	    // Mn   [2] VEDIC TONE RING ABOVE..VEDIC TONE DOUBLE RING ABOVE
	    0x1DC0 <= code && code <= 0x1DF9 ||
	    // Mn  [58] COMBINING DOTTED GRAVE ACCENT..COMBINING WIDE INVERTED BRIDGE BELOW
	    0x1DFB <= code && code <= 0x1DFF ||
	    // Mn   [5] COMBINING DELETION MARK..COMBINING RIGHT ARROWHEAD AND DOWN ARROWHEAD BELOW
	    0x200C == code ||
	    // Cf       ZERO WIDTH NON-JOINER
	    0x20D0 <= code && code <= 0x20DC ||
	    // Mn  [13] COMBINING LEFT HARPOON ABOVE..COMBINING FOUR DOTS ABOVE
	    0x20DD <= code && code <= 0x20E0 ||
	    // Me   [4] COMBINING ENCLOSING CIRCLE..COMBINING ENCLOSING CIRCLE BACKSLASH
	    0x20E1 == code ||
	    // Mn       COMBINING LEFT RIGHT ARROW ABOVE
	    0x20E2 <= code && code <= 0x20E4 ||
	    // Me   [3] COMBINING ENCLOSING SCREEN..COMBINING ENCLOSING UPWARD POINTING TRIANGLE
	    0x20E5 <= code && code <= 0x20F0 ||
	    // Mn  [12] COMBINING REVERSE SOLIDUS OVERLAY..COMBINING ASTERISK ABOVE
	    0x2CEF <= code && code <= 0x2CF1 ||
	    // Mn   [3] COPTIC COMBINING NI ABOVE..COPTIC COMBINING SPIRITUS LENIS
	    0x2D7F == code ||
	    // Mn       TIFINAGH CONSONANT JOINER
	    0x2DE0 <= code && code <= 0x2DFF ||
	    // Mn  [32] COMBINING CYRILLIC LETTER BE..COMBINING CYRILLIC LETTER IOTIFIED BIG YUS
	    0x302A <= code && code <= 0x302D ||
	    // Mn   [4] IDEOGRAPHIC LEVEL TONE MARK..IDEOGRAPHIC ENTERING TONE MARK
	    0x302E <= code && code <= 0x302F ||
	    // Mc   [2] HANGUL SINGLE DOT TONE MARK..HANGUL DOUBLE DOT TONE MARK
	    0x3099 <= code && code <= 0x309A ||
	    // Mn   [2] COMBINING KATAKANA-HIRAGANA VOICED SOUND MARK..COMBINING KATAKANA-HIRAGANA SEMI-VOICED SOUND MARK
	    0xA66F == code ||
	    // Mn       COMBINING CYRILLIC VZMET
	    0xA670 <= code && code <= 0xA672 ||
	    // Me   [3] COMBINING CYRILLIC TEN MILLIONS SIGN..COMBINING CYRILLIC THOUSAND MILLIONS SIGN
	    0xA674 <= code && code <= 0xA67D ||
	    // Mn  [10] COMBINING CYRILLIC LETTER UKRAINIAN IE..COMBINING CYRILLIC PAYEROK
	    0xA69E <= code && code <= 0xA69F ||
	    // Mn   [2] COMBINING CYRILLIC LETTER EF..COMBINING CYRILLIC LETTER IOTIFIED E
	    0xA6F0 <= code && code <= 0xA6F1 ||
	    // Mn   [2] BAMUM COMBINING MARK KOQNDON..BAMUM COMBINING MARK TUKWENTIS
	    0xA802 == code ||
	    // Mn       SYLOTI NAGRI SIGN DVISVARA
	    0xA806 == code ||
	    // Mn       SYLOTI NAGRI SIGN HASANTA
	    0xA80B == code ||
	    // Mn       SYLOTI NAGRI SIGN ANUSVARA
	    0xA825 <= code && code <= 0xA826 ||
	    // Mn   [2] SYLOTI NAGRI VOWEL SIGN U..SYLOTI NAGRI VOWEL SIGN E
	    0xA8C4 <= code && code <= 0xA8C5 ||
	    // Mn   [2] SAURASHTRA SIGN VIRAMA..SAURASHTRA SIGN CANDRABINDU
	    0xA8E0 <= code && code <= 0xA8F1 ||
	    // Mn  [18] COMBINING DEVANAGARI DIGIT ZERO..COMBINING DEVANAGARI SIGN AVAGRAHA
	    0xA926 <= code && code <= 0xA92D ||
	    // Mn   [8] KAYAH LI VOWEL UE..KAYAH LI TONE CALYA PLOPHU
	    0xA947 <= code && code <= 0xA951 ||
	    // Mn  [11] REJANG VOWEL SIGN I..REJANG CONSONANT SIGN R
	    0xA980 <= code && code <= 0xA982 ||
	    // Mn   [3] JAVANESE SIGN PANYANGGA..JAVANESE SIGN LAYAR
	    0xA9B3 == code ||
	    // Mn       JAVANESE SIGN CECAK TELU
	    0xA9B6 <= code && code <= 0xA9B9 ||
	    // Mn   [4] JAVANESE VOWEL SIGN WULU..JAVANESE VOWEL SIGN SUKU MENDUT
	    0xA9BC == code ||
	    // Mn       JAVANESE VOWEL SIGN PEPET
	    0xA9E5 == code ||
	    // Mn       MYANMAR SIGN SHAN SAW
	    0xAA29 <= code && code <= 0xAA2E ||
	    // Mn   [6] CHAM VOWEL SIGN AA..CHAM VOWEL SIGN OE
	    0xAA31 <= code && code <= 0xAA32 ||
	    // Mn   [2] CHAM VOWEL SIGN AU..CHAM VOWEL SIGN UE
	    0xAA35 <= code && code <= 0xAA36 ||
	    // Mn   [2] CHAM CONSONANT SIGN LA..CHAM CONSONANT SIGN WA
	    0xAA43 == code ||
	    // Mn       CHAM CONSONANT SIGN FINAL NG
	    0xAA4C == code ||
	    // Mn       CHAM CONSONANT SIGN FINAL M
	    0xAA7C == code ||
	    // Mn       MYANMAR SIGN TAI LAING TONE-2
	    0xAAB0 == code ||
	    // Mn       TAI VIET MAI KANG
	    0xAAB2 <= code && code <= 0xAAB4 ||
	    // Mn   [3] TAI VIET VOWEL I..TAI VIET VOWEL U
	    0xAAB7 <= code && code <= 0xAAB8 ||
	    // Mn   [2] TAI VIET MAI KHIT..TAI VIET VOWEL IA
	    0xAABE <= code && code <= 0xAABF ||
	    // Mn   [2] TAI VIET VOWEL AM..TAI VIET TONE MAI EK
	    0xAAC1 == code ||
	    // Mn       TAI VIET TONE MAI THO
	    0xAAEC <= code && code <= 0xAAED ||
	    // Mn   [2] MEETEI MAYEK VOWEL SIGN UU..MEETEI MAYEK VOWEL SIGN AAI
	    0xAAF6 == code ||
	    // Mn       MEETEI MAYEK VIRAMA
	    0xABE5 == code ||
	    // Mn       MEETEI MAYEK VOWEL SIGN ANAP
	    0xABE8 == code ||
	    // Mn       MEETEI MAYEK VOWEL SIGN UNAP
	    0xABED == code ||
	    // Mn       MEETEI MAYEK APUN IYEK
	    0xFB1E == code ||
	    // Mn       HEBREW POINT JUDEO-SPANISH VARIKA
	    0xFE00 <= code && code <= 0xFE0F ||
	    // Mn  [16] VARIATION SELECTOR-1..VARIATION SELECTOR-16
	    0xFE20 <= code && code <= 0xFE2F ||
	    // Mn  [16] COMBINING LIGATURE LEFT HALF..COMBINING CYRILLIC TITLO RIGHT HALF
	    0xFF9E <= code && code <= 0xFF9F ||
	    // Lm   [2] HALFWIDTH KATAKANA VOICED SOUND MARK..HALFWIDTH KATAKANA SEMI-VOICED SOUND MARK
	    0x101FD == code ||
	    // Mn       PHAISTOS DISC SIGN COMBINING OBLIQUE STROKE
	    0x102E0 == code ||
	    // Mn       COPTIC EPACT THOUSANDS MARK
	    0x10376 <= code && code <= 0x1037A ||
	    // Mn   [5] COMBINING OLD PERMIC LETTER AN..COMBINING OLD PERMIC LETTER SII
	    0x10A01 <= code && code <= 0x10A03 ||
	    // Mn   [3] KHAROSHTHI VOWEL SIGN I..KHAROSHTHI VOWEL SIGN VOCALIC R
	    0x10A05 <= code && code <= 0x10A06 ||
	    // Mn   [2] KHAROSHTHI VOWEL SIGN E..KHAROSHTHI VOWEL SIGN O
	    0x10A0C <= code && code <= 0x10A0F ||
	    // Mn   [4] KHAROSHTHI VOWEL LENGTH MARK..KHAROSHTHI SIGN VISARGA
	    0x10A38 <= code && code <= 0x10A3A ||
	    // Mn   [3] KHAROSHTHI SIGN BAR ABOVE..KHAROSHTHI SIGN DOT BELOW
	    0x10A3F == code ||
	    // Mn       KHAROSHTHI VIRAMA
	    0x10AE5 <= code && code <= 0x10AE6 ||
	    // Mn   [2] MANICHAEAN ABBREVIATION MARK ABOVE..MANICHAEAN ABBREVIATION MARK BELOW
	    0x11001 == code ||
	    // Mn       BRAHMI SIGN ANUSVARA
	    0x11038 <= code && code <= 0x11046 ||
	    // Mn  [15] BRAHMI VOWEL SIGN AA..BRAHMI VIRAMA
	    0x1107F <= code && code <= 0x11081 ||
	    // Mn   [3] BRAHMI NUMBER JOINER..KAITHI SIGN ANUSVARA
	    0x110B3 <= code && code <= 0x110B6 ||
	    // Mn   [4] KAITHI VOWEL SIGN U..KAITHI VOWEL SIGN AI
	    0x110B9 <= code && code <= 0x110BA ||
	    // Mn   [2] KAITHI SIGN VIRAMA..KAITHI SIGN NUKTA
	    0x11100 <= code && code <= 0x11102 ||
	    // Mn   [3] CHAKMA SIGN CANDRABINDU..CHAKMA SIGN VISARGA
	    0x11127 <= code && code <= 0x1112B ||
	    // Mn   [5] CHAKMA VOWEL SIGN A..CHAKMA VOWEL SIGN UU
	    0x1112D <= code && code <= 0x11134 ||
	    // Mn   [8] CHAKMA VOWEL SIGN AI..CHAKMA MAAYYAA
	    0x11173 == code ||
	    // Mn       MAHAJANI SIGN NUKTA
	    0x11180 <= code && code <= 0x11181 ||
	    // Mn   [2] SHARADA SIGN CANDRABINDU..SHARADA SIGN ANUSVARA
	    0x111B6 <= code && code <= 0x111BE ||
	    // Mn   [9] SHARADA VOWEL SIGN U..SHARADA VOWEL SIGN O
	    0x111CA <= code && code <= 0x111CC ||
	    // Mn   [3] SHARADA SIGN NUKTA..SHARADA EXTRA SHORT VOWEL MARK
	    0x1122F <= code && code <= 0x11231 ||
	    // Mn   [3] KHOJKI VOWEL SIGN U..KHOJKI VOWEL SIGN AI
	    0x11234 == code ||
	    // Mn       KHOJKI SIGN ANUSVARA
	    0x11236 <= code && code <= 0x11237 ||
	    // Mn   [2] KHOJKI SIGN NUKTA..KHOJKI SIGN SHADDA
	    0x1123E == code ||
	    // Mn       KHOJKI SIGN SUKUN
	    0x112DF == code ||
	    // Mn       KHUDAWADI SIGN ANUSVARA
	    0x112E3 <= code && code <= 0x112EA ||
	    // Mn   [8] KHUDAWADI VOWEL SIGN U..KHUDAWADI SIGN VIRAMA
	    0x11300 <= code && code <= 0x11301 ||
	    // Mn   [2] GRANTHA SIGN COMBINING ANUSVARA ABOVE..GRANTHA SIGN CANDRABINDU
	    0x1133C == code ||
	    // Mn       GRANTHA SIGN NUKTA
	    0x1133E == code ||
	    // Mc       GRANTHA VOWEL SIGN AA
	    0x11340 == code ||
	    // Mn       GRANTHA VOWEL SIGN II
	    0x11357 == code ||
	    // Mc       GRANTHA AU LENGTH MARK
	    0x11366 <= code && code <= 0x1136C ||
	    // Mn   [7] COMBINING GRANTHA DIGIT ZERO..COMBINING GRANTHA DIGIT SIX
	    0x11370 <= code && code <= 0x11374 ||
	    // Mn   [5] COMBINING GRANTHA LETTER A..COMBINING GRANTHA LETTER PA
	    0x11438 <= code && code <= 0x1143F ||
	    // Mn   [8] NEWA VOWEL SIGN U..NEWA VOWEL SIGN AI
	    0x11442 <= code && code <= 0x11444 ||
	    // Mn   [3] NEWA SIGN VIRAMA..NEWA SIGN ANUSVARA
	    0x11446 == code ||
	    // Mn       NEWA SIGN NUKTA
	    0x114B0 == code ||
	    // Mc       TIRHUTA VOWEL SIGN AA
	    0x114B3 <= code && code <= 0x114B8 ||
	    // Mn   [6] TIRHUTA VOWEL SIGN U..TIRHUTA VOWEL SIGN VOCALIC LL
	    0x114BA == code ||
	    // Mn       TIRHUTA VOWEL SIGN SHORT E
	    0x114BD == code ||
	    // Mc       TIRHUTA VOWEL SIGN SHORT O
	    0x114BF <= code && code <= 0x114C0 ||
	    // Mn   [2] TIRHUTA SIGN CANDRABINDU..TIRHUTA SIGN ANUSVARA
	    0x114C2 <= code && code <= 0x114C3 ||
	    // Mn   [2] TIRHUTA SIGN VIRAMA..TIRHUTA SIGN NUKTA
	    0x115AF == code ||
	    // Mc       SIDDHAM VOWEL SIGN AA
	    0x115B2 <= code && code <= 0x115B5 ||
	    // Mn   [4] SIDDHAM VOWEL SIGN U..SIDDHAM VOWEL SIGN VOCALIC RR
	    0x115BC <= code && code <= 0x115BD ||
	    // Mn   [2] SIDDHAM SIGN CANDRABINDU..SIDDHAM SIGN ANUSVARA
	    0x115BF <= code && code <= 0x115C0 ||
	    // Mn   [2] SIDDHAM SIGN VIRAMA..SIDDHAM SIGN NUKTA
	    0x115DC <= code && code <= 0x115DD ||
	    // Mn   [2] SIDDHAM VOWEL SIGN ALTERNATE U..SIDDHAM VOWEL SIGN ALTERNATE UU
	    0x11633 <= code && code <= 0x1163A ||
	    // Mn   [8] MODI VOWEL SIGN U..MODI VOWEL SIGN AI
	    0x1163D == code ||
	    // Mn       MODI SIGN ANUSVARA
	    0x1163F <= code && code <= 0x11640 ||
	    // Mn   [2] MODI SIGN VIRAMA..MODI SIGN ARDHACANDRA
	    0x116AB == code ||
	    // Mn       TAKRI SIGN ANUSVARA
	    0x116AD == code ||
	    // Mn       TAKRI VOWEL SIGN AA
	    0x116B0 <= code && code <= 0x116B5 ||
	    // Mn   [6] TAKRI VOWEL SIGN U..TAKRI VOWEL SIGN AU
	    0x116B7 == code ||
	    // Mn       TAKRI SIGN NUKTA
	    0x1171D <= code && code <= 0x1171F ||
	    // Mn   [3] AHOM CONSONANT SIGN MEDIAL LA..AHOM CONSONANT SIGN MEDIAL LIGATING RA
	    0x11722 <= code && code <= 0x11725 ||
	    // Mn   [4] AHOM VOWEL SIGN I..AHOM VOWEL SIGN UU
	    0x11727 <= code && code <= 0x1172B ||
	    // Mn   [5] AHOM VOWEL SIGN AW..AHOM SIGN KILLER
	    0x11A01 <= code && code <= 0x11A06 ||
	    // Mn   [6] ZANABAZAR SQUARE VOWEL SIGN I..ZANABAZAR SQUARE VOWEL SIGN O
	    0x11A09 <= code && code <= 0x11A0A ||
	    // Mn   [2] ZANABAZAR SQUARE VOWEL SIGN REVERSED I..ZANABAZAR SQUARE VOWEL LENGTH MARK
	    0x11A33 <= code && code <= 0x11A38 ||
	    // Mn   [6] ZANABAZAR SQUARE FINAL CONSONANT MARK..ZANABAZAR SQUARE SIGN ANUSVARA
	    0x11A3B <= code && code <= 0x11A3E ||
	    // Mn   [4] ZANABAZAR SQUARE CLUSTER-FINAL LETTER YA..ZANABAZAR SQUARE CLUSTER-FINAL LETTER VA
	    0x11A47 == code ||
	    // Mn       ZANABAZAR SQUARE SUBJOINER
	    0x11A51 <= code && code <= 0x11A56 ||
	    // Mn   [6] SOYOMBO VOWEL SIGN I..SOYOMBO VOWEL SIGN OE
	    0x11A59 <= code && code <= 0x11A5B ||
	    // Mn   [3] SOYOMBO VOWEL SIGN VOCALIC R..SOYOMBO VOWEL LENGTH MARK
	    0x11A8A <= code && code <= 0x11A96 ||
	    // Mn  [13] SOYOMBO FINAL CONSONANT SIGN G..SOYOMBO SIGN ANUSVARA
	    0x11A98 <= code && code <= 0x11A99 ||
	    // Mn   [2] SOYOMBO GEMINATION MARK..SOYOMBO SUBJOINER
	    0x11C30 <= code && code <= 0x11C36 ||
	    // Mn   [7] BHAIKSUKI VOWEL SIGN I..BHAIKSUKI VOWEL SIGN VOCALIC L
	    0x11C38 <= code && code <= 0x11C3D ||
	    // Mn   [6] BHAIKSUKI VOWEL SIGN E..BHAIKSUKI SIGN ANUSVARA
	    0x11C3F == code ||
	    // Mn       BHAIKSUKI SIGN VIRAMA
	    0x11C92 <= code && code <= 0x11CA7 ||
	    // Mn  [22] MARCHEN SUBJOINED LETTER KA..MARCHEN SUBJOINED LETTER ZA
	    0x11CAA <= code && code <= 0x11CB0 ||
	    // Mn   [7] MARCHEN SUBJOINED LETTER RA..MARCHEN VOWEL SIGN AA
	    0x11CB2 <= code && code <= 0x11CB3 ||
	    // Mn   [2] MARCHEN VOWEL SIGN U..MARCHEN VOWEL SIGN E
	    0x11CB5 <= code && code <= 0x11CB6 ||
	    // Mn   [2] MARCHEN SIGN ANUSVARA..MARCHEN SIGN CANDRABINDU
	    0x11D31 <= code && code <= 0x11D36 ||
	    // Mn   [6] MASARAM GONDI VOWEL SIGN AA..MASARAM GONDI VOWEL SIGN VOCALIC R
	    0x11D3A == code ||
	    // Mn       MASARAM GONDI VOWEL SIGN E
	    0x11D3C <= code && code <= 0x11D3D ||
	    // Mn   [2] MASARAM GONDI VOWEL SIGN AI..MASARAM GONDI VOWEL SIGN O
	    0x11D3F <= code && code <= 0x11D45 ||
	    // Mn   [7] MASARAM GONDI VOWEL SIGN AU..MASARAM GONDI VIRAMA
	    0x11D47 == code ||
	    // Mn       MASARAM GONDI RA-KARA
	    0x16AF0 <= code && code <= 0x16AF4 ||
	    // Mn   [5] BASSA VAH COMBINING HIGH TONE..BASSA VAH COMBINING HIGH-LOW TONE
	    0x16B30 <= code && code <= 0x16B36 ||
	    // Mn   [7] PAHAWH HMONG MARK CIM TUB..PAHAWH HMONG MARK CIM TAUM
	    0x16F8F <= code && code <= 0x16F92 ||
	    // Mn   [4] MIAO TONE RIGHT..MIAO TONE BELOW
	    0x1BC9D <= code && code <= 0x1BC9E ||
	    // Mn   [2] DUPLOYAN THICK LETTER SELECTOR..DUPLOYAN DOUBLE MARK
	    0x1D165 == code ||
	    // Mc       MUSICAL SYMBOL COMBINING STEM
	    0x1D167 <= code && code <= 0x1D169 ||
	    // Mn   [3] MUSICAL SYMBOL COMBINING TREMOLO-1..MUSICAL SYMBOL COMBINING TREMOLO-3
	    0x1D16E <= code && code <= 0x1D172 ||
	    // Mc   [5] MUSICAL SYMBOL COMBINING FLAG-1..MUSICAL SYMBOL COMBINING FLAG-5
	    0x1D17B <= code && code <= 0x1D182 ||
	    // Mn   [8] MUSICAL SYMBOL COMBINING ACCENT..MUSICAL SYMBOL COMBINING LOURE
	    0x1D185 <= code && code <= 0x1D18B ||
	    // Mn   [7] MUSICAL SYMBOL COMBINING DOIT..MUSICAL SYMBOL COMBINING TRIPLE TONGUE
	    0x1D1AA <= code && code <= 0x1D1AD ||
	    // Mn   [4] MUSICAL SYMBOL COMBINING DOWN BOW..MUSICAL SYMBOL COMBINING SNAP PIZZICATO
	    0x1D242 <= code && code <= 0x1D244 ||
	    // Mn   [3] COMBINING GREEK MUSICAL TRISEME..COMBINING GREEK MUSICAL PENTASEME
	    0x1DA00 <= code && code <= 0x1DA36 ||
	    // Mn  [55] SIGNWRITING HEAD RIM..SIGNWRITING AIR SUCKING IN
	    0x1DA3B <= code && code <= 0x1DA6C ||
	    // Mn  [50] SIGNWRITING MOUTH CLOSED NEUTRAL..SIGNWRITING EXCITEMENT
	    0x1DA75 == code ||
	    // Mn       SIGNWRITING UPPER BODY TILTING FROM HIP JOINTS
	    0x1DA84 == code ||
	    // Mn       SIGNWRITING LOCATION HEAD NECK
	    0x1DA9B <= code && code <= 0x1DA9F ||
	    // Mn   [5] SIGNWRITING FILL MODIFIER-2..SIGNWRITING FILL MODIFIER-6
	    0x1DAA1 <= code && code <= 0x1DAAF ||
	    // Mn  [15] SIGNWRITING ROTATION MODIFIER-2..SIGNWRITING ROTATION MODIFIER-16
	    0x1E000 <= code && code <= 0x1E006 ||
	    // Mn   [7] COMBINING GLAGOLITIC LETTER AZU..COMBINING GLAGOLITIC LETTER ZHIVETE
	    0x1E008 <= code && code <= 0x1E018 ||
	    // Mn  [17] COMBINING GLAGOLITIC LETTER ZEMLJA..COMBINING GLAGOLITIC LETTER HERU
	    0x1E01B <= code && code <= 0x1E021 ||
	    // Mn   [7] COMBINING GLAGOLITIC LETTER SHTA..COMBINING GLAGOLITIC LETTER YATI
	    0x1E023 <= code && code <= 0x1E024 ||
	    // Mn   [2] COMBINING GLAGOLITIC LETTER YU..COMBINING GLAGOLITIC LETTER SMALL YUS
	    0x1E026 <= code && code <= 0x1E02A ||
	    // Mn   [5] COMBINING GLAGOLITIC LETTER YO..COMBINING GLAGOLITIC LETTER FITA
	    0x1E8D0 <= code && code <= 0x1E8D6 ||
	    // Mn   [7] MENDE KIKAKUI COMBINING NUMBER TEENS..MENDE KIKAKUI COMBINING NUMBER MILLIONS
	    0x1E944 <= code && code <= 0x1E94A ||
	    // Mn   [7] ADLAM ALIF LENGTHENER..ADLAM NUKTA
	    0xE0020 <= code && code <= 0xE007F ||
	    // Cf  [96] TAG SPACE..CANCEL TAG
	    0xE0100 <= code && code <= 0xE01EF // Mn [240] VARIATION SELECTOR-17..VARIATION SELECTOR-256
	    ) {
	      return Extend;
	    }
	    if (0x1F1E6 <= code && code <= 0x1F1FF // So  [26] REGIONAL INDICATOR SYMBOL LETTER A..REGIONAL INDICATOR SYMBOL LETTER Z
	    ) {
	      return Regional_Indicator;
	    }
	    if (0x0903 == code ||
	    // Mc       DEVANAGARI SIGN VISARGA
	    0x093B == code ||
	    // Mc       DEVANAGARI VOWEL SIGN OOE
	    0x093E <= code && code <= 0x0940 ||
	    // Mc   [3] DEVANAGARI VOWEL SIGN AA..DEVANAGARI VOWEL SIGN II
	    0x0949 <= code && code <= 0x094C ||
	    // Mc   [4] DEVANAGARI VOWEL SIGN CANDRA O..DEVANAGARI VOWEL SIGN AU
	    0x094E <= code && code <= 0x094F ||
	    // Mc   [2] DEVANAGARI VOWEL SIGN PRISHTHAMATRA E..DEVANAGARI VOWEL SIGN AW
	    0x0982 <= code && code <= 0x0983 ||
	    // Mc   [2] BENGALI SIGN ANUSVARA..BENGALI SIGN VISARGA
	    0x09BF <= code && code <= 0x09C0 ||
	    // Mc   [2] BENGALI VOWEL SIGN I..BENGALI VOWEL SIGN II
	    0x09C7 <= code && code <= 0x09C8 ||
	    // Mc   [2] BENGALI VOWEL SIGN E..BENGALI VOWEL SIGN AI
	    0x09CB <= code && code <= 0x09CC ||
	    // Mc   [2] BENGALI VOWEL SIGN O..BENGALI VOWEL SIGN AU
	    0x0A03 == code ||
	    // Mc       GURMUKHI SIGN VISARGA
	    0x0A3E <= code && code <= 0x0A40 ||
	    // Mc   [3] GURMUKHI VOWEL SIGN AA..GURMUKHI VOWEL SIGN II
	    0x0A83 == code ||
	    // Mc       GUJARATI SIGN VISARGA
	    0x0ABE <= code && code <= 0x0AC0 ||
	    // Mc   [3] GUJARATI VOWEL SIGN AA..GUJARATI VOWEL SIGN II
	    0x0AC9 == code ||
	    // Mc       GUJARATI VOWEL SIGN CANDRA O
	    0x0ACB <= code && code <= 0x0ACC ||
	    // Mc   [2] GUJARATI VOWEL SIGN O..GUJARATI VOWEL SIGN AU
	    0x0B02 <= code && code <= 0x0B03 ||
	    // Mc   [2] ORIYA SIGN ANUSVARA..ORIYA SIGN VISARGA
	    0x0B40 == code ||
	    // Mc       ORIYA VOWEL SIGN II
	    0x0B47 <= code && code <= 0x0B48 ||
	    // Mc   [2] ORIYA VOWEL SIGN E..ORIYA VOWEL SIGN AI
	    0x0B4B <= code && code <= 0x0B4C ||
	    // Mc   [2] ORIYA VOWEL SIGN O..ORIYA VOWEL SIGN AU
	    0x0BBF == code ||
	    // Mc       TAMIL VOWEL SIGN I
	    0x0BC1 <= code && code <= 0x0BC2 ||
	    // Mc   [2] TAMIL VOWEL SIGN U..TAMIL VOWEL SIGN UU
	    0x0BC6 <= code && code <= 0x0BC8 ||
	    // Mc   [3] TAMIL VOWEL SIGN E..TAMIL VOWEL SIGN AI
	    0x0BCA <= code && code <= 0x0BCC ||
	    // Mc   [3] TAMIL VOWEL SIGN O..TAMIL VOWEL SIGN AU
	    0x0C01 <= code && code <= 0x0C03 ||
	    // Mc   [3] TELUGU SIGN CANDRABINDU..TELUGU SIGN VISARGA
	    0x0C41 <= code && code <= 0x0C44 ||
	    // Mc   [4] TELUGU VOWEL SIGN U..TELUGU VOWEL SIGN VOCALIC RR
	    0x0C82 <= code && code <= 0x0C83 ||
	    // Mc   [2] KANNADA SIGN ANUSVARA..KANNADA SIGN VISARGA
	    0x0CBE == code ||
	    // Mc       KANNADA VOWEL SIGN AA
	    0x0CC0 <= code && code <= 0x0CC1 ||
	    // Mc   [2] KANNADA VOWEL SIGN II..KANNADA VOWEL SIGN U
	    0x0CC3 <= code && code <= 0x0CC4 ||
	    // Mc   [2] KANNADA VOWEL SIGN VOCALIC R..KANNADA VOWEL SIGN VOCALIC RR
	    0x0CC7 <= code && code <= 0x0CC8 ||
	    // Mc   [2] KANNADA VOWEL SIGN EE..KANNADA VOWEL SIGN AI
	    0x0CCA <= code && code <= 0x0CCB ||
	    // Mc   [2] KANNADA VOWEL SIGN O..KANNADA VOWEL SIGN OO
	    0x0D02 <= code && code <= 0x0D03 ||
	    // Mc   [2] MALAYALAM SIGN ANUSVARA..MALAYALAM SIGN VISARGA
	    0x0D3F <= code && code <= 0x0D40 ||
	    // Mc   [2] MALAYALAM VOWEL SIGN I..MALAYALAM VOWEL SIGN II
	    0x0D46 <= code && code <= 0x0D48 ||
	    // Mc   [3] MALAYALAM VOWEL SIGN E..MALAYALAM VOWEL SIGN AI
	    0x0D4A <= code && code <= 0x0D4C ||
	    // Mc   [3] MALAYALAM VOWEL SIGN O..MALAYALAM VOWEL SIGN AU
	    0x0D82 <= code && code <= 0x0D83 ||
	    // Mc   [2] SINHALA SIGN ANUSVARAYA..SINHALA SIGN VISARGAYA
	    0x0DD0 <= code && code <= 0x0DD1 ||
	    // Mc   [2] SINHALA VOWEL SIGN KETTI AEDA-PILLA..SINHALA VOWEL SIGN DIGA AEDA-PILLA
	    0x0DD8 <= code && code <= 0x0DDE ||
	    // Mc   [7] SINHALA VOWEL SIGN GAETTA-PILLA..SINHALA VOWEL SIGN KOMBUVA HAA GAYANUKITTA
	    0x0DF2 <= code && code <= 0x0DF3 ||
	    // Mc   [2] SINHALA VOWEL SIGN DIGA GAETTA-PILLA..SINHALA VOWEL SIGN DIGA GAYANUKITTA
	    0x0E33 == code ||
	    // Lo       THAI CHARACTER SARA AM
	    0x0EB3 == code ||
	    // Lo       LAO VOWEL SIGN AM
	    0x0F3E <= code && code <= 0x0F3F ||
	    // Mc   [2] TIBETAN SIGN YAR TSHES..TIBETAN SIGN MAR TSHES
	    0x0F7F == code ||
	    // Mc       TIBETAN SIGN RNAM BCAD
	    0x1031 == code ||
	    // Mc       MYANMAR VOWEL SIGN E
	    0x103B <= code && code <= 0x103C ||
	    // Mc   [2] MYANMAR CONSONANT SIGN MEDIAL YA..MYANMAR CONSONANT SIGN MEDIAL RA
	    0x1056 <= code && code <= 0x1057 ||
	    // Mc   [2] MYANMAR VOWEL SIGN VOCALIC R..MYANMAR VOWEL SIGN VOCALIC RR
	    0x1084 == code ||
	    // Mc       MYANMAR VOWEL SIGN SHAN E
	    0x17B6 == code ||
	    // Mc       KHMER VOWEL SIGN AA
	    0x17BE <= code && code <= 0x17C5 ||
	    // Mc   [8] KHMER VOWEL SIGN OE..KHMER VOWEL SIGN AU
	    0x17C7 <= code && code <= 0x17C8 ||
	    // Mc   [2] KHMER SIGN REAHMUK..KHMER SIGN YUUKALEAPINTU
	    0x1923 <= code && code <= 0x1926 ||
	    // Mc   [4] LIMBU VOWEL SIGN EE..LIMBU VOWEL SIGN AU
	    0x1929 <= code && code <= 0x192B ||
	    // Mc   [3] LIMBU SUBJOINED LETTER YA..LIMBU SUBJOINED LETTER WA
	    0x1930 <= code && code <= 0x1931 ||
	    // Mc   [2] LIMBU SMALL LETTER KA..LIMBU SMALL LETTER NGA
	    0x1933 <= code && code <= 0x1938 ||
	    // Mc   [6] LIMBU SMALL LETTER TA..LIMBU SMALL LETTER LA
	    0x1A19 <= code && code <= 0x1A1A ||
	    // Mc   [2] BUGINESE VOWEL SIGN E..BUGINESE VOWEL SIGN O
	    0x1A55 == code ||
	    // Mc       TAI THAM CONSONANT SIGN MEDIAL RA
	    0x1A57 == code ||
	    // Mc       TAI THAM CONSONANT SIGN LA TANG LAI
	    0x1A6D <= code && code <= 0x1A72 ||
	    // Mc   [6] TAI THAM VOWEL SIGN OY..TAI THAM VOWEL SIGN THAM AI
	    0x1B04 == code ||
	    // Mc       BALINESE SIGN BISAH
	    0x1B35 == code ||
	    // Mc       BALINESE VOWEL SIGN TEDUNG
	    0x1B3B == code ||
	    // Mc       BALINESE VOWEL SIGN RA REPA TEDUNG
	    0x1B3D <= code && code <= 0x1B41 ||
	    // Mc   [5] BALINESE VOWEL SIGN LA LENGA TEDUNG..BALINESE VOWEL SIGN TALING REPA TEDUNG
	    0x1B43 <= code && code <= 0x1B44 ||
	    // Mc   [2] BALINESE VOWEL SIGN PEPET TEDUNG..BALINESE ADEG ADEG
	    0x1B82 == code ||
	    // Mc       SUNDANESE SIGN PANGWISAD
	    0x1BA1 == code ||
	    // Mc       SUNDANESE CONSONANT SIGN PAMINGKAL
	    0x1BA6 <= code && code <= 0x1BA7 ||
	    // Mc   [2] SUNDANESE VOWEL SIGN PANAELAENG..SUNDANESE VOWEL SIGN PANOLONG
	    0x1BAA == code ||
	    // Mc       SUNDANESE SIGN PAMAAEH
	    0x1BE7 == code ||
	    // Mc       BATAK VOWEL SIGN E
	    0x1BEA <= code && code <= 0x1BEC ||
	    // Mc   [3] BATAK VOWEL SIGN I..BATAK VOWEL SIGN O
	    0x1BEE == code ||
	    // Mc       BATAK VOWEL SIGN U
	    0x1BF2 <= code && code <= 0x1BF3 ||
	    // Mc   [2] BATAK PANGOLAT..BATAK PANONGONAN
	    0x1C24 <= code && code <= 0x1C2B ||
	    // Mc   [8] LEPCHA SUBJOINED LETTER YA..LEPCHA VOWEL SIGN UU
	    0x1C34 <= code && code <= 0x1C35 ||
	    // Mc   [2] LEPCHA CONSONANT SIGN NYIN-DO..LEPCHA CONSONANT SIGN KANG
	    0x1CE1 == code ||
	    // Mc       VEDIC TONE ATHARVAVEDIC INDEPENDENT SVARITA
	    0x1CF2 <= code && code <= 0x1CF3 ||
	    // Mc   [2] VEDIC SIGN ARDHAVISARGA..VEDIC SIGN ROTATED ARDHAVISARGA
	    0x1CF7 == code ||
	    // Mc       VEDIC SIGN ATIKRAMA
	    0xA823 <= code && code <= 0xA824 ||
	    // Mc   [2] SYLOTI NAGRI VOWEL SIGN A..SYLOTI NAGRI VOWEL SIGN I
	    0xA827 == code ||
	    // Mc       SYLOTI NAGRI VOWEL SIGN OO
	    0xA880 <= code && code <= 0xA881 ||
	    // Mc   [2] SAURASHTRA SIGN ANUSVARA..SAURASHTRA SIGN VISARGA
	    0xA8B4 <= code && code <= 0xA8C3 ||
	    // Mc  [16] SAURASHTRA CONSONANT SIGN HAARU..SAURASHTRA VOWEL SIGN AU
	    0xA952 <= code && code <= 0xA953 ||
	    // Mc   [2] REJANG CONSONANT SIGN H..REJANG VIRAMA
	    0xA983 == code ||
	    // Mc       JAVANESE SIGN WIGNYAN
	    0xA9B4 <= code && code <= 0xA9B5 ||
	    // Mc   [2] JAVANESE VOWEL SIGN TARUNG..JAVANESE VOWEL SIGN TOLONG
	    0xA9BA <= code && code <= 0xA9BB ||
	    // Mc   [2] JAVANESE VOWEL SIGN TALING..JAVANESE VOWEL SIGN DIRGA MURE
	    0xA9BD <= code && code <= 0xA9C0 ||
	    // Mc   [4] JAVANESE CONSONANT SIGN KERET..JAVANESE PANGKON
	    0xAA2F <= code && code <= 0xAA30 ||
	    // Mc   [2] CHAM VOWEL SIGN O..CHAM VOWEL SIGN AI
	    0xAA33 <= code && code <= 0xAA34 ||
	    // Mc   [2] CHAM CONSONANT SIGN YA..CHAM CONSONANT SIGN RA
	    0xAA4D == code ||
	    // Mc       CHAM CONSONANT SIGN FINAL H
	    0xAAEB == code ||
	    // Mc       MEETEI MAYEK VOWEL SIGN II
	    0xAAEE <= code && code <= 0xAAEF ||
	    // Mc   [2] MEETEI MAYEK VOWEL SIGN AU..MEETEI MAYEK VOWEL SIGN AAU
	    0xAAF5 == code ||
	    // Mc       MEETEI MAYEK VOWEL SIGN VISARGA
	    0xABE3 <= code && code <= 0xABE4 ||
	    // Mc   [2] MEETEI MAYEK VOWEL SIGN ONAP..MEETEI MAYEK VOWEL SIGN INAP
	    0xABE6 <= code && code <= 0xABE7 ||
	    // Mc   [2] MEETEI MAYEK VOWEL SIGN YENAP..MEETEI MAYEK VOWEL SIGN SOUNAP
	    0xABE9 <= code && code <= 0xABEA ||
	    // Mc   [2] MEETEI MAYEK VOWEL SIGN CHEINAP..MEETEI MAYEK VOWEL SIGN NUNG
	    0xABEC == code ||
	    // Mc       MEETEI MAYEK LUM IYEK
	    0x11000 == code ||
	    // Mc       BRAHMI SIGN CANDRABINDU
	    0x11002 == code ||
	    // Mc       BRAHMI SIGN VISARGA
	    0x11082 == code ||
	    // Mc       KAITHI SIGN VISARGA
	    0x110B0 <= code && code <= 0x110B2 ||
	    // Mc   [3] KAITHI VOWEL SIGN AA..KAITHI VOWEL SIGN II
	    0x110B7 <= code && code <= 0x110B8 ||
	    // Mc   [2] KAITHI VOWEL SIGN O..KAITHI VOWEL SIGN AU
	    0x1112C == code ||
	    // Mc       CHAKMA VOWEL SIGN E
	    0x11182 == code ||
	    // Mc       SHARADA SIGN VISARGA
	    0x111B3 <= code && code <= 0x111B5 ||
	    // Mc   [3] SHARADA VOWEL SIGN AA..SHARADA VOWEL SIGN II
	    0x111BF <= code && code <= 0x111C0 ||
	    // Mc   [2] SHARADA VOWEL SIGN AU..SHARADA SIGN VIRAMA
	    0x1122C <= code && code <= 0x1122E ||
	    // Mc   [3] KHOJKI VOWEL SIGN AA..KHOJKI VOWEL SIGN II
	    0x11232 <= code && code <= 0x11233 ||
	    // Mc   [2] KHOJKI VOWEL SIGN O..KHOJKI VOWEL SIGN AU
	    0x11235 == code ||
	    // Mc       KHOJKI SIGN VIRAMA
	    0x112E0 <= code && code <= 0x112E2 ||
	    // Mc   [3] KHUDAWADI VOWEL SIGN AA..KHUDAWADI VOWEL SIGN II
	    0x11302 <= code && code <= 0x11303 ||
	    // Mc   [2] GRANTHA SIGN ANUSVARA..GRANTHA SIGN VISARGA
	    0x1133F == code ||
	    // Mc       GRANTHA VOWEL SIGN I
	    0x11341 <= code && code <= 0x11344 ||
	    // Mc   [4] GRANTHA VOWEL SIGN U..GRANTHA VOWEL SIGN VOCALIC RR
	    0x11347 <= code && code <= 0x11348 ||
	    // Mc   [2] GRANTHA VOWEL SIGN EE..GRANTHA VOWEL SIGN AI
	    0x1134B <= code && code <= 0x1134D ||
	    // Mc   [3] GRANTHA VOWEL SIGN OO..GRANTHA SIGN VIRAMA
	    0x11362 <= code && code <= 0x11363 ||
	    // Mc   [2] GRANTHA VOWEL SIGN VOCALIC L..GRANTHA VOWEL SIGN VOCALIC LL
	    0x11435 <= code && code <= 0x11437 ||
	    // Mc   [3] NEWA VOWEL SIGN AA..NEWA VOWEL SIGN II
	    0x11440 <= code && code <= 0x11441 ||
	    // Mc   [2] NEWA VOWEL SIGN O..NEWA VOWEL SIGN AU
	    0x11445 == code ||
	    // Mc       NEWA SIGN VISARGA
	    0x114B1 <= code && code <= 0x114B2 ||
	    // Mc   [2] TIRHUTA VOWEL SIGN I..TIRHUTA VOWEL SIGN II
	    0x114B9 == code ||
	    // Mc       TIRHUTA VOWEL SIGN E
	    0x114BB <= code && code <= 0x114BC ||
	    // Mc   [2] TIRHUTA VOWEL SIGN AI..TIRHUTA VOWEL SIGN O
	    0x114BE == code ||
	    // Mc       TIRHUTA VOWEL SIGN AU
	    0x114C1 == code ||
	    // Mc       TIRHUTA SIGN VISARGA
	    0x115B0 <= code && code <= 0x115B1 ||
	    // Mc   [2] SIDDHAM VOWEL SIGN I..SIDDHAM VOWEL SIGN II
	    0x115B8 <= code && code <= 0x115BB ||
	    // Mc   [4] SIDDHAM VOWEL SIGN E..SIDDHAM VOWEL SIGN AU
	    0x115BE == code ||
	    // Mc       SIDDHAM SIGN VISARGA
	    0x11630 <= code && code <= 0x11632 ||
	    // Mc   [3] MODI VOWEL SIGN AA..MODI VOWEL SIGN II
	    0x1163B <= code && code <= 0x1163C ||
	    // Mc   [2] MODI VOWEL SIGN O..MODI VOWEL SIGN AU
	    0x1163E == code ||
	    // Mc       MODI SIGN VISARGA
	    0x116AC == code ||
	    // Mc       TAKRI SIGN VISARGA
	    0x116AE <= code && code <= 0x116AF ||
	    // Mc   [2] TAKRI VOWEL SIGN I..TAKRI VOWEL SIGN II
	    0x116B6 == code ||
	    // Mc       TAKRI SIGN VIRAMA
	    0x11720 <= code && code <= 0x11721 ||
	    // Mc   [2] AHOM VOWEL SIGN A..AHOM VOWEL SIGN AA
	    0x11726 == code ||
	    // Mc       AHOM VOWEL SIGN E
	    0x11A07 <= code && code <= 0x11A08 ||
	    // Mc   [2] ZANABAZAR SQUARE VOWEL SIGN AI..ZANABAZAR SQUARE VOWEL SIGN AU
	    0x11A39 == code ||
	    // Mc       ZANABAZAR SQUARE SIGN VISARGA
	    0x11A57 <= code && code <= 0x11A58 ||
	    // Mc   [2] SOYOMBO VOWEL SIGN AI..SOYOMBO VOWEL SIGN AU
	    0x11A97 == code ||
	    // Mc       SOYOMBO SIGN VISARGA
	    0x11C2F == code ||
	    // Mc       BHAIKSUKI VOWEL SIGN AA
	    0x11C3E == code ||
	    // Mc       BHAIKSUKI SIGN VISARGA
	    0x11CA9 == code ||
	    // Mc       MARCHEN SUBJOINED LETTER YA
	    0x11CB1 == code ||
	    // Mc       MARCHEN VOWEL SIGN I
	    0x11CB4 == code ||
	    // Mc       MARCHEN VOWEL SIGN O
	    0x16F51 <= code && code <= 0x16F7E ||
	    // Mc  [46] MIAO SIGN ASPIRATION..MIAO VOWEL SIGN NG
	    0x1D166 == code ||
	    // Mc       MUSICAL SYMBOL COMBINING SPRECHGESANG STEM
	    0x1D16D == code // Mc       MUSICAL SYMBOL COMBINING AUGMENTATION DOT
	    ) {
	      return SpacingMark;
	    }
	    if (0x1100 <= code && code <= 0x115F ||
	    // Lo  [96] HANGUL CHOSEONG KIYEOK..HANGUL CHOSEONG FILLER
	    0xA960 <= code && code <= 0xA97C // Lo  [29] HANGUL CHOSEONG TIKEUT-MIEUM..HANGUL CHOSEONG SSANGYEORINHIEUH
	    ) {
	      return L;
	    }
	    if (0x1160 <= code && code <= 0x11A7 ||
	    // Lo  [72] HANGUL JUNGSEONG FILLER..HANGUL JUNGSEONG O-YAE
	    0xD7B0 <= code && code <= 0xD7C6 // Lo  [23] HANGUL JUNGSEONG O-YEO..HANGUL JUNGSEONG ARAEA-E
	    ) {
	      return V;
	    }
	    if (0x11A8 <= code && code <= 0x11FF ||
	    // Lo  [88] HANGUL JONGSEONG KIYEOK..HANGUL JONGSEONG SSANGNIEUN
	    0xD7CB <= code && code <= 0xD7FB // Lo  [49] HANGUL JONGSEONG NIEUN-RIEUL..HANGUL JONGSEONG PHIEUPH-THIEUTH
	    ) {
	      return T;
	    }
	    if (0xAC00 == code ||
	    // Lo       HANGUL SYLLABLE GA
	    0xAC1C == code ||
	    // Lo       HANGUL SYLLABLE GAE
	    0xAC38 == code ||
	    // Lo       HANGUL SYLLABLE GYA
	    0xAC54 == code ||
	    // Lo       HANGUL SYLLABLE GYAE
	    0xAC70 == code ||
	    // Lo       HANGUL SYLLABLE GEO
	    0xAC8C == code ||
	    // Lo       HANGUL SYLLABLE GE
	    0xACA8 == code ||
	    // Lo       HANGUL SYLLABLE GYEO
	    0xACC4 == code ||
	    // Lo       HANGUL SYLLABLE GYE
	    0xACE0 == code ||
	    // Lo       HANGUL SYLLABLE GO
	    0xACFC == code ||
	    // Lo       HANGUL SYLLABLE GWA
	    0xAD18 == code ||
	    // Lo       HANGUL SYLLABLE GWAE
	    0xAD34 == code ||
	    // Lo       HANGUL SYLLABLE GOE
	    0xAD50 == code ||
	    // Lo       HANGUL SYLLABLE GYO
	    0xAD6C == code ||
	    // Lo       HANGUL SYLLABLE GU
	    0xAD88 == code ||
	    // Lo       HANGUL SYLLABLE GWEO
	    0xADA4 == code ||
	    // Lo       HANGUL SYLLABLE GWE
	    0xADC0 == code ||
	    // Lo       HANGUL SYLLABLE GWI
	    0xADDC == code ||
	    // Lo       HANGUL SYLLABLE GYU
	    0xADF8 == code ||
	    // Lo       HANGUL SYLLABLE GEU
	    0xAE14 == code ||
	    // Lo       HANGUL SYLLABLE GYI
	    0xAE30 == code ||
	    // Lo       HANGUL SYLLABLE GI
	    0xAE4C == code ||
	    // Lo       HANGUL SYLLABLE GGA
	    0xAE68 == code ||
	    // Lo       HANGUL SYLLABLE GGAE
	    0xAE84 == code ||
	    // Lo       HANGUL SYLLABLE GGYA
	    0xAEA0 == code ||
	    // Lo       HANGUL SYLLABLE GGYAE
	    0xAEBC == code ||
	    // Lo       HANGUL SYLLABLE GGEO
	    0xAED8 == code ||
	    // Lo       HANGUL SYLLABLE GGE
	    0xAEF4 == code ||
	    // Lo       HANGUL SYLLABLE GGYEO
	    0xAF10 == code ||
	    // Lo       HANGUL SYLLABLE GGYE
	    0xAF2C == code ||
	    // Lo       HANGUL SYLLABLE GGO
	    0xAF48 == code ||
	    // Lo       HANGUL SYLLABLE GGWA
	    0xAF64 == code ||
	    // Lo       HANGUL SYLLABLE GGWAE
	    0xAF80 == code ||
	    // Lo       HANGUL SYLLABLE GGOE
	    0xAF9C == code ||
	    // Lo       HANGUL SYLLABLE GGYO
	    0xAFB8 == code ||
	    // Lo       HANGUL SYLLABLE GGU
	    0xAFD4 == code ||
	    // Lo       HANGUL SYLLABLE GGWEO
	    0xAFF0 == code ||
	    // Lo       HANGUL SYLLABLE GGWE
	    0xB00C == code ||
	    // Lo       HANGUL SYLLABLE GGWI
	    0xB028 == code ||
	    // Lo       HANGUL SYLLABLE GGYU
	    0xB044 == code ||
	    // Lo       HANGUL SYLLABLE GGEU
	    0xB060 == code ||
	    // Lo       HANGUL SYLLABLE GGYI
	    0xB07C == code ||
	    // Lo       HANGUL SYLLABLE GGI
	    0xB098 == code ||
	    // Lo       HANGUL SYLLABLE NA
	    0xB0B4 == code ||
	    // Lo       HANGUL SYLLABLE NAE
	    0xB0D0 == code ||
	    // Lo       HANGUL SYLLABLE NYA
	    0xB0EC == code ||
	    // Lo       HANGUL SYLLABLE NYAE
	    0xB108 == code ||
	    // Lo       HANGUL SYLLABLE NEO
	    0xB124 == code ||
	    // Lo       HANGUL SYLLABLE NE
	    0xB140 == code ||
	    // Lo       HANGUL SYLLABLE NYEO
	    0xB15C == code ||
	    // Lo       HANGUL SYLLABLE NYE
	    0xB178 == code ||
	    // Lo       HANGUL SYLLABLE NO
	    0xB194 == code ||
	    // Lo       HANGUL SYLLABLE NWA
	    0xB1B0 == code ||
	    // Lo       HANGUL SYLLABLE NWAE
	    0xB1CC == code ||
	    // Lo       HANGUL SYLLABLE NOE
	    0xB1E8 == code ||
	    // Lo       HANGUL SYLLABLE NYO
	    0xB204 == code ||
	    // Lo       HANGUL SYLLABLE NU
	    0xB220 == code ||
	    // Lo       HANGUL SYLLABLE NWEO
	    0xB23C == code ||
	    // Lo       HANGUL SYLLABLE NWE
	    0xB258 == code ||
	    // Lo       HANGUL SYLLABLE NWI
	    0xB274 == code ||
	    // Lo       HANGUL SYLLABLE NYU
	    0xB290 == code ||
	    // Lo       HANGUL SYLLABLE NEU
	    0xB2AC == code ||
	    // Lo       HANGUL SYLLABLE NYI
	    0xB2C8 == code ||
	    // Lo       HANGUL SYLLABLE NI
	    0xB2E4 == code ||
	    // Lo       HANGUL SYLLABLE DA
	    0xB300 == code ||
	    // Lo       HANGUL SYLLABLE DAE
	    0xB31C == code ||
	    // Lo       HANGUL SYLLABLE DYA
	    0xB338 == code ||
	    // Lo       HANGUL SYLLABLE DYAE
	    0xB354 == code ||
	    // Lo       HANGUL SYLLABLE DEO
	    0xB370 == code ||
	    // Lo       HANGUL SYLLABLE DE
	    0xB38C == code ||
	    // Lo       HANGUL SYLLABLE DYEO
	    0xB3A8 == code ||
	    // Lo       HANGUL SYLLABLE DYE
	    0xB3C4 == code ||
	    // Lo       HANGUL SYLLABLE DO
	    0xB3E0 == code ||
	    // Lo       HANGUL SYLLABLE DWA
	    0xB3FC == code ||
	    // Lo       HANGUL SYLLABLE DWAE
	    0xB418 == code ||
	    // Lo       HANGUL SYLLABLE DOE
	    0xB434 == code ||
	    // Lo       HANGUL SYLLABLE DYO
	    0xB450 == code ||
	    // Lo       HANGUL SYLLABLE DU
	    0xB46C == code ||
	    // Lo       HANGUL SYLLABLE DWEO
	    0xB488 == code ||
	    // Lo       HANGUL SYLLABLE DWE
	    0xB4A4 == code ||
	    // Lo       HANGUL SYLLABLE DWI
	    0xB4C0 == code ||
	    // Lo       HANGUL SYLLABLE DYU
	    0xB4DC == code ||
	    // Lo       HANGUL SYLLABLE DEU
	    0xB4F8 == code ||
	    // Lo       HANGUL SYLLABLE DYI
	    0xB514 == code ||
	    // Lo       HANGUL SYLLABLE DI
	    0xB530 == code ||
	    // Lo       HANGUL SYLLABLE DDA
	    0xB54C == code ||
	    // Lo       HANGUL SYLLABLE DDAE
	    0xB568 == code ||
	    // Lo       HANGUL SYLLABLE DDYA
	    0xB584 == code ||
	    // Lo       HANGUL SYLLABLE DDYAE
	    0xB5A0 == code ||
	    // Lo       HANGUL SYLLABLE DDEO
	    0xB5BC == code ||
	    // Lo       HANGUL SYLLABLE DDE
	    0xB5D8 == code ||
	    // Lo       HANGUL SYLLABLE DDYEO
	    0xB5F4 == code ||
	    // Lo       HANGUL SYLLABLE DDYE
	    0xB610 == code ||
	    // Lo       HANGUL SYLLABLE DDO
	    0xB62C == code ||
	    // Lo       HANGUL SYLLABLE DDWA
	    0xB648 == code ||
	    // Lo       HANGUL SYLLABLE DDWAE
	    0xB664 == code ||
	    // Lo       HANGUL SYLLABLE DDOE
	    0xB680 == code ||
	    // Lo       HANGUL SYLLABLE DDYO
	    0xB69C == code ||
	    // Lo       HANGUL SYLLABLE DDU
	    0xB6B8 == code ||
	    // Lo       HANGUL SYLLABLE DDWEO
	    0xB6D4 == code ||
	    // Lo       HANGUL SYLLABLE DDWE
	    0xB6F0 == code ||
	    // Lo       HANGUL SYLLABLE DDWI
	    0xB70C == code ||
	    // Lo       HANGUL SYLLABLE DDYU
	    0xB728 == code ||
	    // Lo       HANGUL SYLLABLE DDEU
	    0xB744 == code ||
	    // Lo       HANGUL SYLLABLE DDYI
	    0xB760 == code ||
	    // Lo       HANGUL SYLLABLE DDI
	    0xB77C == code ||
	    // Lo       HANGUL SYLLABLE RA
	    0xB798 == code ||
	    // Lo       HANGUL SYLLABLE RAE
	    0xB7B4 == code ||
	    // Lo       HANGUL SYLLABLE RYA
	    0xB7D0 == code ||
	    // Lo       HANGUL SYLLABLE RYAE
	    0xB7EC == code ||
	    // Lo       HANGUL SYLLABLE REO
	    0xB808 == code ||
	    // Lo       HANGUL SYLLABLE RE
	    0xB824 == code ||
	    // Lo       HANGUL SYLLABLE RYEO
	    0xB840 == code ||
	    // Lo       HANGUL SYLLABLE RYE
	    0xB85C == code ||
	    // Lo       HANGUL SYLLABLE RO
	    0xB878 == code ||
	    // Lo       HANGUL SYLLABLE RWA
	    0xB894 == code ||
	    // Lo       HANGUL SYLLABLE RWAE
	    0xB8B0 == code ||
	    // Lo       HANGUL SYLLABLE ROE
	    0xB8CC == code ||
	    // Lo       HANGUL SYLLABLE RYO
	    0xB8E8 == code ||
	    // Lo       HANGUL SYLLABLE RU
	    0xB904 == code ||
	    // Lo       HANGUL SYLLABLE RWEO
	    0xB920 == code ||
	    // Lo       HANGUL SYLLABLE RWE
	    0xB93C == code ||
	    // Lo       HANGUL SYLLABLE RWI
	    0xB958 == code ||
	    // Lo       HANGUL SYLLABLE RYU
	    0xB974 == code ||
	    // Lo       HANGUL SYLLABLE REU
	    0xB990 == code ||
	    // Lo       HANGUL SYLLABLE RYI
	    0xB9AC == code ||
	    // Lo       HANGUL SYLLABLE RI
	    0xB9C8 == code ||
	    // Lo       HANGUL SYLLABLE MA
	    0xB9E4 == code ||
	    // Lo       HANGUL SYLLABLE MAE
	    0xBA00 == code ||
	    // Lo       HANGUL SYLLABLE MYA
	    0xBA1C == code ||
	    // Lo       HANGUL SYLLABLE MYAE
	    0xBA38 == code ||
	    // Lo       HANGUL SYLLABLE MEO
	    0xBA54 == code ||
	    // Lo       HANGUL SYLLABLE ME
	    0xBA70 == code ||
	    // Lo       HANGUL SYLLABLE MYEO
	    0xBA8C == code ||
	    // Lo       HANGUL SYLLABLE MYE
	    0xBAA8 == code ||
	    // Lo       HANGUL SYLLABLE MO
	    0xBAC4 == code ||
	    // Lo       HANGUL SYLLABLE MWA
	    0xBAE0 == code ||
	    // Lo       HANGUL SYLLABLE MWAE
	    0xBAFC == code ||
	    // Lo       HANGUL SYLLABLE MOE
	    0xBB18 == code ||
	    // Lo       HANGUL SYLLABLE MYO
	    0xBB34 == code ||
	    // Lo       HANGUL SYLLABLE MU
	    0xBB50 == code ||
	    // Lo       HANGUL SYLLABLE MWEO
	    0xBB6C == code ||
	    // Lo       HANGUL SYLLABLE MWE
	    0xBB88 == code ||
	    // Lo       HANGUL SYLLABLE MWI
	    0xBBA4 == code ||
	    // Lo       HANGUL SYLLABLE MYU
	    0xBBC0 == code ||
	    // Lo       HANGUL SYLLABLE MEU
	    0xBBDC == code ||
	    // Lo       HANGUL SYLLABLE MYI
	    0xBBF8 == code ||
	    // Lo       HANGUL SYLLABLE MI
	    0xBC14 == code ||
	    // Lo       HANGUL SYLLABLE BA
	    0xBC30 == code ||
	    // Lo       HANGUL SYLLABLE BAE
	    0xBC4C == code ||
	    // Lo       HANGUL SYLLABLE BYA
	    0xBC68 == code ||
	    // Lo       HANGUL SYLLABLE BYAE
	    0xBC84 == code ||
	    // Lo       HANGUL SYLLABLE BEO
	    0xBCA0 == code ||
	    // Lo       HANGUL SYLLABLE BE
	    0xBCBC == code ||
	    // Lo       HANGUL SYLLABLE BYEO
	    0xBCD8 == code ||
	    // Lo       HANGUL SYLLABLE BYE
	    0xBCF4 == code ||
	    // Lo       HANGUL SYLLABLE BO
	    0xBD10 == code ||
	    // Lo       HANGUL SYLLABLE BWA
	    0xBD2C == code ||
	    // Lo       HANGUL SYLLABLE BWAE
	    0xBD48 == code ||
	    // Lo       HANGUL SYLLABLE BOE
	    0xBD64 == code ||
	    // Lo       HANGUL SYLLABLE BYO
	    0xBD80 == code ||
	    // Lo       HANGUL SYLLABLE BU
	    0xBD9C == code ||
	    // Lo       HANGUL SYLLABLE BWEO
	    0xBDB8 == code ||
	    // Lo       HANGUL SYLLABLE BWE
	    0xBDD4 == code ||
	    // Lo       HANGUL SYLLABLE BWI
	    0xBDF0 == code ||
	    // Lo       HANGUL SYLLABLE BYU
	    0xBE0C == code ||
	    // Lo       HANGUL SYLLABLE BEU
	    0xBE28 == code ||
	    // Lo       HANGUL SYLLABLE BYI
	    0xBE44 == code ||
	    // Lo       HANGUL SYLLABLE BI
	    0xBE60 == code ||
	    // Lo       HANGUL SYLLABLE BBA
	    0xBE7C == code ||
	    // Lo       HANGUL SYLLABLE BBAE
	    0xBE98 == code ||
	    // Lo       HANGUL SYLLABLE BBYA
	    0xBEB4 == code ||
	    // Lo       HANGUL SYLLABLE BBYAE
	    0xBED0 == code ||
	    // Lo       HANGUL SYLLABLE BBEO
	    0xBEEC == code ||
	    // Lo       HANGUL SYLLABLE BBE
	    0xBF08 == code ||
	    // Lo       HANGUL SYLLABLE BBYEO
	    0xBF24 == code ||
	    // Lo       HANGUL SYLLABLE BBYE
	    0xBF40 == code ||
	    // Lo       HANGUL SYLLABLE BBO
	    0xBF5C == code ||
	    // Lo       HANGUL SYLLABLE BBWA
	    0xBF78 == code ||
	    // Lo       HANGUL SYLLABLE BBWAE
	    0xBF94 == code ||
	    // Lo       HANGUL SYLLABLE BBOE
	    0xBFB0 == code ||
	    // Lo       HANGUL SYLLABLE BBYO
	    0xBFCC == code ||
	    // Lo       HANGUL SYLLABLE BBU
	    0xBFE8 == code ||
	    // Lo       HANGUL SYLLABLE BBWEO
	    0xC004 == code ||
	    // Lo       HANGUL SYLLABLE BBWE
	    0xC020 == code ||
	    // Lo       HANGUL SYLLABLE BBWI
	    0xC03C == code ||
	    // Lo       HANGUL SYLLABLE BBYU
	    0xC058 == code ||
	    // Lo       HANGUL SYLLABLE BBEU
	    0xC074 == code ||
	    // Lo       HANGUL SYLLABLE BBYI
	    0xC090 == code ||
	    // Lo       HANGUL SYLLABLE BBI
	    0xC0AC == code ||
	    // Lo       HANGUL SYLLABLE SA
	    0xC0C8 == code ||
	    // Lo       HANGUL SYLLABLE SAE
	    0xC0E4 == code ||
	    // Lo       HANGUL SYLLABLE SYA
	    0xC100 == code ||
	    // Lo       HANGUL SYLLABLE SYAE
	    0xC11C == code ||
	    // Lo       HANGUL SYLLABLE SEO
	    0xC138 == code ||
	    // Lo       HANGUL SYLLABLE SE
	    0xC154 == code ||
	    // Lo       HANGUL SYLLABLE SYEO
	    0xC170 == code ||
	    // Lo       HANGUL SYLLABLE SYE
	    0xC18C == code ||
	    // Lo       HANGUL SYLLABLE SO
	    0xC1A8 == code ||
	    // Lo       HANGUL SYLLABLE SWA
	    0xC1C4 == code ||
	    // Lo       HANGUL SYLLABLE SWAE
	    0xC1E0 == code ||
	    // Lo       HANGUL SYLLABLE SOE
	    0xC1FC == code ||
	    // Lo       HANGUL SYLLABLE SYO
	    0xC218 == code ||
	    // Lo       HANGUL SYLLABLE SU
	    0xC234 == code ||
	    // Lo       HANGUL SYLLABLE SWEO
	    0xC250 == code ||
	    // Lo       HANGUL SYLLABLE SWE
	    0xC26C == code ||
	    // Lo       HANGUL SYLLABLE SWI
	    0xC288 == code ||
	    // Lo       HANGUL SYLLABLE SYU
	    0xC2A4 == code ||
	    // Lo       HANGUL SYLLABLE SEU
	    0xC2C0 == code ||
	    // Lo       HANGUL SYLLABLE SYI
	    0xC2DC == code ||
	    // Lo       HANGUL SYLLABLE SI
	    0xC2F8 == code ||
	    // Lo       HANGUL SYLLABLE SSA
	    0xC314 == code ||
	    // Lo       HANGUL SYLLABLE SSAE
	    0xC330 == code ||
	    // Lo       HANGUL SYLLABLE SSYA
	    0xC34C == code ||
	    // Lo       HANGUL SYLLABLE SSYAE
	    0xC368 == code ||
	    // Lo       HANGUL SYLLABLE SSEO
	    0xC384 == code ||
	    // Lo       HANGUL SYLLABLE SSE
	    0xC3A0 == code ||
	    // Lo       HANGUL SYLLABLE SSYEO
	    0xC3BC == code ||
	    // Lo       HANGUL SYLLABLE SSYE
	    0xC3D8 == code ||
	    // Lo       HANGUL SYLLABLE SSO
	    0xC3F4 == code ||
	    // Lo       HANGUL SYLLABLE SSWA
	    0xC410 == code ||
	    // Lo       HANGUL SYLLABLE SSWAE
	    0xC42C == code ||
	    // Lo       HANGUL SYLLABLE SSOE
	    0xC448 == code ||
	    // Lo       HANGUL SYLLABLE SSYO
	    0xC464 == code ||
	    // Lo       HANGUL SYLLABLE SSU
	    0xC480 == code ||
	    // Lo       HANGUL SYLLABLE SSWEO
	    0xC49C == code ||
	    // Lo       HANGUL SYLLABLE SSWE
	    0xC4B8 == code ||
	    // Lo       HANGUL SYLLABLE SSWI
	    0xC4D4 == code ||
	    // Lo       HANGUL SYLLABLE SSYU
	    0xC4F0 == code ||
	    // Lo       HANGUL SYLLABLE SSEU
	    0xC50C == code ||
	    // Lo       HANGUL SYLLABLE SSYI
	    0xC528 == code ||
	    // Lo       HANGUL SYLLABLE SSI
	    0xC544 == code ||
	    // Lo       HANGUL SYLLABLE A
	    0xC560 == code ||
	    // Lo       HANGUL SYLLABLE AE
	    0xC57C == code ||
	    // Lo       HANGUL SYLLABLE YA
	    0xC598 == code ||
	    // Lo       HANGUL SYLLABLE YAE
	    0xC5B4 == code ||
	    // Lo       HANGUL SYLLABLE EO
	    0xC5D0 == code ||
	    // Lo       HANGUL SYLLABLE E
	    0xC5EC == code ||
	    // Lo       HANGUL SYLLABLE YEO
	    0xC608 == code ||
	    // Lo       HANGUL SYLLABLE YE
	    0xC624 == code ||
	    // Lo       HANGUL SYLLABLE O
	    0xC640 == code ||
	    // Lo       HANGUL SYLLABLE WA
	    0xC65C == code ||
	    // Lo       HANGUL SYLLABLE WAE
	    0xC678 == code ||
	    // Lo       HANGUL SYLLABLE OE
	    0xC694 == code ||
	    // Lo       HANGUL SYLLABLE YO
	    0xC6B0 == code ||
	    // Lo       HANGUL SYLLABLE U
	    0xC6CC == code ||
	    // Lo       HANGUL SYLLABLE WEO
	    0xC6E8 == code ||
	    // Lo       HANGUL SYLLABLE WE
	    0xC704 == code ||
	    // Lo       HANGUL SYLLABLE WI
	    0xC720 == code ||
	    // Lo       HANGUL SYLLABLE YU
	    0xC73C == code ||
	    // Lo       HANGUL SYLLABLE EU
	    0xC758 == code ||
	    // Lo       HANGUL SYLLABLE YI
	    0xC774 == code ||
	    // Lo       HANGUL SYLLABLE I
	    0xC790 == code ||
	    // Lo       HANGUL SYLLABLE JA
	    0xC7AC == code ||
	    // Lo       HANGUL SYLLABLE JAE
	    0xC7C8 == code ||
	    // Lo       HANGUL SYLLABLE JYA
	    0xC7E4 == code ||
	    // Lo       HANGUL SYLLABLE JYAE
	    0xC800 == code ||
	    // Lo       HANGUL SYLLABLE JEO
	    0xC81C == code ||
	    // Lo       HANGUL SYLLABLE JE
	    0xC838 == code ||
	    // Lo       HANGUL SYLLABLE JYEO
	    0xC854 == code ||
	    // Lo       HANGUL SYLLABLE JYE
	    0xC870 == code ||
	    // Lo       HANGUL SYLLABLE JO
	    0xC88C == code ||
	    // Lo       HANGUL SYLLABLE JWA
	    0xC8A8 == code ||
	    // Lo       HANGUL SYLLABLE JWAE
	    0xC8C4 == code ||
	    // Lo       HANGUL SYLLABLE JOE
	    0xC8E0 == code ||
	    // Lo       HANGUL SYLLABLE JYO
	    0xC8FC == code ||
	    // Lo       HANGUL SYLLABLE JU
	    0xC918 == code ||
	    // Lo       HANGUL SYLLABLE JWEO
	    0xC934 == code ||
	    // Lo       HANGUL SYLLABLE JWE
	    0xC950 == code ||
	    // Lo       HANGUL SYLLABLE JWI
	    0xC96C == code ||
	    // Lo       HANGUL SYLLABLE JYU
	    0xC988 == code ||
	    // Lo       HANGUL SYLLABLE JEU
	    0xC9A4 == code ||
	    // Lo       HANGUL SYLLABLE JYI
	    0xC9C0 == code ||
	    // Lo       HANGUL SYLLABLE JI
	    0xC9DC == code ||
	    // Lo       HANGUL SYLLABLE JJA
	    0xC9F8 == code ||
	    // Lo       HANGUL SYLLABLE JJAE
	    0xCA14 == code ||
	    // Lo       HANGUL SYLLABLE JJYA
	    0xCA30 == code ||
	    // Lo       HANGUL SYLLABLE JJYAE
	    0xCA4C == code ||
	    // Lo       HANGUL SYLLABLE JJEO
	    0xCA68 == code ||
	    // Lo       HANGUL SYLLABLE JJE
	    0xCA84 == code ||
	    // Lo       HANGUL SYLLABLE JJYEO
	    0xCAA0 == code ||
	    // Lo       HANGUL SYLLABLE JJYE
	    0xCABC == code ||
	    // Lo       HANGUL SYLLABLE JJO
	    0xCAD8 == code ||
	    // Lo       HANGUL SYLLABLE JJWA
	    0xCAF4 == code ||
	    // Lo       HANGUL SYLLABLE JJWAE
	    0xCB10 == code ||
	    // Lo       HANGUL SYLLABLE JJOE
	    0xCB2C == code ||
	    // Lo       HANGUL SYLLABLE JJYO
	    0xCB48 == code ||
	    // Lo       HANGUL SYLLABLE JJU
	    0xCB64 == code ||
	    // Lo       HANGUL SYLLABLE JJWEO
	    0xCB80 == code ||
	    // Lo       HANGUL SYLLABLE JJWE
	    0xCB9C == code ||
	    // Lo       HANGUL SYLLABLE JJWI
	    0xCBB8 == code ||
	    // Lo       HANGUL SYLLABLE JJYU
	    0xCBD4 == code ||
	    // Lo       HANGUL SYLLABLE JJEU
	    0xCBF0 == code ||
	    // Lo       HANGUL SYLLABLE JJYI
	    0xCC0C == code ||
	    // Lo       HANGUL SYLLABLE JJI
	    0xCC28 == code ||
	    // Lo       HANGUL SYLLABLE CA
	    0xCC44 == code ||
	    // Lo       HANGUL SYLLABLE CAE
	    0xCC60 == code ||
	    // Lo       HANGUL SYLLABLE CYA
	    0xCC7C == code ||
	    // Lo       HANGUL SYLLABLE CYAE
	    0xCC98 == code ||
	    // Lo       HANGUL SYLLABLE CEO
	    0xCCB4 == code ||
	    // Lo       HANGUL SYLLABLE CE
	    0xCCD0 == code ||
	    // Lo       HANGUL SYLLABLE CYEO
	    0xCCEC == code ||
	    // Lo       HANGUL SYLLABLE CYE
	    0xCD08 == code ||
	    // Lo       HANGUL SYLLABLE CO
	    0xCD24 == code ||
	    // Lo       HANGUL SYLLABLE CWA
	    0xCD40 == code ||
	    // Lo       HANGUL SYLLABLE CWAE
	    0xCD5C == code ||
	    // Lo       HANGUL SYLLABLE COE
	    0xCD78 == code ||
	    // Lo       HANGUL SYLLABLE CYO
	    0xCD94 == code ||
	    // Lo       HANGUL SYLLABLE CU
	    0xCDB0 == code ||
	    // Lo       HANGUL SYLLABLE CWEO
	    0xCDCC == code ||
	    // Lo       HANGUL SYLLABLE CWE
	    0xCDE8 == code ||
	    // Lo       HANGUL SYLLABLE CWI
	    0xCE04 == code ||
	    // Lo       HANGUL SYLLABLE CYU
	    0xCE20 == code ||
	    // Lo       HANGUL SYLLABLE CEU
	    0xCE3C == code ||
	    // Lo       HANGUL SYLLABLE CYI
	    0xCE58 == code ||
	    // Lo       HANGUL SYLLABLE CI
	    0xCE74 == code ||
	    // Lo       HANGUL SYLLABLE KA
	    0xCE90 == code ||
	    // Lo       HANGUL SYLLABLE KAE
	    0xCEAC == code ||
	    // Lo       HANGUL SYLLABLE KYA
	    0xCEC8 == code ||
	    // Lo       HANGUL SYLLABLE KYAE
	    0xCEE4 == code ||
	    // Lo       HANGUL SYLLABLE KEO
	    0xCF00 == code ||
	    // Lo       HANGUL SYLLABLE KE
	    0xCF1C == code ||
	    // Lo       HANGUL SYLLABLE KYEO
	    0xCF38 == code ||
	    // Lo       HANGUL SYLLABLE KYE
	    0xCF54 == code ||
	    // Lo       HANGUL SYLLABLE KO
	    0xCF70 == code ||
	    // Lo       HANGUL SYLLABLE KWA
	    0xCF8C == code ||
	    // Lo       HANGUL SYLLABLE KWAE
	    0xCFA8 == code ||
	    // Lo       HANGUL SYLLABLE KOE
	    0xCFC4 == code ||
	    // Lo       HANGUL SYLLABLE KYO
	    0xCFE0 == code ||
	    // Lo       HANGUL SYLLABLE KU
	    0xCFFC == code ||
	    // Lo       HANGUL SYLLABLE KWEO
	    0xD018 == code ||
	    // Lo       HANGUL SYLLABLE KWE
	    0xD034 == code ||
	    // Lo       HANGUL SYLLABLE KWI
	    0xD050 == code ||
	    // Lo       HANGUL SYLLABLE KYU
	    0xD06C == code ||
	    // Lo       HANGUL SYLLABLE KEU
	    0xD088 == code ||
	    // Lo       HANGUL SYLLABLE KYI
	    0xD0A4 == code ||
	    // Lo       HANGUL SYLLABLE KI
	    0xD0C0 == code ||
	    // Lo       HANGUL SYLLABLE TA
	    0xD0DC == code ||
	    // Lo       HANGUL SYLLABLE TAE
	    0xD0F8 == code ||
	    // Lo       HANGUL SYLLABLE TYA
	    0xD114 == code ||
	    // Lo       HANGUL SYLLABLE TYAE
	    0xD130 == code ||
	    // Lo       HANGUL SYLLABLE TEO
	    0xD14C == code ||
	    // Lo       HANGUL SYLLABLE TE
	    0xD168 == code ||
	    // Lo       HANGUL SYLLABLE TYEO
	    0xD184 == code ||
	    // Lo       HANGUL SYLLABLE TYE
	    0xD1A0 == code ||
	    // Lo       HANGUL SYLLABLE TO
	    0xD1BC == code ||
	    // Lo       HANGUL SYLLABLE TWA
	    0xD1D8 == code ||
	    // Lo       HANGUL SYLLABLE TWAE
	    0xD1F4 == code ||
	    // Lo       HANGUL SYLLABLE TOE
	    0xD210 == code ||
	    // Lo       HANGUL SYLLABLE TYO
	    0xD22C == code ||
	    // Lo       HANGUL SYLLABLE TU
	    0xD248 == code ||
	    // Lo       HANGUL SYLLABLE TWEO
	    0xD264 == code ||
	    // Lo       HANGUL SYLLABLE TWE
	    0xD280 == code ||
	    // Lo       HANGUL SYLLABLE TWI
	    0xD29C == code ||
	    // Lo       HANGUL SYLLABLE TYU
	    0xD2B8 == code ||
	    // Lo       HANGUL SYLLABLE TEU
	    0xD2D4 == code ||
	    // Lo       HANGUL SYLLABLE TYI
	    0xD2F0 == code ||
	    // Lo       HANGUL SYLLABLE TI
	    0xD30C == code ||
	    // Lo       HANGUL SYLLABLE PA
	    0xD328 == code ||
	    // Lo       HANGUL SYLLABLE PAE
	    0xD344 == code ||
	    // Lo       HANGUL SYLLABLE PYA
	    0xD360 == code ||
	    // Lo       HANGUL SYLLABLE PYAE
	    0xD37C == code ||
	    // Lo       HANGUL SYLLABLE PEO
	    0xD398 == code ||
	    // Lo       HANGUL SYLLABLE PE
	    0xD3B4 == code ||
	    // Lo       HANGUL SYLLABLE PYEO
	    0xD3D0 == code ||
	    // Lo       HANGUL SYLLABLE PYE
	    0xD3EC == code ||
	    // Lo       HANGUL SYLLABLE PO
	    0xD408 == code ||
	    // Lo       HANGUL SYLLABLE PWA
	    0xD424 == code ||
	    // Lo       HANGUL SYLLABLE PWAE
	    0xD440 == code ||
	    // Lo       HANGUL SYLLABLE POE
	    0xD45C == code ||
	    // Lo       HANGUL SYLLABLE PYO
	    0xD478 == code ||
	    // Lo       HANGUL SYLLABLE PU
	    0xD494 == code ||
	    // Lo       HANGUL SYLLABLE PWEO
	    0xD4B0 == code ||
	    // Lo       HANGUL SYLLABLE PWE
	    0xD4CC == code ||
	    // Lo       HANGUL SYLLABLE PWI
	    0xD4E8 == code ||
	    // Lo       HANGUL SYLLABLE PYU
	    0xD504 == code ||
	    // Lo       HANGUL SYLLABLE PEU
	    0xD520 == code ||
	    // Lo       HANGUL SYLLABLE PYI
	    0xD53C == code ||
	    // Lo       HANGUL SYLLABLE PI
	    0xD558 == code ||
	    // Lo       HANGUL SYLLABLE HA
	    0xD574 == code ||
	    // Lo       HANGUL SYLLABLE HAE
	    0xD590 == code ||
	    // Lo       HANGUL SYLLABLE HYA
	    0xD5AC == code ||
	    // Lo       HANGUL SYLLABLE HYAE
	    0xD5C8 == code ||
	    // Lo       HANGUL SYLLABLE HEO
	    0xD5E4 == code ||
	    // Lo       HANGUL SYLLABLE HE
	    0xD600 == code ||
	    // Lo       HANGUL SYLLABLE HYEO
	    0xD61C == code ||
	    // Lo       HANGUL SYLLABLE HYE
	    0xD638 == code ||
	    // Lo       HANGUL SYLLABLE HO
	    0xD654 == code ||
	    // Lo       HANGUL SYLLABLE HWA
	    0xD670 == code ||
	    // Lo       HANGUL SYLLABLE HWAE
	    0xD68C == code ||
	    // Lo       HANGUL SYLLABLE HOE
	    0xD6A8 == code ||
	    // Lo       HANGUL SYLLABLE HYO
	    0xD6C4 == code ||
	    // Lo       HANGUL SYLLABLE HU
	    0xD6E0 == code ||
	    // Lo       HANGUL SYLLABLE HWEO
	    0xD6FC == code ||
	    // Lo       HANGUL SYLLABLE HWE
	    0xD718 == code ||
	    // Lo       HANGUL SYLLABLE HWI
	    0xD734 == code ||
	    // Lo       HANGUL SYLLABLE HYU
	    0xD750 == code ||
	    // Lo       HANGUL SYLLABLE HEU
	    0xD76C == code ||
	    // Lo       HANGUL SYLLABLE HYI
	    0xD788 == code // Lo       HANGUL SYLLABLE HI
	    ) {
	      return LV;
	    }
	    if (0xAC01 <= code && code <= 0xAC1B ||
	    // Lo  [27] HANGUL SYLLABLE GAG..HANGUL SYLLABLE GAH
	    0xAC1D <= code && code <= 0xAC37 ||
	    // Lo  [27] HANGUL SYLLABLE GAEG..HANGUL SYLLABLE GAEH
	    0xAC39 <= code && code <= 0xAC53 ||
	    // Lo  [27] HANGUL SYLLABLE GYAG..HANGUL SYLLABLE GYAH
	    0xAC55 <= code && code <= 0xAC6F ||
	    // Lo  [27] HANGUL SYLLABLE GYAEG..HANGUL SYLLABLE GYAEH
	    0xAC71 <= code && code <= 0xAC8B ||
	    // Lo  [27] HANGUL SYLLABLE GEOG..HANGUL SYLLABLE GEOH
	    0xAC8D <= code && code <= 0xACA7 ||
	    // Lo  [27] HANGUL SYLLABLE GEG..HANGUL SYLLABLE GEH
	    0xACA9 <= code && code <= 0xACC3 ||
	    // Lo  [27] HANGUL SYLLABLE GYEOG..HANGUL SYLLABLE GYEOH
	    0xACC5 <= code && code <= 0xACDF ||
	    // Lo  [27] HANGUL SYLLABLE GYEG..HANGUL SYLLABLE GYEH
	    0xACE1 <= code && code <= 0xACFB ||
	    // Lo  [27] HANGUL SYLLABLE GOG..HANGUL SYLLABLE GOH
	    0xACFD <= code && code <= 0xAD17 ||
	    // Lo  [27] HANGUL SYLLABLE GWAG..HANGUL SYLLABLE GWAH
	    0xAD19 <= code && code <= 0xAD33 ||
	    // Lo  [27] HANGUL SYLLABLE GWAEG..HANGUL SYLLABLE GWAEH
	    0xAD35 <= code && code <= 0xAD4F ||
	    // Lo  [27] HANGUL SYLLABLE GOEG..HANGUL SYLLABLE GOEH
	    0xAD51 <= code && code <= 0xAD6B ||
	    // Lo  [27] HANGUL SYLLABLE GYOG..HANGUL SYLLABLE GYOH
	    0xAD6D <= code && code <= 0xAD87 ||
	    // Lo  [27] HANGUL SYLLABLE GUG..HANGUL SYLLABLE GUH
	    0xAD89 <= code && code <= 0xADA3 ||
	    // Lo  [27] HANGUL SYLLABLE GWEOG..HANGUL SYLLABLE GWEOH
	    0xADA5 <= code && code <= 0xADBF ||
	    // Lo  [27] HANGUL SYLLABLE GWEG..HANGUL SYLLABLE GWEH
	    0xADC1 <= code && code <= 0xADDB ||
	    // Lo  [27] HANGUL SYLLABLE GWIG..HANGUL SYLLABLE GWIH
	    0xADDD <= code && code <= 0xADF7 ||
	    // Lo  [27] HANGUL SYLLABLE GYUG..HANGUL SYLLABLE GYUH
	    0xADF9 <= code && code <= 0xAE13 ||
	    // Lo  [27] HANGUL SYLLABLE GEUG..HANGUL SYLLABLE GEUH
	    0xAE15 <= code && code <= 0xAE2F ||
	    // Lo  [27] HANGUL SYLLABLE GYIG..HANGUL SYLLABLE GYIH
	    0xAE31 <= code && code <= 0xAE4B ||
	    // Lo  [27] HANGUL SYLLABLE GIG..HANGUL SYLLABLE GIH
	    0xAE4D <= code && code <= 0xAE67 ||
	    // Lo  [27] HANGUL SYLLABLE GGAG..HANGUL SYLLABLE GGAH
	    0xAE69 <= code && code <= 0xAE83 ||
	    // Lo  [27] HANGUL SYLLABLE GGAEG..HANGUL SYLLABLE GGAEH
	    0xAE85 <= code && code <= 0xAE9F ||
	    // Lo  [27] HANGUL SYLLABLE GGYAG..HANGUL SYLLABLE GGYAH
	    0xAEA1 <= code && code <= 0xAEBB ||
	    // Lo  [27] HANGUL SYLLABLE GGYAEG..HANGUL SYLLABLE GGYAEH
	    0xAEBD <= code && code <= 0xAED7 ||
	    // Lo  [27] HANGUL SYLLABLE GGEOG..HANGUL SYLLABLE GGEOH
	    0xAED9 <= code && code <= 0xAEF3 ||
	    // Lo  [27] HANGUL SYLLABLE GGEG..HANGUL SYLLABLE GGEH
	    0xAEF5 <= code && code <= 0xAF0F ||
	    // Lo  [27] HANGUL SYLLABLE GGYEOG..HANGUL SYLLABLE GGYEOH
	    0xAF11 <= code && code <= 0xAF2B ||
	    // Lo  [27] HANGUL SYLLABLE GGYEG..HANGUL SYLLABLE GGYEH
	    0xAF2D <= code && code <= 0xAF47 ||
	    // Lo  [27] HANGUL SYLLABLE GGOG..HANGUL SYLLABLE GGOH
	    0xAF49 <= code && code <= 0xAF63 ||
	    // Lo  [27] HANGUL SYLLABLE GGWAG..HANGUL SYLLABLE GGWAH
	    0xAF65 <= code && code <= 0xAF7F ||
	    // Lo  [27] HANGUL SYLLABLE GGWAEG..HANGUL SYLLABLE GGWAEH
	    0xAF81 <= code && code <= 0xAF9B ||
	    // Lo  [27] HANGUL SYLLABLE GGOEG..HANGUL SYLLABLE GGOEH
	    0xAF9D <= code && code <= 0xAFB7 ||
	    // Lo  [27] HANGUL SYLLABLE GGYOG..HANGUL SYLLABLE GGYOH
	    0xAFB9 <= code && code <= 0xAFD3 ||
	    // Lo  [27] HANGUL SYLLABLE GGUG..HANGUL SYLLABLE GGUH
	    0xAFD5 <= code && code <= 0xAFEF ||
	    // Lo  [27] HANGUL SYLLABLE GGWEOG..HANGUL SYLLABLE GGWEOH
	    0xAFF1 <= code && code <= 0xB00B ||
	    // Lo  [27] HANGUL SYLLABLE GGWEG..HANGUL SYLLABLE GGWEH
	    0xB00D <= code && code <= 0xB027 ||
	    // Lo  [27] HANGUL SYLLABLE GGWIG..HANGUL SYLLABLE GGWIH
	    0xB029 <= code && code <= 0xB043 ||
	    // Lo  [27] HANGUL SYLLABLE GGYUG..HANGUL SYLLABLE GGYUH
	    0xB045 <= code && code <= 0xB05F ||
	    // Lo  [27] HANGUL SYLLABLE GGEUG..HANGUL SYLLABLE GGEUH
	    0xB061 <= code && code <= 0xB07B ||
	    // Lo  [27] HANGUL SYLLABLE GGYIG..HANGUL SYLLABLE GGYIH
	    0xB07D <= code && code <= 0xB097 ||
	    // Lo  [27] HANGUL SYLLABLE GGIG..HANGUL SYLLABLE GGIH
	    0xB099 <= code && code <= 0xB0B3 ||
	    // Lo  [27] HANGUL SYLLABLE NAG..HANGUL SYLLABLE NAH
	    0xB0B5 <= code && code <= 0xB0CF ||
	    // Lo  [27] HANGUL SYLLABLE NAEG..HANGUL SYLLABLE NAEH
	    0xB0D1 <= code && code <= 0xB0EB ||
	    // Lo  [27] HANGUL SYLLABLE NYAG..HANGUL SYLLABLE NYAH
	    0xB0ED <= code && code <= 0xB107 ||
	    // Lo  [27] HANGUL SYLLABLE NYAEG..HANGUL SYLLABLE NYAEH
	    0xB109 <= code && code <= 0xB123 ||
	    // Lo  [27] HANGUL SYLLABLE NEOG..HANGUL SYLLABLE NEOH
	    0xB125 <= code && code <= 0xB13F ||
	    // Lo  [27] HANGUL SYLLABLE NEG..HANGUL SYLLABLE NEH
	    0xB141 <= code && code <= 0xB15B ||
	    // Lo  [27] HANGUL SYLLABLE NYEOG..HANGUL SYLLABLE NYEOH
	    0xB15D <= code && code <= 0xB177 ||
	    // Lo  [27] HANGUL SYLLABLE NYEG..HANGUL SYLLABLE NYEH
	    0xB179 <= code && code <= 0xB193 ||
	    // Lo  [27] HANGUL SYLLABLE NOG..HANGUL SYLLABLE NOH
	    0xB195 <= code && code <= 0xB1AF ||
	    // Lo  [27] HANGUL SYLLABLE NWAG..HANGUL SYLLABLE NWAH
	    0xB1B1 <= code && code <= 0xB1CB ||
	    // Lo  [27] HANGUL SYLLABLE NWAEG..HANGUL SYLLABLE NWAEH
	    0xB1CD <= code && code <= 0xB1E7 ||
	    // Lo  [27] HANGUL SYLLABLE NOEG..HANGUL SYLLABLE NOEH
	    0xB1E9 <= code && code <= 0xB203 ||
	    // Lo  [27] HANGUL SYLLABLE NYOG..HANGUL SYLLABLE NYOH
	    0xB205 <= code && code <= 0xB21F ||
	    // Lo  [27] HANGUL SYLLABLE NUG..HANGUL SYLLABLE NUH
	    0xB221 <= code && code <= 0xB23B ||
	    // Lo  [27] HANGUL SYLLABLE NWEOG..HANGUL SYLLABLE NWEOH
	    0xB23D <= code && code <= 0xB257 ||
	    // Lo  [27] HANGUL SYLLABLE NWEG..HANGUL SYLLABLE NWEH
	    0xB259 <= code && code <= 0xB273 ||
	    // Lo  [27] HANGUL SYLLABLE NWIG..HANGUL SYLLABLE NWIH
	    0xB275 <= code && code <= 0xB28F ||
	    // Lo  [27] HANGUL SYLLABLE NYUG..HANGUL SYLLABLE NYUH
	    0xB291 <= code && code <= 0xB2AB ||
	    // Lo  [27] HANGUL SYLLABLE NEUG..HANGUL SYLLABLE NEUH
	    0xB2AD <= code && code <= 0xB2C7 ||
	    // Lo  [27] HANGUL SYLLABLE NYIG..HANGUL SYLLABLE NYIH
	    0xB2C9 <= code && code <= 0xB2E3 ||
	    // Lo  [27] HANGUL SYLLABLE NIG..HANGUL SYLLABLE NIH
	    0xB2E5 <= code && code <= 0xB2FF ||
	    // Lo  [27] HANGUL SYLLABLE DAG..HANGUL SYLLABLE DAH
	    0xB301 <= code && code <= 0xB31B ||
	    // Lo  [27] HANGUL SYLLABLE DAEG..HANGUL SYLLABLE DAEH
	    0xB31D <= code && code <= 0xB337 ||
	    // Lo  [27] HANGUL SYLLABLE DYAG..HANGUL SYLLABLE DYAH
	    0xB339 <= code && code <= 0xB353 ||
	    // Lo  [27] HANGUL SYLLABLE DYAEG..HANGUL SYLLABLE DYAEH
	    0xB355 <= code && code <= 0xB36F ||
	    // Lo  [27] HANGUL SYLLABLE DEOG..HANGUL SYLLABLE DEOH
	    0xB371 <= code && code <= 0xB38B ||
	    // Lo  [27] HANGUL SYLLABLE DEG..HANGUL SYLLABLE DEH
	    0xB38D <= code && code <= 0xB3A7 ||
	    // Lo  [27] HANGUL SYLLABLE DYEOG..HANGUL SYLLABLE DYEOH
	    0xB3A9 <= code && code <= 0xB3C3 ||
	    // Lo  [27] HANGUL SYLLABLE DYEG..HANGUL SYLLABLE DYEH
	    0xB3C5 <= code && code <= 0xB3DF ||
	    // Lo  [27] HANGUL SYLLABLE DOG..HANGUL SYLLABLE DOH
	    0xB3E1 <= code && code <= 0xB3FB ||
	    // Lo  [27] HANGUL SYLLABLE DWAG..HANGUL SYLLABLE DWAH
	    0xB3FD <= code && code <= 0xB417 ||
	    // Lo  [27] HANGUL SYLLABLE DWAEG..HANGUL SYLLABLE DWAEH
	    0xB419 <= code && code <= 0xB433 ||
	    // Lo  [27] HANGUL SYLLABLE DOEG..HANGUL SYLLABLE DOEH
	    0xB435 <= code && code <= 0xB44F ||
	    // Lo  [27] HANGUL SYLLABLE DYOG..HANGUL SYLLABLE DYOH
	    0xB451 <= code && code <= 0xB46B ||
	    // Lo  [27] HANGUL SYLLABLE DUG..HANGUL SYLLABLE DUH
	    0xB46D <= code && code <= 0xB487 ||
	    // Lo  [27] HANGUL SYLLABLE DWEOG..HANGUL SYLLABLE DWEOH
	    0xB489 <= code && code <= 0xB4A3 ||
	    // Lo  [27] HANGUL SYLLABLE DWEG..HANGUL SYLLABLE DWEH
	    0xB4A5 <= code && code <= 0xB4BF ||
	    // Lo  [27] HANGUL SYLLABLE DWIG..HANGUL SYLLABLE DWIH
	    0xB4C1 <= code && code <= 0xB4DB ||
	    // Lo  [27] HANGUL SYLLABLE DYUG..HANGUL SYLLABLE DYUH
	    0xB4DD <= code && code <= 0xB4F7 ||
	    // Lo  [27] HANGUL SYLLABLE DEUG..HANGUL SYLLABLE DEUH
	    0xB4F9 <= code && code <= 0xB513 ||
	    // Lo  [27] HANGUL SYLLABLE DYIG..HANGUL SYLLABLE DYIH
	    0xB515 <= code && code <= 0xB52F ||
	    // Lo  [27] HANGUL SYLLABLE DIG..HANGUL SYLLABLE DIH
	    0xB531 <= code && code <= 0xB54B ||
	    // Lo  [27] HANGUL SYLLABLE DDAG..HANGUL SYLLABLE DDAH
	    0xB54D <= code && code <= 0xB567 ||
	    // Lo  [27] HANGUL SYLLABLE DDAEG..HANGUL SYLLABLE DDAEH
	    0xB569 <= code && code <= 0xB583 ||
	    // Lo  [27] HANGUL SYLLABLE DDYAG..HANGUL SYLLABLE DDYAH
	    0xB585 <= code && code <= 0xB59F ||
	    // Lo  [27] HANGUL SYLLABLE DDYAEG..HANGUL SYLLABLE DDYAEH
	    0xB5A1 <= code && code <= 0xB5BB ||
	    // Lo  [27] HANGUL SYLLABLE DDEOG..HANGUL SYLLABLE DDEOH
	    0xB5BD <= code && code <= 0xB5D7 ||
	    // Lo  [27] HANGUL SYLLABLE DDEG..HANGUL SYLLABLE DDEH
	    0xB5D9 <= code && code <= 0xB5F3 ||
	    // Lo  [27] HANGUL SYLLABLE DDYEOG..HANGUL SYLLABLE DDYEOH
	    0xB5F5 <= code && code <= 0xB60F ||
	    // Lo  [27] HANGUL SYLLABLE DDYEG..HANGUL SYLLABLE DDYEH
	    0xB611 <= code && code <= 0xB62B ||
	    // Lo  [27] HANGUL SYLLABLE DDOG..HANGUL SYLLABLE DDOH
	    0xB62D <= code && code <= 0xB647 ||
	    // Lo  [27] HANGUL SYLLABLE DDWAG..HANGUL SYLLABLE DDWAH
	    0xB649 <= code && code <= 0xB663 ||
	    // Lo  [27] HANGUL SYLLABLE DDWAEG..HANGUL SYLLABLE DDWAEH
	    0xB665 <= code && code <= 0xB67F ||
	    // Lo  [27] HANGUL SYLLABLE DDOEG..HANGUL SYLLABLE DDOEH
	    0xB681 <= code && code <= 0xB69B ||
	    // Lo  [27] HANGUL SYLLABLE DDYOG..HANGUL SYLLABLE DDYOH
	    0xB69D <= code && code <= 0xB6B7 ||
	    // Lo  [27] HANGUL SYLLABLE DDUG..HANGUL SYLLABLE DDUH
	    0xB6B9 <= code && code <= 0xB6D3 ||
	    // Lo  [27] HANGUL SYLLABLE DDWEOG..HANGUL SYLLABLE DDWEOH
	    0xB6D5 <= code && code <= 0xB6EF ||
	    // Lo  [27] HANGUL SYLLABLE DDWEG..HANGUL SYLLABLE DDWEH
	    0xB6F1 <= code && code <= 0xB70B ||
	    // Lo  [27] HANGUL SYLLABLE DDWIG..HANGUL SYLLABLE DDWIH
	    0xB70D <= code && code <= 0xB727 ||
	    // Lo  [27] HANGUL SYLLABLE DDYUG..HANGUL SYLLABLE DDYUH
	    0xB729 <= code && code <= 0xB743 ||
	    // Lo  [27] HANGUL SYLLABLE DDEUG..HANGUL SYLLABLE DDEUH
	    0xB745 <= code && code <= 0xB75F ||
	    // Lo  [27] HANGUL SYLLABLE DDYIG..HANGUL SYLLABLE DDYIH
	    0xB761 <= code && code <= 0xB77B ||
	    // Lo  [27] HANGUL SYLLABLE DDIG..HANGUL SYLLABLE DDIH
	    0xB77D <= code && code <= 0xB797 ||
	    // Lo  [27] HANGUL SYLLABLE RAG..HANGUL SYLLABLE RAH
	    0xB799 <= code && code <= 0xB7B3 ||
	    // Lo  [27] HANGUL SYLLABLE RAEG..HANGUL SYLLABLE RAEH
	    0xB7B5 <= code && code <= 0xB7CF ||
	    // Lo  [27] HANGUL SYLLABLE RYAG..HANGUL SYLLABLE RYAH
	    0xB7D1 <= code && code <= 0xB7EB ||
	    // Lo  [27] HANGUL SYLLABLE RYAEG..HANGUL SYLLABLE RYAEH
	    0xB7ED <= code && code <= 0xB807 ||
	    // Lo  [27] HANGUL SYLLABLE REOG..HANGUL SYLLABLE REOH
	    0xB809 <= code && code <= 0xB823 ||
	    // Lo  [27] HANGUL SYLLABLE REG..HANGUL SYLLABLE REH
	    0xB825 <= code && code <= 0xB83F ||
	    // Lo  [27] HANGUL SYLLABLE RYEOG..HANGUL SYLLABLE RYEOH
	    0xB841 <= code && code <= 0xB85B ||
	    // Lo  [27] HANGUL SYLLABLE RYEG..HANGUL SYLLABLE RYEH
	    0xB85D <= code && code <= 0xB877 ||
	    // Lo  [27] HANGUL SYLLABLE ROG..HANGUL SYLLABLE ROH
	    0xB879 <= code && code <= 0xB893 ||
	    // Lo  [27] HANGUL SYLLABLE RWAG..HANGUL SYLLABLE RWAH
	    0xB895 <= code && code <= 0xB8AF ||
	    // Lo  [27] HANGUL SYLLABLE RWAEG..HANGUL SYLLABLE RWAEH
	    0xB8B1 <= code && code <= 0xB8CB ||
	    // Lo  [27] HANGUL SYLLABLE ROEG..HANGUL SYLLABLE ROEH
	    0xB8CD <= code && code <= 0xB8E7 ||
	    // Lo  [27] HANGUL SYLLABLE RYOG..HANGUL SYLLABLE RYOH
	    0xB8E9 <= code && code <= 0xB903 ||
	    // Lo  [27] HANGUL SYLLABLE RUG..HANGUL SYLLABLE RUH
	    0xB905 <= code && code <= 0xB91F ||
	    // Lo  [27] HANGUL SYLLABLE RWEOG..HANGUL SYLLABLE RWEOH
	    0xB921 <= code && code <= 0xB93B ||
	    // Lo  [27] HANGUL SYLLABLE RWEG..HANGUL SYLLABLE RWEH
	    0xB93D <= code && code <= 0xB957 ||
	    // Lo  [27] HANGUL SYLLABLE RWIG..HANGUL SYLLABLE RWIH
	    0xB959 <= code && code <= 0xB973 ||
	    // Lo  [27] HANGUL SYLLABLE RYUG..HANGUL SYLLABLE RYUH
	    0xB975 <= code && code <= 0xB98F ||
	    // Lo  [27] HANGUL SYLLABLE REUG..HANGUL SYLLABLE REUH
	    0xB991 <= code && code <= 0xB9AB ||
	    // Lo  [27] HANGUL SYLLABLE RYIG..HANGUL SYLLABLE RYIH
	    0xB9AD <= code && code <= 0xB9C7 ||
	    // Lo  [27] HANGUL SYLLABLE RIG..HANGUL SYLLABLE RIH
	    0xB9C9 <= code && code <= 0xB9E3 ||
	    // Lo  [27] HANGUL SYLLABLE MAG..HANGUL SYLLABLE MAH
	    0xB9E5 <= code && code <= 0xB9FF ||
	    // Lo  [27] HANGUL SYLLABLE MAEG..HANGUL SYLLABLE MAEH
	    0xBA01 <= code && code <= 0xBA1B ||
	    // Lo  [27] HANGUL SYLLABLE MYAG..HANGUL SYLLABLE MYAH
	    0xBA1D <= code && code <= 0xBA37 ||
	    // Lo  [27] HANGUL SYLLABLE MYAEG..HANGUL SYLLABLE MYAEH
	    0xBA39 <= code && code <= 0xBA53 ||
	    // Lo  [27] HANGUL SYLLABLE MEOG..HANGUL SYLLABLE MEOH
	    0xBA55 <= code && code <= 0xBA6F ||
	    // Lo  [27] HANGUL SYLLABLE MEG..HANGUL SYLLABLE MEH
	    0xBA71 <= code && code <= 0xBA8B ||
	    // Lo  [27] HANGUL SYLLABLE MYEOG..HANGUL SYLLABLE MYEOH
	    0xBA8D <= code && code <= 0xBAA7 ||
	    // Lo  [27] HANGUL SYLLABLE MYEG..HANGUL SYLLABLE MYEH
	    0xBAA9 <= code && code <= 0xBAC3 ||
	    // Lo  [27] HANGUL SYLLABLE MOG..HANGUL SYLLABLE MOH
	    0xBAC5 <= code && code <= 0xBADF ||
	    // Lo  [27] HANGUL SYLLABLE MWAG..HANGUL SYLLABLE MWAH
	    0xBAE1 <= code && code <= 0xBAFB ||
	    // Lo  [27] HANGUL SYLLABLE MWAEG..HANGUL SYLLABLE MWAEH
	    0xBAFD <= code && code <= 0xBB17 ||
	    // Lo  [27] HANGUL SYLLABLE MOEG..HANGUL SYLLABLE MOEH
	    0xBB19 <= code && code <= 0xBB33 ||
	    // Lo  [27] HANGUL SYLLABLE MYOG..HANGUL SYLLABLE MYOH
	    0xBB35 <= code && code <= 0xBB4F ||
	    // Lo  [27] HANGUL SYLLABLE MUG..HANGUL SYLLABLE MUH
	    0xBB51 <= code && code <= 0xBB6B ||
	    // Lo  [27] HANGUL SYLLABLE MWEOG..HANGUL SYLLABLE MWEOH
	    0xBB6D <= code && code <= 0xBB87 ||
	    // Lo  [27] HANGUL SYLLABLE MWEG..HANGUL SYLLABLE MWEH
	    0xBB89 <= code && code <= 0xBBA3 ||
	    // Lo  [27] HANGUL SYLLABLE MWIG..HANGUL SYLLABLE MWIH
	    0xBBA5 <= code && code <= 0xBBBF ||
	    // Lo  [27] HANGUL SYLLABLE MYUG..HANGUL SYLLABLE MYUH
	    0xBBC1 <= code && code <= 0xBBDB ||
	    // Lo  [27] HANGUL SYLLABLE MEUG..HANGUL SYLLABLE MEUH
	    0xBBDD <= code && code <= 0xBBF7 ||
	    // Lo  [27] HANGUL SYLLABLE MYIG..HANGUL SYLLABLE MYIH
	    0xBBF9 <= code && code <= 0xBC13 ||
	    // Lo  [27] HANGUL SYLLABLE MIG..HANGUL SYLLABLE MIH
	    0xBC15 <= code && code <= 0xBC2F ||
	    // Lo  [27] HANGUL SYLLABLE BAG..HANGUL SYLLABLE BAH
	    0xBC31 <= code && code <= 0xBC4B ||
	    // Lo  [27] HANGUL SYLLABLE BAEG..HANGUL SYLLABLE BAEH
	    0xBC4D <= code && code <= 0xBC67 ||
	    // Lo  [27] HANGUL SYLLABLE BYAG..HANGUL SYLLABLE BYAH
	    0xBC69 <= code && code <= 0xBC83 ||
	    // Lo  [27] HANGUL SYLLABLE BYAEG..HANGUL SYLLABLE BYAEH
	    0xBC85 <= code && code <= 0xBC9F ||
	    // Lo  [27] HANGUL SYLLABLE BEOG..HANGUL SYLLABLE BEOH
	    0xBCA1 <= code && code <= 0xBCBB ||
	    // Lo  [27] HANGUL SYLLABLE BEG..HANGUL SYLLABLE BEH
	    0xBCBD <= code && code <= 0xBCD7 ||
	    // Lo  [27] HANGUL SYLLABLE BYEOG..HANGUL SYLLABLE BYEOH
	    0xBCD9 <= code && code <= 0xBCF3 ||
	    // Lo  [27] HANGUL SYLLABLE BYEG..HANGUL SYLLABLE BYEH
	    0xBCF5 <= code && code <= 0xBD0F ||
	    // Lo  [27] HANGUL SYLLABLE BOG..HANGUL SYLLABLE BOH
	    0xBD11 <= code && code <= 0xBD2B ||
	    // Lo  [27] HANGUL SYLLABLE BWAG..HANGUL SYLLABLE BWAH
	    0xBD2D <= code && code <= 0xBD47 ||
	    // Lo  [27] HANGUL SYLLABLE BWAEG..HANGUL SYLLABLE BWAEH
	    0xBD49 <= code && code <= 0xBD63 ||
	    // Lo  [27] HANGUL SYLLABLE BOEG..HANGUL SYLLABLE BOEH
	    0xBD65 <= code && code <= 0xBD7F ||
	    // Lo  [27] HANGUL SYLLABLE BYOG..HANGUL SYLLABLE BYOH
	    0xBD81 <= code && code <= 0xBD9B ||
	    // Lo  [27] HANGUL SYLLABLE BUG..HANGUL SYLLABLE BUH
	    0xBD9D <= code && code <= 0xBDB7 ||
	    // Lo  [27] HANGUL SYLLABLE BWEOG..HANGUL SYLLABLE BWEOH
	    0xBDB9 <= code && code <= 0xBDD3 ||
	    // Lo  [27] HANGUL SYLLABLE BWEG..HANGUL SYLLABLE BWEH
	    0xBDD5 <= code && code <= 0xBDEF ||
	    // Lo  [27] HANGUL SYLLABLE BWIG..HANGUL SYLLABLE BWIH
	    0xBDF1 <= code && code <= 0xBE0B ||
	    // Lo  [27] HANGUL SYLLABLE BYUG..HANGUL SYLLABLE BYUH
	    0xBE0D <= code && code <= 0xBE27 ||
	    // Lo  [27] HANGUL SYLLABLE BEUG..HANGUL SYLLABLE BEUH
	    0xBE29 <= code && code <= 0xBE43 ||
	    // Lo  [27] HANGUL SYLLABLE BYIG..HANGUL SYLLABLE BYIH
	    0xBE45 <= code && code <= 0xBE5F ||
	    // Lo  [27] HANGUL SYLLABLE BIG..HANGUL SYLLABLE BIH
	    0xBE61 <= code && code <= 0xBE7B ||
	    // Lo  [27] HANGUL SYLLABLE BBAG..HANGUL SYLLABLE BBAH
	    0xBE7D <= code && code <= 0xBE97 ||
	    // Lo  [27] HANGUL SYLLABLE BBAEG..HANGUL SYLLABLE BBAEH
	    0xBE99 <= code && code <= 0xBEB3 ||
	    // Lo  [27] HANGUL SYLLABLE BBYAG..HANGUL SYLLABLE BBYAH
	    0xBEB5 <= code && code <= 0xBECF ||
	    // Lo  [27] HANGUL SYLLABLE BBYAEG..HANGUL SYLLABLE BBYAEH
	    0xBED1 <= code && code <= 0xBEEB ||
	    // Lo  [27] HANGUL SYLLABLE BBEOG..HANGUL SYLLABLE BBEOH
	    0xBEED <= code && code <= 0xBF07 ||
	    // Lo  [27] HANGUL SYLLABLE BBEG..HANGUL SYLLABLE BBEH
	    0xBF09 <= code && code <= 0xBF23 ||
	    // Lo  [27] HANGUL SYLLABLE BBYEOG..HANGUL SYLLABLE BBYEOH
	    0xBF25 <= code && code <= 0xBF3F ||
	    // Lo  [27] HANGUL SYLLABLE BBYEG..HANGUL SYLLABLE BBYEH
	    0xBF41 <= code && code <= 0xBF5B ||
	    // Lo  [27] HANGUL SYLLABLE BBOG..HANGUL SYLLABLE BBOH
	    0xBF5D <= code && code <= 0xBF77 ||
	    // Lo  [27] HANGUL SYLLABLE BBWAG..HANGUL SYLLABLE BBWAH
	    0xBF79 <= code && code <= 0xBF93 ||
	    // Lo  [27] HANGUL SYLLABLE BBWAEG..HANGUL SYLLABLE BBWAEH
	    0xBF95 <= code && code <= 0xBFAF ||
	    // Lo  [27] HANGUL SYLLABLE BBOEG..HANGUL SYLLABLE BBOEH
	    0xBFB1 <= code && code <= 0xBFCB ||
	    // Lo  [27] HANGUL SYLLABLE BBYOG..HANGUL SYLLABLE BBYOH
	    0xBFCD <= code && code <= 0xBFE7 ||
	    // Lo  [27] HANGUL SYLLABLE BBUG..HANGUL SYLLABLE BBUH
	    0xBFE9 <= code && code <= 0xC003 ||
	    // Lo  [27] HANGUL SYLLABLE BBWEOG..HANGUL SYLLABLE BBWEOH
	    0xC005 <= code && code <= 0xC01F ||
	    // Lo  [27] HANGUL SYLLABLE BBWEG..HANGUL SYLLABLE BBWEH
	    0xC021 <= code && code <= 0xC03B ||
	    // Lo  [27] HANGUL SYLLABLE BBWIG..HANGUL SYLLABLE BBWIH
	    0xC03D <= code && code <= 0xC057 ||
	    // Lo  [27] HANGUL SYLLABLE BBYUG..HANGUL SYLLABLE BBYUH
	    0xC059 <= code && code <= 0xC073 ||
	    // Lo  [27] HANGUL SYLLABLE BBEUG..HANGUL SYLLABLE BBEUH
	    0xC075 <= code && code <= 0xC08F ||
	    // Lo  [27] HANGUL SYLLABLE BBYIG..HANGUL SYLLABLE BBYIH
	    0xC091 <= code && code <= 0xC0AB ||
	    // Lo  [27] HANGUL SYLLABLE BBIG..HANGUL SYLLABLE BBIH
	    0xC0AD <= code && code <= 0xC0C7 ||
	    // Lo  [27] HANGUL SYLLABLE SAG..HANGUL SYLLABLE SAH
	    0xC0C9 <= code && code <= 0xC0E3 ||
	    // Lo  [27] HANGUL SYLLABLE SAEG..HANGUL SYLLABLE SAEH
	    0xC0E5 <= code && code <= 0xC0FF ||
	    // Lo  [27] HANGUL SYLLABLE SYAG..HANGUL SYLLABLE SYAH
	    0xC101 <= code && code <= 0xC11B ||
	    // Lo  [27] HANGUL SYLLABLE SYAEG..HANGUL SYLLABLE SYAEH
	    0xC11D <= code && code <= 0xC137 ||
	    // Lo  [27] HANGUL SYLLABLE SEOG..HANGUL SYLLABLE SEOH
	    0xC139 <= code && code <= 0xC153 ||
	    // Lo  [27] HANGUL SYLLABLE SEG..HANGUL SYLLABLE SEH
	    0xC155 <= code && code <= 0xC16F ||
	    // Lo  [27] HANGUL SYLLABLE SYEOG..HANGUL SYLLABLE SYEOH
	    0xC171 <= code && code <= 0xC18B ||
	    // Lo  [27] HANGUL SYLLABLE SYEG..HANGUL SYLLABLE SYEH
	    0xC18D <= code && code <= 0xC1A7 ||
	    // Lo  [27] HANGUL SYLLABLE SOG..HANGUL SYLLABLE SOH
	    0xC1A9 <= code && code <= 0xC1C3 ||
	    // Lo  [27] HANGUL SYLLABLE SWAG..HANGUL SYLLABLE SWAH
	    0xC1C5 <= code && code <= 0xC1DF ||
	    // Lo  [27] HANGUL SYLLABLE SWAEG..HANGUL SYLLABLE SWAEH
	    0xC1E1 <= code && code <= 0xC1FB ||
	    // Lo  [27] HANGUL SYLLABLE SOEG..HANGUL SYLLABLE SOEH
	    0xC1FD <= code && code <= 0xC217 ||
	    // Lo  [27] HANGUL SYLLABLE SYOG..HANGUL SYLLABLE SYOH
	    0xC219 <= code && code <= 0xC233 ||
	    // Lo  [27] HANGUL SYLLABLE SUG..HANGUL SYLLABLE SUH
	    0xC235 <= code && code <= 0xC24F ||
	    // Lo  [27] HANGUL SYLLABLE SWEOG..HANGUL SYLLABLE SWEOH
	    0xC251 <= code && code <= 0xC26B ||
	    // Lo  [27] HANGUL SYLLABLE SWEG..HANGUL SYLLABLE SWEH
	    0xC26D <= code && code <= 0xC287 ||
	    // Lo  [27] HANGUL SYLLABLE SWIG..HANGUL SYLLABLE SWIH
	    0xC289 <= code && code <= 0xC2A3 ||
	    // Lo  [27] HANGUL SYLLABLE SYUG..HANGUL SYLLABLE SYUH
	    0xC2A5 <= code && code <= 0xC2BF ||
	    // Lo  [27] HANGUL SYLLABLE SEUG..HANGUL SYLLABLE SEUH
	    0xC2C1 <= code && code <= 0xC2DB ||
	    // Lo  [27] HANGUL SYLLABLE SYIG..HANGUL SYLLABLE SYIH
	    0xC2DD <= code && code <= 0xC2F7 ||
	    // Lo  [27] HANGUL SYLLABLE SIG..HANGUL SYLLABLE SIH
	    0xC2F9 <= code && code <= 0xC313 ||
	    // Lo  [27] HANGUL SYLLABLE SSAG..HANGUL SYLLABLE SSAH
	    0xC315 <= code && code <= 0xC32F ||
	    // Lo  [27] HANGUL SYLLABLE SSAEG..HANGUL SYLLABLE SSAEH
	    0xC331 <= code && code <= 0xC34B ||
	    // Lo  [27] HANGUL SYLLABLE SSYAG..HANGUL SYLLABLE SSYAH
	    0xC34D <= code && code <= 0xC367 ||
	    // Lo  [27] HANGUL SYLLABLE SSYAEG..HANGUL SYLLABLE SSYAEH
	    0xC369 <= code && code <= 0xC383 ||
	    // Lo  [27] HANGUL SYLLABLE SSEOG..HANGUL SYLLABLE SSEOH
	    0xC385 <= code && code <= 0xC39F ||
	    // Lo  [27] HANGUL SYLLABLE SSEG..HANGUL SYLLABLE SSEH
	    0xC3A1 <= code && code <= 0xC3BB ||
	    // Lo  [27] HANGUL SYLLABLE SSYEOG..HANGUL SYLLABLE SSYEOH
	    0xC3BD <= code && code <= 0xC3D7 ||
	    // Lo  [27] HANGUL SYLLABLE SSYEG..HANGUL SYLLABLE SSYEH
	    0xC3D9 <= code && code <= 0xC3F3 ||
	    // Lo  [27] HANGUL SYLLABLE SSOG..HANGUL SYLLABLE SSOH
	    0xC3F5 <= code && code <= 0xC40F ||
	    // Lo  [27] HANGUL SYLLABLE SSWAG..HANGUL SYLLABLE SSWAH
	    0xC411 <= code && code <= 0xC42B ||
	    // Lo  [27] HANGUL SYLLABLE SSWAEG..HANGUL SYLLABLE SSWAEH
	    0xC42D <= code && code <= 0xC447 ||
	    // Lo  [27] HANGUL SYLLABLE SSOEG..HANGUL SYLLABLE SSOEH
	    0xC449 <= code && code <= 0xC463 ||
	    // Lo  [27] HANGUL SYLLABLE SSYOG..HANGUL SYLLABLE SSYOH
	    0xC465 <= code && code <= 0xC47F ||
	    // Lo  [27] HANGUL SYLLABLE SSUG..HANGUL SYLLABLE SSUH
	    0xC481 <= code && code <= 0xC49B ||
	    // Lo  [27] HANGUL SYLLABLE SSWEOG..HANGUL SYLLABLE SSWEOH
	    0xC49D <= code && code <= 0xC4B7 ||
	    // Lo  [27] HANGUL SYLLABLE SSWEG..HANGUL SYLLABLE SSWEH
	    0xC4B9 <= code && code <= 0xC4D3 ||
	    // Lo  [27] HANGUL SYLLABLE SSWIG..HANGUL SYLLABLE SSWIH
	    0xC4D5 <= code && code <= 0xC4EF ||
	    // Lo  [27] HANGUL SYLLABLE SSYUG..HANGUL SYLLABLE SSYUH
	    0xC4F1 <= code && code <= 0xC50B ||
	    // Lo  [27] HANGUL SYLLABLE SSEUG..HANGUL SYLLABLE SSEUH
	    0xC50D <= code && code <= 0xC527 ||
	    // Lo  [27] HANGUL SYLLABLE SSYIG..HANGUL SYLLABLE SSYIH
	    0xC529 <= code && code <= 0xC543 ||
	    // Lo  [27] HANGUL SYLLABLE SSIG..HANGUL SYLLABLE SSIH
	    0xC545 <= code && code <= 0xC55F ||
	    // Lo  [27] HANGUL SYLLABLE AG..HANGUL SYLLABLE AH
	    0xC561 <= code && code <= 0xC57B ||
	    // Lo  [27] HANGUL SYLLABLE AEG..HANGUL SYLLABLE AEH
	    0xC57D <= code && code <= 0xC597 ||
	    // Lo  [27] HANGUL SYLLABLE YAG..HANGUL SYLLABLE YAH
	    0xC599 <= code && code <= 0xC5B3 ||
	    // Lo  [27] HANGUL SYLLABLE YAEG..HANGUL SYLLABLE YAEH
	    0xC5B5 <= code && code <= 0xC5CF ||
	    // Lo  [27] HANGUL SYLLABLE EOG..HANGUL SYLLABLE EOH
	    0xC5D1 <= code && code <= 0xC5EB ||
	    // Lo  [27] HANGUL SYLLABLE EG..HANGUL SYLLABLE EH
	    0xC5ED <= code && code <= 0xC607 ||
	    // Lo  [27] HANGUL SYLLABLE YEOG..HANGUL SYLLABLE YEOH
	    0xC609 <= code && code <= 0xC623 ||
	    // Lo  [27] HANGUL SYLLABLE YEG..HANGUL SYLLABLE YEH
	    0xC625 <= code && code <= 0xC63F ||
	    // Lo  [27] HANGUL SYLLABLE OG..HANGUL SYLLABLE OH
	    0xC641 <= code && code <= 0xC65B ||
	    // Lo  [27] HANGUL SYLLABLE WAG..HANGUL SYLLABLE WAH
	    0xC65D <= code && code <= 0xC677 ||
	    // Lo  [27] HANGUL SYLLABLE WAEG..HANGUL SYLLABLE WAEH
	    0xC679 <= code && code <= 0xC693 ||
	    // Lo  [27] HANGUL SYLLABLE OEG..HANGUL SYLLABLE OEH
	    0xC695 <= code && code <= 0xC6AF ||
	    // Lo  [27] HANGUL SYLLABLE YOG..HANGUL SYLLABLE YOH
	    0xC6B1 <= code && code <= 0xC6CB ||
	    // Lo  [27] HANGUL SYLLABLE UG..HANGUL SYLLABLE UH
	    0xC6CD <= code && code <= 0xC6E7 ||
	    // Lo  [27] HANGUL SYLLABLE WEOG..HANGUL SYLLABLE WEOH
	    0xC6E9 <= code && code <= 0xC703 ||
	    // Lo  [27] HANGUL SYLLABLE WEG..HANGUL SYLLABLE WEH
	    0xC705 <= code && code <= 0xC71F ||
	    // Lo  [27] HANGUL SYLLABLE WIG..HANGUL SYLLABLE WIH
	    0xC721 <= code && code <= 0xC73B ||
	    // Lo  [27] HANGUL SYLLABLE YUG..HANGUL SYLLABLE YUH
	    0xC73D <= code && code <= 0xC757 ||
	    // Lo  [27] HANGUL SYLLABLE EUG..HANGUL SYLLABLE EUH
	    0xC759 <= code && code <= 0xC773 ||
	    // Lo  [27] HANGUL SYLLABLE YIG..HANGUL SYLLABLE YIH
	    0xC775 <= code && code <= 0xC78F ||
	    // Lo  [27] HANGUL SYLLABLE IG..HANGUL SYLLABLE IH
	    0xC791 <= code && code <= 0xC7AB ||
	    // Lo  [27] HANGUL SYLLABLE JAG..HANGUL SYLLABLE JAH
	    0xC7AD <= code && code <= 0xC7C7 ||
	    // Lo  [27] HANGUL SYLLABLE JAEG..HANGUL SYLLABLE JAEH
	    0xC7C9 <= code && code <= 0xC7E3 ||
	    // Lo  [27] HANGUL SYLLABLE JYAG..HANGUL SYLLABLE JYAH
	    0xC7E5 <= code && code <= 0xC7FF ||
	    // Lo  [27] HANGUL SYLLABLE JYAEG..HANGUL SYLLABLE JYAEH
	    0xC801 <= code && code <= 0xC81B ||
	    // Lo  [27] HANGUL SYLLABLE JEOG..HANGUL SYLLABLE JEOH
	    0xC81D <= code && code <= 0xC837 ||
	    // Lo  [27] HANGUL SYLLABLE JEG..HANGUL SYLLABLE JEH
	    0xC839 <= code && code <= 0xC853 ||
	    // Lo  [27] HANGUL SYLLABLE JYEOG..HANGUL SYLLABLE JYEOH
	    0xC855 <= code && code <= 0xC86F ||
	    // Lo  [27] HANGUL SYLLABLE JYEG..HANGUL SYLLABLE JYEH
	    0xC871 <= code && code <= 0xC88B ||
	    // Lo  [27] HANGUL SYLLABLE JOG..HANGUL SYLLABLE JOH
	    0xC88D <= code && code <= 0xC8A7 ||
	    // Lo  [27] HANGUL SYLLABLE JWAG..HANGUL SYLLABLE JWAH
	    0xC8A9 <= code && code <= 0xC8C3 ||
	    // Lo  [27] HANGUL SYLLABLE JWAEG..HANGUL SYLLABLE JWAEH
	    0xC8C5 <= code && code <= 0xC8DF ||
	    // Lo  [27] HANGUL SYLLABLE JOEG..HANGUL SYLLABLE JOEH
	    0xC8E1 <= code && code <= 0xC8FB ||
	    // Lo  [27] HANGUL SYLLABLE JYOG..HANGUL SYLLABLE JYOH
	    0xC8FD <= code && code <= 0xC917 ||
	    // Lo  [27] HANGUL SYLLABLE JUG..HANGUL SYLLABLE JUH
	    0xC919 <= code && code <= 0xC933 ||
	    // Lo  [27] HANGUL SYLLABLE JWEOG..HANGUL SYLLABLE JWEOH
	    0xC935 <= code && code <= 0xC94F ||
	    // Lo  [27] HANGUL SYLLABLE JWEG..HANGUL SYLLABLE JWEH
	    0xC951 <= code && code <= 0xC96B ||
	    // Lo  [27] HANGUL SYLLABLE JWIG..HANGUL SYLLABLE JWIH
	    0xC96D <= code && code <= 0xC987 ||
	    // Lo  [27] HANGUL SYLLABLE JYUG..HANGUL SYLLABLE JYUH
	    0xC989 <= code && code <= 0xC9A3 ||
	    // Lo  [27] HANGUL SYLLABLE JEUG..HANGUL SYLLABLE JEUH
	    0xC9A5 <= code && code <= 0xC9BF ||
	    // Lo  [27] HANGUL SYLLABLE JYIG..HANGUL SYLLABLE JYIH
	    0xC9C1 <= code && code <= 0xC9DB ||
	    // Lo  [27] HANGUL SYLLABLE JIG..HANGUL SYLLABLE JIH
	    0xC9DD <= code && code <= 0xC9F7 ||
	    // Lo  [27] HANGUL SYLLABLE JJAG..HANGUL SYLLABLE JJAH
	    0xC9F9 <= code && code <= 0xCA13 ||
	    // Lo  [27] HANGUL SYLLABLE JJAEG..HANGUL SYLLABLE JJAEH
	    0xCA15 <= code && code <= 0xCA2F ||
	    // Lo  [27] HANGUL SYLLABLE JJYAG..HANGUL SYLLABLE JJYAH
	    0xCA31 <= code && code <= 0xCA4B ||
	    // Lo  [27] HANGUL SYLLABLE JJYAEG..HANGUL SYLLABLE JJYAEH
	    0xCA4D <= code && code <= 0xCA67 ||
	    // Lo  [27] HANGUL SYLLABLE JJEOG..HANGUL SYLLABLE JJEOH
	    0xCA69 <= code && code <= 0xCA83 ||
	    // Lo  [27] HANGUL SYLLABLE JJEG..HANGUL SYLLABLE JJEH
	    0xCA85 <= code && code <= 0xCA9F ||
	    // Lo  [27] HANGUL SYLLABLE JJYEOG..HANGUL SYLLABLE JJYEOH
	    0xCAA1 <= code && code <= 0xCABB ||
	    // Lo  [27] HANGUL SYLLABLE JJYEG..HANGUL SYLLABLE JJYEH
	    0xCABD <= code && code <= 0xCAD7 ||
	    // Lo  [27] HANGUL SYLLABLE JJOG..HANGUL SYLLABLE JJOH
	    0xCAD9 <= code && code <= 0xCAF3 ||
	    // Lo  [27] HANGUL SYLLABLE JJWAG..HANGUL SYLLABLE JJWAH
	    0xCAF5 <= code && code <= 0xCB0F ||
	    // Lo  [27] HANGUL SYLLABLE JJWAEG..HANGUL SYLLABLE JJWAEH
	    0xCB11 <= code && code <= 0xCB2B ||
	    // Lo  [27] HANGUL SYLLABLE JJOEG..HANGUL SYLLABLE JJOEH
	    0xCB2D <= code && code <= 0xCB47 ||
	    // Lo  [27] HANGUL SYLLABLE JJYOG..HANGUL SYLLABLE JJYOH
	    0xCB49 <= code && code <= 0xCB63 ||
	    // Lo  [27] HANGUL SYLLABLE JJUG..HANGUL SYLLABLE JJUH
	    0xCB65 <= code && code <= 0xCB7F ||
	    // Lo  [27] HANGUL SYLLABLE JJWEOG..HANGUL SYLLABLE JJWEOH
	    0xCB81 <= code && code <= 0xCB9B ||
	    // Lo  [27] HANGUL SYLLABLE JJWEG..HANGUL SYLLABLE JJWEH
	    0xCB9D <= code && code <= 0xCBB7 ||
	    // Lo  [27] HANGUL SYLLABLE JJWIG..HANGUL SYLLABLE JJWIH
	    0xCBB9 <= code && code <= 0xCBD3 ||
	    // Lo  [27] HANGUL SYLLABLE JJYUG..HANGUL SYLLABLE JJYUH
	    0xCBD5 <= code && code <= 0xCBEF ||
	    // Lo  [27] HANGUL SYLLABLE JJEUG..HANGUL SYLLABLE JJEUH
	    0xCBF1 <= code && code <= 0xCC0B ||
	    // Lo  [27] HANGUL SYLLABLE JJYIG..HANGUL SYLLABLE JJYIH
	    0xCC0D <= code && code <= 0xCC27 ||
	    // Lo  [27] HANGUL SYLLABLE JJIG..HANGUL SYLLABLE JJIH
	    0xCC29 <= code && code <= 0xCC43 ||
	    // Lo  [27] HANGUL SYLLABLE CAG..HANGUL SYLLABLE CAH
	    0xCC45 <= code && code <= 0xCC5F ||
	    // Lo  [27] HANGUL SYLLABLE CAEG..HANGUL SYLLABLE CAEH
	    0xCC61 <= code && code <= 0xCC7B ||
	    // Lo  [27] HANGUL SYLLABLE CYAG..HANGUL SYLLABLE CYAH
	    0xCC7D <= code && code <= 0xCC97 ||
	    // Lo  [27] HANGUL SYLLABLE CYAEG..HANGUL SYLLABLE CYAEH
	    0xCC99 <= code && code <= 0xCCB3 ||
	    // Lo  [27] HANGUL SYLLABLE CEOG..HANGUL SYLLABLE CEOH
	    0xCCB5 <= code && code <= 0xCCCF ||
	    // Lo  [27] HANGUL SYLLABLE CEG..HANGUL SYLLABLE CEH
	    0xCCD1 <= code && code <= 0xCCEB ||
	    // Lo  [27] HANGUL SYLLABLE CYEOG..HANGUL SYLLABLE CYEOH
	    0xCCED <= code && code <= 0xCD07 ||
	    // Lo  [27] HANGUL SYLLABLE CYEG..HANGUL SYLLABLE CYEH
	    0xCD09 <= code && code <= 0xCD23 ||
	    // Lo  [27] HANGUL SYLLABLE COG..HANGUL SYLLABLE COH
	    0xCD25 <= code && code <= 0xCD3F ||
	    // Lo  [27] HANGUL SYLLABLE CWAG..HANGUL SYLLABLE CWAH
	    0xCD41 <= code && code <= 0xCD5B ||
	    // Lo  [27] HANGUL SYLLABLE CWAEG..HANGUL SYLLABLE CWAEH
	    0xCD5D <= code && code <= 0xCD77 ||
	    // Lo  [27] HANGUL SYLLABLE COEG..HANGUL SYLLABLE COEH
	    0xCD79 <= code && code <= 0xCD93 ||
	    // Lo  [27] HANGUL SYLLABLE CYOG..HANGUL SYLLABLE CYOH
	    0xCD95 <= code && code <= 0xCDAF ||
	    // Lo  [27] HANGUL SYLLABLE CUG..HANGUL SYLLABLE CUH
	    0xCDB1 <= code && code <= 0xCDCB ||
	    // Lo  [27] HANGUL SYLLABLE CWEOG..HANGUL SYLLABLE CWEOH
	    0xCDCD <= code && code <= 0xCDE7 ||
	    // Lo  [27] HANGUL SYLLABLE CWEG..HANGUL SYLLABLE CWEH
	    0xCDE9 <= code && code <= 0xCE03 ||
	    // Lo  [27] HANGUL SYLLABLE CWIG..HANGUL SYLLABLE CWIH
	    0xCE05 <= code && code <= 0xCE1F ||
	    // Lo  [27] HANGUL SYLLABLE CYUG..HANGUL SYLLABLE CYUH
	    0xCE21 <= code && code <= 0xCE3B ||
	    // Lo  [27] HANGUL SYLLABLE CEUG..HANGUL SYLLABLE CEUH
	    0xCE3D <= code && code <= 0xCE57 ||
	    // Lo  [27] HANGUL SYLLABLE CYIG..HANGUL SYLLABLE CYIH
	    0xCE59 <= code && code <= 0xCE73 ||
	    // Lo  [27] HANGUL SYLLABLE CIG..HANGUL SYLLABLE CIH
	    0xCE75 <= code && code <= 0xCE8F ||
	    // Lo  [27] HANGUL SYLLABLE KAG..HANGUL SYLLABLE KAH
	    0xCE91 <= code && code <= 0xCEAB ||
	    // Lo  [27] HANGUL SYLLABLE KAEG..HANGUL SYLLABLE KAEH
	    0xCEAD <= code && code <= 0xCEC7 ||
	    // Lo  [27] HANGUL SYLLABLE KYAG..HANGUL SYLLABLE KYAH
	    0xCEC9 <= code && code <= 0xCEE3 ||
	    // Lo  [27] HANGUL SYLLABLE KYAEG..HANGUL SYLLABLE KYAEH
	    0xCEE5 <= code && code <= 0xCEFF ||
	    // Lo  [27] HANGUL SYLLABLE KEOG..HANGUL SYLLABLE KEOH
	    0xCF01 <= code && code <= 0xCF1B ||
	    // Lo  [27] HANGUL SYLLABLE KEG..HANGUL SYLLABLE KEH
	    0xCF1D <= code && code <= 0xCF37 ||
	    // Lo  [27] HANGUL SYLLABLE KYEOG..HANGUL SYLLABLE KYEOH
	    0xCF39 <= code && code <= 0xCF53 ||
	    // Lo  [27] HANGUL SYLLABLE KYEG..HANGUL SYLLABLE KYEH
	    0xCF55 <= code && code <= 0xCF6F ||
	    // Lo  [27] HANGUL SYLLABLE KOG..HANGUL SYLLABLE KOH
	    0xCF71 <= code && code <= 0xCF8B ||
	    // Lo  [27] HANGUL SYLLABLE KWAG..HANGUL SYLLABLE KWAH
	    0xCF8D <= code && code <= 0xCFA7 ||
	    // Lo  [27] HANGUL SYLLABLE KWAEG..HANGUL SYLLABLE KWAEH
	    0xCFA9 <= code && code <= 0xCFC3 ||
	    // Lo  [27] HANGUL SYLLABLE KOEG..HANGUL SYLLABLE KOEH
	    0xCFC5 <= code && code <= 0xCFDF ||
	    // Lo  [27] HANGUL SYLLABLE KYOG..HANGUL SYLLABLE KYOH
	    0xCFE1 <= code && code <= 0xCFFB ||
	    // Lo  [27] HANGUL SYLLABLE KUG..HANGUL SYLLABLE KUH
	    0xCFFD <= code && code <= 0xD017 ||
	    // Lo  [27] HANGUL SYLLABLE KWEOG..HANGUL SYLLABLE KWEOH
	    0xD019 <= code && code <= 0xD033 ||
	    // Lo  [27] HANGUL SYLLABLE KWEG..HANGUL SYLLABLE KWEH
	    0xD035 <= code && code <= 0xD04F ||
	    // Lo  [27] HANGUL SYLLABLE KWIG..HANGUL SYLLABLE KWIH
	    0xD051 <= code && code <= 0xD06B ||
	    // Lo  [27] HANGUL SYLLABLE KYUG..HANGUL SYLLABLE KYUH
	    0xD06D <= code && code <= 0xD087 ||
	    // Lo  [27] HANGUL SYLLABLE KEUG..HANGUL SYLLABLE KEUH
	    0xD089 <= code && code <= 0xD0A3 ||
	    // Lo  [27] HANGUL SYLLABLE KYIG..HANGUL SYLLABLE KYIH
	    0xD0A5 <= code && code <= 0xD0BF ||
	    // Lo  [27] HANGUL SYLLABLE KIG..HANGUL SYLLABLE KIH
	    0xD0C1 <= code && code <= 0xD0DB ||
	    // Lo  [27] HANGUL SYLLABLE TAG..HANGUL SYLLABLE TAH
	    0xD0DD <= code && code <= 0xD0F7 ||
	    // Lo  [27] HANGUL SYLLABLE TAEG..HANGUL SYLLABLE TAEH
	    0xD0F9 <= code && code <= 0xD113 ||
	    // Lo  [27] HANGUL SYLLABLE TYAG..HANGUL SYLLABLE TYAH
	    0xD115 <= code && code <= 0xD12F ||
	    // Lo  [27] HANGUL SYLLABLE TYAEG..HANGUL SYLLABLE TYAEH
	    0xD131 <= code && code <= 0xD14B ||
	    // Lo  [27] HANGUL SYLLABLE TEOG..HANGUL SYLLABLE TEOH
	    0xD14D <= code && code <= 0xD167 ||
	    // Lo  [27] HANGUL SYLLABLE TEG..HANGUL SYLLABLE TEH
	    0xD169 <= code && code <= 0xD183 ||
	    // Lo  [27] HANGUL SYLLABLE TYEOG..HANGUL SYLLABLE TYEOH
	    0xD185 <= code && code <= 0xD19F ||
	    // Lo  [27] HANGUL SYLLABLE TYEG..HANGUL SYLLABLE TYEH
	    0xD1A1 <= code && code <= 0xD1BB ||
	    // Lo  [27] HANGUL SYLLABLE TOG..HANGUL SYLLABLE TOH
	    0xD1BD <= code && code <= 0xD1D7 ||
	    // Lo  [27] HANGUL SYLLABLE TWAG..HANGUL SYLLABLE TWAH
	    0xD1D9 <= code && code <= 0xD1F3 ||
	    // Lo  [27] HANGUL SYLLABLE TWAEG..HANGUL SYLLABLE TWAEH
	    0xD1F5 <= code && code <= 0xD20F ||
	    // Lo  [27] HANGUL SYLLABLE TOEG..HANGUL SYLLABLE TOEH
	    0xD211 <= code && code <= 0xD22B ||
	    // Lo  [27] HANGUL SYLLABLE TYOG..HANGUL SYLLABLE TYOH
	    0xD22D <= code && code <= 0xD247 ||
	    // Lo  [27] HANGUL SYLLABLE TUG..HANGUL SYLLABLE TUH
	    0xD249 <= code && code <= 0xD263 ||
	    // Lo  [27] HANGUL SYLLABLE TWEOG..HANGUL SYLLABLE TWEOH
	    0xD265 <= code && code <= 0xD27F ||
	    // Lo  [27] HANGUL SYLLABLE TWEG..HANGUL SYLLABLE TWEH
	    0xD281 <= code && code <= 0xD29B ||
	    // Lo  [27] HANGUL SYLLABLE TWIG..HANGUL SYLLABLE TWIH
	    0xD29D <= code && code <= 0xD2B7 ||
	    // Lo  [27] HANGUL SYLLABLE TYUG..HANGUL SYLLABLE TYUH
	    0xD2B9 <= code && code <= 0xD2D3 ||
	    // Lo  [27] HANGUL SYLLABLE TEUG..HANGUL SYLLABLE TEUH
	    0xD2D5 <= code && code <= 0xD2EF ||
	    // Lo  [27] HANGUL SYLLABLE TYIG..HANGUL SYLLABLE TYIH
	    0xD2F1 <= code && code <= 0xD30B ||
	    // Lo  [27] HANGUL SYLLABLE TIG..HANGUL SYLLABLE TIH
	    0xD30D <= code && code <= 0xD327 ||
	    // Lo  [27] HANGUL SYLLABLE PAG..HANGUL SYLLABLE PAH
	    0xD329 <= code && code <= 0xD343 ||
	    // Lo  [27] HANGUL SYLLABLE PAEG..HANGUL SYLLABLE PAEH
	    0xD345 <= code && code <= 0xD35F ||
	    // Lo  [27] HANGUL SYLLABLE PYAG..HANGUL SYLLABLE PYAH
	    0xD361 <= code && code <= 0xD37B ||
	    // Lo  [27] HANGUL SYLLABLE PYAEG..HANGUL SYLLABLE PYAEH
	    0xD37D <= code && code <= 0xD397 ||
	    // Lo  [27] HANGUL SYLLABLE PEOG..HANGUL SYLLABLE PEOH
	    0xD399 <= code && code <= 0xD3B3 ||
	    // Lo  [27] HANGUL SYLLABLE PEG..HANGUL SYLLABLE PEH
	    0xD3B5 <= code && code <= 0xD3CF ||
	    // Lo  [27] HANGUL SYLLABLE PYEOG..HANGUL SYLLABLE PYEOH
	    0xD3D1 <= code && code <= 0xD3EB ||
	    // Lo  [27] HANGUL SYLLABLE PYEG..HANGUL SYLLABLE PYEH
	    0xD3ED <= code && code <= 0xD407 ||
	    // Lo  [27] HANGUL SYLLABLE POG..HANGUL SYLLABLE POH
	    0xD409 <= code && code <= 0xD423 ||
	    // Lo  [27] HANGUL SYLLABLE PWAG..HANGUL SYLLABLE PWAH
	    0xD425 <= code && code <= 0xD43F ||
	    // Lo  [27] HANGUL SYLLABLE PWAEG..HANGUL SYLLABLE PWAEH
	    0xD441 <= code && code <= 0xD45B ||
	    // Lo  [27] HANGUL SYLLABLE POEG..HANGUL SYLLABLE POEH
	    0xD45D <= code && code <= 0xD477 ||
	    // Lo  [27] HANGUL SYLLABLE PYOG..HANGUL SYLLABLE PYOH
	    0xD479 <= code && code <= 0xD493 ||
	    // Lo  [27] HANGUL SYLLABLE PUG..HANGUL SYLLABLE PUH
	    0xD495 <= code && code <= 0xD4AF ||
	    // Lo  [27] HANGUL SYLLABLE PWEOG..HANGUL SYLLABLE PWEOH
	    0xD4B1 <= code && code <= 0xD4CB ||
	    // Lo  [27] HANGUL SYLLABLE PWEG..HANGUL SYLLABLE PWEH
	    0xD4CD <= code && code <= 0xD4E7 ||
	    // Lo  [27] HANGUL SYLLABLE PWIG..HANGUL SYLLABLE PWIH
	    0xD4E9 <= code && code <= 0xD503 ||
	    // Lo  [27] HANGUL SYLLABLE PYUG..HANGUL SYLLABLE PYUH
	    0xD505 <= code && code <= 0xD51F ||
	    // Lo  [27] HANGUL SYLLABLE PEUG..HANGUL SYLLABLE PEUH
	    0xD521 <= code && code <= 0xD53B ||
	    // Lo  [27] HANGUL SYLLABLE PYIG..HANGUL SYLLABLE PYIH
	    0xD53D <= code && code <= 0xD557 ||
	    // Lo  [27] HANGUL SYLLABLE PIG..HANGUL SYLLABLE PIH
	    0xD559 <= code && code <= 0xD573 ||
	    // Lo  [27] HANGUL SYLLABLE HAG..HANGUL SYLLABLE HAH
	    0xD575 <= code && code <= 0xD58F ||
	    // Lo  [27] HANGUL SYLLABLE HAEG..HANGUL SYLLABLE HAEH
	    0xD591 <= code && code <= 0xD5AB ||
	    // Lo  [27] HANGUL SYLLABLE HYAG..HANGUL SYLLABLE HYAH
	    0xD5AD <= code && code <= 0xD5C7 ||
	    // Lo  [27] HANGUL SYLLABLE HYAEG..HANGUL SYLLABLE HYAEH
	    0xD5C9 <= code && code <= 0xD5E3 ||
	    // Lo  [27] HANGUL SYLLABLE HEOG..HANGUL SYLLABLE HEOH
	    0xD5E5 <= code && code <= 0xD5FF ||
	    // Lo  [27] HANGUL SYLLABLE HEG..HANGUL SYLLABLE HEH
	    0xD601 <= code && code <= 0xD61B ||
	    // Lo  [27] HANGUL SYLLABLE HYEOG..HANGUL SYLLABLE HYEOH
	    0xD61D <= code && code <= 0xD637 ||
	    // Lo  [27] HANGUL SYLLABLE HYEG..HANGUL SYLLABLE HYEH
	    0xD639 <= code && code <= 0xD653 ||
	    // Lo  [27] HANGUL SYLLABLE HOG..HANGUL SYLLABLE HOH
	    0xD655 <= code && code <= 0xD66F ||
	    // Lo  [27] HANGUL SYLLABLE HWAG..HANGUL SYLLABLE HWAH
	    0xD671 <= code && code <= 0xD68B ||
	    // Lo  [27] HANGUL SYLLABLE HWAEG..HANGUL SYLLABLE HWAEH
	    0xD68D <= code && code <= 0xD6A7 ||
	    // Lo  [27] HANGUL SYLLABLE HOEG..HANGUL SYLLABLE HOEH
	    0xD6A9 <= code && code <= 0xD6C3 ||
	    // Lo  [27] HANGUL SYLLABLE HYOG..HANGUL SYLLABLE HYOH
	    0xD6C5 <= code && code <= 0xD6DF ||
	    // Lo  [27] HANGUL SYLLABLE HUG..HANGUL SYLLABLE HUH
	    0xD6E1 <= code && code <= 0xD6FB ||
	    // Lo  [27] HANGUL SYLLABLE HWEOG..HANGUL SYLLABLE HWEOH
	    0xD6FD <= code && code <= 0xD717 ||
	    // Lo  [27] HANGUL SYLLABLE HWEG..HANGUL SYLLABLE HWEH
	    0xD719 <= code && code <= 0xD733 ||
	    // Lo  [27] HANGUL SYLLABLE HWIG..HANGUL SYLLABLE HWIH
	    0xD735 <= code && code <= 0xD74F ||
	    // Lo  [27] HANGUL SYLLABLE HYUG..HANGUL SYLLABLE HYUH
	    0xD751 <= code && code <= 0xD76B ||
	    // Lo  [27] HANGUL SYLLABLE HEUG..HANGUL SYLLABLE HEUH
	    0xD76D <= code && code <= 0xD787 ||
	    // Lo  [27] HANGUL SYLLABLE HYIG..HANGUL SYLLABLE HYIH
	    0xD789 <= code && code <= 0xD7A3 // Lo  [27] HANGUL SYLLABLE HIG..HANGUL SYLLABLE HIH
	    ) {
	      return LVT;
	    }
	    if (0x261D == code ||
	    // So       WHITE UP POINTING INDEX
	    0x26F9 == code ||
	    // So       PERSON WITH BALL
	    0x270A <= code && code <= 0x270D ||
	    // So   [4] RAISED FIST..WRITING HAND
	    0x1F385 == code ||
	    // So       FATHER CHRISTMAS
	    0x1F3C2 <= code && code <= 0x1F3C4 ||
	    // So   [3] SNOWBOARDER..SURFER
	    0x1F3C7 == code ||
	    // So       HORSE RACING
	    0x1F3CA <= code && code <= 0x1F3CC ||
	    // So   [3] SWIMMER..GOLFER
	    0x1F442 <= code && code <= 0x1F443 ||
	    // So   [2] EAR..NOSE
	    0x1F446 <= code && code <= 0x1F450 ||
	    // So  [11] WHITE UP POINTING BACKHAND INDEX..OPEN HANDS SIGN
	    0x1F46E == code ||
	    // So       POLICE OFFICER
	    0x1F470 <= code && code <= 0x1F478 ||
	    // So   [9] BRIDE WITH VEIL..PRINCESS
	    0x1F47C == code ||
	    // So       BABY ANGEL
	    0x1F481 <= code && code <= 0x1F483 ||
	    // So   [3] INFORMATION DESK PERSON..DANCER
	    0x1F485 <= code && code <= 0x1F487 ||
	    // So   [3] NAIL POLISH..HAIRCUT
	    0x1F4AA == code ||
	    // So       FLEXED BICEPS
	    0x1F574 <= code && code <= 0x1F575 ||
	    // So   [2] MAN IN BUSINESS SUIT LEVITATING..SLEUTH OR SPY
	    0x1F57A == code ||
	    // So       MAN DANCING
	    0x1F590 == code ||
	    // So       RAISED HAND WITH FINGERS SPLAYED
	    0x1F595 <= code && code <= 0x1F596 ||
	    // So   [2] REVERSED HAND WITH MIDDLE FINGER EXTENDED..RAISED HAND WITH PART BETWEEN MIDDLE AND RING FINGERS
	    0x1F645 <= code && code <= 0x1F647 ||
	    // So   [3] FACE WITH NO GOOD GESTURE..PERSON BOWING DEEPLY
	    0x1F64B <= code && code <= 0x1F64F ||
	    // So   [5] HAPPY PERSON RAISING ONE HAND..PERSON WITH FOLDED HANDS
	    0x1F6A3 == code ||
	    // So       ROWBOAT
	    0x1F6B4 <= code && code <= 0x1F6B6 ||
	    // So   [3] BICYCLIST..PEDESTRIAN
	    0x1F6C0 == code ||
	    // So       BATH
	    0x1F6CC == code ||
	    // So       SLEEPING ACCOMMODATION
	    0x1F918 <= code && code <= 0x1F91C ||
	    // So   [5] SIGN OF THE HORNS..RIGHT-FACING FIST
	    0x1F91E <= code && code <= 0x1F91F ||
	    // So   [2] HAND WITH INDEX AND MIDDLE FINGERS CROSSED..I LOVE YOU HAND SIGN
	    0x1F926 == code ||
	    // So       FACE PALM
	    0x1F930 <= code && code <= 0x1F939 ||
	    // So  [10] PREGNANT WOMAN..JUGGLING
	    0x1F93D <= code && code <= 0x1F93E ||
	    // So   [2] WATER POLO..HANDBALL
	    0x1F9D1 <= code && code <= 0x1F9DD // So  [13] ADULT..ELF
	    ) {
	      return E_Base;
	    }
	    if (0x1F3FB <= code && code <= 0x1F3FF // Sk   [5] EMOJI MODIFIER FITZPATRICK TYPE-1-2..EMOJI MODIFIER FITZPATRICK TYPE-6
	    ) {
	      return E_Modifier;
	    }
	    if (0x200D == code // Cf       ZERO WIDTH JOINER
	    ) {
	      return ZWJ;
	    }
	    if (0x2640 == code ||
	    // So       FEMALE SIGN
	    0x2642 == code ||
	    // So       MALE SIGN
	    0x2695 <= code && code <= 0x2696 ||
	    // So   [2] STAFF OF AESCULAPIUS..SCALES
	    0x2708 == code ||
	    // So       AIRPLANE
	    0x2764 == code ||
	    // So       HEAVY BLACK HEART
	    0x1F308 == code ||
	    // So       RAINBOW
	    0x1F33E == code ||
	    // So       EAR OF RICE
	    0x1F373 == code ||
	    // So       COOKING
	    0x1F393 == code ||
	    // So       GRADUATION CAP
	    0x1F3A4 == code ||
	    // So       MICROPHONE
	    0x1F3A8 == code ||
	    // So       ARTIST PALETTE
	    0x1F3EB == code ||
	    // So       SCHOOL
	    0x1F3ED == code ||
	    // So       FACTORY
	    0x1F48B == code ||
	    // So       KISS MARK
	    0x1F4BB <= code && code <= 0x1F4BC ||
	    // So   [2] PERSONAL COMPUTER..BRIEFCASE
	    0x1F527 == code ||
	    // So       WRENCH
	    0x1F52C == code ||
	    // So       MICROSCOPE
	    0x1F5E8 == code ||
	    // So       LEFT SPEECH BUBBLE
	    0x1F680 == code ||
	    // So       ROCKET
	    0x1F692 == code // So       FIRE ENGINE
	    ) {
	      return Glue_After_Zwj;
	    }
	    if (0x1F466 <= code && code <= 0x1F469 // So   [4] BOY..WOMAN
	    ) {
	      return E_Base_GAZ;
	    }

	    //all unlisted characters have a grapheme break property of "Other"
	    return Other;
	  }
	  return this;
	}
	if (module.exports) {
	  module.exports = GraphemeSplitter;
	} 
} (graphemeSplitter));

var graphemeSplitterExports = graphemeSplitter.exports;
var GraphemeSplitter = /*@__PURE__*/getDefaultExportFromCjs(graphemeSplitterExports);

var unicode_map = [{
  expected: "🧑🏻‍❤️‍💋‍🧑🏼",
  actual: "🧑🏻‍❤️‍💋‍🧑🏼"
}, {
  expected: "🧑🏻‍❤️‍💋‍🧑🏽",
  actual: "🧑🏻‍❤️‍💋‍🧑🏽"
}, {
  expected: "🧑🏻‍❤️‍💋‍🧑🏾",
  actual: "🧑🏻‍❤️‍💋‍🧑🏾"
}, {
  expected: "🧑🏻‍❤️‍💋‍🧑🏿",
  actual: "🧑🏻‍❤️‍💋‍🧑🏿"
}, {
  expected: "🧑🏼‍❤️‍💋‍🧑🏻",
  actual: "🧑🏼‍❤️‍💋‍🧑🏻"
}, {
  expected: "🧑🏼‍❤️‍💋‍🧑🏽",
  actual: "🧑🏼‍❤️‍💋‍🧑🏽"
}, {
  expected: "🧑🏼‍❤️‍💋‍🧑🏾",
  actual: "🧑🏼‍❤️‍💋‍🧑🏾"
}, {
  expected: "🧑🏼‍❤️‍💋‍🧑🏿",
  actual: "🧑🏼‍❤️‍💋‍🧑🏿"
}, {
  expected: "🧑🏽‍❤️‍💋‍🧑🏻",
  actual: "🧑🏽‍❤️‍💋‍🧑🏻"
}, {
  expected: "🧑🏽‍❤️‍💋‍🧑🏼",
  actual: "🧑🏽‍❤️‍💋‍🧑🏼"
}, {
  expected: "🧑🏽‍❤️‍💋‍🧑🏾",
  actual: "🧑🏽‍❤️‍💋‍🧑🏾"
}, {
  expected: "🧑🏽‍❤️‍💋‍🧑🏿",
  actual: "🧑🏽‍❤️‍💋‍🧑🏿"
}, {
  expected: "🧑🏾‍❤️‍💋‍🧑🏻",
  actual: "🧑🏾‍❤️‍💋‍🧑🏻"
}, {
  expected: "🧑🏾‍❤️‍💋‍🧑🏼",
  actual: "🧑🏾‍❤️‍💋‍🧑🏼"
}, {
  expected: "🧑🏾‍❤️‍💋‍🧑🏽",
  actual: "🧑🏾‍❤️‍💋‍🧑🏽"
}, {
  expected: "🧑🏾‍❤️‍💋‍🧑🏿",
  actual: "🧑🏾‍❤️‍💋‍🧑🏿"
}, {
  expected: "🧑🏿‍❤️‍💋‍🧑🏻",
  actual: "🧑🏿‍❤️‍💋‍🧑🏻"
}, {
  expected: "🧑🏿‍❤️‍💋‍🧑🏼",
  actual: "🧑🏿‍❤️‍💋‍🧑🏼"
}, {
  expected: "🧑🏿‍❤️‍💋‍🧑🏽",
  actual: "🧑🏿‍❤️‍💋‍🧑🏽"
}, {
  expected: "🧑🏿‍❤️‍💋‍🧑🏾",
  actual: "🧑🏿‍❤️‍💋‍🧑🏾"
}, {
  expected: "👩🏻‍❤️‍💋‍👨🏻",
  actual: "👩🏻‍❤️‍💋‍👨🏻"
}, {
  expected: "👩🏻‍❤️‍💋‍👨🏼",
  actual: "👩🏻‍❤️‍💋‍👨🏼"
}, {
  expected: "👩🏻‍❤️‍💋‍👨🏽",
  actual: "👩🏻‍❤️‍💋‍👨🏽"
}, {
  expected: "👩🏻‍❤️‍💋‍👨🏾",
  actual: "👩🏻‍❤️‍💋‍👨🏾"
}, {
  expected: "👩🏻‍❤️‍💋‍👨🏿",
  actual: "👩🏻‍❤️‍💋‍👨🏿"
}, {
  expected: "👩🏼‍❤️‍💋‍👨🏻",
  actual: "👩🏼‍❤️‍💋‍👨🏻"
}, {
  expected: "👩🏼‍❤️‍💋‍👨🏼",
  actual: "👩🏼‍❤️‍💋‍👨🏼"
}, {
  expected: "👩🏼‍❤️‍💋‍👨🏽",
  actual: "👩🏼‍❤️‍💋‍👨🏽"
}, {
  expected: "👩🏼‍❤️‍💋‍👨🏾",
  actual: "👩🏼‍❤️‍💋‍👨🏾"
}, {
  expected: "👩🏼‍❤️‍💋‍👨🏿",
  actual: "👩🏼‍❤️‍💋‍👨🏿"
}, {
  expected: "👩🏽‍❤️‍💋‍👨🏻",
  actual: "👩🏽‍❤️‍💋‍👨🏻"
}, {
  expected: "👩🏽‍❤️‍💋‍👨🏼",
  actual: "👩🏽‍❤️‍💋‍👨🏼"
}, {
  expected: "👩🏽‍❤️‍💋‍👨🏽",
  actual: "👩🏽‍❤️‍💋‍👨🏽"
}, {
  expected: "👩🏽‍❤️‍💋‍👨🏾",
  actual: "👩🏽‍❤️‍💋‍👨🏾"
}, {
  expected: "👩🏽‍❤️‍💋‍👨🏿",
  actual: "👩🏽‍❤️‍💋‍👨🏿"
}, {
  expected: "👩🏾‍❤️‍💋‍👨🏻",
  actual: "👩🏾‍❤️‍💋‍👨🏻"
}, {
  expected: "👩🏾‍❤️‍💋‍👨🏼",
  actual: "👩🏾‍❤️‍💋‍👨🏼"
}, {
  expected: "👩🏾‍❤️‍💋‍👨🏽",
  actual: "👩🏾‍❤️‍💋‍👨🏽"
}, {
  expected: "👩🏾‍❤️‍💋‍👨🏾",
  actual: "👩🏾‍❤️‍💋‍👨🏾"
}, {
  expected: "👩🏾‍❤️‍💋‍👨🏿",
  actual: "👩🏾‍❤️‍💋‍👨🏿"
}, {
  expected: "👩🏿‍❤️‍💋‍👨🏻",
  actual: "👩🏿‍❤️‍💋‍👨🏻"
}, {
  expected: "👩🏿‍❤️‍💋‍👨🏼",
  actual: "👩🏿‍❤️‍💋‍👨🏼"
}, {
  expected: "👩🏿‍❤️‍💋‍👨🏽",
  actual: "👩🏿‍❤️‍💋‍👨🏽"
}, {
  expected: "👩🏿‍❤️‍💋‍👨🏾",
  actual: "👩🏿‍❤️‍💋‍👨🏾"
}, {
  expected: "👩🏿‍❤️‍💋‍👨🏿",
  actual: "👩🏿‍❤️‍💋‍👨🏿"
}, {
  expected: "👨🏻‍❤️‍💋‍👨🏻",
  actual: "👨🏻‍❤️‍💋‍👨🏻"
}, {
  expected: "👨🏻‍❤️‍💋‍👨🏼",
  actual: "👨🏻‍❤️‍💋‍👨🏼"
}, {
  expected: "👨🏻‍❤️‍💋‍👨🏽",
  actual: "👨🏻‍❤️‍💋‍👨🏽"
}, {
  expected: "👨🏻‍❤️‍💋‍👨🏾",
  actual: "👨🏻‍❤️‍💋‍👨🏾"
}, {
  expected: "👨🏻‍❤️‍💋‍👨🏿",
  actual: "👨🏻‍❤️‍💋‍👨🏿"
}, {
  expected: "👨🏼‍❤️‍💋‍👨🏻",
  actual: "👨🏼‍❤️‍💋‍👨🏻"
}, {
  expected: "👨🏼‍❤️‍💋‍👨🏼",
  actual: "👨🏼‍❤️‍💋‍👨🏼"
}, {
  expected: "👨🏼‍❤️‍💋‍👨🏽",
  actual: "👨🏼‍❤️‍💋‍👨🏽"
}, {
  expected: "👨🏼‍❤️‍💋‍👨🏾",
  actual: "👨🏼‍❤️‍💋‍👨🏾"
}, {
  expected: "👨🏼‍❤️‍💋‍👨🏿",
  actual: "👨🏼‍❤️‍💋‍👨🏿"
}, {
  expected: "👨🏽‍❤️‍💋‍👨🏻",
  actual: "👨🏽‍❤️‍💋‍👨🏻"
}, {
  expected: "👨🏽‍❤️‍💋‍👨🏼",
  actual: "👨🏽‍❤️‍💋‍👨🏼"
}, {
  expected: "👨🏽‍❤️‍💋‍👨🏽",
  actual: "👨🏽‍❤️‍💋‍👨🏽"
}, {
  expected: "👨🏽‍❤️‍💋‍👨🏾",
  actual: "👨🏽‍❤️‍💋‍👨🏾"
}, {
  expected: "👨🏽‍❤️‍💋‍👨🏿",
  actual: "👨🏽‍❤️‍💋‍👨🏿"
}, {
  expected: "👨🏾‍❤️‍💋‍👨🏻",
  actual: "👨🏾‍❤️‍💋‍👨🏻"
}, {
  expected: "👨🏾‍❤️‍💋‍👨🏼",
  actual: "👨🏾‍❤️‍💋‍👨🏼"
}, {
  expected: "👨🏾‍❤️‍💋‍👨🏽",
  actual: "👨🏾‍❤️‍💋‍👨🏽"
}, {
  expected: "👨🏾‍❤️‍💋‍👨🏾",
  actual: "👨🏾‍❤️‍💋‍👨🏾"
}, {
  expected: "👨🏾‍❤️‍💋‍👨🏿",
  actual: "👨🏾‍❤️‍💋‍👨🏿"
}, {
  expected: "👨🏿‍❤️‍💋‍👨🏻",
  actual: "👨🏿‍❤️‍💋‍👨🏻"
}, {
  expected: "👨🏿‍❤️‍💋‍👨🏼",
  actual: "👨🏿‍❤️‍💋‍👨🏼"
}, {
  expected: "👨🏿‍❤️‍💋‍👨🏽",
  actual: "👨🏿‍❤️‍💋‍👨🏽"
}, {
  expected: "👨🏿‍❤️‍💋‍👨🏾",
  actual: "👨🏿‍❤️‍💋‍👨🏾"
}, {
  expected: "👨🏿‍❤️‍💋‍👨🏿",
  actual: "👨🏿‍❤️‍💋‍👨🏿"
}, {
  expected: "👩🏻‍❤️‍💋‍👩🏻",
  actual: "👩🏻‍❤️‍💋‍👩🏻"
}, {
  expected: "👩🏻‍❤️‍💋‍👩🏼",
  actual: "👩🏻‍❤️‍💋‍👩🏼"
}, {
  expected: "👩🏻‍❤️‍💋‍👩🏽",
  actual: "👩🏻‍❤️‍💋‍👩🏽"
}, {
  expected: "👩🏻‍❤️‍💋‍👩🏾",
  actual: "👩🏻‍❤️‍💋‍👩🏾"
}, {
  expected: "👩🏻‍❤️‍💋‍👩🏿",
  actual: "👩🏻‍❤️‍💋‍👩🏿"
}, {
  expected: "👩🏼‍❤️‍💋‍👩🏻",
  actual: "👩🏼‍❤️‍💋‍👩🏻"
}, {
  expected: "👩🏼‍❤️‍💋‍👩🏼",
  actual: "👩🏼‍❤️‍💋‍👩🏼"
}, {
  expected: "👩🏼‍❤️‍💋‍👩🏽",
  actual: "👩🏼‍❤️‍💋‍👩🏽"
}, {
  expected: "👩🏼‍❤️‍💋‍👩🏾",
  actual: "👩🏼‍❤️‍💋‍👩🏾"
}, {
  expected: "👩🏼‍❤️‍💋‍👩🏿",
  actual: "👩🏼‍❤️‍💋‍👩🏿"
}, {
  expected: "👩🏽‍❤️‍💋‍👩🏻",
  actual: "👩🏽‍❤️‍💋‍👩🏻"
}, {
  expected: "👩🏽‍❤️‍💋‍👩🏼",
  actual: "👩🏽‍❤️‍💋‍👩🏼"
}, {
  expected: "👩🏽‍❤️‍💋‍👩🏽",
  actual: "👩🏽‍❤️‍💋‍👩🏽"
}, {
  expected: "👩🏽‍❤️‍💋‍👩🏾",
  actual: "👩🏽‍❤️‍💋‍👩🏾"
}, {
  expected: "👩🏽‍❤️‍💋‍👩🏿",
  actual: "👩🏽‍❤️‍💋‍👩🏿"
}, {
  expected: "👩🏾‍❤️‍💋‍👩🏻",
  actual: "👩🏾‍❤️‍💋‍👩🏻"
}, {
  expected: "👩🏾‍❤️‍💋‍👩🏼",
  actual: "👩🏾‍❤️‍💋‍👩🏼"
}, {
  expected: "👩🏾‍❤️‍💋‍👩🏽",
  actual: "👩🏾‍❤️‍💋‍👩🏽"
}, {
  expected: "👩🏾‍❤️‍💋‍👩🏾",
  actual: "👩🏾‍❤️‍💋‍👩🏾"
}, {
  expected: "👩🏾‍❤️‍💋‍👩🏿",
  actual: "👩🏾‍❤️‍💋‍👩🏿"
}, {
  expected: "👩🏿‍❤️‍💋‍👩🏻",
  actual: "👩🏿‍❤️‍💋‍👩🏻"
}, {
  expected: "👩🏿‍❤️‍💋‍👩🏼",
  actual: "👩🏿‍❤️‍💋‍👩🏼"
}, {
  expected: "👩🏿‍❤️‍💋‍👩🏽",
  actual: "👩🏿‍❤️‍💋‍👩🏽"
}, {
  expected: "👩🏿‍❤️‍💋‍👩🏾",
  actual: "👩🏿‍❤️‍💋‍👩🏾"
}, {
  expected: "👩🏿‍❤️‍💋‍👩🏿",
  actual: "👩🏿‍❤️‍💋‍👩🏿"
}, {
  expected: "🧑🏻‍❤‍💋‍🧑🏼",
  actual: "🧑🏻‍❤‍💋‍🧑🏼"
}, {
  expected: "🧑🏻‍❤‍💋‍🧑🏽",
  actual: "🧑🏻‍❤‍💋‍🧑🏽"
}, {
  expected: "🧑🏻‍❤‍💋‍🧑🏾",
  actual: "🧑🏻‍❤‍💋‍🧑🏾"
}, {
  expected: "🧑🏻‍❤‍💋‍🧑🏿",
  actual: "🧑🏻‍❤‍💋‍🧑🏿"
}, {
  expected: "🧑🏼‍❤‍💋‍🧑🏻",
  actual: "🧑🏼‍❤‍💋‍🧑🏻"
}, {
  expected: "🧑🏼‍❤‍💋‍🧑🏽",
  actual: "🧑🏼‍❤‍💋‍🧑🏽"
}, {
  expected: "🧑🏼‍❤‍💋‍🧑🏾",
  actual: "🧑🏼‍❤‍💋‍🧑🏾"
}, {
  expected: "🧑🏼‍❤‍💋‍🧑🏿",
  actual: "🧑🏼‍❤‍💋‍🧑🏿"
}, {
  expected: "🧑🏽‍❤‍💋‍🧑🏻",
  actual: "🧑🏽‍❤‍💋‍🧑🏻"
}, {
  expected: "🧑🏽‍❤‍💋‍🧑🏼",
  actual: "🧑🏽‍❤‍💋‍🧑🏼"
}, {
  expected: "🧑🏽‍❤‍💋‍🧑🏾",
  actual: "🧑🏽‍❤‍💋‍🧑🏾"
}, {
  expected: "🧑🏽‍❤‍💋‍🧑🏿",
  actual: "🧑🏽‍❤‍💋‍🧑🏿"
}, {
  expected: "🧑🏾‍❤‍💋‍🧑🏻",
  actual: "🧑🏾‍❤‍💋‍🧑🏻"
}, {
  expected: "🧑🏾‍❤‍💋‍🧑🏼",
  actual: "🧑🏾‍❤‍💋‍🧑🏼"
}, {
  expected: "🧑🏾‍❤‍💋‍🧑🏽",
  actual: "🧑🏾‍❤‍💋‍🧑🏽"
}, {
  expected: "🧑🏾‍❤‍💋‍🧑🏿",
  actual: "🧑🏾‍❤‍💋‍🧑🏿"
}, {
  expected: "🧑🏿‍❤‍💋‍🧑🏻",
  actual: "🧑🏿‍❤‍💋‍🧑🏻"
}, {
  expected: "🧑🏿‍❤‍💋‍🧑🏼",
  actual: "🧑🏿‍❤‍💋‍🧑🏼"
}, {
  expected: "🧑🏿‍❤‍💋‍🧑🏽",
  actual: "🧑🏿‍❤‍💋‍🧑🏽"
}, {
  expected: "🧑🏿‍❤‍💋‍🧑🏾",
  actual: "🧑🏿‍❤‍💋‍🧑🏾"
}, {
  expected: "👩🏻‍❤‍💋‍👨🏻",
  actual: "👩🏻‍❤‍💋‍👨🏻"
}, {
  expected: "👩🏻‍❤‍💋‍👨🏼",
  actual: "👩🏻‍❤‍💋‍👨🏼"
}, {
  expected: "👩🏻‍❤‍💋‍👨🏽",
  actual: "👩🏻‍❤‍💋‍👨🏽"
}, {
  expected: "👩🏻‍❤‍💋‍👨🏾",
  actual: "👩🏻‍❤‍💋‍👨🏾"
}, {
  expected: "👩🏻‍❤‍💋‍👨🏿",
  actual: "👩🏻‍❤‍💋‍👨🏿"
}, {
  expected: "👩🏼‍❤‍💋‍👨🏻",
  actual: "👩🏼‍❤‍💋‍👨🏻"
}, {
  expected: "👩🏼‍❤‍💋‍👨🏼",
  actual: "👩🏼‍❤‍💋‍👨🏼"
}, {
  expected: "👩🏼‍❤‍💋‍👨🏽",
  actual: "👩🏼‍❤‍💋‍👨🏽"
}, {
  expected: "👩🏼‍❤‍💋‍👨🏾",
  actual: "👩🏼‍❤‍💋‍👨🏾"
}, {
  expected: "👩🏼‍❤‍💋‍👨🏿",
  actual: "👩🏼‍❤‍💋‍👨🏿"
}, {
  expected: "👩🏽‍❤‍💋‍👨🏻",
  actual: "👩🏽‍❤‍💋‍👨🏻"
}, {
  expected: "👩🏽‍❤‍💋‍👨🏼",
  actual: "👩🏽‍❤‍💋‍👨🏼"
}, {
  expected: "👩🏽‍❤‍💋‍👨🏽",
  actual: "👩🏽‍❤‍💋‍👨🏽"
}, {
  expected: "👩🏽‍❤‍💋‍👨🏾",
  actual: "👩🏽‍❤‍💋‍👨🏾"
}, {
  expected: "👩🏽‍❤‍💋‍👨🏿",
  actual: "👩🏽‍❤‍💋‍👨🏿"
}, {
  expected: "👩🏾‍❤‍💋‍👨🏻",
  actual: "👩🏾‍❤‍💋‍👨🏻"
}, {
  expected: "👩🏾‍❤‍💋‍👨🏼",
  actual: "👩🏾‍❤‍💋‍👨🏼"
}, {
  expected: "👩🏾‍❤‍💋‍👨🏽",
  actual: "👩🏾‍❤‍💋‍👨🏽"
}, {
  expected: "👩🏾‍❤‍💋‍👨🏾",
  actual: "👩🏾‍❤‍💋‍👨🏾"
}, {
  expected: "👩🏾‍❤‍💋‍👨🏿",
  actual: "👩🏾‍❤‍💋‍👨🏿"
}, {
  expected: "👩🏿‍❤‍💋‍👨🏻",
  actual: "👩🏿‍❤‍💋‍👨🏻"
}, {
  expected: "👩🏿‍❤‍💋‍👨🏼",
  actual: "👩🏿‍❤‍💋‍👨🏼"
}, {
  expected: "👩🏿‍❤‍💋‍👨🏽",
  actual: "👩🏿‍❤‍💋‍👨🏽"
}, {
  expected: "👩🏿‍❤‍💋‍👨🏾",
  actual: "👩🏿‍❤‍💋‍👨🏾"
}, {
  expected: "👩🏿‍❤‍💋‍👨🏿",
  actual: "👩🏿‍❤‍💋‍👨🏿"
}, {
  expected: "👨🏻‍❤‍💋‍👨🏻",
  actual: "👨🏻‍❤‍💋‍👨🏻"
}, {
  expected: "👨🏻‍❤‍💋‍👨🏼",
  actual: "👨🏻‍❤‍💋‍👨🏼"
}, {
  expected: "👨🏻‍❤‍💋‍👨🏽",
  actual: "👨🏻‍❤‍💋‍👨🏽"
}, {
  expected: "👨🏻‍❤‍💋‍👨🏾",
  actual: "👨🏻‍❤‍💋‍👨🏾"
}, {
  expected: "👨🏻‍❤‍💋‍👨🏿",
  actual: "👨🏻‍❤‍💋‍👨🏿"
}, {
  expected: "👨🏼‍❤‍💋‍👨🏻",
  actual: "👨🏼‍❤‍💋‍👨🏻"
}, {
  expected: "👨🏼‍❤‍💋‍👨🏼",
  actual: "👨🏼‍❤‍💋‍👨🏼"
}, {
  expected: "👨🏼‍❤‍💋‍👨🏽",
  actual: "👨🏼‍❤‍💋‍👨🏽"
}, {
  expected: "👨🏼‍❤‍💋‍👨🏾",
  actual: "👨🏼‍❤‍💋‍👨🏾"
}, {
  expected: "👨🏼‍❤‍💋‍👨🏿",
  actual: "👨🏼‍❤‍💋‍👨🏿"
}, {
  expected: "👨🏽‍❤‍💋‍👨🏻",
  actual: "👨🏽‍❤‍💋‍👨🏻"
}, {
  expected: "👨🏽‍❤‍💋‍👨🏼",
  actual: "👨🏽‍❤‍💋‍👨🏼"
}, {
  expected: "👨🏽‍❤‍💋‍👨🏽",
  actual: "👨🏽‍❤‍💋‍👨🏽"
}, {
  expected: "👨🏽‍❤‍💋‍👨🏾",
  actual: "👨🏽‍❤‍💋‍👨🏾"
}, {
  expected: "👨🏽‍❤‍💋‍👨🏿",
  actual: "👨🏽‍❤‍💋‍👨🏿"
}, {
  expected: "👨🏾‍❤‍💋‍👨🏻",
  actual: "👨🏾‍❤‍💋‍👨🏻"
}, {
  expected: "👨🏾‍❤‍💋‍👨🏼",
  actual: "👨🏾‍❤‍💋‍👨🏼"
}, {
  expected: "👨🏾‍❤‍💋‍👨🏽",
  actual: "👨🏾‍❤‍💋‍👨🏽"
}, {
  expected: "👨🏾‍❤‍💋‍👨🏾",
  actual: "👨🏾‍❤‍💋‍👨🏾"
}, {
  expected: "👨🏾‍❤‍💋‍👨🏿",
  actual: "👨🏾‍❤‍💋‍👨🏿"
}, {
  expected: "👨🏿‍❤‍💋‍👨🏻",
  actual: "👨🏿‍❤‍💋‍👨🏻"
}, {
  expected: "👨🏿‍❤‍💋‍👨🏼",
  actual: "👨🏿‍❤‍💋‍👨🏼"
}, {
  expected: "👨🏿‍❤‍💋‍👨🏽",
  actual: "👨🏿‍❤‍💋‍👨🏽"
}, {
  expected: "👨🏿‍❤‍💋‍👨🏾",
  actual: "👨🏿‍❤‍💋‍👨🏾"
}, {
  expected: "👨🏿‍❤‍💋‍👨🏿",
  actual: "👨🏿‍❤‍💋‍👨🏿"
}, {
  expected: "👩🏻‍❤‍💋‍👩🏻",
  actual: "👩🏻‍❤‍💋‍👩🏻"
}, {
  expected: "👩🏻‍❤‍💋‍👩🏼",
  actual: "👩🏻‍❤‍💋‍👩🏼"
}, {
  expected: "👩🏻‍❤‍💋‍👩🏽",
  actual: "👩🏻‍❤‍💋‍👩🏽"
}, {
  expected: "👩🏻‍❤‍💋‍👩🏾",
  actual: "👩🏻‍❤‍💋‍👩🏾"
}, {
  expected: "👩🏻‍❤‍💋‍👩🏿",
  actual: "👩🏻‍❤‍💋‍👩🏿"
}, {
  expected: "👩🏼‍❤‍💋‍👩🏻",
  actual: "👩🏼‍❤‍💋‍👩🏻"
}, {
  expected: "👩🏼‍❤‍💋‍👩🏼",
  actual: "👩🏼‍❤‍💋‍👩🏼"
}, {
  expected: "👩🏼‍❤‍💋‍👩🏽",
  actual: "👩🏼‍❤‍💋‍👩🏽"
}, {
  expected: "👩🏼‍❤‍💋‍👩🏾",
  actual: "👩🏼‍❤‍💋‍👩🏾"
}, {
  expected: "👩🏼‍❤‍💋‍👩🏿",
  actual: "👩🏼‍❤‍💋‍👩🏿"
}, {
  expected: "👩🏽‍❤‍💋‍👩🏻",
  actual: "👩🏽‍❤‍💋‍👩🏻"
}, {
  expected: "👩🏽‍❤‍💋‍👩🏼",
  actual: "👩🏽‍❤‍💋‍👩🏼"
}, {
  expected: "👩🏽‍❤‍💋‍👩🏽",
  actual: "👩🏽‍❤‍💋‍👩🏽"
}, {
  expected: "👩🏽‍❤‍💋‍👩🏾",
  actual: "👩🏽‍❤‍💋‍👩🏾"
}, {
  expected: "👩🏽‍❤‍💋‍👩🏿",
  actual: "👩🏽‍❤‍💋‍👩🏿"
}, {
  expected: "👩🏾‍❤‍💋‍👩🏻",
  actual: "👩🏾‍❤‍💋‍👩🏻"
}, {
  expected: "👩🏾‍❤‍💋‍👩🏼",
  actual: "👩🏾‍❤‍💋‍👩🏼"
}, {
  expected: "👩🏾‍❤‍💋‍👩🏽",
  actual: "👩🏾‍❤‍💋‍👩🏽"
}, {
  expected: "👩🏾‍❤‍💋‍👩🏾",
  actual: "👩🏾‍❤‍💋‍👩🏾"
}, {
  expected: "👩🏾‍❤‍💋‍👩🏿",
  actual: "👩🏾‍❤‍💋‍👩🏿"
}, {
  expected: "👩🏿‍❤‍💋‍👩🏻",
  actual: "👩🏿‍❤‍💋‍👩🏻"
}, {
  expected: "👩🏿‍❤‍💋‍👩🏼",
  actual: "👩🏿‍❤‍💋‍👩🏼"
}, {
  expected: "👩🏿‍❤‍💋‍👩🏽",
  actual: "👩🏿‍❤‍💋‍👩🏽"
}, {
  expected: "👩🏿‍❤‍💋‍👩🏾",
  actual: "👩🏿‍❤‍💋‍👩🏾"
}, {
  expected: "👩🏿‍❤‍💋‍👩🏿",
  actual: "👩🏿‍❤‍💋‍👩🏿"
}, {
  expected: "🧑🏻‍❤️‍🧑🏼",
  actual: "🧑🏻‍❤️‍🧑🏼"
}, {
  expected: "🧑🏻‍❤️‍🧑🏽",
  actual: "🧑🏻‍❤️‍🧑🏽"
}, {
  expected: "🧑🏻‍❤️‍🧑🏾",
  actual: "🧑🏻‍❤️‍🧑🏾"
}, {
  expected: "🧑🏻‍❤️‍🧑🏿",
  actual: "🧑🏻‍❤️‍🧑🏿"
}, {
  expected: "🧑🏼‍❤️‍🧑🏻",
  actual: "🧑🏼‍❤️‍🧑🏻"
}, {
  expected: "🧑🏼‍❤️‍🧑🏽",
  actual: "🧑🏼‍❤️‍🧑🏽"
}, {
  expected: "🧑🏼‍❤️‍🧑🏾",
  actual: "🧑🏼‍❤️‍🧑🏾"
}, {
  expected: "🧑🏼‍❤️‍🧑🏿",
  actual: "🧑🏼‍❤️‍🧑🏿"
}, {
  expected: "🧑🏽‍❤️‍🧑🏻",
  actual: "🧑🏽‍❤️‍🧑🏻"
}, {
  expected: "🧑🏽‍❤️‍🧑🏼",
  actual: "🧑🏽‍❤️‍🧑🏼"
}, {
  expected: "🧑🏽‍❤️‍🧑🏾",
  actual: "🧑🏽‍❤️‍🧑🏾"
}, {
  expected: "🧑🏽‍❤️‍🧑🏿",
  actual: "🧑🏽‍❤️‍🧑🏿"
}, {
  expected: "🧑🏾‍❤️‍🧑🏻",
  actual: "🧑🏾‍❤️‍🧑🏻"
}, {
  expected: "🧑🏾‍❤️‍🧑🏼",
  actual: "🧑🏾‍❤️‍🧑🏼"
}, {
  expected: "🧑🏾‍❤️‍🧑🏽",
  actual: "🧑🏾‍❤️‍🧑🏽"
}, {
  expected: "🧑🏾‍❤️‍🧑🏿",
  actual: "🧑🏾‍❤️‍🧑🏿"
}, {
  expected: "🧑🏿‍❤️‍🧑🏻",
  actual: "🧑🏿‍❤️‍🧑🏻"
}, {
  expected: "🧑🏿‍❤️‍🧑🏼",
  actual: "🧑🏿‍❤️‍🧑🏼"
}, {
  expected: "🧑🏿‍❤️‍🧑🏽",
  actual: "🧑🏿‍❤️‍🧑🏽"
}, {
  expected: "🧑🏿‍❤️‍🧑🏾",
  actual: "🧑🏿‍❤️‍🧑🏾"
}, {
  expected: "👩🏻‍❤️‍👨🏻",
  actual: "👩🏻‍❤️‍👨🏻"
}, {
  expected: "👩🏻‍❤️‍👨🏼",
  actual: "👩🏻‍❤️‍👨🏼"
}, {
  expected: "👩🏻‍❤️‍👨🏽",
  actual: "👩🏻‍❤️‍👨🏽"
}, {
  expected: "👩🏻‍❤️‍👨🏾",
  actual: "👩🏻‍❤️‍👨🏾"
}, {
  expected: "👩🏻‍❤️‍👨🏿",
  actual: "👩🏻‍❤️‍👨🏿"
}, {
  expected: "👩🏼‍❤️‍👨🏻",
  actual: "👩🏼‍❤️‍👨🏻"
}, {
  expected: "👩🏼‍❤️‍👨🏼",
  actual: "👩🏼‍❤️‍👨🏼"
}, {
  expected: "👩🏼‍❤️‍👨🏽",
  actual: "👩🏼‍❤️‍👨🏽"
}, {
  expected: "👩🏼‍❤️‍👨🏾",
  actual: "👩🏼‍❤️‍👨🏾"
}, {
  expected: "👩🏼‍❤️‍👨🏿",
  actual: "👩🏼‍❤️‍👨🏿"
}, {
  expected: "👩🏽‍❤️‍👨🏻",
  actual: "👩🏽‍❤️‍👨🏻"
}, {
  expected: "👩🏽‍❤️‍👨🏼",
  actual: "👩🏽‍❤️‍👨🏼"
}, {
  expected: "👩🏽‍❤️‍👨🏽",
  actual: "👩🏽‍❤️‍👨🏽"
}, {
  expected: "👩🏽‍❤️‍👨🏾",
  actual: "👩🏽‍❤️‍👨🏾"
}, {
  expected: "👩🏽‍❤️‍👨🏿",
  actual: "👩🏽‍❤️‍👨🏿"
}, {
  expected: "👩🏾‍❤️‍👨🏻",
  actual: "👩🏾‍❤️‍👨🏻"
}, {
  expected: "👩🏾‍❤️‍👨🏼",
  actual: "👩🏾‍❤️‍👨🏼"
}, {
  expected: "👩🏾‍❤️‍👨🏽",
  actual: "👩🏾‍❤️‍👨🏽"
}, {
  expected: "👩🏾‍❤️‍👨🏾",
  actual: "👩🏾‍❤️‍👨🏾"
}, {
  expected: "👩🏾‍❤️‍👨🏿",
  actual: "👩🏾‍❤️‍👨🏿"
}, {
  expected: "👩🏿‍❤️‍👨🏻",
  actual: "👩🏿‍❤️‍👨🏻"
}, {
  expected: "👩🏿‍❤️‍👨🏼",
  actual: "👩🏿‍❤️‍👨🏼"
}, {
  expected: "👩🏿‍❤️‍👨🏽",
  actual: "👩🏿‍❤️‍👨🏽"
}, {
  expected: "👩🏿‍❤️‍👨🏾",
  actual: "👩🏿‍❤️‍👨🏾"
}, {
  expected: "👩🏿‍❤️‍👨🏿",
  actual: "👩🏿‍❤️‍👨🏿"
}, {
  expected: "👨🏻‍❤️‍👨🏻",
  actual: "👨🏻‍❤️‍👨🏻"
}, {
  expected: "👨🏻‍❤️‍👨🏼",
  actual: "👨🏻‍❤️‍👨🏼"
}, {
  expected: "👨🏻‍❤️‍👨🏽",
  actual: "👨🏻‍❤️‍👨🏽"
}, {
  expected: "👨🏻‍❤️‍👨🏾",
  actual: "👨🏻‍❤️‍👨🏾"
}, {
  expected: "👨🏻‍❤️‍👨🏿",
  actual: "👨🏻‍❤️‍👨🏿"
}, {
  expected: "👨🏼‍❤️‍👨🏻",
  actual: "👨🏼‍❤️‍👨🏻"
}, {
  expected: "👨🏼‍❤️‍👨🏼",
  actual: "👨🏼‍❤️‍👨🏼"
}, {
  expected: "👨🏼‍❤️‍👨🏽",
  actual: "👨🏼‍❤️‍👨🏽"
}, {
  expected: "👨🏼‍❤️‍👨🏾",
  actual: "👨🏼‍❤️‍👨🏾"
}, {
  expected: "👨🏼‍❤️‍👨🏿",
  actual: "👨🏼‍❤️‍👨🏿"
}, {
  expected: "👨🏽‍❤️‍👨🏻",
  actual: "👨🏽‍❤️‍👨🏻"
}, {
  expected: "👨🏽‍❤️‍👨🏼",
  actual: "👨🏽‍❤️‍👨🏼"
}, {
  expected: "👨🏽‍❤️‍👨🏽",
  actual: "👨🏽‍❤️‍👨🏽"
}, {
  expected: "👨🏽‍❤️‍👨🏾",
  actual: "👨🏽‍❤️‍👨🏾"
}, {
  expected: "👨🏽‍❤️‍👨🏿",
  actual: "👨🏽‍❤️‍👨🏿"
}, {
  expected: "👨🏾‍❤️‍👨🏻",
  actual: "👨🏾‍❤️‍👨🏻"
}, {
  expected: "👨🏾‍❤️‍👨🏼",
  actual: "👨🏾‍❤️‍👨🏼"
}, {
  expected: "👨🏾‍❤️‍👨🏽",
  actual: "👨🏾‍❤️‍👨🏽"
}, {
  expected: "👨🏾‍❤️‍👨🏾",
  actual: "👨🏾‍❤️‍👨🏾"
}, {
  expected: "👨🏾‍❤️‍👨🏿",
  actual: "👨🏾‍❤️‍👨🏿"
}, {
  expected: "👨🏿‍❤️‍👨🏻",
  actual: "👨🏿‍❤️‍👨🏻"
}, {
  expected: "👨🏿‍❤️‍👨🏼",
  actual: "👨🏿‍❤️‍👨🏼"
}, {
  expected: "👨🏿‍❤️‍👨🏽",
  actual: "👨🏿‍❤️‍👨🏽"
}, {
  expected: "👨🏿‍❤️‍👨🏾",
  actual: "👨🏿‍❤️‍👨🏾"
}, {
  expected: "👨🏿‍❤️‍👨🏿",
  actual: "👨🏿‍❤️‍👨🏿"
}, {
  expected: "👩🏻‍❤️‍👩🏻",
  actual: "👩🏻‍❤️‍👩🏻"
}, {
  expected: "👩🏻‍❤️‍👩🏼",
  actual: "👩🏻‍❤️‍👩🏼"
}, {
  expected: "👩🏻‍❤️‍👩🏽",
  actual: "👩🏻‍❤️‍👩🏽"
}, {
  expected: "👩🏻‍❤️‍👩🏾",
  actual: "👩🏻‍❤️‍👩🏾"
}, {
  expected: "👩🏻‍❤️‍👩🏿",
  actual: "👩🏻‍❤️‍👩🏿"
}, {
  expected: "👩🏼‍❤️‍👩🏻",
  actual: "👩🏼‍❤️‍👩🏻"
}, {
  expected: "👩🏼‍❤️‍👩🏼",
  actual: "👩🏼‍❤️‍👩🏼"
}, {
  expected: "👩🏼‍❤️‍👩🏽",
  actual: "👩🏼‍❤️‍👩🏽"
}, {
  expected: "👩🏼‍❤️‍👩🏾",
  actual: "👩🏼‍❤️‍👩🏾"
}, {
  expected: "👩🏼‍❤️‍👩🏿",
  actual: "👩🏼‍❤️‍👩🏿"
}, {
  expected: "👩🏽‍❤️‍👩🏻",
  actual: "👩🏽‍❤️‍👩🏻"
}, {
  expected: "👩🏽‍❤️‍👩🏼",
  actual: "👩🏽‍❤️‍👩🏼"
}, {
  expected: "👩🏽‍❤️‍👩🏽",
  actual: "👩🏽‍❤️‍👩🏽"
}, {
  expected: "👩🏽‍❤️‍👩🏾",
  actual: "👩🏽‍❤️‍👩🏾"
}, {
  expected: "👩🏽‍❤️‍👩🏿",
  actual: "👩🏽‍❤️‍👩🏿"
}, {
  expected: "👩🏾‍❤️‍👩🏻",
  actual: "👩🏾‍❤️‍👩🏻"
}, {
  expected: "👩🏾‍❤️‍👩🏼",
  actual: "👩🏾‍❤️‍👩🏼"
}, {
  expected: "👩🏾‍❤️‍👩🏽",
  actual: "👩🏾‍❤️‍👩🏽"
}, {
  expected: "👩🏾‍❤️‍👩🏾",
  actual: "👩🏾‍❤️‍👩🏾"
}, {
  expected: "👩🏾‍❤️‍👩🏿",
  actual: "👩🏾‍❤️‍👩🏿"
}, {
  expected: "👩🏿‍❤️‍👩🏻",
  actual: "👩🏿‍❤️‍👩🏻"
}, {
  expected: "👩🏿‍❤️‍👩🏼",
  actual: "👩🏿‍❤️‍👩🏼"
}, {
  expected: "👩🏿‍❤️‍👩🏽",
  actual: "👩🏿‍❤️‍👩🏽"
}, {
  expected: "👩🏿‍❤️‍👩🏾",
  actual: "👩🏿‍❤️‍👩🏾"
}, {
  expected: "👩🏿‍❤️‍👩🏿",
  actual: "👩🏿‍❤️‍👩🏿"
}, {
  expected: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  actual: "🏴󠁧󠁢󠁥󠁮󠁧󠁿"
}, {
  expected: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  actual: "🏴󠁧󠁢󠁳󠁣󠁴󠁿"
}, {
  expected: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  actual: "🏴󠁧󠁢󠁷󠁬󠁳󠁿"
}, {
  expected: "👩‍❤️‍💋‍👨",
  actual: "👩‍❤️‍💋‍👨"
}, {
  expected: "👨‍❤️‍💋‍👨",
  actual: "👨‍❤️‍💋‍👨"
}, {
  expected: "👩‍❤️‍💋‍👩",
  actual: "👩‍❤️‍💋‍👩"
}, {
  expected: "🧑🏻‍🤝‍🧑🏻",
  actual: "🧑🏻‍🤝‍🧑🏻"
}, {
  expected: "🧑🏻‍🤝‍🧑🏼",
  actual: "🧑🏻‍🤝‍🧑🏼"
}, {
  expected: "🧑🏻‍🤝‍🧑🏽",
  actual: "🧑🏻‍🤝‍🧑🏽"
}, {
  expected: "🧑🏻‍🤝‍🧑🏾",
  actual: "🧑🏻‍🤝‍🧑🏾"
}, {
  expected: "🧑🏻‍🤝‍🧑🏿",
  actual: "🧑🏻‍🤝‍🧑🏿"
}, {
  expected: "🧑🏼‍🤝‍🧑🏻",
  actual: "🧑🏼‍🤝‍🧑🏻"
}, {
  expected: "🧑🏼‍🤝‍🧑🏼",
  actual: "🧑🏼‍🤝‍🧑🏼"
}, {
  expected: "🧑🏼‍🤝‍🧑🏽",
  actual: "🧑🏼‍🤝‍🧑🏽"
}, {
  expected: "🧑🏼‍🤝‍🧑🏾",
  actual: "🧑🏼‍🤝‍🧑🏾"
}, {
  expected: "🧑🏼‍🤝‍🧑🏿",
  actual: "🧑🏼‍🤝‍🧑🏿"
}, {
  expected: "🧑🏽‍🤝‍🧑🏻",
  actual: "🧑🏽‍🤝‍🧑🏻"
}, {
  expected: "🧑🏽‍🤝‍🧑🏼",
  actual: "🧑🏽‍🤝‍🧑🏼"
}, {
  expected: "🧑🏽‍🤝‍🧑🏽",
  actual: "🧑🏽‍🤝‍🧑🏽"
}, {
  expected: "🧑🏽‍🤝‍🧑🏾",
  actual: "🧑🏽‍🤝‍🧑🏾"
}, {
  expected: "🧑🏽‍🤝‍🧑🏿",
  actual: "🧑🏽‍🤝‍🧑🏿"
}, {
  expected: "🧑🏾‍🤝‍🧑🏻",
  actual: "🧑🏾‍🤝‍🧑🏻"
}, {
  expected: "🧑🏾‍🤝‍🧑🏼",
  actual: "🧑🏾‍🤝‍🧑🏼"
}, {
  expected: "🧑🏾‍🤝‍🧑🏽",
  actual: "🧑🏾‍🤝‍🧑🏽"
}, {
  expected: "🧑🏾‍🤝‍🧑🏾",
  actual: "🧑🏾‍🤝‍🧑🏾"
}, {
  expected: "🧑🏾‍🤝‍🧑🏿",
  actual: "🧑🏾‍🤝‍🧑🏿"
}, {
  expected: "🧑🏿‍🤝‍🧑🏻",
  actual: "🧑🏿‍🤝‍🧑🏻"
}, {
  expected: "🧑🏿‍🤝‍🧑🏼",
  actual: "🧑🏿‍🤝‍🧑🏼"
}, {
  expected: "🧑🏿‍🤝‍🧑🏽",
  actual: "🧑🏿‍🤝‍🧑🏽"
}, {
  expected: "🧑🏿‍🤝‍🧑🏾",
  actual: "🧑🏿‍🤝‍🧑🏾"
}, {
  expected: "🧑🏿‍🤝‍🧑🏿",
  actual: "🧑🏿‍🤝‍🧑🏿"
}, {
  expected: "👩🏻‍🤝‍👩🏼",
  actual: "👩🏻‍🤝‍👩🏼"
}, {
  expected: "👩🏻‍🤝‍👩🏽",
  actual: "👩🏻‍🤝‍👩🏽"
}, {
  expected: "👩🏻‍🤝‍👩🏾",
  actual: "👩🏻‍🤝‍👩🏾"
}, {
  expected: "👩🏻‍🤝‍👩🏿",
  actual: "👩🏻‍🤝‍👩🏿"
}, {
  expected: "👩🏼‍🤝‍👩🏻",
  actual: "👩🏼‍🤝‍👩🏻"
}, {
  expected: "👩🏼‍🤝‍👩🏽",
  actual: "👩🏼‍🤝‍👩🏽"
}, {
  expected: "👩🏼‍🤝‍👩🏾",
  actual: "👩🏼‍🤝‍👩🏾"
}, {
  expected: "👩🏼‍🤝‍👩🏿",
  actual: "👩🏼‍🤝‍👩🏿"
}, {
  expected: "👩🏽‍🤝‍👩🏻",
  actual: "👩🏽‍🤝‍👩🏻"
}, {
  expected: "👩🏽‍🤝‍👩🏼",
  actual: "👩🏽‍🤝‍👩🏼"
}, {
  expected: "👩🏽‍🤝‍👩🏾",
  actual: "👩🏽‍🤝‍👩🏾"
}, {
  expected: "👩🏽‍🤝‍👩🏿",
  actual: "👩🏽‍🤝‍👩🏿"
}, {
  expected: "👩🏾‍🤝‍👩🏻",
  actual: "👩🏾‍🤝‍👩🏻"
}, {
  expected: "👩🏾‍🤝‍👩🏼",
  actual: "👩🏾‍🤝‍👩🏼"
}, {
  expected: "👩🏾‍🤝‍👩🏽",
  actual: "👩🏾‍🤝‍👩🏽"
}, {
  expected: "👩🏾‍🤝‍👩🏿",
  actual: "👩🏾‍🤝‍👩🏿"
}, {
  expected: "👩🏿‍🤝‍👩🏻",
  actual: "👩🏿‍🤝‍👩🏻"
}, {
  expected: "👩🏿‍🤝‍👩🏼",
  actual: "👩🏿‍🤝‍👩🏼"
}, {
  expected: "👩🏿‍🤝‍👩🏽",
  actual: "👩🏿‍🤝‍👩🏽"
}, {
  expected: "👩🏿‍🤝‍👩🏾",
  actual: "👩🏿‍🤝‍👩🏾"
}, {
  expected: "👩🏻‍🤝‍👨🏼",
  actual: "👩🏻‍🤝‍👨🏼"
}, {
  expected: "👩🏻‍🤝‍👨🏽",
  actual: "👩🏻‍🤝‍👨🏽"
}, {
  expected: "👩🏻‍🤝‍👨🏾",
  actual: "👩🏻‍🤝‍👨🏾"
}, {
  expected: "👩🏻‍🤝‍👨🏿",
  actual: "👩🏻‍🤝‍👨🏿"
}, {
  expected: "👩🏼‍🤝‍👨🏻",
  actual: "👩🏼‍🤝‍👨🏻"
}, {
  expected: "👩🏼‍🤝‍👨🏽",
  actual: "👩🏼‍🤝‍👨🏽"
}, {
  expected: "👩🏼‍🤝‍👨🏾",
  actual: "👩🏼‍🤝‍👨🏾"
}, {
  expected: "👩🏼‍🤝‍👨🏿",
  actual: "👩🏼‍🤝‍👨🏿"
}, {
  expected: "👩🏽‍🤝‍👨🏻",
  actual: "👩🏽‍🤝‍👨🏻"
}, {
  expected: "👩🏽‍🤝‍👨🏼",
  actual: "👩🏽‍🤝‍👨🏼"
}, {
  expected: "👩🏽‍🤝‍👨🏾",
  actual: "👩🏽‍🤝‍👨🏾"
}, {
  expected: "👩🏽‍🤝‍👨🏿",
  actual: "👩🏽‍🤝‍👨🏿"
}, {
  expected: "👩🏾‍🤝‍👨🏻",
  actual: "👩🏾‍🤝‍👨🏻"
}, {
  expected: "👩🏾‍🤝‍👨🏼",
  actual: "👩🏾‍🤝‍👨🏼"
}, {
  expected: "👩🏾‍🤝‍👨🏽",
  actual: "👩🏾‍🤝‍👨🏽"
}, {
  expected: "👩🏾‍🤝‍👨🏿",
  actual: "👩🏾‍🤝‍👨🏿"
}, {
  expected: "👩🏿‍🤝‍👨🏻",
  actual: "👩🏿‍🤝‍👨🏻"
}, {
  expected: "👩🏿‍🤝‍👨🏼",
  actual: "👩🏿‍🤝‍👨🏼"
}, {
  expected: "👩🏿‍🤝‍👨🏽",
  actual: "👩🏿‍🤝‍👨🏽"
}, {
  expected: "👩🏿‍🤝‍👨🏾",
  actual: "👩🏿‍🤝‍👨🏾"
}, {
  expected: "👨🏻‍🤝‍👨🏼",
  actual: "👨🏻‍🤝‍👨🏼"
}, {
  expected: "👨🏻‍🤝‍👨🏽",
  actual: "👨🏻‍🤝‍👨🏽"
}, {
  expected: "👨🏻‍🤝‍👨🏾",
  actual: "👨🏻‍🤝‍👨🏾"
}, {
  expected: "👨🏻‍🤝‍👨🏿",
  actual: "👨🏻‍🤝‍👨🏿"
}, {
  expected: "👨🏼‍🤝‍👨🏻",
  actual: "👨🏼‍🤝‍👨🏻"
}, {
  expected: "👨🏼‍🤝‍👨🏽",
  actual: "👨🏼‍🤝‍👨🏽"
}, {
  expected: "👨🏼‍🤝‍👨🏾",
  actual: "👨🏼‍🤝‍👨🏾"
}, {
  expected: "👨🏼‍🤝‍👨🏿",
  actual: "👨🏼‍🤝‍👨🏿"
}, {
  expected: "👨🏽‍🤝‍👨🏻",
  actual: "👨🏽‍🤝‍👨🏻"
}, {
  expected: "👨🏽‍🤝‍👨🏼",
  actual: "👨🏽‍🤝‍👨🏼"
}, {
  expected: "👨🏽‍🤝‍👨🏾",
  actual: "👨🏽‍🤝‍👨🏾"
}, {
  expected: "👨🏽‍🤝‍👨🏿",
  actual: "👨🏽‍🤝‍👨🏿"
}, {
  expected: "👨🏾‍🤝‍👨🏻",
  actual: "👨🏾‍🤝‍👨🏻"
}, {
  expected: "👨🏾‍🤝‍👨🏼",
  actual: "👨🏾‍🤝‍👨🏼"
}, {
  expected: "👨🏾‍🤝‍👨🏽",
  actual: "👨🏾‍🤝‍👨🏽"
}, {
  expected: "👨🏾‍🤝‍👨🏿",
  actual: "👨🏾‍🤝‍👨🏿"
}, {
  expected: "👨🏿‍🤝‍👨🏻",
  actual: "👨🏿‍🤝‍👨🏻"
}, {
  expected: "👨🏿‍🤝‍👨🏼",
  actual: "👨🏿‍🤝‍👨🏼"
}, {
  expected: "👨🏿‍🤝‍👨🏽",
  actual: "👨🏿‍🤝‍👨🏽"
}, {
  expected: "👨🏿‍🤝‍👨🏾",
  actual: "👨🏿‍🤝‍👨🏾"
}, {
  expected: "🧑🏻‍❤‍🧑🏼",
  actual: "🧑🏻‍❤‍🧑🏼"
}, {
  expected: "🧑🏻‍❤‍🧑🏽",
  actual: "🧑🏻‍❤‍🧑🏽"
}, {
  expected: "🧑🏻‍❤‍🧑🏾",
  actual: "🧑🏻‍❤‍🧑🏾"
}, {
  expected: "🧑🏻‍❤‍🧑🏿",
  actual: "🧑🏻‍❤‍🧑🏿"
}, {
  expected: "🧑🏼‍❤‍🧑🏻",
  actual: "🧑🏼‍❤‍🧑🏻"
}, {
  expected: "🧑🏼‍❤‍🧑🏽",
  actual: "🧑🏼‍❤‍🧑🏽"
}, {
  expected: "🧑🏼‍❤‍🧑🏾",
  actual: "🧑🏼‍❤‍🧑🏾"
}, {
  expected: "🧑🏼‍❤‍🧑🏿",
  actual: "🧑🏼‍❤‍🧑🏿"
}, {
  expected: "🧑🏽‍❤‍🧑🏻",
  actual: "🧑🏽‍❤‍🧑🏻"
}, {
  expected: "🧑🏽‍❤‍🧑🏼",
  actual: "🧑🏽‍❤‍🧑🏼"
}, {
  expected: "🧑🏽‍❤‍🧑🏾",
  actual: "🧑🏽‍❤‍🧑🏾"
}, {
  expected: "🧑🏽‍❤‍🧑🏿",
  actual: "🧑🏽‍❤‍🧑🏿"
}, {
  expected: "🧑🏾‍❤‍🧑🏻",
  actual: "🧑🏾‍❤‍🧑🏻"
}, {
  expected: "🧑🏾‍❤‍🧑🏼",
  actual: "🧑🏾‍❤‍🧑🏼"
}, {
  expected: "🧑🏾‍❤‍🧑🏽",
  actual: "🧑🏾‍❤‍🧑🏽"
}, {
  expected: "🧑🏾‍❤‍🧑🏿",
  actual: "🧑🏾‍❤‍🧑🏿"
}, {
  expected: "🧑🏿‍❤‍🧑🏻",
  actual: "🧑🏿‍❤‍🧑🏻"
}, {
  expected: "🧑🏿‍❤‍🧑🏼",
  actual: "🧑🏿‍❤‍🧑🏼"
}, {
  expected: "🧑🏿‍❤‍🧑🏽",
  actual: "🧑🏿‍❤‍🧑🏽"
}, {
  expected: "🧑🏿‍❤‍🧑🏾",
  actual: "🧑🏿‍❤‍🧑🏾"
}, {
  expected: "👩🏻‍❤‍👨🏻",
  actual: "👩🏻‍❤‍👨🏻"
}, {
  expected: "👩🏻‍❤‍👨🏼",
  actual: "👩🏻‍❤‍👨🏼"
}, {
  expected: "👩🏻‍❤‍👨🏽",
  actual: "👩🏻‍❤‍👨🏽"
}, {
  expected: "👩🏻‍❤‍👨🏾",
  actual: "👩🏻‍❤‍👨🏾"
}, {
  expected: "👩🏻‍❤‍👨🏿",
  actual: "👩🏻‍❤‍👨🏿"
}, {
  expected: "👩🏼‍❤‍👨🏻",
  actual: "👩🏼‍❤‍👨🏻"
}, {
  expected: "👩🏼‍❤‍👨🏼",
  actual: "👩🏼‍❤‍👨🏼"
}, {
  expected: "👩🏼‍❤‍👨🏽",
  actual: "👩🏼‍❤‍👨🏽"
}, {
  expected: "👩🏼‍❤‍👨🏾",
  actual: "👩🏼‍❤‍👨🏾"
}, {
  expected: "👩🏼‍❤‍👨🏿",
  actual: "👩🏼‍❤‍👨🏿"
}, {
  expected: "👩🏽‍❤‍👨🏻",
  actual: "👩🏽‍❤‍👨🏻"
}, {
  expected: "👩🏽‍❤‍👨🏼",
  actual: "👩🏽‍❤‍👨🏼"
}, {
  expected: "👩🏽‍❤‍👨🏽",
  actual: "👩🏽‍❤‍👨🏽"
}, {
  expected: "👩🏽‍❤‍👨🏾",
  actual: "👩🏽‍❤‍👨🏾"
}, {
  expected: "👩🏽‍❤‍👨🏿",
  actual: "👩🏽‍❤‍👨🏿"
}, {
  expected: "👩🏾‍❤‍👨🏻",
  actual: "👩🏾‍❤‍👨🏻"
}, {
  expected: "👩🏾‍❤‍👨🏼",
  actual: "👩🏾‍❤‍👨🏼"
}, {
  expected: "👩🏾‍❤‍👨🏽",
  actual: "👩🏾‍❤‍👨🏽"
}, {
  expected: "👩🏾‍❤‍👨🏾",
  actual: "👩🏾‍❤‍👨🏾"
}, {
  expected: "👩🏾‍❤‍👨🏿",
  actual: "👩🏾‍❤‍👨🏿"
}, {
  expected: "👩🏿‍❤‍👨🏻",
  actual: "👩🏿‍❤‍👨🏻"
}, {
  expected: "👩🏿‍❤‍👨🏼",
  actual: "👩🏿‍❤‍👨🏼"
}, {
  expected: "👩🏿‍❤‍👨🏽",
  actual: "👩🏿‍❤‍👨🏽"
}, {
  expected: "👩🏿‍❤‍👨🏾",
  actual: "👩🏿‍❤‍👨🏾"
}, {
  expected: "👩🏿‍❤‍👨🏿",
  actual: "👩🏿‍❤‍👨🏿"
}, {
  expected: "👨🏻‍❤‍👨🏻",
  actual: "👨🏻‍❤‍👨🏻"
}, {
  expected: "👨🏻‍❤‍👨🏼",
  actual: "👨🏻‍❤‍👨🏼"
}, {
  expected: "👨🏻‍❤‍👨🏽",
  actual: "👨🏻‍❤‍👨🏽"
}, {
  expected: "👨🏻‍❤‍👨🏾",
  actual: "👨🏻‍❤‍👨🏾"
}, {
  expected: "👨🏻‍❤‍👨🏿",
  actual: "👨🏻‍❤‍👨🏿"
}, {
  expected: "👨🏼‍❤‍👨🏻",
  actual: "👨🏼‍❤‍👨🏻"
}, {
  expected: "👨🏼‍❤‍👨🏼",
  actual: "👨🏼‍❤‍👨🏼"
}, {
  expected: "👨🏼‍❤‍👨🏽",
  actual: "👨🏼‍❤‍👨🏽"
}, {
  expected: "👨🏼‍❤‍👨🏾",
  actual: "👨🏼‍❤‍👨🏾"
}, {
  expected: "👨🏼‍❤‍👨🏿",
  actual: "👨🏼‍❤‍👨🏿"
}, {
  expected: "👨🏽‍❤‍👨🏻",
  actual: "👨🏽‍❤‍👨🏻"
}, {
  expected: "👨🏽‍❤‍👨🏼",
  actual: "👨🏽‍❤‍👨🏼"
}, {
  expected: "👨🏽‍❤‍👨🏽",
  actual: "👨🏽‍❤‍👨🏽"
}, {
  expected: "👨🏽‍❤‍👨🏾",
  actual: "👨🏽‍❤‍👨🏾"
}, {
  expected: "👨🏽‍❤‍👨🏿",
  actual: "👨🏽‍❤‍👨🏿"
}, {
  expected: "👨🏾‍❤‍👨🏻",
  actual: "👨🏾‍❤‍👨🏻"
}, {
  expected: "👨🏾‍❤‍👨🏼",
  actual: "👨🏾‍❤‍👨🏼"
}, {
  expected: "👨🏾‍❤‍👨🏽",
  actual: "👨🏾‍❤‍👨🏽"
}, {
  expected: "👨🏾‍❤‍👨🏾",
  actual: "👨🏾‍❤‍👨🏾"
}, {
  expected: "👨🏾‍❤‍👨🏿",
  actual: "👨🏾‍❤‍👨🏿"
}, {
  expected: "👨🏿‍❤‍👨🏻",
  actual: "👨🏿‍❤‍👨🏻"
}, {
  expected: "👨🏿‍❤‍👨🏼",
  actual: "👨🏿‍❤‍👨🏼"
}, {
  expected: "👨🏿‍❤‍👨🏽",
  actual: "👨🏿‍❤‍👨🏽"
}, {
  expected: "👨🏿‍❤‍👨🏾",
  actual: "👨🏿‍❤‍👨🏾"
}, {
  expected: "👨🏿‍❤‍👨🏿",
  actual: "👨🏿‍❤‍👨🏿"
}, {
  expected: "👩🏻‍❤‍👩🏻",
  actual: "👩🏻‍❤‍👩🏻"
}, {
  expected: "👩🏻‍❤‍👩🏼",
  actual: "👩🏻‍❤‍👩🏼"
}, {
  expected: "👩🏻‍❤‍👩🏽",
  actual: "👩🏻‍❤‍👩🏽"
}, {
  expected: "👩🏻‍❤‍👩🏾",
  actual: "👩🏻‍❤‍👩🏾"
}, {
  expected: "👩🏻‍❤‍👩🏿",
  actual: "👩🏻‍❤‍👩🏿"
}, {
  expected: "👩🏼‍❤‍👩🏻",
  actual: "👩🏼‍❤‍👩🏻"
}, {
  expected: "👩🏼‍❤‍👩🏼",
  actual: "👩🏼‍❤‍👩🏼"
}, {
  expected: "👩🏼‍❤‍👩🏽",
  actual: "👩🏼‍❤‍👩🏽"
}, {
  expected: "👩🏼‍❤‍👩🏾",
  actual: "👩🏼‍❤‍👩🏾"
}, {
  expected: "👩🏼‍❤‍👩🏿",
  actual: "👩🏼‍❤‍👩🏿"
}, {
  expected: "👩🏽‍❤‍👩🏻",
  actual: "👩🏽‍❤‍👩🏻"
}, {
  expected: "👩🏽‍❤‍👩🏼",
  actual: "👩🏽‍❤‍👩🏼"
}, {
  expected: "👩🏽‍❤‍👩🏽",
  actual: "👩🏽‍❤‍👩🏽"
}, {
  expected: "👩🏽‍❤‍👩🏾",
  actual: "👩🏽‍❤‍👩🏾"
}, {
  expected: "👩🏽‍❤‍👩🏿",
  actual: "👩🏽‍❤‍👩🏿"
}, {
  expected: "👩🏾‍❤‍👩🏻",
  actual: "👩🏾‍❤‍👩🏻"
}, {
  expected: "👩🏾‍❤‍👩🏼",
  actual: "👩🏾‍❤‍👩🏼"
}, {
  expected: "👩🏾‍❤‍👩🏽",
  actual: "👩🏾‍❤‍👩🏽"
}, {
  expected: "👩🏾‍❤‍👩🏾",
  actual: "👩🏾‍❤‍👩🏾"
}, {
  expected: "👩🏾‍❤‍👩🏿",
  actual: "👩🏾‍❤‍👩🏿"
}, {
  expected: "👩🏿‍❤‍👩🏻",
  actual: "👩🏿‍❤‍👩🏻"
}, {
  expected: "👩🏿‍❤‍👩🏼",
  actual: "👩🏿‍❤‍👩🏼"
}, {
  expected: "👩🏿‍❤‍👩🏽",
  actual: "👩🏿‍❤‍👩🏽"
}, {
  expected: "👩🏿‍❤‍👩🏾",
  actual: "👩🏿‍❤‍👩🏾"
}, {
  expected: "👩🏿‍❤‍👩🏿",
  actual: "👩🏿‍❤‍👩🏿"
}, {
  expected: "👨‍👩‍👧‍👦",
  actual: "👨‍👩‍👧‍👦"
}, {
  expected: "👨‍👩‍👦‍👦",
  actual: "👨‍👩‍👦‍👦"
}, {
  expected: "👨‍👩‍👧‍👧",
  actual: "👨‍👩‍👧‍👧"
}, {
  expected: "👨‍👨‍👧‍👦",
  actual: "👨‍👨‍👧‍👦"
}, {
  expected: "👨‍👨‍👦‍👦",
  actual: "👨‍👨‍👦‍👦"
}, {
  expected: "👨‍👨‍👧‍👧",
  actual: "👨‍👨‍👧‍👧"
}, {
  expected: "👩‍👩‍👧‍👦",
  actual: "👩‍👩‍👧‍👦"
}, {
  expected: "👩‍👩‍👦‍👦",
  actual: "👩‍👩‍👦‍👦"
}, {
  expected: "👩‍👩‍👧‍👧",
  actual: "👩‍👩‍👧‍👧"
}, {
  expected: "👩‍❤‍💋‍👨",
  actual: "👩‍❤‍💋‍👨"
}, {
  expected: "👨‍❤‍💋‍👨",
  actual: "👨‍❤‍💋‍👨"
}, {
  expected: "👩‍❤‍💋‍👩",
  actual: "👩‍❤‍💋‍👩"
}, {
  expected: "🧑🏻‍❤️‍💋‍🧑🏼",
  actual: "🧑🏻❤💋🧑🏼"
}, {
  expected: "🧑🏻‍❤️‍💋‍🧑🏽",
  actual: "🧑🏻❤💋🧑🏽"
}, {
  expected: "🧑🏻‍❤️‍💋‍🧑🏾",
  actual: "🧑🏻❤💋🧑🏾"
}, {
  expected: "🧑🏻‍❤️‍💋‍🧑🏿",
  actual: "🧑🏻❤💋🧑🏿"
}, {
  expected: "🧑🏼‍❤️‍💋‍🧑🏻",
  actual: "🧑🏼❤💋🧑🏻"
}, {
  expected: "🧑🏼‍❤️‍💋‍🧑🏽",
  actual: "🧑🏼❤💋🧑🏽"
}, {
  expected: "🧑🏼‍❤️‍💋‍🧑🏾",
  actual: "🧑🏼❤💋🧑🏾"
}, {
  expected: "🧑🏼‍❤️‍💋‍🧑🏿",
  actual: "🧑🏼❤💋🧑🏿"
}, {
  expected: "🧑🏽‍❤️‍💋‍🧑🏻",
  actual: "🧑🏽❤💋🧑🏻"
}, {
  expected: "🧑🏽‍❤️‍💋‍🧑🏼",
  actual: "🧑🏽❤💋🧑🏼"
}, {
  expected: "🧑🏽‍❤️‍💋‍🧑🏾",
  actual: "🧑🏽❤💋🧑🏾"
}, {
  expected: "🧑🏽‍❤️‍💋‍🧑🏿",
  actual: "🧑🏽❤💋🧑🏿"
}, {
  expected: "🧑🏾‍❤️‍💋‍🧑🏻",
  actual: "🧑🏾❤💋🧑🏻"
}, {
  expected: "🧑🏾‍❤️‍💋‍🧑🏼",
  actual: "🧑🏾❤💋🧑🏼"
}, {
  expected: "🧑🏾‍❤️‍💋‍🧑🏽",
  actual: "🧑🏾❤💋🧑🏽"
}, {
  expected: "🧑🏾‍❤️‍💋‍🧑🏿",
  actual: "🧑🏾❤💋🧑🏿"
}, {
  expected: "🧑🏿‍❤️‍💋‍🧑🏻",
  actual: "🧑🏿❤💋🧑🏻"
}, {
  expected: "🧑🏿‍❤️‍💋‍🧑🏼",
  actual: "🧑🏿❤💋🧑🏼"
}, {
  expected: "🧑🏿‍❤️‍💋‍🧑🏽",
  actual: "🧑🏿❤💋🧑🏽"
}, {
  expected: "🧑🏿‍❤️‍💋‍🧑🏾",
  actual: "🧑🏿❤💋🧑🏾"
}, {
  expected: "👩🏻‍❤️‍💋‍👨🏻",
  actual: "👩🏻❤💋👨🏻"
}, {
  expected: "👩🏻‍❤️‍💋‍👨🏼",
  actual: "👩🏻❤💋👨🏼"
}, {
  expected: "👩🏻‍❤️‍💋‍👨🏽",
  actual: "👩🏻❤💋👨🏽"
}, {
  expected: "👩🏻‍❤️‍💋‍👨🏾",
  actual: "👩🏻❤💋👨🏾"
}, {
  expected: "👩🏻‍❤️‍💋‍👨🏿",
  actual: "👩🏻❤💋👨🏿"
}, {
  expected: "👩🏼‍❤️‍💋‍👨🏻",
  actual: "👩🏼❤💋👨🏻"
}, {
  expected: "👩🏼‍❤️‍💋‍👨🏼",
  actual: "👩🏼❤💋👨🏼"
}, {
  expected: "👩🏼‍❤️‍💋‍👨🏽",
  actual: "👩🏼❤💋👨🏽"
}, {
  expected: "👩🏼‍❤️‍💋‍👨🏾",
  actual: "👩🏼❤💋👨🏾"
}, {
  expected: "👩🏼‍❤️‍💋‍👨🏿",
  actual: "👩🏼❤💋👨🏿"
}, {
  expected: "👩🏽‍❤️‍💋‍👨🏻",
  actual: "👩🏽❤💋👨🏻"
}, {
  expected: "👩🏽‍❤️‍💋‍👨🏼",
  actual: "👩🏽❤💋👨🏼"
}, {
  expected: "👩🏽‍❤️‍💋‍👨🏽",
  actual: "👩🏽❤💋👨🏽"
}, {
  expected: "👩🏽‍❤️‍💋‍👨🏾",
  actual: "👩🏽❤💋👨🏾"
}, {
  expected: "👩🏽‍❤️‍💋‍👨🏿",
  actual: "👩🏽❤💋👨🏿"
}, {
  expected: "👩🏾‍❤️‍💋‍👨🏻",
  actual: "👩🏾❤💋👨🏻"
}, {
  expected: "👩🏾‍❤️‍💋‍👨🏼",
  actual: "👩🏾❤💋👨🏼"
}, {
  expected: "👩🏾‍❤️‍💋‍👨🏽",
  actual: "👩🏾❤💋👨🏽"
}, {
  expected: "👩🏾‍❤️‍💋‍👨🏾",
  actual: "👩🏾❤💋👨🏾"
}, {
  expected: "👩🏾‍❤️‍💋‍👨🏿",
  actual: "👩🏾❤💋👨🏿"
}, {
  expected: "👩🏿‍❤️‍💋‍👨🏻",
  actual: "👩🏿❤💋👨🏻"
}, {
  expected: "👩🏿‍❤️‍💋‍👨🏼",
  actual: "👩🏿❤💋👨🏼"
}, {
  expected: "👩🏿‍❤️‍💋‍👨🏽",
  actual: "👩🏿❤💋👨🏽"
}, {
  expected: "👩🏿‍❤️‍💋‍👨🏾",
  actual: "👩🏿❤💋👨🏾"
}, {
  expected: "👩🏿‍❤️‍💋‍👨🏿",
  actual: "👩🏿❤💋👨🏿"
}, {
  expected: "👨🏻‍❤️‍💋‍👨🏻",
  actual: "👨🏻❤💋👨🏻"
}, {
  expected: "👨🏻‍❤️‍💋‍👨🏼",
  actual: "👨🏻❤💋👨🏼"
}, {
  expected: "👨🏻‍❤️‍💋‍👨🏽",
  actual: "👨🏻❤💋👨🏽"
}, {
  expected: "👨🏻‍❤️‍💋‍👨🏾",
  actual: "👨🏻❤💋👨🏾"
}, {
  expected: "👨🏻‍❤️‍💋‍👨🏿",
  actual: "👨🏻❤💋👨🏿"
}, {
  expected: "👨🏼‍❤️‍💋‍👨🏻",
  actual: "👨🏼❤💋👨🏻"
}, {
  expected: "👨🏼‍❤️‍💋‍👨🏼",
  actual: "👨🏼❤💋👨🏼"
}, {
  expected: "👨🏼‍❤️‍💋‍👨🏽",
  actual: "👨🏼❤💋👨🏽"
}, {
  expected: "👨🏼‍❤️‍💋‍👨🏾",
  actual: "👨🏼❤💋👨🏾"
}, {
  expected: "👨🏼‍❤️‍💋‍👨🏿",
  actual: "👨🏼❤💋👨🏿"
}, {
  expected: "👨🏽‍❤️‍💋‍👨🏻",
  actual: "👨🏽❤💋👨🏻"
}, {
  expected: "👨🏽‍❤️‍💋‍👨🏼",
  actual: "👨🏽❤💋👨🏼"
}, {
  expected: "👨🏽‍❤️‍💋‍👨🏽",
  actual: "👨🏽❤💋👨🏽"
}, {
  expected: "👨🏽‍❤️‍💋‍👨🏾",
  actual: "👨🏽❤💋👨🏾"
}, {
  expected: "👨🏽‍❤️‍💋‍👨🏿",
  actual: "👨🏽❤💋👨🏿"
}, {
  expected: "👨🏾‍❤️‍💋‍👨🏻",
  actual: "👨🏾❤💋👨🏻"
}, {
  expected: "👨🏾‍❤️‍💋‍👨🏼",
  actual: "👨🏾❤💋👨🏼"
}, {
  expected: "👨🏾‍❤️‍💋‍👨🏽",
  actual: "👨🏾❤💋👨🏽"
}, {
  expected: "👨🏾‍❤️‍💋‍👨🏾",
  actual: "👨🏾❤💋👨🏾"
}, {
  expected: "👨🏾‍❤️‍💋‍👨🏿",
  actual: "👨🏾❤💋👨🏿"
}, {
  expected: "👨🏿‍❤️‍💋‍👨🏻",
  actual: "👨🏿❤💋👨🏻"
}, {
  expected: "👨🏿‍❤️‍💋‍👨🏼",
  actual: "👨🏿❤💋👨🏼"
}, {
  expected: "👨🏿‍❤️‍💋‍👨🏽",
  actual: "👨🏿❤💋👨🏽"
}, {
  expected: "👨🏿‍❤️‍💋‍👨🏾",
  actual: "👨🏿❤💋👨🏾"
}, {
  expected: "👨🏿‍❤️‍💋‍👨🏿",
  actual: "👨🏿❤💋👨🏿"
}, {
  expected: "👩🏻‍❤️‍💋‍👩🏻",
  actual: "👩🏻❤💋👩🏻"
}, {
  expected: "👩🏻‍❤️‍💋‍👩🏼",
  actual: "👩🏻❤💋👩🏼"
}, {
  expected: "👩🏻‍❤️‍💋‍👩🏽",
  actual: "👩🏻❤💋👩🏽"
}, {
  expected: "👩🏻‍❤️‍💋‍👩🏾",
  actual: "👩🏻❤💋👩🏾"
}, {
  expected: "👩🏻‍❤️‍💋‍👩🏿",
  actual: "👩🏻❤💋👩🏿"
}, {
  expected: "👩🏼‍❤️‍💋‍👩🏻",
  actual: "👩🏼❤💋👩🏻"
}, {
  expected: "👩🏼‍❤️‍💋‍👩🏼",
  actual: "👩🏼❤💋👩🏼"
}, {
  expected: "👩🏼‍❤️‍💋‍👩🏽",
  actual: "👩🏼❤💋👩🏽"
}, {
  expected: "👩🏼‍❤️‍💋‍👩🏾",
  actual: "👩🏼❤💋👩🏾"
}, {
  expected: "👩🏼‍❤️‍💋‍👩🏿",
  actual: "👩🏼❤💋👩🏿"
}, {
  expected: "👩🏽‍❤️‍💋‍👩🏻",
  actual: "👩🏽❤💋👩🏻"
}, {
  expected: "👩🏽‍❤️‍💋‍👩🏼",
  actual: "👩🏽❤💋👩🏼"
}, {
  expected: "👩🏽‍❤️‍💋‍👩🏽",
  actual: "👩🏽❤💋👩🏽"
}, {
  expected: "👩🏽‍❤️‍💋‍👩🏾",
  actual: "👩🏽❤💋👩🏾"
}, {
  expected: "👩🏽‍❤️‍💋‍👩🏿",
  actual: "👩🏽❤💋👩🏿"
}, {
  expected: "👩🏾‍❤️‍💋‍👩🏻",
  actual: "👩🏾❤💋👩🏻"
}, {
  expected: "👩🏾‍❤️‍💋‍👩🏼",
  actual: "👩🏾❤💋👩🏼"
}, {
  expected: "👩🏾‍❤️‍💋‍👩🏽",
  actual: "👩🏾❤💋👩🏽"
}, {
  expected: "👩🏾‍❤️‍💋‍👩🏾",
  actual: "👩🏾❤💋👩🏾"
}, {
  expected: "👩🏾‍❤️‍💋‍👩🏿",
  actual: "👩🏾❤💋👩🏿"
}, {
  expected: "👩🏿‍❤️‍💋‍👩🏻",
  actual: "👩🏿❤💋👩🏻"
}, {
  expected: "👩🏿‍❤️‍💋‍👩🏼",
  actual: "👩🏿❤💋👩🏼"
}, {
  expected: "👩🏿‍❤️‍💋‍👩🏽",
  actual: "👩🏿❤💋👩🏽"
}, {
  expected: "👩🏿‍❤️‍💋‍👩🏾",
  actual: "👩🏿❤💋👩🏾"
}, {
  expected: "👩🏿‍❤️‍💋‍👩🏿",
  actual: "👩🏿❤💋👩🏿"
}, {
  expected: "🧑🏻‍🤝‍🧑🏻",
  actual: "🧑🏻🤝🧑🏻"
}, {
  expected: "🧑🏻‍🤝‍🧑🏼",
  actual: "🧑🏻🤝🧑🏼"
}, {
  expected: "🧑🏻‍🤝‍🧑🏽",
  actual: "🧑🏻🤝🧑🏽"
}, {
  expected: "🧑🏻‍🤝‍🧑🏾",
  actual: "🧑🏻🤝🧑🏾"
}, {
  expected: "🧑🏻‍🤝‍🧑🏿",
  actual: "🧑🏻🤝🧑🏿"
}, {
  expected: "🧑🏼‍🤝‍🧑🏻",
  actual: "🧑🏼🤝🧑🏻"
}, {
  expected: "🧑🏼‍🤝‍🧑🏼",
  actual: "🧑🏼🤝🧑🏼"
}, {
  expected: "🧑🏼‍🤝‍🧑🏽",
  actual: "🧑🏼🤝🧑🏽"
}, {
  expected: "🧑🏼‍🤝‍🧑🏾",
  actual: "🧑🏼🤝🧑🏾"
}, {
  expected: "🧑🏼‍🤝‍🧑🏿",
  actual: "🧑🏼🤝🧑🏿"
}, {
  expected: "🧑🏽‍🤝‍🧑🏻",
  actual: "🧑🏽🤝🧑🏻"
}, {
  expected: "🧑🏽‍🤝‍🧑🏼",
  actual: "🧑🏽🤝🧑🏼"
}, {
  expected: "🧑🏽‍🤝‍🧑🏽",
  actual: "🧑🏽🤝🧑🏽"
}, {
  expected: "🧑🏽‍🤝‍🧑🏾",
  actual: "🧑🏽🤝🧑🏾"
}, {
  expected: "🧑🏽‍🤝‍🧑🏿",
  actual: "🧑🏽🤝🧑🏿"
}, {
  expected: "🧑🏾‍🤝‍🧑🏻",
  actual: "🧑🏾🤝🧑🏻"
}, {
  expected: "🧑🏾‍🤝‍🧑🏼",
  actual: "🧑🏾🤝🧑🏼"
}, {
  expected: "🧑🏾‍🤝‍🧑🏽",
  actual: "🧑🏾🤝🧑🏽"
}, {
  expected: "🧑🏾‍🤝‍🧑🏾",
  actual: "🧑🏾🤝🧑🏾"
}, {
  expected: "🧑🏾‍🤝‍🧑🏿",
  actual: "🧑🏾🤝🧑🏿"
}, {
  expected: "🧑🏿‍🤝‍🧑🏻",
  actual: "🧑🏿🤝🧑🏻"
}, {
  expected: "🧑🏿‍🤝‍🧑🏼",
  actual: "🧑🏿🤝🧑🏼"
}, {
  expected: "🧑🏿‍🤝‍🧑🏽",
  actual: "🧑🏿🤝🧑🏽"
}, {
  expected: "🧑🏿‍🤝‍🧑🏾",
  actual: "🧑🏿🤝🧑🏾"
}, {
  expected: "🧑🏿‍🤝‍🧑🏿",
  actual: "🧑🏿🤝🧑🏿"
}, {
  expected: "👩🏻‍🤝‍👩🏼",
  actual: "👩🏻🤝👩🏼"
}, {
  expected: "👩🏻‍🤝‍👩🏽",
  actual: "👩🏻🤝👩🏽"
}, {
  expected: "👩🏻‍🤝‍👩🏾",
  actual: "👩🏻🤝👩🏾"
}, {
  expected: "👩🏻‍🤝‍👩🏿",
  actual: "👩🏻🤝👩🏿"
}, {
  expected: "👩🏼‍🤝‍👩🏻",
  actual: "👩🏼🤝👩🏻"
}, {
  expected: "👩🏼‍🤝‍👩🏽",
  actual: "👩🏼🤝👩🏽"
}, {
  expected: "👩🏼‍🤝‍👩🏾",
  actual: "👩🏼🤝👩🏾"
}, {
  expected: "👩🏼‍🤝‍👩🏿",
  actual: "👩🏼🤝👩🏿"
}, {
  expected: "👩🏽‍🤝‍👩🏻",
  actual: "👩🏽🤝👩🏻"
}, {
  expected: "👩🏽‍🤝‍👩🏼",
  actual: "👩🏽🤝👩🏼"
}, {
  expected: "👩🏽‍🤝‍👩🏾",
  actual: "👩🏽🤝👩🏾"
}, {
  expected: "👩🏽‍🤝‍👩🏿",
  actual: "👩🏽🤝👩🏿"
}, {
  expected: "👩🏾‍🤝‍👩🏻",
  actual: "👩🏾🤝👩🏻"
}, {
  expected: "👩🏾‍🤝‍👩🏼",
  actual: "👩🏾🤝👩🏼"
}, {
  expected: "👩🏾‍🤝‍👩🏽",
  actual: "👩🏾🤝👩🏽"
}, {
  expected: "👩🏾‍🤝‍👩🏿",
  actual: "👩🏾🤝👩🏿"
}, {
  expected: "👩🏿‍🤝‍👩🏻",
  actual: "👩🏿🤝👩🏻"
}, {
  expected: "👩🏿‍🤝‍👩🏼",
  actual: "👩🏿🤝👩🏼"
}, {
  expected: "👩🏿‍🤝‍👩🏽",
  actual: "👩🏿🤝👩🏽"
}, {
  expected: "👩🏿‍🤝‍👩🏾",
  actual: "👩🏿🤝👩🏾"
}, {
  expected: "👩🏻‍🤝‍👨🏼",
  actual: "👩🏻🤝👨🏼"
}, {
  expected: "👩🏻‍🤝‍👨🏽",
  actual: "👩🏻🤝👨🏽"
}, {
  expected: "👩🏻‍🤝‍👨🏾",
  actual: "👩🏻🤝👨🏾"
}, {
  expected: "👩🏻‍🤝‍👨🏿",
  actual: "👩🏻🤝👨🏿"
}, {
  expected: "👩🏼‍🤝‍👨🏻",
  actual: "👩🏼🤝👨🏻"
}, {
  expected: "👩🏼‍🤝‍👨🏽",
  actual: "👩🏼🤝👨🏽"
}, {
  expected: "👩🏼‍🤝‍👨🏾",
  actual: "👩🏼🤝👨🏾"
}, {
  expected: "👩🏼‍🤝‍👨🏿",
  actual: "👩🏼🤝👨🏿"
}, {
  expected: "👩🏽‍🤝‍👨🏻",
  actual: "👩🏽🤝👨🏻"
}, {
  expected: "👩🏽‍🤝‍👨🏼",
  actual: "👩🏽🤝👨🏼"
}, {
  expected: "👩🏽‍🤝‍👨🏾",
  actual: "👩🏽🤝👨🏾"
}, {
  expected: "👩🏽‍🤝‍👨🏿",
  actual: "👩🏽🤝👨🏿"
}, {
  expected: "👩🏾‍🤝‍👨🏻",
  actual: "👩🏾🤝👨🏻"
}, {
  expected: "👩🏾‍🤝‍👨🏼",
  actual: "👩🏾🤝👨🏼"
}, {
  expected: "👩🏾‍🤝‍👨🏽",
  actual: "👩🏾🤝👨🏽"
}, {
  expected: "👩🏾‍🤝‍👨🏿",
  actual: "👩🏾🤝👨🏿"
}, {
  expected: "👩🏿‍🤝‍👨🏻",
  actual: "👩🏿🤝👨🏻"
}, {
  expected: "👩🏿‍🤝‍👨🏼",
  actual: "👩🏿🤝👨🏼"
}, {
  expected: "👩🏿‍🤝‍👨🏽",
  actual: "👩🏿🤝👨🏽"
}, {
  expected: "👩🏿‍🤝‍👨🏾",
  actual: "👩🏿🤝👨🏾"
}, {
  expected: "👨🏻‍🤝‍👨🏼",
  actual: "👨🏻🤝👨🏼"
}, {
  expected: "👨🏻‍🤝‍👨🏽",
  actual: "👨🏻🤝👨🏽"
}, {
  expected: "👨🏻‍🤝‍👨🏾",
  actual: "👨🏻🤝👨🏾"
}, {
  expected: "👨🏻‍🤝‍👨🏿",
  actual: "👨🏻🤝👨🏿"
}, {
  expected: "👨🏼‍🤝‍👨🏻",
  actual: "👨🏼🤝👨🏻"
}, {
  expected: "👨🏼‍🤝‍👨🏽",
  actual: "👨🏼🤝👨🏽"
}, {
  expected: "👨🏼‍🤝‍👨🏾",
  actual: "👨🏼🤝👨🏾"
}, {
  expected: "👨🏼‍🤝‍👨🏿",
  actual: "👨🏼🤝👨🏿"
}, {
  expected: "👨🏽‍🤝‍👨🏻",
  actual: "👨🏽🤝👨🏻"
}, {
  expected: "👨🏽‍🤝‍👨🏼",
  actual: "👨🏽🤝👨🏼"
}, {
  expected: "👨🏽‍🤝‍👨🏾",
  actual: "👨🏽🤝👨🏾"
}, {
  expected: "👨🏽‍🤝‍👨🏿",
  actual: "👨🏽🤝👨🏿"
}, {
  expected: "👨🏾‍🤝‍👨🏻",
  actual: "👨🏾🤝👨🏻"
}, {
  expected: "👨🏾‍🤝‍👨🏼",
  actual: "👨🏾🤝👨🏼"
}, {
  expected: "👨🏾‍🤝‍👨🏽",
  actual: "👨🏾🤝👨🏽"
}, {
  expected: "👨🏾‍🤝‍👨🏿",
  actual: "👨🏾🤝👨🏿"
}, {
  expected: "👨🏿‍🤝‍👨🏻",
  actual: "👨🏿🤝👨🏻"
}, {
  expected: "👨🏿‍🤝‍👨🏼",
  actual: "👨🏿🤝👨🏼"
}, {
  expected: "👨🏿‍🤝‍👨🏽",
  actual: "👨🏿🤝👨🏽"
}, {
  expected: "👨🏿‍🤝‍👨🏾",
  actual: "👨🏿🤝👨🏾"
}, {
  expected: "👩‍❤️‍👨",
  actual: "👩‍❤️‍👨"
}, {
  expected: "👨‍❤️‍👨",
  actual: "👨‍❤️‍👨"
}, {
  expected: "👩‍❤️‍👩",
  actual: "👩‍❤️‍👩"
}, {
  expected: "🫱🏻‍🫲🏼",
  actual: "🫱🏻‍🫲🏼"
}, {
  expected: "🫱🏻‍🫲🏽",
  actual: "🫱🏻‍🫲🏽"
}, {
  expected: "🫱🏻‍🫲🏾",
  actual: "🫱🏻‍🫲🏾"
}, {
  expected: "🫱🏻‍🫲🏿",
  actual: "🫱🏻‍🫲🏿"
}, {
  expected: "🫱🏼‍🫲🏻",
  actual: "🫱🏼‍🫲🏻"
}, {
  expected: "🫱🏼‍🫲🏽",
  actual: "🫱🏼‍🫲🏽"
}, {
  expected: "🫱🏼‍🫲🏾",
  actual: "🫱🏼‍🫲🏾"
}, {
  expected: "🫱🏼‍🫲🏿",
  actual: "🫱🏼‍🫲🏿"
}, {
  expected: "🫱🏽‍🫲🏻",
  actual: "🫱🏽‍🫲🏻"
}, {
  expected: "🫱🏽‍🫲🏼",
  actual: "🫱🏽‍🫲🏼"
}, {
  expected: "🫱🏽‍🫲🏾",
  actual: "🫱🏽‍🫲🏾"
}, {
  expected: "🫱🏽‍🫲🏿",
  actual: "🫱🏽‍🫲🏿"
}, {
  expected: "🫱🏾‍🫲🏻",
  actual: "🫱🏾‍🫲🏻"
}, {
  expected: "🫱🏾‍🫲🏼",
  actual: "🫱🏾‍🫲🏼"
}, {
  expected: "🫱🏾‍🫲🏽",
  actual: "🫱🏾‍🫲🏽"
}, {
  expected: "🫱🏾‍🫲🏿",
  actual: "🫱🏾‍🫲🏿"
}, {
  expected: "🫱🏿‍🫲🏻",
  actual: "🫱🏿‍🫲🏻"
}, {
  expected: "🫱🏿‍🫲🏼",
  actual: "🫱🏿‍🫲🏼"
}, {
  expected: "🫱🏿‍🫲🏽",
  actual: "🫱🏿‍🫲🏽"
}, {
  expected: "🫱🏿‍🫲🏾",
  actual: "🫱🏿‍🫲🏾"
}, {
  expected: "🧑🏻‍❤️‍🧑🏼",
  actual: "🧑🏻❤🧑🏼"
}, {
  expected: "🧑🏻‍❤️‍🧑🏽",
  actual: "🧑🏻❤🧑🏽"
}, {
  expected: "🧑🏻‍❤️‍🧑🏾",
  actual: "🧑🏻❤🧑🏾"
}, {
  expected: "🧑🏻‍❤️‍🧑🏿",
  actual: "🧑🏻❤🧑🏿"
}, {
  expected: "🧑🏼‍❤️‍🧑🏻",
  actual: "🧑🏼❤🧑🏻"
}, {
  expected: "🧑🏼‍❤️‍🧑🏽",
  actual: "🧑🏼❤🧑🏽"
}, {
  expected: "🧑🏼‍❤️‍🧑🏾",
  actual: "🧑🏼❤🧑🏾"
}, {
  expected: "🧑🏼‍❤️‍🧑🏿",
  actual: "🧑🏼❤🧑🏿"
}, {
  expected: "🧑🏽‍❤️‍🧑🏻",
  actual: "🧑🏽❤🧑🏻"
}, {
  expected: "🧑🏽‍❤️‍🧑🏼",
  actual: "🧑🏽❤🧑🏼"
}, {
  expected: "🧑🏽‍❤️‍🧑🏾",
  actual: "🧑🏽❤🧑🏾"
}, {
  expected: "🧑🏽‍❤️‍🧑🏿",
  actual: "🧑🏽❤🧑🏿"
}, {
  expected: "🧑🏾‍❤️‍🧑🏻",
  actual: "🧑🏾❤🧑🏻"
}, {
  expected: "🧑🏾‍❤️‍🧑🏼",
  actual: "🧑🏾❤🧑🏼"
}, {
  expected: "🧑🏾‍❤️‍🧑🏽",
  actual: "🧑🏾❤🧑🏽"
}, {
  expected: "🧑🏾‍❤️‍🧑🏿",
  actual: "🧑🏾❤🧑🏿"
}, {
  expected: "🧑🏿‍❤️‍🧑🏻",
  actual: "🧑🏿❤🧑🏻"
}, {
  expected: "🧑🏿‍❤️‍🧑🏼",
  actual: "🧑🏿❤🧑🏼"
}, {
  expected: "🧑🏿‍❤️‍🧑🏽",
  actual: "🧑🏿❤🧑🏽"
}, {
  expected: "🧑🏿‍❤️‍🧑🏾",
  actual: "🧑🏿❤🧑🏾"
}, {
  expected: "👩🏻‍❤️‍👨🏻",
  actual: "👩🏻❤👨🏻"
}, {
  expected: "👩🏻‍❤️‍👨🏼",
  actual: "👩🏻❤👨🏼"
}, {
  expected: "👩🏻‍❤️‍👨🏽",
  actual: "👩🏻❤👨🏽"
}, {
  expected: "👩🏻‍❤️‍👨🏾",
  actual: "👩🏻❤👨🏾"
}, {
  expected: "👩🏻‍❤️‍👨🏿",
  actual: "👩🏻❤👨🏿"
}, {
  expected: "👩🏼‍❤️‍👨🏻",
  actual: "👩🏼❤👨🏻"
}, {
  expected: "👩🏼‍❤️‍👨🏼",
  actual: "👩🏼❤👨🏼"
}, {
  expected: "👩🏼‍❤️‍👨🏽",
  actual: "👩🏼❤👨🏽"
}, {
  expected: "👩🏼‍❤️‍👨🏾",
  actual: "👩🏼❤👨🏾"
}, {
  expected: "👩🏼‍❤️‍👨🏿",
  actual: "👩🏼❤👨🏿"
}, {
  expected: "👩🏽‍❤️‍👨🏻",
  actual: "👩🏽❤👨🏻"
}, {
  expected: "👩🏽‍❤️‍👨🏼",
  actual: "👩🏽❤👨🏼"
}, {
  expected: "👩🏽‍❤️‍👨🏽",
  actual: "👩🏽❤👨🏽"
}, {
  expected: "👩🏽‍❤️‍👨🏾",
  actual: "👩🏽❤👨🏾"
}, {
  expected: "👩🏽‍❤️‍👨🏿",
  actual: "👩🏽❤👨🏿"
}, {
  expected: "👩🏾‍❤️‍👨🏻",
  actual: "👩🏾❤👨🏻"
}, {
  expected: "👩🏾‍❤️‍👨🏼",
  actual: "👩🏾❤👨🏼"
}, {
  expected: "👩🏾‍❤️‍👨🏽",
  actual: "👩🏾❤👨🏽"
}, {
  expected: "👩🏾‍❤️‍👨🏾",
  actual: "👩🏾❤👨🏾"
}, {
  expected: "👩🏾‍❤️‍👨🏿",
  actual: "👩🏾❤👨🏿"
}, {
  expected: "👩🏿‍❤️‍👨🏻",
  actual: "👩🏿❤👨🏻"
}, {
  expected: "👩🏿‍❤️‍👨🏼",
  actual: "👩🏿❤👨🏼"
}, {
  expected: "👩🏿‍❤️‍👨🏽",
  actual: "👩🏿❤👨🏽"
}, {
  expected: "👩🏿‍❤️‍👨🏾",
  actual: "👩🏿❤👨🏾"
}, {
  expected: "👩🏿‍❤️‍👨🏿",
  actual: "👩🏿❤👨🏿"
}, {
  expected: "👨🏻‍❤️‍👨🏻",
  actual: "👨🏻❤👨🏻"
}, {
  expected: "👨🏻‍❤️‍👨🏼",
  actual: "👨🏻❤👨🏼"
}, {
  expected: "👨🏻‍❤️‍👨🏽",
  actual: "👨🏻❤👨🏽"
}, {
  expected: "👨🏻‍❤️‍👨🏾",
  actual: "👨🏻❤👨🏾"
}, {
  expected: "👨🏻‍❤️‍👨🏿",
  actual: "👨🏻❤👨🏿"
}, {
  expected: "👨🏼‍❤️‍👨🏻",
  actual: "👨🏼❤👨🏻"
}, {
  expected: "👨🏼‍❤️‍👨🏼",
  actual: "👨🏼❤👨🏼"
}, {
  expected: "👨🏼‍❤️‍👨🏽",
  actual: "👨🏼❤👨🏽"
}, {
  expected: "👨🏼‍❤️‍👨🏾",
  actual: "👨🏼❤👨🏾"
}, {
  expected: "👨🏼‍❤️‍👨🏿",
  actual: "👨🏼❤👨🏿"
}, {
  expected: "👨🏽‍❤️‍👨🏻",
  actual: "👨🏽❤👨🏻"
}, {
  expected: "👨🏽‍❤️‍👨🏼",
  actual: "👨🏽❤👨🏼"
}, {
  expected: "👨🏽‍❤️‍👨🏽",
  actual: "👨🏽❤👨🏽"
}, {
  expected: "👨🏽‍❤️‍👨🏾",
  actual: "👨🏽❤👨🏾"
}, {
  expected: "👨🏽‍❤️‍👨🏿",
  actual: "👨🏽❤👨🏿"
}, {
  expected: "👨🏾‍❤️‍👨🏻",
  actual: "👨🏾❤👨🏻"
}, {
  expected: "👨🏾‍❤️‍👨🏼",
  actual: "👨🏾❤👨🏼"
}, {
  expected: "👨🏾‍❤️‍👨🏽",
  actual: "👨🏾❤👨🏽"
}, {
  expected: "👨🏾‍❤️‍👨🏾",
  actual: "👨🏾❤👨🏾"
}, {
  expected: "👨🏾‍❤️‍👨🏿",
  actual: "👨🏾❤👨🏿"
}, {
  expected: "👨🏿‍❤️‍👨🏻",
  actual: "👨🏿❤👨🏻"
}, {
  expected: "👨🏿‍❤️‍👨🏼",
  actual: "👨🏿❤👨🏼"
}, {
  expected: "👨🏿‍❤️‍👨🏽",
  actual: "👨🏿❤👨🏽"
}, {
  expected: "👨🏿‍❤️‍👨🏾",
  actual: "👨🏿❤👨🏾"
}, {
  expected: "👨🏿‍❤️‍👨🏿",
  actual: "👨🏿❤👨🏿"
}, {
  expected: "👩🏻‍❤️‍👩🏻",
  actual: "👩🏻❤👩🏻"
}, {
  expected: "👩🏻‍❤️‍👩🏼",
  actual: "👩🏻❤👩🏼"
}, {
  expected: "👩🏻‍❤️‍👩🏽",
  actual: "👩🏻❤👩🏽"
}, {
  expected: "👩🏻‍❤️‍👩🏾",
  actual: "👩🏻❤👩🏾"
}, {
  expected: "👩🏻‍❤️‍👩🏿",
  actual: "👩🏻❤👩🏿"
}, {
  expected: "👩🏼‍❤️‍👩🏻",
  actual: "👩🏼❤👩🏻"
}, {
  expected: "👩🏼‍❤️‍👩🏼",
  actual: "👩🏼❤👩🏼"
}, {
  expected: "👩🏼‍❤️‍👩🏽",
  actual: "👩🏼❤👩🏽"
}, {
  expected: "👩🏼‍❤️‍👩🏾",
  actual: "👩🏼❤👩🏾"
}, {
  expected: "👩🏼‍❤️‍👩🏿",
  actual: "👩🏼❤👩🏿"
}, {
  expected: "👩🏽‍❤️‍👩🏻",
  actual: "👩🏽❤👩🏻"
}, {
  expected: "👩🏽‍❤️‍👩🏼",
  actual: "👩🏽❤👩🏼"
}, {
  expected: "👩🏽‍❤️‍👩🏽",
  actual: "👩🏽❤👩🏽"
}, {
  expected: "👩🏽‍❤️‍👩🏾",
  actual: "👩🏽❤👩🏾"
}, {
  expected: "👩🏽‍❤️‍👩🏿",
  actual: "👩🏽❤👩🏿"
}, {
  expected: "👩🏾‍❤️‍👩🏻",
  actual: "👩🏾❤👩🏻"
}, {
  expected: "👩🏾‍❤️‍👩🏼",
  actual: "👩🏾❤👩🏼"
}, {
  expected: "👩🏾‍❤️‍👩🏽",
  actual: "👩🏾❤👩🏽"
}, {
  expected: "👩🏾‍❤️‍👩🏾",
  actual: "👩🏾❤👩🏾"
}, {
  expected: "👩🏾‍❤️‍👩🏿",
  actual: "👩🏾❤👩🏿"
}, {
  expected: "👩🏿‍❤️‍👩🏻",
  actual: "👩🏿❤👩🏻"
}, {
  expected: "👩🏿‍❤️‍👩🏼",
  actual: "👩🏿❤👩🏼"
}, {
  expected: "👩🏿‍❤️‍👩🏽",
  actual: "👩🏿❤👩🏽"
}, {
  expected: "👩🏿‍❤️‍👩🏾",
  actual: "👩🏿❤👩🏾"
}, {
  expected: "👩🏿‍❤️‍👩🏿",
  actual: "👩🏿❤👩🏿"
}, {
  expected: "🧑‍🤝‍🧑",
  actual: "🧑‍🤝‍🧑"
}, {
  expected: "👨‍👩‍👦",
  actual: "👨‍👩‍👦"
}, {
  expected: "👨‍👩‍👧",
  actual: "👨‍👩‍👧"
}, {
  expected: "👨‍👨‍👦",
  actual: "👨‍👨‍👦"
}, {
  expected: "👨‍👨‍👧",
  actual: "👨‍👨‍👧"
}, {
  expected: "👩‍👩‍👦",
  actual: "👩‍👩‍👦"
}, {
  expected: "👩‍👩‍👧",
  actual: "👩‍👩‍👧"
}, {
  expected: "👨‍👦‍👦",
  actual: "👨‍👦‍👦"
}, {
  expected: "👨‍👧‍👦",
  actual: "👨‍👧‍👦"
}, {
  expected: "👨‍👧‍👧",
  actual: "👨‍👧‍👧"
}, {
  expected: "👩‍👦‍👦",
  actual: "👩‍👦‍👦"
}, {
  expected: "👩‍👧‍👦",
  actual: "👩‍👧‍👦"
}, {
  expected: "👩‍👧‍👧",
  actual: "👩‍👧‍👧"
}, {
  expected: "👁️‍🗨️",
  actual: "👁️‍🗨️"
}, {
  expected: "🧔🏻‍♂️",
  actual: "🧔🏻‍♂️"
}, {
  expected: "🧔🏼‍♂️",
  actual: "🧔🏼‍♂️"
}, {
  expected: "🧔🏽‍♂️",
  actual: "🧔🏽‍♂️"
}, {
  expected: "🧔🏾‍♂️",
  actual: "🧔🏾‍♂️"
}, {
  expected: "🧔🏿‍♂️",
  actual: "🧔🏿‍♂️"
}, {
  expected: "🧔🏻‍♀️",
  actual: "🧔🏻‍♀️"
}, {
  expected: "🧔🏼‍♀️",
  actual: "🧔🏼‍♀️"
}, {
  expected: "🧔🏽‍♀️",
  actual: "🧔🏽‍♀️"
}, {
  expected: "🧔🏾‍♀️",
  actual: "🧔🏾‍♀️"
}, {
  expected: "🧔🏿‍♀️",
  actual: "🧔🏿‍♀️"
}, {
  expected: "👱🏻‍♀️",
  actual: "👱🏻‍♀️"
}, {
  expected: "👱🏼‍♀️",
  actual: "👱🏼‍♀️"
}, {
  expected: "👱🏽‍♀️",
  actual: "👱🏽‍♀️"
}, {
  expected: "👱🏾‍♀️",
  actual: "👱🏾‍♀️"
}, {
  expected: "👱🏿‍♀️",
  actual: "👱🏿‍♀️"
}, {
  expected: "👱🏻‍♂️",
  actual: "👱🏻‍♂️"
}, {
  expected: "👱🏼‍♂️",
  actual: "👱🏼‍♂️"
}, {
  expected: "👱🏽‍♂️",
  actual: "👱🏽‍♂️"
}, {
  expected: "👱🏾‍♂️",
  actual: "👱🏾‍♂️"
}, {
  expected: "👱🏿‍♂️",
  actual: "👱🏿‍♂️"
}, {
  expected: "🙍🏻‍♂️",
  actual: "🙍🏻‍♂️"
}, {
  expected: "🙍🏼‍♂️",
  actual: "🙍🏼‍♂️"
}, {
  expected: "🙍🏽‍♂️",
  actual: "🙍🏽‍♂️"
}, {
  expected: "🙍🏾‍♂️",
  actual: "🙍🏾‍♂️"
}, {
  expected: "🙍🏿‍♂️",
  actual: "🙍🏿‍♂️"
}, {
  expected: "🙍🏻‍♀️",
  actual: "🙍🏻‍♀️"
}, {
  expected: "🙍🏼‍♀️",
  actual: "🙍🏼‍♀️"
}, {
  expected: "🙍🏽‍♀️",
  actual: "🙍🏽‍♀️"
}, {
  expected: "🙍🏾‍♀️",
  actual: "🙍🏾‍♀️"
}, {
  expected: "🙍🏿‍♀️",
  actual: "🙍🏿‍♀️"
}, {
  expected: "🙎🏻‍♂️",
  actual: "🙎🏻‍♂️"
}, {
  expected: "🙎🏼‍♂️",
  actual: "🙎🏼‍♂️"
}, {
  expected: "🙎🏽‍♂️",
  actual: "🙎🏽‍♂️"
}, {
  expected: "🙎🏾‍♂️",
  actual: "🙎🏾‍♂️"
}, {
  expected: "🙎🏿‍♂️",
  actual: "🙎🏿‍♂️"
}, {
  expected: "🙎🏻‍♀️",
  actual: "🙎🏻‍♀️"
}, {
  expected: "🙎🏼‍♀️",
  actual: "🙎🏼‍♀️"
}, {
  expected: "🙎🏽‍♀️",
  actual: "🙎🏽‍♀️"
}, {
  expected: "🙎🏾‍♀️",
  actual: "🙎🏾‍♀️"
}, {
  expected: "🙎🏿‍♀️",
  actual: "🙎🏿‍♀️"
}, {
  expected: "🙅🏻‍♂️",
  actual: "🙅🏻‍♂️"
}, {
  expected: "🙅🏼‍♂️",
  actual: "🙅🏼‍♂️"
}, {
  expected: "🙅🏽‍♂️",
  actual: "🙅🏽‍♂️"
}, {
  expected: "🙅🏾‍♂️",
  actual: "🙅🏾‍♂️"
}, {
  expected: "🙅🏿‍♂️",
  actual: "🙅🏿‍♂️"
}, {
  expected: "🙅🏻‍♀️",
  actual: "🙅🏻‍♀️"
}, {
  expected: "🙅🏼‍♀️",
  actual: "🙅🏼‍♀️"
}, {
  expected: "🙅🏽‍♀️",
  actual: "🙅🏽‍♀️"
}, {
  expected: "🙅🏾‍♀️",
  actual: "🙅🏾‍♀️"
}, {
  expected: "🙅🏿‍♀️",
  actual: "🙅🏿‍♀️"
}, {
  expected: "🙆🏻‍♂️",
  actual: "🙆🏻‍♂️"
}, {
  expected: "🙆🏼‍♂️",
  actual: "🙆🏼‍♂️"
}, {
  expected: "🙆🏽‍♂️",
  actual: "🙆🏽‍♂️"
}, {
  expected: "🙆🏾‍♂️",
  actual: "🙆🏾‍♂️"
}, {
  expected: "🙆🏿‍♂️",
  actual: "🙆🏿‍♂️"
}, {
  expected: "🙆🏻‍♀️",
  actual: "🙆🏻‍♀️"
}, {
  expected: "🙆🏼‍♀️",
  actual: "🙆🏼‍♀️"
}, {
  expected: "🙆🏽‍♀️",
  actual: "🙆🏽‍♀️"
}, {
  expected: "🙆🏾‍♀️",
  actual: "🙆🏾‍♀️"
}, {
  expected: "🙆🏿‍♀️",
  actual: "🙆🏿‍♀️"
}, {
  expected: "💁🏻‍♂️",
  actual: "💁🏻‍♂️"
}, {
  expected: "💁🏼‍♂️",
  actual: "💁🏼‍♂️"
}, {
  expected: "💁🏽‍♂️",
  actual: "💁🏽‍♂️"
}, {
  expected: "💁🏾‍♂️",
  actual: "💁🏾‍♂️"
}, {
  expected: "💁🏿‍♂️",
  actual: "💁🏿‍♂️"
}, {
  expected: "💁🏻‍♀️",
  actual: "💁🏻‍♀️"
}, {
  expected: "💁🏼‍♀️",
  actual: "💁🏼‍♀️"
}, {
  expected: "💁🏽‍♀️",
  actual: "💁🏽‍♀️"
}, {
  expected: "💁🏾‍♀️",
  actual: "💁🏾‍♀️"
}, {
  expected: "💁🏿‍♀️",
  actual: "💁🏿‍♀️"
}, {
  expected: "🙋🏻‍♂️",
  actual: "🙋🏻‍♂️"
}, {
  expected: "🙋🏼‍♂️",
  actual: "🙋🏼‍♂️"
}, {
  expected: "🙋🏽‍♂️",
  actual: "🙋🏽‍♂️"
}, {
  expected: "🙋🏾‍♂️",
  actual: "🙋🏾‍♂️"
}, {
  expected: "🙋🏿‍♂️",
  actual: "🙋🏿‍♂️"
}, {
  expected: "🙋🏻‍♀️",
  actual: "🙋🏻‍♀️"
}, {
  expected: "🙋🏼‍♀️",
  actual: "🙋🏼‍♀️"
}, {
  expected: "🙋🏽‍♀️",
  actual: "🙋🏽‍♀️"
}, {
  expected: "🙋🏾‍♀️",
  actual: "🙋🏾‍♀️"
}, {
  expected: "🙋🏿‍♀️",
  actual: "🙋🏿‍♀️"
}, {
  expected: "🧏🏻‍♂️",
  actual: "🧏🏻‍♂️"
}, {
  expected: "🧏🏼‍♂️",
  actual: "🧏🏼‍♂️"
}, {
  expected: "🧏🏽‍♂️",
  actual: "🧏🏽‍♂️"
}, {
  expected: "🧏🏾‍♂️",
  actual: "🧏🏾‍♂️"
}, {
  expected: "🧏🏿‍♂️",
  actual: "🧏🏿‍♂️"
}, {
  expected: "🧏🏻‍♀️",
  actual: "🧏🏻‍♀️"
}, {
  expected: "🧏🏼‍♀️",
  actual: "🧏🏼‍♀️"
}, {
  expected: "🧏🏽‍♀️",
  actual: "🧏🏽‍♀️"
}, {
  expected: "🧏🏾‍♀️",
  actual: "🧏🏾‍♀️"
}, {
  expected: "🧏🏿‍♀️",
  actual: "🧏🏿‍♀️"
}, {
  expected: "🙇🏻‍♂️",
  actual: "🙇🏻‍♂️"
}, {
  expected: "🙇🏼‍♂️",
  actual: "🙇🏼‍♂️"
}, {
  expected: "🙇🏽‍♂️",
  actual: "🙇🏽‍♂️"
}, {
  expected: "🙇🏾‍♂️",
  actual: "🙇🏾‍♂️"
}, {
  expected: "🙇🏿‍♂️",
  actual: "🙇🏿‍♂️"
}, {
  expected: "🙇🏻‍♀️",
  actual: "🙇🏻‍♀️"
}, {
  expected: "🙇🏼‍♀️",
  actual: "🙇🏼‍♀️"
}, {
  expected: "🙇🏽‍♀️",
  actual: "🙇🏽‍♀️"
}, {
  expected: "🙇🏾‍♀️",
  actual: "🙇🏾‍♀️"
}, {
  expected: "🙇🏿‍♀️",
  actual: "🙇🏿‍♀️"
}, {
  expected: "🤦🏻‍♂️",
  actual: "🤦🏻‍♂️"
}, {
  expected: "🤦🏼‍♂️",
  actual: "🤦🏼‍♂️"
}, {
  expected: "🤦🏽‍♂️",
  actual: "🤦🏽‍♂️"
}, {
  expected: "🤦🏾‍♂️",
  actual: "🤦🏾‍♂️"
}, {
  expected: "🤦🏿‍♂️",
  actual: "🤦🏿‍♂️"
}, {
  expected: "🤦🏻‍♀️",
  actual: "🤦🏻‍♀️"
}, {
  expected: "🤦🏼‍♀️",
  actual: "🤦🏼‍♀️"
}, {
  expected: "🤦🏽‍♀️",
  actual: "🤦🏽‍♀️"
}, {
  expected: "🤦🏾‍♀️",
  actual: "🤦🏾‍♀️"
}, {
  expected: "🤦🏿‍♀️",
  actual: "🤦🏿‍♀️"
}, {
  expected: "🤷🏻‍♂️",
  actual: "🤷🏻‍♂️"
}, {
  expected: "🤷🏼‍♂️",
  actual: "🤷🏼‍♂️"
}, {
  expected: "🤷🏽‍♂️",
  actual: "🤷🏽‍♂️"
}, {
  expected: "🤷🏾‍♂️",
  actual: "🤷🏾‍♂️"
}, {
  expected: "🤷🏿‍♂️",
  actual: "🤷🏿‍♂️"
}, {
  expected: "🤷🏻‍♀️",
  actual: "🤷🏻‍♀️"
}, {
  expected: "🤷🏼‍♀️",
  actual: "🤷🏼‍♀️"
}, {
  expected: "🤷🏽‍♀️",
  actual: "🤷🏽‍♀️"
}, {
  expected: "🤷🏾‍♀️",
  actual: "🤷🏾‍♀️"
}, {
  expected: "🤷🏿‍♀️",
  actual: "🤷🏿‍♀️"
}, {
  expected: "🧑🏻‍⚕️",
  actual: "🧑🏻‍⚕️"
}, {
  expected: "🧑🏼‍⚕️",
  actual: "🧑🏼‍⚕️"
}, {
  expected: "🧑🏽‍⚕️",
  actual: "🧑🏽‍⚕️"
}, {
  expected: "🧑🏾‍⚕️",
  actual: "🧑🏾‍⚕️"
}, {
  expected: "🧑🏿‍⚕️",
  actual: "🧑🏿‍⚕️"
}, {
  expected: "👨🏻‍⚕️",
  actual: "👨🏻‍⚕️"
}, {
  expected: "👨🏼‍⚕️",
  actual: "👨🏼‍⚕️"
}, {
  expected: "👨🏽‍⚕️",
  actual: "👨🏽‍⚕️"
}, {
  expected: "👨🏾‍⚕️",
  actual: "👨🏾‍⚕️"
}, {
  expected: "👨🏿‍⚕️",
  actual: "👨🏿‍⚕️"
}, {
  expected: "👩🏻‍⚕️",
  actual: "👩🏻‍⚕️"
}, {
  expected: "👩🏼‍⚕️",
  actual: "👩🏼‍⚕️"
}, {
  expected: "👩🏽‍⚕️",
  actual: "👩🏽‍⚕️"
}, {
  expected: "👩🏾‍⚕️",
  actual: "👩🏾‍⚕️"
}, {
  expected: "👩🏿‍⚕️",
  actual: "👩🏿‍⚕️"
}, {
  expected: "🧑🏻‍⚖️",
  actual: "🧑🏻‍⚖️"
}, {
  expected: "🧑🏼‍⚖️",
  actual: "🧑🏼‍⚖️"
}, {
  expected: "🧑🏽‍⚖️",
  actual: "🧑🏽‍⚖️"
}, {
  expected: "🧑🏾‍⚖️",
  actual: "🧑🏾‍⚖️"
}, {
  expected: "🧑🏿‍⚖️",
  actual: "🧑🏿‍⚖️"
}, {
  expected: "👨🏻‍⚖️",
  actual: "👨🏻‍⚖️"
}, {
  expected: "👨🏼‍⚖️",
  actual: "👨🏼‍⚖️"
}, {
  expected: "👨🏽‍⚖️",
  actual: "👨🏽‍⚖️"
}, {
  expected: "👨🏾‍⚖️",
  actual: "👨🏾‍⚖️"
}, {
  expected: "👨🏿‍⚖️",
  actual: "👨🏿‍⚖️"
}, {
  expected: "👩🏻‍⚖️",
  actual: "👩🏻‍⚖️"
}, {
  expected: "👩🏼‍⚖️",
  actual: "👩🏼‍⚖️"
}, {
  expected: "👩🏽‍⚖️",
  actual: "👩🏽‍⚖️"
}, {
  expected: "👩🏾‍⚖️",
  actual: "👩🏾‍⚖️"
}, {
  expected: "👩🏿‍⚖️",
  actual: "👩🏿‍⚖️"
}, {
  expected: "🧑🏻‍✈️",
  actual: "🧑🏻‍✈️"
}, {
  expected: "🧑🏼‍✈️",
  actual: "🧑🏼‍✈️"
}, {
  expected: "🧑🏽‍✈️",
  actual: "🧑🏽‍✈️"
}, {
  expected: "🧑🏾‍✈️",
  actual: "🧑🏾‍✈️"
}, {
  expected: "🧑🏿‍✈️",
  actual: "🧑🏿‍✈️"
}, {
  expected: "👨🏻‍✈️",
  actual: "👨🏻‍✈️"
}, {
  expected: "👨🏼‍✈️",
  actual: "👨🏼‍✈️"
}, {
  expected: "👨🏽‍✈️",
  actual: "👨🏽‍✈️"
}, {
  expected: "👨🏾‍✈️",
  actual: "👨🏾‍✈️"
}, {
  expected: "👨🏿‍✈️",
  actual: "👨🏿‍✈️"
}, {
  expected: "👩🏻‍✈️",
  actual: "👩🏻‍✈️"
}, {
  expected: "👩🏼‍✈️",
  actual: "👩🏼‍✈️"
}, {
  expected: "👩🏽‍✈️",
  actual: "👩🏽‍✈️"
}, {
  expected: "👩🏾‍✈️",
  actual: "👩🏾‍✈️"
}, {
  expected: "👩🏿‍✈️",
  actual: "👩🏿‍✈️"
}, {
  expected: "👮🏻‍♂️",
  actual: "👮🏻‍♂️"
}, {
  expected: "👮🏼‍♂️",
  actual: "👮🏼‍♂️"
}, {
  expected: "👮🏽‍♂️",
  actual: "👮🏽‍♂️"
}, {
  expected: "👮🏾‍♂️",
  actual: "👮🏾‍♂️"
}, {
  expected: "👮🏿‍♂️",
  actual: "👮🏿‍♂️"
}, {
  expected: "👮🏻‍♀️",
  actual: "👮🏻‍♀️"
}, {
  expected: "👮🏼‍♀️",
  actual: "👮🏼‍♀️"
}, {
  expected: "👮🏽‍♀️",
  actual: "👮🏽‍♀️"
}, {
  expected: "👮🏾‍♀️",
  actual: "👮🏾‍♀️"
}, {
  expected: "👮🏿‍♀️",
  actual: "👮🏿‍♀️"
}, {
  expected: "🕵🏻‍♂️",
  actual: "🕵🏻‍♂️"
}, {
  expected: "🕵🏼‍♂️",
  actual: "🕵🏼‍♂️"
}, {
  expected: "🕵🏽‍♂️",
  actual: "🕵🏽‍♂️"
}, {
  expected: "🕵🏾‍♂️",
  actual: "🕵🏾‍♂️"
}, {
  expected: "🕵🏿‍♂️",
  actual: "🕵🏿‍♂️"
}, {
  expected: "🕵🏻‍♀️",
  actual: "🕵🏻‍♀️"
}, {
  expected: "🕵🏼‍♀️",
  actual: "🕵🏼‍♀️"
}, {
  expected: "🕵🏽‍♀️",
  actual: "🕵🏽‍♀️"
}, {
  expected: "🕵🏾‍♀️",
  actual: "🕵🏾‍♀️"
}, {
  expected: "🕵🏿‍♀️",
  actual: "🕵🏿‍♀️"
}, {
  expected: "💂🏻‍♂️",
  actual: "💂🏻‍♂️"
}, {
  expected: "💂🏼‍♂️",
  actual: "💂🏼‍♂️"
}, {
  expected: "💂🏽‍♂️",
  actual: "💂🏽‍♂️"
}, {
  expected: "💂🏾‍♂️",
  actual: "💂🏾‍♂️"
}, {
  expected: "💂🏿‍♂️",
  actual: "💂🏿‍♂️"
}, {
  expected: "💂🏻‍♀️",
  actual: "💂🏻‍♀️"
}, {
  expected: "💂🏼‍♀️",
  actual: "💂🏼‍♀️"
}, {
  expected: "💂🏽‍♀️",
  actual: "💂🏽‍♀️"
}, {
  expected: "💂🏾‍♀️",
  actual: "💂🏾‍♀️"
}, {
  expected: "💂🏿‍♀️",
  actual: "💂🏿‍♀️"
}, {
  expected: "👷🏻‍♂️",
  actual: "👷🏻‍♂️"
}, {
  expected: "👷🏼‍♂️",
  actual: "👷🏼‍♂️"
}, {
  expected: "👷🏽‍♂️",
  actual: "👷🏽‍♂️"
}, {
  expected: "👷🏾‍♂️",
  actual: "👷🏾‍♂️"
}, {
  expected: "👷🏿‍♂️",
  actual: "👷🏿‍♂️"
}, {
  expected: "👷🏻‍♀️",
  actual: "👷🏻‍♀️"
}, {
  expected: "👷🏼‍♀️",
  actual: "👷🏼‍♀️"
}, {
  expected: "👷🏽‍♀️",
  actual: "👷🏽‍♀️"
}, {
  expected: "👷🏾‍♀️",
  actual: "👷🏾‍♀️"
}, {
  expected: "👷🏿‍♀️",
  actual: "👷🏿‍♀️"
}, {
  expected: "👳🏻‍♂️",
  actual: "👳🏻‍♂️"
}, {
  expected: "👳🏼‍♂️",
  actual: "👳🏼‍♂️"
}, {
  expected: "👳🏽‍♂️",
  actual: "👳🏽‍♂️"
}, {
  expected: "👳🏾‍♂️",
  actual: "👳🏾‍♂️"
}, {
  expected: "👳🏿‍♂️",
  actual: "👳🏿‍♂️"
}, {
  expected: "👳🏻‍♀️",
  actual: "👳🏻‍♀️"
}, {
  expected: "👳🏼‍♀️",
  actual: "👳🏼‍♀️"
}, {
  expected: "👳🏽‍♀️",
  actual: "👳🏽‍♀️"
}, {
  expected: "👳🏾‍♀️",
  actual: "👳🏾‍♀️"
}, {
  expected: "👳🏿‍♀️",
  actual: "👳🏿‍♀️"
}, {
  expected: "🤵🏻‍♂️",
  actual: "🤵🏻‍♂️"
}, {
  expected: "🤵🏼‍♂️",
  actual: "🤵🏼‍♂️"
}, {
  expected: "🤵🏽‍♂️",
  actual: "🤵🏽‍♂️"
}, {
  expected: "🤵🏾‍♂️",
  actual: "🤵🏾‍♂️"
}, {
  expected: "🤵🏿‍♂️",
  actual: "🤵🏿‍♂️"
}, {
  expected: "🤵🏻‍♀️",
  actual: "🤵🏻‍♀️"
}, {
  expected: "🤵🏼‍♀️",
  actual: "🤵🏼‍♀️"
}, {
  expected: "🤵🏽‍♀️",
  actual: "🤵🏽‍♀️"
}, {
  expected: "🤵🏾‍♀️",
  actual: "🤵🏾‍♀️"
}, {
  expected: "🤵🏿‍♀️",
  actual: "🤵🏿‍♀️"
}, {
  expected: "👰🏻‍♂️",
  actual: "👰🏻‍♂️"
}, {
  expected: "👰🏼‍♂️",
  actual: "👰🏼‍♂️"
}, {
  expected: "👰🏽‍♂️",
  actual: "👰🏽‍♂️"
}, {
  expected: "👰🏾‍♂️",
  actual: "👰🏾‍♂️"
}, {
  expected: "👰🏿‍♂️",
  actual: "👰🏿‍♂️"
}, {
  expected: "👰🏻‍♀️",
  actual: "👰🏻‍♀️"
}, {
  expected: "👰🏼‍♀️",
  actual: "👰🏼‍♀️"
}, {
  expected: "👰🏽‍♀️",
  actual: "👰🏽‍♀️"
}, {
  expected: "👰🏾‍♀️",
  actual: "👰🏾‍♀️"
}, {
  expected: "👰🏿‍♀️",
  actual: "👰🏿‍♀️"
}, {
  expected: "🦸🏻‍♂️",
  actual: "🦸🏻‍♂️"
}, {
  expected: "🦸🏼‍♂️",
  actual: "🦸🏼‍♂️"
}, {
  expected: "🦸🏽‍♂️",
  actual: "🦸🏽‍♂️"
}, {
  expected: "🦸🏾‍♂️",
  actual: "🦸🏾‍♂️"
}, {
  expected: "🦸🏿‍♂️",
  actual: "🦸🏿‍♂️"
}, {
  expected: "🦸🏻‍♀️",
  actual: "🦸🏻‍♀️"
}, {
  expected: "🦸🏼‍♀️",
  actual: "🦸🏼‍♀️"
}, {
  expected: "🦸🏽‍♀️",
  actual: "🦸🏽‍♀️"
}, {
  expected: "🦸🏾‍♀️",
  actual: "🦸🏾‍♀️"
}, {
  expected: "🦸🏿‍♀️",
  actual: "🦸🏿‍♀️"
}, {
  expected: "🦹🏻‍♂️",
  actual: "🦹🏻‍♂️"
}, {
  expected: "🦹🏼‍♂️",
  actual: "🦹🏼‍♂️"
}, {
  expected: "🦹🏽‍♂️",
  actual: "🦹🏽‍♂️"
}, {
  expected: "🦹🏾‍♂️",
  actual: "🦹🏾‍♂️"
}, {
  expected: "🦹🏿‍♂️",
  actual: "🦹🏿‍♂️"
}, {
  expected: "🦹🏻‍♀️",
  actual: "🦹🏻‍♀️"
}, {
  expected: "🦹🏼‍♀️",
  actual: "🦹🏼‍♀️"
}, {
  expected: "🦹🏽‍♀️",
  actual: "🦹🏽‍♀️"
}, {
  expected: "🦹🏾‍♀️",
  actual: "🦹🏾‍♀️"
}, {
  expected: "🦹🏿‍♀️",
  actual: "🦹🏿‍♀️"
}, {
  expected: "🧙🏻‍♂️",
  actual: "🧙🏻‍♂️"
}, {
  expected: "🧙🏼‍♂️",
  actual: "🧙🏼‍♂️"
}, {
  expected: "🧙🏽‍♂️",
  actual: "🧙🏽‍♂️"
}, {
  expected: "🧙🏾‍♂️",
  actual: "🧙🏾‍♂️"
}, {
  expected: "🧙🏿‍♂️",
  actual: "🧙🏿‍♂️"
}, {
  expected: "🧙🏻‍♀️",
  actual: "🧙🏻‍♀️"
}, {
  expected: "🧙🏼‍♀️",
  actual: "🧙🏼‍♀️"
}, {
  expected: "🧙🏽‍♀️",
  actual: "🧙🏽‍♀️"
}, {
  expected: "🧙🏾‍♀️",
  actual: "🧙🏾‍♀️"
}, {
  expected: "🧙🏿‍♀️",
  actual: "🧙🏿‍♀️"
}, {
  expected: "🧚🏻‍♂️",
  actual: "🧚🏻‍♂️"
}, {
  expected: "🧚🏼‍♂️",
  actual: "🧚🏼‍♂️"
}, {
  expected: "🧚🏽‍♂️",
  actual: "🧚🏽‍♂️"
}, {
  expected: "🧚🏾‍♂️",
  actual: "🧚🏾‍♂️"
}, {
  expected: "🧚🏿‍♂️",
  actual: "🧚🏿‍♂️"
}, {
  expected: "🧚🏻‍♀️",
  actual: "🧚🏻‍♀️"
}, {
  expected: "🧚🏼‍♀️",
  actual: "🧚🏼‍♀️"
}, {
  expected: "🧚🏽‍♀️",
  actual: "🧚🏽‍♀️"
}, {
  expected: "🧚🏾‍♀️",
  actual: "🧚🏾‍♀️"
}, {
  expected: "🧚🏿‍♀️",
  actual: "🧚🏿‍♀️"
}, {
  expected: "🧛🏻‍♂️",
  actual: "🧛🏻‍♂️"
}, {
  expected: "🧛🏼‍♂️",
  actual: "🧛🏼‍♂️"
}, {
  expected: "🧛🏽‍♂️",
  actual: "🧛🏽‍♂️"
}, {
  expected: "🧛🏾‍♂️",
  actual: "🧛🏾‍♂️"
}, {
  expected: "🧛🏿‍♂️",
  actual: "🧛🏿‍♂️"
}, {
  expected: "🧛🏻‍♀️",
  actual: "🧛🏻‍♀️"
}, {
  expected: "🧛🏼‍♀️",
  actual: "🧛🏼‍♀️"
}, {
  expected: "🧛🏽‍♀️",
  actual: "🧛🏽‍♀️"
}, {
  expected: "🧛🏾‍♀️",
  actual: "🧛🏾‍♀️"
}, {
  expected: "🧛🏿‍♀️",
  actual: "🧛🏿‍♀️"
}, {
  expected: "🧜🏻‍♂️",
  actual: "🧜🏻‍♂️"
}, {
  expected: "🧜🏼‍♂️",
  actual: "🧜🏼‍♂️"
}, {
  expected: "🧜🏽‍♂️",
  actual: "🧜🏽‍♂️"
}, {
  expected: "🧜🏾‍♂️",
  actual: "🧜🏾‍♂️"
}, {
  expected: "🧜🏿‍♂️",
  actual: "🧜🏿‍♂️"
}, {
  expected: "🧜🏻‍♀️",
  actual: "🧜🏻‍♀️"
}, {
  expected: "🧜🏼‍♀️",
  actual: "🧜🏼‍♀️"
}, {
  expected: "🧜🏽‍♀️",
  actual: "🧜🏽‍♀️"
}, {
  expected: "🧜🏾‍♀️",
  actual: "🧜🏾‍♀️"
}, {
  expected: "🧜🏿‍♀️",
  actual: "🧜🏿‍♀️"
}, {
  expected: "🧝🏻‍♂️",
  actual: "🧝🏻‍♂️"
}, {
  expected: "🧝🏼‍♂️",
  actual: "🧝🏼‍♂️"
}, {
  expected: "🧝🏽‍♂️",
  actual: "🧝🏽‍♂️"
}, {
  expected: "🧝🏾‍♂️",
  actual: "🧝🏾‍♂️"
}, {
  expected: "🧝🏿‍♂️",
  actual: "🧝🏿‍♂️"
}, {
  expected: "🧝🏻‍♀️",
  actual: "🧝🏻‍♀️"
}, {
  expected: "🧝🏼‍♀️",
  actual: "🧝🏼‍♀️"
}, {
  expected: "🧝🏽‍♀️",
  actual: "🧝🏽‍♀️"
}, {
  expected: "🧝🏾‍♀️",
  actual: "🧝🏾‍♀️"
}, {
  expected: "🧝🏿‍♀️",
  actual: "🧝🏿‍♀️"
}, {
  expected: "💆🏻‍♂️",
  actual: "💆🏻‍♂️"
}, {
  expected: "💆🏼‍♂️",
  actual: "💆🏼‍♂️"
}, {
  expected: "💆🏽‍♂️",
  actual: "💆🏽‍♂️"
}, {
  expected: "💆🏾‍♂️",
  actual: "💆🏾‍♂️"
}, {
  expected: "💆🏿‍♂️",
  actual: "💆🏿‍♂️"
}, {
  expected: "💆🏻‍♀️",
  actual: "💆🏻‍♀️"
}, {
  expected: "💆🏼‍♀️",
  actual: "💆🏼‍♀️"
}, {
  expected: "💆🏽‍♀️",
  actual: "💆🏽‍♀️"
}, {
  expected: "💆🏾‍♀️",
  actual: "💆🏾‍♀️"
}, {
  expected: "💆🏿‍♀️",
  actual: "💆🏿‍♀️"
}, {
  expected: "💇🏻‍♂️",
  actual: "💇🏻‍♂️"
}, {
  expected: "💇🏼‍♂️",
  actual: "💇🏼‍♂️"
}, {
  expected: "💇🏽‍♂️",
  actual: "💇🏽‍♂️"
}, {
  expected: "💇🏾‍♂️",
  actual: "💇🏾‍♂️"
}, {
  expected: "💇🏿‍♂️",
  actual: "💇🏿‍♂️"
}, {
  expected: "💇🏻‍♀️",
  actual: "💇🏻‍♀️"
}, {
  expected: "💇🏼‍♀️",
  actual: "💇🏼‍♀️"
}, {
  expected: "💇🏽‍♀️",
  actual: "💇🏽‍♀️"
}, {
  expected: "💇🏾‍♀️",
  actual: "💇🏾‍♀️"
}, {
  expected: "💇🏿‍♀️",
  actual: "💇🏿‍♀️"
}, {
  expected: "🚶🏻‍♂️",
  actual: "🚶🏻‍♂️"
}, {
  expected: "🚶🏼‍♂️",
  actual: "🚶🏼‍♂️"
}, {
  expected: "🚶🏽‍♂️",
  actual: "🚶🏽‍♂️"
}, {
  expected: "🚶🏾‍♂️",
  actual: "🚶🏾‍♂️"
}, {
  expected: "🚶🏿‍♂️",
  actual: "🚶🏿‍♂️"
}, {
  expected: "🚶🏻‍♀️",
  actual: "🚶🏻‍♀️"
}, {
  expected: "🚶🏼‍♀️",
  actual: "🚶🏼‍♀️"
}, {
  expected: "🚶🏽‍♀️",
  actual: "🚶🏽‍♀️"
}, {
  expected: "🚶🏾‍♀️",
  actual: "🚶🏾‍♀️"
}, {
  expected: "🚶🏿‍♀️",
  actual: "🚶🏿‍♀️"
}, {
  expected: "🧍🏻‍♂️",
  actual: "🧍🏻‍♂️"
}, {
  expected: "🧍🏼‍♂️",
  actual: "🧍🏼‍♂️"
}, {
  expected: "🧍🏽‍♂️",
  actual: "🧍🏽‍♂️"
}, {
  expected: "🧍🏾‍♂️",
  actual: "🧍🏾‍♂️"
}, {
  expected: "🧍🏿‍♂️",
  actual: "🧍🏿‍♂️"
}, {
  expected: "🧍🏻‍♀️",
  actual: "🧍🏻‍♀️"
}, {
  expected: "🧍🏼‍♀️",
  actual: "🧍🏼‍♀️"
}, {
  expected: "🧍🏽‍♀️",
  actual: "🧍🏽‍♀️"
}, {
  expected: "🧍🏾‍♀️",
  actual: "🧍🏾‍♀️"
}, {
  expected: "🧍🏿‍♀️",
  actual: "🧍🏿‍♀️"
}, {
  expected: "🧎🏻‍♂️",
  actual: "🧎🏻‍♂️"
}, {
  expected: "🧎🏼‍♂️",
  actual: "🧎🏼‍♂️"
}, {
  expected: "🧎🏽‍♂️",
  actual: "🧎🏽‍♂️"
}, {
  expected: "🧎🏾‍♂️",
  actual: "🧎🏾‍♂️"
}, {
  expected: "🧎🏿‍♂️",
  actual: "🧎🏿‍♂️"
}, {
  expected: "🧎🏻‍♀️",
  actual: "🧎🏻‍♀️"
}, {
  expected: "🧎🏼‍♀️",
  actual: "🧎🏼‍♀️"
}, {
  expected: "🧎🏽‍♀️",
  actual: "🧎🏽‍♀️"
}, {
  expected: "🧎🏾‍♀️",
  actual: "🧎🏾‍♀️"
}, {
  expected: "🧎🏿‍♀️",
  actual: "🧎🏿‍♀️"
}, {
  expected: "🏃🏻‍♂️",
  actual: "🏃🏻‍♂️"
}, {
  expected: "🏃🏼‍♂️",
  actual: "🏃🏼‍♂️"
}, {
  expected: "🏃🏽‍♂️",
  actual: "🏃🏽‍♂️"
}, {
  expected: "🏃🏾‍♂️",
  actual: "🏃🏾‍♂️"
}, {
  expected: "🏃🏿‍♂️",
  actual: "🏃🏿‍♂️"
}, {
  expected: "🏃🏻‍♀️",
  actual: "🏃🏻‍♀️"
}, {
  expected: "🏃🏼‍♀️",
  actual: "🏃🏼‍♀️"
}, {
  expected: "🏃🏽‍♀️",
  actual: "🏃🏽‍♀️"
}, {
  expected: "🏃🏾‍♀️",
  actual: "🏃🏾‍♀️"
}, {
  expected: "🏃🏿‍♀️",
  actual: "🏃🏿‍♀️"
}, {
  expected: "🧖🏻‍♂️",
  actual: "🧖🏻‍♂️"
}, {
  expected: "🧖🏼‍♂️",
  actual: "🧖🏼‍♂️"
}, {
  expected: "🧖🏽‍♂️",
  actual: "🧖🏽‍♂️"
}, {
  expected: "🧖🏾‍♂️",
  actual: "🧖🏾‍♂️"
}, {
  expected: "🧖🏿‍♂️",
  actual: "🧖🏿‍♂️"
}, {
  expected: "🧖🏻‍♀️",
  actual: "🧖🏻‍♀️"
}, {
  expected: "🧖🏼‍♀️",
  actual: "🧖🏼‍♀️"
}, {
  expected: "🧖🏽‍♀️",
  actual: "🧖🏽‍♀️"
}, {
  expected: "🧖🏾‍♀️",
  actual: "🧖🏾‍♀️"
}, {
  expected: "🧖🏿‍♀️",
  actual: "🧖🏿‍♀️"
}, {
  expected: "🧗🏻‍♂️",
  actual: "🧗🏻‍♂️"
}, {
  expected: "🧗🏼‍♂️",
  actual: "🧗🏼‍♂️"
}, {
  expected: "🧗🏽‍♂️",
  actual: "🧗🏽‍♂️"
}, {
  expected: "🧗🏾‍♂️",
  actual: "🧗🏾‍♂️"
}, {
  expected: "🧗🏿‍♂️",
  actual: "🧗🏿‍♂️"
}, {
  expected: "🧗🏻‍♀️",
  actual: "🧗🏻‍♀️"
}, {
  expected: "🧗🏼‍♀️",
  actual: "🧗🏼‍♀️"
}, {
  expected: "🧗🏽‍♀️",
  actual: "🧗🏽‍♀️"
}, {
  expected: "🧗🏾‍♀️",
  actual: "🧗🏾‍♀️"
}, {
  expected: "🧗🏿‍♀️",
  actual: "🧗🏿‍♀️"
}, {
  expected: "🏌🏻‍♂️",
  actual: "🏌🏻‍♂️"
}, {
  expected: "🏌🏼‍♂️",
  actual: "🏌🏼‍♂️"
}, {
  expected: "🏌🏽‍♂️",
  actual: "🏌🏽‍♂️"
}, {
  expected: "🏌🏾‍♂️",
  actual: "🏌🏾‍♂️"
}, {
  expected: "🏌🏿‍♂️",
  actual: "🏌🏿‍♂️"
}, {
  expected: "🏌🏻‍♀️",
  actual: "🏌🏻‍♀️"
}, {
  expected: "🏌🏼‍♀️",
  actual: "🏌🏼‍♀️"
}, {
  expected: "🏌🏽‍♀️",
  actual: "🏌🏽‍♀️"
}, {
  expected: "🏌🏾‍♀️",
  actual: "🏌🏾‍♀️"
}, {
  expected: "🏌🏿‍♀️",
  actual: "🏌🏿‍♀️"
}, {
  expected: "🏄🏻‍♂️",
  actual: "🏄🏻‍♂️"
}, {
  expected: "🏄🏼‍♂️",
  actual: "🏄🏼‍♂️"
}, {
  expected: "🏄🏽‍♂️",
  actual: "🏄🏽‍♂️"
}, {
  expected: "🏄🏾‍♂️",
  actual: "🏄🏾‍♂️"
}, {
  expected: "🏄🏿‍♂️",
  actual: "🏄🏿‍♂️"
}, {
  expected: "🏄🏻‍♀️",
  actual: "🏄🏻‍♀️"
}, {
  expected: "🏄🏼‍♀️",
  actual: "🏄🏼‍♀️"
}, {
  expected: "🏄🏽‍♀️",
  actual: "🏄🏽‍♀️"
}, {
  expected: "🏄🏾‍♀️",
  actual: "🏄🏾‍♀️"
}, {
  expected: "🏄🏿‍♀️",
  actual: "🏄🏿‍♀️"
}, {
  expected: "🚣🏻‍♂️",
  actual: "🚣🏻‍♂️"
}, {
  expected: "🚣🏼‍♂️",
  actual: "🚣🏼‍♂️"
}, {
  expected: "🚣🏽‍♂️",
  actual: "🚣🏽‍♂️"
}, {
  expected: "🚣🏾‍♂️",
  actual: "🚣🏾‍♂️"
}, {
  expected: "🚣🏿‍♂️",
  actual: "🚣🏿‍♂️"
}, {
  expected: "🚣🏻‍♀️",
  actual: "🚣🏻‍♀️"
}, {
  expected: "🚣🏼‍♀️",
  actual: "🚣🏼‍♀️"
}, {
  expected: "🚣🏽‍♀️",
  actual: "🚣🏽‍♀️"
}, {
  expected: "🚣🏾‍♀️",
  actual: "🚣🏾‍♀️"
}, {
  expected: "🚣🏿‍♀️",
  actual: "🚣🏿‍♀️"
}, {
  expected: "🏊🏻‍♂️",
  actual: "🏊🏻‍♂️"
}, {
  expected: "🏊🏼‍♂️",
  actual: "🏊🏼‍♂️"
}, {
  expected: "🏊🏽‍♂️",
  actual: "🏊🏽‍♂️"
}, {
  expected: "🏊🏾‍♂️",
  actual: "🏊🏾‍♂️"
}, {
  expected: "🏊🏿‍♂️",
  actual: "🏊🏿‍♂️"
}, {
  expected: "🏊🏻‍♀️",
  actual: "🏊🏻‍♀️"
}, {
  expected: "🏊🏼‍♀️",
  actual: "🏊🏼‍♀️"
}, {
  expected: "🏊🏽‍♀️",
  actual: "🏊🏽‍♀️"
}, {
  expected: "🏊🏾‍♀️",
  actual: "🏊🏾‍♀️"
}, {
  expected: "🏊🏿‍♀️",
  actual: "🏊🏿‍♀️"
}, {
  expected: "🏋🏻‍♂️",
  actual: "🏋🏻‍♂️"
}, {
  expected: "🏋🏼‍♂️",
  actual: "🏋🏼‍♂️"
}, {
  expected: "🏋🏽‍♂️",
  actual: "🏋🏽‍♂️"
}, {
  expected: "🏋🏾‍♂️",
  actual: "🏋🏾‍♂️"
}, {
  expected: "🏋🏿‍♂️",
  actual: "🏋🏿‍♂️"
}, {
  expected: "🏋🏻‍♀️",
  actual: "🏋🏻‍♀️"
}, {
  expected: "🏋🏼‍♀️",
  actual: "🏋🏼‍♀️"
}, {
  expected: "🏋🏽‍♀️",
  actual: "🏋🏽‍♀️"
}, {
  expected: "🏋🏾‍♀️",
  actual: "🏋🏾‍♀️"
}, {
  expected: "🏋🏿‍♀️",
  actual: "🏋🏿‍♀️"
}, {
  expected: "🚴🏻‍♂️",
  actual: "🚴🏻‍♂️"
}, {
  expected: "🚴🏼‍♂️",
  actual: "🚴🏼‍♂️"
}, {
  expected: "🚴🏽‍♂️",
  actual: "🚴🏽‍♂️"
}, {
  expected: "🚴🏾‍♂️",
  actual: "🚴🏾‍♂️"
}, {
  expected: "🚴🏿‍♂️",
  actual: "🚴🏿‍♂️"
}, {
  expected: "🚴🏻‍♀️",
  actual: "🚴🏻‍♀️"
}, {
  expected: "🚴🏼‍♀️",
  actual: "🚴🏼‍♀️"
}, {
  expected: "🚴🏽‍♀️",
  actual: "🚴🏽‍♀️"
}, {
  expected: "🚴🏾‍♀️",
  actual: "🚴🏾‍♀️"
}, {
  expected: "🚴🏿‍♀️",
  actual: "🚴🏿‍♀️"
}, {
  expected: "🚵🏻‍♂️",
  actual: "🚵🏻‍♂️"
}, {
  expected: "🚵🏼‍♂️",
  actual: "🚵🏼‍♂️"
}, {
  expected: "🚵🏽‍♂️",
  actual: "🚵🏽‍♂️"
}, {
  expected: "🚵🏾‍♂️",
  actual: "🚵🏾‍♂️"
}, {
  expected: "🚵🏿‍♂️",
  actual: "🚵🏿‍♂️"
}, {
  expected: "🚵🏻‍♀️",
  actual: "🚵🏻‍♀️"
}, {
  expected: "🚵🏼‍♀️",
  actual: "🚵🏼‍♀️"
}, {
  expected: "🚵🏽‍♀️",
  actual: "🚵🏽‍♀️"
}, {
  expected: "🚵🏾‍♀️",
  actual: "🚵🏾‍♀️"
}, {
  expected: "🚵🏿‍♀️",
  actual: "🚵🏿‍♀️"
}, {
  expected: "🤸🏻‍♂️",
  actual: "🤸🏻‍♂️"
}, {
  expected: "🤸🏼‍♂️",
  actual: "🤸🏼‍♂️"
}, {
  expected: "🤸🏽‍♂️",
  actual: "🤸🏽‍♂️"
}, {
  expected: "🤸🏾‍♂️",
  actual: "🤸🏾‍♂️"
}, {
  expected: "🤸🏿‍♂️",
  actual: "🤸🏿‍♂️"
}, {
  expected: "🤸🏻‍♀️",
  actual: "🤸🏻‍♀️"
}, {
  expected: "🤸🏼‍♀️",
  actual: "🤸🏼‍♀️"
}, {
  expected: "🤸🏽‍♀️",
  actual: "🤸🏽‍♀️"
}, {
  expected: "🤸🏾‍♀️",
  actual: "🤸🏾‍♀️"
}, {
  expected: "🤸🏿‍♀️",
  actual: "🤸🏿‍♀️"
}, {
  expected: "🤽🏻‍♂️",
  actual: "🤽🏻‍♂️"
}, {
  expected: "🤽🏼‍♂️",
  actual: "🤽🏼‍♂️"
}, {
  expected: "🤽🏽‍♂️",
  actual: "🤽🏽‍♂️"
}, {
  expected: "🤽🏾‍♂️",
  actual: "🤽🏾‍♂️"
}, {
  expected: "🤽🏿‍♂️",
  actual: "🤽🏿‍♂️"
}, {
  expected: "🤽🏻‍♀️",
  actual: "🤽🏻‍♀️"
}, {
  expected: "🤽🏼‍♀️",
  actual: "🤽🏼‍♀️"
}, {
  expected: "🤽🏽‍♀️",
  actual: "🤽🏽‍♀️"
}, {
  expected: "🤽🏾‍♀️",
  actual: "🤽🏾‍♀️"
}, {
  expected: "🤽🏿‍♀️",
  actual: "🤽🏿‍♀️"
}, {
  expected: "🤾🏻‍♂️",
  actual: "🤾🏻‍♂️"
}, {
  expected: "🤾🏼‍♂️",
  actual: "🤾🏼‍♂️"
}, {
  expected: "🤾🏽‍♂️",
  actual: "🤾🏽‍♂️"
}, {
  expected: "🤾🏾‍♂️",
  actual: "🤾🏾‍♂️"
}, {
  expected: "🤾🏿‍♂️",
  actual: "🤾🏿‍♂️"
}, {
  expected: "🤾🏻‍♀️",
  actual: "🤾🏻‍♀️"
}, {
  expected: "🤾🏼‍♀️",
  actual: "🤾🏼‍♀️"
}, {
  expected: "🤾🏽‍♀️",
  actual: "🤾🏽‍♀️"
}, {
  expected: "🤾🏾‍♀️",
  actual: "🤾🏾‍♀️"
}, {
  expected: "🤾🏿‍♀️",
  actual: "🤾🏿‍♀️"
}, {
  expected: "🤹🏻‍♂️",
  actual: "🤹🏻‍♂️"
}, {
  expected: "🤹🏼‍♂️",
  actual: "🤹🏼‍♂️"
}, {
  expected: "🤹🏽‍♂️",
  actual: "🤹🏽‍♂️"
}, {
  expected: "🤹🏾‍♂️",
  actual: "🤹🏾‍♂️"
}, {
  expected: "🤹🏿‍♂️",
  actual: "🤹🏿‍♂️"
}, {
  expected: "🤹🏻‍♀️",
  actual: "🤹🏻‍♀️"
}, {
  expected: "🤹🏼‍♀️",
  actual: "🤹🏼‍♀️"
}, {
  expected: "🤹🏽‍♀️",
  actual: "🤹🏽‍♀️"
}, {
  expected: "🤹🏾‍♀️",
  actual: "🤹🏾‍♀️"
}, {
  expected: "🤹🏿‍♀️",
  actual: "🤹🏿‍♀️"
}, {
  expected: "🧘🏻‍♂️",
  actual: "🧘🏻‍♂️"
}, {
  expected: "🧘🏼‍♂️",
  actual: "🧘🏼‍♂️"
}, {
  expected: "🧘🏽‍♂️",
  actual: "🧘🏽‍♂️"
}, {
  expected: "🧘🏾‍♂️",
  actual: "🧘🏾‍♂️"
}, {
  expected: "🧘🏿‍♂️",
  actual: "🧘🏿‍♂️"
}, {
  expected: "🧘🏻‍♀️",
  actual: "🧘🏻‍♀️"
}, {
  expected: "🧘🏼‍♀️",
  actual: "🧘🏼‍♀️"
}, {
  expected: "🧘🏽‍♀️",
  actual: "🧘🏽‍♀️"
}, {
  expected: "🧘🏾‍♀️",
  actual: "🧘🏾‍♀️"
}, {
  expected: "🧘🏿‍♀️",
  actual: "🧘🏿‍♀️"
}, {
  expected: "👩‍❤‍👨",
  actual: "👩‍❤‍👨"
}, {
  expected: "👨‍❤‍👨",
  actual: "👨‍❤‍👨"
}, {
  expected: "👩‍❤‍👩",
  actual: "👩‍❤‍👩"
}, {
  expected: "🫱🏻‍🫲🏼",
  actual: "🫱🏻🫲🏼"
}, {
  expected: "🫱🏻‍🫲🏽",
  actual: "🫱🏻🫲🏽"
}, {
  expected: "🫱🏻‍🫲🏾",
  actual: "🫱🏻🫲🏾"
}, {
  expected: "🫱🏻‍🫲🏿",
  actual: "🫱🏻🫲🏿"
}, {
  expected: "🫱🏼‍🫲🏻",
  actual: "🫱🏼🫲🏻"
}, {
  expected: "🫱🏼‍🫲🏽",
  actual: "🫱🏼🫲🏽"
}, {
  expected: "🫱🏼‍🫲🏾",
  actual: "🫱🏼🫲🏾"
}, {
  expected: "🫱🏼‍🫲🏿",
  actual: "🫱🏼🫲🏿"
}, {
  expected: "🫱🏽‍🫲🏻",
  actual: "🫱🏽🫲🏻"
}, {
  expected: "🫱🏽‍🫲🏼",
  actual: "🫱🏽🫲🏼"
}, {
  expected: "🫱🏽‍🫲🏾",
  actual: "🫱🏽🫲🏾"
}, {
  expected: "🫱🏽‍🫲🏿",
  actual: "🫱🏽🫲🏿"
}, {
  expected: "🫱🏾‍🫲🏻",
  actual: "🫱🏾🫲🏻"
}, {
  expected: "🫱🏾‍🫲🏼",
  actual: "🫱🏾🫲🏼"
}, {
  expected: "🫱🏾‍🫲🏽",
  actual: "🫱🏾🫲🏽"
}, {
  expected: "🫱🏾‍🫲🏿",
  actual: "🫱🏾🫲🏿"
}, {
  expected: "🫱🏿‍🫲🏻",
  actual: "🫱🏿🫲🏻"
}, {
  expected: "🫱🏿‍🫲🏼",
  actual: "🫱🏿🫲🏼"
}, {
  expected: "🫱🏿‍🫲🏽",
  actual: "🫱🏿🫲🏽"
}, {
  expected: "🫱🏿‍🫲🏾",
  actual: "🫱🏿🫲🏾"
}, {
  expected: "🕵️‍♂️",
  actual: "🕵️‍♂️"
}, {
  expected: "🕵️‍♀️",
  actual: "🕵️‍♀️"
}, {
  expected: "🏌️‍♂️",
  actual: "🏌️‍♂️"
}, {
  expected: "🏌️‍♀️",
  actual: "🏌️‍♀️"
}, {
  expected: "⛹🏻‍♂️",
  actual: "⛹🏻‍♂️"
}, {
  expected: "⛹🏼‍♂️",
  actual: "⛹🏼‍♂️"
}, {
  expected: "⛹🏽‍♂️",
  actual: "⛹🏽‍♂️"
}, {
  expected: "⛹🏾‍♂️",
  actual: "⛹🏾‍♂️"
}, {
  expected: "⛹🏿‍♂️",
  actual: "⛹🏿‍♂️"
}, {
  expected: "⛹🏻‍♀️",
  actual: "⛹🏻‍♀️"
}, {
  expected: "⛹🏼‍♀️",
  actual: "⛹🏼‍♀️"
}, {
  expected: "⛹🏽‍♀️",
  actual: "⛹🏽‍♀️"
}, {
  expected: "⛹🏾‍♀️",
  actual: "⛹🏾‍♀️"
}, {
  expected: "⛹🏿‍♀️",
  actual: "⛹🏿‍♀️"
}, {
  expected: "🏋️‍♂️",
  actual: "🏋️‍♂️"
}, {
  expected: "🏋️‍♀️",
  actual: "🏋️‍♀️"
}, {
  expected: "👨‍👩‍👧‍👦",
  actual: "👨👩👧👦"
}, {
  expected: "👨‍👩‍👦‍👦",
  actual: "👨👩👦👦"
}, {
  expected: "👨‍👩‍👧‍👧",
  actual: "👨👩👧👧"
}, {
  expected: "👨‍👨‍👧‍👦",
  actual: "👨👨👧👦"
}, {
  expected: "👨‍👨‍👦‍👦",
  actual: "👨👨👦👦"
}, {
  expected: "👨‍👨‍👧‍👧",
  actual: "👨👨👧👧"
}, {
  expected: "👩‍👩‍👧‍👦",
  actual: "👩👩👧👦"
}, {
  expected: "👩‍👩‍👦‍👦",
  actual: "👩👩👦👦"
}, {
  expected: "👩‍👩‍👧‍👧",
  actual: "👩👩👧👧"
}, {
  expected: "🏳️‍⚧️",
  actual: "🏳️‍⚧️"
}, {
  expected: "👨🏻‍🦰",
  actual: "👨🏻‍🦰"
}, {
  expected: "👨🏼‍🦰",
  actual: "👨🏼‍🦰"
}, {
  expected: "👨🏽‍🦰",
  actual: "👨🏽‍🦰"
}, {
  expected: "👨🏾‍🦰",
  actual: "👨🏾‍🦰"
}, {
  expected: "👨🏿‍🦰",
  actual: "👨🏿‍🦰"
}, {
  expected: "👨🏻‍🦱",
  actual: "👨🏻‍🦱"
}, {
  expected: "👨🏼‍🦱",
  actual: "👨🏼‍🦱"
}, {
  expected: "👨🏽‍🦱",
  actual: "👨🏽‍🦱"
}, {
  expected: "👨🏾‍🦱",
  actual: "👨🏾‍🦱"
}, {
  expected: "👨🏿‍🦱",
  actual: "👨🏿‍🦱"
}, {
  expected: "👨🏻‍🦳",
  actual: "👨🏻‍🦳"
}, {
  expected: "👨🏼‍🦳",
  actual: "👨🏼‍🦳"
}, {
  expected: "👨🏽‍🦳",
  actual: "👨🏽‍🦳"
}, {
  expected: "👨🏾‍🦳",
  actual: "👨🏾‍🦳"
}, {
  expected: "👨🏿‍🦳",
  actual: "👨🏿‍🦳"
}, {
  expected: "👨🏻‍🦲",
  actual: "👨🏻‍🦲"
}, {
  expected: "👨🏼‍🦲",
  actual: "👨🏼‍🦲"
}, {
  expected: "👨🏽‍🦲",
  actual: "👨🏽‍🦲"
}, {
  expected: "👨🏾‍🦲",
  actual: "👨🏾‍🦲"
}, {
  expected: "👨🏿‍🦲",
  actual: "👨🏿‍🦲"
}, {
  expected: "👩🏻‍🦰",
  actual: "👩🏻‍🦰"
}, {
  expected: "👩🏼‍🦰",
  actual: "👩🏼‍🦰"
}, {
  expected: "👩🏽‍🦰",
  actual: "👩🏽‍🦰"
}, {
  expected: "👩🏾‍🦰",
  actual: "👩🏾‍🦰"
}, {
  expected: "👩🏿‍🦰",
  actual: "👩🏿‍🦰"
}, {
  expected: "🧑🏻‍🦰",
  actual: "🧑🏻‍🦰"
}, {
  expected: "🧑🏼‍🦰",
  actual: "🧑🏼‍🦰"
}, {
  expected: "🧑🏽‍🦰",
  actual: "🧑🏽‍🦰"
}, {
  expected: "🧑🏾‍🦰",
  actual: "🧑🏾‍🦰"
}, {
  expected: "🧑🏿‍🦰",
  actual: "🧑🏿‍🦰"
}, {
  expected: "👩🏻‍🦱",
  actual: "👩🏻‍🦱"
}, {
  expected: "👩🏼‍🦱",
  actual: "👩🏼‍🦱"
}, {
  expected: "👩🏽‍🦱",
  actual: "👩🏽‍🦱"
}, {
  expected: "👩🏾‍🦱",
  actual: "👩🏾‍🦱"
}, {
  expected: "👩🏿‍🦱",
  actual: "👩🏿‍🦱"
}, {
  expected: "🧑🏻‍🦱",
  actual: "🧑🏻‍🦱"
}, {
  expected: "🧑🏼‍🦱",
  actual: "🧑🏼‍🦱"
}, {
  expected: "🧑🏽‍🦱",
  actual: "🧑🏽‍🦱"
}, {
  expected: "🧑🏾‍🦱",
  actual: "🧑🏾‍🦱"
}, {
  expected: "🧑🏿‍🦱",
  actual: "🧑🏿‍🦱"
}, {
  expected: "👩🏻‍🦳",
  actual: "👩🏻‍🦳"
}, {
  expected: "👩🏼‍🦳",
  actual: "👩🏼‍🦳"
}, {
  expected: "👩🏽‍🦳",
  actual: "👩🏽‍🦳"
}, {
  expected: "👩🏾‍🦳",
  actual: "👩🏾‍🦳"
}, {
  expected: "👩🏿‍🦳",
  actual: "👩🏿‍🦳"
}, {
  expected: "🧑🏻‍🦳",
  actual: "🧑🏻‍🦳"
}, {
  expected: "🧑🏼‍🦳",
  actual: "🧑🏼‍🦳"
}, {
  expected: "🧑🏽‍🦳",
  actual: "🧑🏽‍🦳"
}, {
  expected: "🧑🏾‍🦳",
  actual: "🧑🏾‍🦳"
}, {
  expected: "🧑🏿‍🦳",
  actual: "🧑🏿‍🦳"
}, {
  expected: "👩🏻‍🦲",
  actual: "👩🏻‍🦲"
}, {
  expected: "👩🏼‍🦲",
  actual: "👩🏼‍🦲"
}, {
  expected: "👩🏽‍🦲",
  actual: "👩🏽‍🦲"
}, {
  expected: "👩🏾‍🦲",
  actual: "👩🏾‍🦲"
}, {
  expected: "👩🏿‍🦲",
  actual: "👩🏿‍🦲"
}, {
  expected: "🧑🏻‍🦲",
  actual: "🧑🏻‍🦲"
}, {
  expected: "🧑🏼‍🦲",
  actual: "🧑🏼‍🦲"
}, {
  expected: "🧑🏽‍🦲",
  actual: "🧑🏽‍🦲"
}, {
  expected: "🧑🏾‍🦲",
  actual: "🧑🏾‍🦲"
}, {
  expected: "🧑🏿‍🦲",
  actual: "🧑🏿‍🦲"
}, {
  expected: "🧑🏻‍🎓",
  actual: "🧑🏻‍🎓"
}, {
  expected: "🧑🏼‍🎓",
  actual: "🧑🏼‍🎓"
}, {
  expected: "🧑🏽‍🎓",
  actual: "🧑🏽‍🎓"
}, {
  expected: "🧑🏾‍🎓",
  actual: "🧑🏾‍🎓"
}, {
  expected: "🧑🏿‍🎓",
  actual: "🧑🏿‍🎓"
}, {
  expected: "👨🏻‍🎓",
  actual: "👨🏻‍🎓"
}, {
  expected: "👨🏼‍🎓",
  actual: "👨🏼‍🎓"
}, {
  expected: "👨🏽‍🎓",
  actual: "👨🏽‍🎓"
}, {
  expected: "👨🏾‍🎓",
  actual: "👨🏾‍🎓"
}, {
  expected: "👨🏿‍🎓",
  actual: "👨🏿‍🎓"
}, {
  expected: "👩🏻‍🎓",
  actual: "👩🏻‍🎓"
}, {
  expected: "👩🏼‍🎓",
  actual: "👩🏼‍🎓"
}, {
  expected: "👩🏽‍🎓",
  actual: "👩🏽‍🎓"
}, {
  expected: "👩🏾‍🎓",
  actual: "👩🏾‍🎓"
}, {
  expected: "👩🏿‍🎓",
  actual: "👩🏿‍🎓"
}, {
  expected: "🧑🏻‍🏫",
  actual: "🧑🏻‍🏫"
}, {
  expected: "🧑🏼‍🏫",
  actual: "🧑🏼‍🏫"
}, {
  expected: "🧑🏽‍🏫",
  actual: "🧑🏽‍🏫"
}, {
  expected: "🧑🏾‍🏫",
  actual: "🧑🏾‍🏫"
}, {
  expected: "🧑🏿‍🏫",
  actual: "🧑🏿‍🏫"
}, {
  expected: "👨🏻‍🏫",
  actual: "👨🏻‍🏫"
}, {
  expected: "👨🏼‍🏫",
  actual: "👨🏼‍🏫"
}, {
  expected: "👨🏽‍🏫",
  actual: "👨🏽‍🏫"
}, {
  expected: "👨🏾‍🏫",
  actual: "👨🏾‍🏫"
}, {
  expected: "👨🏿‍🏫",
  actual: "👨🏿‍🏫"
}, {
  expected: "👩🏻‍🏫",
  actual: "👩🏻‍🏫"
}, {
  expected: "👩🏼‍🏫",
  actual: "👩🏼‍🏫"
}, {
  expected: "👩🏽‍🏫",
  actual: "👩🏽‍🏫"
}, {
  expected: "👩🏾‍🏫",
  actual: "👩🏾‍🏫"
}, {
  expected: "👩🏿‍🏫",
  actual: "👩🏿‍🏫"
}, {
  expected: "🧑🏻‍🌾",
  actual: "🧑🏻‍🌾"
}, {
  expected: "🧑🏼‍🌾",
  actual: "🧑🏼‍🌾"
}, {
  expected: "🧑🏽‍🌾",
  actual: "🧑🏽‍🌾"
}, {
  expected: "🧑🏾‍🌾",
  actual: "🧑🏾‍🌾"
}, {
  expected: "🧑🏿‍🌾",
  actual: "🧑🏿‍🌾"
}, {
  expected: "👨🏻‍🌾",
  actual: "👨🏻‍🌾"
}, {
  expected: "👨🏼‍🌾",
  actual: "👨🏼‍🌾"
}, {
  expected: "👨🏽‍🌾",
  actual: "👨🏽‍🌾"
}, {
  expected: "👨🏾‍🌾",
  actual: "👨🏾‍🌾"
}, {
  expected: "👨🏿‍🌾",
  actual: "👨🏿‍🌾"
}, {
  expected: "👩🏻‍🌾",
  actual: "👩🏻‍🌾"
}, {
  expected: "👩🏼‍🌾",
  actual: "👩🏼‍🌾"
}, {
  expected: "👩🏽‍🌾",
  actual: "👩🏽‍🌾"
}, {
  expected: "👩🏾‍🌾",
  actual: "👩🏾‍🌾"
}, {
  expected: "👩🏿‍🌾",
  actual: "👩🏿‍🌾"
}, {
  expected: "🧑🏻‍🍳",
  actual: "🧑🏻‍🍳"
}, {
  expected: "🧑🏼‍🍳",
  actual: "🧑🏼‍🍳"
}, {
  expected: "🧑🏽‍🍳",
  actual: "🧑🏽‍🍳"
}, {
  expected: "🧑🏾‍🍳",
  actual: "🧑🏾‍🍳"
}, {
  expected: "🧑🏿‍🍳",
  actual: "🧑🏿‍🍳"
}, {
  expected: "👨🏻‍🍳",
  actual: "👨🏻‍🍳"
}, {
  expected: "👨🏼‍🍳",
  actual: "👨🏼‍🍳"
}, {
  expected: "👨🏽‍🍳",
  actual: "👨🏽‍🍳"
}, {
  expected: "👨🏾‍🍳",
  actual: "👨🏾‍🍳"
}, {
  expected: "👨🏿‍🍳",
  actual: "👨🏿‍🍳"
}, {
  expected: "👩🏻‍🍳",
  actual: "👩🏻‍🍳"
}, {
  expected: "👩🏼‍🍳",
  actual: "👩🏼‍🍳"
}, {
  expected: "👩🏽‍🍳",
  actual: "👩🏽‍🍳"
}, {
  expected: "👩🏾‍🍳",
  actual: "👩🏾‍🍳"
}, {
  expected: "👩🏿‍🍳",
  actual: "👩🏿‍🍳"
}, {
  expected: "🧑🏻‍🔧",
  actual: "🧑🏻‍🔧"
}, {
  expected: "🧑🏼‍🔧",
  actual: "🧑🏼‍🔧"
}, {
  expected: "🧑🏽‍🔧",
  actual: "🧑🏽‍🔧"
}, {
  expected: "🧑🏾‍🔧",
  actual: "🧑🏾‍🔧"
}, {
  expected: "🧑🏿‍🔧",
  actual: "🧑🏿‍🔧"
}, {
  expected: "👨🏻‍🔧",
  actual: "👨🏻‍🔧"
}, {
  expected: "👨🏼‍🔧",
  actual: "👨🏼‍🔧"
}, {
  expected: "👨🏽‍🔧",
  actual: "👨🏽‍🔧"
}, {
  expected: "👨🏾‍🔧",
  actual: "👨🏾‍🔧"
}, {
  expected: "👨🏿‍🔧",
  actual: "👨🏿‍🔧"
}, {
  expected: "👩🏻‍🔧",
  actual: "👩🏻‍🔧"
}, {
  expected: "👩🏼‍🔧",
  actual: "👩🏼‍🔧"
}, {
  expected: "👩🏽‍🔧",
  actual: "👩🏽‍🔧"
}, {
  expected: "👩🏾‍🔧",
  actual: "👩🏾‍🔧"
}, {
  expected: "👩🏿‍🔧",
  actual: "👩🏿‍🔧"
}, {
  expected: "🧑🏻‍🏭",
  actual: "🧑🏻‍🏭"
}, {
  expected: "🧑🏼‍🏭",
  actual: "🧑🏼‍🏭"
}, {
  expected: "🧑🏽‍🏭",
  actual: "🧑🏽‍🏭"
}, {
  expected: "🧑🏾‍🏭",
  actual: "🧑🏾‍🏭"
}, {
  expected: "🧑🏿‍🏭",
  actual: "🧑🏿‍🏭"
}, {
  expected: "👨🏻‍🏭",
  actual: "👨🏻‍🏭"
}, {
  expected: "👨🏼‍🏭",
  actual: "👨🏼‍🏭"
}, {
  expected: "👨🏽‍🏭",
  actual: "👨🏽‍🏭"
}, {
  expected: "👨🏾‍🏭",
  actual: "👨🏾‍🏭"
}, {
  expected: "👨🏿‍🏭",
  actual: "👨🏿‍🏭"
}, {
  expected: "👩🏻‍🏭",
  actual: "👩🏻‍🏭"
}, {
  expected: "👩🏼‍🏭",
  actual: "👩🏼‍🏭"
}, {
  expected: "👩🏽‍🏭",
  actual: "👩🏽‍🏭"
}, {
  expected: "👩🏾‍🏭",
  actual: "👩🏾‍🏭"
}, {
  expected: "👩🏿‍🏭",
  actual: "👩🏿‍🏭"
}, {
  expected: "🧑🏻‍💼",
  actual: "🧑🏻‍💼"
}, {
  expected: "🧑🏼‍💼",
  actual: "🧑🏼‍💼"
}, {
  expected: "🧑🏽‍💼",
  actual: "🧑🏽‍💼"
}, {
  expected: "🧑🏾‍💼",
  actual: "🧑🏾‍💼"
}, {
  expected: "🧑🏿‍💼",
  actual: "🧑🏿‍💼"
}, {
  expected: "👨🏻‍💼",
  actual: "👨🏻‍💼"
}, {
  expected: "👨🏼‍💼",
  actual: "👨🏼‍💼"
}, {
  expected: "👨🏽‍💼",
  actual: "👨🏽‍💼"
}, {
  expected: "👨🏾‍💼",
  actual: "👨🏾‍💼"
}, {
  expected: "👨🏿‍💼",
  actual: "👨🏿‍💼"
}, {
  expected: "👩🏻‍💼",
  actual: "👩🏻‍💼"
}, {
  expected: "👩🏼‍💼",
  actual: "👩🏼‍💼"
}, {
  expected: "👩🏽‍💼",
  actual: "👩🏽‍💼"
}, {
  expected: "👩🏾‍💼",
  actual: "👩🏾‍💼"
}, {
  expected: "👩🏿‍💼",
  actual: "👩🏿‍💼"
}, {
  expected: "🧑🏻‍🔬",
  actual: "🧑🏻‍🔬"
}, {
  expected: "🧑🏼‍🔬",
  actual: "🧑🏼‍🔬"
}, {
  expected: "🧑🏽‍🔬",
  actual: "🧑🏽‍🔬"
}, {
  expected: "🧑🏾‍🔬",
  actual: "🧑🏾‍🔬"
}, {
  expected: "🧑🏿‍🔬",
  actual: "🧑🏿‍🔬"
}, {
  expected: "👨🏻‍🔬",
  actual: "👨🏻‍🔬"
}, {
  expected: "👨🏼‍🔬",
  actual: "👨🏼‍🔬"
}, {
  expected: "👨🏽‍🔬",
  actual: "👨🏽‍🔬"
}, {
  expected: "👨🏾‍🔬",
  actual: "👨🏾‍🔬"
}, {
  expected: "👨🏿‍🔬",
  actual: "👨🏿‍🔬"
}, {
  expected: "👩🏻‍🔬",
  actual: "👩🏻‍🔬"
}, {
  expected: "👩🏼‍🔬",
  actual: "👩🏼‍🔬"
}, {
  expected: "👩🏽‍🔬",
  actual: "👩🏽‍🔬"
}, {
  expected: "👩🏾‍🔬",
  actual: "👩🏾‍🔬"
}, {
  expected: "👩🏿‍🔬",
  actual: "👩🏿‍🔬"
}, {
  expected: "🧑🏻‍💻",
  actual: "🧑🏻‍💻"
}, {
  expected: "🧑🏼‍💻",
  actual: "🧑🏼‍💻"
}, {
  expected: "🧑🏽‍💻",
  actual: "🧑🏽‍💻"
}, {
  expected: "🧑🏾‍💻",
  actual: "🧑🏾‍💻"
}, {
  expected: "🧑🏿‍💻",
  actual: "🧑🏿‍💻"
}, {
  expected: "👨🏻‍💻",
  actual: "👨🏻‍💻"
}, {
  expected: "👨🏼‍💻",
  actual: "👨🏼‍💻"
}, {
  expected: "👨🏽‍💻",
  actual: "👨🏽‍💻"
}, {
  expected: "👨🏾‍💻",
  actual: "👨🏾‍💻"
}, {
  expected: "👨🏿‍💻",
  actual: "👨🏿‍💻"
}, {
  expected: "👩🏻‍💻",
  actual: "👩🏻‍💻"
}, {
  expected: "👩🏼‍💻",
  actual: "👩🏼‍💻"
}, {
  expected: "👩🏽‍💻",
  actual: "👩🏽‍💻"
}, {
  expected: "👩🏾‍💻",
  actual: "👩🏾‍💻"
}, {
  expected: "👩🏿‍💻",
  actual: "👩🏿‍💻"
}, {
  expected: "🧑🏻‍🎤",
  actual: "🧑🏻‍🎤"
}, {
  expected: "🧑🏼‍🎤",
  actual: "🧑🏼‍🎤"
}, {
  expected: "🧑🏽‍🎤",
  actual: "🧑🏽‍🎤"
}, {
  expected: "🧑🏾‍🎤",
  actual: "🧑🏾‍🎤"
}, {
  expected: "🧑🏿‍🎤",
  actual: "🧑🏿‍🎤"
}, {
  expected: "👨🏻‍🎤",
  actual: "👨🏻‍🎤"
}, {
  expected: "👨🏼‍🎤",
  actual: "👨🏼‍🎤"
}, {
  expected: "👨🏽‍🎤",
  actual: "👨🏽‍🎤"
}, {
  expected: "👨🏾‍🎤",
  actual: "👨🏾‍🎤"
}, {
  expected: "👨🏿‍🎤",
  actual: "👨🏿‍🎤"
}, {
  expected: "👩🏻‍🎤",
  actual: "👩🏻‍🎤"
}, {
  expected: "👩🏼‍🎤",
  actual: "👩🏼‍🎤"
}, {
  expected: "👩🏽‍🎤",
  actual: "👩🏽‍🎤"
}, {
  expected: "👩🏾‍🎤",
  actual: "👩🏾‍🎤"
}, {
  expected: "👩🏿‍🎤",
  actual: "👩🏿‍🎤"
}, {
  expected: "🧑🏻‍🎨",
  actual: "🧑🏻‍🎨"
}, {
  expected: "🧑🏼‍🎨",
  actual: "🧑🏼‍🎨"
}, {
  expected: "🧑🏽‍🎨",
  actual: "🧑🏽‍🎨"
}, {
  expected: "🧑🏾‍🎨",
  actual: "🧑🏾‍🎨"
}, {
  expected: "🧑🏿‍🎨",
  actual: "🧑🏿‍🎨"
}, {
  expected: "👨🏻‍🎨",
  actual: "👨🏻‍🎨"
}, {
  expected: "👨🏼‍🎨",
  actual: "👨🏼‍🎨"
}, {
  expected: "👨🏽‍🎨",
  actual: "👨🏽‍🎨"
}, {
  expected: "👨🏾‍🎨",
  actual: "👨🏾‍🎨"
}, {
  expected: "👨🏿‍🎨",
  actual: "👨🏿‍🎨"
}, {
  expected: "👩🏻‍🎨",
  actual: "👩🏻‍🎨"
}, {
  expected: "👩🏼‍🎨",
  actual: "👩🏼‍🎨"
}, {
  expected: "👩🏽‍🎨",
  actual: "👩🏽‍🎨"
}, {
  expected: "👩🏾‍🎨",
  actual: "👩🏾‍🎨"
}, {
  expected: "👩🏿‍🎨",
  actual: "👩🏿‍🎨"
}, {
  expected: "🧑🏻‍🚀",
  actual: "🧑🏻‍🚀"
}, {
  expected: "🧑🏼‍🚀",
  actual: "🧑🏼‍🚀"
}, {
  expected: "🧑🏽‍🚀",
  actual: "🧑🏽‍🚀"
}, {
  expected: "🧑🏾‍🚀",
  actual: "🧑🏾‍🚀"
}, {
  expected: "🧑🏿‍🚀",
  actual: "🧑🏿‍🚀"
}, {
  expected: "👨🏻‍🚀",
  actual: "👨🏻‍🚀"
}, {
  expected: "👨🏼‍🚀",
  actual: "👨🏼‍🚀"
}, {
  expected: "👨🏽‍🚀",
  actual: "👨🏽‍🚀"
}, {
  expected: "👨🏾‍🚀",
  actual: "👨🏾‍🚀"
}, {
  expected: "👨🏿‍🚀",
  actual: "👨🏿‍🚀"
}, {
  expected: "👩🏻‍🚀",
  actual: "👩🏻‍🚀"
}, {
  expected: "👩🏼‍🚀",
  actual: "👩🏼‍🚀"
}, {
  expected: "👩🏽‍🚀",
  actual: "👩🏽‍🚀"
}, {
  expected: "👩🏾‍🚀",
  actual: "👩🏾‍🚀"
}, {
  expected: "👩🏿‍🚀",
  actual: "👩🏿‍🚀"
}, {
  expected: "🧑🏻‍🚒",
  actual: "🧑🏻‍🚒"
}, {
  expected: "🧑🏼‍🚒",
  actual: "🧑🏼‍🚒"
}, {
  expected: "🧑🏽‍🚒",
  actual: "🧑🏽‍🚒"
}, {
  expected: "🧑🏾‍🚒",
  actual: "🧑🏾‍🚒"
}, {
  expected: "🧑🏿‍🚒",
  actual: "🧑🏿‍🚒"
}, {
  expected: "👨🏻‍🚒",
  actual: "👨🏻‍🚒"
}, {
  expected: "👨🏼‍🚒",
  actual: "👨🏼‍🚒"
}, {
  expected: "👨🏽‍🚒",
  actual: "👨🏽‍🚒"
}, {
  expected: "👨🏾‍🚒",
  actual: "👨🏾‍🚒"
}, {
  expected: "👨🏿‍🚒",
  actual: "👨🏿‍🚒"
}, {
  expected: "👩🏻‍🚒",
  actual: "👩🏻‍🚒"
}, {
  expected: "👩🏼‍🚒",
  actual: "👩🏼‍🚒"
}, {
  expected: "👩🏽‍🚒",
  actual: "👩🏽‍🚒"
}, {
  expected: "👩🏾‍🚒",
  actual: "👩🏾‍🚒"
}, {
  expected: "👩🏿‍🚒",
  actual: "👩🏿‍🚒"
}, {
  expected: "👩🏻‍🍼",
  actual: "👩🏻‍🍼"
}, {
  expected: "👩🏼‍🍼",
  actual: "👩🏼‍🍼"
}, {
  expected: "👩🏽‍🍼",
  actual: "👩🏽‍🍼"
}, {
  expected: "👩🏾‍🍼",
  actual: "👩🏾‍🍼"
}, {
  expected: "👩🏿‍🍼",
  actual: "👩🏿‍🍼"
}, {
  expected: "👨🏻‍🍼",
  actual: "👨🏻‍🍼"
}, {
  expected: "👨🏼‍🍼",
  actual: "👨🏼‍🍼"
}, {
  expected: "👨🏽‍🍼",
  actual: "👨🏽‍🍼"
}, {
  expected: "👨🏾‍🍼",
  actual: "👨🏾‍🍼"
}, {
  expected: "👨🏿‍🍼",
  actual: "👨🏿‍🍼"
}, {
  expected: "🧑🏻‍🍼",
  actual: "🧑🏻‍🍼"
}, {
  expected: "🧑🏼‍🍼",
  actual: "🧑🏼‍🍼"
}, {
  expected: "🧑🏽‍🍼",
  actual: "🧑🏽‍🍼"
}, {
  expected: "🧑🏾‍🍼",
  actual: "🧑🏾‍🍼"
}, {
  expected: "🧑🏿‍🍼",
  actual: "🧑🏿‍🍼"
}, {
  expected: "🧑🏻‍🎄",
  actual: "🧑🏻‍🎄"
}, {
  expected: "🧑🏼‍🎄",
  actual: "🧑🏼‍🎄"
}, {
  expected: "🧑🏽‍🎄",
  actual: "🧑🏽‍🎄"
}, {
  expected: "🧑🏾‍🎄",
  actual: "🧑🏾‍🎄"
}, {
  expected: "🧑🏿‍🎄",
  actual: "🧑🏿‍🎄"
}, {
  expected: "🧑🏻‍🦯",
  actual: "🧑🏻‍🦯"
}, {
  expected: "🧑🏼‍🦯",
  actual: "🧑🏼‍🦯"
}, {
  expected: "🧑🏽‍🦯",
  actual: "🧑🏽‍🦯"
}, {
  expected: "🧑🏾‍🦯",
  actual: "🧑🏾‍🦯"
}, {
  expected: "🧑🏿‍🦯",
  actual: "🧑🏿‍🦯"
}, {
  expected: "👨🏻‍🦯",
  actual: "👨🏻‍🦯"
}, {
  expected: "👨🏼‍🦯",
  actual: "👨🏼‍🦯"
}, {
  expected: "👨🏽‍🦯",
  actual: "👨🏽‍🦯"
}, {
  expected: "👨🏾‍🦯",
  actual: "👨🏾‍🦯"
}, {
  expected: "👨🏿‍🦯",
  actual: "👨🏿‍🦯"
}, {
  expected: "👩🏻‍🦯",
  actual: "👩🏻‍🦯"
}, {
  expected: "👩🏼‍🦯",
  actual: "👩🏼‍🦯"
}, {
  expected: "👩🏽‍🦯",
  actual: "👩🏽‍🦯"
}, {
  expected: "👩🏾‍🦯",
  actual: "👩🏾‍🦯"
}, {
  expected: "👩🏿‍🦯",
  actual: "👩🏿‍🦯"
}, {
  expected: "🧑🏻‍🦼",
  actual: "🧑🏻‍🦼"
}, {
  expected: "🧑🏼‍🦼",
  actual: "🧑🏼‍🦼"
}, {
  expected: "🧑🏽‍🦼",
  actual: "🧑🏽‍🦼"
}, {
  expected: "🧑🏾‍🦼",
  actual: "🧑🏾‍🦼"
}, {
  expected: "🧑🏿‍🦼",
  actual: "🧑🏿‍🦼"
}, {
  expected: "👨🏻‍🦼",
  actual: "👨🏻‍🦼"
}, {
  expected: "👨🏼‍🦼",
  actual: "👨🏼‍🦼"
}, {
  expected: "👨🏽‍🦼",
  actual: "👨🏽‍🦼"
}, {
  expected: "👨🏾‍🦼",
  actual: "👨🏾‍🦼"
}, {
  expected: "👨🏿‍🦼",
  actual: "👨🏿‍🦼"
}, {
  expected: "👩🏻‍🦼",
  actual: "👩🏻‍🦼"
}, {
  expected: "👩🏼‍🦼",
  actual: "👩🏼‍🦼"
}, {
  expected: "👩🏽‍🦼",
  actual: "👩🏽‍🦼"
}, {
  expected: "👩🏾‍🦼",
  actual: "👩🏾‍🦼"
}, {
  expected: "👩🏿‍🦼",
  actual: "👩🏿‍🦼"
}, {
  expected: "🧑🏻‍🦽",
  actual: "🧑🏻‍🦽"
}, {
  expected: "🧑🏼‍🦽",
  actual: "🧑🏼‍🦽"
}, {
  expected: "🧑🏽‍🦽",
  actual: "🧑🏽‍🦽"
}, {
  expected: "🧑🏾‍🦽",
  actual: "🧑🏾‍🦽"
}, {
  expected: "🧑🏿‍🦽",
  actual: "🧑🏿‍🦽"
}, {
  expected: "👨🏻‍🦽",
  actual: "👨🏻‍🦽"
}, {
  expected: "👨🏼‍🦽",
  actual: "👨🏼‍🦽"
}, {
  expected: "👨🏽‍🦽",
  actual: "👨🏽‍🦽"
}, {
  expected: "👨🏾‍🦽",
  actual: "👨🏾‍🦽"
}, {
  expected: "👨🏿‍🦽",
  actual: "👨🏿‍🦽"
}, {
  expected: "👩🏻‍🦽",
  actual: "👩🏻‍🦽"
}, {
  expected: "👩🏼‍🦽",
  actual: "👩🏼‍🦽"
}, {
  expected: "👩🏽‍🦽",
  actual: "👩🏽‍🦽"
}, {
  expected: "👩🏾‍🦽",
  actual: "👩🏾‍🦽"
}, {
  expected: "👩🏿‍🦽",
  actual: "👩🏿‍🦽"
}, {
  expected: "⛹️‍♂️",
  actual: "⛹️‍♂️"
}, {
  expected: "⛹️‍♀️",
  actual: "⛹️‍♀️"
}, {
  expected: "👩‍❤️‍💋‍👨",
  actual: "👩❤💋👨"
}, {
  expected: "👨‍❤️‍💋‍👨",
  actual: "👨❤💋👨"
}, {
  expected: "👩‍❤️‍💋‍👩",
  actual: "👩❤💋👩"
}, {
  expected: "😶‍🌫️",
  actual: "😶‍🌫️"
}, {
  expected: "👁‍🗨️",
  actual: "👁‍🗨️"
}, {
  expected: "👁️‍🗨",
  actual: "👁️‍🗨"
}, {
  expected: "🧔🏻‍♂",
  actual: "🧔🏻‍♂"
}, {
  expected: "🧔🏼‍♂",
  actual: "🧔🏼‍♂"
}, {
  expected: "🧔🏽‍♂",
  actual: "🧔🏽‍♂"
}, {
  expected: "🧔🏾‍♂",
  actual: "🧔🏾‍♂"
}, {
  expected: "🧔🏿‍♂",
  actual: "🧔🏿‍♂"
}, {
  expected: "🧔🏻‍♀",
  actual: "🧔🏻‍♀"
}, {
  expected: "🧔🏼‍♀",
  actual: "🧔🏼‍♀"
}, {
  expected: "🧔🏽‍♀",
  actual: "🧔🏽‍♀"
}, {
  expected: "🧔🏾‍♀",
  actual: "🧔🏾‍♀"
}, {
  expected: "🧔🏿‍♀",
  actual: "🧔🏿‍♀"
}, {
  expected: "👱🏻‍♀",
  actual: "👱🏻‍♀"
}, {
  expected: "👱🏼‍♀",
  actual: "👱🏼‍♀"
}, {
  expected: "👱🏽‍♀",
  actual: "👱🏽‍♀"
}, {
  expected: "👱🏾‍♀",
  actual: "👱🏾‍♀"
}, {
  expected: "👱🏿‍♀",
  actual: "👱🏿‍♀"
}, {
  expected: "👱🏻‍♂",
  actual: "👱🏻‍♂"
}, {
  expected: "👱🏼‍♂",
  actual: "👱🏼‍♂"
}, {
  expected: "👱🏽‍♂",
  actual: "👱🏽‍♂"
}, {
  expected: "👱🏾‍♂",
  actual: "👱🏾‍♂"
}, {
  expected: "👱🏿‍♂",
  actual: "👱🏿‍♂"
}, {
  expected: "🙍🏻‍♂",
  actual: "🙍🏻‍♂"
}, {
  expected: "🙍🏼‍♂",
  actual: "🙍🏼‍♂"
}, {
  expected: "🙍🏽‍♂",
  actual: "🙍🏽‍♂"
}, {
  expected: "🙍🏾‍♂",
  actual: "🙍🏾‍♂"
}, {
  expected: "🙍🏿‍♂",
  actual: "🙍🏿‍♂"
}, {
  expected: "🙍🏻‍♀",
  actual: "🙍🏻‍♀"
}, {
  expected: "🙍🏼‍♀",
  actual: "🙍🏼‍♀"
}, {
  expected: "🙍🏽‍♀",
  actual: "🙍🏽‍♀"
}, {
  expected: "🙍🏾‍♀",
  actual: "🙍🏾‍♀"
}, {
  expected: "🙍🏿‍♀",
  actual: "🙍🏿‍♀"
}, {
  expected: "🙎🏻‍♂",
  actual: "🙎🏻‍♂"
}, {
  expected: "🙎🏼‍♂",
  actual: "🙎🏼‍♂"
}, {
  expected: "🙎🏽‍♂",
  actual: "🙎🏽‍♂"
}, {
  expected: "🙎🏾‍♂",
  actual: "🙎🏾‍♂"
}, {
  expected: "🙎🏿‍♂",
  actual: "🙎🏿‍♂"
}, {
  expected: "🙎🏻‍♀",
  actual: "🙎🏻‍♀"
}, {
  expected: "🙎🏼‍♀",
  actual: "🙎🏼‍♀"
}, {
  expected: "🙎🏽‍♀",
  actual: "🙎🏽‍♀"
}, {
  expected: "🙎🏾‍♀",
  actual: "🙎🏾‍♀"
}, {
  expected: "🙎🏿‍♀",
  actual: "🙎🏿‍♀"
}, {
  expected: "🙅🏻‍♂",
  actual: "🙅🏻‍♂"
}, {
  expected: "🙅🏼‍♂",
  actual: "🙅🏼‍♂"
}, {
  expected: "🙅🏽‍♂",
  actual: "🙅🏽‍♂"
}, {
  expected: "🙅🏾‍♂",
  actual: "🙅🏾‍♂"
}, {
  expected: "🙅🏿‍♂",
  actual: "🙅🏿‍♂"
}, {
  expected: "🙅🏻‍♀",
  actual: "🙅🏻‍♀"
}, {
  expected: "🙅🏼‍♀",
  actual: "🙅🏼‍♀"
}, {
  expected: "🙅🏽‍♀",
  actual: "🙅🏽‍♀"
}, {
  expected: "🙅🏾‍♀",
  actual: "🙅🏾‍♀"
}, {
  expected: "🙅🏿‍♀",
  actual: "🙅🏿‍♀"
}, {
  expected: "🙆🏻‍♂",
  actual: "🙆🏻‍♂"
}, {
  expected: "🙆🏼‍♂",
  actual: "🙆🏼‍♂"
}, {
  expected: "🙆🏽‍♂",
  actual: "🙆🏽‍♂"
}, {
  expected: "🙆🏾‍♂",
  actual: "🙆🏾‍♂"
}, {
  expected: "🙆🏿‍♂",
  actual: "🙆🏿‍♂"
}, {
  expected: "🙆🏻‍♀",
  actual: "🙆🏻‍♀"
}, {
  expected: "🙆🏼‍♀",
  actual: "🙆🏼‍♀"
}, {
  expected: "🙆🏽‍♀",
  actual: "🙆🏽‍♀"
}, {
  expected: "🙆🏾‍♀",
  actual: "🙆🏾‍♀"
}, {
  expected: "🙆🏿‍♀",
  actual: "🙆🏿‍♀"
}, {
  expected: "💁🏻‍♂",
  actual: "💁🏻‍♂"
}, {
  expected: "💁🏼‍♂",
  actual: "💁🏼‍♂"
}, {
  expected: "💁🏽‍♂",
  actual: "💁🏽‍♂"
}, {
  expected: "💁🏾‍♂",
  actual: "💁🏾‍♂"
}, {
  expected: "💁🏿‍♂",
  actual: "💁🏿‍♂"
}, {
  expected: "💁🏻‍♀",
  actual: "💁🏻‍♀"
}, {
  expected: "💁🏼‍♀",
  actual: "💁🏼‍♀"
}, {
  expected: "💁🏽‍♀",
  actual: "💁🏽‍♀"
}, {
  expected: "💁🏾‍♀",
  actual: "💁🏾‍♀"
}, {
  expected: "💁🏿‍♀",
  actual: "💁🏿‍♀"
}, {
  expected: "🙋🏻‍♂",
  actual: "🙋🏻‍♂"
}, {
  expected: "🙋🏼‍♂",
  actual: "🙋🏼‍♂"
}, {
  expected: "🙋🏽‍♂",
  actual: "🙋🏽‍♂"
}, {
  expected: "🙋🏾‍♂",
  actual: "🙋🏾‍♂"
}, {
  expected: "🙋🏿‍♂",
  actual: "🙋🏿‍♂"
}, {
  expected: "🙋🏻‍♀",
  actual: "🙋🏻‍♀"
}, {
  expected: "🙋🏼‍♀",
  actual: "🙋🏼‍♀"
}, {
  expected: "🙋🏽‍♀",
  actual: "🙋🏽‍♀"
}, {
  expected: "🙋🏾‍♀",
  actual: "🙋🏾‍♀"
}, {
  expected: "🙋🏿‍♀",
  actual: "🙋🏿‍♀"
}, {
  expected: "🧏🏻‍♂",
  actual: "🧏🏻‍♂"
}, {
  expected: "🧏🏼‍♂",
  actual: "🧏🏼‍♂"
}, {
  expected: "🧏🏽‍♂",
  actual: "🧏🏽‍♂"
}, {
  expected: "🧏🏾‍♂",
  actual: "🧏🏾‍♂"
}, {
  expected: "🧏🏿‍♂",
  actual: "🧏🏿‍♂"
}, {
  expected: "🧏🏻‍♀",
  actual: "🧏🏻‍♀"
}, {
  expected: "🧏🏼‍♀",
  actual: "🧏🏼‍♀"
}, {
  expected: "🧏🏽‍♀",
  actual: "🧏🏽‍♀"
}, {
  expected: "🧏🏾‍♀",
  actual: "🧏🏾‍♀"
}, {
  expected: "🧏🏿‍♀",
  actual: "🧏🏿‍♀"
}, {
  expected: "🙇🏻‍♂",
  actual: "🙇🏻‍♂"
}, {
  expected: "🙇🏼‍♂",
  actual: "🙇🏼‍♂"
}, {
  expected: "🙇🏽‍♂",
  actual: "🙇🏽‍♂"
}, {
  expected: "🙇🏾‍♂",
  actual: "🙇🏾‍♂"
}, {
  expected: "🙇🏿‍♂",
  actual: "🙇🏿‍♂"
}, {
  expected: "🙇🏻‍♀",
  actual: "🙇🏻‍♀"
}, {
  expected: "🙇🏼‍♀",
  actual: "🙇🏼‍♀"
}, {
  expected: "🙇🏽‍♀",
  actual: "🙇🏽‍♀"
}, {
  expected: "🙇🏾‍♀",
  actual: "🙇🏾‍♀"
}, {
  expected: "🙇🏿‍♀",
  actual: "🙇🏿‍♀"
}, {
  expected: "🤦🏻‍♂",
  actual: "🤦🏻‍♂"
}, {
  expected: "🤦🏼‍♂",
  actual: "🤦🏼‍♂"
}, {
  expected: "🤦🏽‍♂",
  actual: "🤦🏽‍♂"
}, {
  expected: "🤦🏾‍♂",
  actual: "🤦🏾‍♂"
}, {
  expected: "🤦🏿‍♂",
  actual: "🤦🏿‍♂"
}, {
  expected: "🤦🏻‍♀",
  actual: "🤦🏻‍♀"
}, {
  expected: "🤦🏼‍♀",
  actual: "🤦🏼‍♀"
}, {
  expected: "🤦🏽‍♀",
  actual: "🤦🏽‍♀"
}, {
  expected: "🤦🏾‍♀",
  actual: "🤦🏾‍♀"
}, {
  expected: "🤦🏿‍♀",
  actual: "🤦🏿‍♀"
}, {
  expected: "🤷🏻‍♂",
  actual: "🤷🏻‍♂"
}, {
  expected: "🤷🏼‍♂",
  actual: "🤷🏼‍♂"
}, {
  expected: "🤷🏽‍♂",
  actual: "🤷🏽‍♂"
}, {
  expected: "🤷🏾‍♂",
  actual: "🤷🏾‍♂"
}, {
  expected: "🤷🏿‍♂",
  actual: "🤷🏿‍♂"
}, {
  expected: "🤷🏻‍♀",
  actual: "🤷🏻‍♀"
}, {
  expected: "🤷🏼‍♀",
  actual: "🤷🏼‍♀"
}, {
  expected: "🤷🏽‍♀",
  actual: "🤷🏽‍♀"
}, {
  expected: "🤷🏾‍♀",
  actual: "🤷🏾‍♀"
}, {
  expected: "🤷🏿‍♀",
  actual: "🤷🏿‍♀"
}, {
  expected: "🧑🏻‍⚕",
  actual: "🧑🏻‍⚕"
}, {
  expected: "🧑🏼‍⚕",
  actual: "🧑🏼‍⚕"
}, {
  expected: "🧑🏽‍⚕",
  actual: "🧑🏽‍⚕"
}, {
  expected: "🧑🏾‍⚕",
  actual: "🧑🏾‍⚕"
}, {
  expected: "🧑🏿‍⚕",
  actual: "🧑🏿‍⚕"
}, {
  expected: "👨🏻‍⚕",
  actual: "👨🏻‍⚕"
}, {
  expected: "👨🏼‍⚕",
  actual: "👨🏼‍⚕"
}, {
  expected: "👨🏽‍⚕",
  actual: "👨🏽‍⚕"
}, {
  expected: "👨🏾‍⚕",
  actual: "👨🏾‍⚕"
}, {
  expected: "👨🏿‍⚕",
  actual: "👨🏿‍⚕"
}, {
  expected: "👩🏻‍⚕",
  actual: "👩🏻‍⚕"
}, {
  expected: "👩🏼‍⚕",
  actual: "👩🏼‍⚕"
}, {
  expected: "👩🏽‍⚕",
  actual: "👩🏽‍⚕"
}, {
  expected: "👩🏾‍⚕",
  actual: "👩🏾‍⚕"
}, {
  expected: "👩🏿‍⚕",
  actual: "👩🏿‍⚕"
}, {
  expected: "🧑🏻‍⚖",
  actual: "🧑🏻‍⚖"
}, {
  expected: "🧑🏼‍⚖",
  actual: "🧑🏼‍⚖"
}, {
  expected: "🧑🏽‍⚖",
  actual: "🧑🏽‍⚖"
}, {
  expected: "🧑🏾‍⚖",
  actual: "🧑🏾‍⚖"
}, {
  expected: "🧑🏿‍⚖",
  actual: "🧑🏿‍⚖"
}, {
  expected: "👨🏻‍⚖",
  actual: "👨🏻‍⚖"
}, {
  expected: "👨🏼‍⚖",
  actual: "👨🏼‍⚖"
}, {
  expected: "👨🏽‍⚖",
  actual: "👨🏽‍⚖"
}, {
  expected: "👨🏾‍⚖",
  actual: "👨🏾‍⚖"
}, {
  expected: "👨🏿‍⚖",
  actual: "👨🏿‍⚖"
}, {
  expected: "👩🏻‍⚖",
  actual: "👩🏻‍⚖"
}, {
  expected: "👩🏼‍⚖",
  actual: "👩🏼‍⚖"
}, {
  expected: "👩🏽‍⚖",
  actual: "👩🏽‍⚖"
}, {
  expected: "👩🏾‍⚖",
  actual: "👩🏾‍⚖"
}, {
  expected: "👩🏿‍⚖",
  actual: "👩🏿‍⚖"
}, {
  expected: "🧑🏻‍✈",
  actual: "🧑🏻‍✈"
}, {
  expected: "🧑🏼‍✈",
  actual: "🧑🏼‍✈"
}, {
  expected: "🧑🏽‍✈",
  actual: "🧑🏽‍✈"
}, {
  expected: "🧑🏾‍✈",
  actual: "🧑🏾‍✈"
}, {
  expected: "🧑🏿‍✈",
  actual: "🧑🏿‍✈"
}, {
  expected: "👨🏻‍✈",
  actual: "👨🏻‍✈"
}, {
  expected: "👨🏼‍✈",
  actual: "👨🏼‍✈"
}, {
  expected: "👨🏽‍✈",
  actual: "👨🏽‍✈"
}, {
  expected: "👨🏾‍✈",
  actual: "👨🏾‍✈"
}, {
  expected: "👨🏿‍✈",
  actual: "👨🏿‍✈"
}, {
  expected: "👩🏻‍✈",
  actual: "👩🏻‍✈"
}, {
  expected: "👩🏼‍✈",
  actual: "👩🏼‍✈"
}, {
  expected: "👩🏽‍✈",
  actual: "👩🏽‍✈"
}, {
  expected: "👩🏾‍✈",
  actual: "👩🏾‍✈"
}, {
  expected: "👩🏿‍✈",
  actual: "👩🏿‍✈"
}, {
  expected: "👮🏻‍♂",
  actual: "👮🏻‍♂"
}, {
  expected: "👮🏼‍♂",
  actual: "👮🏼‍♂"
}, {
  expected: "👮🏽‍♂",
  actual: "👮🏽‍♂"
}, {
  expected: "👮🏾‍♂",
  actual: "👮🏾‍♂"
}, {
  expected: "👮🏿‍♂",
  actual: "👮🏿‍♂"
}, {
  expected: "👮🏻‍♀",
  actual: "👮🏻‍♀"
}, {
  expected: "👮🏼‍♀",
  actual: "👮🏼‍♀"
}, {
  expected: "👮🏽‍♀",
  actual: "👮🏽‍♀"
}, {
  expected: "👮🏾‍♀",
  actual: "👮🏾‍♀"
}, {
  expected: "👮🏿‍♀",
  actual: "👮🏿‍♀"
}, {
  expected: "🕵🏻‍♂",
  actual: "🕵🏻‍♂"
}, {
  expected: "🕵🏼‍♂",
  actual: "🕵🏼‍♂"
}, {
  expected: "🕵🏽‍♂",
  actual: "🕵🏽‍♂"
}, {
  expected: "🕵🏾‍♂",
  actual: "🕵🏾‍♂"
}, {
  expected: "🕵🏿‍♂",
  actual: "🕵🏿‍♂"
}, {
  expected: "🕵🏻‍♀",
  actual: "🕵🏻‍♀"
}, {
  expected: "🕵🏼‍♀",
  actual: "🕵🏼‍♀"
}, {
  expected: "🕵🏽‍♀",
  actual: "🕵🏽‍♀"
}, {
  expected: "🕵🏾‍♀",
  actual: "🕵🏾‍♀"
}, {
  expected: "🕵🏿‍♀",
  actual: "🕵🏿‍♀"
}, {
  expected: "💂🏻‍♂",
  actual: "💂🏻‍♂"
}, {
  expected: "💂🏼‍♂",
  actual: "💂🏼‍♂"
}, {
  expected: "💂🏽‍♂",
  actual: "💂🏽‍♂"
}, {
  expected: "💂🏾‍♂",
  actual: "💂🏾‍♂"
}, {
  expected: "💂🏿‍♂",
  actual: "💂🏿‍♂"
}, {
  expected: "💂🏻‍♀",
  actual: "💂🏻‍♀"
}, {
  expected: "💂🏼‍♀",
  actual: "💂🏼‍♀"
}, {
  expected: "💂🏽‍♀",
  actual: "💂🏽‍♀"
}, {
  expected: "💂🏾‍♀",
  actual: "💂🏾‍♀"
}, {
  expected: "💂🏿‍♀",
  actual: "💂🏿‍♀"
}, {
  expected: "👷🏻‍♂",
  actual: "👷🏻‍♂"
}, {
  expected: "👷🏼‍♂",
  actual: "👷🏼‍♂"
}, {
  expected: "👷🏽‍♂",
  actual: "👷🏽‍♂"
}, {
  expected: "👷🏾‍♂",
  actual: "👷🏾‍♂"
}, {
  expected: "👷🏿‍♂",
  actual: "👷🏿‍♂"
}, {
  expected: "👷🏻‍♀",
  actual: "👷🏻‍♀"
}, {
  expected: "👷🏼‍♀",
  actual: "👷🏼‍♀"
}, {
  expected: "👷🏽‍♀",
  actual: "👷🏽‍♀"
}, {
  expected: "👷🏾‍♀",
  actual: "👷🏾‍♀"
}, {
  expected: "👷🏿‍♀",
  actual: "👷🏿‍♀"
}, {
  expected: "👳🏻‍♂",
  actual: "👳🏻‍♂"
}, {
  expected: "👳🏼‍♂",
  actual: "👳🏼‍♂"
}, {
  expected: "👳🏽‍♂",
  actual: "👳🏽‍♂"
}, {
  expected: "👳🏾‍♂",
  actual: "👳🏾‍♂"
}, {
  expected: "👳🏿‍♂",
  actual: "👳🏿‍♂"
}, {
  expected: "👳🏻‍♀",
  actual: "👳🏻‍♀"
}, {
  expected: "👳🏼‍♀",
  actual: "👳🏼‍♀"
}, {
  expected: "👳🏽‍♀",
  actual: "👳🏽‍♀"
}, {
  expected: "👳🏾‍♀",
  actual: "👳🏾‍♀"
}, {
  expected: "👳🏿‍♀",
  actual: "👳🏿‍♀"
}, {
  expected: "🤵🏻‍♂",
  actual: "🤵🏻‍♂"
}, {
  expected: "🤵🏼‍♂",
  actual: "🤵🏼‍♂"
}, {
  expected: "🤵🏽‍♂",
  actual: "🤵🏽‍♂"
}, {
  expected: "🤵🏾‍♂",
  actual: "🤵🏾‍♂"
}, {
  expected: "🤵🏿‍♂",
  actual: "🤵🏿‍♂"
}, {
  expected: "🤵🏻‍♀",
  actual: "🤵🏻‍♀"
}, {
  expected: "🤵🏼‍♀",
  actual: "🤵🏼‍♀"
}, {
  expected: "🤵🏽‍♀",
  actual: "🤵🏽‍♀"
}, {
  expected: "🤵🏾‍♀",
  actual: "🤵🏾‍♀"
}, {
  expected: "🤵🏿‍♀",
  actual: "🤵🏿‍♀"
}, {
  expected: "👰🏻‍♂",
  actual: "👰🏻‍♂"
}, {
  expected: "👰🏼‍♂",
  actual: "👰🏼‍♂"
}, {
  expected: "👰🏽‍♂",
  actual: "👰🏽‍♂"
}, {
  expected: "👰🏾‍♂",
  actual: "👰🏾‍♂"
}, {
  expected: "👰🏿‍♂",
  actual: "👰🏿‍♂"
}, {
  expected: "👰🏻‍♀",
  actual: "👰🏻‍♀"
}, {
  expected: "👰🏼‍♀",
  actual: "👰🏼‍♀"
}, {
  expected: "👰🏽‍♀",
  actual: "👰🏽‍♀"
}, {
  expected: "👰🏾‍♀",
  actual: "👰🏾‍♀"
}, {
  expected: "👰🏿‍♀",
  actual: "👰🏿‍♀"
}, {
  expected: "🦸🏻‍♂",
  actual: "🦸🏻‍♂"
}, {
  expected: "🦸🏼‍♂",
  actual: "🦸🏼‍♂"
}, {
  expected: "🦸🏽‍♂",
  actual: "🦸🏽‍♂"
}, {
  expected: "🦸🏾‍♂",
  actual: "🦸🏾‍♂"
}, {
  expected: "🦸🏿‍♂",
  actual: "🦸🏿‍♂"
}, {
  expected: "🦸🏻‍♀",
  actual: "🦸🏻‍♀"
}, {
  expected: "🦸🏼‍♀",
  actual: "🦸🏼‍♀"
}, {
  expected: "🦸🏽‍♀",
  actual: "🦸🏽‍♀"
}, {
  expected: "🦸🏾‍♀",
  actual: "🦸🏾‍♀"
}, {
  expected: "🦸🏿‍♀",
  actual: "🦸🏿‍♀"
}, {
  expected: "🦹🏻‍♂",
  actual: "🦹🏻‍♂"
}, {
  expected: "🦹🏼‍♂",
  actual: "🦹🏼‍♂"
}, {
  expected: "🦹🏽‍♂",
  actual: "🦹🏽‍♂"
}, {
  expected: "🦹🏾‍♂",
  actual: "🦹🏾‍♂"
}, {
  expected: "🦹🏿‍♂",
  actual: "🦹🏿‍♂"
}, {
  expected: "🦹🏻‍♀",
  actual: "🦹🏻‍♀"
}, {
  expected: "🦹🏼‍♀",
  actual: "🦹🏼‍♀"
}, {
  expected: "🦹🏽‍♀",
  actual: "🦹🏽‍♀"
}, {
  expected: "🦹🏾‍♀",
  actual: "🦹🏾‍♀"
}, {
  expected: "🦹🏿‍♀",
  actual: "🦹🏿‍♀"
}, {
  expected: "🧙🏻‍♂",
  actual: "🧙🏻‍♂"
}, {
  expected: "🧙🏼‍♂",
  actual: "🧙🏼‍♂"
}, {
  expected: "🧙🏽‍♂",
  actual: "🧙🏽‍♂"
}, {
  expected: "🧙🏾‍♂",
  actual: "🧙🏾‍♂"
}, {
  expected: "🧙🏿‍♂",
  actual: "🧙🏿‍♂"
}, {
  expected: "🧙🏻‍♀",
  actual: "🧙🏻‍♀"
}, {
  expected: "🧙🏼‍♀",
  actual: "🧙🏼‍♀"
}, {
  expected: "🧙🏽‍♀",
  actual: "🧙🏽‍♀"
}, {
  expected: "🧙🏾‍♀",
  actual: "🧙🏾‍♀"
}, {
  expected: "🧙🏿‍♀",
  actual: "🧙🏿‍♀"
}, {
  expected: "🧚🏻‍♂",
  actual: "🧚🏻‍♂"
}, {
  expected: "🧚🏼‍♂",
  actual: "🧚🏼‍♂"
}, {
  expected: "🧚🏽‍♂",
  actual: "🧚🏽‍♂"
}, {
  expected: "🧚🏾‍♂",
  actual: "🧚🏾‍♂"
}, {
  expected: "🧚🏿‍♂",
  actual: "🧚🏿‍♂"
}, {
  expected: "🧚🏻‍♀",
  actual: "🧚🏻‍♀"
}, {
  expected: "🧚🏼‍♀",
  actual: "🧚🏼‍♀"
}, {
  expected: "🧚🏽‍♀",
  actual: "🧚🏽‍♀"
}, {
  expected: "🧚🏾‍♀",
  actual: "🧚🏾‍♀"
}, {
  expected: "🧚🏿‍♀",
  actual: "🧚🏿‍♀"
}, {
  expected: "🧛🏻‍♂",
  actual: "🧛🏻‍♂"
}, {
  expected: "🧛🏼‍♂",
  actual: "🧛🏼‍♂"
}, {
  expected: "🧛🏽‍♂",
  actual: "🧛🏽‍♂"
}, {
  expected: "🧛🏾‍♂",
  actual: "🧛🏾‍♂"
}, {
  expected: "🧛🏿‍♂",
  actual: "🧛🏿‍♂"
}, {
  expected: "🧛🏻‍♀",
  actual: "🧛🏻‍♀"
}, {
  expected: "🧛🏼‍♀",
  actual: "🧛🏼‍♀"
}, {
  expected: "🧛🏽‍♀",
  actual: "🧛🏽‍♀"
}, {
  expected: "🧛🏾‍♀",
  actual: "🧛🏾‍♀"
}, {
  expected: "🧛🏿‍♀",
  actual: "🧛🏿‍♀"
}, {
  expected: "🧜🏻‍♂",
  actual: "🧜🏻‍♂"
}, {
  expected: "🧜🏼‍♂",
  actual: "🧜🏼‍♂"
}, {
  expected: "🧜🏽‍♂",
  actual: "🧜🏽‍♂"
}, {
  expected: "🧜🏾‍♂",
  actual: "🧜🏾‍♂"
}, {
  expected: "🧜🏿‍♂",
  actual: "🧜🏿‍♂"
}, {
  expected: "🧜🏻‍♀",
  actual: "🧜🏻‍♀"
}, {
  expected: "🧜🏼‍♀",
  actual: "🧜🏼‍♀"
}, {
  expected: "🧜🏽‍♀",
  actual: "🧜🏽‍♀"
}, {
  expected: "🧜🏾‍♀",
  actual: "🧜🏾‍♀"
}, {
  expected: "🧜🏿‍♀",
  actual: "🧜🏿‍♀"
}, {
  expected: "🧝🏻‍♂",
  actual: "🧝🏻‍♂"
}, {
  expected: "🧝🏼‍♂",
  actual: "🧝🏼‍♂"
}, {
  expected: "🧝🏽‍♂",
  actual: "🧝🏽‍♂"
}, {
  expected: "🧝🏾‍♂",
  actual: "🧝🏾‍♂"
}, {
  expected: "🧝🏿‍♂",
  actual: "🧝🏿‍♂"
}, {
  expected: "🧝🏻‍♀",
  actual: "🧝🏻‍♀"
}, {
  expected: "🧝🏼‍♀",
  actual: "🧝🏼‍♀"
}, {
  expected: "🧝🏽‍♀",
  actual: "🧝🏽‍♀"
}, {
  expected: "🧝🏾‍♀",
  actual: "🧝🏾‍♀"
}, {
  expected: "🧝🏿‍♀",
  actual: "🧝🏿‍♀"
}, {
  expected: "💆🏻‍♂",
  actual: "💆🏻‍♂"
}, {
  expected: "💆🏼‍♂",
  actual: "💆🏼‍♂"
}, {
  expected: "💆🏽‍♂",
  actual: "💆🏽‍♂"
}, {
  expected: "💆🏾‍♂",
  actual: "💆🏾‍♂"
}, {
  expected: "💆🏿‍♂",
  actual: "💆🏿‍♂"
}, {
  expected: "💆🏻‍♀",
  actual: "💆🏻‍♀"
}, {
  expected: "💆🏼‍♀",
  actual: "💆🏼‍♀"
}, {
  expected: "💆🏽‍♀",
  actual: "💆🏽‍♀"
}, {
  expected: "💆🏾‍♀",
  actual: "💆🏾‍♀"
}, {
  expected: "💆🏿‍♀",
  actual: "💆🏿‍♀"
}, {
  expected: "💇🏻‍♂",
  actual: "💇🏻‍♂"
}, {
  expected: "💇🏼‍♂",
  actual: "💇🏼‍♂"
}, {
  expected: "💇🏽‍♂",
  actual: "💇🏽‍♂"
}, {
  expected: "💇🏾‍♂",
  actual: "💇🏾‍♂"
}, {
  expected: "💇🏿‍♂",
  actual: "💇🏿‍♂"
}, {
  expected: "💇🏻‍♀",
  actual: "💇🏻‍♀"
}, {
  expected: "💇🏼‍♀",
  actual: "💇🏼‍♀"
}, {
  expected: "💇🏽‍♀",
  actual: "💇🏽‍♀"
}, {
  expected: "💇🏾‍♀",
  actual: "💇🏾‍♀"
}, {
  expected: "💇🏿‍♀",
  actual: "💇🏿‍♀"
}, {
  expected: "🚶🏻‍♂",
  actual: "🚶🏻‍♂"
}, {
  expected: "🚶🏼‍♂",
  actual: "🚶🏼‍♂"
}, {
  expected: "🚶🏽‍♂",
  actual: "🚶🏽‍♂"
}, {
  expected: "🚶🏾‍♂",
  actual: "🚶🏾‍♂"
}, {
  expected: "🚶🏿‍♂",
  actual: "🚶🏿‍♂"
}, {
  expected: "🚶🏻‍♀",
  actual: "🚶🏻‍♀"
}, {
  expected: "🚶🏼‍♀",
  actual: "🚶🏼‍♀"
}, {
  expected: "🚶🏽‍♀",
  actual: "🚶🏽‍♀"
}, {
  expected: "🚶🏾‍♀",
  actual: "🚶🏾‍♀"
}, {
  expected: "🚶🏿‍♀",
  actual: "🚶🏿‍♀"
}, {
  expected: "🧍🏻‍♂",
  actual: "🧍🏻‍♂"
}, {
  expected: "🧍🏼‍♂",
  actual: "🧍🏼‍♂"
}, {
  expected: "🧍🏽‍♂",
  actual: "🧍🏽‍♂"
}, {
  expected: "🧍🏾‍♂",
  actual: "🧍🏾‍♂"
}, {
  expected: "🧍🏿‍♂",
  actual: "🧍🏿‍♂"
}, {
  expected: "🧍🏻‍♀",
  actual: "🧍🏻‍♀"
}, {
  expected: "🧍🏼‍♀",
  actual: "🧍🏼‍♀"
}, {
  expected: "🧍🏽‍♀",
  actual: "🧍🏽‍♀"
}, {
  expected: "🧍🏾‍♀",
  actual: "🧍🏾‍♀"
}, {
  expected: "🧍🏿‍♀",
  actual: "🧍🏿‍♀"
}, {
  expected: "🧎🏻‍♂",
  actual: "🧎🏻‍♂"
}, {
  expected: "🧎🏼‍♂",
  actual: "🧎🏼‍♂"
}, {
  expected: "🧎🏽‍♂",
  actual: "🧎🏽‍♂"
}, {
  expected: "🧎🏾‍♂",
  actual: "🧎🏾‍♂"
}, {
  expected: "🧎🏿‍♂",
  actual: "🧎🏿‍♂"
}, {
  expected: "🧎🏻‍♀",
  actual: "🧎🏻‍♀"
}, {
  expected: "🧎🏼‍♀",
  actual: "🧎🏼‍♀"
}, {
  expected: "🧎🏽‍♀",
  actual: "🧎🏽‍♀"
}, {
  expected: "🧎🏾‍♀",
  actual: "🧎🏾‍♀"
}, {
  expected: "🧎🏿‍♀",
  actual: "🧎🏿‍♀"
}, {
  expected: "🏃🏻‍♂",
  actual: "🏃🏻‍♂"
}, {
  expected: "🏃🏼‍♂",
  actual: "🏃🏼‍♂"
}, {
  expected: "🏃🏽‍♂",
  actual: "🏃🏽‍♂"
}, {
  expected: "🏃🏾‍♂",
  actual: "🏃🏾‍♂"
}, {
  expected: "🏃🏿‍♂",
  actual: "🏃🏿‍♂"
}, {
  expected: "🏃🏻‍♀",
  actual: "🏃🏻‍♀"
}, {
  expected: "🏃🏼‍♀",
  actual: "🏃🏼‍♀"
}, {
  expected: "🏃🏽‍♀",
  actual: "🏃🏽‍♀"
}, {
  expected: "🏃🏾‍♀",
  actual: "🏃🏾‍♀"
}, {
  expected: "🏃🏿‍♀",
  actual: "🏃🏿‍♀"
}, {
  expected: "🧖🏻‍♂",
  actual: "🧖🏻‍♂"
}, {
  expected: "🧖🏼‍♂",
  actual: "🧖🏼‍♂"
}, {
  expected: "🧖🏽‍♂",
  actual: "🧖🏽‍♂"
}, {
  expected: "🧖🏾‍♂",
  actual: "🧖🏾‍♂"
}, {
  expected: "🧖🏿‍♂",
  actual: "🧖🏿‍♂"
}, {
  expected: "🧖🏻‍♀",
  actual: "🧖🏻‍♀"
}, {
  expected: "🧖🏼‍♀",
  actual: "🧖🏼‍♀"
}, {
  expected: "🧖🏽‍♀",
  actual: "🧖🏽‍♀"
}, {
  expected: "🧖🏾‍♀",
  actual: "🧖🏾‍♀"
}, {
  expected: "🧖🏿‍♀",
  actual: "🧖🏿‍♀"
}, {
  expected: "🧗🏻‍♂",
  actual: "🧗🏻‍♂"
}, {
  expected: "🧗🏼‍♂",
  actual: "🧗🏼‍♂"
}, {
  expected: "🧗🏽‍♂",
  actual: "🧗🏽‍♂"
}, {
  expected: "🧗🏾‍♂",
  actual: "🧗🏾‍♂"
}, {
  expected: "🧗🏿‍♂",
  actual: "🧗🏿‍♂"
}, {
  expected: "🧗🏻‍♀",
  actual: "🧗🏻‍♀"
}, {
  expected: "🧗🏼‍♀",
  actual: "🧗🏼‍♀"
}, {
  expected: "🧗🏽‍♀",
  actual: "🧗🏽‍♀"
}, {
  expected: "🧗🏾‍♀",
  actual: "🧗🏾‍♀"
}, {
  expected: "🧗🏿‍♀",
  actual: "🧗🏿‍♀"
}, {
  expected: "🏌🏻‍♂",
  actual: "🏌🏻‍♂"
}, {
  expected: "🏌🏼‍♂",
  actual: "🏌🏼‍♂"
}, {
  expected: "🏌🏽‍♂",
  actual: "🏌🏽‍♂"
}, {
  expected: "🏌🏾‍♂",
  actual: "🏌🏾‍♂"
}, {
  expected: "🏌🏿‍♂",
  actual: "🏌🏿‍♂"
}, {
  expected: "🏌🏻‍♀",
  actual: "🏌🏻‍♀"
}, {
  expected: "🏌🏼‍♀",
  actual: "🏌🏼‍♀"
}, {
  expected: "🏌🏽‍♀",
  actual: "🏌🏽‍♀"
}, {
  expected: "🏌🏾‍♀",
  actual: "🏌🏾‍♀"
}, {
  expected: "🏌🏿‍♀",
  actual: "🏌🏿‍♀"
}, {
  expected: "🏄🏻‍♂",
  actual: "🏄🏻‍♂"
}, {
  expected: "🏄🏼‍♂",
  actual: "🏄🏼‍♂"
}, {
  expected: "🏄🏽‍♂",
  actual: "🏄🏽‍♂"
}, {
  expected: "🏄🏾‍♂",
  actual: "🏄🏾‍♂"
}, {
  expected: "🏄🏿‍♂",
  actual: "🏄🏿‍♂"
}, {
  expected: "🏄🏻‍♀",
  actual: "🏄🏻‍♀"
}, {
  expected: "🏄🏼‍♀",
  actual: "🏄🏼‍♀"
}, {
  expected: "🏄🏽‍♀",
  actual: "🏄🏽‍♀"
}, {
  expected: "🏄🏾‍♀",
  actual: "🏄🏾‍♀"
}, {
  expected: "🏄🏿‍♀",
  actual: "🏄🏿‍♀"
}, {
  expected: "🚣🏻‍♂",
  actual: "🚣🏻‍♂"
}, {
  expected: "🚣🏼‍♂",
  actual: "🚣🏼‍♂"
}, {
  expected: "🚣🏽‍♂",
  actual: "🚣🏽‍♂"
}, {
  expected: "🚣🏾‍♂",
  actual: "🚣🏾‍♂"
}, {
  expected: "🚣🏿‍♂",
  actual: "🚣🏿‍♂"
}, {
  expected: "🚣🏻‍♀",
  actual: "🚣🏻‍♀"
}, {
  expected: "🚣🏼‍♀",
  actual: "🚣🏼‍♀"
}, {
  expected: "🚣🏽‍♀",
  actual: "🚣🏽‍♀"
}, {
  expected: "🚣🏾‍♀",
  actual: "🚣🏾‍♀"
}, {
  expected: "🚣🏿‍♀",
  actual: "🚣🏿‍♀"
}, {
  expected: "🏊🏻‍♂",
  actual: "🏊🏻‍♂"
}, {
  expected: "🏊🏼‍♂",
  actual: "🏊🏼‍♂"
}, {
  expected: "🏊🏽‍♂",
  actual: "🏊🏽‍♂"
}, {
  expected: "🏊🏾‍♂",
  actual: "🏊🏾‍♂"
}, {
  expected: "🏊🏿‍♂",
  actual: "🏊🏿‍♂"
}, {
  expected: "🏊🏻‍♀",
  actual: "🏊🏻‍♀"
}, {
  expected: "🏊🏼‍♀",
  actual: "🏊🏼‍♀"
}, {
  expected: "🏊🏽‍♀",
  actual: "🏊🏽‍♀"
}, {
  expected: "🏊🏾‍♀",
  actual: "🏊🏾‍♀"
}, {
  expected: "🏊🏿‍♀",
  actual: "🏊🏿‍♀"
}, {
  expected: "🏋🏻‍♂",
  actual: "🏋🏻‍♂"
}, {
  expected: "🏋🏼‍♂",
  actual: "🏋🏼‍♂"
}, {
  expected: "🏋🏽‍♂",
  actual: "🏋🏽‍♂"
}, {
  expected: "🏋🏾‍♂",
  actual: "🏋🏾‍♂"
}, {
  expected: "🏋🏿‍♂",
  actual: "🏋🏿‍♂"
}, {
  expected: "🏋🏻‍♀",
  actual: "🏋🏻‍♀"
}, {
  expected: "🏋🏼‍♀",
  actual: "🏋🏼‍♀"
}, {
  expected: "🏋🏽‍♀",
  actual: "🏋🏽‍♀"
}, {
  expected: "🏋🏾‍♀",
  actual: "🏋🏾‍♀"
}, {
  expected: "🏋🏿‍♀",
  actual: "🏋🏿‍♀"
}, {
  expected: "🚴🏻‍♂",
  actual: "🚴🏻‍♂"
}, {
  expected: "🚴🏼‍♂",
  actual: "🚴🏼‍♂"
}, {
  expected: "🚴🏽‍♂",
  actual: "🚴🏽‍♂"
}, {
  expected: "🚴🏾‍♂",
  actual: "🚴🏾‍♂"
}, {
  expected: "🚴🏿‍♂",
  actual: "🚴🏿‍♂"
}, {
  expected: "🚴🏻‍♀",
  actual: "🚴🏻‍♀"
}, {
  expected: "🚴🏼‍♀",
  actual: "🚴🏼‍♀"
}, {
  expected: "🚴🏽‍♀",
  actual: "🚴🏽‍♀"
}, {
  expected: "🚴🏾‍♀",
  actual: "🚴🏾‍♀"
}, {
  expected: "🚴🏿‍♀",
  actual: "🚴🏿‍♀"
}, {
  expected: "🚵🏻‍♂",
  actual: "🚵🏻‍♂"
}, {
  expected: "🚵🏼‍♂",
  actual: "🚵🏼‍♂"
}, {
  expected: "🚵🏽‍♂",
  actual: "🚵🏽‍♂"
}, {
  expected: "🚵🏾‍♂",
  actual: "🚵🏾‍♂"
}, {
  expected: "🚵🏿‍♂",
  actual: "🚵🏿‍♂"
}, {
  expected: "🚵🏻‍♀",
  actual: "🚵🏻‍♀"
}, {
  expected: "🚵🏼‍♀",
  actual: "🚵🏼‍♀"
}, {
  expected: "🚵🏽‍♀",
  actual: "🚵🏽‍♀"
}, {
  expected: "🚵🏾‍♀",
  actual: "🚵🏾‍♀"
}, {
  expected: "🚵🏿‍♀",
  actual: "🚵🏿‍♀"
}, {
  expected: "🤸🏻‍♂",
  actual: "🤸🏻‍♂"
}, {
  expected: "🤸🏼‍♂",
  actual: "🤸🏼‍♂"
}, {
  expected: "🤸🏽‍♂",
  actual: "🤸🏽‍♂"
}, {
  expected: "🤸🏾‍♂",
  actual: "🤸🏾‍♂"
}, {
  expected: "🤸🏿‍♂",
  actual: "🤸🏿‍♂"
}, {
  expected: "🤸🏻‍♀",
  actual: "🤸🏻‍♀"
}, {
  expected: "🤸🏼‍♀",
  actual: "🤸🏼‍♀"
}, {
  expected: "🤸🏽‍♀",
  actual: "🤸🏽‍♀"
}, {
  expected: "🤸🏾‍♀",
  actual: "🤸🏾‍♀"
}, {
  expected: "🤸🏿‍♀",
  actual: "🤸🏿‍♀"
}, {
  expected: "🤽🏻‍♂",
  actual: "🤽🏻‍♂"
}, {
  expected: "🤽🏼‍♂",
  actual: "🤽🏼‍♂"
}, {
  expected: "🤽🏽‍♂",
  actual: "🤽🏽‍♂"
}, {
  expected: "🤽🏾‍♂",
  actual: "🤽🏾‍♂"
}, {
  expected: "🤽🏿‍♂",
  actual: "🤽🏿‍♂"
}, {
  expected: "🤽🏻‍♀",
  actual: "🤽🏻‍♀"
}, {
  expected: "🤽🏼‍♀",
  actual: "🤽🏼‍♀"
}, {
  expected: "🤽🏽‍♀",
  actual: "🤽🏽‍♀"
}, {
  expected: "🤽🏾‍♀",
  actual: "🤽🏾‍♀"
}, {
  expected: "🤽🏿‍♀",
  actual: "🤽🏿‍♀"
}, {
  expected: "🤾🏻‍♂",
  actual: "🤾🏻‍♂"
}, {
  expected: "🤾🏼‍♂",
  actual: "🤾🏼‍♂"
}, {
  expected: "🤾🏽‍♂",
  actual: "🤾🏽‍♂"
}, {
  expected: "🤾🏾‍♂",
  actual: "🤾🏾‍♂"
}, {
  expected: "🤾🏿‍♂",
  actual: "🤾🏿‍♂"
}, {
  expected: "🤾🏻‍♀",
  actual: "🤾🏻‍♀"
}, {
  expected: "🤾🏼‍♀",
  actual: "🤾🏼‍♀"
}, {
  expected: "🤾🏽‍♀",
  actual: "🤾🏽‍♀"
}, {
  expected: "🤾🏾‍♀",
  actual: "🤾🏾‍♀"
}, {
  expected: "🤾🏿‍♀",
  actual: "🤾🏿‍♀"
}, {
  expected: "🤹🏻‍♂",
  actual: "🤹🏻‍♂"
}, {
  expected: "🤹🏼‍♂",
  actual: "🤹🏼‍♂"
}, {
  expected: "🤹🏽‍♂",
  actual: "🤹🏽‍♂"
}, {
  expected: "🤹🏾‍♂",
  actual: "🤹🏾‍♂"
}, {
  expected: "🤹🏿‍♂",
  actual: "🤹🏿‍♂"
}, {
  expected: "🤹🏻‍♀",
  actual: "🤹🏻‍♀"
}, {
  expected: "🤹🏼‍♀",
  actual: "🤹🏼‍♀"
}, {
  expected: "🤹🏽‍♀",
  actual: "🤹🏽‍♀"
}, {
  expected: "🤹🏾‍♀",
  actual: "🤹🏾‍♀"
}, {
  expected: "🤹🏿‍♀",
  actual: "🤹🏿‍♀"
}, {
  expected: "🧘🏻‍♂",
  actual: "🧘🏻‍♂"
}, {
  expected: "🧘🏼‍♂",
  actual: "🧘🏼‍♂"
}, {
  expected: "🧘🏽‍♂",
  actual: "🧘🏽‍♂"
}, {
  expected: "🧘🏾‍♂",
  actual: "🧘🏾‍♂"
}, {
  expected: "🧘🏿‍♂",
  actual: "🧘🏿‍♂"
}, {
  expected: "🧘🏻‍♀",
  actual: "🧘🏻‍♀"
}, {
  expected: "🧘🏼‍♀",
  actual: "🧘🏼‍♀"
}, {
  expected: "🧘🏽‍♀",
  actual: "🧘🏽‍♀"
}, {
  expected: "🧘🏾‍♀",
  actual: "🧘🏾‍♀"
}, {
  expected: "🧘🏿‍♀",
  actual: "🧘🏿‍♀"
}, {
  expected: "🏳️‍🌈",
  actual: "🏳️‍🌈"
}, {
  expected: "❤️‍🔥",
  actual: "❤️‍🔥"
}, {
  expected: "❤️‍🩹",
  actual: "❤️‍🩹"
}, {
  expected: "🧔‍♂️",
  actual: "🧔‍♂️"
}, {
  expected: "🧔‍♀️",
  actual: "🧔‍♀️"
}, {
  expected: "👱‍♀️",
  actual: "👱‍♀️"
}, {
  expected: "👱‍♂️",
  actual: "👱‍♂️"
}, {
  expected: "🙍‍♂️",
  actual: "🙍‍♂️"
}, {
  expected: "🙍‍♀️",
  actual: "🙍‍♀️"
}, {
  expected: "🙎‍♂️",
  actual: "🙎‍♂️"
}, {
  expected: "🙎‍♀️",
  actual: "🙎‍♀️"
}, {
  expected: "🙅‍♂️",
  actual: "🙅‍♂️"
}, {
  expected: "🙅‍♀️",
  actual: "🙅‍♀️"
}, {
  expected: "🙆‍♂️",
  actual: "🙆‍♂️"
}, {
  expected: "🙆‍♀️",
  actual: "🙆‍♀️"
}, {
  expected: "💁‍♂️",
  actual: "💁‍♂️"
}, {
  expected: "💁‍♀️",
  actual: "💁‍♀️"
}, {
  expected: "🙋‍♂️",
  actual: "🙋‍♂️"
}, {
  expected: "🙋‍♀️",
  actual: "🙋‍♀️"
}, {
  expected: "🧏‍♂️",
  actual: "🧏‍♂️"
}, {
  expected: "🧏‍♀️",
  actual: "🧏‍♀️"
}, {
  expected: "🙇‍♂️",
  actual: "🙇‍♂️"
}, {
  expected: "🙇‍♀️",
  actual: "🙇‍♀️"
}, {
  expected: "🤦‍♂️",
  actual: "🤦‍♂️"
}, {
  expected: "🤦‍♀️",
  actual: "🤦‍♀️"
}, {
  expected: "🤷‍♂️",
  actual: "🤷‍♂️"
}, {
  expected: "🤷‍♀️",
  actual: "🤷‍♀️"
}, {
  expected: "🧑‍⚕️",
  actual: "🧑‍⚕️"
}, {
  expected: "👨‍⚕️",
  actual: "👨‍⚕️"
}, {
  expected: "👩‍⚕️",
  actual: "👩‍⚕️"
}, {
  expected: "🧑‍⚖️",
  actual: "🧑‍⚖️"
}, {
  expected: "👨‍⚖️",
  actual: "👨‍⚖️"
}, {
  expected: "👩‍⚖️",
  actual: "👩‍⚖️"
}, {
  expected: "🧑‍✈️",
  actual: "🧑‍✈️"
}, {
  expected: "👨‍✈️",
  actual: "👨‍✈️"
}, {
  expected: "👩‍✈️",
  actual: "👩‍✈️"
}, {
  expected: "👮‍♂️",
  actual: "👮‍♂️"
}, {
  expected: "👮‍♀️",
  actual: "👮‍♀️"
}, {
  expected: "🕵‍♂️",
  actual: "🕵‍♂️"
}, {
  expected: "🕵️‍♂",
  actual: "🕵️‍♂"
}, {
  expected: "🕵‍♀️",
  actual: "🕵‍♀️"
}, {
  expected: "🕵️‍♀",
  actual: "🕵️‍♀"
}, {
  expected: "💂‍♂️",
  actual: "💂‍♂️"
}, {
  expected: "💂‍♀️",
  actual: "💂‍♀️"
}, {
  expected: "👷‍♂️",
  actual: "👷‍♂️"
}, {
  expected: "👷‍♀️",
  actual: "👷‍♀️"
}, {
  expected: "👳‍♂️",
  actual: "👳‍♂️"
}, {
  expected: "👳‍♀️",
  actual: "👳‍♀️"
}, {
  expected: "🤵‍♂️",
  actual: "🤵‍♂️"
}, {
  expected: "🤵‍♀️",
  actual: "🤵‍♀️"
}, {
  expected: "👰‍♂️",
  actual: "👰‍♂️"
}, {
  expected: "👰‍♀️",
  actual: "👰‍♀️"
}, {
  expected: "🦸‍♂️",
  actual: "🦸‍♂️"
}, {
  expected: "🦸‍♀️",
  actual: "🦸‍♀️"
}, {
  expected: "🦹‍♂️",
  actual: "🦹‍♂️"
}, {
  expected: "🦹‍♀️",
  actual: "🦹‍♀️"
}, {
  expected: "🧙‍♂️",
  actual: "🧙‍♂️"
}, {
  expected: "🧙‍♀️",
  actual: "🧙‍♀️"
}, {
  expected: "🧚‍♂️",
  actual: "🧚‍♂️"
}, {
  expected: "🧚‍♀️",
  actual: "🧚‍♀️"
}, {
  expected: "🧛‍♂️",
  actual: "🧛‍♂️"
}, {
  expected: "🧛‍♀️",
  actual: "🧛‍♀️"
}, {
  expected: "🧜‍♂️",
  actual: "🧜‍♂️"
}, {
  expected: "🧜‍♀️",
  actual: "🧜‍♀️"
}, {
  expected: "🧝‍♂️",
  actual: "🧝‍♂️"
}, {
  expected: "🧝‍♀️",
  actual: "🧝‍♀️"
}, {
  expected: "🧞‍♂️",
  actual: "🧞‍♂️"
}, {
  expected: "🧞‍♀️",
  actual: "🧞‍♀️"
}, {
  expected: "🧟‍♂️",
  actual: "🧟‍♂️"
}, {
  expected: "🧟‍♀️",
  actual: "🧟‍♀️"
}, {
  expected: "💆‍♂️",
  actual: "💆‍♂️"
}, {
  expected: "💆‍♀️",
  actual: "💆‍♀️"
}, {
  expected: "💇‍♂️",
  actual: "💇‍♂️"
}, {
  expected: "💇‍♀️",
  actual: "💇‍♀️"
}, {
  expected: "🚶‍♂️",
  actual: "🚶‍♂️"
}, {
  expected: "🚶‍♀️",
  actual: "🚶‍♀️"
}, {
  expected: "🧍‍♂️",
  actual: "🧍‍♂️"
}, {
  expected: "🧍‍♀️",
  actual: "🧍‍♀️"
}, {
  expected: "🧎‍♂️",
  actual: "🧎‍♂️"
}, {
  expected: "🧎‍♀️",
  actual: "🧎‍♀️"
}, {
  expected: "🏃‍♂️",
  actual: "🏃‍♂️"
}, {
  expected: "🏃‍♀️",
  actual: "🏃‍♀️"
}, {
  expected: "👯‍♂️",
  actual: "👯‍♂️"
}, {
  expected: "👯‍♀️",
  actual: "👯‍♀️"
}, {
  expected: "🧖‍♂️",
  actual: "🧖‍♂️"
}, {
  expected: "🧖‍♀️",
  actual: "🧖‍♀️"
}, {
  expected: "🧗‍♂️",
  actual: "🧗‍♂️"
}, {
  expected: "🧗‍♀️",
  actual: "🧗‍♀️"
}, {
  expected: "🏌‍♂️",
  actual: "🏌‍♂️"
}, {
  expected: "🏌️‍♂",
  actual: "🏌️‍♂"
}, {
  expected: "🏌‍♀️",
  actual: "🏌‍♀️"
}, {
  expected: "🏌️‍♀",
  actual: "🏌️‍♀"
}, {
  expected: "🏄‍♂️",
  actual: "🏄‍♂️"
}, {
  expected: "🏄‍♀️",
  actual: "🏄‍♀️"
}, {
  expected: "🚣‍♂️",
  actual: "🚣‍♂️"
}, {
  expected: "🚣‍♀️",
  actual: "🚣‍♀️"
}, {
  expected: "🏊‍♂️",
  actual: "🏊‍♂️"
}, {
  expected: "🏊‍♀️",
  actual: "🏊‍♀️"
}, {
  expected: "⛹🏻‍♂",
  actual: "⛹🏻‍♂"
}, {
  expected: "⛹🏼‍♂",
  actual: "⛹🏼‍♂"
}, {
  expected: "⛹🏽‍♂",
  actual: "⛹🏽‍♂"
}, {
  expected: "⛹🏾‍♂",
  actual: "⛹🏾‍♂"
}, {
  expected: "⛹🏿‍♂",
  actual: "⛹🏿‍♂"
}, {
  expected: "⛹🏻‍♀",
  actual: "⛹🏻‍♀"
}, {
  expected: "⛹🏼‍♀",
  actual: "⛹🏼‍♀"
}, {
  expected: "⛹🏽‍♀",
  actual: "⛹🏽‍♀"
}, {
  expected: "⛹🏾‍♀",
  actual: "⛹🏾‍♀"
}, {
  expected: "⛹🏿‍♀",
  actual: "⛹🏿‍♀"
}, {
  expected: "🏋‍♂️",
  actual: "🏋‍♂️"
}, {
  expected: "🏋️‍♂",
  actual: "🏋️‍♂"
}, {
  expected: "🏋‍♀️",
  actual: "🏋‍♀️"
}, {
  expected: "🏋️‍♀",
  actual: "🏋️‍♀"
}, {
  expected: "🚴‍♂️",
  actual: "🚴‍♂️"
}, {
  expected: "🚴‍♀️",
  actual: "🚴‍♀️"
}, {
  expected: "🚵‍♂️",
  actual: "🚵‍♂️"
}, {
  expected: "🚵‍♀️",
  actual: "🚵‍♀️"
}, {
  expected: "🤸‍♂️",
  actual: "🤸‍♂️"
}, {
  expected: "🤸‍♀️",
  actual: "🤸‍♀️"
}, {
  expected: "🤼‍♂️",
  actual: "🤼‍♂️"
}, {
  expected: "🤼‍♀️",
  actual: "🤼‍♀️"
}, {
  expected: "🤽‍♂️",
  actual: "🤽‍♂️"
}, {
  expected: "🤽‍♀️",
  actual: "🤽‍♀️"
}, {
  expected: "🤾‍♂️",
  actual: "🤾‍♂️"
}, {
  expected: "🤾‍♀️",
  actual: "🤾‍♀️"
}, {
  expected: "🤹‍♂️",
  actual: "🤹‍♂️"
}, {
  expected: "🤹‍♀️",
  actual: "🤹‍♀️"
}, {
  expected: "🧘‍♂️",
  actual: "🧘‍♂️"
}, {
  expected: "🧘‍♀️",
  actual: "🧘‍♀️"
}, {
  expected: "🐻‍❄️",
  actual: "🐻‍❄️"
}, {
  expected: "🏳‍⚧️",
  actual: "🏳‍⚧️"
}, {
  expected: "🏳️‍⚧",
  actual: "🏳️‍⚧"
}, {
  expected: "🏴‍☠️",
  actual: "🏴‍☠️"
}, {
  expected: "👨🏻‍🦰",
  actual: "👨🏻🦰"
}, {
  expected: "👨🏼‍🦰",
  actual: "👨🏼🦰"
}, {
  expected: "👨🏽‍🦰",
  actual: "👨🏽🦰"
}, {
  expected: "👨🏾‍🦰",
  actual: "👨🏾🦰"
}, {
  expected: "👨🏿‍🦰",
  actual: "👨🏿🦰"
}, {
  expected: "👨🏻‍🦱",
  actual: "👨🏻🦱"
}, {
  expected: "👨🏼‍🦱",
  actual: "👨🏼🦱"
}, {
  expected: "👨🏽‍🦱",
  actual: "👨🏽🦱"
}, {
  expected: "👨🏾‍🦱",
  actual: "👨🏾🦱"
}, {
  expected: "👨🏿‍🦱",
  actual: "👨🏿🦱"
}, {
  expected: "👨🏻‍🦳",
  actual: "👨🏻🦳"
}, {
  expected: "👨🏼‍🦳",
  actual: "👨🏼🦳"
}, {
  expected: "👨🏽‍🦳",
  actual: "👨🏽🦳"
}, {
  expected: "👨🏾‍🦳",
  actual: "👨🏾🦳"
}, {
  expected: "👨🏿‍🦳",
  actual: "👨🏿🦳"
}, {
  expected: "👨🏻‍🦲",
  actual: "👨🏻🦲"
}, {
  expected: "👨🏼‍🦲",
  actual: "👨🏼🦲"
}, {
  expected: "👨🏽‍🦲",
  actual: "👨🏽🦲"
}, {
  expected: "👨🏾‍🦲",
  actual: "👨🏾🦲"
}, {
  expected: "👨🏿‍🦲",
  actual: "👨🏿🦲"
}, {
  expected: "👩🏻‍🦰",
  actual: "👩🏻🦰"
}, {
  expected: "👩🏼‍🦰",
  actual: "👩🏼🦰"
}, {
  expected: "👩🏽‍🦰",
  actual: "👩🏽🦰"
}, {
  expected: "👩🏾‍🦰",
  actual: "👩🏾🦰"
}, {
  expected: "👩🏿‍🦰",
  actual: "👩🏿🦰"
}, {
  expected: "🧑🏻‍🦰",
  actual: "🧑🏻🦰"
}, {
  expected: "🧑🏼‍🦰",
  actual: "🧑🏼🦰"
}, {
  expected: "🧑🏽‍🦰",
  actual: "🧑🏽🦰"
}, {
  expected: "🧑🏾‍🦰",
  actual: "🧑🏾🦰"
}, {
  expected: "🧑🏿‍🦰",
  actual: "🧑🏿🦰"
}, {
  expected: "👩🏻‍🦱",
  actual: "👩🏻🦱"
}, {
  expected: "👩🏼‍🦱",
  actual: "👩🏼🦱"
}, {
  expected: "👩🏽‍🦱",
  actual: "👩🏽🦱"
}, {
  expected: "👩🏾‍🦱",
  actual: "👩🏾🦱"
}, {
  expected: "👩🏿‍🦱",
  actual: "👩🏿🦱"
}, {
  expected: "🧑🏻‍🦱",
  actual: "🧑🏻🦱"
}, {
  expected: "🧑🏼‍🦱",
  actual: "🧑🏼🦱"
}, {
  expected: "🧑🏽‍🦱",
  actual: "🧑🏽🦱"
}, {
  expected: "🧑🏾‍🦱",
  actual: "🧑🏾🦱"
}, {
  expected: "🧑🏿‍🦱",
  actual: "🧑🏿🦱"
}, {
  expected: "👩🏻‍🦳",
  actual: "👩🏻🦳"
}, {
  expected: "👩🏼‍🦳",
  actual: "👩🏼🦳"
}, {
  expected: "👩🏽‍🦳",
  actual: "👩🏽🦳"
}, {
  expected: "👩🏾‍🦳",
  actual: "👩🏾🦳"
}, {
  expected: "👩🏿‍🦳",
  actual: "👩🏿🦳"
}, {
  expected: "🧑🏻‍🦳",
  actual: "🧑🏻🦳"
}, {
  expected: "🧑🏼‍🦳",
  actual: "🧑🏼🦳"
}, {
  expected: "🧑🏽‍🦳",
  actual: "🧑🏽🦳"
}, {
  expected: "🧑🏾‍🦳",
  actual: "🧑🏾🦳"
}, {
  expected: "🧑🏿‍🦳",
  actual: "🧑🏿🦳"
}, {
  expected: "👩🏻‍🦲",
  actual: "👩🏻🦲"
}, {
  expected: "👩🏼‍🦲",
  actual: "👩🏼🦲"
}, {
  expected: "👩🏽‍🦲",
  actual: "👩🏽🦲"
}, {
  expected: "👩🏾‍🦲",
  actual: "👩🏾🦲"
}, {
  expected: "👩🏿‍🦲",
  actual: "👩🏿🦲"
}, {
  expected: "🧑🏻‍🦲",
  actual: "🧑🏻🦲"
}, {
  expected: "🧑🏼‍🦲",
  actual: "🧑🏼🦲"
}, {
  expected: "🧑🏽‍🦲",
  actual: "🧑🏽🦲"
}, {
  expected: "🧑🏾‍🦲",
  actual: "🧑🏾🦲"
}, {
  expected: "🧑🏿‍🦲",
  actual: "🧑🏿🦲"
}, {
  expected: "🧑🏻‍🎓",
  actual: "🧑🏻🎓"
}, {
  expected: "🧑🏼‍🎓",
  actual: "🧑🏼🎓"
}, {
  expected: "🧑🏽‍🎓",
  actual: "🧑🏽🎓"
}, {
  expected: "🧑🏾‍🎓",
  actual: "🧑🏾🎓"
}, {
  expected: "🧑🏿‍🎓",
  actual: "🧑🏿🎓"
}, {
  expected: "👨🏻‍🎓",
  actual: "👨🏻🎓"
}, {
  expected: "👨🏼‍🎓",
  actual: "👨🏼🎓"
}, {
  expected: "👨🏽‍🎓",
  actual: "👨🏽🎓"
}, {
  expected: "👨🏾‍🎓",
  actual: "👨🏾🎓"
}, {
  expected: "👨🏿‍🎓",
  actual: "👨🏿🎓"
}, {
  expected: "👩🏻‍🎓",
  actual: "👩🏻🎓"
}, {
  expected: "👩🏼‍🎓",
  actual: "👩🏼🎓"
}, {
  expected: "👩🏽‍🎓",
  actual: "👩🏽🎓"
}, {
  expected: "👩🏾‍🎓",
  actual: "👩🏾🎓"
}, {
  expected: "👩🏿‍🎓",
  actual: "👩🏿🎓"
}, {
  expected: "🧑🏻‍🏫",
  actual: "🧑🏻🏫"
}, {
  expected: "🧑🏼‍🏫",
  actual: "🧑🏼🏫"
}, {
  expected: "🧑🏽‍🏫",
  actual: "🧑🏽🏫"
}, {
  expected: "🧑🏾‍🏫",
  actual: "🧑🏾🏫"
}, {
  expected: "🧑🏿‍🏫",
  actual: "🧑🏿🏫"
}, {
  expected: "👨🏻‍🏫",
  actual: "👨🏻🏫"
}, {
  expected: "👨🏼‍🏫",
  actual: "👨🏼🏫"
}, {
  expected: "👨🏽‍🏫",
  actual: "👨🏽🏫"
}, {
  expected: "👨🏾‍🏫",
  actual: "👨🏾🏫"
}, {
  expected: "👨🏿‍🏫",
  actual: "👨🏿🏫"
}, {
  expected: "👩🏻‍🏫",
  actual: "👩🏻🏫"
}, {
  expected: "👩🏼‍🏫",
  actual: "👩🏼🏫"
}, {
  expected: "👩🏽‍🏫",
  actual: "👩🏽🏫"
}, {
  expected: "👩🏾‍🏫",
  actual: "👩🏾🏫"
}, {
  expected: "👩🏿‍🏫",
  actual: "👩🏿🏫"
}, {
  expected: "🧑🏻‍🌾",
  actual: "🧑🏻🌾"
}, {
  expected: "🧑🏼‍🌾",
  actual: "🧑🏼🌾"
}, {
  expected: "🧑🏽‍🌾",
  actual: "🧑🏽🌾"
}, {
  expected: "🧑🏾‍🌾",
  actual: "🧑🏾🌾"
}, {
  expected: "🧑🏿‍🌾",
  actual: "🧑🏿🌾"
}, {
  expected: "👨🏻‍🌾",
  actual: "👨🏻🌾"
}, {
  expected: "👨🏼‍🌾",
  actual: "👨🏼🌾"
}, {
  expected: "👨🏽‍🌾",
  actual: "👨🏽🌾"
}, {
  expected: "👨🏾‍🌾",
  actual: "👨🏾🌾"
}, {
  expected: "👨🏿‍🌾",
  actual: "👨🏿🌾"
}, {
  expected: "👩🏻‍🌾",
  actual: "👩🏻🌾"
}, {
  expected: "👩🏼‍🌾",
  actual: "👩🏼🌾"
}, {
  expected: "👩🏽‍🌾",
  actual: "👩🏽🌾"
}, {
  expected: "👩🏾‍🌾",
  actual: "👩🏾🌾"
}, {
  expected: "👩🏿‍🌾",
  actual: "👩🏿🌾"
}, {
  expected: "🧑🏻‍🍳",
  actual: "🧑🏻🍳"
}, {
  expected: "🧑🏼‍🍳",
  actual: "🧑🏼🍳"
}, {
  expected: "🧑🏽‍🍳",
  actual: "🧑🏽🍳"
}, {
  expected: "🧑🏾‍🍳",
  actual: "🧑🏾🍳"
}, {
  expected: "🧑🏿‍🍳",
  actual: "🧑🏿🍳"
}, {
  expected: "👨🏻‍🍳",
  actual: "👨🏻🍳"
}, {
  expected: "👨🏼‍🍳",
  actual: "👨🏼🍳"
}, {
  expected: "👨🏽‍🍳",
  actual: "👨🏽🍳"
}, {
  expected: "👨🏾‍🍳",
  actual: "👨🏾🍳"
}, {
  expected: "👨🏿‍🍳",
  actual: "👨🏿🍳"
}, {
  expected: "👩🏻‍🍳",
  actual: "👩🏻🍳"
}, {
  expected: "👩🏼‍🍳",
  actual: "👩🏼🍳"
}, {
  expected: "👩🏽‍🍳",
  actual: "👩🏽🍳"
}, {
  expected: "👩🏾‍🍳",
  actual: "👩🏾🍳"
}, {
  expected: "👩🏿‍🍳",
  actual: "👩🏿🍳"
}, {
  expected: "🧑🏻‍🔧",
  actual: "🧑🏻🔧"
}, {
  expected: "🧑🏼‍🔧",
  actual: "🧑🏼🔧"
}, {
  expected: "🧑🏽‍🔧",
  actual: "🧑🏽🔧"
}, {
  expected: "🧑🏾‍🔧",
  actual: "🧑🏾🔧"
}, {
  expected: "🧑🏿‍🔧",
  actual: "🧑🏿🔧"
}, {
  expected: "👨🏻‍🔧",
  actual: "👨🏻🔧"
}, {
  expected: "👨🏼‍🔧",
  actual: "👨🏼🔧"
}, {
  expected: "👨🏽‍🔧",
  actual: "👨🏽🔧"
}, {
  expected: "👨🏾‍🔧",
  actual: "👨🏾🔧"
}, {
  expected: "👨🏿‍🔧",
  actual: "👨🏿🔧"
}, {
  expected: "👩🏻‍🔧",
  actual: "👩🏻🔧"
}, {
  expected: "👩🏼‍🔧",
  actual: "👩🏼🔧"
}, {
  expected: "👩🏽‍🔧",
  actual: "👩🏽🔧"
}, {
  expected: "👩🏾‍🔧",
  actual: "👩🏾🔧"
}, {
  expected: "👩🏿‍🔧",
  actual: "👩🏿🔧"
}, {
  expected: "🧑🏻‍🏭",
  actual: "🧑🏻🏭"
}, {
  expected: "🧑🏼‍🏭",
  actual: "🧑🏼🏭"
}, {
  expected: "🧑🏽‍🏭",
  actual: "🧑🏽🏭"
}, {
  expected: "🧑🏾‍🏭",
  actual: "🧑🏾🏭"
}, {
  expected: "🧑🏿‍🏭",
  actual: "🧑🏿🏭"
}, {
  expected: "👨🏻‍🏭",
  actual: "👨🏻🏭"
}, {
  expected: "👨🏼‍🏭",
  actual: "👨🏼🏭"
}, {
  expected: "👨🏽‍🏭",
  actual: "👨🏽🏭"
}, {
  expected: "👨🏾‍🏭",
  actual: "👨🏾🏭"
}, {
  expected: "👨🏿‍🏭",
  actual: "👨🏿🏭"
}, {
  expected: "👩🏻‍🏭",
  actual: "👩🏻🏭"
}, {
  expected: "👩🏼‍🏭",
  actual: "👩🏼🏭"
}, {
  expected: "👩🏽‍🏭",
  actual: "👩🏽🏭"
}, {
  expected: "👩🏾‍🏭",
  actual: "👩🏾🏭"
}, {
  expected: "👩🏿‍🏭",
  actual: "👩🏿🏭"
}, {
  expected: "🧑🏻‍💼",
  actual: "🧑🏻💼"
}, {
  expected: "🧑🏼‍💼",
  actual: "🧑🏼💼"
}, {
  expected: "🧑🏽‍💼",
  actual: "🧑🏽💼"
}, {
  expected: "🧑🏾‍💼",
  actual: "🧑🏾💼"
}, {
  expected: "🧑🏿‍💼",
  actual: "🧑🏿💼"
}, {
  expected: "👨🏻‍💼",
  actual: "👨🏻💼"
}, {
  expected: "👨🏼‍💼",
  actual: "👨🏼💼"
}, {
  expected: "👨🏽‍💼",
  actual: "👨🏽💼"
}, {
  expected: "👨🏾‍💼",
  actual: "👨🏾💼"
}, {
  expected: "👨🏿‍💼",
  actual: "👨🏿💼"
}, {
  expected: "👩🏻‍💼",
  actual: "👩🏻💼"
}, {
  expected: "👩🏼‍💼",
  actual: "👩🏼💼"
}, {
  expected: "👩🏽‍💼",
  actual: "👩🏽💼"
}, {
  expected: "👩🏾‍💼",
  actual: "👩🏾💼"
}, {
  expected: "👩🏿‍💼",
  actual: "👩🏿💼"
}, {
  expected: "🧑🏻‍🔬",
  actual: "🧑🏻🔬"
}, {
  expected: "🧑🏼‍🔬",
  actual: "🧑🏼🔬"
}, {
  expected: "🧑🏽‍🔬",
  actual: "🧑🏽🔬"
}, {
  expected: "🧑🏾‍🔬",
  actual: "🧑🏾🔬"
}, {
  expected: "🧑🏿‍🔬",
  actual: "🧑🏿🔬"
}, {
  expected: "👨🏻‍🔬",
  actual: "👨🏻🔬"
}, {
  expected: "👨🏼‍🔬",
  actual: "👨🏼🔬"
}, {
  expected: "👨🏽‍🔬",
  actual: "👨🏽🔬"
}, {
  expected: "👨🏾‍🔬",
  actual: "👨🏾🔬"
}, {
  expected: "👨🏿‍🔬",
  actual: "👨🏿🔬"
}, {
  expected: "👩🏻‍🔬",
  actual: "👩🏻🔬"
}, {
  expected: "👩🏼‍🔬",
  actual: "👩🏼🔬"
}, {
  expected: "👩🏽‍🔬",
  actual: "👩🏽🔬"
}, {
  expected: "👩🏾‍🔬",
  actual: "👩🏾🔬"
}, {
  expected: "👩🏿‍🔬",
  actual: "👩🏿🔬"
}, {
  expected: "🧑🏻‍💻",
  actual: "🧑🏻💻"
}, {
  expected: "🧑🏼‍💻",
  actual: "🧑🏼💻"
}, {
  expected: "🧑🏽‍💻",
  actual: "🧑🏽💻"
}, {
  expected: "🧑🏾‍💻",
  actual: "🧑🏾💻"
}, {
  expected: "🧑🏿‍💻",
  actual: "🧑🏿💻"
}, {
  expected: "👨🏻‍💻",
  actual: "👨🏻💻"
}, {
  expected: "👨🏼‍💻",
  actual: "👨🏼💻"
}, {
  expected: "👨🏽‍💻",
  actual: "👨🏽💻"
}, {
  expected: "👨🏾‍💻",
  actual: "👨🏾💻"
}, {
  expected: "👨🏿‍💻",
  actual: "👨🏿💻"
}, {
  expected: "👩🏻‍💻",
  actual: "👩🏻💻"
}, {
  expected: "👩🏼‍💻",
  actual: "👩🏼💻"
}, {
  expected: "👩🏽‍💻",
  actual: "👩🏽💻"
}, {
  expected: "👩🏾‍💻",
  actual: "👩🏾💻"
}, {
  expected: "👩🏿‍💻",
  actual: "👩🏿💻"
}, {
  expected: "🧑🏻‍🎤",
  actual: "🧑🏻🎤"
}, {
  expected: "🧑🏼‍🎤",
  actual: "🧑🏼🎤"
}, {
  expected: "🧑🏽‍🎤",
  actual: "🧑🏽🎤"
}, {
  expected: "🧑🏾‍🎤",
  actual: "🧑🏾🎤"
}, {
  expected: "🧑🏿‍🎤",
  actual: "🧑🏿🎤"
}, {
  expected: "👨🏻‍🎤",
  actual: "👨🏻🎤"
}, {
  expected: "👨🏼‍🎤",
  actual: "👨🏼🎤"
}, {
  expected: "👨🏽‍🎤",
  actual: "👨🏽🎤"
}, {
  expected: "👨🏾‍🎤",
  actual: "👨🏾🎤"
}, {
  expected: "👨🏿‍🎤",
  actual: "👨🏿🎤"
}, {
  expected: "👩🏻‍🎤",
  actual: "👩🏻🎤"
}, {
  expected: "👩🏼‍🎤",
  actual: "👩🏼🎤"
}, {
  expected: "👩🏽‍🎤",
  actual: "👩🏽🎤"
}, {
  expected: "👩🏾‍🎤",
  actual: "👩🏾🎤"
}, {
  expected: "👩🏿‍🎤",
  actual: "👩🏿🎤"
}, {
  expected: "🧑🏻‍🎨",
  actual: "🧑🏻🎨"
}, {
  expected: "🧑🏼‍🎨",
  actual: "🧑🏼🎨"
}, {
  expected: "🧑🏽‍🎨",
  actual: "🧑🏽🎨"
}, {
  expected: "🧑🏾‍🎨",
  actual: "🧑🏾🎨"
}, {
  expected: "🧑🏿‍🎨",
  actual: "🧑🏿🎨"
}, {
  expected: "👨🏻‍🎨",
  actual: "👨🏻🎨"
}, {
  expected: "👨🏼‍🎨",
  actual: "👨🏼🎨"
}, {
  expected: "👨🏽‍🎨",
  actual: "👨🏽🎨"
}, {
  expected: "👨🏾‍🎨",
  actual: "👨🏾🎨"
}, {
  expected: "👨🏿‍🎨",
  actual: "👨🏿🎨"
}, {
  expected: "👩🏻‍🎨",
  actual: "👩🏻🎨"
}, {
  expected: "👩🏼‍🎨",
  actual: "👩🏼🎨"
}, {
  expected: "👩🏽‍🎨",
  actual: "👩🏽🎨"
}, {
  expected: "👩🏾‍🎨",
  actual: "👩🏾🎨"
}, {
  expected: "👩🏿‍🎨",
  actual: "👩🏿🎨"
}, {
  expected: "🧑🏻‍🚀",
  actual: "🧑🏻🚀"
}, {
  expected: "🧑🏼‍🚀",
  actual: "🧑🏼🚀"
}, {
  expected: "🧑🏽‍🚀",
  actual: "🧑🏽🚀"
}, {
  expected: "🧑🏾‍🚀",
  actual: "🧑🏾🚀"
}, {
  expected: "🧑🏿‍🚀",
  actual: "🧑🏿🚀"
}, {
  expected: "👨🏻‍🚀",
  actual: "👨🏻🚀"
}, {
  expected: "👨🏼‍🚀",
  actual: "👨🏼🚀"
}, {
  expected: "👨🏽‍🚀",
  actual: "👨🏽🚀"
}, {
  expected: "👨🏾‍🚀",
  actual: "👨🏾🚀"
}, {
  expected: "👨🏿‍🚀",
  actual: "👨🏿🚀"
}, {
  expected: "👩🏻‍🚀",
  actual: "👩🏻🚀"
}, {
  expected: "👩🏼‍🚀",
  actual: "👩🏼🚀"
}, {
  expected: "👩🏽‍🚀",
  actual: "👩🏽🚀"
}, {
  expected: "👩🏾‍🚀",
  actual: "👩🏾🚀"
}, {
  expected: "👩🏿‍🚀",
  actual: "👩🏿🚀"
}, {
  expected: "🧑🏻‍🚒",
  actual: "🧑🏻🚒"
}, {
  expected: "🧑🏼‍🚒",
  actual: "🧑🏼🚒"
}, {
  expected: "🧑🏽‍🚒",
  actual: "🧑🏽🚒"
}, {
  expected: "🧑🏾‍🚒",
  actual: "🧑🏾🚒"
}, {
  expected: "🧑🏿‍🚒",
  actual: "🧑🏿🚒"
}, {
  expected: "👨🏻‍🚒",
  actual: "👨🏻🚒"
}, {
  expected: "👨🏼‍🚒",
  actual: "👨🏼🚒"
}, {
  expected: "👨🏽‍🚒",
  actual: "👨🏽🚒"
}, {
  expected: "👨🏾‍🚒",
  actual: "👨🏾🚒"
}, {
  expected: "👨🏿‍🚒",
  actual: "👨🏿🚒"
}, {
  expected: "👩🏻‍🚒",
  actual: "👩🏻🚒"
}, {
  expected: "👩🏼‍🚒",
  actual: "👩🏼🚒"
}, {
  expected: "👩🏽‍🚒",
  actual: "👩🏽🚒"
}, {
  expected: "👩🏾‍🚒",
  actual: "👩🏾🚒"
}, {
  expected: "👩🏿‍🚒",
  actual: "👩🏿🚒"
}, {
  expected: "👩🏻‍🍼",
  actual: "👩🏻🍼"
}, {
  expected: "👩🏼‍🍼",
  actual: "👩🏼🍼"
}, {
  expected: "👩🏽‍🍼",
  actual: "👩🏽🍼"
}, {
  expected: "👩🏾‍🍼",
  actual: "👩🏾🍼"
}, {
  expected: "👩🏿‍🍼",
  actual: "👩🏿🍼"
}, {
  expected: "👨🏻‍🍼",
  actual: "👨🏻🍼"
}, {
  expected: "👨🏼‍🍼",
  actual: "👨🏼🍼"
}, {
  expected: "👨🏽‍🍼",
  actual: "👨🏽🍼"
}, {
  expected: "👨🏾‍🍼",
  actual: "👨🏾🍼"
}, {
  expected: "👨🏿‍🍼",
  actual: "👨🏿🍼"
}, {
  expected: "🧑🏻‍🍼",
  actual: "🧑🏻🍼"
}, {
  expected: "🧑🏼‍🍼",
  actual: "🧑🏼🍼"
}, {
  expected: "🧑🏽‍🍼",
  actual: "🧑🏽🍼"
}, {
  expected: "🧑🏾‍🍼",
  actual: "🧑🏾🍼"
}, {
  expected: "🧑🏿‍🍼",
  actual: "🧑🏿🍼"
}, {
  expected: "🧑🏻‍🎄",
  actual: "🧑🏻🎄"
}, {
  expected: "🧑🏼‍🎄",
  actual: "🧑🏼🎄"
}, {
  expected: "🧑🏽‍🎄",
  actual: "🧑🏽🎄"
}, {
  expected: "🧑🏾‍🎄",
  actual: "🧑🏾🎄"
}, {
  expected: "🧑🏿‍🎄",
  actual: "🧑🏿🎄"
}, {
  expected: "🧑🏻‍🦯",
  actual: "🧑🏻🦯"
}, {
  expected: "🧑🏼‍🦯",
  actual: "🧑🏼🦯"
}, {
  expected: "🧑🏽‍🦯",
  actual: "🧑🏽🦯"
}, {
  expected: "🧑🏾‍🦯",
  actual: "🧑🏾🦯"
}, {
  expected: "🧑🏿‍🦯",
  actual: "🧑🏿🦯"
}, {
  expected: "👨🏻‍🦯",
  actual: "👨🏻🦯"
}, {
  expected: "👨🏼‍🦯",
  actual: "👨🏼🦯"
}, {
  expected: "👨🏽‍🦯",
  actual: "👨🏽🦯"
}, {
  expected: "👨🏾‍🦯",
  actual: "👨🏾🦯"
}, {
  expected: "👨🏿‍🦯",
  actual: "👨🏿🦯"
}, {
  expected: "👩🏻‍🦯",
  actual: "👩🏻🦯"
}, {
  expected: "👩🏼‍🦯",
  actual: "👩🏼🦯"
}, {
  expected: "👩🏽‍🦯",
  actual: "👩🏽🦯"
}, {
  expected: "👩🏾‍🦯",
  actual: "👩🏾🦯"
}, {
  expected: "👩🏿‍🦯",
  actual: "👩🏿🦯"
}, {
  expected: "🧑🏻‍🦼",
  actual: "🧑🏻🦼"
}, {
  expected: "🧑🏼‍🦼",
  actual: "🧑🏼🦼"
}, {
  expected: "🧑🏽‍🦼",
  actual: "🧑🏽🦼"
}, {
  expected: "🧑🏾‍🦼",
  actual: "🧑🏾🦼"
}, {
  expected: "🧑🏿‍🦼",
  actual: "🧑🏿🦼"
}, {
  expected: "👨🏻‍🦼",
  actual: "👨🏻🦼"
}, {
  expected: "👨🏼‍🦼",
  actual: "👨🏼🦼"
}, {
  expected: "👨🏽‍🦼",
  actual: "👨🏽🦼"
}, {
  expected: "👨🏾‍🦼",
  actual: "👨🏾🦼"
}, {
  expected: "👨🏿‍🦼",
  actual: "👨🏿🦼"
}, {
  expected: "👩🏻‍🦼",
  actual: "👩🏻🦼"
}, {
  expected: "👩🏼‍🦼",
  actual: "👩🏼🦼"
}, {
  expected: "👩🏽‍🦼",
  actual: "👩🏽🦼"
}, {
  expected: "👩🏾‍🦼",
  actual: "👩🏾🦼"
}, {
  expected: "👩🏿‍🦼",
  actual: "👩🏿🦼"
}, {
  expected: "🧑🏻‍🦽",
  actual: "🧑🏻🦽"
}, {
  expected: "🧑🏼‍🦽",
  actual: "🧑🏼🦽"
}, {
  expected: "🧑🏽‍🦽",
  actual: "🧑🏽🦽"
}, {
  expected: "🧑🏾‍🦽",
  actual: "🧑🏾🦽"
}, {
  expected: "🧑🏿‍🦽",
  actual: "🧑🏿🦽"
}, {
  expected: "👨🏻‍🦽",
  actual: "👨🏻🦽"
}, {
  expected: "👨🏼‍🦽",
  actual: "👨🏼🦽"
}, {
  expected: "👨🏽‍🦽",
  actual: "👨🏽🦽"
}, {
  expected: "👨🏾‍🦽",
  actual: "👨🏾🦽"
}, {
  expected: "👨🏿‍🦽",
  actual: "👨🏿🦽"
}, {
  expected: "👩🏻‍🦽",
  actual: "👩🏻🦽"
}, {
  expected: "👩🏼‍🦽",
  actual: "👩🏼🦽"
}, {
  expected: "👩🏽‍🦽",
  actual: "👩🏽🦽"
}, {
  expected: "👩🏾‍🦽",
  actual: "👩🏾🦽"
}, {
  expected: "👩🏿‍🦽",
  actual: "👩🏿🦽"
}, {
  expected: "⛹‍♂️",
  actual: "⛹‍♂️"
}, {
  expected: "⛹️‍♂",
  actual: "⛹️‍♂"
}, {
  expected: "⛹‍♀️",
  actual: "⛹‍♀️"
}, {
  expected: "⛹️‍♀",
  actual: "⛹️‍♀"
}, {
  expected: "🧑‍🤝‍🧑",
  actual: "🧑🤝🧑"
}, {
  expected: "👨‍👩‍👦",
  actual: "👨👩👦"
}, {
  expected: "👨‍👩‍👧",
  actual: "👨👩👧"
}, {
  expected: "👨‍👨‍👦",
  actual: "👨👨👦"
}, {
  expected: "👨‍👨‍👧",
  actual: "👨👨👧"
}, {
  expected: "👩‍👩‍👦",
  actual: "👩👩👦"
}, {
  expected: "👩‍👩‍👧",
  actual: "👩👩👧"
}, {
  expected: "👨‍👦‍👦",
  actual: "👨👦👦"
}, {
  expected: "👨‍👧‍👦",
  actual: "👨👧👦"
}, {
  expected: "👨‍👧‍👧",
  actual: "👨👧👧"
}, {
  expected: "👩‍👦‍👦",
  actual: "👩👦👦"
}, {
  expected: "👩‍👧‍👦",
  actual: "👩👧👦"
}, {
  expected: "👩‍👧‍👧",
  actual: "👩👧👧"
}, {
  expected: "😶‍🌫",
  actual: "😶‍🌫"
}, {
  expected: "😮‍💨",
  actual: "😮‍💨"
}, {
  expected: "😵‍💫",
  actual: "😵‍💫"
}, {
  expected: "👁‍🗨",
  actual: "👁‍🗨"
}, {
  expected: "🧔🏻‍♂️",
  actual: "🧔🏻♂"
}, {
  expected: "🧔🏼‍♂️",
  actual: "🧔🏼♂"
}, {
  expected: "🧔🏽‍♂️",
  actual: "🧔🏽♂"
}, {
  expected: "🧔🏾‍♂️",
  actual: "🧔🏾♂"
}, {
  expected: "🧔🏿‍♂️",
  actual: "🧔🏿♂"
}, {
  expected: "🧔🏻‍♀️",
  actual: "🧔🏻♀"
}, {
  expected: "🧔🏼‍♀️",
  actual: "🧔🏼♀"
}, {
  expected: "🧔🏽‍♀️",
  actual: "🧔🏽♀"
}, {
  expected: "🧔🏾‍♀️",
  actual: "🧔🏾♀"
}, {
  expected: "🧔🏿‍♀️",
  actual: "🧔🏿♀"
}, {
  expected: "👨‍🦰",
  actual: "👨‍🦰"
}, {
  expected: "👨‍🦱",
  actual: "👨‍🦱"
}, {
  expected: "👨‍🦳",
  actual: "👨‍🦳"
}, {
  expected: "👨‍🦲",
  actual: "👨‍🦲"
}, {
  expected: "👩‍🦰",
  actual: "👩‍🦰"
}, {
  expected: "🧑‍🦰",
  actual: "🧑‍🦰"
}, {
  expected: "👩‍🦱",
  actual: "👩‍🦱"
}, {
  expected: "🧑‍🦱",
  actual: "🧑‍🦱"
}, {
  expected: "👩‍🦳",
  actual: "👩‍🦳"
}, {
  expected: "🧑‍🦳",
  actual: "🧑‍🦳"
}, {
  expected: "👩‍🦲",
  actual: "👩‍🦲"
}, {
  expected: "🧑‍🦲",
  actual: "🧑‍🦲"
}, {
  expected: "👱🏻‍♀️",
  actual: "👱🏻♀"
}, {
  expected: "👱🏼‍♀️",
  actual: "👱🏼♀"
}, {
  expected: "👱🏽‍♀️",
  actual: "👱🏽♀"
}, {
  expected: "👱🏾‍♀️",
  actual: "👱🏾♀"
}, {
  expected: "👱🏿‍♀️",
  actual: "👱🏿♀"
}, {
  expected: "👱🏻‍♂️",
  actual: "👱🏻♂"
}, {
  expected: "👱🏼‍♂️",
  actual: "👱🏼♂"
}, {
  expected: "👱🏽‍♂️",
  actual: "👱🏽♂"
}, {
  expected: "👱🏾‍♂️",
  actual: "👱🏾♂"
}, {
  expected: "👱🏿‍♂️",
  actual: "👱🏿♂"
}, {
  expected: "🙍🏻‍♂️",
  actual: "🙍🏻♂"
}, {
  expected: "🙍🏼‍♂️",
  actual: "🙍🏼♂"
}, {
  expected: "🙍🏽‍♂️",
  actual: "🙍🏽♂"
}, {
  expected: "🙍🏾‍♂️",
  actual: "🙍🏾♂"
}, {
  expected: "🙍🏿‍♂️",
  actual: "🙍🏿♂"
}, {
  expected: "🙍🏻‍♀️",
  actual: "🙍🏻♀"
}, {
  expected: "🙍🏼‍♀️",
  actual: "🙍🏼♀"
}, {
  expected: "🙍🏽‍♀️",
  actual: "🙍🏽♀"
}, {
  expected: "🙍🏾‍♀️",
  actual: "🙍🏾♀"
}, {
  expected: "🙍🏿‍♀️",
  actual: "🙍🏿♀"
}, {
  expected: "🙎🏻‍♂️",
  actual: "🙎🏻♂"
}, {
  expected: "🙎🏼‍♂️",
  actual: "🙎🏼♂"
}, {
  expected: "🙎🏽‍♂️",
  actual: "🙎🏽♂"
}, {
  expected: "🙎🏾‍♂️",
  actual: "🙎🏾♂"
}, {
  expected: "🙎🏿‍♂️",
  actual: "🙎🏿♂"
}, {
  expected: "🙎🏻‍♀️",
  actual: "🙎🏻♀"
}, {
  expected: "🙎🏼‍♀️",
  actual: "🙎🏼♀"
}, {
  expected: "🙎🏽‍♀️",
  actual: "🙎🏽♀"
}, {
  expected: "🙎🏾‍♀️",
  actual: "🙎🏾♀"
}, {
  expected: "🙎🏿‍♀️",
  actual: "🙎🏿♀"
}, {
  expected: "🙅🏻‍♂️",
  actual: "🙅🏻♂"
}, {
  expected: "🙅🏼‍♂️",
  actual: "🙅🏼♂"
}, {
  expected: "🙅🏽‍♂️",
  actual: "🙅🏽♂"
}, {
  expected: "🙅🏾‍♂️",
  actual: "🙅🏾♂"
}, {
  expected: "🙅🏿‍♂️",
  actual: "🙅🏿♂"
}, {
  expected: "🙅🏻‍♀️",
  actual: "🙅🏻♀"
}, {
  expected: "🙅🏼‍♀️",
  actual: "🙅🏼♀"
}, {
  expected: "🙅🏽‍♀️",
  actual: "🙅🏽♀"
}, {
  expected: "🙅🏾‍♀️",
  actual: "🙅🏾♀"
}, {
  expected: "🙅🏿‍♀️",
  actual: "🙅🏿♀"
}, {
  expected: "🙆🏻‍♂️",
  actual: "🙆🏻♂"
}, {
  expected: "🙆🏼‍♂️",
  actual: "🙆🏼♂"
}, {
  expected: "🙆🏽‍♂️",
  actual: "🙆🏽♂"
}, {
  expected: "🙆🏾‍♂️",
  actual: "🙆🏾♂"
}, {
  expected: "🙆🏿‍♂️",
  actual: "🙆🏿♂"
}, {
  expected: "🙆🏻‍♀️",
  actual: "🙆🏻♀"
}, {
  expected: "🙆🏼‍♀️",
  actual: "🙆🏼♀"
}, {
  expected: "🙆🏽‍♀️",
  actual: "🙆🏽♀"
}, {
  expected: "🙆🏾‍♀️",
  actual: "🙆🏾♀"
}, {
  expected: "🙆🏿‍♀️",
  actual: "🙆🏿♀"
}, {
  expected: "💁🏻‍♂️",
  actual: "💁🏻♂"
}, {
  expected: "💁🏼‍♂️",
  actual: "💁🏼♂"
}, {
  expected: "💁🏽‍♂️",
  actual: "💁🏽♂"
}, {
  expected: "💁🏾‍♂️",
  actual: "💁🏾♂"
}, {
  expected: "💁🏿‍♂️",
  actual: "💁🏿♂"
}, {
  expected: "💁🏻‍♀️",
  actual: "💁🏻♀"
}, {
  expected: "💁🏼‍♀️",
  actual: "💁🏼♀"
}, {
  expected: "💁🏽‍♀️",
  actual: "💁🏽♀"
}, {
  expected: "💁🏾‍♀️",
  actual: "💁🏾♀"
}, {
  expected: "💁🏿‍♀️",
  actual: "💁🏿♀"
}, {
  expected: "🙋🏻‍♂️",
  actual: "🙋🏻♂"
}, {
  expected: "🙋🏼‍♂️",
  actual: "🙋🏼♂"
}, {
  expected: "🙋🏽‍♂️",
  actual: "🙋🏽♂"
}, {
  expected: "🙋🏾‍♂️",
  actual: "🙋🏾♂"
}, {
  expected: "🙋🏿‍♂️",
  actual: "🙋🏿♂"
}, {
  expected: "🙋🏻‍♀️",
  actual: "🙋🏻♀"
}, {
  expected: "🙋🏼‍♀️",
  actual: "🙋🏼♀"
}, {
  expected: "🙋🏽‍♀️",
  actual: "🙋🏽♀"
}, {
  expected: "🙋🏾‍♀️",
  actual: "🙋🏾♀"
}, {
  expected: "🙋🏿‍♀️",
  actual: "🙋🏿♀"
}, {
  expected: "🧏🏻‍♂️",
  actual: "🧏🏻♂"
}, {
  expected: "🧏🏼‍♂️",
  actual: "🧏🏼♂"
}, {
  expected: "🧏🏽‍♂️",
  actual: "🧏🏽♂"
}, {
  expected: "🧏🏾‍♂️",
  actual: "🧏🏾♂"
}, {
  expected: "🧏🏿‍♂️",
  actual: "🧏🏿♂"
}, {
  expected: "🧏🏻‍♀️",
  actual: "🧏🏻♀"
}, {
  expected: "🧏🏼‍♀️",
  actual: "🧏🏼♀"
}, {
  expected: "🧏🏽‍♀️",
  actual: "🧏🏽♀"
}, {
  expected: "🧏🏾‍♀️",
  actual: "🧏🏾♀"
}, {
  expected: "🧏🏿‍♀️",
  actual: "🧏🏿♀"
}, {
  expected: "🙇🏻‍♂️",
  actual: "🙇🏻♂"
}, {
  expected: "🙇🏼‍♂️",
  actual: "🙇🏼♂"
}, {
  expected: "🙇🏽‍♂️",
  actual: "🙇🏽♂"
}, {
  expected: "🙇🏾‍♂️",
  actual: "🙇🏾♂"
}, {
  expected: "🙇🏿‍♂️",
  actual: "🙇🏿♂"
}, {
  expected: "🙇🏻‍♀️",
  actual: "🙇🏻♀"
}, {
  expected: "🙇🏼‍♀️",
  actual: "🙇🏼♀"
}, {
  expected: "🙇🏽‍♀️",
  actual: "🙇🏽♀"
}, {
  expected: "🙇🏾‍♀️",
  actual: "🙇🏾♀"
}, {
  expected: "🙇🏿‍♀️",
  actual: "🙇🏿♀"
}, {
  expected: "🤦🏻‍♂️",
  actual: "🤦🏻♂"
}, {
  expected: "🤦🏼‍♂️",
  actual: "🤦🏼♂"
}, {
  expected: "🤦🏽‍♂️",
  actual: "🤦🏽♂"
}, {
  expected: "🤦🏾‍♂️",
  actual: "🤦🏾♂"
}, {
  expected: "🤦🏿‍♂️",
  actual: "🤦🏿♂"
}, {
  expected: "🤦🏻‍♀️",
  actual: "🤦🏻♀"
}, {
  expected: "🤦🏼‍♀️",
  actual: "🤦🏼♀"
}, {
  expected: "🤦🏽‍♀️",
  actual: "🤦🏽♀"
}, {
  expected: "🤦🏾‍♀️",
  actual: "🤦🏾♀"
}, {
  expected: "🤦🏿‍♀️",
  actual: "🤦🏿♀"
}, {
  expected: "🤷🏻‍♂️",
  actual: "🤷🏻♂"
}, {
  expected: "🤷🏼‍♂️",
  actual: "🤷🏼♂"
}, {
  expected: "🤷🏽‍♂️",
  actual: "🤷🏽♂"
}, {
  expected: "🤷🏾‍♂️",
  actual: "🤷🏾♂"
}, {
  expected: "🤷🏿‍♂️",
  actual: "🤷🏿♂"
}, {
  expected: "🤷🏻‍♀️",
  actual: "🤷🏻♀"
}, {
  expected: "🤷🏼‍♀️",
  actual: "🤷🏼♀"
}, {
  expected: "🤷🏽‍♀️",
  actual: "🤷🏽♀"
}, {
  expected: "🤷🏾‍♀️",
  actual: "🤷🏾♀"
}, {
  expected: "🤷🏿‍♀️",
  actual: "🤷🏿♀"
}, {
  expected: "🧑🏻‍⚕️",
  actual: "🧑🏻⚕"
}, {
  expected: "🧑🏼‍⚕️",
  actual: "🧑🏼⚕"
}, {
  expected: "🧑🏽‍⚕️",
  actual: "🧑🏽⚕"
}, {
  expected: "🧑🏾‍⚕️",
  actual: "🧑🏾⚕"
}, {
  expected: "🧑🏿‍⚕️",
  actual: "🧑🏿⚕"
}, {
  expected: "👨🏻‍⚕️",
  actual: "👨🏻⚕"
}, {
  expected: "👨🏼‍⚕️",
  actual: "👨🏼⚕"
}, {
  expected: "👨🏽‍⚕️",
  actual: "👨🏽⚕"
}, {
  expected: "👨🏾‍⚕️",
  actual: "👨🏾⚕"
}, {
  expected: "👨🏿‍⚕️",
  actual: "👨🏿⚕"
}, {
  expected: "👩🏻‍⚕️",
  actual: "👩🏻⚕"
}, {
  expected: "👩🏼‍⚕️",
  actual: "👩🏼⚕"
}, {
  expected: "👩🏽‍⚕️",
  actual: "👩🏽⚕"
}, {
  expected: "👩🏾‍⚕️",
  actual: "👩🏾⚕"
}, {
  expected: "👩🏿‍⚕️",
  actual: "👩🏿⚕"
}, {
  expected: "🧑‍🎓",
  actual: "🧑‍🎓"
}, {
  expected: "👨‍🎓",
  actual: "👨‍🎓"
}, {
  expected: "👩‍🎓",
  actual: "👩‍🎓"
}, {
  expected: "🧑‍🏫",
  actual: "🧑‍🏫"
}, {
  expected: "👨‍🏫",
  actual: "👨‍🏫"
}, {
  expected: "👩‍🏫",
  actual: "👩‍🏫"
}, {
  expected: "🧑🏻‍⚖️",
  actual: "🧑🏻⚖"
}, {
  expected: "🧑🏼‍⚖️",
  actual: "🧑🏼⚖"
}, {
  expected: "🧑🏽‍⚖️",
  actual: "🧑🏽⚖"
}, {
  expected: "🧑🏾‍⚖️",
  actual: "🧑🏾⚖"
}, {
  expected: "🧑🏿‍⚖️",
  actual: "🧑🏿⚖"
}, {
  expected: "👨🏻‍⚖️",
  actual: "👨🏻⚖"
}, {
  expected: "👨🏼‍⚖️",
  actual: "👨🏼⚖"
}, {
  expected: "👨🏽‍⚖️",
  actual: "👨🏽⚖"
}, {
  expected: "👨🏾‍⚖️",
  actual: "👨🏾⚖"
}, {
  expected: "👨🏿‍⚖️",
  actual: "👨🏿⚖"
}, {
  expected: "👩🏻‍⚖️",
  actual: "👩🏻⚖"
}, {
  expected: "👩🏼‍⚖️",
  actual: "👩🏼⚖"
}, {
  expected: "👩🏽‍⚖️",
  actual: "👩🏽⚖"
}, {
  expected: "👩🏾‍⚖️",
  actual: "👩🏾⚖"
}, {
  expected: "👩🏿‍⚖️",
  actual: "👩🏿⚖"
}, {
  expected: "🧑‍🌾",
  actual: "🧑‍🌾"
}, {
  expected: "👨‍🌾",
  actual: "👨‍🌾"
}, {
  expected: "👩‍🌾",
  actual: "👩‍🌾"
}, {
  expected: "🧑‍🍳",
  actual: "🧑‍🍳"
}, {
  expected: "👨‍🍳",
  actual: "👨‍🍳"
}, {
  expected: "👩‍🍳",
  actual: "👩‍🍳"
}, {
  expected: "🧑‍🔧",
  actual: "🧑‍🔧"
}, {
  expected: "👨‍🔧",
  actual: "👨‍🔧"
}, {
  expected: "👩‍🔧",
  actual: "👩‍🔧"
}, {
  expected: "🧑‍🏭",
  actual: "🧑‍🏭"
}, {
  expected: "👨‍🏭",
  actual: "👨‍🏭"
}, {
  expected: "👩‍🏭",
  actual: "👩‍🏭"
}, {
  expected: "🧑‍💼",
  actual: "🧑‍💼"
}, {
  expected: "👨‍💼",
  actual: "👨‍💼"
}, {
  expected: "👩‍💼",
  actual: "👩‍💼"
}, {
  expected: "🧑‍🔬",
  actual: "🧑‍🔬"
}, {
  expected: "👨‍🔬",
  actual: "👨‍🔬"
}, {
  expected: "👩‍🔬",
  actual: "👩‍🔬"
}, {
  expected: "🧑‍💻",
  actual: "🧑‍💻"
}, {
  expected: "👨‍💻",
  actual: "👨‍💻"
}, {
  expected: "👩‍💻",
  actual: "👩‍💻"
}, {
  expected: "🧑‍🎤",
  actual: "🧑‍🎤"
}, {
  expected: "👨‍🎤",
  actual: "👨‍🎤"
}, {
  expected: "👩‍🎤",
  actual: "👩‍🎤"
}, {
  expected: "🧑‍🎨",
  actual: "🧑‍🎨"
}, {
  expected: "👨‍🎨",
  actual: "👨‍🎨"
}, {
  expected: "👩‍🎨",
  actual: "👩‍🎨"
}, {
  expected: "🧑🏻‍✈️",
  actual: "🧑🏻✈"
}, {
  expected: "🧑🏼‍✈️",
  actual: "🧑🏼✈"
}, {
  expected: "🧑🏽‍✈️",
  actual: "🧑🏽✈"
}, {
  expected: "🧑🏾‍✈️",
  actual: "🧑🏾✈"
}, {
  expected: "🧑🏿‍✈️",
  actual: "🧑🏿✈"
}, {
  expected: "👨🏻‍✈️",
  actual: "👨🏻✈"
}, {
  expected: "👨🏼‍✈️",
  actual: "👨🏼✈"
}, {
  expected: "👨🏽‍✈️",
  actual: "👨🏽✈"
}, {
  expected: "👨🏾‍✈️",
  actual: "👨🏾✈"
}, {
  expected: "👨🏿‍✈️",
  actual: "👨🏿✈"
}, {
  expected: "👩🏻‍✈️",
  actual: "👩🏻✈"
}, {
  expected: "👩🏼‍✈️",
  actual: "👩🏼✈"
}, {
  expected: "👩🏽‍✈️",
  actual: "👩🏽✈"
}, {
  expected: "👩🏾‍✈️",
  actual: "👩🏾✈"
}, {
  expected: "👩🏿‍✈️",
  actual: "👩🏿✈"
}, {
  expected: "🧑‍🚀",
  actual: "🧑‍🚀"
}, {
  expected: "👨‍🚀",
  actual: "👨‍🚀"
}, {
  expected: "👩‍🚀",
  actual: "👩‍🚀"
}, {
  expected: "🧑‍🚒",
  actual: "🧑‍🚒"
}, {
  expected: "👨‍🚒",
  actual: "👨‍🚒"
}, {
  expected: "👩‍🚒",
  actual: "👩‍🚒"
}, {
  expected: "👮🏻‍♂️",
  actual: "👮🏻♂"
}, {
  expected: "👮🏼‍♂️",
  actual: "👮🏼♂"
}, {
  expected: "👮🏽‍♂️",
  actual: "👮🏽♂"
}, {
  expected: "👮🏾‍♂️",
  actual: "👮🏾♂"
}, {
  expected: "👮🏿‍♂️",
  actual: "👮🏿♂"
}, {
  expected: "👮🏻‍♀️",
  actual: "👮🏻♀"
}, {
  expected: "👮🏼‍♀️",
  actual: "👮🏼♀"
}, {
  expected: "👮🏽‍♀️",
  actual: "👮🏽♀"
}, {
  expected: "👮🏾‍♀️",
  actual: "👮🏾♀"
}, {
  expected: "👮🏿‍♀️",
  actual: "👮🏿♀"
}, {
  expected: "🕵🏻‍♂️",
  actual: "🕵🏻♂"
}, {
  expected: "🕵🏼‍♂️",
  actual: "🕵🏼♂"
}, {
  expected: "🕵🏽‍♂️",
  actual: "🕵🏽♂"
}, {
  expected: "🕵🏾‍♂️",
  actual: "🕵🏾♂"
}, {
  expected: "🕵🏿‍♂️",
  actual: "🕵🏿♂"
}, {
  expected: "🕵🏻‍♀️",
  actual: "🕵🏻♀"
}, {
  expected: "🕵🏼‍♀️",
  actual: "🕵🏼♀"
}, {
  expected: "🕵🏽‍♀️",
  actual: "🕵🏽♀"
}, {
  expected: "🕵🏾‍♀️",
  actual: "🕵🏾♀"
}, {
  expected: "🕵🏿‍♀️",
  actual: "🕵🏿♀"
}, {
  expected: "💂🏻‍♂️",
  actual: "💂🏻♂"
}, {
  expected: "💂🏼‍♂️",
  actual: "💂🏼♂"
}, {
  expected: "💂🏽‍♂️",
  actual: "💂🏽♂"
}, {
  expected: "💂🏾‍♂️",
  actual: "💂🏾♂"
}, {
  expected: "💂🏿‍♂️",
  actual: "💂🏿♂"
}, {
  expected: "💂🏻‍♀️",
  actual: "💂🏻♀"
}, {
  expected: "💂🏼‍♀️",
  actual: "💂🏼♀"
}, {
  expected: "💂🏽‍♀️",
  actual: "💂🏽♀"
}, {
  expected: "💂🏾‍♀️",
  actual: "💂🏾♀"
}, {
  expected: "💂🏿‍♀️",
  actual: "💂🏿♀"
}, {
  expected: "👷🏻‍♂️",
  actual: "👷🏻♂"
}, {
  expected: "👷🏼‍♂️",
  actual: "👷🏼♂"
}, {
  expected: "👷🏽‍♂️",
  actual: "👷🏽♂"
}, {
  expected: "👷🏾‍♂️",
  actual: "👷🏾♂"
}, {
  expected: "👷🏿‍♂️",
  actual: "👷🏿♂"
}, {
  expected: "👷🏻‍♀️",
  actual: "👷🏻♀"
}, {
  expected: "👷🏼‍♀️",
  actual: "👷🏼♀"
}, {
  expected: "👷🏽‍♀️",
  actual: "👷🏽♀"
}, {
  expected: "👷🏾‍♀️",
  actual: "👷🏾♀"
}, {
  expected: "👷🏿‍♀️",
  actual: "👷🏿♀"
}, {
  expected: "👳🏻‍♂️",
  actual: "👳🏻♂"
}, {
  expected: "👳🏼‍♂️",
  actual: "👳🏼♂"
}, {
  expected: "👳🏽‍♂️",
  actual: "👳🏽♂"
}, {
  expected: "👳🏾‍♂️",
  actual: "👳🏾♂"
}, {
  expected: "👳🏿‍♂️",
  actual: "👳🏿♂"
}, {
  expected: "👳🏻‍♀️",
  actual: "👳🏻♀"
}, {
  expected: "👳🏼‍♀️",
  actual: "👳🏼♀"
}, {
  expected: "👳🏽‍♀️",
  actual: "👳🏽♀"
}, {
  expected: "👳🏾‍♀️",
  actual: "👳🏾♀"
}, {
  expected: "👳🏿‍♀️",
  actual: "👳🏿♀"
}, {
  expected: "🤵🏻‍♂️",
  actual: "🤵🏻♂"
}, {
  expected: "🤵🏼‍♂️",
  actual: "🤵🏼♂"
}, {
  expected: "🤵🏽‍♂️",
  actual: "🤵🏽♂"
}, {
  expected: "🤵🏾‍♂️",
  actual: "🤵🏾♂"
}, {
  expected: "🤵🏿‍♂️",
  actual: "🤵🏿♂"
}, {
  expected: "🤵🏻‍♀️",
  actual: "🤵🏻♀"
}, {
  expected: "🤵🏼‍♀️",
  actual: "🤵🏼♀"
}, {
  expected: "🤵🏽‍♀️",
  actual: "🤵🏽♀"
}, {
  expected: "🤵🏾‍♀️",
  actual: "🤵🏾♀"
}, {
  expected: "🤵🏿‍♀️",
  actual: "🤵🏿♀"
}, {
  expected: "👰🏻‍♂️",
  actual: "👰🏻♂"
}, {
  expected: "👰🏼‍♂️",
  actual: "👰🏼♂"
}, {
  expected: "👰🏽‍♂️",
  actual: "👰🏽♂"
}, {
  expected: "👰🏾‍♂️",
  actual: "👰🏾♂"
}, {
  expected: "👰🏿‍♂️",
  actual: "👰🏿♂"
}, {
  expected: "👰🏻‍♀️",
  actual: "👰🏻♀"
}, {
  expected: "👰🏼‍♀️",
  actual: "👰🏼♀"
}, {
  expected: "👰🏽‍♀️",
  actual: "👰🏽♀"
}, {
  expected: "👰🏾‍♀️",
  actual: "👰🏾♀"
}, {
  expected: "👰🏿‍♀️",
  actual: "👰🏿♀"
}, {
  expected: "👩‍🍼",
  actual: "👩‍🍼"
}, {
  expected: "👨‍🍼",
  actual: "👨‍🍼"
}, {
  expected: "🧑‍🍼",
  actual: "🧑‍🍼"
}, {
  expected: "🧑‍🎄",
  actual: "🧑‍🎄"
}, {
  expected: "🦸🏻‍♂️",
  actual: "🦸🏻♂"
}, {
  expected: "🦸🏼‍♂️",
  actual: "🦸🏼♂"
}, {
  expected: "🦸🏽‍♂️",
  actual: "🦸🏽♂"
}, {
  expected: "🦸🏾‍♂️",
  actual: "🦸🏾♂"
}, {
  expected: "🦸🏿‍♂️",
  actual: "🦸🏿♂"
}, {
  expected: "🦸🏻‍♀️",
  actual: "🦸🏻♀"
}, {
  expected: "🦸🏼‍♀️",
  actual: "🦸🏼♀"
}, {
  expected: "🦸🏽‍♀️",
  actual: "🦸🏽♀"
}, {
  expected: "🦸🏾‍♀️",
  actual: "🦸🏾♀"
}, {
  expected: "🦸🏿‍♀️",
  actual: "🦸🏿♀"
}, {
  expected: "🦹🏻‍♂️",
  actual: "🦹🏻♂"
}, {
  expected: "🦹🏼‍♂️",
  actual: "🦹🏼♂"
}, {
  expected: "🦹🏽‍♂️",
  actual: "🦹🏽♂"
}, {
  expected: "🦹🏾‍♂️",
  actual: "🦹🏾♂"
}, {
  expected: "🦹🏿‍♂️",
  actual: "🦹🏿♂"
}, {
  expected: "🦹🏻‍♀️",
  actual: "🦹🏻♀"
}, {
  expected: "🦹🏼‍♀️",
  actual: "🦹🏼♀"
}, {
  expected: "🦹🏽‍♀️",
  actual: "🦹🏽♀"
}, {
  expected: "🦹🏾‍♀️",
  actual: "🦹🏾♀"
}, {
  expected: "🦹🏿‍♀️",
  actual: "🦹🏿♀"
}, {
  expected: "🧙🏻‍♂️",
  actual: "🧙🏻♂"
}, {
  expected: "🧙🏼‍♂️",
  actual: "🧙🏼♂"
}, {
  expected: "🧙🏽‍♂️",
  actual: "🧙🏽♂"
}, {
  expected: "🧙🏾‍♂️",
  actual: "🧙🏾♂"
}, {
  expected: "🧙🏿‍♂️",
  actual: "🧙🏿♂"
}, {
  expected: "🧙🏻‍♀️",
  actual: "🧙🏻♀"
}, {
  expected: "🧙🏼‍♀️",
  actual: "🧙🏼♀"
}, {
  expected: "🧙🏽‍♀️",
  actual: "🧙🏽♀"
}, {
  expected: "🧙🏾‍♀️",
  actual: "🧙🏾♀"
}, {
  expected: "🧙🏿‍♀️",
  actual: "🧙🏿♀"
}, {
  expected: "🧚🏻‍♂️",
  actual: "🧚🏻♂"
}, {
  expected: "🧚🏼‍♂️",
  actual: "🧚🏼♂"
}, {
  expected: "🧚🏽‍♂️",
  actual: "🧚🏽♂"
}, {
  expected: "🧚🏾‍♂️",
  actual: "🧚🏾♂"
}, {
  expected: "🧚🏿‍♂️",
  actual: "🧚🏿♂"
}, {
  expected: "🧚🏻‍♀️",
  actual: "🧚🏻♀"
}, {
  expected: "🧚🏼‍♀️",
  actual: "🧚🏼♀"
}, {
  expected: "🧚🏽‍♀️",
  actual: "🧚🏽♀"
}, {
  expected: "🧚🏾‍♀️",
  actual: "🧚🏾♀"
}, {
  expected: "🧚🏿‍♀️",
  actual: "🧚🏿♀"
}, {
  expected: "🧛🏻‍♂️",
  actual: "🧛🏻♂"
}, {
  expected: "🧛🏼‍♂️",
  actual: "🧛🏼♂"
}, {
  expected: "🧛🏽‍♂️",
  actual: "🧛🏽♂"
}, {
  expected: "🧛🏾‍♂️",
  actual: "🧛🏾♂"
}, {
  expected: "🧛🏿‍♂️",
  actual: "🧛🏿♂"
}, {
  expected: "🧛🏻‍♀️",
  actual: "🧛🏻♀"
}, {
  expected: "🧛🏼‍♀️",
  actual: "🧛🏼♀"
}, {
  expected: "🧛🏽‍♀️",
  actual: "🧛🏽♀"
}, {
  expected: "🧛🏾‍♀️",
  actual: "🧛🏾♀"
}, {
  expected: "🧛🏿‍♀️",
  actual: "🧛🏿♀"
}, {
  expected: "🧜🏻‍♂️",
  actual: "🧜🏻♂"
}, {
  expected: "🧜🏼‍♂️",
  actual: "🧜🏼♂"
}, {
  expected: "🧜🏽‍♂️",
  actual: "🧜🏽♂"
}, {
  expected: "🧜🏾‍♂️",
  actual: "🧜🏾♂"
}, {
  expected: "🧜🏿‍♂️",
  actual: "🧜🏿♂"
}, {
  expected: "🧜🏻‍♀️",
  actual: "🧜🏻♀"
}, {
  expected: "🧜🏼‍♀️",
  actual: "🧜🏼♀"
}, {
  expected: "🧜🏽‍♀️",
  actual: "🧜🏽♀"
}, {
  expected: "🧜🏾‍♀️",
  actual: "🧜🏾♀"
}, {
  expected: "🧜🏿‍♀️",
  actual: "🧜🏿♀"
}, {
  expected: "🧝🏻‍♂️",
  actual: "🧝🏻♂"
}, {
  expected: "🧝🏼‍♂️",
  actual: "🧝🏼♂"
}, {
  expected: "🧝🏽‍♂️",
  actual: "🧝🏽♂"
}, {
  expected: "🧝🏾‍♂️",
  actual: "🧝🏾♂"
}, {
  expected: "🧝🏿‍♂️",
  actual: "🧝🏿♂"
}, {
  expected: "🧝🏻‍♀️",
  actual: "🧝🏻♀"
}, {
  expected: "🧝🏼‍♀️",
  actual: "🧝🏼♀"
}, {
  expected: "🧝🏽‍♀️",
  actual: "🧝🏽♀"
}, {
  expected: "🧝🏾‍♀️",
  actual: "🧝🏾♀"
}, {
  expected: "🧝🏿‍♀️",
  actual: "🧝🏿♀"
}, {
  expected: "💆🏻‍♂️",
  actual: "💆🏻♂"
}, {
  expected: "💆🏼‍♂️",
  actual: "💆🏼♂"
}, {
  expected: "💆🏽‍♂️",
  actual: "💆🏽♂"
}, {
  expected: "💆🏾‍♂️",
  actual: "💆🏾♂"
}, {
  expected: "💆🏿‍♂️",
  actual: "💆🏿♂"
}, {
  expected: "💆🏻‍♀️",
  actual: "💆🏻♀"
}, {
  expected: "💆🏼‍♀️",
  actual: "💆🏼♀"
}, {
  expected: "💆🏽‍♀️",
  actual: "💆🏽♀"
}, {
  expected: "💆🏾‍♀️",
  actual: "💆🏾♀"
}, {
  expected: "💆🏿‍♀️",
  actual: "💆🏿♀"
}, {
  expected: "💇🏻‍♂️",
  actual: "💇🏻♂"
}, {
  expected: "💇🏼‍♂️",
  actual: "💇🏼♂"
}, {
  expected: "💇🏽‍♂️",
  actual: "💇🏽♂"
}, {
  expected: "💇🏾‍♂️",
  actual: "💇🏾♂"
}, {
  expected: "💇🏿‍♂️",
  actual: "💇🏿♂"
}, {
  expected: "💇🏻‍♀️",
  actual: "💇🏻♀"
}, {
  expected: "💇🏼‍♀️",
  actual: "💇🏼♀"
}, {
  expected: "💇🏽‍♀️",
  actual: "💇🏽♀"
}, {
  expected: "💇🏾‍♀️",
  actual: "💇🏾♀"
}, {
  expected: "💇🏿‍♀️",
  actual: "💇🏿♀"
}, {
  expected: "🚶🏻‍♂️",
  actual: "🚶🏻♂"
}, {
  expected: "🚶🏼‍♂️",
  actual: "🚶🏼♂"
}, {
  expected: "🚶🏽‍♂️",
  actual: "🚶🏽♂"
}, {
  expected: "🚶🏾‍♂️",
  actual: "🚶🏾♂"
}, {
  expected: "🚶🏿‍♂️",
  actual: "🚶🏿♂"
}, {
  expected: "🚶🏻‍♀️",
  actual: "🚶🏻♀"
}, {
  expected: "🚶🏼‍♀️",
  actual: "🚶🏼♀"
}, {
  expected: "🚶🏽‍♀️",
  actual: "🚶🏽♀"
}, {
  expected: "🚶🏾‍♀️",
  actual: "🚶🏾♀"
}, {
  expected: "🚶🏿‍♀️",
  actual: "🚶🏿♀"
}, {
  expected: "🧍🏻‍♂️",
  actual: "🧍🏻♂"
}, {
  expected: "🧍🏼‍♂️",
  actual: "🧍🏼♂"
}, {
  expected: "🧍🏽‍♂️",
  actual: "🧍🏽♂"
}, {
  expected: "🧍🏾‍♂️",
  actual: "🧍🏾♂"
}, {
  expected: "🧍🏿‍♂️",
  actual: "🧍🏿♂"
}, {
  expected: "🧍🏻‍♀️",
  actual: "🧍🏻♀"
}, {
  expected: "🧍🏼‍♀️",
  actual: "🧍🏼♀"
}, {
  expected: "🧍🏽‍♀️",
  actual: "🧍🏽♀"
}, {
  expected: "🧍🏾‍♀️",
  actual: "🧍🏾♀"
}, {
  expected: "🧍🏿‍♀️",
  actual: "🧍🏿♀"
}, {
  expected: "🧎🏻‍♂️",
  actual: "🧎🏻♂"
}, {
  expected: "🧎🏼‍♂️",
  actual: "🧎🏼♂"
}, {
  expected: "🧎🏽‍♂️",
  actual: "🧎🏽♂"
}, {
  expected: "🧎🏾‍♂️",
  actual: "🧎🏾♂"
}, {
  expected: "🧎🏿‍♂️",
  actual: "🧎🏿♂"
}, {
  expected: "🧎🏻‍♀️",
  actual: "🧎🏻♀"
}, {
  expected: "🧎🏼‍♀️",
  actual: "🧎🏼♀"
}, {
  expected: "🧎🏽‍♀️",
  actual: "🧎🏽♀"
}, {
  expected: "🧎🏾‍♀️",
  actual: "🧎🏾♀"
}, {
  expected: "🧎🏿‍♀️",
  actual: "🧎🏿♀"
}, {
  expected: "🧑‍🦯",
  actual: "🧑‍🦯"
}, {
  expected: "👨‍🦯",
  actual: "👨‍🦯"
}, {
  expected: "👩‍🦯",
  actual: "👩‍🦯"
}, {
  expected: "🧑‍🦼",
  actual: "🧑‍🦼"
}, {
  expected: "👨‍🦼",
  actual: "👨‍🦼"
}, {
  expected: "👩‍🦼",
  actual: "👩‍🦼"
}, {
  expected: "🧑‍🦽",
  actual: "🧑‍🦽"
}, {
  expected: "👨‍🦽",
  actual: "👨‍🦽"
}, {
  expected: "👩‍🦽",
  actual: "👩‍🦽"
}, {
  expected: "🏃🏻‍♂️",
  actual: "🏃🏻♂"
}, {
  expected: "🏃🏼‍♂️",
  actual: "🏃🏼♂"
}, {
  expected: "🏃🏽‍♂️",
  actual: "🏃🏽♂"
}, {
  expected: "🏃🏾‍♂️",
  actual: "🏃🏾♂"
}, {
  expected: "🏃🏿‍♂️",
  actual: "🏃🏿♂"
}, {
  expected: "🏃🏻‍♀️",
  actual: "🏃🏻♀"
}, {
  expected: "🏃🏼‍♀️",
  actual: "🏃🏼♀"
}, {
  expected: "🏃🏽‍♀️",
  actual: "🏃🏽♀"
}, {
  expected: "🏃🏾‍♀️",
  actual: "🏃🏾♀"
}, {
  expected: "🏃🏿‍♀️",
  actual: "🏃🏿♀"
}, {
  expected: "🧖🏻‍♂️",
  actual: "🧖🏻♂"
}, {
  expected: "🧖🏼‍♂️",
  actual: "🧖🏼♂"
}, {
  expected: "🧖🏽‍♂️",
  actual: "🧖🏽♂"
}, {
  expected: "🧖🏾‍♂️",
  actual: "🧖🏾♂"
}, {
  expected: "🧖🏿‍♂️",
  actual: "🧖🏿♂"
}, {
  expected: "🧖🏻‍♀️",
  actual: "🧖🏻♀"
}, {
  expected: "🧖🏼‍♀️",
  actual: "🧖🏼♀"
}, {
  expected: "🧖🏽‍♀️",
  actual: "🧖🏽♀"
}, {
  expected: "🧖🏾‍♀️",
  actual: "🧖🏾♀"
}, {
  expected: "🧖🏿‍♀️",
  actual: "🧖🏿♀"
}, {
  expected: "🧗🏻‍♂️",
  actual: "🧗🏻♂"
}, {
  expected: "🧗🏼‍♂️",
  actual: "🧗🏼♂"
}, {
  expected: "🧗🏽‍♂️",
  actual: "🧗🏽♂"
}, {
  expected: "🧗🏾‍♂️",
  actual: "🧗🏾♂"
}, {
  expected: "🧗🏿‍♂️",
  actual: "🧗🏿♂"
}, {
  expected: "🧗🏻‍♀️",
  actual: "🧗🏻♀"
}, {
  expected: "🧗🏼‍♀️",
  actual: "🧗🏼♀"
}, {
  expected: "🧗🏽‍♀️",
  actual: "🧗🏽♀"
}, {
  expected: "🧗🏾‍♀️",
  actual: "🧗🏾♀"
}, {
  expected: "🧗🏿‍♀️",
  actual: "🧗🏿♀"
}, {
  expected: "🏌🏻‍♂️",
  actual: "🏌🏻♂"
}, {
  expected: "🏌🏼‍♂️",
  actual: "🏌🏼♂"
}, {
  expected: "🏌🏽‍♂️",
  actual: "🏌🏽♂"
}, {
  expected: "🏌🏾‍♂️",
  actual: "🏌🏾♂"
}, {
  expected: "🏌🏿‍♂️",
  actual: "🏌🏿♂"
}, {
  expected: "🏌🏻‍♀️",
  actual: "🏌🏻♀"
}, {
  expected: "🏌🏼‍♀️",
  actual: "🏌🏼♀"
}, {
  expected: "🏌🏽‍♀️",
  actual: "🏌🏽♀"
}, {
  expected: "🏌🏾‍♀️",
  actual: "🏌🏾♀"
}, {
  expected: "🏌🏿‍♀️",
  actual: "🏌🏿♀"
}, {
  expected: "🏄🏻‍♂️",
  actual: "🏄🏻♂"
}, {
  expected: "🏄🏼‍♂️",
  actual: "🏄🏼♂"
}, {
  expected: "🏄🏽‍♂️",
  actual: "🏄🏽♂"
}, {
  expected: "🏄🏾‍♂️",
  actual: "🏄🏾♂"
}, {
  expected: "🏄🏿‍♂️",
  actual: "🏄🏿♂"
}, {
  expected: "🏄🏻‍♀️",
  actual: "🏄🏻♀"
}, {
  expected: "🏄🏼‍♀️",
  actual: "🏄🏼♀"
}, {
  expected: "🏄🏽‍♀️",
  actual: "🏄🏽♀"
}, {
  expected: "🏄🏾‍♀️",
  actual: "🏄🏾♀"
}, {
  expected: "🏄🏿‍♀️",
  actual: "🏄🏿♀"
}, {
  expected: "🚣🏻‍♂️",
  actual: "🚣🏻♂"
}, {
  expected: "🚣🏼‍♂️",
  actual: "🚣🏼♂"
}, {
  expected: "🚣🏽‍♂️",
  actual: "🚣🏽♂"
}, {
  expected: "🚣🏾‍♂️",
  actual: "🚣🏾♂"
}, {
  expected: "🚣🏿‍♂️",
  actual: "🚣🏿♂"
}, {
  expected: "🚣🏻‍♀️",
  actual: "🚣🏻♀"
}, {
  expected: "🚣🏼‍♀️",
  actual: "🚣🏼♀"
}, {
  expected: "🚣🏽‍♀️",
  actual: "🚣🏽♀"
}, {
  expected: "🚣🏾‍♀️",
  actual: "🚣🏾♀"
}, {
  expected: "🚣🏿‍♀️",
  actual: "🚣🏿♀"
}, {
  expected: "🏊🏻‍♂️",
  actual: "🏊🏻♂"
}, {
  expected: "🏊🏼‍♂️",
  actual: "🏊🏼♂"
}, {
  expected: "🏊🏽‍♂️",
  actual: "🏊🏽♂"
}, {
  expected: "🏊🏾‍♂️",
  actual: "🏊🏾♂"
}, {
  expected: "🏊🏿‍♂️",
  actual: "🏊🏿♂"
}, {
  expected: "🏊🏻‍♀️",
  actual: "🏊🏻♀"
}, {
  expected: "🏊🏼‍♀️",
  actual: "🏊🏼♀"
}, {
  expected: "🏊🏽‍♀️",
  actual: "🏊🏽♀"
}, {
  expected: "🏊🏾‍♀️",
  actual: "🏊🏾♀"
}, {
  expected: "🏊🏿‍♀️",
  actual: "🏊🏿♀"
}, {
  expected: "🏋🏻‍♂️",
  actual: "🏋🏻♂"
}, {
  expected: "🏋🏼‍♂️",
  actual: "🏋🏼♂"
}, {
  expected: "🏋🏽‍♂️",
  actual: "🏋🏽♂"
}, {
  expected: "🏋🏾‍♂️",
  actual: "🏋🏾♂"
}, {
  expected: "🏋🏿‍♂️",
  actual: "🏋🏿♂"
}, {
  expected: "🏋🏻‍♀️",
  actual: "🏋🏻♀"
}, {
  expected: "🏋🏼‍♀️",
  actual: "🏋🏼♀"
}, {
  expected: "🏋🏽‍♀️",
  actual: "🏋🏽♀"
}, {
  expected: "🏋🏾‍♀️",
  actual: "🏋🏾♀"
}, {
  expected: "🏋🏿‍♀️",
  actual: "🏋🏿♀"
}, {
  expected: "🚴🏻‍♂️",
  actual: "🚴🏻♂"
}, {
  expected: "🚴🏼‍♂️",
  actual: "🚴🏼♂"
}, {
  expected: "🚴🏽‍♂️",
  actual: "🚴🏽♂"
}, {
  expected: "🚴🏾‍♂️",
  actual: "🚴🏾♂"
}, {
  expected: "🚴🏿‍♂️",
  actual: "🚴🏿♂"
}, {
  expected: "🚴🏻‍♀️",
  actual: "🚴🏻♀"
}, {
  expected: "🚴🏼‍♀️",
  actual: "🚴🏼♀"
}, {
  expected: "🚴🏽‍♀️",
  actual: "🚴🏽♀"
}, {
  expected: "🚴🏾‍♀️",
  actual: "🚴🏾♀"
}, {
  expected: "🚴🏿‍♀️",
  actual: "🚴🏿♀"
}, {
  expected: "🚵🏻‍♂️",
  actual: "🚵🏻♂"
}, {
  expected: "🚵🏼‍♂️",
  actual: "🚵🏼♂"
}, {
  expected: "🚵🏽‍♂️",
  actual: "🚵🏽♂"
}, {
  expected: "🚵🏾‍♂️",
  actual: "🚵🏾♂"
}, {
  expected: "🚵🏿‍♂️",
  actual: "🚵🏿♂"
}, {
  expected: "🚵🏻‍♀️",
  actual: "🚵🏻♀"
}, {
  expected: "🚵🏼‍♀️",
  actual: "🚵🏼♀"
}, {
  expected: "🚵🏽‍♀️",
  actual: "🚵🏽♀"
}, {
  expected: "🚵🏾‍♀️",
  actual: "🚵🏾♀"
}, {
  expected: "🚵🏿‍♀️",
  actual: "🚵🏿♀"
}, {
  expected: "🤸🏻‍♂️",
  actual: "🤸🏻♂"
}, {
  expected: "🤸🏼‍♂️",
  actual: "🤸🏼♂"
}, {
  expected: "🤸🏽‍♂️",
  actual: "🤸🏽♂"
}, {
  expected: "🤸🏾‍♂️",
  actual: "🤸🏾♂"
}, {
  expected: "🤸🏿‍♂️",
  actual: "🤸🏿♂"
}, {
  expected: "🤸🏻‍♀️",
  actual: "🤸🏻♀"
}, {
  expected: "🤸🏼‍♀️",
  actual: "🤸🏼♀"
}, {
  expected: "🤸🏽‍♀️",
  actual: "🤸🏽♀"
}, {
  expected: "🤸🏾‍♀️",
  actual: "🤸🏾♀"
}, {
  expected: "🤸🏿‍♀️",
  actual: "🤸🏿♀"
}, {
  expected: "🤽🏻‍♂️",
  actual: "🤽🏻♂"
}, {
  expected: "🤽🏼‍♂️",
  actual: "🤽🏼♂"
}, {
  expected: "🤽🏽‍♂️",
  actual: "🤽🏽♂"
}, {
  expected: "🤽🏾‍♂️",
  actual: "🤽🏾♂"
}, {
  expected: "🤽🏿‍♂️",
  actual: "🤽🏿♂"
}, {
  expected: "🤽🏻‍♀️",
  actual: "🤽🏻♀"
}, {
  expected: "🤽🏼‍♀️",
  actual: "🤽🏼♀"
}, {
  expected: "🤽🏽‍♀️",
  actual: "🤽🏽♀"
}, {
  expected: "🤽🏾‍♀️",
  actual: "🤽🏾♀"
}, {
  expected: "🤽🏿‍♀️",
  actual: "🤽🏿♀"
}, {
  expected: "🤾🏻‍♂️",
  actual: "🤾🏻♂"
}, {
  expected: "🤾🏼‍♂️",
  actual: "🤾🏼♂"
}, {
  expected: "🤾🏽‍♂️",
  actual: "🤾🏽♂"
}, {
  expected: "🤾🏾‍♂️",
  actual: "🤾🏾♂"
}, {
  expected: "🤾🏿‍♂️",
  actual: "🤾🏿♂"
}, {
  expected: "🤾🏻‍♀️",
  actual: "🤾🏻♀"
}, {
  expected: "🤾🏼‍♀️",
  actual: "🤾🏼♀"
}, {
  expected: "🤾🏽‍♀️",
  actual: "🤾🏽♀"
}, {
  expected: "🤾🏾‍♀️",
  actual: "🤾🏾♀"
}, {
  expected: "🤾🏿‍♀️",
  actual: "🤾🏿♀"
}, {
  expected: "🤹🏻‍♂️",
  actual: "🤹🏻♂"
}, {
  expected: "🤹🏼‍♂️",
  actual: "🤹🏼♂"
}, {
  expected: "🤹🏽‍♂️",
  actual: "🤹🏽♂"
}, {
  expected: "🤹🏾‍♂️",
  actual: "🤹🏾♂"
}, {
  expected: "🤹🏿‍♂️",
  actual: "🤹🏿♂"
}, {
  expected: "🤹🏻‍♀️",
  actual: "🤹🏻♀"
}, {
  expected: "🤹🏼‍♀️",
  actual: "🤹🏼♀"
}, {
  expected: "🤹🏽‍♀️",
  actual: "🤹🏽♀"
}, {
  expected: "🤹🏾‍♀️",
  actual: "🤹🏾♀"
}, {
  expected: "🤹🏿‍♀️",
  actual: "🤹🏿♀"
}, {
  expected: "🧘🏻‍♂️",
  actual: "🧘🏻♂"
}, {
  expected: "🧘🏼‍♂️",
  actual: "🧘🏼♂"
}, {
  expected: "🧘🏽‍♂️",
  actual: "🧘🏽♂"
}, {
  expected: "🧘🏾‍♂️",
  actual: "🧘🏾♂"
}, {
  expected: "🧘🏿‍♂️",
  actual: "🧘🏿♂"
}, {
  expected: "🧘🏻‍♀️",
  actual: "🧘🏻♀"
}, {
  expected: "🧘🏼‍♀️",
  actual: "🧘🏼♀"
}, {
  expected: "🧘🏽‍♀️",
  actual: "🧘🏽♀"
}, {
  expected: "🧘🏾‍♀️",
  actual: "🧘🏾♀"
}, {
  expected: "🧘🏿‍♀️",
  actual: "🧘🏿♀"
}, {
  expected: "👩‍❤️‍👨",
  actual: "👩❤👨"
}, {
  expected: "👨‍❤️‍👨",
  actual: "👨❤👨"
}, {
  expected: "👩‍❤️‍👩",
  actual: "👩❤👩"
}, {
  expected: "👨‍👦",
  actual: "👨‍👦"
}, {
  expected: "👨‍👧",
  actual: "👨‍👧"
}, {
  expected: "👩‍👦",
  actual: "👩‍👦"
}, {
  expected: "👩‍👧",
  actual: "👩‍👧"
}, {
  expected: "🐕‍🦺",
  actual: "🐕‍🦺"
}, {
  expected: "🏳‍🌈",
  actual: "🏳‍🌈"
}, {
  expected: "❤‍🔥",
  actual: "❤‍🔥"
}, {
  expected: "❤‍🩹",
  actual: "❤‍🩹"
}, {
  expected: "🧔‍♂",
  actual: "🧔‍♂"
}, {
  expected: "🧔‍♀",
  actual: "🧔‍♀"
}, {
  expected: "👱‍♀",
  actual: "👱‍♀"
}, {
  expected: "👱‍♂",
  actual: "👱‍♂"
}, {
  expected: "🙍‍♂",
  actual: "🙍‍♂"
}, {
  expected: "🙍‍♀",
  actual: "🙍‍♀"
}, {
  expected: "🙎‍♂",
  actual: "🙎‍♂"
}, {
  expected: "🙎‍♀",
  actual: "🙎‍♀"
}, {
  expected: "🙅‍♂",
  actual: "🙅‍♂"
}, {
  expected: "🙅‍♀",
  actual: "🙅‍♀"
}, {
  expected: "🙆‍♂",
  actual: "🙆‍♂"
}, {
  expected: "🙆‍♀",
  actual: "🙆‍♀"
}, {
  expected: "💁‍♂",
  actual: "💁‍♂"
}, {
  expected: "💁‍♀",
  actual: "💁‍♀"
}, {
  expected: "🙋‍♂",
  actual: "🙋‍♂"
}, {
  expected: "🙋‍♀",
  actual: "🙋‍♀"
}, {
  expected: "🧏‍♂",
  actual: "🧏‍♂"
}, {
  expected: "🧏‍♀",
  actual: "🧏‍♀"
}, {
  expected: "🙇‍♂",
  actual: "🙇‍♂"
}, {
  expected: "🙇‍♀",
  actual: "🙇‍♀"
}, {
  expected: "🤦‍♂",
  actual: "🤦‍♂"
}, {
  expected: "🤦‍♀",
  actual: "🤦‍♀"
}, {
  expected: "🤷‍♂",
  actual: "🤷‍♂"
}, {
  expected: "🤷‍♀",
  actual: "🤷‍♀"
}, {
  expected: "🧑‍⚕",
  actual: "🧑‍⚕"
}, {
  expected: "👨‍⚕",
  actual: "👨‍⚕"
}, {
  expected: "👩‍⚕",
  actual: "👩‍⚕"
}, {
  expected: "🧑‍⚖",
  actual: "🧑‍⚖"
}, {
  expected: "👨‍⚖",
  actual: "👨‍⚖"
}, {
  expected: "👩‍⚖",
  actual: "👩‍⚖"
}, {
  expected: "🧑‍✈",
  actual: "🧑‍✈"
}, {
  expected: "👨‍✈",
  actual: "👨‍✈"
}, {
  expected: "👩‍✈",
  actual: "👩‍✈"
}, {
  expected: "👮‍♂",
  actual: "👮‍♂"
}, {
  expected: "👮‍♀",
  actual: "👮‍♀"
}, {
  expected: "🕵‍♂",
  actual: "🕵‍♂"
}, {
  expected: "🕵‍♀",
  actual: "🕵‍♀"
}, {
  expected: "💂‍♂",
  actual: "💂‍♂"
}, {
  expected: "💂‍♀",
  actual: "💂‍♀"
}, {
  expected: "👷‍♂",
  actual: "👷‍♂"
}, {
  expected: "👷‍♀",
  actual: "👷‍♀"
}, {
  expected: "👳‍♂",
  actual: "👳‍♂"
}, {
  expected: "👳‍♀",
  actual: "👳‍♀"
}, {
  expected: "🤵‍♂",
  actual: "🤵‍♂"
}, {
  expected: "🤵‍♀",
  actual: "🤵‍♀"
}, {
  expected: "👰‍♂",
  actual: "👰‍♂"
}, {
  expected: "👰‍♀",
  actual: "👰‍♀"
}, {
  expected: "🦸‍♂",
  actual: "🦸‍♂"
}, {
  expected: "🦸‍♀",
  actual: "🦸‍♀"
}, {
  expected: "🦹‍♂",
  actual: "🦹‍♂"
}, {
  expected: "🦹‍♀",
  actual: "🦹‍♀"
}, {
  expected: "🧙‍♂",
  actual: "🧙‍♂"
}, {
  expected: "🧙‍♀",
  actual: "🧙‍♀"
}, {
  expected: "🧚‍♂",
  actual: "🧚‍♂"
}, {
  expected: "🧚‍♀",
  actual: "🧚‍♀"
}, {
  expected: "🧛‍♂",
  actual: "🧛‍♂"
}, {
  expected: "🧛‍♀",
  actual: "🧛‍♀"
}, {
  expected: "🧜‍♂",
  actual: "🧜‍♂"
}, {
  expected: "🧜‍♀",
  actual: "🧜‍♀"
}, {
  expected: "🧝‍♂",
  actual: "🧝‍♂"
}, {
  expected: "🧝‍♀",
  actual: "🧝‍♀"
}, {
  expected: "🧞‍♂",
  actual: "🧞‍♂"
}, {
  expected: "🧞‍♀",
  actual: "🧞‍♀"
}, {
  expected: "🧟‍♂",
  actual: "🧟‍♂"
}, {
  expected: "🧟‍♀",
  actual: "🧟‍♀"
}, {
  expected: "💆‍♂",
  actual: "💆‍♂"
}, {
  expected: "💆‍♀",
  actual: "💆‍♀"
}, {
  expected: "💇‍♂",
  actual: "💇‍♂"
}, {
  expected: "💇‍♀",
  actual: "💇‍♀"
}, {
  expected: "🚶‍♂",
  actual: "🚶‍♂"
}, {
  expected: "🚶‍♀",
  actual: "🚶‍♀"
}, {
  expected: "🧍‍♂",
  actual: "🧍‍♂"
}, {
  expected: "🧍‍♀",
  actual: "🧍‍♀"
}, {
  expected: "🧎‍♂",
  actual: "🧎‍♂"
}, {
  expected: "🧎‍♀",
  actual: "🧎‍♀"
}, {
  expected: "🏃‍♂",
  actual: "🏃‍♂"
}, {
  expected: "🏃‍♀",
  actual: "🏃‍♀"
}, {
  expected: "👯‍♂",
  actual: "👯‍♂"
}, {
  expected: "👯‍♀",
  actual: "👯‍♀"
}, {
  expected: "🧖‍♂",
  actual: "🧖‍♂"
}, {
  expected: "🧖‍♀",
  actual: "🧖‍♀"
}, {
  expected: "🧗‍♂",
  actual: "🧗‍♂"
}, {
  expected: "🧗‍♀",
  actual: "🧗‍♀"
}, {
  expected: "🏌‍♂",
  actual: "🏌‍♂"
}, {
  expected: "🏌‍♀",
  actual: "🏌‍♀"
}, {
  expected: "🏄‍♂",
  actual: "🏄‍♂"
}, {
  expected: "🏄‍♀",
  actual: "🏄‍♀"
}, {
  expected: "🚣‍♂",
  actual: "🚣‍♂"
}, {
  expected: "🚣‍♀",
  actual: "🚣‍♀"
}, {
  expected: "🏊‍♂",
  actual: "🏊‍♂"
}, {
  expected: "🏊‍♀",
  actual: "🏊‍♀"
}, {
  expected: "⛹🏻‍♂️",
  actual: "⛹🏻♂"
}, {
  expected: "⛹🏼‍♂️",
  actual: "⛹🏼♂"
}, {
  expected: "⛹🏽‍♂️",
  actual: "⛹🏽♂"
}, {
  expected: "⛹🏾‍♂️",
  actual: "⛹🏾♂"
}, {
  expected: "⛹🏿‍♂️",
  actual: "⛹🏿♂"
}, {
  expected: "⛹🏻‍♀️",
  actual: "⛹🏻♀"
}, {
  expected: "⛹🏼‍♀️",
  actual: "⛹🏼♀"
}, {
  expected: "⛹🏽‍♀️",
  actual: "⛹🏽♀"
}, {
  expected: "⛹🏾‍♀️",
  actual: "⛹🏾♀"
}, {
  expected: "⛹🏿‍♀️",
  actual: "⛹🏿♀"
}, {
  expected: "🏋‍♂",
  actual: "🏋‍♂"
}, {
  expected: "🏋‍♀",
  actual: "🏋‍♀"
}, {
  expected: "🚴‍♂",
  actual: "🚴‍♂"
}, {
  expected: "🚴‍♀",
  actual: "🚴‍♀"
}, {
  expected: "🚵‍♂",
  actual: "🚵‍♂"
}, {
  expected: "🚵‍♀",
  actual: "🚵‍♀"
}, {
  expected: "🤸‍♂",
  actual: "🤸‍♂"
}, {
  expected: "🤸‍♀",
  actual: "🤸‍♀"
}, {
  expected: "🤼‍♂",
  actual: "🤼‍♂"
}, {
  expected: "🤼‍♀",
  actual: "🤼‍♀"
}, {
  expected: "🤽‍♂",
  actual: "🤽‍♂"
}, {
  expected: "🤽‍♀",
  actual: "🤽‍♀"
}, {
  expected: "🤾‍♂",
  actual: "🤾‍♂"
}, {
  expected: "🤾‍♀",
  actual: "🤾‍♀"
}, {
  expected: "🤹‍♂",
  actual: "🤹‍♂"
}, {
  expected: "🤹‍♀",
  actual: "🤹‍♀"
}, {
  expected: "🧘‍♂",
  actual: "🧘‍♂"
}, {
  expected: "🧘‍♀",
  actual: "🧘‍♀"
}, {
  expected: "🐈‍⬛",
  actual: "🐈‍⬛"
}, {
  expected: "🐻‍❄",
  actual: "🐻‍❄"
}, {
  expected: "🐦‍⬛",
  actual: "🐦‍⬛"
}, {
  expected: "🏳‍⚧",
  actual: "🏳‍⚧"
}, {
  expected: "🏴‍☠",
  actual: "🏴‍☠"
}, {
  expected: "⛹‍♂",
  actual: "⛹‍♂"
}, {
  expected: "⛹‍♀",
  actual: "⛹‍♀"
}, {
  expected: "😶‍🌫️",
  actual: "😶🌫"
}, {
  expected: "😮‍💨",
  actual: "😮💨"
}, {
  expected: "😵‍💫",
  actual: "😵💫"
}, {
  expected: "👁️‍🗨️",
  actual: "👁🗨"
}, {
  expected: "👋🏻",
  actual: "👋🏻"
}, {
  expected: "👋🏼",
  actual: "👋🏼"
}, {
  expected: "👋🏽",
  actual: "👋🏽"
}, {
  expected: "👋🏾",
  actual: "👋🏾"
}, {
  expected: "👋🏿",
  actual: "👋🏿"
}, {
  expected: "🤚🏻",
  actual: "🤚🏻"
}, {
  expected: "🤚🏼",
  actual: "🤚🏼"
}, {
  expected: "🤚🏽",
  actual: "🤚🏽"
}, {
  expected: "🤚🏾",
  actual: "🤚🏾"
}, {
  expected: "🤚🏿",
  actual: "🤚🏿"
}, {
  expected: "🖐🏻",
  actual: "🖐🏻"
}, {
  expected: "🖐🏼",
  actual: "🖐🏼"
}, {
  expected: "🖐🏽",
  actual: "🖐🏽"
}, {
  expected: "🖐🏾",
  actual: "🖐🏾"
}, {
  expected: "🖐🏿",
  actual: "🖐🏿"
}, {
  expected: "🖖🏻",
  actual: "🖖🏻"
}, {
  expected: "🖖🏼",
  actual: "🖖🏼"
}, {
  expected: "🖖🏽",
  actual: "🖖🏽"
}, {
  expected: "🖖🏾",
  actual: "🖖🏾"
}, {
  expected: "🖖🏿",
  actual: "🖖🏿"
}, {
  expected: "🫱🏻",
  actual: "🫱🏻"
}, {
  expected: "🫱🏼",
  actual: "🫱🏼"
}, {
  expected: "🫱🏽",
  actual: "🫱🏽"
}, {
  expected: "🫱🏾",
  actual: "🫱🏾"
}, {
  expected: "🫱🏿",
  actual: "🫱🏿"
}, {
  expected: "🫲🏻",
  actual: "🫲🏻"
}, {
  expected: "🫲🏼",
  actual: "🫲🏼"
}, {
  expected: "🫲🏽",
  actual: "🫲🏽"
}, {
  expected: "🫲🏾",
  actual: "🫲🏾"
}, {
  expected: "🫲🏿",
  actual: "🫲🏿"
}, {
  expected: "🫳🏻",
  actual: "🫳🏻"
}, {
  expected: "🫳🏼",
  actual: "🫳🏼"
}, {
  expected: "🫳🏽",
  actual: "🫳🏽"
}, {
  expected: "🫳🏾",
  actual: "🫳🏾"
}, {
  expected: "🫳🏿",
  actual: "🫳🏿"
}, {
  expected: "🫴🏻",
  actual: "🫴🏻"
}, {
  expected: "🫴🏼",
  actual: "🫴🏼"
}, {
  expected: "🫴🏽",
  actual: "🫴🏽"
}, {
  expected: "🫴🏾",
  actual: "🫴🏾"
}, {
  expected: "🫴🏿",
  actual: "🫴🏿"
}, {
  expected: "🫷🏻",
  actual: "🫷🏻"
}, {
  expected: "🫷🏼",
  actual: "🫷🏼"
}, {
  expected: "🫷🏽",
  actual: "🫷🏽"
}, {
  expected: "🫷🏾",
  actual: "🫷🏾"
}, {
  expected: "🫷🏿",
  actual: "🫷🏿"
}, {
  expected: "🫸🏻",
  actual: "🫸🏻"
}, {
  expected: "🫸🏼",
  actual: "🫸🏼"
}, {
  expected: "🫸🏽",
  actual: "🫸🏽"
}, {
  expected: "🫸🏾",
  actual: "🫸🏾"
}, {
  expected: "🫸🏿",
  actual: "🫸🏿"
}, {
  expected: "👌🏻",
  actual: "👌🏻"
}, {
  expected: "👌🏼",
  actual: "👌🏼"
}, {
  expected: "👌🏽",
  actual: "👌🏽"
}, {
  expected: "👌🏾",
  actual: "👌🏾"
}, {
  expected: "👌🏿",
  actual: "👌🏿"
}, {
  expected: "🤌🏻",
  actual: "🤌🏻"
}, {
  expected: "🤌🏼",
  actual: "🤌🏼"
}, {
  expected: "🤌🏽",
  actual: "🤌🏽"
}, {
  expected: "🤌🏾",
  actual: "🤌🏾"
}, {
  expected: "🤌🏿",
  actual: "🤌🏿"
}, {
  expected: "🤏🏻",
  actual: "🤏🏻"
}, {
  expected: "🤏🏼",
  actual: "🤏🏼"
}, {
  expected: "🤏🏽",
  actual: "🤏🏽"
}, {
  expected: "🤏🏾",
  actual: "🤏🏾"
}, {
  expected: "🤏🏿",
  actual: "🤏🏿"
}, {
  expected: "🤞🏻",
  actual: "🤞🏻"
}, {
  expected: "🤞🏼",
  actual: "🤞🏼"
}, {
  expected: "🤞🏽",
  actual: "🤞🏽"
}, {
  expected: "🤞🏾",
  actual: "🤞🏾"
}, {
  expected: "🤞🏿",
  actual: "🤞🏿"
}, {
  expected: "🫰🏻",
  actual: "🫰🏻"
}, {
  expected: "🫰🏼",
  actual: "🫰🏼"
}, {
  expected: "🫰🏽",
  actual: "🫰🏽"
}, {
  expected: "🫰🏾",
  actual: "🫰🏾"
}, {
  expected: "🫰🏿",
  actual: "🫰🏿"
}, {
  expected: "🤟🏻",
  actual: "🤟🏻"
}, {
  expected: "🤟🏼",
  actual: "🤟🏼"
}, {
  expected: "🤟🏽",
  actual: "🤟🏽"
}, {
  expected: "🤟🏾",
  actual: "🤟🏾"
}, {
  expected: "🤟🏿",
  actual: "🤟🏿"
}, {
  expected: "🤘🏻",
  actual: "🤘🏻"
}, {
  expected: "🤘🏼",
  actual: "🤘🏼"
}, {
  expected: "🤘🏽",
  actual: "🤘🏽"
}, {
  expected: "🤘🏾",
  actual: "🤘🏾"
}, {
  expected: "🤘🏿",
  actual: "🤘🏿"
}, {
  expected: "🤙🏻",
  actual: "🤙🏻"
}, {
  expected: "🤙🏼",
  actual: "🤙🏼"
}, {
  expected: "🤙🏽",
  actual: "🤙🏽"
}, {
  expected: "🤙🏾",
  actual: "🤙🏾"
}, {
  expected: "🤙🏿",
  actual: "🤙🏿"
}, {
  expected: "👈🏻",
  actual: "👈🏻"
}, {
  expected: "👈🏼",
  actual: "👈🏼"
}, {
  expected: "👈🏽",
  actual: "👈🏽"
}, {
  expected: "👈🏾",
  actual: "👈🏾"
}, {
  expected: "👈🏿",
  actual: "👈🏿"
}, {
  expected: "👉🏻",
  actual: "👉🏻"
}, {
  expected: "👉🏼",
  actual: "👉🏼"
}, {
  expected: "👉🏽",
  actual: "👉🏽"
}, {
  expected: "👉🏾",
  actual: "👉🏾"
}, {
  expected: "👉🏿",
  actual: "👉🏿"
}, {
  expected: "👆🏻",
  actual: "👆🏻"
}, {
  expected: "👆🏼",
  actual: "👆🏼"
}, {
  expected: "👆🏽",
  actual: "👆🏽"
}, {
  expected: "👆🏾",
  actual: "👆🏾"
}, {
  expected: "👆🏿",
  actual: "👆🏿"
}, {
  expected: "🖕🏻",
  actual: "🖕🏻"
}, {
  expected: "🖕🏼",
  actual: "🖕🏼"
}, {
  expected: "🖕🏽",
  actual: "🖕🏽"
}, {
  expected: "🖕🏾",
  actual: "🖕🏾"
}, {
  expected: "🖕🏿",
  actual: "🖕🏿"
}, {
  expected: "👇🏻",
  actual: "👇🏻"
}, {
  expected: "👇🏼",
  actual: "👇🏼"
}, {
  expected: "👇🏽",
  actual: "👇🏽"
}, {
  expected: "👇🏾",
  actual: "👇🏾"
}, {
  expected: "👇🏿",
  actual: "👇🏿"
}, {
  expected: "🫵🏻",
  actual: "🫵🏻"
}, {
  expected: "🫵🏼",
  actual: "🫵🏼"
}, {
  expected: "🫵🏽",
  actual: "🫵🏽"
}, {
  expected: "🫵🏾",
  actual: "🫵🏾"
}, {
  expected: "🫵🏿",
  actual: "🫵🏿"
}, {
  expected: "👍🏻",
  actual: "👍🏻"
}, {
  expected: "👍🏼",
  actual: "👍🏼"
}, {
  expected: "👍🏽",
  actual: "👍🏽"
}, {
  expected: "👍🏾",
  actual: "👍🏾"
}, {
  expected: "👍🏿",
  actual: "👍🏿"
}, {
  expected: "👎🏻",
  actual: "👎🏻"
}, {
  expected: "👎🏼",
  actual: "👎🏼"
}, {
  expected: "👎🏽",
  actual: "👎🏽"
}, {
  expected: "👎🏾",
  actual: "👎🏾"
}, {
  expected: "👎🏿",
  actual: "👎🏿"
}, {
  expected: "👊🏻",
  actual: "👊🏻"
}, {
  expected: "👊🏼",
  actual: "👊🏼"
}, {
  expected: "👊🏽",
  actual: "👊🏽"
}, {
  expected: "👊🏾",
  actual: "👊🏾"
}, {
  expected: "👊🏿",
  actual: "👊🏿"
}, {
  expected: "🤛🏻",
  actual: "🤛🏻"
}, {
  expected: "🤛🏼",
  actual: "🤛🏼"
}, {
  expected: "🤛🏽",
  actual: "🤛🏽"
}, {
  expected: "🤛🏾",
  actual: "🤛🏾"
}, {
  expected: "🤛🏿",
  actual: "🤛🏿"
}, {
  expected: "🤜🏻",
  actual: "🤜🏻"
}, {
  expected: "🤜🏼",
  actual: "🤜🏼"
}, {
  expected: "🤜🏽",
  actual: "🤜🏽"
}, {
  expected: "🤜🏾",
  actual: "🤜🏾"
}, {
  expected: "🤜🏿",
  actual: "🤜🏿"
}, {
  expected: "👏🏻",
  actual: "👏🏻"
}, {
  expected: "👏🏼",
  actual: "👏🏼"
}, {
  expected: "👏🏽",
  actual: "👏🏽"
}, {
  expected: "👏🏾",
  actual: "👏🏾"
}, {
  expected: "👏🏿",
  actual: "👏🏿"
}, {
  expected: "🙌🏻",
  actual: "🙌🏻"
}, {
  expected: "🙌🏼",
  actual: "🙌🏼"
}, {
  expected: "🙌🏽",
  actual: "🙌🏽"
}, {
  expected: "🙌🏾",
  actual: "🙌🏾"
}, {
  expected: "🙌🏿",
  actual: "🙌🏿"
}, {
  expected: "🫶🏻",
  actual: "🫶🏻"
}, {
  expected: "🫶🏼",
  actual: "🫶🏼"
}, {
  expected: "🫶🏽",
  actual: "🫶🏽"
}, {
  expected: "🫶🏾",
  actual: "🫶🏾"
}, {
  expected: "🫶🏿",
  actual: "🫶🏿"
}, {
  expected: "👐🏻",
  actual: "👐🏻"
}, {
  expected: "👐🏼",
  actual: "👐🏼"
}, {
  expected: "👐🏽",
  actual: "👐🏽"
}, {
  expected: "👐🏾",
  actual: "👐🏾"
}, {
  expected: "👐🏿",
  actual: "👐🏿"
}, {
  expected: "🤲🏻",
  actual: "🤲🏻"
}, {
  expected: "🤲🏼",
  actual: "🤲🏼"
}, {
  expected: "🤲🏽",
  actual: "🤲🏽"
}, {
  expected: "🤲🏾",
  actual: "🤲🏾"
}, {
  expected: "🤲🏿",
  actual: "🤲🏿"
}, {
  expected: "🤝🏻",
  actual: "🤝🏻"
}, {
  expected: "🤝🏼",
  actual: "🤝🏼"
}, {
  expected: "🤝🏽",
  actual: "🤝🏽"
}, {
  expected: "🤝🏾",
  actual: "🤝🏾"
}, {
  expected: "🤝🏿",
  actual: "🤝🏿"
}, {
  expected: "🙏🏻",
  actual: "🙏🏻"
}, {
  expected: "🙏🏼",
  actual: "🙏🏼"
}, {
  expected: "🙏🏽",
  actual: "🙏🏽"
}, {
  expected: "🙏🏾",
  actual: "🙏🏾"
}, {
  expected: "🙏🏿",
  actual: "🙏🏿"
}, {
  expected: "💅🏻",
  actual: "💅🏻"
}, {
  expected: "💅🏼",
  actual: "💅🏼"
}, {
  expected: "💅🏽",
  actual: "💅🏽"
}, {
  expected: "💅🏾",
  actual: "💅🏾"
}, {
  expected: "💅🏿",
  actual: "💅🏿"
}, {
  expected: "🤳🏻",
  actual: "🤳🏻"
}, {
  expected: "🤳🏼",
  actual: "🤳🏼"
}, {
  expected: "🤳🏽",
  actual: "🤳🏽"
}, {
  expected: "🤳🏾",
  actual: "🤳🏾"
}, {
  expected: "🤳🏿",
  actual: "🤳🏿"
}, {
  expected: "💪🏻",
  actual: "💪🏻"
}, {
  expected: "💪🏼",
  actual: "💪🏼"
}, {
  expected: "💪🏽",
  actual: "💪🏽"
}, {
  expected: "💪🏾",
  actual: "💪🏾"
}, {
  expected: "💪🏿",
  actual: "💪🏿"
}, {
  expected: "🦵🏻",
  actual: "🦵🏻"
}, {
  expected: "🦵🏼",
  actual: "🦵🏼"
}, {
  expected: "🦵🏽",
  actual: "🦵🏽"
}, {
  expected: "🦵🏾",
  actual: "🦵🏾"
}, {
  expected: "🦵🏿",
  actual: "🦵🏿"
}, {
  expected: "🦶🏻",
  actual: "🦶🏻"
}, {
  expected: "🦶🏼",
  actual: "🦶🏼"
}, {
  expected: "🦶🏽",
  actual: "🦶🏽"
}, {
  expected: "🦶🏾",
  actual: "🦶🏾"
}, {
  expected: "🦶🏿",
  actual: "🦶🏿"
}, {
  expected: "👂🏻",
  actual: "👂🏻"
}, {
  expected: "👂🏼",
  actual: "👂🏼"
}, {
  expected: "👂🏽",
  actual: "👂🏽"
}, {
  expected: "👂🏾",
  actual: "👂🏾"
}, {
  expected: "👂🏿",
  actual: "👂🏿"
}, {
  expected: "🦻🏻",
  actual: "🦻🏻"
}, {
  expected: "🦻🏼",
  actual: "🦻🏼"
}, {
  expected: "🦻🏽",
  actual: "🦻🏽"
}, {
  expected: "🦻🏾",
  actual: "🦻🏾"
}, {
  expected: "🦻🏿",
  actual: "🦻🏿"
}, {
  expected: "👃🏻",
  actual: "👃🏻"
}, {
  expected: "👃🏼",
  actual: "👃🏼"
}, {
  expected: "👃🏽",
  actual: "👃🏽"
}, {
  expected: "👃🏾",
  actual: "👃🏾"
}, {
  expected: "👃🏿",
  actual: "👃🏿"
}, {
  expected: "👶🏻",
  actual: "👶🏻"
}, {
  expected: "👶🏼",
  actual: "👶🏼"
}, {
  expected: "👶🏽",
  actual: "👶🏽"
}, {
  expected: "👶🏾",
  actual: "👶🏾"
}, {
  expected: "👶🏿",
  actual: "👶🏿"
}, {
  expected: "🧒🏻",
  actual: "🧒🏻"
}, {
  expected: "🧒🏼",
  actual: "🧒🏼"
}, {
  expected: "🧒🏽",
  actual: "🧒🏽"
}, {
  expected: "🧒🏾",
  actual: "🧒🏾"
}, {
  expected: "🧒🏿",
  actual: "🧒🏿"
}, {
  expected: "👦🏻",
  actual: "👦🏻"
}, {
  expected: "👦🏼",
  actual: "👦🏼"
}, {
  expected: "👦🏽",
  actual: "👦🏽"
}, {
  expected: "👦🏾",
  actual: "👦🏾"
}, {
  expected: "👦🏿",
  actual: "👦🏿"
}, {
  expected: "👧🏻",
  actual: "👧🏻"
}, {
  expected: "👧🏼",
  actual: "👧🏼"
}, {
  expected: "👧🏽",
  actual: "👧🏽"
}, {
  expected: "👧🏾",
  actual: "👧🏾"
}, {
  expected: "👧🏿",
  actual: "👧🏿"
}, {
  expected: "🧑🏻",
  actual: "🧑🏻"
}, {
  expected: "🧑🏼",
  actual: "🧑🏼"
}, {
  expected: "🧑🏽",
  actual: "🧑🏽"
}, {
  expected: "🧑🏾",
  actual: "🧑🏾"
}, {
  expected: "🧑🏿",
  actual: "🧑🏿"
}, {
  expected: "👱🏻",
  actual: "👱🏻"
}, {
  expected: "👱🏼",
  actual: "👱🏼"
}, {
  expected: "👱🏽",
  actual: "👱🏽"
}, {
  expected: "👱🏾",
  actual: "👱🏾"
}, {
  expected: "👱🏿",
  actual: "👱🏿"
}, {
  expected: "👨🏻",
  actual: "👨🏻"
}, {
  expected: "👨🏼",
  actual: "👨🏼"
}, {
  expected: "👨🏽",
  actual: "👨🏽"
}, {
  expected: "👨🏾",
  actual: "👨🏾"
}, {
  expected: "👨🏿",
  actual: "👨🏿"
}, {
  expected: "🧔🏻",
  actual: "🧔🏻"
}, {
  expected: "🧔🏼",
  actual: "🧔🏼"
}, {
  expected: "🧔🏽",
  actual: "🧔🏽"
}, {
  expected: "🧔🏾",
  actual: "🧔🏾"
}, {
  expected: "🧔🏿",
  actual: "🧔🏿"
}, {
  expected: "👨‍🦰",
  actual: "👨🦰"
}, {
  expected: "👨‍🦱",
  actual: "👨🦱"
}, {
  expected: "👨‍🦳",
  actual: "👨🦳"
}, {
  expected: "👨‍🦲",
  actual: "👨🦲"
}, {
  expected: "👩🏻",
  actual: "👩🏻"
}, {
  expected: "👩🏼",
  actual: "👩🏼"
}, {
  expected: "👩🏽",
  actual: "👩🏽"
}, {
  expected: "👩🏾",
  actual: "👩🏾"
}, {
  expected: "👩🏿",
  actual: "👩🏿"
}, {
  expected: "👩‍🦰",
  actual: "👩🦰"
}, {
  expected: "🧑‍🦰",
  actual: "🧑🦰"
}, {
  expected: "👩‍🦱",
  actual: "👩🦱"
}, {
  expected: "🧑‍🦱",
  actual: "🧑🦱"
}, {
  expected: "👩‍🦳",
  actual: "👩🦳"
}, {
  expected: "🧑‍🦳",
  actual: "🧑🦳"
}, {
  expected: "👩‍🦲",
  actual: "👩🦲"
}, {
  expected: "🧑‍🦲",
  actual: "🧑🦲"
}, {
  expected: "🧓🏻",
  actual: "🧓🏻"
}, {
  expected: "🧓🏼",
  actual: "🧓🏼"
}, {
  expected: "🧓🏽",
  actual: "🧓🏽"
}, {
  expected: "🧓🏾",
  actual: "🧓🏾"
}, {
  expected: "🧓🏿",
  actual: "🧓🏿"
}, {
  expected: "👴🏻",
  actual: "👴🏻"
}, {
  expected: "👴🏼",
  actual: "👴🏼"
}, {
  expected: "👴🏽",
  actual: "👴🏽"
}, {
  expected: "👴🏾",
  actual: "👴🏾"
}, {
  expected: "👴🏿",
  actual: "👴🏿"
}, {
  expected: "👵🏻",
  actual: "👵🏻"
}, {
  expected: "👵🏼",
  actual: "👵🏼"
}, {
  expected: "👵🏽",
  actual: "👵🏽"
}, {
  expected: "👵🏾",
  actual: "👵🏾"
}, {
  expected: "👵🏿",
  actual: "👵🏿"
}, {
  expected: "🙍🏻",
  actual: "🙍🏻"
}, {
  expected: "🙍🏼",
  actual: "🙍🏼"
}, {
  expected: "🙍🏽",
  actual: "🙍🏽"
}, {
  expected: "🙍🏾",
  actual: "🙍🏾"
}, {
  expected: "🙍🏿",
  actual: "🙍🏿"
}, {
  expected: "🙎🏻",
  actual: "🙎🏻"
}, {
  expected: "🙎🏼",
  actual: "🙎🏼"
}, {
  expected: "🙎🏽",
  actual: "🙎🏽"
}, {
  expected: "🙎🏾",
  actual: "🙎🏾"
}, {
  expected: "🙎🏿",
  actual: "🙎🏿"
}, {
  expected: "🙅🏻",
  actual: "🙅🏻"
}, {
  expected: "🙅🏼",
  actual: "🙅🏼"
}, {
  expected: "🙅🏽",
  actual: "🙅🏽"
}, {
  expected: "🙅🏾",
  actual: "🙅🏾"
}, {
  expected: "🙅🏿",
  actual: "🙅🏿"
}, {
  expected: "🙆🏻",
  actual: "🙆🏻"
}, {
  expected: "🙆🏼",
  actual: "🙆🏼"
}, {
  expected: "🙆🏽",
  actual: "🙆🏽"
}, {
  expected: "🙆🏾",
  actual: "🙆🏾"
}, {
  expected: "🙆🏿",
  actual: "🙆🏿"
}, {
  expected: "💁🏻",
  actual: "💁🏻"
}, {
  expected: "💁🏼",
  actual: "💁🏼"
}, {
  expected: "💁🏽",
  actual: "💁🏽"
}, {
  expected: "💁🏾",
  actual: "💁🏾"
}, {
  expected: "💁🏿",
  actual: "💁🏿"
}, {
  expected: "🙋🏻",
  actual: "🙋🏻"
}, {
  expected: "🙋🏼",
  actual: "🙋🏼"
}, {
  expected: "🙋🏽",
  actual: "🙋🏽"
}, {
  expected: "🙋🏾",
  actual: "🙋🏾"
}, {
  expected: "🙋🏿",
  actual: "🙋🏿"
}, {
  expected: "🧏🏻",
  actual: "🧏🏻"
}, {
  expected: "🧏🏼",
  actual: "🧏🏼"
}, {
  expected: "🧏🏽",
  actual: "🧏🏽"
}, {
  expected: "🧏🏾",
  actual: "🧏🏾"
}, {
  expected: "🧏🏿",
  actual: "🧏🏿"
}, {
  expected: "🙇🏻",
  actual: "🙇🏻"
}, {
  expected: "🙇🏼",
  actual: "🙇🏼"
}, {
  expected: "🙇🏽",
  actual: "🙇🏽"
}, {
  expected: "🙇🏾",
  actual: "🙇🏾"
}, {
  expected: "🙇🏿",
  actual: "🙇🏿"
}, {
  expected: "🤦🏻",
  actual: "🤦🏻"
}, {
  expected: "🤦🏼",
  actual: "🤦🏼"
}, {
  expected: "🤦🏽",
  actual: "🤦🏽"
}, {
  expected: "🤦🏾",
  actual: "🤦🏾"
}, {
  expected: "🤦🏿",
  actual: "🤦🏿"
}, {
  expected: "🤷🏻",
  actual: "🤷🏻"
}, {
  expected: "🤷🏼",
  actual: "🤷🏼"
}, {
  expected: "🤷🏽",
  actual: "🤷🏽"
}, {
  expected: "🤷🏾",
  actual: "🤷🏾"
}, {
  expected: "🤷🏿",
  actual: "🤷🏿"
}, {
  expected: "🧑‍🎓",
  actual: "🧑🎓"
}, {
  expected: "👨‍🎓",
  actual: "👨🎓"
}, {
  expected: "👩‍🎓",
  actual: "👩🎓"
}, {
  expected: "🧑‍🏫",
  actual: "🧑🏫"
}, {
  expected: "👨‍🏫",
  actual: "👨🏫"
}, {
  expected: "👩‍🏫",
  actual: "👩🏫"
}, {
  expected: "🧑‍🌾",
  actual: "🧑🌾"
}, {
  expected: "👨‍🌾",
  actual: "👨🌾"
}, {
  expected: "👩‍🌾",
  actual: "👩🌾"
}, {
  expected: "🧑‍🍳",
  actual: "🧑🍳"
}, {
  expected: "👨‍🍳",
  actual: "👨🍳"
}, {
  expected: "👩‍🍳",
  actual: "👩🍳"
}, {
  expected: "🧑‍🔧",
  actual: "🧑🔧"
}, {
  expected: "👨‍🔧",
  actual: "👨🔧"
}, {
  expected: "👩‍🔧",
  actual: "👩🔧"
}, {
  expected: "🧑‍🏭",
  actual: "🧑🏭"
}, {
  expected: "👨‍🏭",
  actual: "👨🏭"
}, {
  expected: "👩‍🏭",
  actual: "👩🏭"
}, {
  expected: "🧑‍💼",
  actual: "🧑💼"
}, {
  expected: "👨‍💼",
  actual: "👨💼"
}, {
  expected: "👩‍💼",
  actual: "👩💼"
}, {
  expected: "🧑‍🔬",
  actual: "🧑🔬"
}, {
  expected: "👨‍🔬",
  actual: "👨🔬"
}, {
  expected: "👩‍🔬",
  actual: "👩🔬"
}, {
  expected: "🧑‍💻",
  actual: "🧑💻"
}, {
  expected: "👨‍💻",
  actual: "👨💻"
}, {
  expected: "👩‍💻",
  actual: "👩💻"
}, {
  expected: "🧑‍🎤",
  actual: "🧑🎤"
}, {
  expected: "👨‍🎤",
  actual: "👨🎤"
}, {
  expected: "👩‍🎤",
  actual: "👩🎤"
}, {
  expected: "🧑‍🎨",
  actual: "🧑🎨"
}, {
  expected: "👨‍🎨",
  actual: "👨🎨"
}, {
  expected: "👩‍🎨",
  actual: "👩🎨"
}, {
  expected: "🧑‍🚀",
  actual: "🧑🚀"
}, {
  expected: "👨‍🚀",
  actual: "👨🚀"
}, {
  expected: "👩‍🚀",
  actual: "👩🚀"
}, {
  expected: "🧑‍🚒",
  actual: "🧑🚒"
}, {
  expected: "👨‍🚒",
  actual: "👨🚒"
}, {
  expected: "👩‍🚒",
  actual: "👩🚒"
}, {
  expected: "👮🏻",
  actual: "👮🏻"
}, {
  expected: "👮🏼",
  actual: "👮🏼"
}, {
  expected: "👮🏽",
  actual: "👮🏽"
}, {
  expected: "👮🏾",
  actual: "👮🏾"
}, {
  expected: "👮🏿",
  actual: "👮🏿"
}, {
  expected: "🕵🏻",
  actual: "🕵🏻"
}, {
  expected: "🕵🏼",
  actual: "🕵🏼"
}, {
  expected: "🕵🏽",
  actual: "🕵🏽"
}, {
  expected: "🕵🏾",
  actual: "🕵🏾"
}, {
  expected: "🕵🏿",
  actual: "🕵🏿"
}, {
  expected: "💂🏻",
  actual: "💂🏻"
}, {
  expected: "💂🏼",
  actual: "💂🏼"
}, {
  expected: "💂🏽",
  actual: "💂🏽"
}, {
  expected: "💂🏾",
  actual: "💂🏾"
}, {
  expected: "💂🏿",
  actual: "💂🏿"
}, {
  expected: "🥷🏻",
  actual: "🥷🏻"
}, {
  expected: "🥷🏼",
  actual: "🥷🏼"
}, {
  expected: "🥷🏽",
  actual: "🥷🏽"
}, {
  expected: "🥷🏾",
  actual: "🥷🏾"
}, {
  expected: "🥷🏿",
  actual: "🥷🏿"
}, {
  expected: "👷🏻",
  actual: "👷🏻"
}, {
  expected: "👷🏼",
  actual: "👷🏼"
}, {
  expected: "👷🏽",
  actual: "👷🏽"
}, {
  expected: "👷🏾",
  actual: "👷🏾"
}, {
  expected: "👷🏿",
  actual: "👷🏿"
}, {
  expected: "🫅🏻",
  actual: "🫅🏻"
}, {
  expected: "🫅🏼",
  actual: "🫅🏼"
}, {
  expected: "🫅🏽",
  actual: "🫅🏽"
}, {
  expected: "🫅🏾",
  actual: "🫅🏾"
}, {
  expected: "🫅🏿",
  actual: "🫅🏿"
}, {
  expected: "🤴🏻",
  actual: "🤴🏻"
}, {
  expected: "🤴🏼",
  actual: "🤴🏼"
}, {
  expected: "🤴🏽",
  actual: "🤴🏽"
}, {
  expected: "🤴🏾",
  actual: "🤴🏾"
}, {
  expected: "🤴🏿",
  actual: "🤴🏿"
}, {
  expected: "👸🏻",
  actual: "👸🏻"
}, {
  expected: "👸🏼",
  actual: "👸🏼"
}, {
  expected: "👸🏽",
  actual: "👸🏽"
}, {
  expected: "👸🏾",
  actual: "👸🏾"
}, {
  expected: "👸🏿",
  actual: "👸🏿"
}, {
  expected: "👳🏻",
  actual: "👳🏻"
}, {
  expected: "👳🏼",
  actual: "👳🏼"
}, {
  expected: "👳🏽",
  actual: "👳🏽"
}, {
  expected: "👳🏾",
  actual: "👳🏾"
}, {
  expected: "👳🏿",
  actual: "👳🏿"
}, {
  expected: "👲🏻",
  actual: "👲🏻"
}, {
  expected: "👲🏼",
  actual: "👲🏼"
}, {
  expected: "👲🏽",
  actual: "👲🏽"
}, {
  expected: "👲🏾",
  actual: "👲🏾"
}, {
  expected: "👲🏿",
  actual: "👲🏿"
}, {
  expected: "🧕🏻",
  actual: "🧕🏻"
}, {
  expected: "🧕🏼",
  actual: "🧕🏼"
}, {
  expected: "🧕🏽",
  actual: "🧕🏽"
}, {
  expected: "🧕🏾",
  actual: "🧕🏾"
}, {
  expected: "🧕🏿",
  actual: "🧕🏿"
}, {
  expected: "🤵🏻",
  actual: "🤵🏻"
}, {
  expected: "🤵🏼",
  actual: "🤵🏼"
}, {
  expected: "🤵🏽",
  actual: "🤵🏽"
}, {
  expected: "🤵🏾",
  actual: "🤵🏾"
}, {
  expected: "🤵🏿",
  actual: "🤵🏿"
}, {
  expected: "👰🏻",
  actual: "👰🏻"
}, {
  expected: "👰🏼",
  actual: "👰🏼"
}, {
  expected: "👰🏽",
  actual: "👰🏽"
}, {
  expected: "👰🏾",
  actual: "👰🏾"
}, {
  expected: "👰🏿",
  actual: "👰🏿"
}, {
  expected: "🤰🏻",
  actual: "🤰🏻"
}, {
  expected: "🤰🏼",
  actual: "🤰🏼"
}, {
  expected: "🤰🏽",
  actual: "🤰🏽"
}, {
  expected: "🤰🏾",
  actual: "🤰🏾"
}, {
  expected: "🤰🏿",
  actual: "🤰🏿"
}, {
  expected: "🫃🏻",
  actual: "🫃🏻"
}, {
  expected: "🫃🏼",
  actual: "🫃🏼"
}, {
  expected: "🫃🏽",
  actual: "🫃🏽"
}, {
  expected: "🫃🏾",
  actual: "🫃🏾"
}, {
  expected: "🫃🏿",
  actual: "🫃🏿"
}, {
  expected: "🫄🏻",
  actual: "🫄🏻"
}, {
  expected: "🫄🏼",
  actual: "🫄🏼"
}, {
  expected: "🫄🏽",
  actual: "🫄🏽"
}, {
  expected: "🫄🏾",
  actual: "🫄🏾"
}, {
  expected: "🫄🏿",
  actual: "🫄🏿"
}, {
  expected: "🤱🏻",
  actual: "🤱🏻"
}, {
  expected: "🤱🏼",
  actual: "🤱🏼"
}, {
  expected: "🤱🏽",
  actual: "🤱🏽"
}, {
  expected: "🤱🏾",
  actual: "🤱🏾"
}, {
  expected: "🤱🏿",
  actual: "🤱🏿"
}, {
  expected: "👩‍🍼",
  actual: "👩🍼"
}, {
  expected: "👨‍🍼",
  actual: "👨🍼"
}, {
  expected: "🧑‍🍼",
  actual: "🧑🍼"
}, {
  expected: "👼🏻",
  actual: "👼🏻"
}, {
  expected: "👼🏼",
  actual: "👼🏼"
}, {
  expected: "👼🏽",
  actual: "👼🏽"
}, {
  expected: "👼🏾",
  actual: "👼🏾"
}, {
  expected: "👼🏿",
  actual: "👼🏿"
}, {
  expected: "🎅🏻",
  actual: "🎅🏻"
}, {
  expected: "🎅🏼",
  actual: "🎅🏼"
}, {
  expected: "🎅🏽",
  actual: "🎅🏽"
}, {
  expected: "🎅🏾",
  actual: "🎅🏾"
}, {
  expected: "🎅🏿",
  actual: "🎅🏿"
}, {
  expected: "🤶🏻",
  actual: "🤶🏻"
}, {
  expected: "🤶🏼",
  actual: "🤶🏼"
}, {
  expected: "🤶🏽",
  actual: "🤶🏽"
}, {
  expected: "🤶🏾",
  actual: "🤶🏾"
}, {
  expected: "🤶🏿",
  actual: "🤶🏿"
}, {
  expected: "🧑‍🎄",
  actual: "🧑🎄"
}, {
  expected: "🦸🏻",
  actual: "🦸🏻"
}, {
  expected: "🦸🏼",
  actual: "🦸🏼"
}, {
  expected: "🦸🏽",
  actual: "🦸🏽"
}, {
  expected: "🦸🏾",
  actual: "🦸🏾"
}, {
  expected: "🦸🏿",
  actual: "🦸🏿"
}, {
  expected: "🦹🏻",
  actual: "🦹🏻"
}, {
  expected: "🦹🏼",
  actual: "🦹🏼"
}, {
  expected: "🦹🏽",
  actual: "🦹🏽"
}, {
  expected: "🦹🏾",
  actual: "🦹🏾"
}, {
  expected: "🦹🏿",
  actual: "🦹🏿"
}, {
  expected: "🧙🏻",
  actual: "🧙🏻"
}, {
  expected: "🧙🏼",
  actual: "🧙🏼"
}, {
  expected: "🧙🏽",
  actual: "🧙🏽"
}, {
  expected: "🧙🏾",
  actual: "🧙🏾"
}, {
  expected: "🧙🏿",
  actual: "🧙🏿"
}, {
  expected: "🧚🏻",
  actual: "🧚🏻"
}, {
  expected: "🧚🏼",
  actual: "🧚🏼"
}, {
  expected: "🧚🏽",
  actual: "🧚🏽"
}, {
  expected: "🧚🏾",
  actual: "🧚🏾"
}, {
  expected: "🧚🏿",
  actual: "🧚🏿"
}, {
  expected: "🧛🏻",
  actual: "🧛🏻"
}, {
  expected: "🧛🏼",
  actual: "🧛🏼"
}, {
  expected: "🧛🏽",
  actual: "🧛🏽"
}, {
  expected: "🧛🏾",
  actual: "🧛🏾"
}, {
  expected: "🧛🏿",
  actual: "🧛🏿"
}, {
  expected: "🧜🏻",
  actual: "🧜🏻"
}, {
  expected: "🧜🏼",
  actual: "🧜🏼"
}, {
  expected: "🧜🏽",
  actual: "🧜🏽"
}, {
  expected: "🧜🏾",
  actual: "🧜🏾"
}, {
  expected: "🧜🏿",
  actual: "🧜🏿"
}, {
  expected: "🧝🏻",
  actual: "🧝🏻"
}, {
  expected: "🧝🏼",
  actual: "🧝🏼"
}, {
  expected: "🧝🏽",
  actual: "🧝🏽"
}, {
  expected: "🧝🏾",
  actual: "🧝🏾"
}, {
  expected: "🧝🏿",
  actual: "🧝🏿"
}, {
  expected: "💆🏻",
  actual: "💆🏻"
}, {
  expected: "💆🏼",
  actual: "💆🏼"
}, {
  expected: "💆🏽",
  actual: "💆🏽"
}, {
  expected: "💆🏾",
  actual: "💆🏾"
}, {
  expected: "💆🏿",
  actual: "💆🏿"
}, {
  expected: "💇🏻",
  actual: "💇🏻"
}, {
  expected: "💇🏼",
  actual: "💇🏼"
}, {
  expected: "💇🏽",
  actual: "💇🏽"
}, {
  expected: "💇🏾",
  actual: "💇🏾"
}, {
  expected: "💇🏿",
  actual: "💇🏿"
}, {
  expected: "🚶🏻",
  actual: "🚶🏻"
}, {
  expected: "🚶🏼",
  actual: "🚶🏼"
}, {
  expected: "🚶🏽",
  actual: "🚶🏽"
}, {
  expected: "🚶🏾",
  actual: "🚶🏾"
}, {
  expected: "🚶🏿",
  actual: "🚶🏿"
}, {
  expected: "🧍🏻",
  actual: "🧍🏻"
}, {
  expected: "🧍🏼",
  actual: "🧍🏼"
}, {
  expected: "🧍🏽",
  actual: "🧍🏽"
}, {
  expected: "🧍🏾",
  actual: "🧍🏾"
}, {
  expected: "🧍🏿",
  actual: "🧍🏿"
}, {
  expected: "🧎🏻",
  actual: "🧎🏻"
}, {
  expected: "🧎🏼",
  actual: "🧎🏼"
}, {
  expected: "🧎🏽",
  actual: "🧎🏽"
}, {
  expected: "🧎🏾",
  actual: "🧎🏾"
}, {
  expected: "🧎🏿",
  actual: "🧎🏿"
}, {
  expected: "🧑‍🦯",
  actual: "🧑🦯"
}, {
  expected: "👨‍🦯",
  actual: "👨🦯"
}, {
  expected: "👩‍🦯",
  actual: "👩🦯"
}, {
  expected: "🧑‍🦼",
  actual: "🧑🦼"
}, {
  expected: "👨‍🦼",
  actual: "👨🦼"
}, {
  expected: "👩‍🦼",
  actual: "👩🦼"
}, {
  expected: "🧑‍🦽",
  actual: "🧑🦽"
}, {
  expected: "👨‍🦽",
  actual: "👨🦽"
}, {
  expected: "👩‍🦽",
  actual: "👩🦽"
}, {
  expected: "🏃🏻",
  actual: "🏃🏻"
}, {
  expected: "🏃🏼",
  actual: "🏃🏼"
}, {
  expected: "🏃🏽",
  actual: "🏃🏽"
}, {
  expected: "🏃🏾",
  actual: "🏃🏾"
}, {
  expected: "🏃🏿",
  actual: "🏃🏿"
}, {
  expected: "💃🏻",
  actual: "💃🏻"
}, {
  expected: "💃🏼",
  actual: "💃🏼"
}, {
  expected: "💃🏽",
  actual: "💃🏽"
}, {
  expected: "💃🏾",
  actual: "💃🏾"
}, {
  expected: "💃🏿",
  actual: "💃🏿"
}, {
  expected: "🕺🏻",
  actual: "🕺🏻"
}, {
  expected: "🕺🏼",
  actual: "🕺🏼"
}, {
  expected: "🕺🏽",
  actual: "🕺🏽"
}, {
  expected: "🕺🏾",
  actual: "🕺🏾"
}, {
  expected: "🕺🏿",
  actual: "🕺🏿"
}, {
  expected: "🕴🏻",
  actual: "🕴🏻"
}, {
  expected: "🕴🏼",
  actual: "🕴🏼"
}, {
  expected: "🕴🏽",
  actual: "🕴🏽"
}, {
  expected: "🕴🏾",
  actual: "🕴🏾"
}, {
  expected: "🕴🏿",
  actual: "🕴🏿"
}, {
  expected: "🧖🏻",
  actual: "🧖🏻"
}, {
  expected: "🧖🏼",
  actual: "🧖🏼"
}, {
  expected: "🧖🏽",
  actual: "🧖🏽"
}, {
  expected: "🧖🏾",
  actual: "🧖🏾"
}, {
  expected: "🧖🏿",
  actual: "🧖🏿"
}, {
  expected: "🧗🏻",
  actual: "🧗🏻"
}, {
  expected: "🧗🏼",
  actual: "🧗🏼"
}, {
  expected: "🧗🏽",
  actual: "🧗🏽"
}, {
  expected: "🧗🏾",
  actual: "🧗🏾"
}, {
  expected: "🧗🏿",
  actual: "🧗🏿"
}, {
  expected: "🏇🏻",
  actual: "🏇🏻"
}, {
  expected: "🏇🏼",
  actual: "🏇🏼"
}, {
  expected: "🏇🏽",
  actual: "🏇🏽"
}, {
  expected: "🏇🏾",
  actual: "🏇🏾"
}, {
  expected: "🏇🏿",
  actual: "🏇🏿"
}, {
  expected: "🏂🏻",
  actual: "🏂🏻"
}, {
  expected: "🏂🏼",
  actual: "🏂🏼"
}, {
  expected: "🏂🏽",
  actual: "🏂🏽"
}, {
  expected: "🏂🏾",
  actual: "🏂🏾"
}, {
  expected: "🏂🏿",
  actual: "🏂🏿"
}, {
  expected: "🏌🏻",
  actual: "🏌🏻"
}, {
  expected: "🏌🏼",
  actual: "🏌🏼"
}, {
  expected: "🏌🏽",
  actual: "🏌🏽"
}, {
  expected: "🏌🏾",
  actual: "🏌🏾"
}, {
  expected: "🏌🏿",
  actual: "🏌🏿"
}, {
  expected: "🏄🏻",
  actual: "🏄🏻"
}, {
  expected: "🏄🏼",
  actual: "🏄🏼"
}, {
  expected: "🏄🏽",
  actual: "🏄🏽"
}, {
  expected: "🏄🏾",
  actual: "🏄🏾"
}, {
  expected: "🏄🏿",
  actual: "🏄🏿"
}, {
  expected: "🚣🏻",
  actual: "🚣🏻"
}, {
  expected: "🚣🏼",
  actual: "🚣🏼"
}, {
  expected: "🚣🏽",
  actual: "🚣🏽"
}, {
  expected: "🚣🏾",
  actual: "🚣🏾"
}, {
  expected: "🚣🏿",
  actual: "🚣🏿"
}, {
  expected: "🏊🏻",
  actual: "🏊🏻"
}, {
  expected: "🏊🏼",
  actual: "🏊🏼"
}, {
  expected: "🏊🏽",
  actual: "🏊🏽"
}, {
  expected: "🏊🏾",
  actual: "🏊🏾"
}, {
  expected: "🏊🏿",
  actual: "🏊🏿"
}, {
  expected: "🏋🏻",
  actual: "🏋🏻"
}, {
  expected: "🏋🏼",
  actual: "🏋🏼"
}, {
  expected: "🏋🏽",
  actual: "🏋🏽"
}, {
  expected: "🏋🏾",
  actual: "🏋🏾"
}, {
  expected: "🏋🏿",
  actual: "🏋🏿"
}, {
  expected: "🚴🏻",
  actual: "🚴🏻"
}, {
  expected: "🚴🏼",
  actual: "🚴🏼"
}, {
  expected: "🚴🏽",
  actual: "🚴🏽"
}, {
  expected: "🚴🏾",
  actual: "🚴🏾"
}, {
  expected: "🚴🏿",
  actual: "🚴🏿"
}, {
  expected: "🚵🏻",
  actual: "🚵🏻"
}, {
  expected: "🚵🏼",
  actual: "🚵🏼"
}, {
  expected: "🚵🏽",
  actual: "🚵🏽"
}, {
  expected: "🚵🏾",
  actual: "🚵🏾"
}, {
  expected: "🚵🏿",
  actual: "🚵🏿"
}, {
  expected: "🤸🏻",
  actual: "🤸🏻"
}, {
  expected: "🤸🏼",
  actual: "🤸🏼"
}, {
  expected: "🤸🏽",
  actual: "🤸🏽"
}, {
  expected: "🤸🏾",
  actual: "🤸🏾"
}, {
  expected: "🤸🏿",
  actual: "🤸🏿"
}, {
  expected: "🤽🏻",
  actual: "🤽🏻"
}, {
  expected: "🤽🏼",
  actual: "🤽🏼"
}, {
  expected: "🤽🏽",
  actual: "🤽🏽"
}, {
  expected: "🤽🏾",
  actual: "🤽🏾"
}, {
  expected: "🤽🏿",
  actual: "🤽🏿"
}, {
  expected: "🤾🏻",
  actual: "🤾🏻"
}, {
  expected: "🤾🏼",
  actual: "🤾🏼"
}, {
  expected: "🤾🏽",
  actual: "🤾🏽"
}, {
  expected: "🤾🏾",
  actual: "🤾🏾"
}, {
  expected: "🤾🏿",
  actual: "🤾🏿"
}, {
  expected: "🤹🏻",
  actual: "🤹🏻"
}, {
  expected: "🤹🏼",
  actual: "🤹🏼"
}, {
  expected: "🤹🏽",
  actual: "🤹🏽"
}, {
  expected: "🤹🏾",
  actual: "🤹🏾"
}, {
  expected: "🤹🏿",
  actual: "🤹🏿"
}, {
  expected: "🧘🏻",
  actual: "🧘🏻"
}, {
  expected: "🧘🏼",
  actual: "🧘🏼"
}, {
  expected: "🧘🏽",
  actual: "🧘🏽"
}, {
  expected: "🧘🏾",
  actual: "🧘🏾"
}, {
  expected: "🧘🏿",
  actual: "🧘🏿"
}, {
  expected: "🛀🏻",
  actual: "🛀🏻"
}, {
  expected: "🛀🏼",
  actual: "🛀🏼"
}, {
  expected: "🛀🏽",
  actual: "🛀🏽"
}, {
  expected: "🛀🏾",
  actual: "🛀🏾"
}, {
  expected: "🛀🏿",
  actual: "🛀🏿"
}, {
  expected: "🛌🏻",
  actual: "🛌🏻"
}, {
  expected: "🛌🏼",
  actual: "🛌🏼"
}, {
  expected: "🛌🏽",
  actual: "🛌🏽"
}, {
  expected: "🛌🏾",
  actual: "🛌🏾"
}, {
  expected: "🛌🏿",
  actual: "🛌🏿"
}, {
  expected: "👭🏻",
  actual: "👭🏻"
}, {
  expected: "👭🏼",
  actual: "👭🏼"
}, {
  expected: "👭🏽",
  actual: "👭🏽"
}, {
  expected: "👭🏾",
  actual: "👭🏾"
}, {
  expected: "👭🏿",
  actual: "👭🏿"
}, {
  expected: "👫🏻",
  actual: "👫🏻"
}, {
  expected: "👫🏼",
  actual: "👫🏼"
}, {
  expected: "👫🏽",
  actual: "👫🏽"
}, {
  expected: "👫🏾",
  actual: "👫🏾"
}, {
  expected: "👫🏿",
  actual: "👫🏿"
}, {
  expected: "👬🏻",
  actual: "👬🏻"
}, {
  expected: "👬🏼",
  actual: "👬🏼"
}, {
  expected: "👬🏽",
  actual: "👬🏽"
}, {
  expected: "👬🏾",
  actual: "👬🏾"
}, {
  expected: "👬🏿",
  actual: "👬🏿"
}, {
  expected: "💏🏻",
  actual: "💏🏻"
}, {
  expected: "💏🏼",
  actual: "💏🏼"
}, {
  expected: "💏🏽",
  actual: "💏🏽"
}, {
  expected: "💏🏾",
  actual: "💏🏾"
}, {
  expected: "💏🏿",
  actual: "💏🏿"
}, {
  expected: "💑🏻",
  actual: "💑🏻"
}, {
  expected: "💑🏼",
  actual: "💑🏼"
}, {
  expected: "💑🏽",
  actual: "💑🏽"
}, {
  expected: "💑🏾",
  actual: "💑🏾"
}, {
  expected: "💑🏿",
  actual: "💑🏿"
}, {
  expected: "👨‍👦",
  actual: "👨👦"
}, {
  expected: "👨‍👧",
  actual: "👨👧"
}, {
  expected: "👩‍👦",
  actual: "👩👦"
}, {
  expected: "👩‍👧",
  actual: "👩👧"
}, {
  expected: "🐕‍🦺",
  actual: "🐕🦺"
}, {
  expected: "🏳️‍🌈",
  actual: "🏳🌈"
}, {
  expected: "🇦🇨",
  actual: "🇦🇨"
}, {
  expected: "🇦🇩",
  actual: "🇦🇩"
}, {
  expected: "🇦🇪",
  actual: "🇦🇪"
}, {
  expected: "🇦🇫",
  actual: "🇦🇫"
}, {
  expected: "🇦🇬",
  actual: "🇦🇬"
}, {
  expected: "🇦🇮",
  actual: "🇦🇮"
}, {
  expected: "🇦🇱",
  actual: "🇦🇱"
}, {
  expected: "🇦🇲",
  actual: "🇦🇲"
}, {
  expected: "🇦🇴",
  actual: "🇦🇴"
}, {
  expected: "🇦🇶",
  actual: "🇦🇶"
}, {
  expected: "🇦🇷",
  actual: "🇦🇷"
}, {
  expected: "🇦🇸",
  actual: "🇦🇸"
}, {
  expected: "🇦🇹",
  actual: "🇦🇹"
}, {
  expected: "🇦🇺",
  actual: "🇦🇺"
}, {
  expected: "🇦🇼",
  actual: "🇦🇼"
}, {
  expected: "🇦🇽",
  actual: "🇦🇽"
}, {
  expected: "🇦🇿",
  actual: "🇦🇿"
}, {
  expected: "🇧🇦",
  actual: "🇧🇦"
}, {
  expected: "🇧🇧",
  actual: "🇧🇧"
}, {
  expected: "🇧🇩",
  actual: "🇧🇩"
}, {
  expected: "🇧🇪",
  actual: "🇧🇪"
}, {
  expected: "🇧🇫",
  actual: "🇧🇫"
}, {
  expected: "🇧🇬",
  actual: "🇧🇬"
}, {
  expected: "🇧🇭",
  actual: "🇧🇭"
}, {
  expected: "🇧🇮",
  actual: "🇧🇮"
}, {
  expected: "🇧🇯",
  actual: "🇧🇯"
}, {
  expected: "🇧🇱",
  actual: "🇧🇱"
}, {
  expected: "🇧🇲",
  actual: "🇧🇲"
}, {
  expected: "🇧🇳",
  actual: "🇧🇳"
}, {
  expected: "🇧🇴",
  actual: "🇧🇴"
}, {
  expected: "🇧🇶",
  actual: "🇧🇶"
}, {
  expected: "🇧🇷",
  actual: "🇧🇷"
}, {
  expected: "🇧🇸",
  actual: "🇧🇸"
}, {
  expected: "🇧🇹",
  actual: "🇧🇹"
}, {
  expected: "🇧🇻",
  actual: "🇧🇻"
}, {
  expected: "🇧🇼",
  actual: "🇧🇼"
}, {
  expected: "🇧🇾",
  actual: "🇧🇾"
}, {
  expected: "🇧🇿",
  actual: "🇧🇿"
}, {
  expected: "🇨🇦",
  actual: "🇨🇦"
}, {
  expected: "🇨🇨",
  actual: "🇨🇨"
}, {
  expected: "🇨🇩",
  actual: "🇨🇩"
}, {
  expected: "🇨🇫",
  actual: "🇨🇫"
}, {
  expected: "🇨🇬",
  actual: "🇨🇬"
}, {
  expected: "🇨🇭",
  actual: "🇨🇭"
}, {
  expected: "🇨🇮",
  actual: "🇨🇮"
}, {
  expected: "🇨🇰",
  actual: "🇨🇰"
}, {
  expected: "🇨🇱",
  actual: "🇨🇱"
}, {
  expected: "🇨🇲",
  actual: "🇨🇲"
}, {
  expected: "🇨🇳",
  actual: "🇨🇳"
}, {
  expected: "🇨🇴",
  actual: "🇨🇴"
}, {
  expected: "🇨🇵",
  actual: "🇨🇵"
}, {
  expected: "🇨🇷",
  actual: "🇨🇷"
}, {
  expected: "🇨🇺",
  actual: "🇨🇺"
}, {
  expected: "🇨🇻",
  actual: "🇨🇻"
}, {
  expected: "🇨🇼",
  actual: "🇨🇼"
}, {
  expected: "🇨🇽",
  actual: "🇨🇽"
}, {
  expected: "🇨🇾",
  actual: "🇨🇾"
}, {
  expected: "🇨🇿",
  actual: "🇨🇿"
}, {
  expected: "🇩🇪",
  actual: "🇩🇪"
}, {
  expected: "🇩🇬",
  actual: "🇩🇬"
}, {
  expected: "🇩🇯",
  actual: "🇩🇯"
}, {
  expected: "🇩🇰",
  actual: "🇩🇰"
}, {
  expected: "🇩🇲",
  actual: "🇩🇲"
}, {
  expected: "🇩🇴",
  actual: "🇩🇴"
}, {
  expected: "🇩🇿",
  actual: "🇩🇿"
}, {
  expected: "🇪🇦",
  actual: "🇪🇦"
}, {
  expected: "🇪🇨",
  actual: "🇪🇨"
}, {
  expected: "🇪🇪",
  actual: "🇪🇪"
}, {
  expected: "🇪🇬",
  actual: "🇪🇬"
}, {
  expected: "🇪🇭",
  actual: "🇪🇭"
}, {
  expected: "🇪🇷",
  actual: "🇪🇷"
}, {
  expected: "🇪🇸",
  actual: "🇪🇸"
}, {
  expected: "🇪🇹",
  actual: "🇪🇹"
}, {
  expected: "🇪🇺",
  actual: "🇪🇺"
}, {
  expected: "🇫🇮",
  actual: "🇫🇮"
}, {
  expected: "🇫🇯",
  actual: "🇫🇯"
}, {
  expected: "🇫🇰",
  actual: "🇫🇰"
}, {
  expected: "🇫🇲",
  actual: "🇫🇲"
}, {
  expected: "🇫🇴",
  actual: "🇫🇴"
}, {
  expected: "🇫🇷",
  actual: "🇫🇷"
}, {
  expected: "🇬🇦",
  actual: "🇬🇦"
}, {
  expected: "🇬🇧",
  actual: "🇬🇧"
}, {
  expected: "🇬🇩",
  actual: "🇬🇩"
}, {
  expected: "🇬🇪",
  actual: "🇬🇪"
}, {
  expected: "🇬🇫",
  actual: "🇬🇫"
}, {
  expected: "🇬🇬",
  actual: "🇬🇬"
}, {
  expected: "🇬🇭",
  actual: "🇬🇭"
}, {
  expected: "🇬🇮",
  actual: "🇬🇮"
}, {
  expected: "🇬🇱",
  actual: "🇬🇱"
}, {
  expected: "🇬🇲",
  actual: "🇬🇲"
}, {
  expected: "🇬🇳",
  actual: "🇬🇳"
}, {
  expected: "🇬🇵",
  actual: "🇬🇵"
}, {
  expected: "🇬🇶",
  actual: "🇬🇶"
}, {
  expected: "🇬🇷",
  actual: "🇬🇷"
}, {
  expected: "🇬🇸",
  actual: "🇬🇸"
}, {
  expected: "🇬🇹",
  actual: "🇬🇹"
}, {
  expected: "🇬🇺",
  actual: "🇬🇺"
}, {
  expected: "🇬🇼",
  actual: "🇬🇼"
}, {
  expected: "🇬🇾",
  actual: "🇬🇾"
}, {
  expected: "🇭🇰",
  actual: "🇭🇰"
}, {
  expected: "🇭🇲",
  actual: "🇭🇲"
}, {
  expected: "🇭🇳",
  actual: "🇭🇳"
}, {
  expected: "🇭🇷",
  actual: "🇭🇷"
}, {
  expected: "🇭🇹",
  actual: "🇭🇹"
}, {
  expected: "🇭🇺",
  actual: "🇭🇺"
}, {
  expected: "🇮🇨",
  actual: "🇮🇨"
}, {
  expected: "🇮🇩",
  actual: "🇮🇩"
}, {
  expected: "🇮🇪",
  actual: "🇮🇪"
}, {
  expected: "🇮🇱",
  actual: "🇮🇱"
}, {
  expected: "🇮🇲",
  actual: "🇮🇲"
}, {
  expected: "🇮🇳",
  actual: "🇮🇳"
}, {
  expected: "🇮🇴",
  actual: "🇮🇴"
}, {
  expected: "🇮🇶",
  actual: "🇮🇶"
}, {
  expected: "🇮🇷",
  actual: "🇮🇷"
}, {
  expected: "🇮🇸",
  actual: "🇮🇸"
}, {
  expected: "🇮🇹",
  actual: "🇮🇹"
}, {
  expected: "🇯🇪",
  actual: "🇯🇪"
}, {
  expected: "🇯🇲",
  actual: "🇯🇲"
}, {
  expected: "🇯🇴",
  actual: "🇯🇴"
}, {
  expected: "🇯🇵",
  actual: "🇯🇵"
}, {
  expected: "🇰🇪",
  actual: "🇰🇪"
}, {
  expected: "🇰🇬",
  actual: "🇰🇬"
}, {
  expected: "🇰🇭",
  actual: "🇰🇭"
}, {
  expected: "🇰🇮",
  actual: "🇰🇮"
}, {
  expected: "🇰🇲",
  actual: "🇰🇲"
}, {
  expected: "🇰🇳",
  actual: "🇰🇳"
}, {
  expected: "🇰🇵",
  actual: "🇰🇵"
}, {
  expected: "🇰🇷",
  actual: "🇰🇷"
}, {
  expected: "🇰🇼",
  actual: "🇰🇼"
}, {
  expected: "🇰🇾",
  actual: "🇰🇾"
}, {
  expected: "🇰🇿",
  actual: "🇰🇿"
}, {
  expected: "🇱🇦",
  actual: "🇱🇦"
}, {
  expected: "🇱🇧",
  actual: "🇱🇧"
}, {
  expected: "🇱🇨",
  actual: "🇱🇨"
}, {
  expected: "🇱🇮",
  actual: "🇱🇮"
}, {
  expected: "🇱🇰",
  actual: "🇱🇰"
}, {
  expected: "🇱🇷",
  actual: "🇱🇷"
}, {
  expected: "🇱🇸",
  actual: "🇱🇸"
}, {
  expected: "🇱🇹",
  actual: "🇱🇹"
}, {
  expected: "🇱🇺",
  actual: "🇱🇺"
}, {
  expected: "🇱🇻",
  actual: "🇱🇻"
}, {
  expected: "🇱🇾",
  actual: "🇱🇾"
}, {
  expected: "🇲🇦",
  actual: "🇲🇦"
}, {
  expected: "🇲🇨",
  actual: "🇲🇨"
}, {
  expected: "🇲🇩",
  actual: "🇲🇩"
}, {
  expected: "🇲🇪",
  actual: "🇲🇪"
}, {
  expected: "🇲🇫",
  actual: "🇲🇫"
}, {
  expected: "🇲🇬",
  actual: "🇲🇬"
}, {
  expected: "🇲🇭",
  actual: "🇲🇭"
}, {
  expected: "🇲🇰",
  actual: "🇲🇰"
}, {
  expected: "🇲🇱",
  actual: "🇲🇱"
}, {
  expected: "🇲🇲",
  actual: "🇲🇲"
}, {
  expected: "🇲🇳",
  actual: "🇲🇳"
}, {
  expected: "🇲🇴",
  actual: "🇲🇴"
}, {
  expected: "🇲🇵",
  actual: "🇲🇵"
}, {
  expected: "🇲🇶",
  actual: "🇲🇶"
}, {
  expected: "🇲🇷",
  actual: "🇲🇷"
}, {
  expected: "🇲🇸",
  actual: "🇲🇸"
}, {
  expected: "🇲🇹",
  actual: "🇲🇹"
}, {
  expected: "🇲🇺",
  actual: "🇲🇺"
}, {
  expected: "🇲🇻",
  actual: "🇲🇻"
}, {
  expected: "🇲🇼",
  actual: "🇲🇼"
}, {
  expected: "🇲🇽",
  actual: "🇲🇽"
}, {
  expected: "🇲🇾",
  actual: "🇲🇾"
}, {
  expected: "🇲🇿",
  actual: "🇲🇿"
}, {
  expected: "🇳🇦",
  actual: "🇳🇦"
}, {
  expected: "🇳🇨",
  actual: "🇳🇨"
}, {
  expected: "🇳🇪",
  actual: "🇳🇪"
}, {
  expected: "🇳🇫",
  actual: "🇳🇫"
}, {
  expected: "🇳🇬",
  actual: "🇳🇬"
}, {
  expected: "🇳🇮",
  actual: "🇳🇮"
}, {
  expected: "🇳🇱",
  actual: "🇳🇱"
}, {
  expected: "🇳🇴",
  actual: "🇳🇴"
}, {
  expected: "🇳🇵",
  actual: "🇳🇵"
}, {
  expected: "🇳🇷",
  actual: "🇳🇷"
}, {
  expected: "🇳🇺",
  actual: "🇳🇺"
}, {
  expected: "🇳🇿",
  actual: "🇳🇿"
}, {
  expected: "🇴🇲",
  actual: "🇴🇲"
}, {
  expected: "🇵🇦",
  actual: "🇵🇦"
}, {
  expected: "🇵🇪",
  actual: "🇵🇪"
}, {
  expected: "🇵🇫",
  actual: "🇵🇫"
}, {
  expected: "🇵🇬",
  actual: "🇵🇬"
}, {
  expected: "🇵🇭",
  actual: "🇵🇭"
}, {
  expected: "🇵🇰",
  actual: "🇵🇰"
}, {
  expected: "🇵🇱",
  actual: "🇵🇱"
}, {
  expected: "🇵🇲",
  actual: "🇵🇲"
}, {
  expected: "🇵🇳",
  actual: "🇵🇳"
}, {
  expected: "🇵🇷",
  actual: "🇵🇷"
}, {
  expected: "🇵🇸",
  actual: "🇵🇸"
}, {
  expected: "🇵🇹",
  actual: "🇵🇹"
}, {
  expected: "🇵🇼",
  actual: "🇵🇼"
}, {
  expected: "🇵🇾",
  actual: "🇵🇾"
}, {
  expected: "🇶🇦",
  actual: "🇶🇦"
}, {
  expected: "🇷🇪",
  actual: "🇷🇪"
}, {
  expected: "🇷🇴",
  actual: "🇷🇴"
}, {
  expected: "🇷🇸",
  actual: "🇷🇸"
}, {
  expected: "🇷🇺",
  actual: "🇷🇺"
}, {
  expected: "🇷🇼",
  actual: "🇷🇼"
}, {
  expected: "🇸🇦",
  actual: "🇸🇦"
}, {
  expected: "🇸🇧",
  actual: "🇸🇧"
}, {
  expected: "🇸🇨",
  actual: "🇸🇨"
}, {
  expected: "🇸🇩",
  actual: "🇸🇩"
}, {
  expected: "🇸🇪",
  actual: "🇸🇪"
}, {
  expected: "🇸🇬",
  actual: "🇸🇬"
}, {
  expected: "🇸🇭",
  actual: "🇸🇭"
}, {
  expected: "🇸🇮",
  actual: "🇸🇮"
}, {
  expected: "🇸🇯",
  actual: "🇸🇯"
}, {
  expected: "🇸🇰",
  actual: "🇸🇰"
}, {
  expected: "🇸🇱",
  actual: "🇸🇱"
}, {
  expected: "🇸🇲",
  actual: "🇸🇲"
}, {
  expected: "🇸🇳",
  actual: "🇸🇳"
}, {
  expected: "🇸🇴",
  actual: "🇸🇴"
}, {
  expected: "🇸🇷",
  actual: "🇸🇷"
}, {
  expected: "🇸🇸",
  actual: "🇸🇸"
}, {
  expected: "🇸🇹",
  actual: "🇸🇹"
}, {
  expected: "🇸🇻",
  actual: "🇸🇻"
}, {
  expected: "🇸🇽",
  actual: "🇸🇽"
}, {
  expected: "🇸🇾",
  actual: "🇸🇾"
}, {
  expected: "🇸🇿",
  actual: "🇸🇿"
}, {
  expected: "🇹🇦",
  actual: "🇹🇦"
}, {
  expected: "🇹🇨",
  actual: "🇹🇨"
}, {
  expected: "🇹🇩",
  actual: "🇹🇩"
}, {
  expected: "🇹🇫",
  actual: "🇹🇫"
}, {
  expected: "🇹🇬",
  actual: "🇹🇬"
}, {
  expected: "🇹🇭",
  actual: "🇹🇭"
}, {
  expected: "🇹🇯",
  actual: "🇹🇯"
}, {
  expected: "🇹🇰",
  actual: "🇹🇰"
}, {
  expected: "🇹🇱",
  actual: "🇹🇱"
}, {
  expected: "🇹🇲",
  actual: "🇹🇲"
}, {
  expected: "🇹🇳",
  actual: "🇹🇳"
}, {
  expected: "🇹🇴",
  actual: "🇹🇴"
}, {
  expected: "🇹🇷",
  actual: "🇹🇷"
}, {
  expected: "🇹🇹",
  actual: "🇹🇹"
}, {
  expected: "🇹🇻",
  actual: "🇹🇻"
}, {
  expected: "🇹🇼",
  actual: "🇹🇼"
}, {
  expected: "🇹🇿",
  actual: "🇹🇿"
}, {
  expected: "🇺🇦",
  actual: "🇺🇦"
}, {
  expected: "🇺🇬",
  actual: "🇺🇬"
}, {
  expected: "🇺🇲",
  actual: "🇺🇲"
}, {
  expected: "🇺🇳",
  actual: "🇺🇳"
}, {
  expected: "🇺🇸",
  actual: "🇺🇸"
}, {
  expected: "🇺🇾",
  actual: "🇺🇾"
}, {
  expected: "🇺🇿",
  actual: "🇺🇿"
}, {
  expected: "🇻🇦",
  actual: "🇻🇦"
}, {
  expected: "🇻🇨",
  actual: "🇻🇨"
}, {
  expected: "🇻🇪",
  actual: "🇻🇪"
}, {
  expected: "🇻🇬",
  actual: "🇻🇬"
}, {
  expected: "🇻🇮",
  actual: "🇻🇮"
}, {
  expected: "🇻🇳",
  actual: "🇻🇳"
}, {
  expected: "🇻🇺",
  actual: "🇻🇺"
}, {
  expected: "🇼🇫",
  actual: "🇼🇫"
}, {
  expected: "🇼🇸",
  actual: "🇼🇸"
}, {
  expected: "🇽🇰",
  actual: "🇽🇰"
}, {
  expected: "🇾🇪",
  actual: "🇾🇪"
}, {
  expected: "🇾🇹",
  actual: "🇾🇹"
}, {
  expected: "🇿🇦",
  actual: "🇿🇦"
}, {
  expected: "🇿🇲",
  actual: "🇿🇲"
}, {
  expected: "🇿🇼",
  actual: "🇿🇼"
}, {
  expected: "❤️‍🔥",
  actual: "❤🔥"
}, {
  expected: "❤️‍🩹",
  actual: "❤🩹"
}, {
  expected: "🕳️",
  actual: "🕳️"
}, {
  expected: "🗨️",
  actual: "🗨️"
}, {
  expected: "🗯️",
  actual: "🗯️"
}, {
  expected: "🖐️",
  actual: "🖐️"
}, {
  expected: "✋🏻",
  actual: "✋🏻"
}, {
  expected: "✋🏼",
  actual: "✋🏼"
}, {
  expected: "✋🏽",
  actual: "✋🏽"
}, {
  expected: "✋🏾",
  actual: "✋🏾"
}, {
  expected: "✋🏿",
  actual: "✋🏿"
}, {
  expected: "✌🏻",
  actual: "✌🏻"
}, {
  expected: "✌🏼",
  actual: "✌🏼"
}, {
  expected: "✌🏽",
  actual: "✌🏽"
}, {
  expected: "✌🏾",
  actual: "✌🏾"
}, {
  expected: "✌🏿",
  actual: "✌🏿"
}, {
  expected: "☝🏻",
  actual: "☝🏻"
}, {
  expected: "☝🏼",
  actual: "☝🏼"
}, {
  expected: "☝🏽",
  actual: "☝🏽"
}, {
  expected: "☝🏾",
  actual: "☝🏾"
}, {
  expected: "☝🏿",
  actual: "☝🏿"
}, {
  expected: "✊🏻",
  actual: "✊🏻"
}, {
  expected: "✊🏼",
  actual: "✊🏼"
}, {
  expected: "✊🏽",
  actual: "✊🏽"
}, {
  expected: "✊🏾",
  actual: "✊🏾"
}, {
  expected: "✊🏿",
  actual: "✊🏿"
}, {
  expected: "✍🏻",
  actual: "✍🏻"
}, {
  expected: "✍🏼",
  actual: "✍🏼"
}, {
  expected: "✍🏽",
  actual: "✍🏽"
}, {
  expected: "✍🏾",
  actual: "✍🏾"
}, {
  expected: "✍🏿",
  actual: "✍🏿"
}, {
  expected: "👁️",
  actual: "👁️"
}, {
  expected: "🧔‍♂️",
  actual: "🧔♂"
}, {
  expected: "🧔‍♀️",
  actual: "🧔♀"
}, {
  expected: "👱‍♀️",
  actual: "👱♀"
}, {
  expected: "👱‍♂️",
  actual: "👱♂"
}, {
  expected: "🙍‍♂️",
  actual: "🙍♂"
}, {
  expected: "🙍‍♀️",
  actual: "🙍♀"
}, {
  expected: "🙎‍♂️",
  actual: "🙎♂"
}, {
  expected: "🙎‍♀️",
  actual: "🙎♀"
}, {
  expected: "🙅‍♂️",
  actual: "🙅♂"
}, {
  expected: "🙅‍♀️",
  actual: "🙅♀"
}, {
  expected: "🙆‍♂️",
  actual: "🙆♂"
}, {
  expected: "🙆‍♀️",
  actual: "🙆♀"
}, {
  expected: "💁‍♂️",
  actual: "💁♂"
}, {
  expected: "💁‍♀️",
  actual: "💁♀"
}, {
  expected: "🙋‍♂️",
  actual: "🙋♂"
}, {
  expected: "🙋‍♀️",
  actual: "🙋♀"
}, {
  expected: "🧏‍♂️",
  actual: "🧏♂"
}, {
  expected: "🧏‍♀️",
  actual: "🧏♀"
}, {
  expected: "🙇‍♂️",
  actual: "🙇♂"
}, {
  expected: "🙇‍♀️",
  actual: "🙇♀"
}, {
  expected: "🤦‍♂️",
  actual: "🤦♂"
}, {
  expected: "🤦‍♀️",
  actual: "🤦♀"
}, {
  expected: "🤷‍♂️",
  actual: "🤷♂"
}, {
  expected: "🤷‍♀️",
  actual: "🤷♀"
}, {
  expected: "🧑‍⚕️",
  actual: "🧑⚕"
}, {
  expected: "👨‍⚕️",
  actual: "👨⚕"
}, {
  expected: "👩‍⚕️",
  actual: "👩⚕"
}, {
  expected: "🧑‍⚖️",
  actual: "🧑⚖"
}, {
  expected: "👨‍⚖️",
  actual: "👨⚖"
}, {
  expected: "👩‍⚖️",
  actual: "👩⚖"
}, {
  expected: "🧑‍✈️",
  actual: "🧑✈"
}, {
  expected: "👨‍✈️",
  actual: "👨✈"
}, {
  expected: "👩‍✈️",
  actual: "👩✈"
}, {
  expected: "👮‍♂️",
  actual: "👮♂"
}, {
  expected: "👮‍♀️",
  actual: "👮♀"
}, {
  expected: "🕵️",
  actual: "🕵️"
}, {
  expected: "🕵️‍♂️",
  actual: "🕵♂"
}, {
  expected: "🕵️‍♀️",
  actual: "🕵♀"
}, {
  expected: "💂‍♂️",
  actual: "💂♂"
}, {
  expected: "💂‍♀️",
  actual: "💂♀"
}, {
  expected: "👷‍♂️",
  actual: "👷♂"
}, {
  expected: "👷‍♀️",
  actual: "👷♀"
}, {
  expected: "👳‍♂️",
  actual: "👳♂"
}, {
  expected: "👳‍♀️",
  actual: "👳♀"
}, {
  expected: "🤵‍♂️",
  actual: "🤵♂"
}, {
  expected: "🤵‍♀️",
  actual: "🤵♀"
}, {
  expected: "👰‍♂️",
  actual: "👰♂"
}, {
  expected: "👰‍♀️",
  actual: "👰♀"
}, {
  expected: "🦸‍♂️",
  actual: "🦸♂"
}, {
  expected: "🦸‍♀️",
  actual: "🦸♀"
}, {
  expected: "🦹‍♂️",
  actual: "🦹♂"
}, {
  expected: "🦹‍♀️",
  actual: "🦹♀"
}, {
  expected: "🧙‍♂️",
  actual: "🧙♂"
}, {
  expected: "🧙‍♀️",
  actual: "🧙♀"
}, {
  expected: "🧚‍♂️",
  actual: "🧚♂"
}, {
  expected: "🧚‍♀️",
  actual: "🧚♀"
}, {
  expected: "🧛‍♂️",
  actual: "🧛♂"
}, {
  expected: "🧛‍♀️",
  actual: "🧛♀"
}, {
  expected: "🧜‍♂️",
  actual: "🧜♂"
}, {
  expected: "🧜‍♀️",
  actual: "🧜♀"
}, {
  expected: "🧝‍♂️",
  actual: "🧝♂"
}, {
  expected: "🧝‍♀️",
  actual: "🧝♀"
}, {
  expected: "🧞‍♂️",
  actual: "🧞♂"
}, {
  expected: "🧞‍♀️",
  actual: "🧞♀"
}, {
  expected: "🧟‍♂️",
  actual: "🧟♂"
}, {
  expected: "🧟‍♀️",
  actual: "🧟♀"
}, {
  expected: "💆‍♂️",
  actual: "💆♂"
}, {
  expected: "💆‍♀️",
  actual: "💆♀"
}, {
  expected: "💇‍♂️",
  actual: "💇♂"
}, {
  expected: "💇‍♀️",
  actual: "💇♀"
}, {
  expected: "🚶‍♂️",
  actual: "🚶♂"
}, {
  expected: "🚶‍♀️",
  actual: "🚶♀"
}, {
  expected: "🧍‍♂️",
  actual: "🧍♂"
}, {
  expected: "🧍‍♀️",
  actual: "🧍♀"
}, {
  expected: "🧎‍♂️",
  actual: "🧎♂"
}, {
  expected: "🧎‍♀️",
  actual: "🧎♀"
}, {
  expected: "🏃‍♂️",
  actual: "🏃♂"
}, {
  expected: "🏃‍♀️",
  actual: "🏃♀"
}, {
  expected: "🕴️",
  actual: "🕴️"
}, {
  expected: "👯‍♂️",
  actual: "👯♂"
}, {
  expected: "👯‍♀️",
  actual: "👯♀"
}, {
  expected: "🧖‍♂️",
  actual: "🧖♂"
}, {
  expected: "🧖‍♀️",
  actual: "🧖♀"
}, {
  expected: "🧗‍♂️",
  actual: "🧗♂"
}, {
  expected: "🧗‍♀️",
  actual: "🧗♀"
}, {
  expected: "🏌️",
  actual: "🏌️"
}, {
  expected: "🏌️‍♂️",
  actual: "🏌♂"
}, {
  expected: "🏌️‍♀️",
  actual: "🏌♀"
}, {
  expected: "🏄‍♂️",
  actual: "🏄♂"
}, {
  expected: "🏄‍♀️",
  actual: "🏄♀"
}, {
  expected: "🚣‍♂️",
  actual: "🚣♂"
}, {
  expected: "🚣‍♀️",
  actual: "🚣♀"
}, {
  expected: "🏊‍♂️",
  actual: "🏊♂"
}, {
  expected: "🏊‍♀️",
  actual: "🏊♀"
}, {
  expected: "⛹🏻",
  actual: "⛹🏻"
}, {
  expected: "⛹🏼",
  actual: "⛹🏼"
}, {
  expected: "⛹🏽",
  actual: "⛹🏽"
}, {
  expected: "⛹🏾",
  actual: "⛹🏾"
}, {
  expected: "⛹🏿",
  actual: "⛹🏿"
}, {
  expected: "🏋️",
  actual: "🏋️"
}, {
  expected: "🏋️‍♂️",
  actual: "🏋♂"
}, {
  expected: "🏋️‍♀️",
  actual: "🏋♀"
}, {
  expected: "🚴‍♂️",
  actual: "🚴♂"
}, {
  expected: "🚴‍♀️",
  actual: "🚴♀"
}, {
  expected: "🚵‍♂️",
  actual: "🚵♂"
}, {
  expected: "🚵‍♀️",
  actual: "🚵♀"
}, {
  expected: "🤸‍♂️",
  actual: "🤸♂"
}, {
  expected: "🤸‍♀️",
  actual: "🤸♀"
}, {
  expected: "🤼‍♂️",
  actual: "🤼♂"
}, {
  expected: "🤼‍♀️",
  actual: "🤼♀"
}, {
  expected: "🤽‍♂️",
  actual: "🤽♂"
}, {
  expected: "🤽‍♀️",
  actual: "🤽♀"
}, {
  expected: "🤾‍♂️",
  actual: "🤾♂"
}, {
  expected: "🤾‍♀️",
  actual: "🤾♀"
}, {
  expected: "🤹‍♂️",
  actual: "🤹♂"
}, {
  expected: "🤹‍♀️",
  actual: "🤹♀"
}, {
  expected: "🧘‍♂️",
  actual: "🧘♂"
}, {
  expected: "🧘‍♀️",
  actual: "🧘♀"
}, {
  expected: "🗣️",
  actual: "🗣️"
}, {
  expected: "🐈‍⬛",
  actual: "🐈⬛"
}, {
  expected: "🐿️",
  actual: "🐿️"
}, {
  expected: "🐻‍❄️",
  actual: "🐻❄"
}, {
  expected: "🕊️",
  actual: "🕊️"
}, {
  expected: "🐦‍⬛",
  actual: "🐦⬛"
}, {
  expected: "🕷️",
  actual: "🕷️"
}, {
  expected: "🕸️",
  actual: "🕸️"
}, {
  expected: "🏵️",
  actual: "🏵️"
}, {
  expected: "🌶️",
  actual: "🌶️"
}, {
  expected: "🍽️",
  actual: "🍽️"
}, {
  expected: "🗺️",
  actual: "🗺️"
}, {
  expected: "🏔️",
  actual: "🏔️"
}, {
  expected: "🏕️",
  actual: "🏕️"
}, {
  expected: "🏖️",
  actual: "🏖️"
}, {
  expected: "🏜️",
  actual: "🏜️"
}, {
  expected: "🏝️",
  actual: "🏝️"
}, {
  expected: "🏞️",
  actual: "🏞️"
}, {
  expected: "🏟️",
  actual: "🏟️"
}, {
  expected: "🏛️",
  actual: "🏛️"
}, {
  expected: "🏗️",
  actual: "🏗️"
}, {
  expected: "🏘️",
  actual: "🏘️"
}, {
  expected: "🏚️",
  actual: "🏚️"
}, {
  expected: "🏙️",
  actual: "🏙️"
}, {
  expected: "🏎️",
  actual: "🏎️"
}, {
  expected: "🏍️",
  actual: "🏍️"
}, {
  expected: "🛣️",
  actual: "🛣️"
}, {
  expected: "🛤️",
  actual: "🛤️"
}, {
  expected: "🛢️",
  actual: "🛢️"
}, {
  expected: "🛳️",
  actual: "🛳️"
}, {
  expected: "🛥️",
  actual: "🛥️"
}, {
  expected: "🛩️",
  actual: "🛩️"
}, {
  expected: "🛰️",
  actual: "🛰️"
}, {
  expected: "🛎️",
  actual: "🛎️"
}, {
  expected: "🕰️",
  actual: "🕰️"
}, {
  expected: "🌡️",
  actual: "🌡️"
}, {
  expected: "🌤️",
  actual: "🌤️"
}, {
  expected: "🌥️",
  actual: "🌥️"
}, {
  expected: "🌦️",
  actual: "🌦️"
}, {
  expected: "🌧️",
  actual: "🌧️"
}, {
  expected: "🌨️",
  actual: "🌨️"
}, {
  expected: "🌩️",
  actual: "🌩️"
}, {
  expected: "🌪️",
  actual: "🌪️"
}, {
  expected: "🌫️",
  actual: "🌫️"
}, {
  expected: "🌬️",
  actual: "🌬️"
}, {
  expected: "🎗️",
  actual: "🎗️"
}, {
  expected: "🎟️",
  actual: "🎟️"
}, {
  expected: "🎖️",
  actual: "🎖️"
}, {
  expected: "🕹️",
  actual: "🕹️"
}, {
  expected: "🖼️",
  actual: "🖼️"
}, {
  expected: "🕶️",
  actual: "🕶️"
}, {
  expected: "🛍️",
  actual: "🛍️"
}, {
  expected: "🎙️",
  actual: "🎙️"
}, {
  expected: "🎚️",
  actual: "🎚️"
}, {
  expected: "🎛️",
  actual: "🎛️"
}, {
  expected: "🖥️",
  actual: "🖥️"
}, {
  expected: "🖨️",
  actual: "🖨️"
}, {
  expected: "🖱️",
  actual: "🖱️"
}, {
  expected: "🖲️",
  actual: "🖲️"
}, {
  expected: "🎞️",
  actual: "🎞️"
}, {
  expected: "📽️",
  actual: "📽️"
}, {
  expected: "🕯️",
  actual: "🕯️"
}, {
  expected: "🗞️",
  actual: "🗞️"
}, {
  expected: "🏷️",
  actual: "🏷️"
}, {
  expected: "🗳️",
  actual: "🗳️"
}, {
  expected: "🖋️",
  actual: "🖋️"
}, {
  expected: "🖊️",
  actual: "🖊️"
}, {
  expected: "🖌️",
  actual: "🖌️"
}, {
  expected: "🖍️",
  actual: "🖍️"
}, {
  expected: "🗂️",
  actual: "🗂️"
}, {
  expected: "🗒️",
  actual: "🗒️"
}, {
  expected: "🗓️",
  actual: "🗓️"
}, {
  expected: "🖇️",
  actual: "🖇️"
}, {
  expected: "🗃️",
  actual: "🗃️"
}, {
  expected: "🗄️",
  actual: "🗄️"
}, {
  expected: "🗑️",
  actual: "🗑️"
}, {
  expected: "🗝️",
  actual: "🗝️"
}, {
  expected: "🛠️",
  actual: "🛠️"
}, {
  expected: "🗡️",
  actual: "🗡️"
}, {
  expected: "🛡️",
  actual: "🛡️"
}, {
  expected: "🗜️",
  actual: "🗜️"
}, {
  expected: "🛏️",
  actual: "🛏️"
}, {
  expected: "🛋️",
  actual: "🛋️"
}, {
  expected: "🕉️",
  actual: "🕉️"
}, {
  expected: "#️⃣",
  actual: "#️⃣"
}, {
  expected: "*️⃣",
  actual: "*️⃣"
}, {
  expected: "0️⃣",
  actual: "0️⃣"
}, {
  expected: "1️⃣",
  actual: "1️⃣"
}, {
  expected: "2️⃣",
  actual: "2️⃣"
}, {
  expected: "3️⃣",
  actual: "3️⃣"
}, {
  expected: "4️⃣",
  actual: "4️⃣"
}, {
  expected: "5️⃣",
  actual: "5️⃣"
}, {
  expected: "6️⃣",
  actual: "6️⃣"
}, {
  expected: "7️⃣",
  actual: "7️⃣"
}, {
  expected: "8️⃣",
  actual: "8️⃣"
}, {
  expected: "9️⃣",
  actual: "9️⃣"
}, {
  expected: "🅰️",
  actual: "🅰️"
}, {
  expected: "🅱️",
  actual: "🅱️"
}, {
  expected: "🅾️",
  actual: "🅾️"
}, {
  expected: "🅿️",
  actual: "🅿️"
}, {
  expected: "🈂️",
  actual: "🈂️"
}, {
  expected: "🈷️",
  actual: "🈷️"
}, {
  expected: "🏳️",
  actual: "🏳️"
}, {
  expected: "🏳️‍⚧️",
  actual: "🏳⚧"
}, {
  expected: "🏴‍☠️",
  actual: "🏴☠"
}, {
  expected: "☺️",
  actual: "☺️"
}, {
  expected: "☹️",
  actual: "☹️"
}, {
  expected: "☠️",
  actual: "☠️"
}, {
  expected: "❣️",
  actual: "❣️"
}, {
  expected: "❤️",
  actual: "❤️"
}, {
  expected: "✌️",
  actual: "✌️"
}, {
  expected: "☝️",
  actual: "☝️"
}, {
  expected: "✍️",
  actual: "✍️"
}, {
  expected: "⛷️",
  actual: "⛷️"
}, {
  expected: "⛹️",
  actual: "⛹️"
}, {
  expected: "⛹️‍♂️",
  actual: "⛹♂"
}, {
  expected: "⛹️‍♀️",
  actual: "⛹♀"
}, {
  expected: "☘️",
  actual: "☘️"
}, {
  expected: "⛰️",
  actual: "⛰️"
}, {
  expected: "⛩️",
  actual: "⛩️"
}, {
  expected: "♨️",
  actual: "♨️"
}, {
  expected: "⛴️",
  actual: "⛴️"
}, {
  expected: "✈️",
  actual: "✈️"
}, {
  expected: "⏱️",
  actual: "⏱️"
}, {
  expected: "⏲️",
  actual: "⏲️"
}, {
  expected: "☀️",
  actual: "☀️"
}, {
  expected: "☁️",
  actual: "☁️"
}, {
  expected: "⛈️",
  actual: "⛈️"
}, {
  expected: "☂️",
  actual: "☂️"
}, {
  expected: "⛱️",
  actual: "⛱️"
}, {
  expected: "❄️",
  actual: "❄️"
}, {
  expected: "☃️",
  actual: "☃️"
}, {
  expected: "☄️",
  actual: "☄️"
}, {
  expected: "⛸️",
  actual: "⛸️"
}, {
  expected: "♠️",
  actual: "♠️"
}, {
  expected: "♥️",
  actual: "♥️"
}, {
  expected: "♦️",
  actual: "♦️"
}, {
  expected: "♣️",
  actual: "♣️"
}, {
  expected: "♟️",
  actual: "♟️"
}, {
  expected: "⛑️",
  actual: "⛑️"
}, {
  expected: "☎️",
  actual: "☎️"
}, {
  expected: "⌨️",
  actual: "⌨️"
}, {
  expected: "✉️",
  actual: "✉️"
}, {
  expected: "✏️",
  actual: "✏️"
}, {
  expected: "✒️",
  actual: "✒️"
}, {
  expected: "✂️",
  actual: "✂️"
}, {
  expected: "⛏️",
  actual: "⛏️"
}, {
  expected: "⚒️",
  actual: "⚒️"
}, {
  expected: "⚔️",
  actual: "⚔️"
}, {
  expected: "⚙️",
  actual: "⚙️"
}, {
  expected: "⚖️",
  actual: "⚖️"
}, {
  expected: "⛓️",
  actual: "⛓️"
}, {
  expected: "⚗️",
  actual: "⚗️"
}, {
  expected: "⚰️",
  actual: "⚰️"
}, {
  expected: "⚱️",
  actual: "⚱️"
}, {
  expected: "⚠️",
  actual: "⚠️"
}, {
  expected: "☢️",
  actual: "☢️"
}, {
  expected: "☣️",
  actual: "☣️"
}, {
  expected: "⬆️",
  actual: "⬆️"
}, {
  expected: "↗️",
  actual: "↗️"
}, {
  expected: "➡️",
  actual: "➡️"
}, {
  expected: "↘️",
  actual: "↘️"
}, {
  expected: "⬇️",
  actual: "⬇️"
}, {
  expected: "↙️",
  actual: "↙️"
}, {
  expected: "⬅️",
  actual: "⬅️"
}, {
  expected: "↖️",
  actual: "↖️"
}, {
  expected: "↕️",
  actual: "↕️"
}, {
  expected: "↔️",
  actual: "↔️"
}, {
  expected: "↩️",
  actual: "↩️"
}, {
  expected: "↪️",
  actual: "↪️"
}, {
  expected: "⤴️",
  actual: "⤴️"
}, {
  expected: "⤵️",
  actual: "⤵️"
}, {
  expected: "⚛️",
  actual: "⚛️"
}, {
  expected: "✡️",
  actual: "✡️"
}, {
  expected: "☸️",
  actual: "☸️"
}, {
  expected: "☯️",
  actual: "☯️"
}, {
  expected: "✝️",
  actual: "✝️"
}, {
  expected: "☦️",
  actual: "☦️"
}, {
  expected: "☪️",
  actual: "☪️"
}, {
  expected: "☮️",
  actual: "☮️"
}, {
  expected: "▶️",
  actual: "▶️"
}, {
  expected: "⏭️",
  actual: "⏭️"
}, {
  expected: "⏯️",
  actual: "⏯️"
}, {
  expected: "◀️",
  actual: "◀️"
}, {
  expected: "⏮️",
  actual: "⏮️"
}, {
  expected: "⏸️",
  actual: "⏸️"
}, {
  expected: "⏹️",
  actual: "⏹️"
}, {
  expected: "⏺️",
  actual: "⏺️"
}, {
  expected: "⏏️",
  actual: "⏏️"
}, {
  expected: "♀️",
  actual: "♀️"
}, {
  expected: "♂️",
  actual: "♂️"
}, {
  expected: "⚧️",
  actual: "⚧️"
}, {
  expected: "✖️",
  actual: "✖️"
}, {
  expected: "♾️",
  actual: "♾️"
}, {
  expected: "‼️",
  actual: "‼️"
}, {
  expected: "⁉️",
  actual: "⁉️"
}, {
  expected: "〰️",
  actual: "〰️"
}, {
  expected: "⚕️",
  actual: "⚕️"
}, {
  expected: "♻️",
  actual: "♻️"
}, {
  expected: "⚜️",
  actual: "⚜️"
}, {
  expected: "☑️",
  actual: "☑️"
}, {
  expected: "✔️",
  actual: "✔️"
}, {
  expected: "〽️",
  actual: "〽️"
}, {
  expected: "✳️",
  actual: "✳️"
}, {
  expected: "✴️",
  actual: "✴️"
}, {
  expected: "❇️",
  actual: "❇️"
}, {
  expected: "™️",
  actual: "™️"
}, {
  expected: "ℹ️",
  actual: "ℹ️"
}, {
  expected: "Ⓜ️",
  actual: "Ⓜ️"
}, {
  expected: "㊗️",
  actual: "㊗️"
}, {
  expected: "㊙️",
  actual: "㊙️"
}, {
  expected: "◼️",
  actual: "◼️"
}, {
  expected: "◻️",
  actual: "◻️"
}, {
  expected: "▪️",
  actual: "▪️"
}, {
  expected: "▫️",
  actual: "▫️"
}, {
  expected: "©️",
  actual: "©️"
}, {
  expected: "®️",
  actual: "®️"
}, {
  expected: "😀",
  actual: "😀"
}, {
  expected: "😃",
  actual: "😃"
}, {
  expected: "😄",
  actual: "😄"
}, {
  expected: "😁",
  actual: "😁"
}, {
  expected: "😆",
  actual: "😆"
}, {
  expected: "😅",
  actual: "😅"
}, {
  expected: "🤣",
  actual: "🤣"
}, {
  expected: "😂",
  actual: "😂"
}, {
  expected: "🙂",
  actual: "🙂"
}, {
  expected: "🙃",
  actual: "🙃"
}, {
  expected: "🫠",
  actual: "🫠"
}, {
  expected: "😉",
  actual: "😉"
}, {
  expected: "😊",
  actual: "😊"
}, {
  expected: "😇",
  actual: "😇"
}, {
  expected: "🥰",
  actual: "🥰"
}, {
  expected: "😍",
  actual: "😍"
}, {
  expected: "🤩",
  actual: "🤩"
}, {
  expected: "😘",
  actual: "😘"
}, {
  expected: "😗",
  actual: "😗"
}, {
  expected: "😚",
  actual: "😚"
}, {
  expected: "😙",
  actual: "😙"
}, {
  expected: "🥲",
  actual: "🥲"
}, {
  expected: "😋",
  actual: "😋"
}, {
  expected: "😛",
  actual: "😛"
}, {
  expected: "😜",
  actual: "😜"
}, {
  expected: "🤪",
  actual: "🤪"
}, {
  expected: "😝",
  actual: "😝"
}, {
  expected: "🤑",
  actual: "🤑"
}, {
  expected: "🤗",
  actual: "🤗"
}, {
  expected: "🤭",
  actual: "🤭"
}, {
  expected: "🫢",
  actual: "🫢"
}, {
  expected: "🫣",
  actual: "🫣"
}, {
  expected: "🤫",
  actual: "🤫"
}, {
  expected: "🤔",
  actual: "🤔"
}, {
  expected: "🫡",
  actual: "🫡"
}, {
  expected: "🤐",
  actual: "🤐"
}, {
  expected: "🤨",
  actual: "🤨"
}, {
  expected: "😐",
  actual: "😐"
}, {
  expected: "😑",
  actual: "😑"
}, {
  expected: "😶",
  actual: "😶"
}, {
  expected: "🫥",
  actual: "🫥"
}, {
  expected: "😏",
  actual: "😏"
}, {
  expected: "😒",
  actual: "😒"
}, {
  expected: "🙄",
  actual: "🙄"
}, {
  expected: "😬",
  actual: "😬"
}, {
  expected: "🤥",
  actual: "🤥"
}, {
  expected: "🫨",
  actual: "🫨"
}, {
  expected: "😌",
  actual: "😌"
}, {
  expected: "😔",
  actual: "😔"
}, {
  expected: "😪",
  actual: "😪"
}, {
  expected: "🤤",
  actual: "🤤"
}, {
  expected: "😴",
  actual: "😴"
}, {
  expected: "😷",
  actual: "😷"
}, {
  expected: "🤒",
  actual: "🤒"
}, {
  expected: "🤕",
  actual: "🤕"
}, {
  expected: "🤢",
  actual: "🤢"
}, {
  expected: "🤮",
  actual: "🤮"
}, {
  expected: "🤧",
  actual: "🤧"
}, {
  expected: "🥵",
  actual: "🥵"
}, {
  expected: "🥶",
  actual: "🥶"
}, {
  expected: "🥴",
  actual: "🥴"
}, {
  expected: "😵",
  actual: "😵"
}, {
  expected: "🤯",
  actual: "🤯"
}, {
  expected: "🤠",
  actual: "🤠"
}, {
  expected: "🥳",
  actual: "🥳"
}, {
  expected: "🥸",
  actual: "🥸"
}, {
  expected: "😎",
  actual: "😎"
}, {
  expected: "🤓",
  actual: "🤓"
}, {
  expected: "🧐",
  actual: "🧐"
}, {
  expected: "😕",
  actual: "😕"
}, {
  expected: "🫤",
  actual: "🫤"
}, {
  expected: "😟",
  actual: "😟"
}, {
  expected: "🙁",
  actual: "🙁"
}, {
  expected: "😮",
  actual: "😮"
}, {
  expected: "😯",
  actual: "😯"
}, {
  expected: "😲",
  actual: "😲"
}, {
  expected: "😳",
  actual: "😳"
}, {
  expected: "🥺",
  actual: "🥺"
}, {
  expected: "🥹",
  actual: "🥹"
}, {
  expected: "😦",
  actual: "😦"
}, {
  expected: "😧",
  actual: "😧"
}, {
  expected: "😨",
  actual: "😨"
}, {
  expected: "😰",
  actual: "😰"
}, {
  expected: "😥",
  actual: "😥"
}, {
  expected: "😢",
  actual: "😢"
}, {
  expected: "😭",
  actual: "😭"
}, {
  expected: "😱",
  actual: "😱"
}, {
  expected: "😖",
  actual: "😖"
}, {
  expected: "😣",
  actual: "😣"
}, {
  expected: "😞",
  actual: "😞"
}, {
  expected: "😓",
  actual: "😓"
}, {
  expected: "😩",
  actual: "😩"
}, {
  expected: "😫",
  actual: "😫"
}, {
  expected: "🥱",
  actual: "🥱"
}, {
  expected: "😤",
  actual: "😤"
}, {
  expected: "😡",
  actual: "😡"
}, {
  expected: "😠",
  actual: "😠"
}, {
  expected: "🤬",
  actual: "🤬"
}, {
  expected: "😈",
  actual: "😈"
}, {
  expected: "👿",
  actual: "👿"
}, {
  expected: "💀",
  actual: "💀"
}, {
  expected: "💩",
  actual: "💩"
}, {
  expected: "🤡",
  actual: "🤡"
}, {
  expected: "👹",
  actual: "👹"
}, {
  expected: "👺",
  actual: "👺"
}, {
  expected: "👻",
  actual: "👻"
}, {
  expected: "👽",
  actual: "👽"
}, {
  expected: "👾",
  actual: "👾"
}, {
  expected: "🤖",
  actual: "🤖"
}, {
  expected: "😺",
  actual: "😺"
}, {
  expected: "😸",
  actual: "😸"
}, {
  expected: "😹",
  actual: "😹"
}, {
  expected: "😻",
  actual: "😻"
}, {
  expected: "😼",
  actual: "😼"
}, {
  expected: "😽",
  actual: "😽"
}, {
  expected: "🙀",
  actual: "🙀"
}, {
  expected: "😿",
  actual: "😿"
}, {
  expected: "😾",
  actual: "😾"
}, {
  expected: "🙈",
  actual: "🙈"
}, {
  expected: "🙉",
  actual: "🙉"
}, {
  expected: "🙊",
  actual: "🙊"
}, {
  expected: "💌",
  actual: "💌"
}, {
  expected: "💘",
  actual: "💘"
}, {
  expected: "💝",
  actual: "💝"
}, {
  expected: "💖",
  actual: "💖"
}, {
  expected: "💗",
  actual: "💗"
}, {
  expected: "💓",
  actual: "💓"
}, {
  expected: "💞",
  actual: "💞"
}, {
  expected: "💕",
  actual: "💕"
}, {
  expected: "💟",
  actual: "💟"
}, {
  expected: "💔",
  actual: "💔"
}, {
  expected: "🩷",
  actual: "🩷"
}, {
  expected: "🧡",
  actual: "🧡"
}, {
  expected: "💛",
  actual: "💛"
}, {
  expected: "💚",
  actual: "💚"
}, {
  expected: "💙",
  actual: "💙"
}, {
  expected: "🩵",
  actual: "🩵"
}, {
  expected: "💜",
  actual: "💜"
}, {
  expected: "🤎",
  actual: "🤎"
}, {
  expected: "🖤",
  actual: "🖤"
}, {
  expected: "🩶",
  actual: "🩶"
}, {
  expected: "🤍",
  actual: "🤍"
}, {
  expected: "💋",
  actual: "💋"
}, {
  expected: "💯",
  actual: "💯"
}, {
  expected: "💢",
  actual: "💢"
}, {
  expected: "💥",
  actual: "💥"
}, {
  expected: "💫",
  actual: "💫"
}, {
  expected: "💦",
  actual: "💦"
}, {
  expected: "💨",
  actual: "💨"
}, {
  expected: "🕳️",
  actual: "🕳"
}, {
  expected: "🕳",
  actual: "🕳"
}, {
  expected: "💬",
  actual: "💬"
}, {
  expected: "🗨️",
  actual: "🗨"
}, {
  expected: "🗨",
  actual: "🗨"
}, {
  expected: "🗯️",
  actual: "🗯"
}, {
  expected: "🗯",
  actual: "🗯"
}, {
  expected: "💭",
  actual: "💭"
}, {
  expected: "💤",
  actual: "💤"
}, {
  expected: "👋",
  actual: "👋"
}, {
  expected: "🤚",
  actual: "🤚"
}, {
  expected: "🖐️",
  actual: "🖐"
}, {
  expected: "🖐",
  actual: "🖐"
}, {
  expected: "🖖",
  actual: "🖖"
}, {
  expected: "🫱",
  actual: "🫱"
}, {
  expected: "🫲",
  actual: "🫲"
}, {
  expected: "🫳",
  actual: "🫳"
}, {
  expected: "🫴",
  actual: "🫴"
}, {
  expected: "🫷",
  actual: "🫷"
}, {
  expected: "🫸",
  actual: "🫸"
}, {
  expected: "👌",
  actual: "👌"
}, {
  expected: "🤌",
  actual: "🤌"
}, {
  expected: "🤏",
  actual: "🤏"
}, {
  expected: "🤞",
  actual: "🤞"
}, {
  expected: "🫰",
  actual: "🫰"
}, {
  expected: "🤟",
  actual: "🤟"
}, {
  expected: "🤘",
  actual: "🤘"
}, {
  expected: "🤙",
  actual: "🤙"
}, {
  expected: "👈",
  actual: "👈"
}, {
  expected: "👉",
  actual: "👉"
}, {
  expected: "👆",
  actual: "👆"
}, {
  expected: "🖕",
  actual: "🖕"
}, {
  expected: "👇",
  actual: "👇"
}, {
  expected: "🫵",
  actual: "🫵"
}, {
  expected: "👍",
  actual: "👍"
}, {
  expected: "👎",
  actual: "👎"
}, {
  expected: "👊",
  actual: "👊"
}, {
  expected: "🤛",
  actual: "🤛"
}, {
  expected: "🤜",
  actual: "🤜"
}, {
  expected: "👏",
  actual: "👏"
}, {
  expected: "🙌",
  actual: "🙌"
}, {
  expected: "🫶",
  actual: "🫶"
}, {
  expected: "👐",
  actual: "👐"
}, {
  expected: "🤲",
  actual: "🤲"
}, {
  expected: "🤝",
  actual: "🤝"
}, {
  expected: "🙏",
  actual: "🙏"
}, {
  expected: "💅",
  actual: "💅"
}, {
  expected: "🤳",
  actual: "🤳"
}, {
  expected: "💪",
  actual: "💪"
}, {
  expected: "🦾",
  actual: "🦾"
}, {
  expected: "🦿",
  actual: "🦿"
}, {
  expected: "🦵",
  actual: "🦵"
}, {
  expected: "🦶",
  actual: "🦶"
}, {
  expected: "👂",
  actual: "👂"
}, {
  expected: "🦻",
  actual: "🦻"
}, {
  expected: "👃",
  actual: "👃"
}, {
  expected: "🧠",
  actual: "🧠"
}, {
  expected: "🫀",
  actual: "🫀"
}, {
  expected: "🫁",
  actual: "🫁"
}, {
  expected: "🦷",
  actual: "🦷"
}, {
  expected: "🦴",
  actual: "🦴"
}, {
  expected: "👀",
  actual: "👀"
}, {
  expected: "👁️",
  actual: "👁"
}, {
  expected: "👁",
  actual: "👁"
}, {
  expected: "👅",
  actual: "👅"
}, {
  expected: "👄",
  actual: "👄"
}, {
  expected: "🫦",
  actual: "🫦"
}, {
  expected: "👶",
  actual: "👶"
}, {
  expected: "🧒",
  actual: "🧒"
}, {
  expected: "👦",
  actual: "👦"
}, {
  expected: "👧",
  actual: "👧"
}, {
  expected: "🧑",
  actual: "🧑"
}, {
  expected: "👱",
  actual: "👱"
}, {
  expected: "👨",
  actual: "👨"
}, {
  expected: "🧔",
  actual: "🧔"
}, {
  expected: "👩",
  actual: "👩"
}, {
  expected: "🧓",
  actual: "🧓"
}, {
  expected: "👴",
  actual: "👴"
}, {
  expected: "👵",
  actual: "👵"
}, {
  expected: "🙍",
  actual: "🙍"
}, {
  expected: "🙎",
  actual: "🙎"
}, {
  expected: "🙅",
  actual: "🙅"
}, {
  expected: "🙆",
  actual: "🙆"
}, {
  expected: "💁",
  actual: "💁"
}, {
  expected: "🙋",
  actual: "🙋"
}, {
  expected: "🧏",
  actual: "🧏"
}, {
  expected: "🙇",
  actual: "🙇"
}, {
  expected: "🤦",
  actual: "🤦"
}, {
  expected: "🤷",
  actual: "🤷"
}, {
  expected: "👮",
  actual: "👮"
}, {
  expected: "🕵️",
  actual: "🕵"
}, {
  expected: "🕵",
  actual: "🕵"
}, {
  expected: "💂",
  actual: "💂"
}, {
  expected: "🥷",
  actual: "🥷"
}, {
  expected: "👷",
  actual: "👷"
}, {
  expected: "🫅",
  actual: "🫅"
}, {
  expected: "🤴",
  actual: "🤴"
}, {
  expected: "👸",
  actual: "👸"
}, {
  expected: "👳",
  actual: "👳"
}, {
  expected: "👲",
  actual: "👲"
}, {
  expected: "🧕",
  actual: "🧕"
}, {
  expected: "🤵",
  actual: "🤵"
}, {
  expected: "👰",
  actual: "👰"
}, {
  expected: "🤰",
  actual: "🤰"
}, {
  expected: "🫃",
  actual: "🫃"
}, {
  expected: "🫄",
  actual: "🫄"
}, {
  expected: "🤱",
  actual: "🤱"
}, {
  expected: "👼",
  actual: "👼"
}, {
  expected: "🎅",
  actual: "🎅"
}, {
  expected: "🤶",
  actual: "🤶"
}, {
  expected: "🦸",
  actual: "🦸"
}, {
  expected: "🦹",
  actual: "🦹"
}, {
  expected: "🧙",
  actual: "🧙"
}, {
  expected: "🧚",
  actual: "🧚"
}, {
  expected: "🧛",
  actual: "🧛"
}, {
  expected: "🧜",
  actual: "🧜"
}, {
  expected: "🧝",
  actual: "🧝"
}, {
  expected: "🧞",
  actual: "🧞"
}, {
  expected: "🧟",
  actual: "🧟"
}, {
  expected: "🧌",
  actual: "🧌"
}, {
  expected: "💆",
  actual: "💆"
}, {
  expected: "💇",
  actual: "💇"
}, {
  expected: "🚶",
  actual: "🚶"
}, {
  expected: "🧍",
  actual: "🧍"
}, {
  expected: "🧎",
  actual: "🧎"
}, {
  expected: "🏃",
  actual: "🏃"
}, {
  expected: "💃",
  actual: "💃"
}, {
  expected: "🕺",
  actual: "🕺"
}, {
  expected: "🕴️",
  actual: "🕴"
}, {
  expected: "🕴",
  actual: "🕴"
}, {
  expected: "👯",
  actual: "👯"
}, {
  expected: "🧖",
  actual: "🧖"
}, {
  expected: "🧗",
  actual: "🧗"
}, {
  expected: "🤺",
  actual: "🤺"
}, {
  expected: "🏇",
  actual: "🏇"
}, {
  expected: "🏂",
  actual: "🏂"
}, {
  expected: "🏌️",
  actual: "🏌"
}, {
  expected: "🏌",
  actual: "🏌"
}, {
  expected: "🏄",
  actual: "🏄"
}, {
  expected: "🚣",
  actual: "🚣"
}, {
  expected: "🏊",
  actual: "🏊"
}, {
  expected: "🏋️",
  actual: "🏋"
}, {
  expected: "🏋",
  actual: "🏋"
}, {
  expected: "🚴",
  actual: "🚴"
}, {
  expected: "🚵",
  actual: "🚵"
}, {
  expected: "🤸",
  actual: "🤸"
}, {
  expected: "🤼",
  actual: "🤼"
}, {
  expected: "🤽",
  actual: "🤽"
}, {
  expected: "🤾",
  actual: "🤾"
}, {
  expected: "🤹",
  actual: "🤹"
}, {
  expected: "🧘",
  actual: "🧘"
}, {
  expected: "🛀",
  actual: "🛀"
}, {
  expected: "🛌",
  actual: "🛌"
}, {
  expected: "👭",
  actual: "👭"
}, {
  expected: "👫",
  actual: "👫"
}, {
  expected: "👬",
  actual: "👬"
}, {
  expected: "💏",
  actual: "💏"
}, {
  expected: "💑",
  actual: "💑"
}, {
  expected: "👪",
  actual: "👪"
}, {
  expected: "🗣️",
  actual: "🗣"
}, {
  expected: "🗣",
  actual: "🗣"
}, {
  expected: "👤",
  actual: "👤"
}, {
  expected: "👥",
  actual: "👥"
}, {
  expected: "🫂",
  actual: "🫂"
}, {
  expected: "👣",
  actual: "👣"
}, {
  expected: "🐵",
  actual: "🐵"
}, {
  expected: "🐒",
  actual: "🐒"
}, {
  expected: "🦍",
  actual: "🦍"
}, {
  expected: "🦧",
  actual: "🦧"
}, {
  expected: "🐶",
  actual: "🐶"
}, {
  expected: "🐕",
  actual: "🐕"
}, {
  expected: "🦮",
  actual: "🦮"
}, {
  expected: "🐩",
  actual: "🐩"
}, {
  expected: "🐺",
  actual: "🐺"
}, {
  expected: "🦊",
  actual: "🦊"
}, {
  expected: "🦝",
  actual: "🦝"
}, {
  expected: "🐱",
  actual: "🐱"
}, {
  expected: "🐈",
  actual: "🐈"
}, {
  expected: "🦁",
  actual: "🦁"
}, {
  expected: "🐯",
  actual: "🐯"
}, {
  expected: "🐅",
  actual: "🐅"
}, {
  expected: "🐆",
  actual: "🐆"
}, {
  expected: "🐴",
  actual: "🐴"
}, {
  expected: "🫎",
  actual: "🫎"
}, {
  expected: "🫏",
  actual: "🫏"
}, {
  expected: "🐎",
  actual: "🐎"
}, {
  expected: "🦄",
  actual: "🦄"
}, {
  expected: "🦓",
  actual: "🦓"
}, {
  expected: "🦌",
  actual: "🦌"
}, {
  expected: "🦬",
  actual: "🦬"
}, {
  expected: "🐮",
  actual: "🐮"
}, {
  expected: "🐂",
  actual: "🐂"
}, {
  expected: "🐃",
  actual: "🐃"
}, {
  expected: "🐄",
  actual: "🐄"
}, {
  expected: "🐷",
  actual: "🐷"
}, {
  expected: "🐖",
  actual: "🐖"
}, {
  expected: "🐗",
  actual: "🐗"
}, {
  expected: "🐽",
  actual: "🐽"
}, {
  expected: "🐏",
  actual: "🐏"
}, {
  expected: "🐑",
  actual: "🐑"
}, {
  expected: "🐐",
  actual: "🐐"
}, {
  expected: "🐪",
  actual: "🐪"
}, {
  expected: "🐫",
  actual: "🐫"
}, {
  expected: "🦙",
  actual: "🦙"
}, {
  expected: "🦒",
  actual: "🦒"
}, {
  expected: "🐘",
  actual: "🐘"
}, {
  expected: "🦣",
  actual: "🦣"
}, {
  expected: "🦏",
  actual: "🦏"
}, {
  expected: "🦛",
  actual: "🦛"
}, {
  expected: "🐭",
  actual: "🐭"
}, {
  expected: "🐁",
  actual: "🐁"
}, {
  expected: "🐀",
  actual: "🐀"
}, {
  expected: "🐹",
  actual: "🐹"
}, {
  expected: "🐰",
  actual: "🐰"
}, {
  expected: "🐇",
  actual: "🐇"
}, {
  expected: "🐿️",
  actual: "🐿"
}, {
  expected: "🐿",
  actual: "🐿"
}, {
  expected: "🦫",
  actual: "🦫"
}, {
  expected: "🦔",
  actual: "🦔"
}, {
  expected: "🦇",
  actual: "🦇"
}, {
  expected: "🐻",
  actual: "🐻"
}, {
  expected: "🐨",
  actual: "🐨"
}, {
  expected: "🐼",
  actual: "🐼"
}, {
  expected: "🦥",
  actual: "🦥"
}, {
  expected: "🦦",
  actual: "🦦"
}, {
  expected: "🦨",
  actual: "🦨"
}, {
  expected: "🦘",
  actual: "🦘"
}, {
  expected: "🦡",
  actual: "🦡"
}, {
  expected: "🐾",
  actual: "🐾"
}, {
  expected: "🦃",
  actual: "🦃"
}, {
  expected: "🐔",
  actual: "🐔"
}, {
  expected: "🐓",
  actual: "🐓"
}, {
  expected: "🐣",
  actual: "🐣"
}, {
  expected: "🐤",
  actual: "🐤"
}, {
  expected: "🐥",
  actual: "🐥"
}, {
  expected: "🐦",
  actual: "🐦"
}, {
  expected: "🐧",
  actual: "🐧"
}, {
  expected: "🕊️",
  actual: "🕊"
}, {
  expected: "🕊",
  actual: "🕊"
}, {
  expected: "🦅",
  actual: "🦅"
}, {
  expected: "🦆",
  actual: "🦆"
}, {
  expected: "🦢",
  actual: "🦢"
}, {
  expected: "🦉",
  actual: "🦉"
}, {
  expected: "🦤",
  actual: "🦤"
}, {
  expected: "🪶",
  actual: "🪶"
}, {
  expected: "🦩",
  actual: "🦩"
}, {
  expected: "🦚",
  actual: "🦚"
}, {
  expected: "🦜",
  actual: "🦜"
}, {
  expected: "🪽",
  actual: "🪽"
}, {
  expected: "🪿",
  actual: "🪿"
}, {
  expected: "🐸",
  actual: "🐸"
}, {
  expected: "🐊",
  actual: "🐊"
}, {
  expected: "🐢",
  actual: "🐢"
}, {
  expected: "🦎",
  actual: "🦎"
}, {
  expected: "🐍",
  actual: "🐍"
}, {
  expected: "🐲",
  actual: "🐲"
}, {
  expected: "🐉",
  actual: "🐉"
}, {
  expected: "🦕",
  actual: "🦕"
}, {
  expected: "🦖",
  actual: "🦖"
}, {
  expected: "🐳",
  actual: "🐳"
}, {
  expected: "🐋",
  actual: "🐋"
}, {
  expected: "🐬",
  actual: "🐬"
}, {
  expected: "🦭",
  actual: "🦭"
}, {
  expected: "🐟",
  actual: "🐟"
}, {
  expected: "🐠",
  actual: "🐠"
}, {
  expected: "🐡",
  actual: "🐡"
}, {
  expected: "🦈",
  actual: "🦈"
}, {
  expected: "🐙",
  actual: "🐙"
}, {
  expected: "🐚",
  actual: "🐚"
}, {
  expected: "🪸",
  actual: "🪸"
}, {
  expected: "🪼",
  actual: "🪼"
}, {
  expected: "🐌",
  actual: "🐌"
}, {
  expected: "🦋",
  actual: "🦋"
}, {
  expected: "🐛",
  actual: "🐛"
}, {
  expected: "🐜",
  actual: "🐜"
}, {
  expected: "🐝",
  actual: "🐝"
}, {
  expected: "🪲",
  actual: "🪲"
}, {
  expected: "🐞",
  actual: "🐞"
}, {
  expected: "🦗",
  actual: "🦗"
}, {
  expected: "🪳",
  actual: "🪳"
}, {
  expected: "🕷️",
  actual: "🕷"
}, {
  expected: "🕷",
  actual: "🕷"
}, {
  expected: "🕸️",
  actual: "🕸"
}, {
  expected: "🕸",
  actual: "🕸"
}, {
  expected: "🦂",
  actual: "🦂"
}, {
  expected: "🦟",
  actual: "🦟"
}, {
  expected: "🪰",
  actual: "🪰"
}, {
  expected: "🪱",
  actual: "🪱"
}, {
  expected: "🦠",
  actual: "🦠"
}, {
  expected: "💐",
  actual: "💐"
}, {
  expected: "🌸",
  actual: "🌸"
}, {
  expected: "💮",
  actual: "💮"
}, {
  expected: "🪷",
  actual: "🪷"
}, {
  expected: "🏵️",
  actual: "🏵"
}, {
  expected: "🏵",
  actual: "🏵"
}, {
  expected: "🌹",
  actual: "🌹"
}, {
  expected: "🥀",
  actual: "🥀"
}, {
  expected: "🌺",
  actual: "🌺"
}, {
  expected: "🌻",
  actual: "🌻"
}, {
  expected: "🌼",
  actual: "🌼"
}, {
  expected: "🌷",
  actual: "🌷"
}, {
  expected: "🪻",
  actual: "🪻"
}, {
  expected: "🌱",
  actual: "🌱"
}, {
  expected: "🪴",
  actual: "🪴"
}, {
  expected: "🌲",
  actual: "🌲"
}, {
  expected: "🌳",
  actual: "🌳"
}, {
  expected: "🌴",
  actual: "🌴"
}, {
  expected: "🌵",
  actual: "🌵"
}, {
  expected: "🌾",
  actual: "🌾"
}, {
  expected: "🌿",
  actual: "🌿"
}, {
  expected: "🍀",
  actual: "🍀"
}, {
  expected: "🍁",
  actual: "🍁"
}, {
  expected: "🍂",
  actual: "🍂"
}, {
  expected: "🍃",
  actual: "🍃"
}, {
  expected: "🪹",
  actual: "🪹"
}, {
  expected: "🪺",
  actual: "🪺"
}, {
  expected: "🍄",
  actual: "🍄"
}, {
  expected: "🍇",
  actual: "🍇"
}, {
  expected: "🍈",
  actual: "🍈"
}, {
  expected: "🍉",
  actual: "🍉"
}, {
  expected: "🍊",
  actual: "🍊"
}, {
  expected: "🍋",
  actual: "🍋"
}, {
  expected: "🍌",
  actual: "🍌"
}, {
  expected: "🍍",
  actual: "🍍"
}, {
  expected: "🥭",
  actual: "🥭"
}, {
  expected: "🍎",
  actual: "🍎"
}, {
  expected: "🍏",
  actual: "🍏"
}, {
  expected: "🍐",
  actual: "🍐"
}, {
  expected: "🍑",
  actual: "🍑"
}, {
  expected: "🍒",
  actual: "🍒"
}, {
  expected: "🍓",
  actual: "🍓"
}, {
  expected: "🫐",
  actual: "🫐"
}, {
  expected: "🥝",
  actual: "🥝"
}, {
  expected: "🍅",
  actual: "🍅"
}, {
  expected: "🫒",
  actual: "🫒"
}, {
  expected: "🥥",
  actual: "🥥"
}, {
  expected: "🥑",
  actual: "🥑"
}, {
  expected: "🍆",
  actual: "🍆"
}, {
  expected: "🥔",
  actual: "🥔"
}, {
  expected: "🥕",
  actual: "🥕"
}, {
  expected: "🌽",
  actual: "🌽"
}, {
  expected: "🌶️",
  actual: "🌶"
}, {
  expected: "🌶",
  actual: "🌶"
}, {
  expected: "🫑",
  actual: "🫑"
}, {
  expected: "🥒",
  actual: "🥒"
}, {
  expected: "🥬",
  actual: "🥬"
}, {
  expected: "🥦",
  actual: "🥦"
}, {
  expected: "🧄",
  actual: "🧄"
}, {
  expected: "🧅",
  actual: "🧅"
}, {
  expected: "🥜",
  actual: "🥜"
}, {
  expected: "🫘",
  actual: "🫘"
}, {
  expected: "🌰",
  actual: "🌰"
}, {
  expected: "🫚",
  actual: "🫚"
}, {
  expected: "🫛",
  actual: "🫛"
}, {
  expected: "🍞",
  actual: "🍞"
}, {
  expected: "🥐",
  actual: "🥐"
}, {
  expected: "🥖",
  actual: "🥖"
}, {
  expected: "🫓",
  actual: "🫓"
}, {
  expected: "🥨",
  actual: "🥨"
}, {
  expected: "🥯",
  actual: "🥯"
}, {
  expected: "🥞",
  actual: "🥞"
}, {
  expected: "🧇",
  actual: "🧇"
}, {
  expected: "🧀",
  actual: "🧀"
}, {
  expected: "🍖",
  actual: "🍖"
}, {
  expected: "🍗",
  actual: "🍗"
}, {
  expected: "🥩",
  actual: "🥩"
}, {
  expected: "🥓",
  actual: "🥓"
}, {
  expected: "🍔",
  actual: "🍔"
}, {
  expected: "🍟",
  actual: "🍟"
}, {
  expected: "🍕",
  actual: "🍕"
}, {
  expected: "🌭",
  actual: "🌭"
}, {
  expected: "🥪",
  actual: "🥪"
}, {
  expected: "🌮",
  actual: "🌮"
}, {
  expected: "🌯",
  actual: "🌯"
}, {
  expected: "🫔",
  actual: "🫔"
}, {
  expected: "🥙",
  actual: "🥙"
}, {
  expected: "🧆",
  actual: "🧆"
}, {
  expected: "🥚",
  actual: "🥚"
}, {
  expected: "🍳",
  actual: "🍳"
}, {
  expected: "🥘",
  actual: "🥘"
}, {
  expected: "🍲",
  actual: "🍲"
}, {
  expected: "🫕",
  actual: "🫕"
}, {
  expected: "🥣",
  actual: "🥣"
}, {
  expected: "🥗",
  actual: "🥗"
}, {
  expected: "🍿",
  actual: "🍿"
}, {
  expected: "🧈",
  actual: "🧈"
}, {
  expected: "🧂",
  actual: "🧂"
}, {
  expected: "🥫",
  actual: "🥫"
}, {
  expected: "🍱",
  actual: "🍱"
}, {
  expected: "🍘",
  actual: "🍘"
}, {
  expected: "🍙",
  actual: "🍙"
}, {
  expected: "🍚",
  actual: "🍚"
}, {
  expected: "🍛",
  actual: "🍛"
}, {
  expected: "🍜",
  actual: "🍜"
}, {
  expected: "🍝",
  actual: "🍝"
}, {
  expected: "🍠",
  actual: "🍠"
}, {
  expected: "🍢",
  actual: "🍢"
}, {
  expected: "🍣",
  actual: "🍣"
}, {
  expected: "🍤",
  actual: "🍤"
}, {
  expected: "🍥",
  actual: "🍥"
}, {
  expected: "🥮",
  actual: "🥮"
}, {
  expected: "🍡",
  actual: "🍡"
}, {
  expected: "🥟",
  actual: "🥟"
}, {
  expected: "🥠",
  actual: "🥠"
}, {
  expected: "🥡",
  actual: "🥡"
}, {
  expected: "🦀",
  actual: "🦀"
}, {
  expected: "🦞",
  actual: "🦞"
}, {
  expected: "🦐",
  actual: "🦐"
}, {
  expected: "🦑",
  actual: "🦑"
}, {
  expected: "🦪",
  actual: "🦪"
}, {
  expected: "🍦",
  actual: "🍦"
}, {
  expected: "🍧",
  actual: "🍧"
}, {
  expected: "🍨",
  actual: "🍨"
}, {
  expected: "🍩",
  actual: "🍩"
}, {
  expected: "🍪",
  actual: "🍪"
}, {
  expected: "🎂",
  actual: "🎂"
}, {
  expected: "🍰",
  actual: "🍰"
}, {
  expected: "🧁",
  actual: "🧁"
}, {
  expected: "🥧",
  actual: "🥧"
}, {
  expected: "🍫",
  actual: "🍫"
}, {
  expected: "🍬",
  actual: "🍬"
}, {
  expected: "🍭",
  actual: "🍭"
}, {
  expected: "🍮",
  actual: "🍮"
}, {
  expected: "🍯",
  actual: "🍯"
}, {
  expected: "🍼",
  actual: "🍼"
}, {
  expected: "🥛",
  actual: "🥛"
}, {
  expected: "🫖",
  actual: "🫖"
}, {
  expected: "🍵",
  actual: "🍵"
}, {
  expected: "🍶",
  actual: "🍶"
}, {
  expected: "🍾",
  actual: "🍾"
}, {
  expected: "🍷",
  actual: "🍷"
}, {
  expected: "🍸",
  actual: "🍸"
}, {
  expected: "🍹",
  actual: "🍹"
}, {
  expected: "🍺",
  actual: "🍺"
}, {
  expected: "🍻",
  actual: "🍻"
}, {
  expected: "🥂",
  actual: "🥂"
}, {
  expected: "🥃",
  actual: "🥃"
}, {
  expected: "🫗",
  actual: "🫗"
}, {
  expected: "🥤",
  actual: "🥤"
}, {
  expected: "🧋",
  actual: "🧋"
}, {
  expected: "🧃",
  actual: "🧃"
}, {
  expected: "🧉",
  actual: "🧉"
}, {
  expected: "🧊",
  actual: "🧊"
}, {
  expected: "🥢",
  actual: "🥢"
}, {
  expected: "🍽️",
  actual: "🍽"
}, {
  expected: "🍽",
  actual: "🍽"
}, {
  expected: "🍴",
  actual: "🍴"
}, {
  expected: "🥄",
  actual: "🥄"
}, {
  expected: "🔪",
  actual: "🔪"
}, {
  expected: "🫙",
  actual: "🫙"
}, {
  expected: "🏺",
  actual: "🏺"
}, {
  expected: "🌍",
  actual: "🌍"
}, {
  expected: "🌎",
  actual: "🌎"
}, {
  expected: "🌏",
  actual: "🌏"
}, {
  expected: "🌐",
  actual: "🌐"
}, {
  expected: "🗺️",
  actual: "🗺"
}, {
  expected: "🗺",
  actual: "🗺"
}, {
  expected: "🗾",
  actual: "🗾"
}, {
  expected: "🧭",
  actual: "🧭"
}, {
  expected: "🏔️",
  actual: "🏔"
}, {
  expected: "🏔",
  actual: "🏔"
}, {
  expected: "🌋",
  actual: "🌋"
}, {
  expected: "🗻",
  actual: "🗻"
}, {
  expected: "🏕️",
  actual: "🏕"
}, {
  expected: "🏕",
  actual: "🏕"
}, {
  expected: "🏖️",
  actual: "🏖"
}, {
  expected: "🏖",
  actual: "🏖"
}, {
  expected: "🏜️",
  actual: "🏜"
}, {
  expected: "🏜",
  actual: "🏜"
}, {
  expected: "🏝️",
  actual: "🏝"
}, {
  expected: "🏝",
  actual: "🏝"
}, {
  expected: "🏞️",
  actual: "🏞"
}, {
  expected: "🏞",
  actual: "🏞"
}, {
  expected: "🏟️",
  actual: "🏟"
}, {
  expected: "🏟",
  actual: "🏟"
}, {
  expected: "🏛️",
  actual: "🏛"
}, {
  expected: "🏛",
  actual: "🏛"
}, {
  expected: "🏗️",
  actual: "🏗"
}, {
  expected: "🏗",
  actual: "🏗"
}, {
  expected: "🧱",
  actual: "🧱"
}, {
  expected: "🪨",
  actual: "🪨"
}, {
  expected: "🪵",
  actual: "🪵"
}, {
  expected: "🛖",
  actual: "🛖"
}, {
  expected: "🏘️",
  actual: "🏘"
}, {
  expected: "🏘",
  actual: "🏘"
}, {
  expected: "🏚️",
  actual: "🏚"
}, {
  expected: "🏚",
  actual: "🏚"
}, {
  expected: "🏠",
  actual: "🏠"
}, {
  expected: "🏡",
  actual: "🏡"
}, {
  expected: "🏢",
  actual: "🏢"
}, {
  expected: "🏣",
  actual: "🏣"
}, {
  expected: "🏤",
  actual: "🏤"
}, {
  expected: "🏥",
  actual: "🏥"
}, {
  expected: "🏦",
  actual: "🏦"
}, {
  expected: "🏨",
  actual: "🏨"
}, {
  expected: "🏩",
  actual: "🏩"
}, {
  expected: "🏪",
  actual: "🏪"
}, {
  expected: "🏫",
  actual: "🏫"
}, {
  expected: "🏬",
  actual: "🏬"
}, {
  expected: "🏭",
  actual: "🏭"
}, {
  expected: "🏯",
  actual: "🏯"
}, {
  expected: "🏰",
  actual: "🏰"
}, {
  expected: "💒",
  actual: "💒"
}, {
  expected: "🗼",
  actual: "🗼"
}, {
  expected: "🗽",
  actual: "🗽"
}, {
  expected: "🕌",
  actual: "🕌"
}, {
  expected: "🛕",
  actual: "🛕"
}, {
  expected: "🕍",
  actual: "🕍"
}, {
  expected: "🕋",
  actual: "🕋"
}, {
  expected: "🌁",
  actual: "🌁"
}, {
  expected: "🌃",
  actual: "🌃"
}, {
  expected: "🏙️",
  actual: "🏙"
}, {
  expected: "🏙",
  actual: "🏙"
}, {
  expected: "🌄",
  actual: "🌄"
}, {
  expected: "🌅",
  actual: "🌅"
}, {
  expected: "🌆",
  actual: "🌆"
}, {
  expected: "🌇",
  actual: "🌇"
}, {
  expected: "🌉",
  actual: "🌉"
}, {
  expected: "🎠",
  actual: "🎠"
}, {
  expected: "🛝",
  actual: "🛝"
}, {
  expected: "🎡",
  actual: "🎡"
}, {
  expected: "🎢",
  actual: "🎢"
}, {
  expected: "💈",
  actual: "💈"
}, {
  expected: "🎪",
  actual: "🎪"
}, {
  expected: "🚂",
  actual: "🚂"
}, {
  expected: "🚃",
  actual: "🚃"
}, {
  expected: "🚄",
  actual: "🚄"
}, {
  expected: "🚅",
  actual: "🚅"
}, {
  expected: "🚆",
  actual: "🚆"
}, {
  expected: "🚇",
  actual: "🚇"
}, {
  expected: "🚈",
  actual: "🚈"
}, {
  expected: "🚉",
  actual: "🚉"
}, {
  expected: "🚊",
  actual: "🚊"
}, {
  expected: "🚝",
  actual: "🚝"
}, {
  expected: "🚞",
  actual: "🚞"
}, {
  expected: "🚋",
  actual: "🚋"
}, {
  expected: "🚌",
  actual: "🚌"
}, {
  expected: "🚍",
  actual: "🚍"
}, {
  expected: "🚎",
  actual: "🚎"
}, {
  expected: "🚐",
  actual: "🚐"
}, {
  expected: "🚑",
  actual: "🚑"
}, {
  expected: "🚒",
  actual: "🚒"
}, {
  expected: "🚓",
  actual: "🚓"
}, {
  expected: "🚔",
  actual: "🚔"
}, {
  expected: "🚕",
  actual: "🚕"
}, {
  expected: "🚖",
  actual: "🚖"
}, {
  expected: "🚗",
  actual: "🚗"
}, {
  expected: "🚘",
  actual: "🚘"
}, {
  expected: "🚙",
  actual: "🚙"
}, {
  expected: "🛻",
  actual: "🛻"
}, {
  expected: "🚚",
  actual: "🚚"
}, {
  expected: "🚛",
  actual: "🚛"
}, {
  expected: "🚜",
  actual: "🚜"
}, {
  expected: "🏎️",
  actual: "🏎"
}, {
  expected: "🏎",
  actual: "🏎"
}, {
  expected: "🏍️",
  actual: "🏍"
}, {
  expected: "🏍",
  actual: "🏍"
}, {
  expected: "🛵",
  actual: "🛵"
}, {
  expected: "🦽",
  actual: "🦽"
}, {
  expected: "🦼",
  actual: "🦼"
}, {
  expected: "🛺",
  actual: "🛺"
}, {
  expected: "🚲",
  actual: "🚲"
}, {
  expected: "🛴",
  actual: "🛴"
}, {
  expected: "🛹",
  actual: "🛹"
}, {
  expected: "🛼",
  actual: "🛼"
}, {
  expected: "🚏",
  actual: "🚏"
}, {
  expected: "🛣️",
  actual: "🛣"
}, {
  expected: "🛣",
  actual: "🛣"
}, {
  expected: "🛤️",
  actual: "🛤"
}, {
  expected: "🛤",
  actual: "🛤"
}, {
  expected: "🛢️",
  actual: "🛢"
}, {
  expected: "🛢",
  actual: "🛢"
}, {
  expected: "🛞",
  actual: "🛞"
}, {
  expected: "🚨",
  actual: "🚨"
}, {
  expected: "🚥",
  actual: "🚥"
}, {
  expected: "🚦",
  actual: "🚦"
}, {
  expected: "🛑",
  actual: "🛑"
}, {
  expected: "🚧",
  actual: "🚧"
}, {
  expected: "🛟",
  actual: "🛟"
}, {
  expected: "🛶",
  actual: "🛶"
}, {
  expected: "🚤",
  actual: "🚤"
}, {
  expected: "🛳️",
  actual: "🛳"
}, {
  expected: "🛳",
  actual: "🛳"
}, {
  expected: "🛥️",
  actual: "🛥"
}, {
  expected: "🛥",
  actual: "🛥"
}, {
  expected: "🚢",
  actual: "🚢"
}, {
  expected: "🛩️",
  actual: "🛩"
}, {
  expected: "🛩",
  actual: "🛩"
}, {
  expected: "🛫",
  actual: "🛫"
}, {
  expected: "🛬",
  actual: "🛬"
}, {
  expected: "🪂",
  actual: "🪂"
}, {
  expected: "💺",
  actual: "💺"
}, {
  expected: "🚁",
  actual: "🚁"
}, {
  expected: "🚟",
  actual: "🚟"
}, {
  expected: "🚠",
  actual: "🚠"
}, {
  expected: "🚡",
  actual: "🚡"
}, {
  expected: "🛰️",
  actual: "🛰"
}, {
  expected: "🛰",
  actual: "🛰"
}, {
  expected: "🚀",
  actual: "🚀"
}, {
  expected: "🛸",
  actual: "🛸"
}, {
  expected: "🛎️",
  actual: "🛎"
}, {
  expected: "🛎",
  actual: "🛎"
}, {
  expected: "🧳",
  actual: "🧳"
}, {
  expected: "🕰️",
  actual: "🕰"
}, {
  expected: "🕰",
  actual: "🕰"
}, {
  expected: "🕛",
  actual: "🕛"
}, {
  expected: "🕧",
  actual: "🕧"
}, {
  expected: "🕐",
  actual: "🕐"
}, {
  expected: "🕜",
  actual: "🕜"
}, {
  expected: "🕑",
  actual: "🕑"
}, {
  expected: "🕝",
  actual: "🕝"
}, {
  expected: "🕒",
  actual: "🕒"
}, {
  expected: "🕞",
  actual: "🕞"
}, {
  expected: "🕓",
  actual: "🕓"
}, {
  expected: "🕟",
  actual: "🕟"
}, {
  expected: "🕔",
  actual: "🕔"
}, {
  expected: "🕠",
  actual: "🕠"
}, {
  expected: "🕕",
  actual: "🕕"
}, {
  expected: "🕡",
  actual: "🕡"
}, {
  expected: "🕖",
  actual: "🕖"
}, {
  expected: "🕢",
  actual: "🕢"
}, {
  expected: "🕗",
  actual: "🕗"
}, {
  expected: "🕣",
  actual: "🕣"
}, {
  expected: "🕘",
  actual: "🕘"
}, {
  expected: "🕤",
  actual: "🕤"
}, {
  expected: "🕙",
  actual: "🕙"
}, {
  expected: "🕥",
  actual: "🕥"
}, {
  expected: "🕚",
  actual: "🕚"
}, {
  expected: "🕦",
  actual: "🕦"
}, {
  expected: "🌑",
  actual: "🌑"
}, {
  expected: "🌒",
  actual: "🌒"
}, {
  expected: "🌓",
  actual: "🌓"
}, {
  expected: "🌔",
  actual: "🌔"
}, {
  expected: "🌕",
  actual: "🌕"
}, {
  expected: "🌖",
  actual: "🌖"
}, {
  expected: "🌗",
  actual: "🌗"
}, {
  expected: "🌘",
  actual: "🌘"
}, {
  expected: "🌙",
  actual: "🌙"
}, {
  expected: "🌚",
  actual: "🌚"
}, {
  expected: "🌛",
  actual: "🌛"
}, {
  expected: "🌜",
  actual: "🌜"
}, {
  expected: "🌡️",
  actual: "🌡"
}, {
  expected: "🌡",
  actual: "🌡"
}, {
  expected: "🌝",
  actual: "🌝"
}, {
  expected: "🌞",
  actual: "🌞"
}, {
  expected: "🪐",
  actual: "🪐"
}, {
  expected: "🌟",
  actual: "🌟"
}, {
  expected: "🌠",
  actual: "🌠"
}, {
  expected: "🌌",
  actual: "🌌"
}, {
  expected: "🌤️",
  actual: "🌤"
}, {
  expected: "🌤",
  actual: "🌤"
}, {
  expected: "🌥️",
  actual: "🌥"
}, {
  expected: "🌥",
  actual: "🌥"
}, {
  expected: "🌦️",
  actual: "🌦"
}, {
  expected: "🌦",
  actual: "🌦"
}, {
  expected: "🌧️",
  actual: "🌧"
}, {
  expected: "🌧",
  actual: "🌧"
}, {
  expected: "🌨️",
  actual: "🌨"
}, {
  expected: "🌨",
  actual: "🌨"
}, {
  expected: "🌩️",
  actual: "🌩"
}, {
  expected: "🌩",
  actual: "🌩"
}, {
  expected: "🌪️",
  actual: "🌪"
}, {
  expected: "🌪",
  actual: "🌪"
}, {
  expected: "🌫️",
  actual: "🌫"
}, {
  expected: "🌫",
  actual: "🌫"
}, {
  expected: "🌬️",
  actual: "🌬"
}, {
  expected: "🌬",
  actual: "🌬"
}, {
  expected: "🌀",
  actual: "🌀"
}, {
  expected: "🌈",
  actual: "🌈"
}, {
  expected: "🌂",
  actual: "🌂"
}, {
  expected: "🔥",
  actual: "🔥"
}, {
  expected: "💧",
  actual: "💧"
}, {
  expected: "🌊",
  actual: "🌊"
}, {
  expected: "🎃",
  actual: "🎃"
}, {
  expected: "🎄",
  actual: "🎄"
}, {
  expected: "🎆",
  actual: "🎆"
}, {
  expected: "🎇",
  actual: "🎇"
}, {
  expected: "🧨",
  actual: "🧨"
}, {
  expected: "🎈",
  actual: "🎈"
}, {
  expected: "🎉",
  actual: "🎉"
}, {
  expected: "🎊",
  actual: "🎊"
}, {
  expected: "🎋",
  actual: "🎋"
}, {
  expected: "🎍",
  actual: "🎍"
}, {
  expected: "🎎",
  actual: "🎎"
}, {
  expected: "🎏",
  actual: "🎏"
}, {
  expected: "🎐",
  actual: "🎐"
}, {
  expected: "🎑",
  actual: "🎑"
}, {
  expected: "🧧",
  actual: "🧧"
}, {
  expected: "🎀",
  actual: "🎀"
}, {
  expected: "🎁",
  actual: "🎁"
}, {
  expected: "🎗️",
  actual: "🎗"
}, {
  expected: "🎗",
  actual: "🎗"
}, {
  expected: "🎟️",
  actual: "🎟"
}, {
  expected: "🎟",
  actual: "🎟"
}, {
  expected: "🎫",
  actual: "🎫"
}, {
  expected: "🎖️",
  actual: "🎖"
}, {
  expected: "🎖",
  actual: "🎖"
}, {
  expected: "🏆",
  actual: "🏆"
}, {
  expected: "🏅",
  actual: "🏅"
}, {
  expected: "🥇",
  actual: "🥇"
}, {
  expected: "🥈",
  actual: "🥈"
}, {
  expected: "🥉",
  actual: "🥉"
}, {
  expected: "🥎",
  actual: "🥎"
}, {
  expected: "🏀",
  actual: "🏀"
}, {
  expected: "🏐",
  actual: "🏐"
}, {
  expected: "🏈",
  actual: "🏈"
}, {
  expected: "🏉",
  actual: "🏉"
}, {
  expected: "🎾",
  actual: "🎾"
}, {
  expected: "🥏",
  actual: "🥏"
}, {
  expected: "🎳",
  actual: "🎳"
}, {
  expected: "🏏",
  actual: "🏏"
}, {
  expected: "🏑",
  actual: "🏑"
}, {
  expected: "🏒",
  actual: "🏒"
}, {
  expected: "🥍",
  actual: "🥍"
}, {
  expected: "🏓",
  actual: "🏓"
}, {
  expected: "🏸",
  actual: "🏸"
}, {
  expected: "🥊",
  actual: "🥊"
}, {
  expected: "🥋",
  actual: "🥋"
}, {
  expected: "🥅",
  actual: "🥅"
}, {
  expected: "🎣",
  actual: "🎣"
}, {
  expected: "🤿",
  actual: "🤿"
}, {
  expected: "🎽",
  actual: "🎽"
}, {
  expected: "🎿",
  actual: "🎿"
}, {
  expected: "🛷",
  actual: "🛷"
}, {
  expected: "🥌",
  actual: "🥌"
}, {
  expected: "🎯",
  actual: "🎯"
}, {
  expected: "🪀",
  actual: "🪀"
}, {
  expected: "🪁",
  actual: "🪁"
}, {
  expected: "🔫",
  actual: "🔫"
}, {
  expected: "🎱",
  actual: "🎱"
}, {
  expected: "🔮",
  actual: "🔮"
}, {
  expected: "🪄",
  actual: "🪄"
}, {
  expected: "🎮",
  actual: "🎮"
}, {
  expected: "🕹️",
  actual: "🕹"
}, {
  expected: "🕹",
  actual: "🕹"
}, {
  expected: "🎰",
  actual: "🎰"
}, {
  expected: "🎲",
  actual: "🎲"
}, {
  expected: "🧩",
  actual: "🧩"
}, {
  expected: "🧸",
  actual: "🧸"
}, {
  expected: "🪅",
  actual: "🪅"
}, {
  expected: "🪩",
  actual: "🪩"
}, {
  expected: "🪆",
  actual: "🪆"
}, {
  expected: "🃏",
  actual: "🃏"
}, {
  expected: "🀄",
  actual: "🀄"
}, {
  expected: "🎴",
  actual: "🎴"
}, {
  expected: "🎭",
  actual: "🎭"
}, {
  expected: "🖼️",
  actual: "🖼"
}, {
  expected: "🖼",
  actual: "🖼"
}, {
  expected: "🎨",
  actual: "🎨"
}, {
  expected: "🧵",
  actual: "🧵"
}, {
  expected: "🪡",
  actual: "🪡"
}, {
  expected: "🧶",
  actual: "🧶"
}, {
  expected: "🪢",
  actual: "🪢"
}, {
  expected: "👓",
  actual: "👓"
}, {
  expected: "🕶️",
  actual: "🕶"
}, {
  expected: "🕶",
  actual: "🕶"
}, {
  expected: "🥽",
  actual: "🥽"
}, {
  expected: "🥼",
  actual: "🥼"
}, {
  expected: "🦺",
  actual: "🦺"
}, {
  expected: "👔",
  actual: "👔"
}, {
  expected: "👕",
  actual: "👕"
}, {
  expected: "👖",
  actual: "👖"
}, {
  expected: "🧣",
  actual: "🧣"
}, {
  expected: "🧤",
  actual: "🧤"
}, {
  expected: "🧥",
  actual: "🧥"
}, {
  expected: "🧦",
  actual: "🧦"
}, {
  expected: "👗",
  actual: "👗"
}, {
  expected: "👘",
  actual: "👘"
}, {
  expected: "🥻",
  actual: "🥻"
}, {
  expected: "🩱",
  actual: "🩱"
}, {
  expected: "🩲",
  actual: "🩲"
}, {
  expected: "🩳",
  actual: "🩳"
}, {
  expected: "👙",
  actual: "👙"
}, {
  expected: "👚",
  actual: "👚"
}, {
  expected: "🪭",
  actual: "🪭"
}, {
  expected: "👛",
  actual: "👛"
}, {
  expected: "👜",
  actual: "👜"
}, {
  expected: "👝",
  actual: "👝"
}, {
  expected: "🛍️",
  actual: "🛍"
}, {
  expected: "🛍",
  actual: "🛍"
}, {
  expected: "🎒",
  actual: "🎒"
}, {
  expected: "🩴",
  actual: "🩴"
}, {
  expected: "👞",
  actual: "👞"
}, {
  expected: "👟",
  actual: "👟"
}, {
  expected: "🥾",
  actual: "🥾"
}, {
  expected: "🥿",
  actual: "🥿"
}, {
  expected: "👠",
  actual: "👠"
}, {
  expected: "👡",
  actual: "👡"
}, {
  expected: "🩰",
  actual: "🩰"
}, {
  expected: "👢",
  actual: "👢"
}, {
  expected: "🪮",
  actual: "🪮"
}, {
  expected: "👑",
  actual: "👑"
}, {
  expected: "👒",
  actual: "👒"
}, {
  expected: "🎩",
  actual: "🎩"
}, {
  expected: "🎓",
  actual: "🎓"
}, {
  expected: "🧢",
  actual: "🧢"
}, {
  expected: "🪖",
  actual: "🪖"
}, {
  expected: "📿",
  actual: "📿"
}, {
  expected: "💄",
  actual: "💄"
}, {
  expected: "💍",
  actual: "💍"
}, {
  expected: "💎",
  actual: "💎"
}, {
  expected: "🔇",
  actual: "🔇"
}, {
  expected: "🔈",
  actual: "🔈"
}, {
  expected: "🔉",
  actual: "🔉"
}, {
  expected: "🔊",
  actual: "🔊"
}, {
  expected: "📢",
  actual: "📢"
}, {
  expected: "📣",
  actual: "📣"
}, {
  expected: "📯",
  actual: "📯"
}, {
  expected: "🔔",
  actual: "🔔"
}, {
  expected: "🔕",
  actual: "🔕"
}, {
  expected: "🎼",
  actual: "🎼"
}, {
  expected: "🎵",
  actual: "🎵"
}, {
  expected: "🎶",
  actual: "🎶"
}, {
  expected: "🎙️",
  actual: "🎙"
}, {
  expected: "🎙",
  actual: "🎙"
}, {
  expected: "🎚️",
  actual: "🎚"
}, {
  expected: "🎚",
  actual: "🎚"
}, {
  expected: "🎛️",
  actual: "🎛"
}, {
  expected: "🎛",
  actual: "🎛"
}, {
  expected: "🎤",
  actual: "🎤"
}, {
  expected: "🎧",
  actual: "🎧"
}, {
  expected: "📻",
  actual: "📻"
}, {
  expected: "🎷",
  actual: "🎷"
}, {
  expected: "🪗",
  actual: "🪗"
}, {
  expected: "🎸",
  actual: "🎸"
}, {
  expected: "🎹",
  actual: "🎹"
}, {
  expected: "🎺",
  actual: "🎺"
}, {
  expected: "🎻",
  actual: "🎻"
}, {
  expected: "🪕",
  actual: "🪕"
}, {
  expected: "🥁",
  actual: "🥁"
}, {
  expected: "🪘",
  actual: "🪘"
}, {
  expected: "🪇",
  actual: "🪇"
}, {
  expected: "🪈",
  actual: "🪈"
}, {
  expected: "📱",
  actual: "📱"
}, {
  expected: "📲",
  actual: "📲"
}, {
  expected: "📞",
  actual: "📞"
}, {
  expected: "📟",
  actual: "📟"
}, {
  expected: "📠",
  actual: "📠"
}, {
  expected: "🔋",
  actual: "🔋"
}, {
  expected: "🪫",
  actual: "🪫"
}, {
  expected: "🔌",
  actual: "🔌"
}, {
  expected: "💻",
  actual: "💻"
}, {
  expected: "🖥️",
  actual: "🖥"
}, {
  expected: "🖥",
  actual: "🖥"
}, {
  expected: "🖨️",
  actual: "🖨"
}, {
  expected: "🖨",
  actual: "🖨"
}, {
  expected: "🖱️",
  actual: "🖱"
}, {
  expected: "🖱",
  actual: "🖱"
}, {
  expected: "🖲️",
  actual: "🖲"
}, {
  expected: "🖲",
  actual: "🖲"
}, {
  expected: "💽",
  actual: "💽"
}, {
  expected: "💾",
  actual: "💾"
}, {
  expected: "💿",
  actual: "💿"
}, {
  expected: "📀",
  actual: "📀"
}, {
  expected: "🧮",
  actual: "🧮"
}, {
  expected: "🎥",
  actual: "🎥"
}, {
  expected: "🎞️",
  actual: "🎞"
}, {
  expected: "🎞",
  actual: "🎞"
}, {
  expected: "📽️",
  actual: "📽"
}, {
  expected: "📽",
  actual: "📽"
}, {
  expected: "🎬",
  actual: "🎬"
}, {
  expected: "📺",
  actual: "📺"
}, {
  expected: "📷",
  actual: "📷"
}, {
  expected: "📸",
  actual: "📸"
}, {
  expected: "📹",
  actual: "📹"
}, {
  expected: "📼",
  actual: "📼"
}, {
  expected: "🔍",
  actual: "🔍"
}, {
  expected: "🔎",
  actual: "🔎"
}, {
  expected: "🕯️",
  actual: "🕯"
}, {
  expected: "🕯",
  actual: "🕯"
}, {
  expected: "💡",
  actual: "💡"
}, {
  expected: "🔦",
  actual: "🔦"
}, {
  expected: "🏮",
  actual: "🏮"
}, {
  expected: "🪔",
  actual: "🪔"
}, {
  expected: "📔",
  actual: "📔"
}, {
  expected: "📕",
  actual: "📕"
}, {
  expected: "📖",
  actual: "📖"
}, {
  expected: "📗",
  actual: "📗"
}, {
  expected: "📘",
  actual: "📘"
}, {
  expected: "📙",
  actual: "📙"
}, {
  expected: "📚",
  actual: "📚"
}, {
  expected: "📓",
  actual: "📓"
}, {
  expected: "📒",
  actual: "📒"
}, {
  expected: "📃",
  actual: "📃"
}, {
  expected: "📜",
  actual: "📜"
}, {
  expected: "📄",
  actual: "📄"
}, {
  expected: "📰",
  actual: "📰"
}, {
  expected: "🗞️",
  actual: "🗞"
}, {
  expected: "🗞",
  actual: "🗞"
}, {
  expected: "📑",
  actual: "📑"
}, {
  expected: "🔖",
  actual: "🔖"
}, {
  expected: "🏷️",
  actual: "🏷"
}, {
  expected: "🏷",
  actual: "🏷"
}, {
  expected: "💰",
  actual: "💰"
}, {
  expected: "🪙",
  actual: "🪙"
}, {
  expected: "💴",
  actual: "💴"
}, {
  expected: "💵",
  actual: "💵"
}, {
  expected: "💶",
  actual: "💶"
}, {
  expected: "💷",
  actual: "💷"
}, {
  expected: "💸",
  actual: "💸"
}, {
  expected: "💳",
  actual: "💳"
}, {
  expected: "🧾",
  actual: "🧾"
}, {
  expected: "💹",
  actual: "💹"
}, {
  expected: "📧",
  actual: "📧"
}, {
  expected: "📨",
  actual: "📨"
}, {
  expected: "📩",
  actual: "📩"
}, {
  expected: "📤",
  actual: "📤"
}, {
  expected: "📥",
  actual: "📥"
}, {
  expected: "📦",
  actual: "📦"
}, {
  expected: "📫",
  actual: "📫"
}, {
  expected: "📪",
  actual: "📪"
}, {
  expected: "📬",
  actual: "📬"
}, {
  expected: "📭",
  actual: "📭"
}, {
  expected: "📮",
  actual: "📮"
}, {
  expected: "🗳️",
  actual: "🗳"
}, {
  expected: "🗳",
  actual: "🗳"
}, {
  expected: "🖋️",
  actual: "🖋"
}, {
  expected: "🖋",
  actual: "🖋"
}, {
  expected: "🖊️",
  actual: "🖊"
}, {
  expected: "🖊",
  actual: "🖊"
}, {
  expected: "🖌️",
  actual: "🖌"
}, {
  expected: "🖌",
  actual: "🖌"
}, {
  expected: "🖍️",
  actual: "🖍"
}, {
  expected: "🖍",
  actual: "🖍"
}, {
  expected: "📝",
  actual: "📝"
}, {
  expected: "💼",
  actual: "💼"
}, {
  expected: "📁",
  actual: "📁"
}, {
  expected: "📂",
  actual: "📂"
}, {
  expected: "🗂️",
  actual: "🗂"
}, {
  expected: "🗂",
  actual: "🗂"
}, {
  expected: "📅",
  actual: "📅"
}, {
  expected: "📆",
  actual: "📆"
}, {
  expected: "🗒️",
  actual: "🗒"
}, {
  expected: "🗒",
  actual: "🗒"
}, {
  expected: "🗓️",
  actual: "🗓"
}, {
  expected: "🗓",
  actual: "🗓"
}, {
  expected: "📇",
  actual: "📇"
}, {
  expected: "📈",
  actual: "📈"
}, {
  expected: "📉",
  actual: "📉"
}, {
  expected: "📊",
  actual: "📊"
}, {
  expected: "📋",
  actual: "📋"
}, {
  expected: "📌",
  actual: "📌"
}, {
  expected: "📍",
  actual: "📍"
}, {
  expected: "📎",
  actual: "📎"
}, {
  expected: "🖇️",
  actual: "🖇"
}, {
  expected: "🖇",
  actual: "🖇"
}, {
  expected: "📏",
  actual: "📏"
}, {
  expected: "📐",
  actual: "📐"
}, {
  expected: "🗃️",
  actual: "🗃"
}, {
  expected: "🗃",
  actual: "🗃"
}, {
  expected: "🗄️",
  actual: "🗄"
}, {
  expected: "🗄",
  actual: "🗄"
}, {
  expected: "🗑️",
  actual: "🗑"
}, {
  expected: "🗑",
  actual: "🗑"
}, {
  expected: "🔒",
  actual: "🔒"
}, {
  expected: "🔓",
  actual: "🔓"
}, {
  expected: "🔏",
  actual: "🔏"
}, {
  expected: "🔐",
  actual: "🔐"
}, {
  expected: "🔑",
  actual: "🔑"
}, {
  expected: "🗝️",
  actual: "🗝"
}, {
  expected: "🗝",
  actual: "🗝"
}, {
  expected: "🔨",
  actual: "🔨"
}, {
  expected: "🪓",
  actual: "🪓"
}, {
  expected: "🛠️",
  actual: "🛠"
}, {
  expected: "🛠",
  actual: "🛠"
}, {
  expected: "🗡️",
  actual: "🗡"
}, {
  expected: "🗡",
  actual: "🗡"
}, {
  expected: "💣",
  actual: "💣"
}, {
  expected: "🪃",
  actual: "🪃"
}, {
  expected: "🏹",
  actual: "🏹"
}, {
  expected: "🛡️",
  actual: "🛡"
}, {
  expected: "🛡",
  actual: "🛡"
}, {
  expected: "🪚",
  actual: "🪚"
}, {
  expected: "🔧",
  actual: "🔧"
}, {
  expected: "🪛",
  actual: "🪛"
}, {
  expected: "🔩",
  actual: "🔩"
}, {
  expected: "🗜️",
  actual: "🗜"
}, {
  expected: "🗜",
  actual: "🗜"
}, {
  expected: "🦯",
  actual: "🦯"
}, {
  expected: "🔗",
  actual: "🔗"
}, {
  expected: "🪝",
  actual: "🪝"
}, {
  expected: "🧰",
  actual: "🧰"
}, {
  expected: "🧲",
  actual: "🧲"
}, {
  expected: "🪜",
  actual: "🪜"
}, {
  expected: "🧪",
  actual: "🧪"
}, {
  expected: "🧫",
  actual: "🧫"
}, {
  expected: "🧬",
  actual: "🧬"
}, {
  expected: "🔬",
  actual: "🔬"
}, {
  expected: "🔭",
  actual: "🔭"
}, {
  expected: "📡",
  actual: "📡"
}, {
  expected: "💉",
  actual: "💉"
}, {
  expected: "🩸",
  actual: "🩸"
}, {
  expected: "💊",
  actual: "💊"
}, {
  expected: "🩹",
  actual: "🩹"
}, {
  expected: "🩼",
  actual: "🩼"
}, {
  expected: "🩺",
  actual: "🩺"
}, {
  expected: "🩻",
  actual: "🩻"
}, {
  expected: "🚪",
  actual: "🚪"
}, {
  expected: "🛗",
  actual: "🛗"
}, {
  expected: "🪞",
  actual: "🪞"
}, {
  expected: "🪟",
  actual: "🪟"
}, {
  expected: "🛏️",
  actual: "🛏"
}, {
  expected: "🛏",
  actual: "🛏"
}, {
  expected: "🛋️",
  actual: "🛋"
}, {
  expected: "🛋",
  actual: "🛋"
}, {
  expected: "🪑",
  actual: "🪑"
}, {
  expected: "🚽",
  actual: "🚽"
}, {
  expected: "🪠",
  actual: "🪠"
}, {
  expected: "🚿",
  actual: "🚿"
}, {
  expected: "🛁",
  actual: "🛁"
}, {
  expected: "🪤",
  actual: "🪤"
}, {
  expected: "🪒",
  actual: "🪒"
}, {
  expected: "🧴",
  actual: "🧴"
}, {
  expected: "🧷",
  actual: "🧷"
}, {
  expected: "🧹",
  actual: "🧹"
}, {
  expected: "🧺",
  actual: "🧺"
}, {
  expected: "🧻",
  actual: "🧻"
}, {
  expected: "🪣",
  actual: "🪣"
}, {
  expected: "🧼",
  actual: "🧼"
}, {
  expected: "🫧",
  actual: "🫧"
}, {
  expected: "🪥",
  actual: "🪥"
}, {
  expected: "🧽",
  actual: "🧽"
}, {
  expected: "🧯",
  actual: "🧯"
}, {
  expected: "🛒",
  actual: "🛒"
}, {
  expected: "🚬",
  actual: "🚬"
}, {
  expected: "🪦",
  actual: "🪦"
}, {
  expected: "🧿",
  actual: "🧿"
}, {
  expected: "🪬",
  actual: "🪬"
}, {
  expected: "🗿",
  actual: "🗿"
}, {
  expected: "🪧",
  actual: "🪧"
}, {
  expected: "🪪",
  actual: "🪪"
}, {
  expected: "🏧",
  actual: "🏧"
}, {
  expected: "🚮",
  actual: "🚮"
}, {
  expected: "🚰",
  actual: "🚰"
}, {
  expected: "🚹",
  actual: "🚹"
}, {
  expected: "🚺",
  actual: "🚺"
}, {
  expected: "🚻",
  actual: "🚻"
}, {
  expected: "🚼",
  actual: "🚼"
}, {
  expected: "🚾",
  actual: "🚾"
}, {
  expected: "🛂",
  actual: "🛂"
}, {
  expected: "🛃",
  actual: "🛃"
}, {
  expected: "🛄",
  actual: "🛄"
}, {
  expected: "🛅",
  actual: "🛅"
}, {
  expected: "🚸",
  actual: "🚸"
}, {
  expected: "🚫",
  actual: "🚫"
}, {
  expected: "🚳",
  actual: "🚳"
}, {
  expected: "🚭",
  actual: "🚭"
}, {
  expected: "🚯",
  actual: "🚯"
}, {
  expected: "🚱",
  actual: "🚱"
}, {
  expected: "🚷",
  actual: "🚷"
}, {
  expected: "📵",
  actual: "📵"
}, {
  expected: "🔞",
  actual: "🔞"
}, {
  expected: "🔃",
  actual: "🔃"
}, {
  expected: "🔄",
  actual: "🔄"
}, {
  expected: "🔙",
  actual: "🔙"
}, {
  expected: "🔚",
  actual: "🔚"
}, {
  expected: "🔛",
  actual: "🔛"
}, {
  expected: "🔜",
  actual: "🔜"
}, {
  expected: "🔝",
  actual: "🔝"
}, {
  expected: "🛐",
  actual: "🛐"
}, {
  expected: "🕉️",
  actual: "🕉"
}, {
  expected: "🕉",
  actual: "🕉"
}, {
  expected: "🕎",
  actual: "🕎"
}, {
  expected: "🔯",
  actual: "🔯"
}, {
  expected: "🪯",
  actual: "🪯"
}, {
  expected: "🔀",
  actual: "🔀"
}, {
  expected: "🔁",
  actual: "🔁"
}, {
  expected: "🔂",
  actual: "🔂"
}, {
  expected: "🔼",
  actual: "🔼"
}, {
  expected: "🔽",
  actual: "🔽"
}, {
  expected: "🎦",
  actual: "🎦"
}, {
  expected: "🔅",
  actual: "🔅"
}, {
  expected: "🔆",
  actual: "🔆"
}, {
  expected: "📶",
  actual: "📶"
}, {
  expected: "🛜",
  actual: "🛜"
}, {
  expected: "📳",
  actual: "📳"
}, {
  expected: "📴",
  actual: "📴"
}, {
  expected: "🟰",
  actual: "🟰"
}, {
  expected: "💱",
  actual: "💱"
}, {
  expected: "💲",
  actual: "💲"
}, {
  expected: "🔱",
  actual: "🔱"
}, {
  expected: "📛",
  actual: "📛"
}, {
  expected: "🔰",
  actual: "🔰"
}, {
  expected: "#️⃣",
  actual: "#⃣"
}, {
  expected: "#⃣",
  actual: "#⃣"
}, {
  expected: "*️⃣",
  actual: "*⃣"
}, {
  expected: "*⃣",
  actual: "*⃣"
}, {
  expected: "0️⃣",
  actual: "0⃣"
}, {
  expected: "0⃣",
  actual: "0⃣"
}, {
  expected: "1️⃣",
  actual: "1⃣"
}, {
  expected: "1⃣",
  actual: "1⃣"
}, {
  expected: "2️⃣",
  actual: "2⃣"
}, {
  expected: "2⃣",
  actual: "2⃣"
}, {
  expected: "3️⃣",
  actual: "3⃣"
}, {
  expected: "3⃣",
  actual: "3⃣"
}, {
  expected: "4️⃣",
  actual: "4⃣"
}, {
  expected: "4⃣",
  actual: "4⃣"
}, {
  expected: "5️⃣",
  actual: "5⃣"
}, {
  expected: "5⃣",
  actual: "5⃣"
}, {
  expected: "6️⃣",
  actual: "6⃣"
}, {
  expected: "6⃣",
  actual: "6⃣"
}, {
  expected: "7️⃣",
  actual: "7⃣"
}, {
  expected: "7⃣",
  actual: "7⃣"
}, {
  expected: "8️⃣",
  actual: "8⃣"
}, {
  expected: "8⃣",
  actual: "8⃣"
}, {
  expected: "9️⃣",
  actual: "9⃣"
}, {
  expected: "9⃣",
  actual: "9⃣"
}, {
  expected: "🔟",
  actual: "🔟"
}, {
  expected: "🔠",
  actual: "🔠"
}, {
  expected: "🔡",
  actual: "🔡"
}, {
  expected: "🔢",
  actual: "🔢"
}, {
  expected: "🔣",
  actual: "🔣"
}, {
  expected: "🔤",
  actual: "🔤"
}, {
  expected: "🅰️",
  actual: "🅰"
}, {
  expected: "🅰",
  actual: "🅰"
}, {
  expected: "🆎",
  actual: "🆎"
}, {
  expected: "🅱️",
  actual: "🅱"
}, {
  expected: "🅱",
  actual: "🅱"
}, {
  expected: "🆑",
  actual: "🆑"
}, {
  expected: "🆒",
  actual: "🆒"
}, {
  expected: "🆓",
  actual: "🆓"
}, {
  expected: "🆔",
  actual: "🆔"
}, {
  expected: "🆕",
  actual: "🆕"
}, {
  expected: "🆖",
  actual: "🆖"
}, {
  expected: "🅾️",
  actual: "🅾"
}, {
  expected: "🅾",
  actual: "🅾"
}, {
  expected: "🆗",
  actual: "🆗"
}, {
  expected: "🅿️",
  actual: "🅿"
}, {
  expected: "🅿",
  actual: "🅿"
}, {
  expected: "🆘",
  actual: "🆘"
}, {
  expected: "🆙",
  actual: "🆙"
}, {
  expected: "🆚",
  actual: "🆚"
}, {
  expected: "🈁",
  actual: "🈁"
}, {
  expected: "🈂️",
  actual: "🈂"
}, {
  expected: "🈂",
  actual: "🈂"
}, {
  expected: "🈷️",
  actual: "🈷"
}, {
  expected: "🈷",
  actual: "🈷"
}, {
  expected: "🈶",
  actual: "🈶"
}, {
  expected: "🈯",
  actual: "🈯"
}, {
  expected: "🉐",
  actual: "🉐"
}, {
  expected: "🈹",
  actual: "🈹"
}, {
  expected: "🈚",
  actual: "🈚"
}, {
  expected: "🈲",
  actual: "🈲"
}, {
  expected: "🉑",
  actual: "🉑"
}, {
  expected: "🈸",
  actual: "🈸"
}, {
  expected: "🈴",
  actual: "🈴"
}, {
  expected: "🈳",
  actual: "🈳"
}, {
  expected: "🈺",
  actual: "🈺"
}, {
  expected: "🈵",
  actual: "🈵"
}, {
  expected: "🔴",
  actual: "🔴"
}, {
  expected: "🟠",
  actual: "🟠"
}, {
  expected: "🟡",
  actual: "🟡"
}, {
  expected: "🟢",
  actual: "🟢"
}, {
  expected: "🔵",
  actual: "🔵"
}, {
  expected: "🟣",
  actual: "🟣"
}, {
  expected: "🟤",
  actual: "🟤"
}, {
  expected: "🟥",
  actual: "🟥"
}, {
  expected: "🟧",
  actual: "🟧"
}, {
  expected: "🟨",
  actual: "🟨"
}, {
  expected: "🟩",
  actual: "🟩"
}, {
  expected: "🟦",
  actual: "🟦"
}, {
  expected: "🟪",
  actual: "🟪"
}, {
  expected: "🟫",
  actual: "🟫"
}, {
  expected: "🔶",
  actual: "🔶"
}, {
  expected: "🔷",
  actual: "🔷"
}, {
  expected: "🔸",
  actual: "🔸"
}, {
  expected: "🔹",
  actual: "🔹"
}, {
  expected: "🔺",
  actual: "🔺"
}, {
  expected: "🔻",
  actual: "🔻"
}, {
  expected: "💠",
  actual: "💠"
}, {
  expected: "🔘",
  actual: "🔘"
}, {
  expected: "🔳",
  actual: "🔳"
}, {
  expected: "🔲",
  actual: "🔲"
}, {
  expected: "🏁",
  actual: "🏁"
}, {
  expected: "🚩",
  actual: "🚩"
}, {
  expected: "🎌",
  actual: "🎌"
}, {
  expected: "🏴",
  actual: "🏴"
}, {
  expected: "🏳️",
  actual: "🏳"
}, {
  expected: "🏳",
  actual: "🏳"
}, {
  expected: "☺️",
  actual: "☺"
}, {
  expected: "☺",
  actual: "☺"
}, {
  expected: "☹️",
  actual: "☹"
}, {
  expected: "☹",
  actual: "☹"
}, {
  expected: "☠️",
  actual: "☠"
}, {
  expected: "☠",
  actual: "☠"
}, {
  expected: "❣️",
  actual: "❣"
}, {
  expected: "❣",
  actual: "❣"
}, {
  expected: "❤️",
  actual: "❤"
}, {
  expected: "❤",
  actual: "❤"
}, {
  expected: "✋",
  actual: "✋"
}, {
  expected: "✌️",
  actual: "✌"
}, {
  expected: "✌",
  actual: "✌"
}, {
  expected: "☝️",
  actual: "☝"
}, {
  expected: "☝",
  actual: "☝"
}, {
  expected: "✊",
  actual: "✊"
}, {
  expected: "✍️",
  actual: "✍"
}, {
  expected: "✍",
  actual: "✍"
}, {
  expected: "⛷️",
  actual: "⛷"
}, {
  expected: "⛷",
  actual: "⛷"
}, {
  expected: "⛹️",
  actual: "⛹"
}, {
  expected: "⛹",
  actual: "⛹"
}, {
  expected: "☘️",
  actual: "☘"
}, {
  expected: "☘",
  actual: "☘"
}, {
  expected: "☕",
  actual: "☕"
}, {
  expected: "⛰️",
  actual: "⛰"
}, {
  expected: "⛰",
  actual: "⛰"
}, {
  expected: "⛪",
  actual: "⛪"
}, {
  expected: "⛩️",
  actual: "⛩"
}, {
  expected: "⛩",
  actual: "⛩"
}, {
  expected: "⛲",
  actual: "⛲"
}, {
  expected: "⛺",
  actual: "⛺"
}, {
  expected: "♨️",
  actual: "♨"
}, {
  expected: "♨",
  actual: "♨"
}, {
  expected: "⛽",
  actual: "⛽"
}, {
  expected: "⚓",
  actual: "⚓"
}, {
  expected: "⛵",
  actual: "⛵"
}, {
  expected: "⛴️",
  actual: "⛴"
}, {
  expected: "⛴",
  actual: "⛴"
}, {
  expected: "✈️",
  actual: "✈"
}, {
  expected: "✈",
  actual: "✈"
}, {
  expected: "⌛",
  actual: "⌛"
}, {
  expected: "⏳",
  actual: "⏳"
}, {
  expected: "⌚",
  actual: "⌚"
}, {
  expected: "⏰",
  actual: "⏰"
}, {
  expected: "⏱️",
  actual: "⏱"
}, {
  expected: "⏱",
  actual: "⏱"
}, {
  expected: "⏲️",
  actual: "⏲"
}, {
  expected: "⏲",
  actual: "⏲"
}, {
  expected: "☀️",
  actual: "☀"
}, {
  expected: "☀",
  actual: "☀"
}, {
  expected: "⭐",
  actual: "⭐"
}, {
  expected: "☁️",
  actual: "☁"
}, {
  expected: "☁",
  actual: "☁"
}, {
  expected: "⛅",
  actual: "⛅"
}, {
  expected: "⛈️",
  actual: "⛈"
}, {
  expected: "⛈",
  actual: "⛈"
}, {
  expected: "☂️",
  actual: "☂"
}, {
  expected: "☂",
  actual: "☂"
}, {
  expected: "☔",
  actual: "☔"
}, {
  expected: "⛱️",
  actual: "⛱"
}, {
  expected: "⛱",
  actual: "⛱"
}, {
  expected: "⚡",
  actual: "⚡"
}, {
  expected: "❄️",
  actual: "❄"
}, {
  expected: "❄",
  actual: "❄"
}, {
  expected: "☃️",
  actual: "☃"
}, {
  expected: "☃",
  actual: "☃"
}, {
  expected: "⛄",
  actual: "⛄"
}, {
  expected: "☄️",
  actual: "☄"
}, {
  expected: "☄",
  actual: "☄"
}, {
  expected: "✨",
  actual: "✨"
}, {
  expected: "⚽",
  actual: "⚽"
}, {
  expected: "⚾",
  actual: "⚾"
}, {
  expected: "⛳",
  actual: "⛳"
}, {
  expected: "⛸️",
  actual: "⛸"
}, {
  expected: "⛸",
  actual: "⛸"
}, {
  expected: "♠️",
  actual: "♠"
}, {
  expected: "♠",
  actual: "♠"
}, {
  expected: "♥️",
  actual: "♥"
}, {
  expected: "♥",
  actual: "♥"
}, {
  expected: "♦️",
  actual: "♦"
}, {
  expected: "♦",
  actual: "♦"
}, {
  expected: "♣️",
  actual: "♣"
}, {
  expected: "♣",
  actual: "♣"
}, {
  expected: "♟️",
  actual: "♟"
}, {
  expected: "♟",
  actual: "♟"
}, {
  expected: "⛑️",
  actual: "⛑"
}, {
  expected: "⛑",
  actual: "⛑"
}, {
  expected: "☎️",
  actual: "☎"
}, {
  expected: "☎",
  actual: "☎"
}, {
  expected: "⌨️",
  actual: "⌨"
}, {
  expected: "⌨",
  actual: "⌨"
}, {
  expected: "✉️",
  actual: "✉"
}, {
  expected: "✉",
  actual: "✉"
}, {
  expected: "✏️",
  actual: "✏"
}, {
  expected: "✏",
  actual: "✏"
}, {
  expected: "✒️",
  actual: "✒"
}, {
  expected: "✒",
  actual: "✒"
}, {
  expected: "✂️",
  actual: "✂"
}, {
  expected: "✂",
  actual: "✂"
}, {
  expected: "⛏️",
  actual: "⛏"
}, {
  expected: "⛏",
  actual: "⛏"
}, {
  expected: "⚒️",
  actual: "⚒"
}, {
  expected: "⚒",
  actual: "⚒"
}, {
  expected: "⚔️",
  actual: "⚔"
}, {
  expected: "⚔",
  actual: "⚔"
}, {
  expected: "⚙️",
  actual: "⚙"
}, {
  expected: "⚙",
  actual: "⚙"
}, {
  expected: "⚖️",
  actual: "⚖"
}, {
  expected: "⚖",
  actual: "⚖"
}, {
  expected: "⛓️",
  actual: "⛓"
}, {
  expected: "⛓",
  actual: "⛓"
}, {
  expected: "⚗️",
  actual: "⚗"
}, {
  expected: "⚗",
  actual: "⚗"
}, {
  expected: "⚰️",
  actual: "⚰"
}, {
  expected: "⚰",
  actual: "⚰"
}, {
  expected: "⚱️",
  actual: "⚱"
}, {
  expected: "⚱",
  actual: "⚱"
}, {
  expected: "♿",
  actual: "♿"
}, {
  expected: "⚠️",
  actual: "⚠"
}, {
  expected: "⚠",
  actual: "⚠"
}, {
  expected: "⛔",
  actual: "⛔"
}, {
  expected: "☢️",
  actual: "☢"
}, {
  expected: "☢",
  actual: "☢"
}, {
  expected: "☣️",
  actual: "☣"
}, {
  expected: "☣",
  actual: "☣"
}, {
  expected: "⬆️",
  actual: "⬆"
}, {
  expected: "⬆",
  actual: "⬆"
}, {
  expected: "↗️",
  actual: "↗"
}, {
  expected: "↗",
  actual: "↗"
}, {
  expected: "➡️",
  actual: "➡"
}, {
  expected: "➡",
  actual: "➡"
}, {
  expected: "↘️",
  actual: "↘"
}, {
  expected: "↘",
  actual: "↘"
}, {
  expected: "⬇️",
  actual: "⬇"
}, {
  expected: "⬇",
  actual: "⬇"
}, {
  expected: "↙️",
  actual: "↙"
}, {
  expected: "↙",
  actual: "↙"
}, {
  expected: "⬅️",
  actual: "⬅"
}, {
  expected: "⬅",
  actual: "⬅"
}, {
  expected: "↖️",
  actual: "↖"
}, {
  expected: "↖",
  actual: "↖"
}, {
  expected: "↕️",
  actual: "↕"
}, {
  expected: "↕",
  actual: "↕"
}, {
  expected: "↔️",
  actual: "↔"
}, {
  expected: "↔",
  actual: "↔"
}, {
  expected: "↩️",
  actual: "↩"
}, {
  expected: "↩",
  actual: "↩"
}, {
  expected: "↪️",
  actual: "↪"
}, {
  expected: "↪",
  actual: "↪"
}, {
  expected: "⤴️",
  actual: "⤴"
}, {
  expected: "⤴",
  actual: "⤴"
}, {
  expected: "⤵️",
  actual: "⤵"
}, {
  expected: "⤵",
  actual: "⤵"
}, {
  expected: "⚛️",
  actual: "⚛"
}, {
  expected: "⚛",
  actual: "⚛"
}, {
  expected: "✡️",
  actual: "✡"
}, {
  expected: "✡",
  actual: "✡"
}, {
  expected: "☸️",
  actual: "☸"
}, {
  expected: "☸",
  actual: "☸"
}, {
  expected: "☯️",
  actual: "☯"
}, {
  expected: "☯",
  actual: "☯"
}, {
  expected: "✝️",
  actual: "✝"
}, {
  expected: "✝",
  actual: "✝"
}, {
  expected: "☦️",
  actual: "☦"
}, {
  expected: "☦",
  actual: "☦"
}, {
  expected: "☪️",
  actual: "☪"
}, {
  expected: "☪",
  actual: "☪"
}, {
  expected: "☮️",
  actual: "☮"
}, {
  expected: "☮",
  actual: "☮"
}, {
  expected: "♈",
  actual: "♈"
}, {
  expected: "♉",
  actual: "♉"
}, {
  expected: "♊",
  actual: "♊"
}, {
  expected: "♋",
  actual: "♋"
}, {
  expected: "♌",
  actual: "♌"
}, {
  expected: "♍",
  actual: "♍"
}, {
  expected: "♎",
  actual: "♎"
}, {
  expected: "♏",
  actual: "♏"
}, {
  expected: "♐",
  actual: "♐"
}, {
  expected: "♑",
  actual: "♑"
}, {
  expected: "♒",
  actual: "♒"
}, {
  expected: "♓",
  actual: "♓"
}, {
  expected: "⛎",
  actual: "⛎"
}, {
  expected: "▶️",
  actual: "▶"
}, {
  expected: "▶",
  actual: "▶"
}, {
  expected: "⏩",
  actual: "⏩"
}, {
  expected: "⏭️",
  actual: "⏭"
}, {
  expected: "⏭",
  actual: "⏭"
}, {
  expected: "⏯️",
  actual: "⏯"
}, {
  expected: "⏯",
  actual: "⏯"
}, {
  expected: "◀️",
  actual: "◀"
}, {
  expected: "◀",
  actual: "◀"
}, {
  expected: "⏪",
  actual: "⏪"
}, {
  expected: "⏮️",
  actual: "⏮"
}, {
  expected: "⏮",
  actual: "⏮"
}, {
  expected: "⏫",
  actual: "⏫"
}, {
  expected: "⏬",
  actual: "⏬"
}, {
  expected: "⏸️",
  actual: "⏸"
}, {
  expected: "⏸",
  actual: "⏸"
}, {
  expected: "⏹️",
  actual: "⏹"
}, {
  expected: "⏹",
  actual: "⏹"
}, {
  expected: "⏺️",
  actual: "⏺"
}, {
  expected: "⏺",
  actual: "⏺"
}, {
  expected: "⏏️",
  actual: "⏏"
}, {
  expected: "⏏",
  actual: "⏏"
}, {
  expected: "♀️",
  actual: "♀"
}, {
  expected: "♀",
  actual: "♀"
}, {
  expected: "♂️",
  actual: "♂"
}, {
  expected: "♂",
  actual: "♂"
}, {
  expected: "⚧️",
  actual: "⚧"
}, {
  expected: "⚧",
  actual: "⚧"
}, {
  expected: "✖️",
  actual: "✖"
}, {
  expected: "✖",
  actual: "✖"
}, {
  expected: "➕",
  actual: "➕"
}, {
  expected: "➖",
  actual: "➖"
}, {
  expected: "➗",
  actual: "➗"
}, {
  expected: "♾️",
  actual: "♾"
}, {
  expected: "♾",
  actual: "♾"
}, {
  expected: "‼️",
  actual: "‼"
}, {
  expected: "‼",
  actual: "‼"
}, {
  expected: "⁉️",
  actual: "⁉"
}, {
  expected: "⁉",
  actual: "⁉"
}, {
  expected: "❓",
  actual: "❓"
}, {
  expected: "❔",
  actual: "❔"
}, {
  expected: "❕",
  actual: "❕"
}, {
  expected: "❗",
  actual: "❗"
}, {
  expected: "〰️",
  actual: "〰"
}, {
  expected: "〰",
  actual: "〰"
}, {
  expected: "⚕️",
  actual: "⚕"
}, {
  expected: "⚕",
  actual: "⚕"
}, {
  expected: "♻️",
  actual: "♻"
}, {
  expected: "♻",
  actual: "♻"
}, {
  expected: "⚜️",
  actual: "⚜"
}, {
  expected: "⚜",
  actual: "⚜"
}, {
  expected: "⭕",
  actual: "⭕"
}, {
  expected: "✅",
  actual: "✅"
}, {
  expected: "☑️",
  actual: "☑"
}, {
  expected: "☑",
  actual: "☑"
}, {
  expected: "✔️",
  actual: "✔"
}, {
  expected: "✔",
  actual: "✔"
}, {
  expected: "❌",
  actual: "❌"
}, {
  expected: "❎",
  actual: "❎"
}, {
  expected: "➰",
  actual: "➰"
}, {
  expected: "➿",
  actual: "➿"
}, {
  expected: "〽️",
  actual: "〽"
}, {
  expected: "〽",
  actual: "〽"
}, {
  expected: "✳️",
  actual: "✳"
}, {
  expected: "✳",
  actual: "✳"
}, {
  expected: "✴️",
  actual: "✴"
}, {
  expected: "✴",
  actual: "✴"
}, {
  expected: "❇️",
  actual: "❇"
}, {
  expected: "❇",
  actual: "❇"
}, {
  expected: "™️",
  actual: "™"
}, {
  expected: "™",
  actual: "™"
}, {
  expected: "ℹ️",
  actual: "ℹ"
}, {
  expected: "ℹ",
  actual: "ℹ"
}, {
  expected: "Ⓜ️",
  actual: "Ⓜ"
}, {
  expected: "Ⓜ",
  actual: "Ⓜ"
}, {
  expected: "㊗️",
  actual: "㊗"
}, {
  expected: "㊗",
  actual: "㊗"
}, {
  expected: "㊙️",
  actual: "㊙"
}, {
  expected: "㊙",
  actual: "㊙"
}, {
  expected: "⚫",
  actual: "⚫"
}, {
  expected: "⚪",
  actual: "⚪"
}, {
  expected: "⬛",
  actual: "⬛"
}, {
  expected: "⬜",
  actual: "⬜"
}, {
  expected: "◼️",
  actual: "◼"
}, {
  expected: "◼",
  actual: "◼"
}, {
  expected: "◻️",
  actual: "◻"
}, {
  expected: "◻",
  actual: "◻"
}, {
  expected: "◾",
  actual: "◾"
}, {
  expected: "◽",
  actual: "◽"
}, {
  expected: "▪️",
  actual: "▪"
}, {
  expected: "▪",
  actual: "▪"
}, {
  expected: "▫️",
  actual: "▫"
}, {
  expected: "▫",
  actual: "▫"
}, {
  expected: "©️",
  actual: "©"
}, {
  expected: "©",
  actual: "©"
}, {
  expected: "®️",
  actual: "®"
}, {
  expected: "®",
  actual: "®"
}];
const splitter = new GraphemeSplitter();

/**
* @param {string} broken
* @returns {string}
*/
function fix(broken) {
  let fixed = "";
  outer: while (broken.length > 0) {
    for (const {
      expected,
      actual
    } of unicode_map.values()) {
      if (broken.startsWith(actual)) {
        fixed += expected;
        broken = broken.slice(actual.length);
        continue outer;
      }
    }
    let grapheme = splitter.iterateGraphemes(broken).next().value;
    fixed += grapheme;
    broken = broken.slice(grapheme.length);
  }
  return fixed;
}

var dist = function (e) {
  var t = {};
  function a(r) {
    if (t[r]) return t[r].exports;
    var n = t[r] = {
      i: r,
      l: !1,
      exports: {}
    };
    return e[r].call(n.exports, n, n.exports, a), n.l = !0, n.exports;
  }
  return a.m = e, a.c = t, a.d = function (e, t, r) {
    a.o(e, t) || Object.defineProperty(e, t, {
      enumerable: !0,
      get: r
    });
  }, a.r = function (e) {
    "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(e, Symbol.toStringTag, {
      value: "Module"
    }), Object.defineProperty(e, "__esModule", {
      value: !0
    });
  }, a.t = function (e, t) {
    if (1 & t && (e = a(e)), 8 & t) return e;
    if (4 & t && "object" == typeof e && e && e.__esModule) return e;
    var r = Object.create(null);
    if (a.r(r), Object.defineProperty(r, "default", {
      enumerable: !0,
      value: e
    }), 2 & t && "string" != typeof e) for (var n in e) a.d(r, n, function (t) {
      return e[t];
    }.bind(null, n));
    return r;
  }, a.n = function (e) {
    var t = e && e.__esModule ? function () {
      return e.default;
    } : function () {
      return e;
    };
    return a.d(t, "a", t), t;
  }, a.o = function (e, t) {
    return Object.prototype.hasOwnProperty.call(e, t);
  }, a.p = "", a(a.s = 4);
}([function (e, t) {
  e.exports = require$$0;
}, function (e, t, a) {
  e.exports = a(2)();
}, function (e, t, a) {

  var r = a(3);
  function n() {}
  e.exports = function () {
    function e(e, t, a, n, i, c) {
      if (c !== r) {
        var l = new Error("Calling PropTypes validators directly is not supported by the `prop-types` package. Use PropTypes.checkPropTypes() to call them. Read more at http://fb.me/use-check-prop-types");
        throw l.name = "Invariant Violation", l;
      }
    }
    function t() {
      return e;
    }
    e.isRequired = e;
    var a = {
      array: e,
      bool: e,
      func: e,
      number: e,
      object: e,
      string: e,
      symbol: e,
      any: e,
      arrayOf: t,
      element: e,
      instanceOf: t,
      node: e,
      objectOf: t,
      oneOf: t,
      oneOfType: t,
      shape: t,
      exact: t
    };
    return a.checkPropTypes = n, a.PropTypes = a, a;
  };
}, function (e, t, a) {

  e.exports = "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED";
}, function (e, t, a) {

  a.r(t);
  var r = a(0),
    n = a.n(r),
    i = a(1),
    c = a.n(i);
  function l() {
    return (l = Object.assign || function (e) {
      for (var t = 1; t < arguments.length; t++) {
        var a = arguments[t];
        for (var r in a) Object.prototype.hasOwnProperty.call(a, r) && (e[r] = a[r]);
      }
      return e;
    }).apply(this, arguments);
  }
  function o(e, t) {
    if (null == e) return {};
    var a,
      r,
      n = function (e, t) {
        if (null == e) return {};
        var a,
          r,
          n = {},
          i = Object.keys(e);
        for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || (n[a] = e[a]);
        return n;
      }(e, t);
    if (Object.getOwnPropertySymbols) {
      var i = Object.getOwnPropertySymbols(e);
      for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || Object.prototype.propertyIsEnumerable.call(e, a) && (n[a] = e[a]);
    }
    return n;
  }
  var s = function (e) {
    var t = e.className,
      a = o(e, ["className"]);
    return n.a.createElement("svg", l({
      width: 55,
      height: 80,
      fill: "#FFF",
      viewBox: "0 0 55 80",
      className: "svg-loaders-svg".concat(t ? " ".concat(t) : "")
    }, a), n.a.createElement("g", {
      transform: "matrix(1 0 0 -1 0 80)"
    }, n.a.createElement("rect", {
      width: 10,
      height: 20,
      rx: 3
    }, n.a.createElement("animate", {
      attributeName: "height",
      begin: "0s",
      dur: "4.3s",
      values: "20;45;57;80;64;32;66;45;64;23;66;13;64;56;34;34;2;23;76;79;20",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("rect", {
      x: 15,
      width: 10,
      height: 80,
      rx: 3
    }, n.a.createElement("animate", {
      attributeName: "height",
      begin: "0s",
      dur: "2s",
      values: "80;55;33;5;75;23;73;33;12;14;60;80",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("rect", {
      x: 30,
      width: 10,
      height: 50,
      rx: 3
    }, n.a.createElement("animate", {
      attributeName: "height",
      begin: "0s",
      dur: "1.4s",
      values: "50;34;78;23;56;23;34;76;80;54;21;50",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("rect", {
      x: 45,
      width: 10,
      height: 30,
      rx: 3
    }, n.a.createElement("animate", {
      attributeName: "height",
      begin: "0s",
      dur: "2s",
      values: "30;45;13;80;56;72;45;76;34;23;67;30",
      calcMode: "linear",
      repeatCount: "indefinite"
    }))));
  };
  function u() {
    return (u = Object.assign || function (e) {
      for (var t = 1; t < arguments.length; t++) {
        var a = arguments[t];
        for (var r in a) Object.prototype.hasOwnProperty.call(a, r) && (e[r] = a[r]);
      }
      return e;
    }).apply(this, arguments);
  }
  function f(e, t) {
    if (null == e) return {};
    var a,
      r,
      n = function (e, t) {
        if (null == e) return {};
        var a,
          r,
          n = {},
          i = Object.keys(e);
        for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || (n[a] = e[a]);
        return n;
      }(e, t);
    if (Object.getOwnPropertySymbols) {
      var i = Object.getOwnPropertySymbols(e);
      for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || Object.prototype.propertyIsEnumerable.call(e, a) && (n[a] = e[a]);
    }
    return n;
  }
  s.propTypes = {
    className: c.a.string
  }, s.defaultProps = {
    className: void 0
  };
  var m = function (e) {
    var t = e.className,
      a = f(e, ["className"]);
    return n.a.createElement("svg", u({
      width: 57,
      height: 57,
      stroke: "#fff",
      viewBox: "0 0 57 57",
      className: "svg-loaders-svg".concat(t ? " ".concat(t) : "")
    }, a), n.a.createElement("g", {
      transform: "translate(1 1)",
      strokeWidth: 2,
      fill: "none",
      fillRule: "evenodd"
    }, n.a.createElement("circle", {
      cx: 5,
      cy: 50,
      r: 5
    }, n.a.createElement("animate", {
      attributeName: "cy",
      begin: "0s",
      dur: "2.2s",
      values: "50;5;50;50",
      calcMode: "linear",
      repeatCount: "indefinite"
    }), n.a.createElement("animate", {
      attributeName: "cx",
      begin: "0s",
      dur: "2.2s",
      values: "5;27;49;5",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      cx: 27,
      cy: 5,
      r: 5
    }, n.a.createElement("animate", {
      attributeName: "cy",
      begin: "0s",
      dur: "2.2s",
      from: 5,
      to: 5,
      values: "5;50;50;5",
      calcMode: "linear",
      repeatCount: "indefinite"
    }), n.a.createElement("animate", {
      attributeName: "cx",
      begin: "0s",
      dur: "2.2s",
      from: 27,
      to: 27,
      values: "27;49;5;27",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      cx: 49,
      cy: 50,
      r: 5
    }, n.a.createElement("animate", {
      attributeName: "cy",
      begin: "0s",
      dur: "2.2s",
      values: "50;50;5;50",
      calcMode: "linear",
      repeatCount: "indefinite"
    }), n.a.createElement("animate", {
      attributeName: "cx",
      from: 49,
      to: 49,
      begin: "0s",
      dur: "2.2s",
      values: "49;5;27;49",
      calcMode: "linear",
      repeatCount: "indefinite"
    }))));
  };
  function p() {
    return (p = Object.assign || function (e) {
      for (var t = 1; t < arguments.length; t++) {
        var a = arguments[t];
        for (var r in a) Object.prototype.hasOwnProperty.call(a, r) && (e[r] = a[r]);
      }
      return e;
    }).apply(this, arguments);
  }
  function d(e, t) {
    if (null == e) return {};
    var a,
      r,
      n = function (e, t) {
        if (null == e) return {};
        var a,
          r,
          n = {},
          i = Object.keys(e);
        for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || (n[a] = e[a]);
        return n;
      }(e, t);
    if (Object.getOwnPropertySymbols) {
      var i = Object.getOwnPropertySymbols(e);
      for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || Object.prototype.propertyIsEnumerable.call(e, a) && (n[a] = e[a]);
    }
    return n;
  }
  m.propTypes = {
    className: c.a.string
  }, m.defaultProps = {
    className: void 0
  };
  var y = function (e) {
    var t = e.className,
      a = d(e, ["className"]);
    return n.a.createElement("svg", p({
      width: 135,
      height: 140,
      fill: "#fff",
      viewBox: "0 0 135 140",
      className: "svg-loaders-svg".concat(t ? " ".concat(t) : "")
    }, a), n.a.createElement("rect", {
      y: 10,
      width: 15,
      height: 120,
      rx: 6
    }, n.a.createElement("animate", {
      attributeName: "height",
      begin: "0.5s",
      dur: "1s",
      values: "120;110;100;90;80;70;60;50;40;140;120",
      calcMode: "linear",
      repeatCount: "indefinite"
    }), n.a.createElement("animate", {
      attributeName: "y",
      begin: "0.5s",
      dur: "1s",
      values: "10;15;20;25;30;35;40;45;50;0;10",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("rect", {
      x: 30,
      y: 10,
      width: 15,
      height: 120,
      rx: 6
    }, n.a.createElement("animate", {
      attributeName: "height",
      begin: "0.25s",
      dur: "1s",
      values: "120;110;100;90;80;70;60;50;40;140;120",
      calcMode: "linear",
      repeatCount: "indefinite"
    }), n.a.createElement("animate", {
      attributeName: "y",
      begin: "0.25s",
      dur: "1s",
      values: "10;15;20;25;30;35;40;45;50;0;10",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("rect", {
      x: 60,
      width: 15,
      height: 140,
      rx: 6
    }, n.a.createElement("animate", {
      attributeName: "height",
      begin: "0s",
      dur: "1s",
      values: "120;110;100;90;80;70;60;50;40;140;120",
      calcMode: "linear",
      repeatCount: "indefinite"
    }), n.a.createElement("animate", {
      attributeName: "y",
      begin: "0s",
      dur: "1s",
      values: "10;15;20;25;30;35;40;45;50;0;10",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("rect", {
      x: 90,
      y: 10,
      width: 15,
      height: 120,
      rx: 6
    }, n.a.createElement("animate", {
      attributeName: "height",
      begin: "0.25s",
      dur: "1s",
      values: "120;110;100;90;80;70;60;50;40;140;120",
      calcMode: "linear",
      repeatCount: "indefinite"
    }), n.a.createElement("animate", {
      attributeName: "y",
      begin: "0.25s",
      dur: "1s",
      values: "10;15;20;25;30;35;40;45;50;0;10",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("rect", {
      x: 120,
      y: 10,
      width: 15,
      height: 120,
      rx: 6
    }, n.a.createElement("animate", {
      attributeName: "height",
      begin: "0.5s",
      dur: "1s",
      values: "120;110;100;90;80;70;60;50;40;140;120",
      calcMode: "linear",
      repeatCount: "indefinite"
    }), n.a.createElement("animate", {
      attributeName: "y",
      begin: "0.5s",
      dur: "1s",
      values: "10;15;20;25;30;35;40;45;50;0;10",
      calcMode: "linear",
      repeatCount: "indefinite"
    })));
  };
  function b() {
    return (b = Object.assign || function (e) {
      for (var t = 1; t < arguments.length; t++) {
        var a = arguments[t];
        for (var r in a) Object.prototype.hasOwnProperty.call(a, r) && (e[r] = a[r]);
      }
      return e;
    }).apply(this, arguments);
  }
  function v(e, t) {
    if (null == e) return {};
    var a,
      r,
      n = function (e, t) {
        if (null == e) return {};
        var a,
          r,
          n = {},
          i = Object.keys(e);
        for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || (n[a] = e[a]);
        return n;
      }(e, t);
    if (Object.getOwnPropertySymbols) {
      var i = Object.getOwnPropertySymbols(e);
      for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || Object.prototype.propertyIsEnumerable.call(e, a) && (n[a] = e[a]);
    }
    return n;
  }
  y.propTypes = {
    className: c.a.string
  }, y.defaultProps = {
    className: void 0
  };
  var g = function (e) {
    var t = e.className,
      a = v(e, ["className"]);
    return n.a.createElement("svg", b({
      width: 135,
      height: 135,
      fill: "#fff",
      viewBox: "0 0 135 135",
      className: "svg-loaders-svg".concat(t ? " ".concat(t) : "")
    }, a), n.a.createElement("path", {
      d: "M67.447 58c5.523 0 10-4.477 10-10s-4.477-10-10-10-10 4.477-10 10 4.477 10 10 10zm9.448 9.447c0 5.523 4.477 10 10 10 5.522 0 10-4.477 10-10s-4.478-10-10-10c-5.523 0-10 4.477-10 10zm-9.448 9.448c-5.523 0-10 4.477-10 10 0 5.522 4.477 10 10 10s10-4.478 10-10c0-5.523-4.477-10-10-10zM58 67.447c0-5.523-4.477-10-10-10s-10 4.477-10 10 4.477 10 10 10 10-4.477 10-10z"
    }, n.a.createElement("animateTransform", {
      attributeName: "transform",
      type: "rotate",
      from: "0 67 67",
      to: "-360 67 67",
      dur: "2.5s",
      repeatCount: "indefinite"
    })), n.a.createElement("path", {
      d: "M28.19 40.31c6.627 0 12-5.374 12-12 0-6.628-5.373-12-12-12-6.628 0-12 5.372-12 12 0 6.626 5.372 12 12 12zm30.72-19.825c4.686 4.687 12.284 4.687 16.97 0 4.686-4.686 4.686-12.284 0-16.97-4.686-4.687-12.284-4.687-16.97 0-4.687 4.686-4.687 12.284 0 16.97zm35.74 7.705c0 6.627 5.37 12 12 12 6.626 0 12-5.373 12-12 0-6.628-5.374-12-12-12-6.63 0-12 5.372-12 12zm19.822 30.72c-4.686 4.686-4.686 12.284 0 16.97 4.687 4.686 12.285 4.686 16.97 0 4.687-4.686 4.687-12.284 0-16.97-4.685-4.687-12.283-4.687-16.97 0zm-7.704 35.74c-6.627 0-12 5.37-12 12 0 6.626 5.373 12 12 12s12-5.374 12-12c0-6.63-5.373-12-12-12zm-30.72 19.822c-4.686-4.686-12.284-4.686-16.97 0-4.686 4.687-4.686 12.285 0 16.97 4.686 4.687 12.284 4.687 16.97 0 4.687-4.685 4.687-12.283 0-16.97zm-35.74-7.704c0-6.627-5.372-12-12-12-6.626 0-12 5.373-12 12s5.374 12 12 12c6.628 0 12-5.373 12-12zm-19.823-30.72c4.687-4.686 4.687-12.284 0-16.97-4.686-4.686-12.284-4.686-16.97 0-4.687 4.686-4.687 12.284 0 16.97 4.686 4.687 12.284 4.687 16.97 0z"
    }, n.a.createElement("animateTransform", {
      attributeName: "transform",
      type: "rotate",
      from: "0 67 67",
      to: "360 67 67",
      dur: "8s",
      repeatCount: "indefinite"
    })));
  };
  function h() {
    return (h = Object.assign || function (e) {
      for (var t = 1; t < arguments.length; t++) {
        var a = arguments[t];
        for (var r in a) Object.prototype.hasOwnProperty.call(a, r) && (e[r] = a[r]);
      }
      return e;
    }).apply(this, arguments);
  }
  function O(e, t) {
    if (null == e) return {};
    var a,
      r,
      n = function (e, t) {
        if (null == e) return {};
        var a,
          r,
          n = {},
          i = Object.keys(e);
        for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || (n[a] = e[a]);
        return n;
      }(e, t);
    if (Object.getOwnPropertySymbols) {
      var i = Object.getOwnPropertySymbols(e);
      for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || Object.prototype.propertyIsEnumerable.call(e, a) && (n[a] = e[a]);
    }
    return n;
  }
  g.propTypes = {
    className: c.a.string
  }, g.defaultProps = {
    className: void 0
  };
  var E = function (e) {
    var t = e.className,
      a = O(e, ["className"]);
    return n.a.createElement("svg", h({
      width: 105,
      height: 105,
      fill: "#fff",
      viewBox: "0 0 105 105",
      className: "svg-loaders-svg".concat(t ? " ".concat(t) : "")
    }, a), n.a.createElement("circle", {
      cx: 12.5,
      cy: 12.5,
      r: 12.5
    }, n.a.createElement("animate", {
      attributeName: "fill-opacity",
      begin: "0s",
      dur: "1s",
      values: "1;.2;1",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      cx: 12.5,
      cy: 52.5,
      r: 12.5,
      fillOpacity: .5
    }, n.a.createElement("animate", {
      attributeName: "fill-opacity",
      begin: "100ms",
      dur: "1s",
      values: "1;.2;1",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      cx: 52.5,
      cy: 12.5,
      r: 12.5
    }, n.a.createElement("animate", {
      attributeName: "fill-opacity",
      begin: "300ms",
      dur: "1s",
      values: "1;.2;1",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      cx: 52.5,
      cy: 52.5,
      r: 12.5
    }, n.a.createElement("animate", {
      attributeName: "fill-opacity",
      begin: "600ms",
      dur: "1s",
      values: "1;.2;1",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      cx: 92.5,
      cy: 12.5,
      r: 12.5
    }, n.a.createElement("animate", {
      attributeName: "fill-opacity",
      begin: "800ms",
      dur: "1s",
      values: "1;.2;1",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      cx: 92.5,
      cy: 52.5,
      r: 12.5
    }, n.a.createElement("animate", {
      attributeName: "fill-opacity",
      begin: "400ms",
      dur: "1s",
      values: "1;.2;1",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      cx: 12.5,
      cy: 92.5,
      r: 12.5
    }, n.a.createElement("animate", {
      attributeName: "fill-opacity",
      begin: "700ms",
      dur: "1s",
      values: "1;.2;1",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      cx: 52.5,
      cy: 92.5,
      r: 12.5
    }, n.a.createElement("animate", {
      attributeName: "fill-opacity",
      begin: "500ms",
      dur: "1s",
      values: "1;.2;1",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      cx: 92.5,
      cy: 92.5,
      r: 12.5
    }, n.a.createElement("animate", {
      attributeName: "fill-opacity",
      begin: "200ms",
      dur: "1s",
      values: "1;.2;1",
      calcMode: "linear",
      repeatCount: "indefinite"
    })));
  };
  function N() {
    return (N = Object.assign || function (e) {
      for (var t = 1; t < arguments.length; t++) {
        var a = arguments[t];
        for (var r in a) Object.prototype.hasOwnProperty.call(a, r) && (e[r] = a[r]);
      }
      return e;
    }).apply(this, arguments);
  }
  function x(e, t) {
    if (null == e) return {};
    var a,
      r,
      n = function (e, t) {
        if (null == e) return {};
        var a,
          r,
          n = {},
          i = Object.keys(e);
        for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || (n[a] = e[a]);
        return n;
      }(e, t);
    if (Object.getOwnPropertySymbols) {
      var i = Object.getOwnPropertySymbols(e);
      for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || Object.prototype.propertyIsEnumerable.call(e, a) && (n[a] = e[a]);
    }
    return n;
  }
  E.propTypes = {
    className: c.a.string
  }, E.defaultProps = {
    className: void 0
  };
  var j = function (e) {
    var t = e.className,
      a = x(e, ["className"]);
    return n.a.createElement("svg", N({
      width: 140,
      height: 64,
      fill: "#fff",
      viewBox: "0 0 140 64",
      className: "svg-loaders-svg".concat(t ? " ".concat(t) : "")
    }, a), n.a.createElement("path", {
      d: "M30.262 57.02L7.195 40.723c-5.84-3.976-7.56-12.06-3.842-18.063 3.715-6 11.467-7.65 17.306-3.68l4.52 3.76 2.6-5.274c3.717-6.002 11.47-7.65 17.305-3.68 5.84 3.97 7.56 12.054 3.842 18.062L34.49 56.118c-.897 1.512-2.793 1.915-4.228.9z",
      fillOpacity: .5
    }, n.a.createElement("animate", {
      attributeName: "fill-opacity",
      begin: "0s",
      dur: "1.4s",
      values: "0.5;1;0.5",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("path", {
      d: "M105.512 56.12l-14.44-24.272c-3.716-6.008-1.996-14.093 3.843-18.062 5.835-3.97 13.588-2.322 17.306 3.68l2.6 5.274 4.52-3.76c5.84-3.97 13.592-2.32 17.307 3.68 3.718 6.003 1.998 14.088-3.842 18.064L109.74 57.02c-1.434 1.014-3.33.61-4.228-.9z",
      fillOpacity: .5
    }, n.a.createElement("animate", {
      attributeName: "fill-opacity",
      begin: "0.7s",
      dur: "1.4s",
      values: "0.5;1;0.5",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("path", {
      d: "M67.408 57.834l-23.01-24.98c-5.864-6.15-5.864-16.108 0-22.248 5.86-6.14 15.37-6.14 21.234 0L70 16.168l4.368-5.562c5.863-6.14 15.375-6.14 21.235 0 5.863 6.14 5.863 16.098 0 22.247l-23.007 24.98c-1.43 1.556-3.757 1.556-5.188 0z"
    }));
  };
  function w() {
    return (w = Object.assign || function (e) {
      for (var t = 1; t < arguments.length; t++) {
        var a = arguments[t];
        for (var r in a) Object.prototype.hasOwnProperty.call(a, r) && (e[r] = a[r]);
      }
      return e;
    }).apply(this, arguments);
  }
  function C(e, t) {
    if (null == e) return {};
    var a,
      r,
      n = function (e, t) {
        if (null == e) return {};
        var a,
          r,
          n = {},
          i = Object.keys(e);
        for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || (n[a] = e[a]);
        return n;
      }(e, t);
    if (Object.getOwnPropertySymbols) {
      var i = Object.getOwnPropertySymbols(e);
      for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || Object.prototype.propertyIsEnumerable.call(e, a) && (n[a] = e[a]);
    }
    return n;
  }
  j.propTypes = {
    className: c.a.string
  }, j.defaultProps = {
    className: void 0
  };
  var M = function (e) {
    var t = e.className,
      a = C(e, ["className"]);
    return n.a.createElement("svg", w({
      width: 38,
      height: 38,
      stroke: "#fff",
      viewBox: "0 0 38 38",
      className: "svg-loaders-svg".concat(t ? " ".concat(t) : "")
    }, a), n.a.createElement("g", {
      transform: "translate(1 1)",
      strokeWidth: 2,
      fill: "none",
      fillRule: "evenodd"
    }, n.a.createElement("circle", {
      strokeOpacity: .5,
      cx: 18,
      cy: 18,
      r: 18
    }), n.a.createElement("path", {
      d: "M36 18c0-9.94-8.06-18-18-18"
    }, n.a.createElement("animateTransform", {
      attributeName: "transform",
      type: "rotate",
      from: "0 18 18",
      to: "360 18 18",
      dur: "1s",
      repeatCount: "indefinite"
    }))));
  };
  function P() {
    return (P = Object.assign || function (e) {
      for (var t = 1; t < arguments.length; t++) {
        var a = arguments[t];
        for (var r in a) Object.prototype.hasOwnProperty.call(a, r) && (e[r] = a[r]);
      }
      return e;
    }).apply(this, arguments);
  }
  function k(e, t) {
    if (null == e) return {};
    var a,
      r,
      n = function (e, t) {
        if (null == e) return {};
        var a,
          r,
          n = {},
          i = Object.keys(e);
        for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || (n[a] = e[a]);
        return n;
      }(e, t);
    if (Object.getOwnPropertySymbols) {
      var i = Object.getOwnPropertySymbols(e);
      for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || Object.prototype.propertyIsEnumerable.call(e, a) && (n[a] = e[a]);
    }
    return n;
  }
  M.propTypes = {
    className: c.a.string
  }, M.defaultProps = {
    className: void 0
  };
  var S = function (e) {
    var t = e.className,
      a = k(e, ["className"]);
    return n.a.createElement("svg", P({
      width: 44,
      height: 44,
      stroke: "#fff",
      viewBox: "0 0 44 44",
      className: "svg-loaders-svg".concat(t ? " ".concat(t) : "")
    }, a), n.a.createElement("g", {
      fill: "none",
      fillRule: "evenodd",
      strokeWidth: 2
    }, n.a.createElement("circle", {
      cx: 22,
      cy: 22,
      r: 1
    }, n.a.createElement("animate", {
      attributeName: "r",
      begin: "0s",
      dur: "1.8s",
      values: "1; 20",
      calcMode: "spline",
      keyTimes: "0; 1",
      keySplines: "0.165, 0.84, 0.44, 1",
      repeatCount: "indefinite"
    }), n.a.createElement("animate", {
      attributeName: "stroke-opacity",
      begin: "0s",
      dur: "1.8s",
      values: "1; 0",
      calcMode: "spline",
      keyTimes: "0; 1",
      keySplines: "0.3, 0.61, 0.355, 1",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      cx: 22,
      cy: 22,
      r: 1
    }, n.a.createElement("animate", {
      attributeName: "r",
      begin: "-0.9s",
      dur: "1.8s",
      values: "1; 20",
      calcMode: "spline",
      keyTimes: "0; 1",
      keySplines: "0.165, 0.84, 0.44, 1",
      repeatCount: "indefinite"
    }), n.a.createElement("animate", {
      attributeName: "stroke-opacity",
      begin: "-0.9s",
      dur: "1.8s",
      values: "1; 0",
      calcMode: "spline",
      keyTimes: "0; 1",
      keySplines: "0.3, 0.61, 0.355, 1",
      repeatCount: "indefinite"
    }))));
  };
  function T() {
    return (T = Object.assign || function (e) {
      for (var t = 1; t < arguments.length; t++) {
        var a = arguments[t];
        for (var r in a) Object.prototype.hasOwnProperty.call(a, r) && (e[r] = a[r]);
      }
      return e;
    }).apply(this, arguments);
  }
  function _(e, t) {
    if (null == e) return {};
    var a,
      r,
      n = function (e, t) {
        if (null == e) return {};
        var a,
          r,
          n = {},
          i = Object.keys(e);
        for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || (n[a] = e[a]);
        return n;
      }(e, t);
    if (Object.getOwnPropertySymbols) {
      var i = Object.getOwnPropertySymbols(e);
      for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || Object.prototype.propertyIsEnumerable.call(e, a) && (n[a] = e[a]);
    }
    return n;
  }
  S.propTypes = {
    className: c.a.string
  }, S.defaultProps = {
    className: void 0
  };
  var I = function (e) {
    var t = e.className,
      a = _(e, ["className"]);
    return n.a.createElement("svg", T({
      width: 45,
      height: 45,
      stroke: "#fff",
      viewBox: "0 0 45 45",
      className: "svg-loaders-svg".concat(t ? " ".concat(t) : "")
    }, a), n.a.createElement("g", {
      fill: "none",
      fillRule: "evenodd",
      transform: "translate(1 1)",
      strokeWidth: 2
    }, n.a.createElement("circle", {
      cx: 22,
      cy: 22,
      r: 6,
      strokeOpacity: 0
    }, n.a.createElement("animate", {
      attributeName: "r",
      begin: "1.5s",
      dur: "3s",
      values: "6;22",
      calcMode: "linear",
      repeatCount: "indefinite"
    }), n.a.createElement("animate", {
      attributeName: "stroke-opacity",
      begin: "1.5s",
      dur: "3s",
      values: "1;0",
      calcMode: "linear",
      repeatCount: "indefinite"
    }), n.a.createElement("animate", {
      attributeName: "stroke-width",
      begin: "1.5s",
      dur: "3s",
      values: "2;0",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      cx: 22,
      cy: 22,
      r: 6,
      strokeOpacity: 0
    }, n.a.createElement("animate", {
      attributeName: "r",
      begin: "3s",
      dur: "3s",
      values: "6;22",
      calcMode: "linear",
      repeatCount: "indefinite"
    }), n.a.createElement("animate", {
      attributeName: "stroke-opacity",
      begin: "3s",
      dur: "3s",
      values: "1;0",
      calcMode: "linear",
      repeatCount: "indefinite"
    }), n.a.createElement("animate", {
      attributeName: "stroke-width",
      begin: "3s",
      dur: "3s",
      values: "2;0",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      cx: 22,
      cy: 22,
      r: 8
    }, n.a.createElement("animate", {
      attributeName: "r",
      begin: "0s",
      dur: "1.5s",
      values: "6;1;2;3;4;5;6",
      calcMode: "linear",
      repeatCount: "indefinite"
    }))));
  };
  function z() {
    return (z = Object.assign || function (e) {
      for (var t = 1; t < arguments.length; t++) {
        var a = arguments[t];
        for (var r in a) Object.prototype.hasOwnProperty.call(a, r) && (e[r] = a[r]);
      }
      return e;
    }).apply(this, arguments);
  }
  function B(e, t) {
    if (null == e) return {};
    var a,
      r,
      n = function (e, t) {
        if (null == e) return {};
        var a,
          r,
          n = {},
          i = Object.keys(e);
        for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || (n[a] = e[a]);
        return n;
      }(e, t);
    if (Object.getOwnPropertySymbols) {
      var i = Object.getOwnPropertySymbols(e);
      for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || Object.prototype.propertyIsEnumerable.call(e, a) && (n[a] = e[a]);
    }
    return n;
  }
  I.propTypes = {
    className: c.a.string
  }, I.defaultProps = {
    className: void 0
  };
  var R = function (e) {
    var t = e.className,
      a = B(e, ["className"]);
    return n.a.createElement("svg", z({
      width: 58,
      height: 58,
      viewBox: "0 0 58 58",
      className: "svg-loaders-svg".concat(t ? " ".concat(t) : "")
    }, a), n.a.createElement("g", {
      transform: "translate(2 1)",
      stroke: "#FFF",
      strokeWidth: 1.5,
      fill: "#fff",
      fillRule: "evenodd"
    }, n.a.createElement("circle", {
      cx: 42.601,
      cy: 11.462,
      r: 5
    }, n.a.createElement("animate", {
      attributeName: "fill-opacity",
      begin: "0s",
      dur: "1.3s",
      values: "1;0;0;0;0;0;0;0",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      cx: 49.063,
      cy: 27.063,
      r: 5,
      fillOpacity: 0
    }, n.a.createElement("animate", {
      attributeName: "fill-opacity",
      begin: "0s",
      dur: "1.3s",
      values: "0;1;0;0;0;0;0;0",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      cx: 42.601,
      cy: 42.663,
      r: 5,
      fillOpacity: 0
    }, n.a.createElement("animate", {
      attributeName: "fill-opacity",
      begin: "0s",
      dur: "1.3s",
      values: "0;0;1;0;0;0;0;0",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      cx: 27,
      cy: 49.125,
      r: 5,
      fillOpacity: 0
    }, n.a.createElement("animate", {
      attributeName: "fill-opacity",
      begin: "0s",
      dur: "1.3s",
      values: "0;0;0;1;0;0;0;0",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      cx: 11.399,
      cy: 42.663,
      r: 5,
      fillOpacity: 0
    }, n.a.createElement("animate", {
      attributeName: "fill-opacity",
      begin: "0s",
      dur: "1.3s",
      values: "0;0;0;0;1;0;0;0",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      cx: 4.938,
      cy: 27.063,
      r: 5,
      fillOpacity: 0
    }, n.a.createElement("animate", {
      attributeName: "fill-opacity",
      begin: "0s",
      dur: "1.3s",
      values: "0;0;0;0;0;1;0;0",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      cx: 11.399,
      cy: 11.462,
      r: 5,
      fillOpacity: 0
    }, n.a.createElement("animate", {
      attributeName: "fill-opacity",
      begin: "0s",
      dur: "1.3s",
      values: "0;0;0;0;0;0;1;0",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      cx: 27,
      cy: 5,
      r: 5,
      fillOpacity: 0
    }, n.a.createElement("animate", {
      attributeName: "fill-opacity",
      begin: "0s",
      dur: "1.3s",
      values: "0;0;0;0;0;0;0;1",
      calcMode: "linear",
      repeatCount: "indefinite"
    }))));
  };
  function F() {
    return (F = Object.assign || function (e) {
      for (var t = 1; t < arguments.length; t++) {
        var a = arguments[t];
        for (var r in a) Object.prototype.hasOwnProperty.call(a, r) && (e[r] = a[r]);
      }
      return e;
    }).apply(this, arguments);
  }
  function W(e, t) {
    if (null == e) return {};
    var a,
      r,
      n = function (e, t) {
        if (null == e) return {};
        var a,
          r,
          n = {},
          i = Object.keys(e);
        for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || (n[a] = e[a]);
        return n;
      }(e, t);
    if (Object.getOwnPropertySymbols) {
      var i = Object.getOwnPropertySymbols(e);
      for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || Object.prototype.propertyIsEnumerable.call(e, a) && (n[a] = e[a]);
    }
    return n;
  }
  R.propTypes = {
    className: c.a.string
  }, R.defaultProps = {
    className: void 0
  };
  var L = function (e) {
    var t = e.className,
      a = W(e, ["className"]);
    return n.a.createElement("svg", F({
      width: 38,
      height: 38,
      viewBox: "0 0 38 38",
      className: "svg-loaders-svg".concat(t ? " ".concat(t) : "")
    }, a), n.a.createElement("defs", null, n.a.createElement("linearGradient", {
      x1: "8.042%",
      y1: "0%",
      x2: "65.682%",
      y2: "23.865%",
      id: "prefix__a"
    }, n.a.createElement("stop", {
      stopColor: "#fff",
      stopOpacity: 0,
      offset: "0%"
    }), n.a.createElement("stop", {
      stopColor: "#fff",
      stopOpacity: .631,
      offset: "63.146%"
    }), n.a.createElement("stop", {
      stopColor: "#fff",
      offset: "100%"
    }))), n.a.createElement("g", {
      transform: "translate(1 1)",
      fill: "none",
      fillRule: "evenodd"
    }, n.a.createElement("path", {
      d: "M36 18c0-9.94-8.06-18-18-18",
      stroke: "url(#prefix__a)",
      strokeWidth: 2
    }, n.a.createElement("animateTransform", {
      attributeName: "transform",
      type: "rotate",
      from: "0 18 18",
      to: "360 18 18",
      dur: "0.9s",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      fill: "#fff",
      cx: 36,
      cy: 18,
      r: 1
    }, n.a.createElement("animateTransform", {
      attributeName: "transform",
      type: "rotate",
      from: "0 18 18",
      to: "360 18 18",
      dur: "0.9s",
      repeatCount: "indefinite"
    }))));
  };
  function D() {
    return (D = Object.assign || function (e) {
      for (var t = 1; t < arguments.length; t++) {
        var a = arguments[t];
        for (var r in a) Object.prototype.hasOwnProperty.call(a, r) && (e[r] = a[r]);
      }
      return e;
    }).apply(this, arguments);
  }
  function q(e, t) {
    if (null == e) return {};
    var a,
      r,
      n = function (e, t) {
        if (null == e) return {};
        var a,
          r,
          n = {},
          i = Object.keys(e);
        for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || (n[a] = e[a]);
        return n;
      }(e, t);
    if (Object.getOwnPropertySymbols) {
      var i = Object.getOwnPropertySymbols(e);
      for (r = 0; r < i.length; r++) a = i[r], t.indexOf(a) >= 0 || Object.prototype.propertyIsEnumerable.call(e, a) && (n[a] = e[a]);
    }
    return n;
  }
  L.propTypes = {
    className: c.a.string
  }, L.defaultProps = {
    className: void 0
  };
  var A = function (e) {
    var t = e.className,
      a = q(e, ["className"]);
    return n.a.createElement("svg", D({
      width: 120,
      height: 30,
      fill: "#fff",
      viewBox: "0 0 120 30",
      className: "svg-loaders-svg".concat(t ? " ".concat(t) : "")
    }, a), n.a.createElement("circle", {
      cx: 15,
      cy: 15,
      r: 15
    }, n.a.createElement("animate", {
      attributeName: "r",
      from: 15,
      to: 15,
      begin: "0s",
      dur: "0.8s",
      values: "15;9;15",
      calcMode: "linear",
      repeatCount: "indefinite"
    }), n.a.createElement("animate", {
      attributeName: "fill-opacity",
      from: 1,
      to: 1,
      begin: "0s",
      dur: "0.8s",
      values: "1;.5;1",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      cx: 60,
      cy: 15,
      r: 9,
      fillOpacity: .3
    }, n.a.createElement("animate", {
      attributeName: "r",
      from: 9,
      to: 9,
      begin: "0s",
      dur: "0.8s",
      values: "9;15;9",
      calcMode: "linear",
      repeatCount: "indefinite"
    }), n.a.createElement("animate", {
      attributeName: "fill-opacity",
      from: .5,
      to: .5,
      begin: "0s",
      dur: "0.8s",
      values: ".5;1;.5",
      calcMode: "linear",
      repeatCount: "indefinite"
    })), n.a.createElement("circle", {
      cx: 105,
      cy: 15,
      r: 15
    }, n.a.createElement("animate", {
      attributeName: "r",
      from: 15,
      to: 15,
      begin: "0s",
      dur: "0.8s",
      values: "15;9;15",
      calcMode: "linear",
      repeatCount: "indefinite"
    }), n.a.createElement("animate", {
      attributeName: "fill-opacity",
      from: 1,
      to: 1,
      begin: "0s",
      dur: "0.8s",
      values: "1;.5;1",
      calcMode: "linear",
      repeatCount: "indefinite"
    })));
  };
  A.propTypes = {
    className: c.a.string
  }, A.defaultProps = {
    className: void 0
  }, a.d(t, "Audio", function () {
    return s;
  }), a.d(t, "BallTriangle", function () {
    return m;
  }), a.d(t, "Bars", function () {
    return y;
  }), a.d(t, "Circles", function () {
    return g;
  }), a.d(t, "Grid", function () {
    return E;
  }), a.d(t, "Hearts", function () {
    return j;
  }), a.d(t, "Oval", function () {
    return M;
  }), a.d(t, "Puff", function () {
    return S;
  }), a.d(t, "Rings", function () {
    return I;
  }), a.d(t, "SpinningCircles", function () {
    return R;
  }), a.d(t, "TailSpin", function () {
    return L;
  }), a.d(t, "ThreeDots", function () {
    return A;
  });
}]);

const React$6 = BdApi.React;
function PKBadge({
  profileMap,
  userHash,
  profile
}) {
  const status = profile.status;
  let onClick = function () {
    profileMap.update(userHash, function (profile) {
      profile.status = ProfileStatus.Stale;
      return profile;
    });
  };
  const linkStyle = {
    color: '#ffffff'
  };
  let content = 'PK';
  if ([ProfileStatus.Updating, ProfileStatus.Requesting, ProfileStatus.Stale].includes(status)) {
    let dotstyle = {
      height: '.4em',
      width: '100%',
      display: 'inline',
      'vertical-align': 'top',
      'padding-top': '0.55em'
    };
    content = /*#__PURE__*/React$6.createElement(dist.ThreeDots, {
      style: dotstyle
    });
  }
  return /*#__PURE__*/React$6.createElement("span", {
    className: "botTagCozy__85d43 botTag__11e95 botTagRegular_fc4b4a botTag__4211a rem_be1e7a"
  }, /*#__PURE__*/React$6.createElement("div", {
    className: "botText_daff56"
  }, /*#__PURE__*/React$6.createElement("a", {
    style: linkStyle,
    onClick: onClick
  }, content)));
}

const GuildMemberStore = ZLibrary.DiscordModules.GuildMemberStore;
const React$5 = BdApi.React;
function normalize(str) {
  return fix(str).normalize('NFD');
}
function getServername(username, tag) {
  if (!tag || tag.length === 0) {
    return null;
  }
  username = normalize(username);
  tag = normalize(tag);
  let username_len = username.length;
  let tag_len = tag.length + 1; // include the space as part of the tag

  if (username.endsWith(tag)) {
    return username.slice(0, username_len - tag_len);
  } else {
    return null;
  }
}
function getUsername(useServerNames, author, profile) {
  let username = normalize(author.username_real ?? author.username.slice());
  let tag = normalize(profile.tag ?? '');
  if (useServerNames) {
    let servername = getServername(username, tag);
    if (servername) {
      // we can seperate servername and tag
      return {
        username: servername,
        member_tag: tag
      };
    } else {
      // most likely using a servertag, treat the whole thing as the username
      return {
        username,
        member_tag: ''
      };
    }
  } else {
    return {
      username: normalize(profile.name),
      member_tag: tag
    };
  }
}
function nameProps(author, type, settings, colour) {
  let {
    doContrastTest,
    contrastTestColour,
    contrastThreshold
  } = settings;
  let props = {
    user: author,
    className: 'username__0b0e7',
    type: type
  };
  if (colour && acceptableContrast(colour, doContrastTest, contrastTestColour, contrastThreshold)) {
    props.style = {
      color: colour
    };
  }
  return props;
}
function memberColour(colourPref, member, guildId) {
  switch (colourPref) {
    case ColourPreference.Member:
      return member.color ?? member.system_color;
    case ColourPreference.System:
      return member.system_color ?? member.color;
    case ColourPreference.Role:
      return GuildMemberStore.getMember(guildId, member.sender)?.colorString;
    default:
      return null;
  }
}
function tagColour(colourPref, member, guildId) {
  switch (colourPref) {
    case ColourPreference.Member:
      return member.color ?? member.system_color;
    case ColourPreference.System:
      return member.system_color;
    case ColourPreference.Role:
      return GuildMemberStore.getMember(guildId, member.sender)?.colorString;
    default:
      return null;
  }
}
function createHeaderChildren(message, guildId, settings, profileMap, profile, userHash) {
  let {
    memberColourPref,
    tagColourPref
  } = settings;
  let {
    username,
    member_tag
  } = getUsername(settings.useServerNames, message.author, profile);
  let pkBadge = /*#__PURE__*/React$5.createElement(PKBadge, {
    profileMap: profileMap,
    userHash: userHash,
    profile: profile
  });
  let member_colour = memberColour(memberColourPref, profile, guildId);
  let userProps = nameProps(message.author, 'member_name', settings, member_colour);
  let tag_colour = tagColour(tagColourPref, profile, guildId);
  let tagProps = nameProps(message.author, 'system_tag', settings, tag_colour);
  if (!member_tag || typeof member_tag !== 'string') member_tag = '';
  let elements = [];
  elements.push(React$5.createElement('span', userProps, username));
  if (member_tag && member_tag.length > 0) {
    elements.push(React$5.createElement('span', tagProps, ' ' + member_tag.toString()));
  }
  elements.push(pkBadge);
  return elements;
}
function ColorMessageHeader({
  settings,
  profileMap,
  profile,
  userHash,
  messageHeader,
  message,
  guildId
}) {
  return {
    ...messageHeader,
    props: {
      ...messageHeader.props,
      username: {
        ...messageHeader.props.username,
        props: {
          ...messageHeader.props.username.props,
          children: createHeaderChildren(message, guildId, settings, profileMap, profile, userHash)
        }
      }
    }
  };
}

const React$4 = BdApi.React;

// function replaceBotWithPK(component, profile, profileMap, userHash) {
//   if (component?.props?.username?.props?.children?.[1]?.props?.children[0]?.props?.decorations) {
//     component.props.username.props.children[1].props.children[0].props.decorations = [
//       <PKBadge profileMap={profileMap} userHash={userHash} profile={profile} />,
//     ];
//   }
// }

function LoadingMessageHeader({
  messageHeader,
  profile,
  profileMap,
  userHash
}) {
  return {
    ...messageHeader,
    props: {
      ...messageHeader.props,
      username: {
        ...messageHeader.props.username,
        props: {
          ...messageHeader.props.username.props,
          children: messageHeader.props.username.props.children.with(1, {
            ...messageHeader.props.username.props.children[1],
            props: {
              ...messageHeader.props.username.props.children[1].props,
              children: messageHeader.props.username.props.children[1].props.children.with(0, {
                ...messageHeader.props.username.props.children[1].props.children[0],
                props: {
                  ...messageHeader.props.username.props.children[1].props.children[0].props,
                  decorations: [/*#__PURE__*/React$4.createElement(PKBadge, {
                    profileMap: profileMap,
                    userHash: userHash,
                    profile: profile
                  })]
                }
              })
            }
          })
        }
      }
    }
  };
}

const React$3 = BdApi.React;
function MessageHeaderProxy({
  settingsCell,
  profileMap,
  enabledCell,
  messageHeader,
  message,
  guildId
}) {
  let [settings] = hookupValueCell(settingsCell);
  let [profile] = hookupProfile(profileMap, message.author);
  let [enabled] = hookupValueCell(enabledCell);
  if (!enabled || !isProxiedMessage(message)) {
    return messageHeader;
  }
  updateProfile(message, profileMap);
  let userHash = getUserHash(message.author);
  if (profile && (profile.status === ProfileStatus.Done || profile.status === ProfileStatus.Updating)) {
    return /*#__PURE__*/React$3.createElement(ColorMessageHeader, {
      settings: settings,
      profileMap: profileMap,
      profile: profile,
      userHash: userHash,
      messageHeader: messageHeader,
      message: message,
      guildId: guildId
    });
  } else if (!profile || profile.status === ProfileStatus.Requesting) {
    return /*#__PURE__*/React$3.createElement(LoadingMessageHeader, {
      messageHeader: messageHeader,
      profile: {
        status: ProfileStatus.Requesting
      },
      profileMap: profileMap,
      userHash: userHash
    });
  } else {
    return messageHeader;
  }
}

const React$2 = BdApi.React;
function getHeaderId(label) {
  return /message-username-(?<headerId>\d+)/.exec(label)?.groups?.headerId;
}
function hookupUnblocked(unblockedMap, author) {
  let header = getHeaderId(author);
  const [unblocked, setUnblocked] = React$2.useState(unblockedMap.get(header) ?? []);
  unblockedMap.addListener(function (key, value) {
    if (key === header) {
      setUnblocked(value);
    }
  });
  return [[...unblocked], setUnblocked];
}
function getUnblocked(unblockedMap, message, messageNode, label) {
  const [unblocked] = hookupUnblocked(unblockedMap, label);
  if (!unblocked.find(({
    id
  }) => id === message.id)) {
    unblocked.push({
      id: message.id,
      node: messageNode,
      timestamp: message.timestamp
    });
    unblocked.sort((a, b) => a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0);
    unblockedMap.set(getHeaderId(label), unblocked);
  }
  return unblocked.map(({
    node
  }) => node);
}
function XIcon() {
  return /*#__PURE__*/React$2.createElement("div", {
    className: "iconContainer_d0200f"
  }, /*#__PURE__*/React$2.createElement("svg", {
    "aria-hidden": "true",
    role: "img",
    className: "blockedIcon_fe27b1",
    width: "24",
    height: "24",
    viewBox: "0 0 24 24"
  }, /*#__PURE__*/React$2.createElement("path", {
    fill: "currentColor",
    d: "M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z"
  })));
}
function BlockedMessage({
  unblockedMap,
  message,
  messageNode,
  label,
  compact
}) {
  const [expanded, setExpanded] = React$2.useState(false);
  const unblocked = getUnblocked(unblockedMap, message, messageNode, label);
  if (compact) {
    return null;
  }
  return /*#__PURE__*/React$2.createElement("div", {
    className: "groupStart__7b93c"
  }, /*#__PURE__*/React$2.createElement("div", {
    className: "wrapper_a62503 cozy_f5c119 zalgo__39311",
    role: "article"
  }, /*#__PURE__*/React$2.createElement("div", {
    className: "contents_d3ae0d"
  }, /*#__PURE__*/React$2.createElement("div", {
    className: "blockedSystemMessage_d1b25e container__2acd5 cozy_d67381"
  }, /*#__PURE__*/React$2.createElement(XIcon, null), /*#__PURE__*/React$2.createElement("div", {
    className: "content__945f5"
  }, /*#__PURE__*/React$2.createElement("div", {
    className: "blockedMessageText_e808c7"
  }, unblocked.length, " blocked ", unblocked.length === 1 ? 'message' : 'messages', " \u2014", ' ', /*#__PURE__*/React$2.createElement("span", {
    className: "blockedAction_bf310e",
    role: "button",
    tabIndex: "0",
    onClick: () => setExpanded(!expanded)
  }, expanded ? 'Collapse' : 'Show', " ", unblocked.length === 1 ? 'message' : 'messages')))))), expanded ? unblocked : null);
}

let isBlocked = BdApi.Webpack.getByKeys('isBlocked').isBlocked;
const React$1 = BdApi.React;
function isBlockedProfile(profile) {
  return profile?.sender && isBlocked(profile.sender);
}
function MessageProxyInner({
  profileMap,
  unblockedMap,
  messageNode,
  message,
  label,
  compact
}) {
  let [profile] = hookupProfile(profileMap, message.author);
  if (isBlockedProfile(profile)) {
    return /*#__PURE__*/React$1.createElement(BlockedMessage, {
      unblockedMap: unblockedMap,
      message: message,
      messageNode: messageNode,
      label: label,
      compact: compact
    });
    // return messageNode;
  } else {
    return messageNode;
  }
}
function MessageProxy({
  profileMap,
  enabledCell,
  unblockedMap,
  messageNode,
  message,
  label,
  compact
}) {
  let [enabled] = hookupValueCell(enabledCell);
  if (enabled && message) {
    return /*#__PURE__*/React$1.createElement(MessageProxyInner, {
      profileMap: profileMap,
      unblockedMap: unblockedMap,
      messageNode: messageNode,
      message: message,
      label: label,
      compact: compact
    });
  } else {
    return messageNode;
  }
}

const MessageContent = BdApi.Webpack.getModule(m => {
  let s = m?.type?.toString();
  return s && s.includes('messageContent') && s.includes('MESSAGE_EDITED');
});
const MessageHeader = BdApi.Webpack.getModule(BdApi.Webpack.Filters.byStrings('showTimestampOnHover'), {
  defaultExport: false
});
const [Message, blocker] = BdApi.Webpack.getWithKey(BdApi.Webpack.Filters.byStrings('.cozy', '.hasReply', '.hasThread', '.isSystemMessage'));
const React = BdApi.React;
function patchMessageContent(settings, profileMap, enabled) {
  BdApi.Patcher.instead(pluginName, MessageContent, 'type', function (ctx, [props], f) {
    return /*#__PURE__*/React.createElement(MessageContentProxy, {
      settingsCell: settings,
      profileMap: profileMap,
      enabledCell: enabled,
      messageContent: f.call(ctx, props),
      message: props.message
    });
  });
}

// This could break with any Discord update but oh well
// We look up the message header module, which has two functions; The mangled `default` fn, and the one we get
// So we just sort of patch all the member functions in the module and hope for the best
//
// i am sorry
//
function patchMessageHeader(settings, profileMap, enabled) {
  Object.keys(MessageHeader).forEach(function (functionName) {
    BdApi.Patcher.instead(pluginName, MessageHeader, functionName, function (ctx, [props], f) {
      return /*#__PURE__*/React.createElement(MessageHeaderProxy, {
        settingsCell: settings,
        profileMap: profileMap,
        enabledCell: enabled,
        messageHeader: f.call(ctx, props),
        message: props.message,
        guildId: props.guildId
      });
    });
  });
}
function patchMessage(profileMap, enabled) {
  let unblockedMap = new MapCell({});
  BdApi.Patcher.instead(pluginName, Message, blocker, function (ctx, [props], f) {
    return /*#__PURE__*/React.createElement(MessageProxy, {
      profileMap: profileMap,
      enabledCell: enabled,
      unblockedMap: unblockedMap,
      messageNode: f.call(ctx, props),
      message: props.childrenMessageContent?.props?.message,
      label: props['aria-labelledby'],
      compact: props?.childrenHeader?.props?.compact
    });
  });
}

const MessageActions = ZLibrary.DiscordModules.MessageActions;
const MessageStore = ZLibrary.DiscordModules.MessageStore;
const ChannelStore = ZLibrary.DiscordModules.ChannelStore;
function patchEditMenuItem() {
  // Add edit menu item to proxied messages.
  return BdApi.ContextMenu.patch('message', (res, props) => {
    const {
      message
    } = props;
    if (!message || !isProxiedMessage(message) || !Array.isArray(res?.props?.children)) {
      return res;
    }
    res.props.children[2].props.children.splice(4, 0, BdApi.ContextMenu.buildMenuChildren([{
      id: 'pk-edit',
      label: 'Edit Proxied Message',
      action: () => {
        MessageActions.startEditMessage(message.channel_id, message.id, message.content);
      }
    }]));
  });
}
function patchEditAction() {
  // Patch edit actions on proxied messages to send a pluralkit command.
  BdApi.Patcher.instead(pluginName, MessageActions, 'editMessage', BdApi.Utils.debounce(function (ctx, [channel_id, message_id, message], original) {
    if (isProxiedMessage(MessageStore.getMessage(channel_id, message_id))) {
      let {
        content
      } = message;
      let channel = ChannelStore.getChannel(channel_id);
      let guild_id = channel.guild_id;
      let str = 'pk;e https://discord.com/channels/' + guild_id + '/' + channel_id + '/' + message_id + ' ' + content;
      MessageActions.sendMessage(channel_id, {
        reaction: false,
        content: str
      });
    } else {
      return original(channel_id, message_id, message);
    }
  }, 100));
}

const Settings = ZLibrary.Settings;
function logo() {
  let logo = document.createElement('img');
  logo.src = 'https://file.garden/ZRg8rDvANRar6gn8/pluralchum/overkill_logo_final.png';
  logo.style = 'max-width: 100%; height: auto;';
  return logo;
}
function subtitle() {
  let subtitle = document.createElement('p');
  subtitle.innerHTML = 'PluralKit integration for BetterDiscord<br>- by <b><span style="color: #ff002a;">ash taylor</span></b> -';
  subtitle.style = 'text-align: center; color: var(--header-primary);';
  return subtitle;
}
function doColourText(settings) {
  return new Settings.Switch('Colored proxy text', '', settings.get().doColourText, val => {
    settings.update(function (s) {
      return {
        ...s,
        doColourText: val
      };
    });
  });
}
function memberColorPref(settings) {
  return new Settings.Dropdown('Default member name color', '', settings.get().memberColourPref, [{
    label: 'Member',
    value: ColourPreference.Member
  }, {
    label: 'System',
    value: ColourPreference.System
  }, {
    label: 'Role',
    value: ColourPreference.Role
  }, {
    label: 'Theme',
    value: ColourPreference.Theme
  }], val => {
    settings.update(function (s) {
      return {
        ...s,
        memberColourPref: val
      };
    });
  });
}
function tagColourPref(settings) {
  return new Settings.Dropdown('Default system tag color', '', settings.get().tagColourPref, [{
    label: 'Member',
    value: ColourPreference.Member
  }, {
    label: 'System',
    value: ColourPreference.System
  }, {
    label: 'Role',
    value: ColourPreference.Role
  }, {
    label: 'Theme',
    value: ColourPreference.Theme
  }], val => {
    settings.update(function (s) {
      return {
        ...s,
        tagColourPref: val
      };
    });
  });
}
function useServerNames(settings) {
  return new Settings.Switch('Use servernames', '', settings.get().useServerNames, val => {
    settings.update(function (s) {
      return {
        ...s,
        useServerNames: val
      };
    });
  });
}
function preferencesPanel(settings) {
  let preferencesPanel = new Settings.SettingGroup('Preferences', {
    shown: false
  });
  preferencesPanel.append(doColourText(settings), useServerNames(settings), memberColorPref(settings), tagColourPref(settings));
  return preferencesPanel;
}
function doContrastTest(settings) {
  return new Settings.Switch('Enable text contrast test', "Uses the theme's default color if the proxy's contrast is too low", settings.get().doContrastTest, val => {
    settings.update(function (s) {
      return {
        ...s,
        doContrastTest: val
      };
    });
  });
}
function contrastTestColour(settings) {
  return new Settings.ColorPicker('Contrast test color', 'The background color that proxy text will be tested against (black for dark themes, white for light themes)', settings.get().contrastTestColour, hex => {
    settings.update(function (s) {
      return {
        ...s,
        contrastTestColour: hex
      };
    });
  });
}
function contrastThreshold(settings) {
  return new Settings.Slider('Contrast ratio threshold', 'Minimum contrast ratio for proxy colors (default: 3)', 1, 21, settings.get().contrastThreshold, val => {
    settings.update(function (s) {
      return {
        ...s,
        contrastThreshold: val
      };
    });
  }, {
    markers: [1, 2, 3, 4.5, 7, 14, 21]
  });
}
function accessibilityPanel(settings) {
  // Contrast test settings
  let accessibilityPanel = new Settings.SettingGroup('Accessibility', {
    shown: false
  });
  accessibilityPanel.append(doContrastTest(settings), contrastTestColour(settings), contrastThreshold(settings));
  return accessibilityPanel;
}
function cachePanel(profileMap) {
  // Cache
  let cachePanel = new Settings.SettingGroup('Cache', {
    shown: false
  });
  let resetCacheBtn = document.createElement('button');
  resetCacheBtn.className = 'button__581d0 lookFilled__950dd colorBrand__27d57 sizeSmall_da7d10 grow__4c8a4';
  resetCacheBtn.innerHTML = 'Delete Cache';
  resetCacheBtn.onclick = () => {
    profileMap.clear();
  };
  cachePanel.append(resetCacheBtn);
  return cachePanel;
}
function settingsPanel(settings, profileMap) {
  let settingsPanel = new Settings.SettingPanel();
  settingsPanel.append(logo(), subtitle(), preferencesPanel(settings), accessibilityPanel(settings), cachePanel(profileMap));
  return settingsPanel.getElement();
}

var re$2 = {exports: {}};

// Note: this is the semver.org version of the spec that it implements
// Not necessarily the package version of this code.
const SEMVER_SPEC_VERSION = '2.0.0';
const MAX_LENGTH$1 = 256;
const MAX_SAFE_INTEGER$1 = Number.MAX_SAFE_INTEGER || /* istanbul ignore next */9007199254740991;

// Max safe segment length for coercion.
const MAX_SAFE_COMPONENT_LENGTH = 16;

// Max safe length for a build identifier. The max length minus 6 characters for
// the shortest version with a build 0.0.0+BUILD.
const MAX_SAFE_BUILD_LENGTH = MAX_LENGTH$1 - 6;
const RELEASE_TYPES = ['major', 'premajor', 'minor', 'preminor', 'patch', 'prepatch', 'prerelease'];
var constants$1 = {
  MAX_LENGTH: MAX_LENGTH$1,
  MAX_SAFE_COMPONENT_LENGTH,
  MAX_SAFE_BUILD_LENGTH,
  MAX_SAFE_INTEGER: MAX_SAFE_INTEGER$1,
  RELEASE_TYPES,
  SEMVER_SPEC_VERSION,
  FLAG_INCLUDE_PRERELEASE: 0b001,
  FLAG_LOOSE: 0b010
};

const debug$1 = typeof process === 'object' && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error('SEMVER', ...args) : () => {};
var debug_1 = debug$1;

(function (module, exports) {
	const {
	  MAX_SAFE_COMPONENT_LENGTH,
	  MAX_SAFE_BUILD_LENGTH,
	  MAX_LENGTH
	} = constants$1;
	const debug = debug_1;
	exports = module.exports = {};

	// The actual regexps go on exports.re
	const re = exports.re = [];
	const safeRe = exports.safeRe = [];
	const src = exports.src = [];
	const t = exports.t = {};
	let R = 0;
	const LETTERDASHNUMBER = '[a-zA-Z0-9-]';

	// Replace some greedy regex tokens to prevent regex dos issues. These regex are
	// used internally via the safeRe object since all inputs in this library get
	// normalized first to trim and collapse all extra whitespace. The original
	// regexes are exported for userland consumption and lower level usage. A
	// future breaking change could export the safer regex only with a note that
	// all input should have extra whitespace removed.
	const safeRegexReplacements = [['\\s', 1], ['\\d', MAX_LENGTH], [LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]];
	const makeSafeRegex = value => {
	  for (const [token, max] of safeRegexReplacements) {
	    value = value.split(`${token}*`).join(`${token}{0,${max}}`).split(`${token}+`).join(`${token}{1,${max}}`);
	  }
	  return value;
	};
	const createToken = (name, value, isGlobal) => {
	  const safe = makeSafeRegex(value);
	  const index = R++;
	  debug(name, index, value);
	  t[name] = index;
	  src[index] = value;
	  re[index] = new RegExp(value, isGlobal ? 'g' : undefined);
	  safeRe[index] = new RegExp(safe, isGlobal ? 'g' : undefined);
	};

	// The following Regular Expressions can be used for tokenizing,
	// validating, and parsing SemVer version strings.

	// ## Numeric Identifier
	// A single `0`, or a non-zero digit followed by zero or more digits.

	createToken('NUMERICIDENTIFIER', '0|[1-9]\\d*');
	createToken('NUMERICIDENTIFIERLOOSE', '\\d+');

	// ## Non-numeric Identifier
	// Zero or more digits, followed by a letter or hyphen, and then zero or
	// more letters, digits, or hyphens.

	createToken('NONNUMERICIDENTIFIER', `\\d*[a-zA-Z-]${LETTERDASHNUMBER}*`);

	// ## Main Version
	// Three dot-separated numeric identifiers.

	createToken('MAINVERSION', `(${src[t.NUMERICIDENTIFIER]})\\.` + `(${src[t.NUMERICIDENTIFIER]})\\.` + `(${src[t.NUMERICIDENTIFIER]})`);
	createToken('MAINVERSIONLOOSE', `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.` + `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.` + `(${src[t.NUMERICIDENTIFIERLOOSE]})`);

	// ## Pre-release Version Identifier
	// A numeric identifier, or a non-numeric identifier.

	createToken('PRERELEASEIDENTIFIER', `(?:${src[t.NUMERICIDENTIFIER]}|${src[t.NONNUMERICIDENTIFIER]})`);
	createToken('PRERELEASEIDENTIFIERLOOSE', `(?:${src[t.NUMERICIDENTIFIERLOOSE]}|${src[t.NONNUMERICIDENTIFIER]})`);

	// ## Pre-release Version
	// Hyphen, followed by one or more dot-separated pre-release version
	// identifiers.

	createToken('PRERELEASE', `(?:-(${src[t.PRERELEASEIDENTIFIER]}(?:\\.${src[t.PRERELEASEIDENTIFIER]})*))`);
	createToken('PRERELEASELOOSE', `(?:-?(${src[t.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${src[t.PRERELEASEIDENTIFIERLOOSE]})*))`);

	// ## Build Metadata Identifier
	// Any combination of digits, letters, or hyphens.

	createToken('BUILDIDENTIFIER', `${LETTERDASHNUMBER}+`);

	// ## Build Metadata
	// Plus sign, followed by one or more period-separated build metadata
	// identifiers.

	createToken('BUILD', `(?:\\+(${src[t.BUILDIDENTIFIER]}(?:\\.${src[t.BUILDIDENTIFIER]})*))`);

	// ## Full Version String
	// A main version, followed optionally by a pre-release version and
	// build metadata.

	// Note that the only major, minor, patch, and pre-release sections of
	// the version string are capturing groups.  The build metadata is not a
	// capturing group, because it should not ever be used in version
	// comparison.

	createToken('FULLPLAIN', `v?${src[t.MAINVERSION]}${src[t.PRERELEASE]}?${src[t.BUILD]}?`);
	createToken('FULL', `^${src[t.FULLPLAIN]}$`);

	// like full, but allows v1.2.3 and =1.2.3, which people do sometimes.
	// also, 1.0.0alpha1 (prerelease without the hyphen) which is pretty
	// common in the npm registry.
	createToken('LOOSEPLAIN', `[v=\\s]*${src[t.MAINVERSIONLOOSE]}${src[t.PRERELEASELOOSE]}?${src[t.BUILD]}?`);
	createToken('LOOSE', `^${src[t.LOOSEPLAIN]}$`);
	createToken('GTLT', '((?:<|>)?=?)');

	// Something like "2.*" or "1.2.x".
	// Note that "x.x" is a valid xRange identifer, meaning "any version"
	// Only the first item is strictly required.
	createToken('XRANGEIDENTIFIERLOOSE', `${src[t.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`);
	createToken('XRANGEIDENTIFIER', `${src[t.NUMERICIDENTIFIER]}|x|X|\\*`);
	createToken('XRANGEPLAIN', `[v=\\s]*(${src[t.XRANGEIDENTIFIER]})` + `(?:\\.(${src[t.XRANGEIDENTIFIER]})` + `(?:\\.(${src[t.XRANGEIDENTIFIER]})` + `(?:${src[t.PRERELEASE]})?${src[t.BUILD]}?` + `)?)?`);
	createToken('XRANGEPLAINLOOSE', `[v=\\s]*(${src[t.XRANGEIDENTIFIERLOOSE]})` + `(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})` + `(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})` + `(?:${src[t.PRERELEASELOOSE]})?${src[t.BUILD]}?` + `)?)?`);
	createToken('XRANGE', `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAIN]}$`);
	createToken('XRANGELOOSE', `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAINLOOSE]}$`);

	// Coercion.
	// Extract anything that could conceivably be a part of a valid semver
	createToken('COERCEPLAIN', `${'(^|[^\\d])' + '(\\d{1,'}${MAX_SAFE_COMPONENT_LENGTH}})` + `(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?` + `(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?`);
	createToken('COERCE', `${src[t.COERCEPLAIN]}(?:$|[^\\d])`);
	createToken('COERCEFULL', src[t.COERCEPLAIN] + `(?:${src[t.PRERELEASE]})?` + `(?:${src[t.BUILD]})?` + `(?:$|[^\\d])`);
	createToken('COERCERTL', src[t.COERCE], true);
	createToken('COERCERTLFULL', src[t.COERCEFULL], true);

	// Tilde ranges.
	// Meaning is "reasonably at or greater than"
	createToken('LONETILDE', '(?:~>?)');
	createToken('TILDETRIM', `(\\s*)${src[t.LONETILDE]}\\s+`, true);
	exports.tildeTrimReplace = '$1~';
	createToken('TILDE', `^${src[t.LONETILDE]}${src[t.XRANGEPLAIN]}$`);
	createToken('TILDELOOSE', `^${src[t.LONETILDE]}${src[t.XRANGEPLAINLOOSE]}$`);

	// Caret ranges.
	// Meaning is "at least and backwards compatible with"
	createToken('LONECARET', '(?:\\^)');
	createToken('CARETTRIM', `(\\s*)${src[t.LONECARET]}\\s+`, true);
	exports.caretTrimReplace = '$1^';
	createToken('CARET', `^${src[t.LONECARET]}${src[t.XRANGEPLAIN]}$`);
	createToken('CARETLOOSE', `^${src[t.LONECARET]}${src[t.XRANGEPLAINLOOSE]}$`);

	// A simple gt/lt/eq thing, or just "" to indicate "any version"
	createToken('COMPARATORLOOSE', `^${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]})$|^$`);
	createToken('COMPARATOR', `^${src[t.GTLT]}\\s*(${src[t.FULLPLAIN]})$|^$`);

	// An expression to strip any whitespace between the gtlt and the thing
	// it modifies, so that `> 1.2.3` ==> `>1.2.3`
	createToken('COMPARATORTRIM', `(\\s*)${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]}|${src[t.XRANGEPLAIN]})`, true);
	exports.comparatorTrimReplace = '$1$2$3';

	// Something like `1.2.3 - 1.2.4`
	// Note that these all use the loose form, because they'll be
	// checked against either the strict or loose comparator form
	// later.
	createToken('HYPHENRANGE', `^\\s*(${src[t.XRANGEPLAIN]})` + `\\s+-\\s+` + `(${src[t.XRANGEPLAIN]})` + `\\s*$`);
	createToken('HYPHENRANGELOOSE', `^\\s*(${src[t.XRANGEPLAINLOOSE]})` + `\\s+-\\s+` + `(${src[t.XRANGEPLAINLOOSE]})` + `\\s*$`);

	// Star ranges basically just allow anything at all.
	createToken('STAR', '(<|>)?=?\\s*\\*');
	// >=0.0.0 is like a star
	createToken('GTE0', '^\\s*>=\\s*0\\.0\\.0\\s*$');
	createToken('GTE0PRE', '^\\s*>=\\s*0\\.0\\.0-0\\s*$'); 
} (re$2, re$2.exports));

var reExports = re$2.exports;

// parse out just the options we care about
const looseOption = Object.freeze({
  loose: true
});
const emptyOpts = Object.freeze({});
const parseOptions$1 = options => {
  if (!options) {
    return emptyOpts;
  }
  if (typeof options !== 'object') {
    return looseOption;
  }
  return options;
};
var parseOptions_1 = parseOptions$1;

const numeric = /^[0-9]+$/;
const compareIdentifiers$1 = (a, b) => {
  const anum = numeric.test(a);
  const bnum = numeric.test(b);
  if (anum && bnum) {
    a = +a;
    b = +b;
  }
  return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
};
const rcompareIdentifiers = (a, b) => compareIdentifiers$1(b, a);
var identifiers$1 = {
  compareIdentifiers: compareIdentifiers$1,
  rcompareIdentifiers
};

const debug = debug_1;
const {
  MAX_LENGTH,
  MAX_SAFE_INTEGER
} = constants$1;
const {
  safeRe: re$1,
  t: t$1
} = reExports;
const parseOptions = parseOptions_1;
const {
  compareIdentifiers
} = identifiers$1;
let SemVer$d = class SemVer {
  constructor(version, options) {
    options = parseOptions(options);
    if (version instanceof SemVer) {
      if (version.loose === !!options.loose && version.includePrerelease === !!options.includePrerelease) {
        return version;
      } else {
        version = version.version;
      }
    } else if (typeof version !== 'string') {
      throw new TypeError(`Invalid version. Must be a string. Got type "${typeof version}".`);
    }
    if (version.length > MAX_LENGTH) {
      throw new TypeError(`version is longer than ${MAX_LENGTH} characters`);
    }
    debug('SemVer', version, options);
    this.options = options;
    this.loose = !!options.loose;
    // this isn't actually relevant for versions, but keep it so that we
    // don't run into trouble passing this.options around.
    this.includePrerelease = !!options.includePrerelease;
    const m = version.trim().match(options.loose ? re$1[t$1.LOOSE] : re$1[t$1.FULL]);
    if (!m) {
      throw new TypeError(`Invalid Version: ${version}`);
    }
    this.raw = version;

    // these are actually numbers
    this.major = +m[1];
    this.minor = +m[2];
    this.patch = +m[3];
    if (this.major > MAX_SAFE_INTEGER || this.major < 0) {
      throw new TypeError('Invalid major version');
    }
    if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) {
      throw new TypeError('Invalid minor version');
    }
    if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) {
      throw new TypeError('Invalid patch version');
    }

    // numberify any prerelease numeric ids
    if (!m[4]) {
      this.prerelease = [];
    } else {
      this.prerelease = m[4].split('.').map(id => {
        if (/^[0-9]+$/.test(id)) {
          const num = +id;
          if (num >= 0 && num < MAX_SAFE_INTEGER) {
            return num;
          }
        }
        return id;
      });
    }
    this.build = m[5] ? m[5].split('.') : [];
    this.format();
  }
  format() {
    this.version = `${this.major}.${this.minor}.${this.patch}`;
    if (this.prerelease.length) {
      this.version += `-${this.prerelease.join('.')}`;
    }
    return this.version;
  }
  toString() {
    return this.version;
  }
  compare(other) {
    debug('SemVer.compare', this.version, this.options, other);
    if (!(other instanceof SemVer)) {
      if (typeof other === 'string' && other === this.version) {
        return 0;
      }
      other = new SemVer(other, this.options);
    }
    if (other.version === this.version) {
      return 0;
    }
    return this.compareMain(other) || this.comparePre(other);
  }
  compareMain(other) {
    if (!(other instanceof SemVer)) {
      other = new SemVer(other, this.options);
    }
    return compareIdentifiers(this.major, other.major) || compareIdentifiers(this.minor, other.minor) || compareIdentifiers(this.patch, other.patch);
  }
  comparePre(other) {
    if (!(other instanceof SemVer)) {
      other = new SemVer(other, this.options);
    }

    // NOT having a prerelease is > having one
    if (this.prerelease.length && !other.prerelease.length) {
      return -1;
    } else if (!this.prerelease.length && other.prerelease.length) {
      return 1;
    } else if (!this.prerelease.length && !other.prerelease.length) {
      return 0;
    }
    let i = 0;
    do {
      const a = this.prerelease[i];
      const b = other.prerelease[i];
      debug('prerelease compare', i, a, b);
      if (a === undefined && b === undefined) {
        return 0;
      } else if (b === undefined) {
        return 1;
      } else if (a === undefined) {
        return -1;
      } else if (a === b) {
        continue;
      } else {
        return compareIdentifiers(a, b);
      }
    } while (++i);
  }
  compareBuild(other) {
    if (!(other instanceof SemVer)) {
      other = new SemVer(other, this.options);
    }
    let i = 0;
    do {
      const a = this.build[i];
      const b = other.build[i];
      debug('prerelease compare', i, a, b);
      if (a === undefined && b === undefined) {
        return 0;
      } else if (b === undefined) {
        return 1;
      } else if (a === undefined) {
        return -1;
      } else if (a === b) {
        continue;
      } else {
        return compareIdentifiers(a, b);
      }
    } while (++i);
  }

  // preminor will bump the version up to the next minor release, and immediately
  // down to pre-release. premajor and prepatch work the same way.
  inc(release, identifier, identifierBase) {
    switch (release) {
      case 'premajor':
        this.prerelease.length = 0;
        this.patch = 0;
        this.minor = 0;
        this.major++;
        this.inc('pre', identifier, identifierBase);
        break;
      case 'preminor':
        this.prerelease.length = 0;
        this.patch = 0;
        this.minor++;
        this.inc('pre', identifier, identifierBase);
        break;
      case 'prepatch':
        // If this is already a prerelease, it will bump to the next version
        // drop any prereleases that might already exist, since they are not
        // relevant at this point.
        this.prerelease.length = 0;
        this.inc('patch', identifier, identifierBase);
        this.inc('pre', identifier, identifierBase);
        break;
      // If the input is a non-prerelease version, this acts the same as
      // prepatch.
      case 'prerelease':
        if (this.prerelease.length === 0) {
          this.inc('patch', identifier, identifierBase);
        }
        this.inc('pre', identifier, identifierBase);
        break;
      case 'major':
        // If this is a pre-major version, bump up to the same major version.
        // Otherwise increment major.
        // 1.0.0-5 bumps to 1.0.0
        // 1.1.0 bumps to 2.0.0
        if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) {
          this.major++;
        }
        this.minor = 0;
        this.patch = 0;
        this.prerelease = [];
        break;
      case 'minor':
        // If this is a pre-minor version, bump up to the same minor version.
        // Otherwise increment minor.
        // 1.2.0-5 bumps to 1.2.0
        // 1.2.1 bumps to 1.3.0
        if (this.patch !== 0 || this.prerelease.length === 0) {
          this.minor++;
        }
        this.patch = 0;
        this.prerelease = [];
        break;
      case 'patch':
        // If this is not a pre-release version, it will increment the patch.
        // If it is a pre-release it will bump up to the same patch version.
        // 1.2.0-5 patches to 1.2.0
        // 1.2.0 patches to 1.2.1
        if (this.prerelease.length === 0) {
          this.patch++;
        }
        this.prerelease = [];
        break;
      // This probably shouldn't be used publicly.
      // 1.0.0 'pre' would become 1.0.0-0 which is the wrong direction.
      case 'pre':
        {
          const base = Number(identifierBase) ? 1 : 0;
          if (!identifier && identifierBase === false) {
            throw new Error('invalid increment argument: identifier is empty');
          }
          if (this.prerelease.length === 0) {
            this.prerelease = [base];
          } else {
            let i = this.prerelease.length;
            while (--i >= 0) {
              if (typeof this.prerelease[i] === 'number') {
                this.prerelease[i]++;
                i = -2;
              }
            }
            if (i === -1) {
              // didn't increment anything
              if (identifier === this.prerelease.join('.') && identifierBase === false) {
                throw new Error('invalid increment argument: identifier already exists');
              }
              this.prerelease.push(base);
            }
          }
          if (identifier) {
            // 1.2.0-beta.1 bumps to 1.2.0-beta.2,
            // 1.2.0-beta.fooblz or 1.2.0-beta bumps to 1.2.0-beta.0
            let prerelease = [identifier, base];
            if (identifierBase === false) {
              prerelease = [identifier];
            }
            if (compareIdentifiers(this.prerelease[0], identifier) === 0) {
              if (isNaN(this.prerelease[1])) {
                this.prerelease = prerelease;
              }
            } else {
              this.prerelease = prerelease;
            }
          }
          break;
        }
      default:
        throw new Error(`invalid increment argument: ${release}`);
    }
    this.raw = this.format();
    if (this.build.length) {
      this.raw += `+${this.build.join('.')}`;
    }
    return this;
  }
};
var semver$2 = SemVer$d;

const SemVer$c = semver$2;
const parse$6 = (version, options, throwErrors = false) => {
  if (version instanceof SemVer$c) {
    return version;
  }
  try {
    return new SemVer$c(version, options);
  } catch (er) {
    if (!throwErrors) {
      return null;
    }
    throw er;
  }
};
var parse_1 = parse$6;

const parse$5 = parse_1;
const valid$2 = (version, options) => {
  const v = parse$5(version, options);
  return v ? v.version : null;
};
var valid_1 = valid$2;

const parse$4 = parse_1;
const clean$1 = (version, options) => {
  const s = parse$4(version.trim().replace(/^[=v]+/, ''), options);
  return s ? s.version : null;
};
var clean_1 = clean$1;

const SemVer$b = semver$2;
const inc$1 = (version, release, options, identifier, identifierBase) => {
  if (typeof options === 'string') {
    identifierBase = identifier;
    identifier = options;
    options = undefined;
  }
  try {
    return new SemVer$b(version instanceof SemVer$b ? version.version : version, options).inc(release, identifier, identifierBase).version;
  } catch (er) {
    return null;
  }
};
var inc_1 = inc$1;

const parse$3 = parse_1;
const diff$1 = (version1, version2) => {
  const v1 = parse$3(version1, null, true);
  const v2 = parse$3(version2, null, true);
  const comparison = v1.compare(v2);
  if (comparison === 0) {
    return null;
  }
  const v1Higher = comparison > 0;
  const highVersion = v1Higher ? v1 : v2;
  const lowVersion = v1Higher ? v2 : v1;
  const highHasPre = !!highVersion.prerelease.length;
  const lowHasPre = !!lowVersion.prerelease.length;
  if (lowHasPre && !highHasPre) {
    // Going from prerelease -> no prerelease requires some special casing

    // If the low version has only a major, then it will always be a major
    // Some examples:
    // 1.0.0-1 -> 1.0.0
    // 1.0.0-1 -> 1.1.1
    // 1.0.0-1 -> 2.0.0
    if (!lowVersion.patch && !lowVersion.minor) {
      return 'major';
    }

    // Otherwise it can be determined by checking the high version

    if (highVersion.patch) {
      // anything higher than a patch bump would result in the wrong version
      return 'patch';
    }
    if (highVersion.minor) {
      // anything higher than a minor bump would result in the wrong version
      return 'minor';
    }

    // bumping major/minor/patch all have same result
    return 'major';
  }

  // add the `pre` prefix if we are going to a prerelease version
  const prefix = highHasPre ? 'pre' : '';
  if (v1.major !== v2.major) {
    return prefix + 'major';
  }
  if (v1.minor !== v2.minor) {
    return prefix + 'minor';
  }
  if (v1.patch !== v2.patch) {
    return prefix + 'patch';
  }

  // high and low are preleases
  return 'prerelease';
};
var diff_1 = diff$1;

const SemVer$a = semver$2;
const major$1 = (a, loose) => new SemVer$a(a, loose).major;
var major_1 = major$1;

const SemVer$9 = semver$2;
const minor$1 = (a, loose) => new SemVer$9(a, loose).minor;
var minor_1 = minor$1;

const SemVer$8 = semver$2;
const patch$1 = (a, loose) => new SemVer$8(a, loose).patch;
var patch_1 = patch$1;

const parse$2 = parse_1;
const prerelease$1 = (version, options) => {
  const parsed = parse$2(version, options);
  return parsed && parsed.prerelease.length ? parsed.prerelease : null;
};
var prerelease_1 = prerelease$1;

const SemVer$7 = semver$2;
const compare$b = (a, b, loose) => new SemVer$7(a, loose).compare(new SemVer$7(b, loose));
var compare_1 = compare$b;

const compare$a = compare_1;
const rcompare$1 = (a, b, loose) => compare$a(b, a, loose);
var rcompare_1 = rcompare$1;

const compare$9 = compare_1;
const compareLoose$1 = (a, b) => compare$9(a, b, true);
var compareLoose_1 = compareLoose$1;

const SemVer$6 = semver$2;
const compareBuild$3 = (a, b, loose) => {
  const versionA = new SemVer$6(a, loose);
  const versionB = new SemVer$6(b, loose);
  return versionA.compare(versionB) || versionA.compareBuild(versionB);
};
var compareBuild_1 = compareBuild$3;

const compareBuild$2 = compareBuild_1;
const sort$1 = (list, loose) => list.sort((a, b) => compareBuild$2(a, b, loose));
var sort_1 = sort$1;

const compareBuild$1 = compareBuild_1;
const rsort$1 = (list, loose) => list.sort((a, b) => compareBuild$1(b, a, loose));
var rsort_1 = rsort$1;

const compare$8 = compare_1;
const gt$4 = (a, b, loose) => compare$8(a, b, loose) > 0;
var gt_1 = gt$4;

const compare$7 = compare_1;
const lt$3 = (a, b, loose) => compare$7(a, b, loose) < 0;
var lt_1 = lt$3;

const compare$6 = compare_1;
const eq$2 = (a, b, loose) => compare$6(a, b, loose) === 0;
var eq_1 = eq$2;

const compare$5 = compare_1;
const neq$2 = (a, b, loose) => compare$5(a, b, loose) !== 0;
var neq_1 = neq$2;

const compare$4 = compare_1;
const gte$3 = (a, b, loose) => compare$4(a, b, loose) >= 0;
var gte_1 = gte$3;

const compare$3 = compare_1;
const lte$3 = (a, b, loose) => compare$3(a, b, loose) <= 0;
var lte_1 = lte$3;

const eq$1 = eq_1;
const neq$1 = neq_1;
const gt$3 = gt_1;
const gte$2 = gte_1;
const lt$2 = lt_1;
const lte$2 = lte_1;
const cmp$1 = (a, op, b, loose) => {
  switch (op) {
    case '===':
      if (typeof a === 'object') {
        a = a.version;
      }
      if (typeof b === 'object') {
        b = b.version;
      }
      return a === b;
    case '!==':
      if (typeof a === 'object') {
        a = a.version;
      }
      if (typeof b === 'object') {
        b = b.version;
      }
      return a !== b;
    case '':
    case '=':
    case '==':
      return eq$1(a, b, loose);
    case '!=':
      return neq$1(a, b, loose);
    case '>':
      return gt$3(a, b, loose);
    case '>=':
      return gte$2(a, b, loose);
    case '<':
      return lt$2(a, b, loose);
    case '<=':
      return lte$2(a, b, loose);
    default:
      throw new TypeError(`Invalid operator: ${op}`);
  }
};
var cmp_1 = cmp$1;

const SemVer$5 = semver$2;
const parse$1 = parse_1;
const {
  safeRe: re,
  t
} = reExports;
const coerce$1 = (version, options) => {
  if (version instanceof SemVer$5) {
    return version;
  }
  if (typeof version === 'number') {
    version = String(version);
  }
  if (typeof version !== 'string') {
    return null;
  }
  options = options || {};
  let match = null;
  if (!options.rtl) {
    match = version.match(options.includePrerelease ? re[t.COERCEFULL] : re[t.COERCE]);
  } else {
    // Find the right-most coercible string that does not share
    // a terminus with a more left-ward coercible string.
    // Eg, '1.2.3.4' wants to coerce '2.3.4', not '3.4' or '4'
    // With includePrerelease option set, '1.2.3.4-rc' wants to coerce '2.3.4-rc', not '2.3.4'
    //
    // Walk through the string checking with a /g regexp
    // Manually set the index so as to pick up overlapping matches.
    // Stop when we get a match that ends at the string end, since no
    // coercible string can be more right-ward without the same terminus.
    const coerceRtlRegex = options.includePrerelease ? re[t.COERCERTLFULL] : re[t.COERCERTL];
    let next;
    while ((next = coerceRtlRegex.exec(version)) && (!match || match.index + match[0].length !== version.length)) {
      if (!match || next.index + next[0].length !== match.index + match[0].length) {
        match = next;
      }
      coerceRtlRegex.lastIndex = next.index + next[1].length + next[2].length;
    }
    // leave it in a clean state
    coerceRtlRegex.lastIndex = -1;
  }
  if (match === null) {
    return null;
  }
  const major = match[2];
  const minor = match[3] || '0';
  const patch = match[4] || '0';
  const prerelease = options.includePrerelease && match[5] ? `-${match[5]}` : '';
  const build = options.includePrerelease && match[6] ? `+${match[6]}` : '';
  return parse$1(`${major}.${minor}.${patch}${prerelease}${build}`, options);
};
var coerce_1 = coerce$1;

var iterator;
var hasRequiredIterator;

function requireIterator () {
	if (hasRequiredIterator) return iterator;
	hasRequiredIterator = 1;

	iterator = function (Yallist) {
	  Yallist.prototype[Symbol.iterator] = function* () {
	    for (let walker = this.head; walker; walker = walker.next) {
	      yield walker.value;
	    }
	  };
	};
	return iterator;
}

var yallist;
var hasRequiredYallist;

function requireYallist () {
	if (hasRequiredYallist) return yallist;
	hasRequiredYallist = 1;

	yallist = Yallist;
	Yallist.Node = Node;
	Yallist.create = Yallist;
	function Yallist(list) {
	  var self = this;
	  if (!(self instanceof Yallist)) {
	    self = new Yallist();
	  }
	  self.tail = null;
	  self.head = null;
	  self.length = 0;
	  if (list && typeof list.forEach === 'function') {
	    list.forEach(function (item) {
	      self.push(item);
	    });
	  } else if (arguments.length > 0) {
	    for (var i = 0, l = arguments.length; i < l; i++) {
	      self.push(arguments[i]);
	    }
	  }
	  return self;
	}
	Yallist.prototype.removeNode = function (node) {
	  if (node.list !== this) {
	    throw new Error('removing node which does not belong to this list');
	  }
	  var next = node.next;
	  var prev = node.prev;
	  if (next) {
	    next.prev = prev;
	  }
	  if (prev) {
	    prev.next = next;
	  }
	  if (node === this.head) {
	    this.head = next;
	  }
	  if (node === this.tail) {
	    this.tail = prev;
	  }
	  node.list.length--;
	  node.next = null;
	  node.prev = null;
	  node.list = null;
	  return next;
	};
	Yallist.prototype.unshiftNode = function (node) {
	  if (node === this.head) {
	    return;
	  }
	  if (node.list) {
	    node.list.removeNode(node);
	  }
	  var head = this.head;
	  node.list = this;
	  node.next = head;
	  if (head) {
	    head.prev = node;
	  }
	  this.head = node;
	  if (!this.tail) {
	    this.tail = node;
	  }
	  this.length++;
	};
	Yallist.prototype.pushNode = function (node) {
	  if (node === this.tail) {
	    return;
	  }
	  if (node.list) {
	    node.list.removeNode(node);
	  }
	  var tail = this.tail;
	  node.list = this;
	  node.prev = tail;
	  if (tail) {
	    tail.next = node;
	  }
	  this.tail = node;
	  if (!this.head) {
	    this.head = node;
	  }
	  this.length++;
	};
	Yallist.prototype.push = function () {
	  for (var i = 0, l = arguments.length; i < l; i++) {
	    push(this, arguments[i]);
	  }
	  return this.length;
	};
	Yallist.prototype.unshift = function () {
	  for (var i = 0, l = arguments.length; i < l; i++) {
	    unshift(this, arguments[i]);
	  }
	  return this.length;
	};
	Yallist.prototype.pop = function () {
	  if (!this.tail) {
	    return undefined;
	  }
	  var res = this.tail.value;
	  this.tail = this.tail.prev;
	  if (this.tail) {
	    this.tail.next = null;
	  } else {
	    this.head = null;
	  }
	  this.length--;
	  return res;
	};
	Yallist.prototype.shift = function () {
	  if (!this.head) {
	    return undefined;
	  }
	  var res = this.head.value;
	  this.head = this.head.next;
	  if (this.head) {
	    this.head.prev = null;
	  } else {
	    this.tail = null;
	  }
	  this.length--;
	  return res;
	};
	Yallist.prototype.forEach = function (fn, thisp) {
	  thisp = thisp || this;
	  for (var walker = this.head, i = 0; walker !== null; i++) {
	    fn.call(thisp, walker.value, i, this);
	    walker = walker.next;
	  }
	};
	Yallist.prototype.forEachReverse = function (fn, thisp) {
	  thisp = thisp || this;
	  for (var walker = this.tail, i = this.length - 1; walker !== null; i--) {
	    fn.call(thisp, walker.value, i, this);
	    walker = walker.prev;
	  }
	};
	Yallist.prototype.get = function (n) {
	  for (var i = 0, walker = this.head; walker !== null && i < n; i++) {
	    // abort out of the list early if we hit a cycle
	    walker = walker.next;
	  }
	  if (i === n && walker !== null) {
	    return walker.value;
	  }
	};
	Yallist.prototype.getReverse = function (n) {
	  for (var i = 0, walker = this.tail; walker !== null && i < n; i++) {
	    // abort out of the list early if we hit a cycle
	    walker = walker.prev;
	  }
	  if (i === n && walker !== null) {
	    return walker.value;
	  }
	};
	Yallist.prototype.map = function (fn, thisp) {
	  thisp = thisp || this;
	  var res = new Yallist();
	  for (var walker = this.head; walker !== null;) {
	    res.push(fn.call(thisp, walker.value, this));
	    walker = walker.next;
	  }
	  return res;
	};
	Yallist.prototype.mapReverse = function (fn, thisp) {
	  thisp = thisp || this;
	  var res = new Yallist();
	  for (var walker = this.tail; walker !== null;) {
	    res.push(fn.call(thisp, walker.value, this));
	    walker = walker.prev;
	  }
	  return res;
	};
	Yallist.prototype.reduce = function (fn, initial) {
	  var acc;
	  var walker = this.head;
	  if (arguments.length > 1) {
	    acc = initial;
	  } else if (this.head) {
	    walker = this.head.next;
	    acc = this.head.value;
	  } else {
	    throw new TypeError('Reduce of empty list with no initial value');
	  }
	  for (var i = 0; walker !== null; i++) {
	    acc = fn(acc, walker.value, i);
	    walker = walker.next;
	  }
	  return acc;
	};
	Yallist.prototype.reduceReverse = function (fn, initial) {
	  var acc;
	  var walker = this.tail;
	  if (arguments.length > 1) {
	    acc = initial;
	  } else if (this.tail) {
	    walker = this.tail.prev;
	    acc = this.tail.value;
	  } else {
	    throw new TypeError('Reduce of empty list with no initial value');
	  }
	  for (var i = this.length - 1; walker !== null; i--) {
	    acc = fn(acc, walker.value, i);
	    walker = walker.prev;
	  }
	  return acc;
	};
	Yallist.prototype.toArray = function () {
	  var arr = new Array(this.length);
	  for (var i = 0, walker = this.head; walker !== null; i++) {
	    arr[i] = walker.value;
	    walker = walker.next;
	  }
	  return arr;
	};
	Yallist.prototype.toArrayReverse = function () {
	  var arr = new Array(this.length);
	  for (var i = 0, walker = this.tail; walker !== null; i++) {
	    arr[i] = walker.value;
	    walker = walker.prev;
	  }
	  return arr;
	};
	Yallist.prototype.slice = function (from, to) {
	  to = to || this.length;
	  if (to < 0) {
	    to += this.length;
	  }
	  from = from || 0;
	  if (from < 0) {
	    from += this.length;
	  }
	  var ret = new Yallist();
	  if (to < from || to < 0) {
	    return ret;
	  }
	  if (from < 0) {
	    from = 0;
	  }
	  if (to > this.length) {
	    to = this.length;
	  }
	  for (var i = 0, walker = this.head; walker !== null && i < from; i++) {
	    walker = walker.next;
	  }
	  for (; walker !== null && i < to; i++, walker = walker.next) {
	    ret.push(walker.value);
	  }
	  return ret;
	};
	Yallist.prototype.sliceReverse = function (from, to) {
	  to = to || this.length;
	  if (to < 0) {
	    to += this.length;
	  }
	  from = from || 0;
	  if (from < 0) {
	    from += this.length;
	  }
	  var ret = new Yallist();
	  if (to < from || to < 0) {
	    return ret;
	  }
	  if (from < 0) {
	    from = 0;
	  }
	  if (to > this.length) {
	    to = this.length;
	  }
	  for (var i = this.length, walker = this.tail; walker !== null && i > to; i--) {
	    walker = walker.prev;
	  }
	  for (; walker !== null && i > from; i--, walker = walker.prev) {
	    ret.push(walker.value);
	  }
	  return ret;
	};
	Yallist.prototype.splice = function (start, deleteCount, ...nodes) {
	  if (start > this.length) {
	    start = this.length - 1;
	  }
	  if (start < 0) {
	    start = this.length + start;
	  }
	  for (var i = 0, walker = this.head; walker !== null && i < start; i++) {
	    walker = walker.next;
	  }
	  var ret = [];
	  for (var i = 0; walker && i < deleteCount; i++) {
	    ret.push(walker.value);
	    walker = this.removeNode(walker);
	  }
	  if (walker === null) {
	    walker = this.tail;
	  }
	  if (walker !== this.head && walker !== this.tail) {
	    walker = walker.prev;
	  }
	  for (var i = 0; i < nodes.length; i++) {
	    walker = insert(this, walker, nodes[i]);
	  }
	  return ret;
	};
	Yallist.prototype.reverse = function () {
	  var head = this.head;
	  var tail = this.tail;
	  for (var walker = head; walker !== null; walker = walker.prev) {
	    var p = walker.prev;
	    walker.prev = walker.next;
	    walker.next = p;
	  }
	  this.head = tail;
	  this.tail = head;
	  return this;
	};
	function insert(self, node, value) {
	  var inserted = node === self.head ? new Node(value, null, node, self) : new Node(value, node, node.next, self);
	  if (inserted.next === null) {
	    self.tail = inserted;
	  }
	  if (inserted.prev === null) {
	    self.head = inserted;
	  }
	  self.length++;
	  return inserted;
	}
	function push(self, item) {
	  self.tail = new Node(item, self.tail, null, self);
	  if (!self.head) {
	    self.head = self.tail;
	  }
	  self.length++;
	}
	function unshift(self, item) {
	  self.head = new Node(item, null, self.head, self);
	  if (!self.tail) {
	    self.tail = self.head;
	  }
	  self.length++;
	}
	function Node(value, prev, next, list) {
	  if (!(this instanceof Node)) {
	    return new Node(value, prev, next, list);
	  }
	  this.list = list;
	  this.value = value;
	  if (prev) {
	    prev.next = this;
	    this.prev = prev;
	  } else {
	    this.prev = null;
	  }
	  if (next) {
	    next.prev = this;
	    this.next = next;
	  } else {
	    this.next = null;
	  }
	}
	try {
	  // add if support for Symbol.iterator is present
	  requireIterator()(Yallist);
	} catch (er) {}
	return yallist;
}

var lruCache;
var hasRequiredLruCache;

function requireLruCache () {
	if (hasRequiredLruCache) return lruCache;
	hasRequiredLruCache = 1;

	// A linked list to keep track of recently-used-ness
	const Yallist = requireYallist();
	const MAX = Symbol('max');
	const LENGTH = Symbol('length');
	const LENGTH_CALCULATOR = Symbol('lengthCalculator');
	const ALLOW_STALE = Symbol('allowStale');
	const MAX_AGE = Symbol('maxAge');
	const DISPOSE = Symbol('dispose');
	const NO_DISPOSE_ON_SET = Symbol('noDisposeOnSet');
	const LRU_LIST = Symbol('lruList');
	const CACHE = Symbol('cache');
	const UPDATE_AGE_ON_GET = Symbol('updateAgeOnGet');
	const naiveLength = () => 1;

	// lruList is a yallist where the head is the youngest
	// item, and the tail is the oldest.  the list contains the Hit
	// objects as the entries.
	// Each Hit object has a reference to its Yallist.Node.  This
	// never changes.
	//
	// cache is a Map (or PseudoMap) that matches the keys to
	// the Yallist.Node object.
	class LRUCache {
	  constructor(options) {
	    if (typeof options === 'number') options = {
	      max: options
	    };
	    if (!options) options = {};
	    if (options.max && (typeof options.max !== 'number' || options.max < 0)) throw new TypeError('max must be a non-negative number');
	    // Kind of weird to have a default max of Infinity, but oh well.
	    this[MAX] = options.max || Infinity;
	    const lc = options.length || naiveLength;
	    this[LENGTH_CALCULATOR] = typeof lc !== 'function' ? naiveLength : lc;
	    this[ALLOW_STALE] = options.stale || false;
	    if (options.maxAge && typeof options.maxAge !== 'number') throw new TypeError('maxAge must be a number');
	    this[MAX_AGE] = options.maxAge || 0;
	    this[DISPOSE] = options.dispose;
	    this[NO_DISPOSE_ON_SET] = options.noDisposeOnSet || false;
	    this[UPDATE_AGE_ON_GET] = options.updateAgeOnGet || false;
	    this.reset();
	  }

	  // resize the cache when the max changes.
	  set max(mL) {
	    if (typeof mL !== 'number' || mL < 0) throw new TypeError('max must be a non-negative number');
	    this[MAX] = mL || Infinity;
	    trim(this);
	  }
	  get max() {
	    return this[MAX];
	  }
	  set allowStale(allowStale) {
	    this[ALLOW_STALE] = !!allowStale;
	  }
	  get allowStale() {
	    return this[ALLOW_STALE];
	  }
	  set maxAge(mA) {
	    if (typeof mA !== 'number') throw new TypeError('maxAge must be a non-negative number');
	    this[MAX_AGE] = mA;
	    trim(this);
	  }
	  get maxAge() {
	    return this[MAX_AGE];
	  }

	  // resize the cache when the lengthCalculator changes.
	  set lengthCalculator(lC) {
	    if (typeof lC !== 'function') lC = naiveLength;
	    if (lC !== this[LENGTH_CALCULATOR]) {
	      this[LENGTH_CALCULATOR] = lC;
	      this[LENGTH] = 0;
	      this[LRU_LIST].forEach(hit => {
	        hit.length = this[LENGTH_CALCULATOR](hit.value, hit.key);
	        this[LENGTH] += hit.length;
	      });
	    }
	    trim(this);
	  }
	  get lengthCalculator() {
	    return this[LENGTH_CALCULATOR];
	  }
	  get length() {
	    return this[LENGTH];
	  }
	  get itemCount() {
	    return this[LRU_LIST].length;
	  }
	  rforEach(fn, thisp) {
	    thisp = thisp || this;
	    for (let walker = this[LRU_LIST].tail; walker !== null;) {
	      const prev = walker.prev;
	      forEachStep(this, fn, walker, thisp);
	      walker = prev;
	    }
	  }
	  forEach(fn, thisp) {
	    thisp = thisp || this;
	    for (let walker = this[LRU_LIST].head; walker !== null;) {
	      const next = walker.next;
	      forEachStep(this, fn, walker, thisp);
	      walker = next;
	    }
	  }
	  keys() {
	    return this[LRU_LIST].toArray().map(k => k.key);
	  }
	  values() {
	    return this[LRU_LIST].toArray().map(k => k.value);
	  }
	  reset() {
	    if (this[DISPOSE] && this[LRU_LIST] && this[LRU_LIST].length) {
	      this[LRU_LIST].forEach(hit => this[DISPOSE](hit.key, hit.value));
	    }
	    this[CACHE] = new Map(); // hash of items by key
	    this[LRU_LIST] = new Yallist(); // list of items in order of use recency
	    this[LENGTH] = 0; // length of items in the list
	  }
	  dump() {
	    return this[LRU_LIST].map(hit => isStale(this, hit) ? false : {
	      k: hit.key,
	      v: hit.value,
	      e: hit.now + (hit.maxAge || 0)
	    }).toArray().filter(h => h);
	  }
	  dumpLru() {
	    return this[LRU_LIST];
	  }
	  set(key, value, maxAge) {
	    maxAge = maxAge || this[MAX_AGE];
	    if (maxAge && typeof maxAge !== 'number') throw new TypeError('maxAge must be a number');
	    const now = maxAge ? Date.now() : 0;
	    const len = this[LENGTH_CALCULATOR](value, key);
	    if (this[CACHE].has(key)) {
	      if (len > this[MAX]) {
	        del(this, this[CACHE].get(key));
	        return false;
	      }
	      const node = this[CACHE].get(key);
	      const item = node.value;

	      // dispose of the old one before overwriting
	      // split out into 2 ifs for better coverage tracking
	      if (this[DISPOSE]) {
	        if (!this[NO_DISPOSE_ON_SET]) this[DISPOSE](key, item.value);
	      }
	      item.now = now;
	      item.maxAge = maxAge;
	      item.value = value;
	      this[LENGTH] += len - item.length;
	      item.length = len;
	      this.get(key);
	      trim(this);
	      return true;
	    }
	    const hit = new Entry(key, value, len, now, maxAge);

	    // oversized objects fall out of cache automatically.
	    if (hit.length > this[MAX]) {
	      if (this[DISPOSE]) this[DISPOSE](key, value);
	      return false;
	    }
	    this[LENGTH] += hit.length;
	    this[LRU_LIST].unshift(hit);
	    this[CACHE].set(key, this[LRU_LIST].head);
	    trim(this);
	    return true;
	  }
	  has(key) {
	    if (!this[CACHE].has(key)) return false;
	    const hit = this[CACHE].get(key).value;
	    return !isStale(this, hit);
	  }
	  get(key) {
	    return get(this, key, true);
	  }
	  peek(key) {
	    return get(this, key, false);
	  }
	  pop() {
	    const node = this[LRU_LIST].tail;
	    if (!node) return null;
	    del(this, node);
	    return node.value;
	  }
	  del(key) {
	    del(this, this[CACHE].get(key));
	  }
	  load(arr) {
	    // reset the cache
	    this.reset();
	    const now = Date.now();
	    // A previous serialized cache has the most recent items first
	    for (let l = arr.length - 1; l >= 0; l--) {
	      const hit = arr[l];
	      const expiresAt = hit.e || 0;
	      if (expiresAt === 0)
	        // the item was created without expiration in a non aged cache
	        this.set(hit.k, hit.v);else {
	        const maxAge = expiresAt - now;
	        // dont add already expired items
	        if (maxAge > 0) {
	          this.set(hit.k, hit.v, maxAge);
	        }
	      }
	    }
	  }
	  prune() {
	    this[CACHE].forEach((value, key) => get(this, key, false));
	  }
	}
	const get = (self, key, doUse) => {
	  const node = self[CACHE].get(key);
	  if (node) {
	    const hit = node.value;
	    if (isStale(self, hit)) {
	      del(self, node);
	      if (!self[ALLOW_STALE]) return undefined;
	    } else {
	      if (doUse) {
	        if (self[UPDATE_AGE_ON_GET]) node.value.now = Date.now();
	        self[LRU_LIST].unshiftNode(node);
	      }
	    }
	    return hit.value;
	  }
	};
	const isStale = (self, hit) => {
	  if (!hit || !hit.maxAge && !self[MAX_AGE]) return false;
	  const diff = Date.now() - hit.now;
	  return hit.maxAge ? diff > hit.maxAge : self[MAX_AGE] && diff > self[MAX_AGE];
	};
	const trim = self => {
	  if (self[LENGTH] > self[MAX]) {
	    for (let walker = self[LRU_LIST].tail; self[LENGTH] > self[MAX] && walker !== null;) {
	      // We know that we're about to delete this one, and also
	      // what the next least recently used key will be, so just
	      // go ahead and set it now.
	      const prev = walker.prev;
	      del(self, walker);
	      walker = prev;
	    }
	  }
	};
	const del = (self, node) => {
	  if (node) {
	    const hit = node.value;
	    if (self[DISPOSE]) self[DISPOSE](hit.key, hit.value);
	    self[LENGTH] -= hit.length;
	    self[CACHE].delete(hit.key);
	    self[LRU_LIST].removeNode(node);
	  }
	};
	class Entry {
	  constructor(key, value, length, now, maxAge) {
	    this.key = key;
	    this.value = value;
	    this.length = length;
	    this.now = now;
	    this.maxAge = maxAge || 0;
	  }
	}
	const forEachStep = (self, fn, node, thisp) => {
	  let hit = node.value;
	  if (isStale(self, hit)) {
	    del(self, node);
	    if (!self[ALLOW_STALE]) hit = undefined;
	  }
	  if (hit) fn.call(thisp, hit.value, hit.key, self);
	};
	lruCache = LRUCache;
	return lruCache;
}

var range;
var hasRequiredRange;

function requireRange () {
	if (hasRequiredRange) return range;
	hasRequiredRange = 1;
	// hoisted class for cyclic dependency
	class Range {
	  constructor(range, options) {
	    options = parseOptions(options);
	    if (range instanceof Range) {
	      if (range.loose === !!options.loose && range.includePrerelease === !!options.includePrerelease) {
	        return range;
	      } else {
	        return new Range(range.raw, options);
	      }
	    }
	    if (range instanceof Comparator) {
	      // just put it in the set and return
	      this.raw = range.value;
	      this.set = [[range]];
	      this.format();
	      return this;
	    }
	    this.options = options;
	    this.loose = !!options.loose;
	    this.includePrerelease = !!options.includePrerelease;

	    // First reduce all whitespace as much as possible so we do not have to rely
	    // on potentially slow regexes like \s*. This is then stored and used for
	    // future error messages as well.
	    this.raw = range.trim().split(/\s+/).join(' ');

	    // First, split on ||
	    this.set = this.raw.split('||')
	    // map the range to a 2d array of comparators
	    .map(r => this.parseRange(r.trim()))
	    // throw out any comparator lists that are empty
	    // this generally means that it was not a valid range, which is allowed
	    // in loose mode, but will still throw if the WHOLE range is invalid.
	    .filter(c => c.length);
	    if (!this.set.length) {
	      throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
	    }

	    // if we have any that are not the null set, throw out null sets.
	    if (this.set.length > 1) {
	      // keep the first one, in case they're all null sets
	      const first = this.set[0];
	      this.set = this.set.filter(c => !isNullSet(c[0]));
	      if (this.set.length === 0) {
	        this.set = [first];
	      } else if (this.set.length > 1) {
	        // if we have any that are *, then the range is just *
	        for (const c of this.set) {
	          if (c.length === 1 && isAny(c[0])) {
	            this.set = [c];
	            break;
	          }
	        }
	      }
	    }
	    this.format();
	  }
	  format() {
	    this.range = this.set.map(comps => comps.join(' ').trim()).join('||').trim();
	    return this.range;
	  }
	  toString() {
	    return this.range;
	  }
	  parseRange(range) {
	    // memoize range parsing for performance.
	    // this is a very hot path, and fully deterministic.
	    const memoOpts = (this.options.includePrerelease && FLAG_INCLUDE_PRERELEASE) | (this.options.loose && FLAG_LOOSE);
	    const memoKey = memoOpts + ':' + range;
	    const cached = cache.get(memoKey);
	    if (cached) {
	      return cached;
	    }
	    const loose = this.options.loose;
	    // `1.2.3 - 1.2.4` => `>=1.2.3 <=1.2.4`
	    const hr = loose ? re[t.HYPHENRANGELOOSE] : re[t.HYPHENRANGE];
	    range = range.replace(hr, hyphenReplace(this.options.includePrerelease));
	    debug('hyphen replace', range);

	    // `> 1.2.3 < 1.2.5` => `>1.2.3 <1.2.5`
	    range = range.replace(re[t.COMPARATORTRIM], comparatorTrimReplace);
	    debug('comparator trim', range);

	    // `~ 1.2.3` => `~1.2.3`
	    range = range.replace(re[t.TILDETRIM], tildeTrimReplace);
	    debug('tilde trim', range);

	    // `^ 1.2.3` => `^1.2.3`
	    range = range.replace(re[t.CARETTRIM], caretTrimReplace);
	    debug('caret trim', range);

	    // At this point, the range is completely trimmed and
	    // ready to be split into comparators.

	    let rangeList = range.split(' ').map(comp => parseComparator(comp, this.options)).join(' ').split(/\s+/)
	    // >=0.0.0 is equivalent to *
	    .map(comp => replaceGTE0(comp, this.options));
	    if (loose) {
	      // in loose mode, throw out any that are not valid comparators
	      rangeList = rangeList.filter(comp => {
	        debug('loose invalid filter', comp, this.options);
	        return !!comp.match(re[t.COMPARATORLOOSE]);
	      });
	    }
	    debug('range list', rangeList);

	    // if any comparators are the null set, then replace with JUST null set
	    // if more than one comparator, remove any * comparators
	    // also, don't include the same comparator more than once
	    const rangeMap = new Map();
	    const comparators = rangeList.map(comp => new Comparator(comp, this.options));
	    for (const comp of comparators) {
	      if (isNullSet(comp)) {
	        return [comp];
	      }
	      rangeMap.set(comp.value, comp);
	    }
	    if (rangeMap.size > 1 && rangeMap.has('')) {
	      rangeMap.delete('');
	    }
	    const result = [...rangeMap.values()];
	    cache.set(memoKey, result);
	    return result;
	  }
	  intersects(range, options) {
	    if (!(range instanceof Range)) {
	      throw new TypeError('a Range is required');
	    }
	    return this.set.some(thisComparators => {
	      return isSatisfiable(thisComparators, options) && range.set.some(rangeComparators => {
	        return isSatisfiable(rangeComparators, options) && thisComparators.every(thisComparator => {
	          return rangeComparators.every(rangeComparator => {
	            return thisComparator.intersects(rangeComparator, options);
	          });
	        });
	      });
	    });
	  }

	  // if ANY of the sets match ALL of its comparators, then pass
	  test(version) {
	    if (!version) {
	      return false;
	    }
	    if (typeof version === 'string') {
	      try {
	        version = new SemVer(version, this.options);
	      } catch (er) {
	        return false;
	      }
	    }
	    for (let i = 0; i < this.set.length; i++) {
	      if (testSet(this.set[i], version, this.options)) {
	        return true;
	      }
	    }
	    return false;
	  }
	}
	range = Range;
	const LRU = requireLruCache();
	const cache = new LRU({
	  max: 1000
	});
	const parseOptions = parseOptions_1;
	const Comparator = requireComparator();
	const debug = debug_1;
	const SemVer = semver$2;
	const {
	  safeRe: re,
	  t,
	  comparatorTrimReplace,
	  tildeTrimReplace,
	  caretTrimReplace
	} = reExports;
	const {
	  FLAG_INCLUDE_PRERELEASE,
	  FLAG_LOOSE
	} = constants$1;
	const isNullSet = c => c.value === '<0.0.0-0';
	const isAny = c => c.value === '';

	// take a set of comparators and determine whether there
	// exists a version which can satisfy it
	const isSatisfiable = (comparators, options) => {
	  let result = true;
	  const remainingComparators = comparators.slice();
	  let testComparator = remainingComparators.pop();
	  while (result && remainingComparators.length) {
	    result = remainingComparators.every(otherComparator => {
	      return testComparator.intersects(otherComparator, options);
	    });
	    testComparator = remainingComparators.pop();
	  }
	  return result;
	};

	// comprised of xranges, tildes, stars, and gtlt's at this point.
	// already replaced the hyphen ranges
	// turn into a set of JUST comparators.
	const parseComparator = (comp, options) => {
	  debug('comp', comp, options);
	  comp = replaceCarets(comp, options);
	  debug('caret', comp);
	  comp = replaceTildes(comp, options);
	  debug('tildes', comp);
	  comp = replaceXRanges(comp, options);
	  debug('xrange', comp);
	  comp = replaceStars(comp, options);
	  debug('stars', comp);
	  return comp;
	};
	const isX = id => !id || id.toLowerCase() === 'x' || id === '*';

	// ~, ~> --> * (any, kinda silly)
	// ~2, ~2.x, ~2.x.x, ~>2, ~>2.x ~>2.x.x --> >=2.0.0 <3.0.0-0
	// ~2.0, ~2.0.x, ~>2.0, ~>2.0.x --> >=2.0.0 <2.1.0-0
	// ~1.2, ~1.2.x, ~>1.2, ~>1.2.x --> >=1.2.0 <1.3.0-0
	// ~1.2.3, ~>1.2.3 --> >=1.2.3 <1.3.0-0
	// ~1.2.0, ~>1.2.0 --> >=1.2.0 <1.3.0-0
	// ~0.0.1 --> >=0.0.1 <0.1.0-0
	const replaceTildes = (comp, options) => {
	  return comp.trim().split(/\s+/).map(c => replaceTilde(c, options)).join(' ');
	};
	const replaceTilde = (comp, options) => {
	  const r = options.loose ? re[t.TILDELOOSE] : re[t.TILDE];
	  return comp.replace(r, (_, M, m, p, pr) => {
	    debug('tilde', comp, _, M, m, p, pr);
	    let ret;
	    if (isX(M)) {
	      ret = '';
	    } else if (isX(m)) {
	      ret = `>=${M}.0.0 <${+M + 1}.0.0-0`;
	    } else if (isX(p)) {
	      // ~1.2 == >=1.2.0 <1.3.0-0
	      ret = `>=${M}.${m}.0 <${M}.${+m + 1}.0-0`;
	    } else if (pr) {
	      debug('replaceTilde pr', pr);
	      ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
	    } else {
	      // ~1.2.3 == >=1.2.3 <1.3.0-0
	      ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
	    }
	    debug('tilde return', ret);
	    return ret;
	  });
	};

	// ^ --> * (any, kinda silly)
	// ^2, ^2.x, ^2.x.x --> >=2.0.0 <3.0.0-0
	// ^2.0, ^2.0.x --> >=2.0.0 <3.0.0-0
	// ^1.2, ^1.2.x --> >=1.2.0 <2.0.0-0
	// ^1.2.3 --> >=1.2.3 <2.0.0-0
	// ^1.2.0 --> >=1.2.0 <2.0.0-0
	// ^0.0.1 --> >=0.0.1 <0.0.2-0
	// ^0.1.0 --> >=0.1.0 <0.2.0-0
	const replaceCarets = (comp, options) => {
	  return comp.trim().split(/\s+/).map(c => replaceCaret(c, options)).join(' ');
	};
	const replaceCaret = (comp, options) => {
	  debug('caret', comp, options);
	  const r = options.loose ? re[t.CARETLOOSE] : re[t.CARET];
	  const z = options.includePrerelease ? '-0' : '';
	  return comp.replace(r, (_, M, m, p, pr) => {
	    debug('caret', comp, _, M, m, p, pr);
	    let ret;
	    if (isX(M)) {
	      ret = '';
	    } else if (isX(m)) {
	      ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
	    } else if (isX(p)) {
	      if (M === '0') {
	        ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
	      } else {
	        ret = `>=${M}.${m}.0${z} <${+M + 1}.0.0-0`;
	      }
	    } else if (pr) {
	      debug('replaceCaret pr', pr);
	      if (M === '0') {
	        if (m === '0') {
	          ret = `>=${M}.${m}.${p}-${pr} <${M}.${m}.${+p + 1}-0`;
	        } else {
	          ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
	        }
	      } else {
	        ret = `>=${M}.${m}.${p}-${pr} <${+M + 1}.0.0-0`;
	      }
	    } else {
	      debug('no pr');
	      if (M === '0') {
	        if (m === '0') {
	          ret = `>=${M}.${m}.${p}${z} <${M}.${m}.${+p + 1}-0`;
	        } else {
	          ret = `>=${M}.${m}.${p}${z} <${M}.${+m + 1}.0-0`;
	        }
	      } else {
	        ret = `>=${M}.${m}.${p} <${+M + 1}.0.0-0`;
	      }
	    }
	    debug('caret return', ret);
	    return ret;
	  });
	};
	const replaceXRanges = (comp, options) => {
	  debug('replaceXRanges', comp, options);
	  return comp.split(/\s+/).map(c => replaceXRange(c, options)).join(' ');
	};
	const replaceXRange = (comp, options) => {
	  comp = comp.trim();
	  const r = options.loose ? re[t.XRANGELOOSE] : re[t.XRANGE];
	  return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
	    debug('xRange', comp, ret, gtlt, M, m, p, pr);
	    const xM = isX(M);
	    const xm = xM || isX(m);
	    const xp = xm || isX(p);
	    const anyX = xp;
	    if (gtlt === '=' && anyX) {
	      gtlt = '';
	    }

	    // if we're including prereleases in the match, then we need
	    // to fix this to -0, the lowest possible prerelease value
	    pr = options.includePrerelease ? '-0' : '';
	    if (xM) {
	      if (gtlt === '>' || gtlt === '<') {
	        // nothing is allowed
	        ret = '<0.0.0-0';
	      } else {
	        // nothing is forbidden
	        ret = '*';
	      }
	    } else if (gtlt && anyX) {
	      // we know patch is an x, because we have any x at all.
	      // replace X with 0
	      if (xm) {
	        m = 0;
	      }
	      p = 0;
	      if (gtlt === '>') {
	        // >1 => >=2.0.0
	        // >1.2 => >=1.3.0
	        gtlt = '>=';
	        if (xm) {
	          M = +M + 1;
	          m = 0;
	          p = 0;
	        } else {
	          m = +m + 1;
	          p = 0;
	        }
	      } else if (gtlt === '<=') {
	        // <=0.7.x is actually <0.8.0, since any 0.7.x should
	        // pass.  Similarly, <=7.x is actually <8.0.0, etc.
	        gtlt = '<';
	        if (xm) {
	          M = +M + 1;
	        } else {
	          m = +m + 1;
	        }
	      }
	      if (gtlt === '<') {
	        pr = '-0';
	      }
	      ret = `${gtlt + M}.${m}.${p}${pr}`;
	    } else if (xm) {
	      ret = `>=${M}.0.0${pr} <${+M + 1}.0.0-0`;
	    } else if (xp) {
	      ret = `>=${M}.${m}.0${pr} <${M}.${+m + 1}.0-0`;
	    }
	    debug('xRange return', ret);
	    return ret;
	  });
	};

	// Because * is AND-ed with everything else in the comparator,
	// and '' means "any version", just remove the *s entirely.
	const replaceStars = (comp, options) => {
	  debug('replaceStars', comp, options);
	  // Looseness is ignored here.  star is always as loose as it gets!
	  return comp.trim().replace(re[t.STAR], '');
	};
	const replaceGTE0 = (comp, options) => {
	  debug('replaceGTE0', comp, options);
	  return comp.trim().replace(re[options.includePrerelease ? t.GTE0PRE : t.GTE0], '');
	};

	// This function is passed to string.replace(re[t.HYPHENRANGE])
	// M, m, patch, prerelease, build
	// 1.2 - 3.4.5 => >=1.2.0 <=3.4.5
	// 1.2.3 - 3.4 => >=1.2.0 <3.5.0-0 Any 3.4.x will do
	// 1.2 - 3.4 => >=1.2.0 <3.5.0-0
	const hyphenReplace = incPr => ($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr, tb) => {
	  if (isX(fM)) {
	    from = '';
	  } else if (isX(fm)) {
	    from = `>=${fM}.0.0${incPr ? '-0' : ''}`;
	  } else if (isX(fp)) {
	    from = `>=${fM}.${fm}.0${incPr ? '-0' : ''}`;
	  } else if (fpr) {
	    from = `>=${from}`;
	  } else {
	    from = `>=${from}${incPr ? '-0' : ''}`;
	  }
	  if (isX(tM)) {
	    to = '';
	  } else if (isX(tm)) {
	    to = `<${+tM + 1}.0.0-0`;
	  } else if (isX(tp)) {
	    to = `<${tM}.${+tm + 1}.0-0`;
	  } else if (tpr) {
	    to = `<=${tM}.${tm}.${tp}-${tpr}`;
	  } else if (incPr) {
	    to = `<${tM}.${tm}.${+tp + 1}-0`;
	  } else {
	    to = `<=${to}`;
	  }
	  return `${from} ${to}`.trim();
	};
	const testSet = (set, version, options) => {
	  for (let i = 0; i < set.length; i++) {
	    if (!set[i].test(version)) {
	      return false;
	    }
	  }
	  if (version.prerelease.length && !options.includePrerelease) {
	    // Find the set of versions that are allowed to have prereleases
	    // For example, ^1.2.3-pr.1 desugars to >=1.2.3-pr.1 <2.0.0
	    // That should allow `1.2.3-pr.2` to pass.
	    // However, `1.2.4-alpha.notready` should NOT be allowed,
	    // even though it's within the range set by the comparators.
	    for (let i = 0; i < set.length; i++) {
	      debug(set[i].semver);
	      if (set[i].semver === Comparator.ANY) {
	        continue;
	      }
	      if (set[i].semver.prerelease.length > 0) {
	        const allowed = set[i].semver;
	        if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) {
	          return true;
	        }
	      }
	    }

	    // Version has a -pre, but it's not one of the ones we like.
	    return false;
	  }
	  return true;
	};
	return range;
}

var comparator;
var hasRequiredComparator;

function requireComparator () {
	if (hasRequiredComparator) return comparator;
	hasRequiredComparator = 1;
	const ANY = Symbol('SemVer ANY');
	// hoisted class for cyclic dependency
	class Comparator {
	  static get ANY() {
	    return ANY;
	  }
	  constructor(comp, options) {
	    options = parseOptions(options);
	    if (comp instanceof Comparator) {
	      if (comp.loose === !!options.loose) {
	        return comp;
	      } else {
	        comp = comp.value;
	      }
	    }
	    comp = comp.trim().split(/\s+/).join(' ');
	    debug('comparator', comp, options);
	    this.options = options;
	    this.loose = !!options.loose;
	    this.parse(comp);
	    if (this.semver === ANY) {
	      this.value = '';
	    } else {
	      this.value = this.operator + this.semver.version;
	    }
	    debug('comp', this);
	  }
	  parse(comp) {
	    const r = this.options.loose ? re[t.COMPARATORLOOSE] : re[t.COMPARATOR];
	    const m = comp.match(r);
	    if (!m) {
	      throw new TypeError(`Invalid comparator: ${comp}`);
	    }
	    this.operator = m[1] !== undefined ? m[1] : '';
	    if (this.operator === '=') {
	      this.operator = '';
	    }

	    // if it literally is just '>' or '' then allow anything.
	    if (!m[2]) {
	      this.semver = ANY;
	    } else {
	      this.semver = new SemVer(m[2], this.options.loose);
	    }
	  }
	  toString() {
	    return this.value;
	  }
	  test(version) {
	    debug('Comparator.test', version, this.options.loose);
	    if (this.semver === ANY || version === ANY) {
	      return true;
	    }
	    if (typeof version === 'string') {
	      try {
	        version = new SemVer(version, this.options);
	      } catch (er) {
	        return false;
	      }
	    }
	    return cmp(version, this.operator, this.semver, this.options);
	  }
	  intersects(comp, options) {
	    if (!(comp instanceof Comparator)) {
	      throw new TypeError('a Comparator is required');
	    }
	    if (this.operator === '') {
	      if (this.value === '') {
	        return true;
	      }
	      return new Range(comp.value, options).test(this.value);
	    } else if (comp.operator === '') {
	      if (comp.value === '') {
	        return true;
	      }
	      return new Range(this.value, options).test(comp.semver);
	    }
	    options = parseOptions(options);

	    // Special cases where nothing can possibly be lower
	    if (options.includePrerelease && (this.value === '<0.0.0-0' || comp.value === '<0.0.0-0')) {
	      return false;
	    }
	    if (!options.includePrerelease && (this.value.startsWith('<0.0.0') || comp.value.startsWith('<0.0.0'))) {
	      return false;
	    }

	    // Same direction increasing (> or >=)
	    if (this.operator.startsWith('>') && comp.operator.startsWith('>')) {
	      return true;
	    }
	    // Same direction decreasing (< or <=)
	    if (this.operator.startsWith('<') && comp.operator.startsWith('<')) {
	      return true;
	    }
	    // same SemVer and both sides are inclusive (<= or >=)
	    if (this.semver.version === comp.semver.version && this.operator.includes('=') && comp.operator.includes('=')) {
	      return true;
	    }
	    // opposite directions less than
	    if (cmp(this.semver, '<', comp.semver, options) && this.operator.startsWith('>') && comp.operator.startsWith('<')) {
	      return true;
	    }
	    // opposite directions greater than
	    if (cmp(this.semver, '>', comp.semver, options) && this.operator.startsWith('<') && comp.operator.startsWith('>')) {
	      return true;
	    }
	    return false;
	  }
	}
	comparator = Comparator;
	const parseOptions = parseOptions_1;
	const {
	  safeRe: re,
	  t
	} = reExports;
	const cmp = cmp_1;
	const debug = debug_1;
	const SemVer = semver$2;
	const Range = requireRange();
	return comparator;
}

const Range$9 = requireRange();
const satisfies$4 = (version, range, options) => {
  try {
    range = new Range$9(range, options);
  } catch (er) {
    return false;
  }
  return range.test(version);
};
var satisfies_1 = satisfies$4;

const Range$8 = requireRange();

// Mostly just for testing and legacy API reasons
const toComparators$1 = (range, options) => new Range$8(range, options).set.map(comp => comp.map(c => c.value).join(' ').trim().split(' '));
var toComparators_1 = toComparators$1;

const SemVer$4 = semver$2;
const Range$7 = requireRange();
const maxSatisfying$1 = (versions, range, options) => {
  let max = null;
  let maxSV = null;
  let rangeObj = null;
  try {
    rangeObj = new Range$7(range, options);
  } catch (er) {
    return null;
  }
  versions.forEach(v => {
    if (rangeObj.test(v)) {
      // satisfies(v, range, options)
      if (!max || maxSV.compare(v) === -1) {
        // compare(max, v, true)
        max = v;
        maxSV = new SemVer$4(max, options);
      }
    }
  });
  return max;
};
var maxSatisfying_1 = maxSatisfying$1;

const SemVer$3 = semver$2;
const Range$6 = requireRange();
const minSatisfying$1 = (versions, range, options) => {
  let min = null;
  let minSV = null;
  let rangeObj = null;
  try {
    rangeObj = new Range$6(range, options);
  } catch (er) {
    return null;
  }
  versions.forEach(v => {
    if (rangeObj.test(v)) {
      // satisfies(v, range, options)
      if (!min || minSV.compare(v) === 1) {
        // compare(min, v, true)
        min = v;
        minSV = new SemVer$3(min, options);
      }
    }
  });
  return min;
};
var minSatisfying_1 = minSatisfying$1;

const SemVer$2 = semver$2;
const Range$5 = requireRange();
const gt$2 = gt_1;
const minVersion$1 = (range, loose) => {
  range = new Range$5(range, loose);
  let minver = new SemVer$2('0.0.0');
  if (range.test(minver)) {
    return minver;
  }
  minver = new SemVer$2('0.0.0-0');
  if (range.test(minver)) {
    return minver;
  }
  minver = null;
  for (let i = 0; i < range.set.length; ++i) {
    const comparators = range.set[i];
    let setMin = null;
    comparators.forEach(comparator => {
      // Clone to avoid manipulating the comparator's semver object.
      const compver = new SemVer$2(comparator.semver.version);
      switch (comparator.operator) {
        case '>':
          if (compver.prerelease.length === 0) {
            compver.patch++;
          } else {
            compver.prerelease.push(0);
          }
          compver.raw = compver.format();
        /* fallthrough */
        case '':
        case '>=':
          if (!setMin || gt$2(compver, setMin)) {
            setMin = compver;
          }
          break;
        case '<':
        case '<=':
          /* Ignore maximum versions */
          break;
        /* istanbul ignore next */
        default:
          throw new Error(`Unexpected operation: ${comparator.operator}`);
      }
    });
    if (setMin && (!minver || gt$2(minver, setMin))) {
      minver = setMin;
    }
  }
  if (minver && range.test(minver)) {
    return minver;
  }
  return null;
};
var minVersion_1 = minVersion$1;

const Range$4 = requireRange();
const validRange$1 = (range, options) => {
  try {
    // Return '*' instead of '' so that truthiness works.
    // This will throw if it's invalid anyway
    return new Range$4(range, options).range || '*';
  } catch (er) {
    return null;
  }
};
var valid$1 = validRange$1;

const SemVer$1 = semver$2;
const Comparator$2 = requireComparator();
const {
  ANY: ANY$1
} = Comparator$2;
const Range$3 = requireRange();
const satisfies$3 = satisfies_1;
const gt$1 = gt_1;
const lt$1 = lt_1;
const lte$1 = lte_1;
const gte$1 = gte_1;
const outside$3 = (version, range, hilo, options) => {
  version = new SemVer$1(version, options);
  range = new Range$3(range, options);
  let gtfn, ltefn, ltfn, comp, ecomp;
  switch (hilo) {
    case '>':
      gtfn = gt$1;
      ltefn = lte$1;
      ltfn = lt$1;
      comp = '>';
      ecomp = '>=';
      break;
    case '<':
      gtfn = lt$1;
      ltefn = gte$1;
      ltfn = gt$1;
      comp = '<';
      ecomp = '<=';
      break;
    default:
      throw new TypeError('Must provide a hilo val of "<" or ">"');
  }

  // If it satisfies the range it is not outside
  if (satisfies$3(version, range, options)) {
    return false;
  }

  // From now on, variable terms are as if we're in "gtr" mode.
  // but note that everything is flipped for the "ltr" function.

  for (let i = 0; i < range.set.length; ++i) {
    const comparators = range.set[i];
    let high = null;
    let low = null;
    comparators.forEach(comparator => {
      if (comparator.semver === ANY$1) {
        comparator = new Comparator$2('>=0.0.0');
      }
      high = high || comparator;
      low = low || comparator;
      if (gtfn(comparator.semver, high.semver, options)) {
        high = comparator;
      } else if (ltfn(comparator.semver, low.semver, options)) {
        low = comparator;
      }
    });

    // If the edge version comparator has a operator then our version
    // isn't outside it
    if (high.operator === comp || high.operator === ecomp) {
      return false;
    }

    // If the lowest version comparator has an operator and our version
    // is less than it then it isn't higher than the range
    if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) {
      return false;
    } else if (low.operator === ecomp && ltfn(version, low.semver)) {
      return false;
    }
  }
  return true;
};
var outside_1 = outside$3;

// Determine if version is greater than all the versions possible in the range.
const outside$2 = outside_1;
const gtr$1 = (version, range, options) => outside$2(version, range, '>', options);
var gtr_1 = gtr$1;

const outside$1 = outside_1;
// Determine if version is less than all the versions possible in the range
const ltr$1 = (version, range, options) => outside$1(version, range, '<', options);
var ltr_1 = ltr$1;

const Range$2 = requireRange();
const intersects$1 = (r1, r2, options) => {
  r1 = new Range$2(r1, options);
  r2 = new Range$2(r2, options);
  return r1.intersects(r2, options);
};
var intersects_1 = intersects$1;

// given a set of versions and a range, create a "simplified" range
// that includes the same versions that the original range does
// If the original range is shorter than the simplified one, return that.
const satisfies$2 = satisfies_1;
const compare$2 = compare_1;
var simplify = (versions, range, options) => {
  const set = [];
  let first = null;
  let prev = null;
  const v = versions.sort((a, b) => compare$2(a, b, options));
  for (const version of v) {
    const included = satisfies$2(version, range, options);
    if (included) {
      prev = version;
      if (!first) {
        first = version;
      }
    } else {
      if (prev) {
        set.push([first, prev]);
      }
      prev = null;
      first = null;
    }
  }
  if (first) {
    set.push([first, null]);
  }
  const ranges = [];
  for (const [min, max] of set) {
    if (min === max) {
      ranges.push(min);
    } else if (!max && min === v[0]) {
      ranges.push('*');
    } else if (!max) {
      ranges.push(`>=${min}`);
    } else if (min === v[0]) {
      ranges.push(`<=${max}`);
    } else {
      ranges.push(`${min} - ${max}`);
    }
  }
  const simplified = ranges.join(' || ');
  const original = typeof range.raw === 'string' ? range.raw : String(range);
  return simplified.length < original.length ? simplified : range;
};

const Range$1 = requireRange();
const Comparator$1 = requireComparator();
const {
  ANY
} = Comparator$1;
const satisfies$1 = satisfies_1;
const compare$1 = compare_1;

// Complex range `r1 || r2 || ...` is a subset of `R1 || R2 || ...` iff:
// - Every simple range `r1, r2, ...` is a null set, OR
// - Every simple range `r1, r2, ...` which is not a null set is a subset of
//   some `R1, R2, ...`
//
// Simple range `c1 c2 ...` is a subset of simple range `C1 C2 ...` iff:
// - If c is only the ANY comparator
//   - If C is only the ANY comparator, return true
//   - Else if in prerelease mode, return false
//   - else replace c with `[>=0.0.0]`
// - If C is only the ANY comparator
//   - if in prerelease mode, return true
//   - else replace C with `[>=0.0.0]`
// - Let EQ be the set of = comparators in c
// - If EQ is more than one, return true (null set)
// - Let GT be the highest > or >= comparator in c
// - Let LT be the lowest < or <= comparator in c
// - If GT and LT, and GT.semver > LT.semver, return true (null set)
// - If any C is a = range, and GT or LT are set, return false
// - If EQ
//   - If GT, and EQ does not satisfy GT, return true (null set)
//   - If LT, and EQ does not satisfy LT, return true (null set)
//   - If EQ satisfies every C, return true
//   - Else return false
// - If GT
//   - If GT.semver is lower than any > or >= comp in C, return false
//   - If GT is >=, and GT.semver does not satisfy every C, return false
//   - If GT.semver has a prerelease, and not in prerelease mode
//     - If no C has a prerelease and the GT.semver tuple, return false
// - If LT
//   - If LT.semver is greater than any < or <= comp in C, return false
//   - If LT is <=, and LT.semver does not satisfy every C, return false
//   - If GT.semver has a prerelease, and not in prerelease mode
//     - If no C has a prerelease and the LT.semver tuple, return false
// - Else return true

const subset$1 = (sub, dom, options = {}) => {
  if (sub === dom) {
    return true;
  }
  sub = new Range$1(sub, options);
  dom = new Range$1(dom, options);
  let sawNonNull = false;
  OUTER: for (const simpleSub of sub.set) {
    for (const simpleDom of dom.set) {
      const isSub = simpleSubset(simpleSub, simpleDom, options);
      sawNonNull = sawNonNull || isSub !== null;
      if (isSub) {
        continue OUTER;
      }
    }
    // the null set is a subset of everything, but null simple ranges in
    // a complex range should be ignored.  so if we saw a non-null range,
    // then we know this isn't a subset, but if EVERY simple range was null,
    // then it is a subset.
    if (sawNonNull) {
      return false;
    }
  }
  return true;
};
const minimumVersionWithPreRelease = [new Comparator$1('>=0.0.0-0')];
const minimumVersion = [new Comparator$1('>=0.0.0')];
const simpleSubset = (sub, dom, options) => {
  if (sub === dom) {
    return true;
  }
  if (sub.length === 1 && sub[0].semver === ANY) {
    if (dom.length === 1 && dom[0].semver === ANY) {
      return true;
    } else if (options.includePrerelease) {
      sub = minimumVersionWithPreRelease;
    } else {
      sub = minimumVersion;
    }
  }
  if (dom.length === 1 && dom[0].semver === ANY) {
    if (options.includePrerelease) {
      return true;
    } else {
      dom = minimumVersion;
    }
  }
  const eqSet = new Set();
  let gt, lt;
  for (const c of sub) {
    if (c.operator === '>' || c.operator === '>=') {
      gt = higherGT(gt, c, options);
    } else if (c.operator === '<' || c.operator === '<=') {
      lt = lowerLT(lt, c, options);
    } else {
      eqSet.add(c.semver);
    }
  }
  if (eqSet.size > 1) {
    return null;
  }
  let gtltComp;
  if (gt && lt) {
    gtltComp = compare$1(gt.semver, lt.semver, options);
    if (gtltComp > 0) {
      return null;
    } else if (gtltComp === 0 && (gt.operator !== '>=' || lt.operator !== '<=')) {
      return null;
    }
  }

  // will iterate one or zero times
  for (const eq of eqSet) {
    if (gt && !satisfies$1(eq, String(gt), options)) {
      return null;
    }
    if (lt && !satisfies$1(eq, String(lt), options)) {
      return null;
    }
    for (const c of dom) {
      if (!satisfies$1(eq, String(c), options)) {
        return false;
      }
    }
    return true;
  }
  let higher, lower;
  let hasDomLT, hasDomGT;
  // if the subset has a prerelease, we need a comparator in the superset
  // with the same tuple and a prerelease, or it's not a subset
  let needDomLTPre = lt && !options.includePrerelease && lt.semver.prerelease.length ? lt.semver : false;
  let needDomGTPre = gt && !options.includePrerelease && gt.semver.prerelease.length ? gt.semver : false;
  // exception: <1.2.3-0 is the same as <1.2.3
  if (needDomLTPre && needDomLTPre.prerelease.length === 1 && lt.operator === '<' && needDomLTPre.prerelease[0] === 0) {
    needDomLTPre = false;
  }
  for (const c of dom) {
    hasDomGT = hasDomGT || c.operator === '>' || c.operator === '>=';
    hasDomLT = hasDomLT || c.operator === '<' || c.operator === '<=';
    if (gt) {
      if (needDomGTPre) {
        if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomGTPre.major && c.semver.minor === needDomGTPre.minor && c.semver.patch === needDomGTPre.patch) {
          needDomGTPre = false;
        }
      }
      if (c.operator === '>' || c.operator === '>=') {
        higher = higherGT(gt, c, options);
        if (higher === c && higher !== gt) {
          return false;
        }
      } else if (gt.operator === '>=' && !satisfies$1(gt.semver, String(c), options)) {
        return false;
      }
    }
    if (lt) {
      if (needDomLTPre) {
        if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomLTPre.major && c.semver.minor === needDomLTPre.minor && c.semver.patch === needDomLTPre.patch) {
          needDomLTPre = false;
        }
      }
      if (c.operator === '<' || c.operator === '<=') {
        lower = lowerLT(lt, c, options);
        if (lower === c && lower !== lt) {
          return false;
        }
      } else if (lt.operator === '<=' && !satisfies$1(lt.semver, String(c), options)) {
        return false;
      }
    }
    if (!c.operator && (lt || gt) && gtltComp !== 0) {
      return false;
    }
  }

  // if there was a < or >, and nothing in the dom, then must be false
  // UNLESS it was limited by another range in the other direction.
  // Eg, >1.0.0 <1.0.1 is still a subset of <2.0.0
  if (gt && hasDomLT && !lt && gtltComp !== 0) {
    return false;
  }
  if (lt && hasDomGT && !gt && gtltComp !== 0) {
    return false;
  }

  // we needed a prerelease range in a specific tuple, but didn't get one
  // then this isn't a subset.  eg >=1.2.3-pre is not a subset of >=1.0.0,
  // because it includes prereleases in the 1.2.3 tuple
  if (needDomGTPre || needDomLTPre) {
    return false;
  }
  return true;
};

// >=1.2.3 is lower than >1.2.3
const higherGT = (a, b, options) => {
  if (!a) {
    return b;
  }
  const comp = compare$1(a.semver, b.semver, options);
  return comp > 0 ? a : comp < 0 ? b : b.operator === '>' && a.operator === '>=' ? b : a;
};

// <=1.2.3 is higher than <1.2.3
const lowerLT = (a, b, options) => {
  if (!a) {
    return b;
  }
  const comp = compare$1(a.semver, b.semver, options);
  return comp < 0 ? a : comp > 0 ? b : b.operator === '<' && a.operator === '<=' ? b : a;
};
var subset_1 = subset$1;

// just pre-load all the stuff that index.js lazily exports
const internalRe = reExports;
const constants = constants$1;
const SemVer = semver$2;
const identifiers = identifiers$1;
const parse = parse_1;
const valid = valid_1;
const clean = clean_1;
const inc = inc_1;
const diff = diff_1;
const major = major_1;
const minor = minor_1;
const patch = patch_1;
const prerelease = prerelease_1;
const compare = compare_1;
const rcompare = rcompare_1;
const compareLoose = compareLoose_1;
const compareBuild = compareBuild_1;
const sort = sort_1;
const rsort = rsort_1;
const gt = gt_1;
const lt = lt_1;
const eq = eq_1;
const neq = neq_1;
const gte = gte_1;
const lte = lte_1;
const cmp = cmp_1;
const coerce = coerce_1;
const Comparator = requireComparator();
const Range = requireRange();
const satisfies = satisfies_1;
const toComparators = toComparators_1;
const maxSatisfying = maxSatisfying_1;
const minSatisfying = minSatisfying_1;
const minVersion = minVersion_1;
const validRange = valid$1;
const outside = outside_1;
const gtr = gtr_1;
const ltr = ltr_1;
const intersects = intersects_1;
const simplifyRange = simplify;
const subset = subset_1;
var semver = {
  parse,
  valid,
  clean,
  inc,
  diff,
  major,
  minor,
  patch,
  prerelease,
  compare,
  rcompare,
  compareLoose,
  compareBuild,
  sort,
  rsort,
  gt,
  lt,
  eq,
  neq,
  gte,
  lte,
  cmp,
  coerce,
  Comparator,
  Range,
  satisfies,
  toComparators,
  maxSatisfying,
  minSatisfying,
  minVersion,
  validRange,
  outside,
  gtr,
  ltr,
  intersects,
  simplifyRange,
  subset,
  SemVer,
  re: internalRe.re,
  src: internalRe.src,
  tokens: internalRe.t,
  SEMVER_SPEC_VERSION: constants.SEMVER_SPEC_VERSION,
  RELEASE_TYPES: constants.RELEASE_TYPES,
  compareIdentifiers: identifiers.compareIdentifiers,
  rcompareIdentifiers: identifiers.rcompareIdentifiers
};

var semver$1 = /*@__PURE__*/getDefaultExportFromCjs(semver);

async function showUpdateNotice(url) {
  let button = document.createElement('button');
  button.label = 'Check it out!';
  button.onClick = function () {
    require('electron').shell.openExternal(url);
  };
  BdApi.UI.showNotice('Pluralchum has a new update!', {
    type: 'info',
    buttons: [button]
  });
}
async function checkForUpdates(currentVersion) {
  let data = await fetch('https://api.github.com/repos/estroBiologist/pluralchum/releases/latest');
  if (data.ok) {
    let latestRelease = await data.json();
    let latestVersion = latestRelease.tag_name;
    if (semver$1.gt(latestVersion, currentVersion)) {
      showUpdateNotice(latestRelease.html_url);
    }
  }
}
function upgradeCache(settings, profileMap, currentVersion) {
  let cacheVersion = settings.get().version;
  if (!cacheVersion || semver$1.gt(currentVersion, cacheVersion)) {
    settings.update(function (s) {
      return {
        ...s,
        version: currentVersion
      };
    });
    for (const [key, value] of profileMap.entries()) {
      profileMap.set(key, {
        ...value,
        status: ProfileStatus.Stale
      });
    }
  }
}

const version = '2.2.0';
class Pluralchum {
  patches = [];
  start() {
    this.settings = initializeSettings();
    console.log('[PLURALCHUM] Loaded settings');
    this.profileMap = initializeProfileMap();
    console.log('[PLURALCHUM] Loaded PK data');
    upgradeCache(this.settings, this.profileMap, version);
    requireEula(this.settings);
    this.enabled = new ValueCell(true);
    patchMessageContent(this.settings, this.profileMap, this.enabled);
    patchMessageHeader(this.settings, this.profileMap, this.enabled);
    patchMessage(this.profileMap, this.enabled);
    this.patches.push(patchEditMenuItem());
    patchEditAction();
    softReload();
    checkForUpdates(version);
  }
  stop() {
    this.enabled.set(false);
    for (let i = this.patches.length - 1; i >= 0; i--) this.patches[i]();
    purgeOldProfiles(this.profileMap);
    BdApi.Patcher.unpatchAll(pluginName);
    ZLibrary.DOMTools.removeStyle(pluginName);
  }
  getSettingsPanel() {
    return settingsPanel(this.settings, this.profileMap);
  }
  getName() {
    return pluginName;
  }
}
async function softReload() {
  let channel = ZLibrary.DiscordModules.SelectedChannelStore.getChannelId();
  let guild = ZLibrary.DiscordModules.SelectedGuildStore.getGuildId();
  await ZLibrary.DiscordModules.NavigationUtils.transitionTo(ZLibrary.DiscordModules.DiscordConstants.Routes.INDEX);
  await sleep(100);
  await ZLibrary.DiscordModules.NavigationUtils.transitionTo(ZLibrary.DiscordModules.DiscordConstants.Routes.CHANNEL(guild, channel));
}

exports.Pluralchum = Pluralchum;
