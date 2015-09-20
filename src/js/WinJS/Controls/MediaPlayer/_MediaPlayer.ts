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

function _() { } // no-op

//
// AutoHider
//

// TODO: More cases to handle:
//   - Pointer leaves MediaPlayer (instant hide?)
//   - Pointer leaves window (instant hide?)
//   - A light dismissable is shown (suspend auto hide timer?)
//   - A tooltip is shown (suspend auto hide timer?)
// TODO: How to handle touch? pointerout, pointercancel

// When AutoHider is in the "shown" state, the following restart the auto hide timer:
//   - A pointer moving
//   - A keydown

interface IAutoHiderClient {
    element: HTMLElement;
    onShow: Function;
    onHide: Function;
    autoHideDuration: number;
}

interface IAutoHiderState {
    // Debugging
    name: string;
    // State lifecyle
    enter(): void;
    exit(): void; // Immediately exit the state & cancel async work.
    // API surface
    onPointerMove(element: EventTarget): void;
    onKeyDown(): void;
    // Provided by _setState for use within the state
    autoHider: AutoHider;
}

module AutoHiderStates {
    export class Hidden implements IAutoHiderState {
        autoHider: AutoHider;
        name = "Hidden";
        
        enter = _;
        exit = _;
        onPointerMove() {
            this.autoHider._setState(Showing);
        }
        onKeyDown = _;
    }
    
    export class Showing implements IAutoHiderState {
        autoHider: AutoHider;
        name = "Showing";
        
        enter() {
            this.autoHider._client.onShow();
        }
        exit = _;
        onPointerMove = _;
        onKeyDown = _;
    }
    
    export class Shown implements IAutoHiderState {
        autoHider: AutoHider;
        name = "Shown";
        
        private _hideTimerToken: number;
        private _clearHideTimer() {
            if (this._hideTimerToken) {
                _Global.clearTimeout(this._hideTimerToken);
                this._hideTimerToken = 0;
            }
        }
        private _restartHideTimer() {
            this._clearHideTimer();
            this._hideTimerToken = _Global.setTimeout(() => {
                this.autoHider._setState(AutoHiderStates.Hiding);
            }, this.autoHider._client.autoHideDuration);
        }
        
        enter() {
            var pointerPosition = this.autoHider._lastPointerPosition;
            
            var element = pointerPosition ?
                _Global.document.elementFromPoint(pointerPosition.x, pointerPosition.y) :
                null;
                
            this._restartHideTimer();
        }
        exit() {
            this._clearHideTimer();
        }      
        onPointerMove(element: EventTarget) {
            this._restartHideTimer();
        }
        onKeyDown() {
            this._restartHideTimer();
        }
    }
    
    export class Hiding implements IAutoHiderState {
        autoHider: AutoHider;
        name = "Hiding";
        
        enter() {
            this.autoHider._client.onHide();
        }
        exit = _;
        onPointerMove = _;
        onKeyDown = _;
    }
    
    export class ShownSuspended implements IAutoHiderState {
        autoHider: AutoHider;
        name = "ShownSuspended";
        
        // TODO: Start using this state. It'll be useful for suspending the
        // auto hide timer while a light dismissable is visible
        
        enter = _;
        exit = _;
        onPointerMove = _;
        onKeyDown = _;
    }
    
    export class Disposed implements IAutoHiderState {
        autoHider: AutoHider;
        name = "Disposed";
        
        enter = _;
        exit = _;
        onPointerMove = _;
        onKeyDown = _;
    }
}

class AutoHider {
    private _disposed: boolean;
    private _state: IAutoHiderState;
    _client: IAutoHiderClient;
    _lastPointerPosition: {x: number; y: number};
    
    constructor(client: IAutoHiderClient) {
        this._setState(AutoHiderStates.Hidden);
        this._client = client;
        
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
        _ElementUtilities._addEventListener(this._client.element, "pointermove", this._onPointerMove);
        this._client.element.addEventListener("keydown", this._onKeyDown);
    }
    
    shown() {
        this._setState(AutoHiderStates.Shown);
    }
    
    hidden() {
        this._setState(AutoHiderStates.Hidden);
    }
    
