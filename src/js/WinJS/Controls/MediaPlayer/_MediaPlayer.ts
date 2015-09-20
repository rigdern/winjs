// Copyright (c) Microsoft Corporation.  All Rights Reserved. Licensed under the MIT License. See License.txt in the project root for license information.
/// <reference path="../../../../../typings/require.d.ts" />

import Animations = require('../../Animations');
import _Base = require('../../Core/_Base');
import _BaseUtils = require('../../Core/_BaseUtils');
import BindingList = require("../../BindingList");
import _Command = require("../AppBar/_Command");
import _Control = require('../../Utilities/_Control');
import _Dispose = require('../../Utilities/_Dispose');
import _ElementUtilities = require('../../Utilities/_ElementUtilities');
import _ErrorFromName = require('../../Core/_ErrorFromName');
import _Events = require('../../Core/_Events');
import _Global = require('../../Core/_Global');
import _Hoverable = require('../../Utilities/_Hoverable');
import _MediaElementAdapter = require('./_MediaElementAdapter');
import Promise = require('../../Promise');
import _Resources = require("../../Core/_Resources");
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
    get duplicateConstruction() { return "Invalid argument: Controls may only be instantiated one time for each DOM element"; },
    
    // Button labels
    get mediaPlayerAudioTracksButtonLabel() { return _Resources._getWinJSString("ui/mediaPlayerAudioTracksButtonLabel").value; },
    get mediaPlayerCastButtonLabel() { return _Resources._getWinJSString("ui/mediaPlayerCastButtonLabel").value; },
    get mediaPlayerChapterSkipBackButtonLabel() { return _Resources._getWinJSString("ui/mediaPlayerChapterSkipBackButtonLabel").value; },
    get mediaPlayerChapterSkipForwardButtonLabel() { return _Resources._getWinJSString("ui/mediaPlayerChapterSkipForwardButtonLabel").value; },
    get mediaPlayerClosedCaptionsButtonLabel() { return _Resources._getWinJSString("ui/mediaPlayerClosedCaptionsButtonLabel").value; },
    get mediaPlayerFastForwardButtonLabel() { return _Resources._getWinJSString("ui/mediaPlayerFastForwardButtonLabel").value; },
    get mediaPlayerFullscreenButtonLabel() { return _Resources._getWinJSString("ui/mediaPlayerFullscreenButtonLabel").value; },
    get mediaPlayerLiveButtonLabel() { return _Resources._getWinJSString("ui/mediaPlayerLiveButtonLabel").value; },
    get mediaPlayerNextTrackButtonLabel() { return _Resources._getWinJSString("ui/mediaPlayerNextTrackButtonLabel").value; },
    get mediaPlayerPlayButtonLabel() { return _Resources._getWinJSString("ui/mediaPlayerPlayButtonLabel").value; },
    get mediaPlayerPlayFromBeginningButtonLabel() { return _Resources._getWinJSString("ui/mediaPlayerPlayFromBeginningButtonLabel").value; },
    get mediaPlayerPlayRateButtonLabel() { return _Resources._getWinJSString("ui/mediaPlayerPlayRateButtonLabel").value; },
    get mediaPlayerPreviousTrackButtonLabel() { return _Resources._getWinJSString("ui/mediaPlayerPreviousTrackButtonLabel").value; },
    get mediaPlayerRewindButtonLabel() { return _Resources._getWinJSString("ui/mediaPlayerRewindButtonLabel").value; },
    get mediaPlayerStopButtonLabel() { return _Resources._getWinJSString("ui/mediaPlayerStopButtonLabel").value; },
    get mediaPlayerTimeSkipBackButtonLabel() { return _Resources._getWinJSString("ui/mediaPlayerTimeSkipBackButtonLabel").value; },
    get mediaPlayerTimeSkipForwardButtonLabel() { return _Resources._getWinJSString("ui/mediaPlayerTimeSkipForwardButtonLabel").value; },
    get mediaPlayerToggleSnapButtonLabel() { return _Resources._getWinJSString("ui/mediaPlayerToggleSnapButtonLabel").value; },
    get mediaPlayerVolumeButtonLabel() { return _Resources._getWinJSString("ui/mediaPlayerVolumeButtonLabel").value; },
    get mediaPlayerZoomButtonLabel() { return _Resources._getWinJSString("ui/mediaPlayerZoomButtonLabel").value; }
};
var ClassNames = {
    // Elements
    commands: "win-mediaplayer-commands",
    container: "win-mediaplayer-container",
    controls: "win-mediaplayer-controls",
    mediaPlayer: "win-mediaplayer",
    timeline: "win-mediaplayer-timeline",
    toolBar: "win-mediaplayer-toolbar",
    transportControls: "win-mediaplayer-transportcontrols",
    video: "win-mediaplayer-video",
    
    // State
    doubleRow: "win-mediaplayer-doublerow",
    hidden: "win-mediaplayer-hidden"
};
var EventNames = {
};

