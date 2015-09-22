import _ErrorFromName = require("../../Core/_ErrorFromName");
import _IMediaPlayer = require('./_MediaPlayer'); // Only used for type information
import _Resources = require("../../Core/_Resources");

var Strings = {
    get mediaElementAdapterConstructorNullParameter() { return _Resources._getWinJSString("ui/mediaElementAdapterConstructorNullParameter").value; },
};

export class MediaElementAdapter {

    static supportedForProcessing: boolean = true;
    
    private _disposed: boolean;
    private _mediaPlayer: _IMediaPlayer.MediaPlayer;
    
    constructor(mediaPlayer: _IMediaPlayer.MediaPlayer, existingMediaElement: HTMLMediaElement) {
        this.baseMediaElementAdapterConstructor(mediaPlayer, existingMediaElement);
    }
    
    // TODO: What's the purpose of baseMediaElementAdapterConstructor? What is it that consumers
    // expect it to do? Is setting up private instance variables (e.g. _mediaPlayer) important?
    baseMediaElementAdapterConstructor(mediaPlayer: _IMediaPlayer.MediaPlayer, existingMediaElement: HTMLMediaElement) {
        if (!mediaPlayer) {
            throw new _ErrorFromName("WinJS.UI.MediaElementAdapter.nullParameter", Strings.mediaElementAdapterConstructorNullParameter);
        }
        
        this._disposed = false;
        this._mediaPlayer = mediaPlayer;
        this._mediaElement = existingMediaElement ||
            <HTMLMediaElement>mediaPlayer.element.querySelector("video") ||
            <HTMLMediaElement>mediaPlayer.element.querySelector("audio");
    }
    
    dispose(): void {
        if (this._disposed) {
            return;
        }
        this._disposed = true;
        this._mediaPlayer = null;
        this._mediaElement && this._mediaElement.removeAttribute("src");
        this._mediaElement = null;
    }
    
    nextTrack(): void {
        
    }
    pause(): void {
        // TODO: _mediaElement isn't required?
        // TODO: How does _isPlayAllowed fit into this?
        this._mediaElement && this._mediaElement.pause();
    }

    play(): void {
        // TODO: _mediaElement isn't required?
        // TODO: How does _isPlayAllowed fit into this?
        this._mediaElement && this._mediaElement.play();
    }
    
    previousTrack(): void {
        
    }
    
    seek(newTime: number): void {
        if (this._mediaElement) {
            this._mediaElement.currentTime = newTime;
        }
    }
    
    stop(): void {
        
    }
    
    get liveTime(): number {
        throw new Error("NYI");
    }
    
    get isLive(): boolean {
        throw new Error("NYI");
    }
    
    get isPauseAllowed(): boolean {
        throw new Error("NYI");
    }
    
    get isPlayAllowed(): boolean {
        throw new Error("NYI");
    }
    
    get isSeekAllowed(): boolean {
        throw new Error("NYI");
    }
    
    private _mediaElement: HTMLMediaElement;
    get mediaElement(): HTMLMediaElement {
        return this._mediaElement;
    }
}