    dispose() {
        if (!this._disposed) {
            this._setState(AutoHiderStates.Disposed);
            _ElementUtilities._removeEventListener(this._client.element, "pointermove", this._onPointerMove);
            this._client.element.removeEventListener("keydown", this._onKeyDown);
            this._client = null;
            this._disposed = true;
        }
    }
    
    _setState(NewState: any) {
        if (!this._disposed) {
            this._state && this._state.exit();
            this._state = new NewState();
            this._state.autoHider = this;
            this._state.enter();
        }
    }
    
    private _onPointerMove(eventObject: PointerEvent) {
        this._lastPointerPosition = {
            x: eventObject.clientX,
            y: eventObject.clientY
        };
        
        if (eventObject["movementX"] === 0 && eventObject["movementY"] === 0) {
            // If the cursor hasn't moved, ignore the event. Works around a Chrome
            // bug where a mousemove event is generated when a layout change occurs
            // under the mouse.
            // https://code.google.com/p/chromium/issues/detail?id=333623
            return;
        }
        
        this._state.onPointerMove(eventObject.target);
    }
    
    private _onKeyDown(eventObject: KeyboardEvent) {
        this._state.onKeyDown();
    }
}

//
// MediaElementAdapterWrapper
//

class MediaElementAdapterWrapper {
    private _mediaElementAdapter: _MediaElementAdapter.MediaElementAdapter;
    
    constructor(mediaElementAdapter: _MediaElementAdapter.MediaElementAdapter) {
        this._mediaElementAdapter = mediaElementAdapter;
    }
    
    get paused(): boolean {
        // TODO: What should happen if there's no mediaElement? Is that a real scenario?
        //   Probably caller of this API needs to be aware of this case and handle it
        //   specially (e.g. make the "play" button click a no-op)
        var mediaElement = this._mediaElementAdapter && this._mediaElementAdapter.mediaElement;
        return mediaElement ? mediaElement.paused : true;
    }
    
    pause(): void {
        // TODO: _mediaElement isn't required?
        // TODO: How does _isPlayAllowed fit into this?
        this._mediaElementAdapter && this._mediaElementAdapter.pause();
    }
    
    play(): void {
        // TODO: _mediaElement isn't required?
        // TODO: How does _isPlayAllowed fit into this?
        this._mediaElementAdapter && this._mediaElementAdapter.play();
    }
}

//
// MediaPlayer
//

// TODO: Missing strings for:
//   - Pause tooltip/label
//   - Exit full screet tooltip/label

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

var controlsAutoHideDuration = 3000;

enum ControlsState {
    shown,
    showing,
    hiding,
    hidden
};

interface ICommandDescription {
    classList: string;
    options: any;
}

export class MediaPlayer {

    static supportedForProcessing: boolean = true;

    private static _ClassNames = ClassNames;
    
    private _initialized: boolean;
    private _disposed: boolean;
    private _dom: {
        commands: {
            // TODO: Instead of repeating these keys so many times, is there a way
            //   to reuse the same key set with different value types. For example:
            //     enum Abc {
            //         One,
            //         Two,
            //         Three
            //     };
            //
            //     var x: { [k: Abc]: number};
            audioTracks: _Command.AppBarCommand;
            cast: _Command.AppBarCommand;
            chapterSkipBack: _Command.AppBarCommand;
            chapterSkipForward: _Command.AppBarCommand;
            closedCaptions: _Command.AppBarCommand;
            fastForward: _Command.AppBarCommand;
            goToLive: _Command.AppBarCommand;
            nextTrack: _Command.AppBarCommand;
            playbackRate: _Command.AppBarCommand;
            playFromBeginning: _Command.AppBarCommand;
            playPause: _Command.AppBarCommand;
            previousTrack: _Command.AppBarCommand;
            rewind: _Command.AppBarCommand;
            stop: _Command.AppBarCommand;
            timeSkipBack: _Command.AppBarCommand;
            timeSkipForward: _Command.AppBarCommand;
            toggleFullScreen: _Command.AppBarCommand;
            volume: _Command.AppBarCommand;
            zoom: _Command.AppBarCommand;
        };
        content: HTMLElement;
        controls: HTMLElement;
        root: HTMLElement;
        toolBar: _IToolBar.ToolBar;
        transportControls: HTMLElement;
    };
    