var controlsAutoHideDuration = 500;

// TODO: Many icons aren't in Symbols.ttf and so don't work outside of Win10
// TODO: How do reconcile initialization vs updateDom?
//   - We want to change "hidden" property of these controls sometimes
//   - In case of play/pause button, we want to change icon, label, etc.  
var fullCommandList = [
    {
        internalVariableName: "_playFromBeginningButton",
        classList: "win-mediaplayer-playfrombeginningbutton",
        options: {
            id: "win-mediaplayer-playfrombeginning",
            label: Strings.mediaPlayerPlayFromBeginningButtonLabel,
            section: 'primary',
            tooltip: Strings.mediaPlayerPlayFromBeginningButtonLabel,
            priority: 19,
            icon: "refresh",
            hidden: true,
            //onclick: this._onPlayFromBeginningCommandInvoked.bind(this)
        },
    },
    {
        internalVariableName: "_chapterSkipBackButton",
        classList: "win-mediaplayer-chapterskipbackbutton",
        options: {
            id: "win-mediaplayer-chapterskipback",
            label: Strings.mediaPlayerChapterSkipBackButtonLabel,
            tooltip: Strings.mediaPlayerChapterSkipBackButtonLabel,
            section: 'primary',
            priority: 17,
            icon: "back",
            hidden: true,
            //onclick: this._onChapterSkipBackCommandInvoked.bind(this)
        }
    },
    {
        internalVariableName: "_previousTrackButton",
        classList: "win-mediaplayer-previoustrackbutton",
        options: {
            id: "win-mediaplayer-previoustrack",
            label: Strings.mediaPlayerPreviousTrackButtonLabel,
            tooltip: Strings.mediaPlayerPreviousTrackButtonLabel,
            section: 'primary',
            priority: 15,
            icon: "previous",
            hidden: true,
            //onclick: this._onPlayFromBeginningCommandInvoked.bind(this)
        }
    },
    {
        internalVariableName: "_stopButton",
        classList: "win-mediaplayer-stopbutton",
        options: {
            id: "win-mediaplayer-stop",
            label: Strings.mediaPlayerStopButtonLabel,
            tooltip: Strings.mediaPlayerStopButtonLabel,
            section: 'primary',
            priority: 18,
            icon: "stop",
            hidden: true,
            //onclick: this._onStopCommandInvoked.bind(this)
        },
    },
    {
        internalVariableName: "_timeSkipBackButton",
        classList: "win-mediaplayer-timeskipbackbutton",
        options: {
            id: "win-mediaplayer-timeskipback",
            label: Strings.mediaPlayerTimeSkipBackButtonLabel,
            tooltip: Strings.mediaPlayerTimeSkipBackButtonLabel,
            section: 'primary',
            priority: 11,
            icon: "undo",
            hidden: true,
            //onclick: this._onTimeSkipBackCommandInvoked.bind(this)
        },
    },
    {
        internalVariableName: "_rewindButton",
        classList: "win-mediaplayer-rewindbutton",
        options: {
            id: "win-mediaplayer-rewind",
            label: Strings.mediaPlayerRewindButtonLabel,
            tooltip: Strings.mediaPlayerRewindButtonLabel,
            section: 'primary',
            priority: 13,
            icon: "previous",
            hidden: true,
            //onclick: this._onRewindCommandInvoked.bind(this)
        }
    },
    {
        internalVariableName: "_castButton",
        classList: "win-mediaplayer-playonremotedevicebutton",
        options: {
            id: "win-mediaplayer-playonremotedevice",
            label: Strings.mediaPlayerCastButtonLabel,
            tooltip: Strings.mediaPlayerCastButtonLabel,
            section: 'primary',
            priority: 6,
            icon: "\uEC15",
            //onclick: this._onCastCommandInvoked.bind(this)
        }
    },
    {
        internalVariableName: "_zoomButton",
        classList: "win-mediaplayer-zoombutton",
        options: {
            id: "win-mediaplayer-zoom",
            label: Strings.mediaPlayerZoomButtonLabel,
            tooltip: Strings.mediaPlayerZoomButtonLabel,
            section: 'primary',
            priority: 7,
            icon: "\uE799",
            //onclick: this._onZoomCommandInvoked.bind(this)
        }
    },
    {
        internalVariableName: "_audioTracksButton",
        classList: "win-mediaplayer-audiotracksbutton",
        options: {
            id: "win-mediaplayer-audiotracks",
            label: Strings.mediaPlayerAudioTracksButtonLabel,
            tooltip: Strings.mediaPlayerAudioTracksButtonLabel,
            priority: 8,
            section: 'primary',
            icon: "\uE8C1",
            hidden: true,
            //onclick: this._onAudioTracksCommandInvoked.bind(this)
        }
    },
    {
        internalVariableName: "_playPauseButton",
        classList: "win-mediaplayer-playpausebutton",
        options: {
            id: "win-mediaplayer-playpause",
            label: Strings.mediaPlayerPlayButtonLabel,
            tooltip: Strings.mediaPlayerPlayButtonLabel,
            section: 'primary',
            priority: 1,
            icon: "play",
            //onclick: this._onPlayPauseCommandInvoked.bind(this)
        },
    },
    {
        internalVariableName: "_closedCaptionsButton",
        classList: "win-mediaplayer-closedcaptionsbutton",
        options: {
            id: "win-mediaplayer-closedcaptions",
            label: Strings.mediaPlayerClosedCaptionsButtonLabel,
            tooltip: Strings.mediaPlayerClosedCaptionsButtonLabel,
            section: 'primary',
            priority: 4,
            icon: "\uE7F0",
            hidden: true,
            //onclick: this._onClosedCaptionsCommandInvoked.bind(this)
        }
    },
    {
        internalVariableName: "_volumeButton",
        classList: "win-mediaplayer-volumebutton",
        options: {
            id: "win-mediaplayer-volume",
            label: Strings.mediaPlayerVolumeButtonLabel,
            section: 'primary',
            tooltip: Strings.mediaPlayerVolumeButtonLabel,
            priority: 3,
            icon: "volume",
            //onclick: this._onVolumeCommandInvoked.bind(this)
        }
    },
    {
        internalVariableName: "_toggleFullScreenButton",
        classList: "win-mediaplayer-fullscreenbutton",
        options: {
            id: "win-mediaplayer-fullscreen",
            label: Strings.mediaPlayerFullscreenButtonLabel,
            tooltip: Strings.mediaPlayerFullscreenButtonLabel,
            section: 'primary',
            priority: 5,
            icon: "fullscreen",
            //onclick: this._onToggleFullscreenCommandInvoked.bind(this)
        }
    },
    {
        internalVariableName: "_timeSkipForwardButton",
        classList: "win-mediaplayer-timeskipforwardbutton",
        options: {
            id: "win-mediaplayer-timeskipforward",
            label: Strings.mediaPlayerTimeSkipForwardButtonLabel,
            tooltip: Strings.mediaPlayerTimeSkipForwardButtonLabel,
            section: 'primary',
            priority: 10,
            icon: "redo",
            hidden: true,
            //onclick: this._onTimeSkipForwardCommandInvoked.bind(this)
        },
    },
    {
        internalVariableName: "_fastForwardButton",
        classList: "win-mediaplayer-fastforwardbutton",
        options: {
            id: "win-mediaplayer-fastforward",
            label: Strings.mediaPlayerFastForwardButtonLabel,
            tooltip: Strings.mediaPlayerFastForwardButtonLabel,
            priority: 12,
            section: 'primary',
            icon: "next",
            hidden: true,
            //onclick: this._onFastForwardCommandInvoked.bind(this)
        }
    },
    {
        internalVariableName: "_playbackRateButton",
        classList: "win-mediaplayer-playbackratebutton",
        options: {
            id: "win-mediaplayer-playbackrate",
            label: Strings.mediaPlayerPlayRateButtonLabel,
            tooltip: Strings.mediaPlayerPlayRateButtonLabel,
            section: 'primary',
            priority: 9,
            icon: "\uEC57",
            hidden: true,
            //onclick: this._onPlaybackRateCommandInvoked.bind(this)
        },
    },
    {
        internalVariableName: "_nextTrackButton",
        classList: "win-mediaplayer-nexttrackbutton",
        options: {
            id: "win-mediaplayer-nexttrack",
            label: Strings.mediaPlayerNextTrackButtonLabel,
            tooltip: Strings.mediaPlayerNextTrackButtonLabel,
            section: 'primary',
            priority: 14,
            icon: "next",
            hidden: true,
            //onclick: this._onNextTrackCommandInvoked.bind(this)
        }
    },
    {
        internalVariableName: "_chapterSkipForwardButton",
        classList: "win-mediaplayer-chapterskipforwardbutton",
        options: {
            id: "win-mediaplayer-chapterskipforward",
            label: Strings.mediaPlayerChapterSkipForwardButtonLabel,
            tooltip: Strings.mediaPlayerChapterSkipForwardButtonLabel,
            priority: 16,
            section: 'primary',
            icon: "forward",
            hidden: true,
            //onclick: this._onChapterSkipForwardCommandInvoked.bind(this)
        }
    },
    {
        internalVariableName: "_goToLiveButton",
        classList: "win-mediaplayer-livebutton",
        options: {
            id: "win-mediaplayer-live",
            label: Strings.mediaPlayerLiveButtonLabel,
            tooltip: Strings.mediaPlayerLiveButtonLabel,
            section: 'primary',
            priority: 20,
            icon: "gotostart",
            hidden: true,
            //onclick: this._onLiveButtonCommandInvoked.bind(this)
        }
    }
];

