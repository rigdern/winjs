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
import _MediaElementAdapter = require('./_MediaElementAdapter');
import Promise = require('../../Promise');
import ToolBar = require("../ToolBar");
import _IToolBar = require("../ToolBar/_ToolBar"); // Only used for type information
// import _TransitionAnimation = require('../../Animations/_TransitionAnimation');

require(["require-style!less/styles-mediaplayer"]);
require(["require-style!less/colors-mediaplayer"]);

"use strict";

// Force-load Dependencies
_Hoverable.isHoverable;

var transformNames = _BaseUtils._browserStyleEquivalents["transform"];
var Strings = {
    get duplicateConstruction() { return "Invalid argument: Controls may only be instantiated one time for each DOM element"; }
};
var ClassNames = {
    // Elements
    commands: "win-mediaplayer-commands",
    container: "win-mediaplayer-container",
    controls: "win-mediaplayer-controls",
    mediaPlayer: "win-mediaplayer",
    timeline: "win-mediaplayer-timeline",
    transportControls: "win-mediaplayer-transportcontrols",
    video: "win-mediaplayer-video"
};
var EventNames = {
};

export class MediaPlayer {

    static supportedForProcessing: boolean = true;

    private static _ClassNames = ClassNames;
    
    private _initialized: boolean;
    private _disposed: boolean;
    _dom: {
        root: HTMLElement;
        content: HTMLElement;
        controls: HTMLElement;
        toolBar: _IToolBar.ToolBar;
    };

    constructor(element?: HTMLElement, options: any = {}) {
        // Check to make sure we weren't duplicated
        if (element && element["winControl"]) {
            throw new _ErrorFromName("WinJS.UI.MediaPlayer.DuplicateConstruction", Strings.duplicateConstruction);
        }

        this._initializeDom(element || _Global.document.createElement("div"));

        // Initialize private state.
        this._initialized = false;
        this._disposed = false;

        // Initialize public properties.
        _Control.setOptions(this, options);
        if (!this.mediaElementAdapter) {
            this.mediaElementAdapter = new _MediaElementAdapter.MediaElementAdapter(this, null);
        }
        
        this._initialized = true;
        this._updateDomImpl();
    }
	
    get element(): HTMLElement {
        return this._dom.root;
    }
    
    private _mediaElementAdapter: _MediaElementAdapter.MediaElementAdapter;
    get mediaElementAdapter(): _MediaElementAdapter.MediaElementAdapter {
        return this._mediaElementAdapter;
    }
    set mediaElementAdapter(value: _MediaElementAdapter.MediaElementAdapter) {
        this._mediaElementAdapter = value;
    }

    dispose(): void {
        if (this._disposed) {
            return;
        }
        this._disposed = true;
    }

    private _initializeDom(root: HTMLElement): void {
        var getElement = (className: string): HTMLElement => {
            return <HTMLElement>root.querySelector("." + className);
        };
        
        root["winControl"] = this;
        _ElementUtilities.addClass(root, ClassNames.mediaPlayer);
        _ElementUtilities.addClass(root, "win-disposable");
        
        var contentEl = document.createElement("div");
        _ElementUtilities.addClass(contentEl, ClassNames.mediaPlayer);
        // TODO: Why did win-mediaplayer-timeline have class win-mediaplayer-thumbnailmode?
        // TODO: Why does win-mediaplayer-timeline have tabIndex 0?
        contentEl.innerHTML =
            '<div class="' + ClassNames.container + '">' +
                '<div class="' + ClassNames.controls + '">' +
                    '<div class="' + ClassNames.transportControls + '">' +
                        '<div class="' + ClassNames.timeline + '" tabIndex="0">' +
                        '</div>' +
                        '<div class="' + ClassNames.commands + '"></div>' +
                    '</div>' +
                '</div>' +
            '</div>';
        root.appendChild(contentEl);

        this._dom = {
            root: root,
            content: contentEl,
            controls: getElement(ClassNames.controls),
            toolBar: new ToolBar.ToolBar(getElement(ClassNames.commands))
        };
    }

    // State private to _updateDomImpl. No other method should make use of it.
    //
    // Nothing has been rendered yet so these are all initialized to undefined. Because
    // they are undefined, the first time _updateDomImpl is called, they will all be
    // rendered.
    private _updateDomImpl_rendered = {
        mediaElement: <HTMLMediaElement>undefined
    };
    private _updateDomImpl(): void {
        if (!this._initialized) {
            return;
        }
        
        var rendered = this._updateDomImpl_rendered;
        
        // TODO: Can this.mediaElementAdapter be null? Do consumers ever set it to null?
        var mediaElement = this.mediaElementAdapter.mediaElement;
        
        if (rendered.mediaElement !== mediaElement) {
            if (rendered.mediaElement) {
                // TODO: No class for audio?
                // TODO: Who removes this mediaElement from the DOM?
                _ElementUtilities.removeClass(mediaElement, ClassNames.video);
            }
            if (mediaElement) {
                _ElementUtilities.addClass(mediaElement, ClassNames.video);
                this._dom.controls.parentNode.insertBefore(mediaElement, this._dom.controls);
            }
        }
	}
}

_Base.Class.mix(MediaPlayer, _Events.createEventProperties(
));
_Base.Class.mix(MediaPlayer, _Control.DOMEventMixin);