    // Controls management
    private _commandDescriptions: {
        audioTracks: ICommandDescription;
        cast: ICommandDescription;
        chapterSkipBack: ICommandDescription;
        chapterSkipForward: ICommandDescription;
        closedCaptions: ICommandDescription;
        fastForward: ICommandDescription;
        goToLive: ICommandDescription;
        nextTrack: ICommandDescription;
        playbackRate: ICommandDescription;
        playFromBeginning: ICommandDescription;
        playPause: ICommandDescription;
        previousTrack: ICommandDescription;
        rewind: ICommandDescription;
        stop: ICommandDescription;
        timeSkipBack: ICommandDescription;
        timeSkipForward: ICommandDescription;
        toggleFullScreen: ICommandDescription;
        volume: ICommandDescription;
        zoom: ICommandDescription;
    };
    private _commandOrderings: {
        full: _Command.AppBarCommand[];
        compact: _Command.AppBarCommand[];
    };
    private _fullCommandList: ICommandDescription[];
    private _autoHider: AutoHider;
    private _controlsState: ControlsState;
    private _controlsAnimationPromise: Promise<any>;

    constructor(element?: HTMLElement, options: any = {}) {
        // Check to make sure we weren't duplicated
        if (element && element["winControl"]) {
            throw new _ErrorFromName("WinJS.UI.MediaPlayer.DuplicateConstruction", Strings.duplicateConstruction);
        }
        
        this._commandDescriptions = this._generateCommandDescriptions();
        this._initializeDom(element || _Global.document.createElement("div"));

        // Initialize private state.
        this._initialized = false;
        this._disposed = false;
        this._controlsState = ControlsState.hidden;
        this._autoHider = new AutoHider({
            element: this._dom.root,
            autoHideDuration: controlsAutoHideDuration,
            onShow: () => {
                this._playShowControlsAnimation();
            },
            onHide: () => {
                this._playHideControlsAnimation();
            }
        });

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
    
    // MediaPlayer should never interact directly with:
    //   - the media element
    //   - _nakedMediaElementAdapter: This is the one that comes from the app. It has a
    //     small API surface representing the hooks we want app developers to have.
    // Instead, the MediaPlayer should always interact with _mediaElementAdapter
    // (a MediaElementAdapterWrapper). It has the full API surface of the media element
    // that is used by the MediaPlayer. When appropriate, MediaElementAdapterWrapper will
    // forward calls to the _nakedMediaElementAdapter. In all other cases,
    // MediaElementAdapterWrapper will interact directly with the media element.
    // The idea here is that the MediaPlayer code never has to worry about if it needs to
    // give a call to the MediaElementAdapter or if it should talk directly to the media
    // element. It's the MediaElementAdapterWrapper's responsibility to worry about that.
    private _mediaElementAdapter: MediaElementAdapterWrapper;
    private _nakedMediaElementAdapter: _MediaElementAdapter.MediaElementAdapter;
    get mediaElementAdapter(): _MediaElementAdapter.MediaElementAdapter {
        return this._nakedMediaElementAdapter;
    }
    set mediaElementAdapter(value: _MediaElementAdapter.MediaElementAdapter) {
        this._nakedMediaElementAdapter = value;
        this._mediaElementAdapter = new MediaElementAdapterWrapper(value);
    }
    
    pause(): void {
        this._mediaElementAdapter.pause();
    }
    
    play(): void {
        this._mediaElementAdapter.play();
    }

    dispose(): void {
        if (this._disposed) {
            return;
        }
        this._disposed = true;
        this._autoHider.dispose();
    }
    
    private _generateCommandDescriptions() {
        // TODO: Bring back labels. We need them for screen readers. They are commented out
        //   because AppBarCommands don't show their tooltips when the tooltip is the same as
        //   the label. Should we remove this behavior? Is it the app's fault for making
        //   them the same?
        // TODO: Many icons aren't in Symbols.ttf and so don't work outside of Win10
        // TODO: How do reconcile initialization vs updateDom?
        //   - We want to change "hidden" property of these controls sometimes
        //   - In case of play/pause button, we want to change icon, label, etc.
        return {
            audioTracks: {
                classList: "win-mediaplayer-audiotracksbutton",
                options: {
                    id: "win-mediaplayer-audiotracks",
                    //label: Strings.mediaPlayerAudioTracksButtonLabel,
                    tooltip: Strings.mediaPlayerAudioTracksButtonLabel,
                    priority: 8,
                    section: 'primary',
                    icon: "\uE8C1",
                    hidden: true,
                    //onclick: this._onAudioTracksCommandInvoked.bind(this)
                }
            },
            cast: {
                classList: "win-mediaplayer-playonremotedevicebutton",
                options: {
                    id: "win-mediaplayer-playonremotedevice",
                    //label: Strings.mediaPlayerCastButtonLabel,
                    tooltip: Strings.mediaPlayerCastButtonLabel,
                    section: 'primary',
                    priority: 6,
                    icon: "\uEC15",
                    //onclick: this._onCastCommandInvoked.bind(this)
                }
            },
            chapterSkipBack: {
                classList: "win-mediaplayer-chapterskipbackbutton",
                options: {
                    id: "win-mediaplayer-chapterskipback",
                    //label: Strings.mediaPlayerChapterSkipBackButtonLabel,
                    tooltip: Strings.mediaPlayerChapterSkipBackButtonLabel,
                    section: 'primary',
                    priority: 17,
                    icon: "back",
                    hidden: true,
                    //onclick: this._onChapterSkipBackCommandInvoked.bind(this)
                }
            },
            chapterSkipForward: {
                classList: "win-mediaplayer-chapterskipforwardbutton",
                options: {
                    id: "win-mediaplayer-chapterskipforward",
                    //label: Strings.mediaPlayerChapterSkipForwardButtonLabel,
                    tooltip: Strings.mediaPlayerChapterSkipForwardButtonLabel,
                    priority: 16,
                    section: 'primary',
                    icon: "forward",
                    hidden: true,
                    //onclick: this._onChapterSkipForwardCommandInvoked.bind(this)
                }
            },
            closedCaptions: {
                classList: "win-mediaplayer-closedcaptionsbutton",
                options: {
                    id: "win-mediaplayer-closedcaptions",
                    //label: Strings.mediaPlayerClosedCaptionsButtonLabel,
                    tooltip: Strings.mediaPlayerClosedCaptionsButtonLabel,
                    section: 'primary',
                    priority: 4,
                    icon: "\uE7F0",
                    hidden: true,
                    //onclick: this._onClosedCaptionsCommandInvoked.bind(this)
                }
            },
            fastForward: {
                classList: "win-mediaplayer-fastforwardbutton",
                options: {
                    id: "win-mediaplayer-fastforward",
                    //label: Strings.mediaPlayerFastForwardButtonLabel,
                    tooltip: Strings.mediaPlayerFastForwardButtonLabel,
                    priority: 12,
                    section: 'primary',
                    icon: "next",
                    hidden: true,
                    //onclick: this._onFastForwardCommandInvoked.bind(this)
                }
            },
            goToLive: {
                classList: "win-mediaplayer-livebutton",
                options: {
                    id: "win-mediaplayer-live",
                    //label: Strings.mediaPlayerLiveButtonLabel,
                    tooltip: Strings.mediaPlayerLiveButtonLabel,
                    section: 'primary',
                    priority: 20,
                    icon: "gotostart",
                    hidden: true,
                    //onclick: this._onLiveButtonCommandInvoked.bind(this)
                }
            },
            nextTrack: {
                classList: "win-mediaplayer-nexttrackbutton",
                options: {
                    id: "win-mediaplayer-nexttrack",
                    //label: Strings.mediaPlayerNextTrackButtonLabel,
                    tooltip: Strings.mediaPlayerNextTrackButtonLabel,
                    section: 'primary',
                    priority: 14,
                    icon: "next",
                    hidden: true,
                    //onclick: this._onNextTrackCommandInvoked.bind(this)
                }
            },
            playbackRate: {
                classList: "win-mediaplayer-playbackratebutton",
                options: {
                    id: "win-mediaplayer-playbackrate",
                    //label: Strings.mediaPlayerPlayRateButtonLabel,
                    tooltip: Strings.mediaPlayerPlayRateButtonLabel,
                    section: 'primary',
                    priority: 9,
                    icon: "\uEC57",
                    hidden: true,
                    //onclick: this._onPlaybackRateCommandInvoked.bind(this)
                },
            },
            playFromBeginning: {
                classList: "win-mediaplayer-playfrombeginningbutton",
                options: {
                    id: "win-mediaplayer-playfrombeginning",
                    //label: Strings.mediaPlayerPlayFromBeginningButtonLabel,
                    section: 'primary',
                    tooltip: Strings.mediaPlayerPlayFromBeginningButtonLabel,
                    priority: 19,
                    icon: "refresh",
                    hidden: true,
                    //onclick: this._onPlayFromBeginningCommandInvoked.bind(this)
                }
            },
            playPause: {
                classList: "win-mediaplayer-playpausebutton",
                options: {
                    id: "win-mediaplayer-playpause",
                    //label: Strings.mediaPlayerPlayButtonLabel,
                    tooltip: Strings.mediaPlayerPlayButtonLabel,
                    section: 'primary',
                    priority: 1,
                    icon: "play",
                    onclick: this._onCommandPlay.bind(this)
                },
            },
            previousTrack: {
                classList: "win-mediaplayer-previoustrackbutton",
                options: {
                    id: "win-mediaplayer-previoustrack",
                    //label: Strings.mediaPlayerPreviousTrackButtonLabel,
                    tooltip: Strings.mediaPlayerPreviousTrackButtonLabel,
                    section: 'primary',
                    priority: 15,
                    icon: "previous",
                    hidden: true,
                    //onclick: this._onPlayFromBeginningCommandInvoked.bind(this)
                }
            },
            rewind: {
                classList: "win-mediaplayer-rewindbutton",
                options: {
                    id: "win-mediaplayer-rewind",
                    //label: Strings.mediaPlayerRewindButtonLabel,
                    tooltip: Strings.mediaPlayerRewindButtonLabel,
                    section: 'primary',
                    priority: 13,
                    icon: "previous",
                    hidden: true,
                    //onclick: this._onRewindCommandInvoked.bind(this)
                }
            },
            stop: {
                classList: "win-mediaplayer-stopbutton",
                options: {
                    id: "win-mediaplayer-stop",
                    //label: Strings.mediaPlayerStopButtonLabel,
                    tooltip: Strings.mediaPlayerStopButtonLabel,
                    section: 'primary',
                    priority: 18,
                    icon: "stop",
                    hidden: true,
                    //onclick: this._onStopCommandInvoked.bind(this)
                },
            },
            timeSkipBack: {
                classList: "win-mediaplayer-timeskipbackbutton",
                options: {
                    id: "win-mediaplayer-timeskipback",
                    //label: Strings.mediaPlayerTimeSkipBackButtonLabel,
                    tooltip: Strings.mediaPlayerTimeSkipBackButtonLabel,
                    section: 'primary',
                    priority: 11,
                    icon: "undo",
                    hidden: true,
                    //onclick: this._onTimeSkipBackCommandInvoked.bind(this)
                },
            },
            timeSkipForward: {
                classList: "win-mediaplayer-timeskipforwardbutton",
                options: {
                    id: "win-mediaplayer-timeskipforward",
                    //label: Strings.mediaPlayerTimeSkipForwardButtonLabel,
                    tooltip: Strings.mediaPlayerTimeSkipForwardButtonLabel,
                    section: 'primary',
                    priority: 10,
                    icon: "redo",
                    hidden: true,
                    //onclick: this._onTimeSkipForwardCommandInvoked.bind(this)
                },
            },
            toggleFullScreen: {
                classList: "win-mediaplayer-fullscreenbutton",
                options: {
                    id: "win-mediaplayer-fullscreen",
                    //label: Strings.mediaPlayerFullscreenButtonLabel,
                    tooltip: Strings.mediaPlayerFullscreenButtonLabel,
                    section: 'primary',
                    priority: 5,
                    icon: "fullscreen",
                    //onclick: this._onToggleFullscreenCommandInvoked.bind(this)
                }
            },
            volume: {
                classList: "win-mediaplayer-volumebutton",
                options: {
                    id: "win-mediaplayer-volume",
                    //label: Strings.mediaPlayerVolumeButtonLabel,
                    section: 'primary',
                    tooltip: Strings.mediaPlayerVolumeButtonLabel,
                    priority: 3,
                    icon: "volume",
                    //onclick: this._onVolumeCommandInvoked.bind(this)
                }
            },
            zoom: {
                classList: "win-mediaplayer-zoombutton",
                options: {
                    id: "win-mediaplayer-zoom",
                    //label: Strings.mediaPlayerZoomButtonLabel,
                    tooltip: Strings.mediaPlayerZoomButtonLabel,
                    section: 'primary',
                    priority: 7,
                    icon: "\uE799",
                    //onclick: this._onZoomCommandInvoked.bind(this)
                }
            }
        };
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
        
        var makeCommand = (commandDesc: ICommandDescription): _Command.AppBarCommand => {
            var command = new _Command.AppBarCommand(null, commandDesc.options);
            _ElementUtilities.addClass(command.element, commandDesc.classList);
            return command;
        };
        
        var commandDescriptions = this._commandDescriptions;
        var commands = {
            audioTracks: makeCommand(commandDescriptions.audioTracks),
            cast: makeCommand(commandDescriptions.cast),
            chapterSkipBack: makeCommand(commandDescriptions.chapterSkipBack),
            chapterSkipForward: makeCommand(commandDescriptions.chapterSkipForward),
            closedCaptions: makeCommand(commandDescriptions.closedCaptions),
            fastForward: makeCommand(commandDescriptions.fastForward),
            goToLive: makeCommand(commandDescriptions.goToLive),
            nextTrack: makeCommand(commandDescriptions.nextTrack),
            playbackRate: makeCommand(commandDescriptions.playbackRate),
            playFromBeginning: makeCommand(commandDescriptions.playFromBeginning),
            playPause: makeCommand(commandDescriptions.playPause),
            previousTrack: makeCommand(commandDescriptions.previousTrack),
            rewind: makeCommand(commandDescriptions.rewind),
            stop: makeCommand(commandDescriptions.stop),
            timeSkipBack: makeCommand(commandDescriptions.timeSkipBack),
            timeSkipForward: makeCommand(commandDescriptions.timeSkipForward),
            toggleFullScreen: makeCommand(commandDescriptions.toggleFullScreen),
            volume: makeCommand(commandDescriptions.volume),
            zoom: makeCommand(commandDescriptions.zoom)
        };
        this._commandOrderings = {
            full: [
                commands.playFromBeginning,
                commands.chapterSkipBack,
                commands.previousTrack,
                commands.stop,
                commands.timeSkipBack,
                commands.rewind,
                commands.cast,
                commands.zoom,
                commands.audioTracks,
                commands.playPause,
                commands.closedCaptions,
                commands.volume,
                commands.toggleFullScreen,
                commands.timeSkipForward,
                commands.fastForward,
                commands.playbackRate,
                commands.nextTrack,
                commands.chapterSkipForward,
                commands.goToLive
            ],
            compact: [
                commands.playPause,
                commands.playFromBeginning,
                commands.chapterSkipBack,
                commands.previousTrack,
                commands.stop,
                commands.timeSkipBack,
                commands.rewind,
                commands.cast,
                commands.zoom,
                commands.audioTracks,
                commands.closedCaptions,
                commands.volume,
                commands.toggleFullScreen,
                commands.timeSkipForward,
                commands.fastForward,
                commands.playbackRate,
                commands.nextTrack,
                commands.chapterSkipForward,
                commands.goToLive
            ]
        };
        
        // TODO: Support custom commands declaratively -- isDeclarativeControlContainer?
        // var customCommands = Array.prototype.map.call(root.querySelectorAll("[data-win-control='WinJS.UI.Command']"), (commandEl: HTMLElement) => {
        //     return commandEl["winControl"];
        // });
        var commandsBindingList = new BindingList.List(this._commandOrderings.full);
        // commandsBindingList.splice(commandsBindingList.length, 0, customCommands);
        var toolBar = new ToolBar.ToolBar(getElement(ClassNames.toolBar), {
            data: commandsBindingList,
            closedDisplayMode: ToolBar.ToolBar.ClosedDisplayMode.full
        });
        
        this._dom = {
            commands: commands,
            content: contentEl,
            controls: getElement(ClassNames.controls),
            root: root,
            toolBar: toolBar,
            transportControls: getElement(ClassNames.transportControls)
        };
    }

    // State private to _updateDomImpl. No other method should make use of it.
    //
    // Nothing has been rendered yet so these are all initialized to undefined. Because
    // they are undefined, the first time _updateDomImpl is called, they will all be
    // rendered.
    private _updateDomImpl_rendered = {
        controlsShown: <boolean>undefined,
        mediaElement: <HTMLMediaElement>undefined,
        playPauseButtonIsPlay: <boolean>undefined
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
        
        // TODO: How should we determine which state we're in? Reading from media element adapter
        //   is like reading from DOM so not too good. We want the control to track its own state.
        // TODO: How do we get informed that this._mediaElementAdapter.paused has changed and our
        //   UI is stale? No telling when custom MediaPlayerAdapter might decide to mutate media
        //   element... Is media element the source of truth? If somebody clicks "play", do we
        //   immediately switch to the "playing" UI even though media element might not have
        //   started playing yet?
        var playPauseButtonIsPlay = this._mediaElementAdapter.paused;
        if (rendered.playPauseButtonIsPlay !== playPauseButtonIsPlay) {
            if (playPauseButtonIsPlay) {
                this._dom.commands.playPause.icon = "play";
                // TODO: Can't set label because it'll prevent the tooltip from showing
                //this._dom.commands.playPause.label = Strings.mediaPlayerPlayButtonLabel;
                this._dom.commands.playPause.tooltip = Strings.mediaPlayerPlayButtonLabel;
                this._dom.commands.playPause.onclick = this._onCommandPlay.bind(this);
            } else {
                this._dom.commands.playPause.icon = "pause";
                // TODO: Can't set label because it'll prevent the tooltip from showing
                //this._dom.commands.playPause.label = "Pause";
                this._dom.commands.playPause.tooltip = "Pause";
                this._dom.commands.playPause.onclick = this._onCommandPause.bind(this);
            }
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
    }
    
    private _playShowControlsAnimation(): void {
        this._prepareToAnimateControls();
        
        this._controlsState = ControlsState.showing;
        this._updateDomImpl();
        
        Animations.fadeIn(this._dom.controls).done(() => {
            this._controlsState = ControlsState.shown;
            this._updateDomImpl();
            this._autoHider.shown();
        });
    }
    
    private _playHideControlsAnimation(): void {
        this._prepareToAnimateControls();
        
        this._controlsState = ControlsState.hiding;
        this._updateDomImpl();
        
        Animations.fadeOut(this._dom.controls).done(() => {
            this._controlsState = ControlsState.hidden;
            this._updateDomImpl();
            this._autoHider.hidden();
        });
    }
    
    // Click handlers for commands
    //
    
    private _onCommandPlay(eventObject: MouseEvent) {
        // TODO: Should MediaPlayer have internal play/pause state that it looks at instead
        //  of reading from the DOM?
        // TODO: Should MediaPlayer change the event handler on the play/pause button so we have
        //   onCommandPlay and onCommandPause instead of onCommandPlayPause?
        this.play();
        
        // TODO: Hack to kick UI for now
        this._updateDomImpl();
    }
    
    private _onCommandPause(eventObject: MouseEvent) {
        // TODO: Should MediaPlayer have internal play/pause state that it looks at instead
        //  of reading from the DOM?
        // TODO: Should MediaPlayer change the event handler on the play/pause button so we have
        //   onCommandPlay and onCommandPause instead of onCommandPlayPause?
        this.pause();
        
        // TODO: Hack to kick UI for now
        this._updateDomImpl();
    }
}

_Base.Class.mix(MediaPlayer, _Events.createEventProperties(
));
_Base.Class.mix(MediaPlayer, _Control.DOMEventMixin);
