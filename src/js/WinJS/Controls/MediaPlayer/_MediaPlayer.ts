// Copyright (c) Microsoft Corporation.  All Rights Reserved. Licensed under the MIT License. See License.txt in the project root for license information.
/// <reference path="../../../../../typings/require.d.ts" />

// import Animations = require('../../Animations');
import _Base = require('../../Core/_Base');
import _BaseUtils = require('../../Core/_BaseUtils');
import _Control = require('../../Utilities/_Control');
import _Dispose = require('../../Utilities/_Dispose');
import _ElementUtilities = require('../../Utilities/_ElementUtilities');
import _ErrorFromName = require('../../Core/_ErrorFromName');
import _Events = require('../../Core/_Events');
import _Global = require('../../Core/_Global');
import _Hoverable = require('../../Utilities/_Hoverable');
import Promise = require('../../Promise');
// import _TransitionAnimation = require('../../Animations/_TransitionAnimation');

require(["require-style!less/styles-splitview"]);
require(["require-style!less/colors-splitview"]);

// Force-load Dependencies
_Hoverable.isHoverable;

"use strict";

var transformNames = _BaseUtils._browserStyleEquivalents["transform"];
var Strings = {
    get duplicateConstruction() { return "Invalid argument: Controls may only be instantiated one time for each DOM element"; }
};
var ClassNames = {
    mediaPlayer: "win-mediaplayer"
};
var EventNames = {
};

export class MediaPlayer {

    static supportedForProcessing: boolean = true;

    private static _ClassNames = ClassNames;

    private _disposed: boolean;
    _dom: {
        root: HTMLElement;
    };

    constructor(element?: HTMLElement, options: any = {}) {
        // Check to make sure we weren't duplicated
        if (element && element["winControl"]) {
            throw new _ErrorFromName("WinJS.UI.MediaPlayer.DuplicateConstruction", Strings.duplicateConstruction);
        }

        this._initializeDom(element || _Global.document.createElement("div"));

        // Initialize private state.
        this._disposed = false;

        // Initialize public properties.
        _Control.setOptions(this, options);
    }
	
    get element(): HTMLElement {
        return this._dom.root;
    }

    dispose(): void {
        if (this._disposed) {
            return;
        }
        this._disposed = true;
    }

    private _initializeDom(root: HTMLElement): void {
        root["winControl"] = this;
        _ElementUtilities.addClass(root, ClassNames.mediaPlayer);
        _ElementUtilities.addClass(root, "win-disposable");

        this._dom = {
            root: root
        };
    }

    // State private to _updateDomImpl. No other method should make use of it.
    //
    // Nothing has been rendered yet so these are all initialized to undefined. Because
    // they are undefined, the first time _updateDomImpl is called, they will all be
    // rendered.
    private _updateDomImpl_rendered = {
    };
    private _updateDomImpl(): void {
        var rendered = this._updateDomImpl_rendered;

	}
}

_Base.Class.mix(MediaPlayer, _Events.createEventProperties(
));
_Base.Class.mix(MediaPlayer, _Control.DOMEventMixin);