enum ControlsState {
    shown,
    showing,
    hiding,
    hidden
};

export class MediaPlayer {

    static supportedForProcessing: boolean = true;

    private static _ClassNames = ClassNames;
    
    private _initialized: boolean;
    private _disposed: boolean;
    private _dom: {
        root: HTMLElement;
        content: HTMLElement;
        controls: HTMLElement;
        toolBar: _IToolBar.ToolBar;
        transportControls: HTMLElement;
    };
    
    // Controls management
    private _controlsState: ControlsState;
    private _hideControlsTimerToken: number;
    private _controlsAnimationPromise: Promise<any>;

    constructor(element?: HTMLElement, options: any = {}) {
        // Check to make sure we weren't duplicated
        if (element && element["winControl"]) {
            throw new _ErrorFromName("WinJS.UI.MediaPlayer.DuplicateConstruction", Strings.duplicateConstruction);
        }

        this._initializeDom(element || _Global.document.createElement("div"));

        // Initialize private state.
        this._initialized = false;
        this._disposed = false;
        this._controlsState = ControlsState.hidden;

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
        
        // TODO: This should be done in updateDom
        _ElementUtilities.addClass(root, ClassNames.doubleRow);
        
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
                        '<div class="' + ClassNames.toolBar + ' ' + ClassNames.commands + '"></div>' +
                    '</div>' +
                '</div>' +
            '</div>';
        root.appendChild(contentEl);
        
        var builtInCommands = fullCommandList.map((commandDesc) => {
            var command = new _Command.AppBarCommand(null, commandDesc.options);
            _ElementUtilities.addClass(command.element, commandDesc.classList);
            return command;
        });
        // TODO: Support custom commands declaratively -- isDeclarativeControlContainer?
        // var customCommands = Array.prototype.map.call(root.querySelectorAll("[data-win-control='WinJS.UI.Command']"), (commandEl: HTMLElement) => {
        //     return commandEl["winControl"];
        // });
        var commandsBindingList = new BindingList.List(builtInCommands);
        // commandsBindingList.splice(commandsBindingList.length, 0, customCommands);
        var toolBar = new ToolBar.ToolBar(getElement(ClassNames.toolBar), {
            data: commandsBindingList,
            closedDisplayMode: ToolBar.ToolBar.ClosedDisplayMode.full
        });

        this._dom = {
            root: root,
            content: contentEl,
            controls: getElement(ClassNames.controls),
            toolBar: toolBar,
            transportControls: getElement(ClassNames.transportControls)
        };
        
        _ElementUtilities._addEventListener(this._dom.root, "pointermove", this._onPointerMove.bind(this));
    }

    // State private to _updateDomImpl. No other method should make use of it.
    //
    // Nothing has been rendered yet so these are all initialized to undefined. Because
    // they are undefined, the first time _updateDomImpl is called, they will all be
    // rendered.
    private _updateDomImpl_rendered = {
        controlsShown: <boolean>undefined,
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
            rendered.mediaElement = mediaElement;
        }
        
        var controlsShown = this._controlsState === ControlsState.hiding ||
            this._controlsState === ControlsState.showing ||
            this._controlsState === ControlsState.shown; 
        if (rendered.controlsShown !== controlsShown) {
            // During initialization (rendered.controlsShown is undefined), skip
            // the animation
            // TODO: Cancel current animation when starting a new animation -- don't want
            //       promise completions running out of order
            // TODO: Don't do animations inside of updateDom? updateDom shouldn't deal with
            //       asynchrony to make it easier to reason about?
            if (controlsShown) {
                _ElementUtilities.removeClass(this._dom.controls, ClassNames.hidden);
            } else {
                _ElementUtilities.addClass(this._dom.controls, ClassNames.hidden);       
            }
            rendered.controlsShown = controlsShown;
        }
	}
    
    private _prepareToAnimateControls(): void {
        this._controlsAnimationPromise && this._controlsAnimationPromise.cancel();
        if (this._hideControlsTimerToken) {
            _Global.clearTimeout(this._hideControlsTimerToken);
            this._hideControlsTimerToken = 0;
        }
    }
    
    private _playShownControlsAnimation(): void {
        this._prepareToAnimateControls();
        
        this._controlsState = ControlsState.showing;
        this._updateDomImpl();
        
        // TODO: Might need to start timer after animation finishes. Maybe pointermove
        // should cache last known location of mouse.
        // TODO: How to handle case of mouse leaving MediaPlayer?
        // TODO: How to handle touch? pointerout, pointercancel
        Animations.fadeIn(this._dom.controls).done(() => {
            this._controlsState = ControlsState.shown;
            this._updateDomImpl();
        });
    }
    
    private _playHideControlsAnimation(): void {
        this._prepareToAnimateControls();
        
        this._controlsState = ControlsState.hiding;
        this._updateDomImpl();
        
        Animations.fadeOut(this._dom.controls).done(() => {
            this._controlsState = ControlsState.hidden;
            this._updateDomImpl();
        });
    }
    
    private _onPointerMove(eventObject: PointerEvent) {
        if (eventObject["movementX"] === 0 && eventObject["movementY"] === 0) {
            // If the cursor hasn't moved, ignore the event. Works around a Chrome
            // bug where a mousemove event is generated when a layout change occurs
            // under the mouse.
            // https://code.google.com/p/chromium/issues/detail?id=333623
            return;
        }
        
        switch (this._controlsState) {
            case ControlsState.shown:
                var insideTransportControls = false;
                var element = <Node>eventObject.target;
                while (element && element !== this._dom.root) {
                    if (element === this._dom.transportControls) {
                        insideTransportControls = true;
                        break;
                    }
                    element = element.parentNode;
                }
                
                if (insideTransportControls && this._hideControlsTimerToken) {
                    _Global.clearTimeout(this._hideControlsTimerToken);
                    this._hideControlsTimerToken = 0;
                } else if (!insideTransportControls) {
                    if (this._hideControlsTimerToken) {
                        _Global.clearTimeout(this._hideControlsTimerToken);
                        this._hideControlsTimerToken = 0;
                    }
                    this._hideControlsTimerToken = _Global.setTimeout(() => {
                            this._hideControlsTimerToken = 0;
                            this._playHideControlsAnimation();
                        },
                        controlsAutoHideDuration
                    );
                }
                break;
            case ControlsState.showing:
                // No-op
                break;
            case ControlsState.hiding:
            case ControlsState.hidden:
                this._playShownControlsAnimation();
            break;
        }
    }
}

_Base.Class.mix(MediaPlayer, _Events.createEventProperties(
));
_Base.Class.mix(MediaPlayer, _Control.DOMEventMixin);
